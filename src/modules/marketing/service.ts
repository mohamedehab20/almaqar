import { and, asc, desc, eq } from "drizzle-orm";
import { briefs, clientUsers, clients, marketingIdeas, members, type IdeaDelivery, type IdeaRatings, type IdeaVersion, type Localized } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireAdmin, requireMember } from "@/server/membership";
import { emitEvent } from "@/modules/events/service";
import type { Brief, BriefStatus, CampaignType } from "./briefs-mock";
import type { Client } from "./sections-mock";

const EMPTY: Localized = { ar: "", en: "" };

// ---------- Clients ----------

/** Invite codes are 7 characters without look-alikes (0/O, 1/I). */
function newInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type ClientRow = typeof clients.$inferSelect;

function toClient(r: ClientRow, manager: Localized | null, activeCampaigns: number): Client & { inviteCode: string | null; managerId: string | null } {
  return {
    id: r.id,
    name: r.name,
    industry: r.industry ?? EMPTY,
    manager: manager ?? EMPTY,
    activeCampaigns,
    monthlyBudget: r.monthlyBudget,
    status: r.status,
    inviteCode: r.inviteCode,
    managerId: r.managerId,
  };
}

export async function listClients(ctx: Ctx, companyId: string) {
  const [rows, ideas] = await Promise.all([
    ctx.tx
      .select({ client: clients, manager: members.name })
      .from(clients)
      .leftJoin(members, eq(members.id, clients.managerId))
      .where(eq(clients.companyId, companyId))
      .orderBy(asc(clients.createdAt)),
    ctx.tx
      .select({ clientId: marketingIdeas.clientId })
      .from(marketingIdeas)
      .where(and(eq(marketingIdeas.companyId, companyId), eq(marketingIdeas.stage, "delivery"))),
  ]);
  const active = (id: string) => ideas.filter((i) => i.clientId === id).length;
  return rows.map(({ client, manager }) => toClient(client, manager, active(client.id)));
}

export async function createClient(
  ctx: Ctx,
  input: { companyId: string; name: Localized; industry?: Localized; managerId?: string | null; monthlyBudget?: number; status?: Client["status"] },
) {
  await requireMember(ctx, input.companyId);
  const [row] = await ctx.tx
    .insert(clients)
    .values({ ...input, inviteCode: newInviteCode() })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "client.created", payload: { clientId: row.id } });
  return toClient(row, null, 0);
}

export async function updateClient(
  ctx: Ctx,
  input: { clientId: string; name?: Localized; industry?: Localized; managerId?: string | null; monthlyBudget?: number; status?: Client["status"] },
) {
  const { clientId, ...patch } = input;
  const [row] = await ctx.tx.update(clients).set(patch).where(eq(clients.id, clientId)).returning();
  return toClient(found(row), null, 0);
}

/** New invite code; the old one stops working. Portal users already linked keep access. */
export async function regenerateInviteCode(ctx: Ctx, input: { clientId: string }) {
  const [client] = await ctx.tx.select({ companyId: clients.companyId }).from(clients).where(eq(clients.id, input.clientId));
  await requireAdmin(ctx, found(client).companyId);
  const [row] = await ctx.tx.update(clients).set({ inviteCode: newInviteCode() }).where(eq(clients.id, input.clientId)).returning();
  return found(row).inviteCode;
}

/** Client portal: the client(s) the signed-in visitor can open. */
export async function getMyClients(ctx: Ctx) {
  const rows = await ctx.tx
    .select({ client: clients })
    .from(clientUsers)
    .innerJoin(clients, eq(clients.id, clientUsers.clientId))
    .where(eq(clientUsers.userId, ctx.userId));
  return rows.map(({ client }) => ({ id: client.id, companyId: client.companyId, name: client.name, status: client.status }));
}

// ---------- Briefs ----------

type BriefRow = typeof briefs.$inferSelect;

export function toBrief(r: BriefRow): Brief & { companyId: string } {
  return {
    id: r.id,
    companyId: r.companyId,
    clientId: r.clientId,
    type: r.type as CampaignType,
    objective: r.objective,
    audience: r.audience,
    details: r.details,
    budget: r.budget,
    deadline: r.deadline ?? "",
    receivedOn: r.receivedOn,
    attachment: r.attachmentPath ?? undefined,
    status: r.status,
    clientReply: r.clientReply ?? undefined,
  };
}

/** Company side: every brief of the company. Portal side: pass clientId (RLS limits it to the visitor's client). */
export async function listBriefs(ctx: Ctx, filter: { companyId: string } | { clientId: string }) {
  const where = "companyId" in filter ? eq(briefs.companyId, filter.companyId) : eq(briefs.clientId, filter.clientId);
  const rows = await ctx.tx.select().from(briefs).where(where).orderBy(desc(briefs.createdAt));
  return rows.map(toBrief);
}

/** Sent by a client portal user. The database logs a brief.received event for the company. */
export async function sendBrief(
  ctx: Ctx,
  input: {
    clientId: string;
    type: CampaignType;
    objective: Localized;
    audience: Localized;
    details: Localized;
    budget: number;
    deadline?: string | null;
    attachmentPath?: string | null;
  },
) {
  const [client] = await ctx.tx.select({ companyId: clients.companyId }).from(clients).where(eq(clients.id, input.clientId));
  const [row] = await ctx.tx
    .insert(briefs)
    .values({ ...input, companyId: found(client).companyId })
    .returning();
  return toBrief(row);
}

/** Company side: mark a brief received, or ask the client for clarification. */
export async function setBriefStatus(ctx: Ctx, input: { briefId: string; status: BriefStatus }) {
  const [current] = await ctx.tx.select().from(briefs).where(eq(briefs.id, input.briefId));
  await requireMember(ctx, found(current).companyId);
  const [row] = await ctx.tx.update(briefs).set({ status: input.status }).where(eq(briefs.id, input.briefId)).returning();
  await emitEvent(ctx, row.companyId, { type: `brief.${input.status}`, payload: { briefId: row.id, clientId: row.clientId } });
  return toBrief(row);
}

/** Portal side: the client answers a clarification request; the brief goes back to "new" for the team. */
export async function replyToBrief(ctx: Ctx, input: { briefId: string; reply: string }) {
  const [current] = await ctx.tx.select().from(briefs).where(eq(briefs.id, input.briefId));
  if (found(current).status !== "clarification") throw new AppError("invalid");
  const [row] = await ctx.tx
    .update(briefs)
    .set({ clientReply: input.reply, status: "new" })
    .where(eq(briefs.id, input.briefId))
    .returning();
  return toBrief(found(row));
}

// ---------- Ideas (idea bank → test lab → delivery) ----------

type IdeaRow = typeof marketingIdeas.$inferSelect;

function toIdea(r: IdeaRow, client: Localized | null, owner: Localized | null) {
  return {
    id: r.id,
    stage: r.stage,
    title: r.title,
    client: client ?? EMPTY,
    clientId: r.clientId,
    briefId: r.briefId,
    format: r.format ?? EMPTY,
    owner: owner ?? EMPTY,
    ownerId: r.ownerId,
    hook: r.hook ?? EMPTY,
    message: r.message ?? EMPTY,
    versions: r.versions.length ? r.versions : undefined,
    ratings: r.ratings ?? undefined,
    delivery: r.delivery ?? undefined,
  };
}

export async function listIdeas(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx
    .select({ idea: marketingIdeas, client: clients.name, owner: members.name })
    .from(marketingIdeas)
    .leftJoin(clients, eq(clients.id, marketingIdeas.clientId))
    .leftJoin(members, eq(members.id, marketingIdeas.ownerId))
    .where(eq(marketingIdeas.companyId, companyId))
    .orderBy(desc(marketingIdeas.createdAt));
  return rows.map(({ idea, client, owner }) => toIdea(idea, client, owner));
}

/** New idea in the bank; from a brief it is linked to that brief's client. */
export async function createIdea(
  ctx: Ctx,
  input: { companyId: string; title: Localized; clientId?: string | null; briefId?: string | null; format?: Localized; hook?: Localized; message?: Localized },
) {
  const me = await requireMember(ctx, input.companyId);
  let clientId = input.clientId ?? null;
  if (input.briefId) {
    const [brief] = await ctx.tx.select({ clientId: briefs.clientId }).from(briefs).where(eq(briefs.id, input.briefId));
    clientId = found(brief).clientId;
  }
  const [row] = await ctx.tx
    .insert(marketingIdeas)
    .values({ ...input, clientId, ownerId: me.id })
    .returning();
  return toIdea(row, null, me.name);
}

export async function updateIdea(
  ctx: Ctx,
  input: {
    ideaId: string;
    stage?: IdeaRow["stage"];
    title?: Localized;
    format?: Localized;
    hook?: Localized;
    message?: Localized;
    versions?: IdeaVersion[];
    ratings?: IdeaRatings | null;
    delivery?: IdeaDelivery | null;
  },
) {
  const { ideaId, ...patch } = input;
  const [row] = await ctx.tx.update(marketingIdeas).set(patch).where(eq(marketingIdeas.id, ideaId)).returning();
  return toIdea(found(row), null, null);
}

export async function deleteIdea(ctx: Ctx, input: { ideaId: string }) {
  const deleted = await ctx.tx.delete(marketingIdeas).where(eq(marketingIdeas.id, input.ideaId)).returning({ id: marketingIdeas.id });
  found(deleted[0]);
}
