import { and, asc, desc, eq } from "drizzle-orm";
import {
  briefs,
  campaigns,
  clientUsers,
  clients,
  marketingIdeas,
  members,
  socialAccounts,
  type ChannelMetrics,
  type IdeaDelivery,
  type IdeaRatings,
  type IdeaVersion,
  type Localized,
} from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { requirePermission } from "@/server/permissions";
import { emitEvent } from "@/modules/events/service";
import type { Brief, BriefStatus, CampaignType } from "./briefs-mock";
import type { Campaign, ChannelStat, Client, Platform, SocialAccount } from "./sections-mock";

const EMPTY: Localized = { ar: "", en: "" };

/** Company of a row (company-side updates and deletes check the permission against it). */
async function companyOfRow(ctx: Ctx, table: typeof clients | typeof marketingIdeas | typeof socialAccounts | typeof campaigns, id: string) {
  const [row] = await ctx.tx.select({ companyId: table.companyId }).from(table).where(eq(table.id, id));
  return found(row).companyId;
}

// ---------- Clients ----------

/** Invite codes are 7 characters without look-alikes (0/O, 1/I). */
function newInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type ClientRow = typeof clients.$inferSelect;

function toClient(
  r: ClientRow,
  manager: Localized | null,
  activeCampaigns: number,
): Client & { inviteCode: string | null; managerId: string | null; contractPath: string | null } {
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
    contractPath: r.contractPath,
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
  await requirePermission(ctx, input.companyId, "clients.manage");
  const [row] = await ctx.tx
    .insert(clients)
    .values({ ...input, inviteCode: newInviteCode() })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "client.created", payload: { clientId: row.id } });
  return toClient(row, null, 0);
}

export async function updateClient(
  ctx: Ctx,
  input: {
    clientId: string;
    name?: Localized;
    industry?: Localized;
    managerId?: string | null;
    monthlyBudget?: number;
    status?: Client["status"];
    /** Uploaded with folder "contracts"; must be in this company's folder */
    contractPath?: string | null;
  },
) {
  const { clientId, ...patch } = input;
  const companyId = await companyOfRow(ctx, clients, clientId);
  await requirePermission(ctx, companyId, "clients.manage");
  if (input.contractPath && !input.contractPath.startsWith(`${companyId}/contracts/`)) throw new AppError("invalid");
  const [row] = await ctx.tx.update(clients).set(patch).where(eq(clients.id, clientId)).returning();
  return toClient(found(row), null, 0);
}

/** New invite code; the old one stops working. Portal users already linked keep access. */
export async function regenerateInviteCode(ctx: Ctx, input: { clientId: string }) {
  await requirePermission(ctx, await companyOfRow(ctx, clients, input.clientId), "clients.manage");
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

/**
 * Event per status the team sets. Not "brief.received": that one is logged by the database when the
 * client sends the brief, and the two must stay distinguishable in the activity log.
 */
const BRIEF_STATUS_EVENT: Record<BriefStatus, `brief.${string}`> = {
  received: "brief.acknowledged",
  clarification: "brief.clarification_requested",
  new: "brief.reopened",
};

/** Company side: mark a brief received, or ask the client for clarification. */
export async function setBriefStatus(ctx: Ctx, input: { briefId: string; status: BriefStatus }) {
  const [current] = await ctx.tx.select().from(briefs).where(eq(briefs.id, input.briefId));
  await requirePermission(ctx, found(current).companyId, "briefs.manage");
  const [row] = await ctx.tx.update(briefs).set({ status: input.status }).where(eq(briefs.id, input.briefId)).returning();
  await emitEvent(ctx, row.companyId, { type: BRIEF_STATUS_EVENT[input.status], payload: { briefId: row.id, clientId: row.clientId } });
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
  await requirePermission(ctx, input.companyId, "ideas.manage");
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
  await requirePermission(ctx, await companyOfRow(ctx, marketingIdeas, ideaId), "ideas.manage");
  const [row] = await ctx.tx.update(marketingIdeas).set(patch).where(eq(marketingIdeas.id, ideaId)).returning();
  return toIdea(found(row), null, null);
}

export async function deleteIdea(ctx: Ctx, input: { ideaId: string }) {
  await requirePermission(ctx, await companyOfRow(ctx, marketingIdeas, input.ideaId), "ideas.manage");
  const deleted = await ctx.tx.delete(marketingIdeas).where(eq(marketingIdeas.id, input.ideaId)).returning({ id: marketingIdeas.id });
  found(deleted[0]);
}

// ---------- Sections: social accounts ----------

type AccountRow = typeof socialAccounts.$inferSelect;

function toAccount(r: AccountRow): SocialAccount {
  return {
    id: r.id,
    platform: r.platform,
    handle: r.handle,
    clientId: r.clientId,
    followers: r.followers,
    status: r.status,
    lastPost: r.lastPost ?? EMPTY,
  };
}

/** Company side: every account. Portal side: pass clientId (RLS limits it to the visitor's client). */
export async function listSocialAccounts(ctx: Ctx, filter: { companyId: string } | { clientId: string }) {
  const where = "companyId" in filter ? eq(socialAccounts.companyId, filter.companyId) : eq(socialAccounts.clientId, filter.clientId);
  const rows = await ctx.tx.select().from(socialAccounts).where(where).orderBy(asc(socialAccounts.createdAt));
  return rows.map(toAccount);
}

export async function createSocialAccount(
  ctx: Ctx,
  input: { clientId: string; platform: Platform; handle: string; followers?: number; status?: SocialAccount["status"]; lastPost?: Localized },
) {
  const [client] = await ctx.tx.select({ companyId: clients.companyId }).from(clients).where(eq(clients.id, input.clientId));
  const companyId = found(client).companyId;
  await requirePermission(ctx, companyId, "campaigns.manage");
  const [row] = await ctx.tx.insert(socialAccounts).values({ ...input, companyId }).returning();
  return toAccount(row);
}

export async function updateSocialAccount(
  ctx: Ctx,
  input: { accountId: string; handle?: string; followers?: number; status?: SocialAccount["status"]; lastPost?: Localized },
) {
  const { accountId, ...patch } = input;
  await requirePermission(ctx, await companyOfRow(ctx, socialAccounts, accountId), "campaigns.manage");
  const [row] = await ctx.tx.update(socialAccounts).set(patch).where(eq(socialAccounts.id, accountId)).returning();
  return toAccount(found(row));
}

export async function deleteSocialAccount(ctx: Ctx, input: { accountId: string }) {
  await requirePermission(ctx, await companyOfRow(ctx, socialAccounts, input.accountId), "campaigns.manage");
  const deleted = await ctx.tx.delete(socialAccounts).where(eq(socialAccounts.id, input.accountId)).returning({ id: socialAccounts.id });
  found(deleted[0]);
}

// ---------- Sections: campaigns ----------

type CampaignRow = typeof campaigns.$inferSelect;

function toCampaign(r: CampaignRow): Campaign & { briefId: string | null; metrics: CampaignRow["metrics"] } {
  return {
    id: r.id,
    name: r.name,
    clientId: r.clientId,
    channels: r.channels,
    stage: r.stage,
    progress: r.progress,
    start: r.startDate ?? "",
    end: r.endDate ?? "",
    spent: r.spent,
    briefId: r.briefId,
    metrics: r.metrics,
  };
}

/** Company side: every campaign. Portal side: pass clientId (the client follows its campaigns, read-only). */
export async function listCampaigns(ctx: Ctx, filter: { companyId: string } | { clientId: string }) {
  const where = "companyId" in filter ? eq(campaigns.companyId, filter.companyId) : eq(campaigns.clientId, filter.clientId);
  const rows = await ctx.tx.select().from(campaigns).where(where).orderBy(desc(campaigns.createdAt));
  return rows.map(toCampaign);
}

/** New campaign for a client; from a brief it takes that brief's client. */
export async function createCampaign(
  ctx: Ctx,
  input: {
    clientId?: string;
    briefId?: string | null;
    name: Localized;
    channels: Platform[];
    stage?: Campaign["stage"];
    start?: string | null;
    end?: string | null;
  },
) {
  let clientId = input.clientId;
  if (input.briefId) {
    const [brief] = await ctx.tx.select({ clientId: briefs.clientId }).from(briefs).where(eq(briefs.id, input.briefId));
    clientId = found(brief).clientId;
  }
  if (!clientId) throw new AppError("invalid");
  if (input.start && input.end && input.end < input.start) throw new AppError("invalid");
  const [client] = await ctx.tx.select({ companyId: clients.companyId }).from(clients).where(eq(clients.id, clientId));
  const companyId = found(client).companyId;
  await requirePermission(ctx, companyId, "campaigns.manage");
  const [row] = await ctx.tx
    .insert(campaigns)
    .values({
      companyId,
      clientId,
      briefId: input.briefId ?? null,
      name: input.name,
      channels: input.channels,
      stage: input.stage ?? "planning",
      startDate: input.start ?? null,
      endDate: input.end ?? null,
    })
    .returning();
  await emitEvent(ctx, companyId, { type: "campaign.created", payload: { campaignId: row.id, clientId } });
  return toCampaign(row);
}

export async function updateCampaign(
  ctx: Ctx,
  input: {
    campaignId: string;
    name?: Localized;
    channels?: Platform[];
    stage?: Campaign["stage"];
    progress?: number;
    start?: string | null;
    end?: string | null;
    spent?: number;
    metrics?: Partial<Record<Platform, ChannelMetrics>>;
  },
) {
  const [current] = await ctx.tx.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
  const before = found(current);
  await requirePermission(ctx, before.companyId, "campaigns.manage");
  const start = input.start !== undefined ? input.start : before.startDate;
  const end = input.end !== undefined ? input.end : before.endDate;
  if (start && end && end < start) throw new AppError("invalid");
  const [row] = await ctx.tx
    .update(campaigns)
    .set({
      name: input.name,
      channels: input.channels,
      stage: input.stage,
      // Finishing a campaign completes its progress
      progress: input.stage === "done" ? 1 : input.progress,
      startDate: input.start,
      endDate: input.end,
      spent: input.spent,
      metrics: input.metrics,
    })
    .where(eq(campaigns.id, input.campaignId))
    .returning();
  const after = found(row);
  if (input.stage && input.stage !== before.stage) {
    await emitEvent(ctx, after.companyId, { type: `campaign.${input.stage}`, payload: { campaignId: after.id, clientId: after.clientId } });
  }
  return toCampaign(after);
}

export async function deleteCampaign(ctx: Ctx, input: { campaignId: string }) {
  await requirePermission(ctx, await companyOfRow(ctx, campaigns, input.campaignId), "campaigns.manage");
  const deleted = await ctx.tx.delete(campaigns).where(eq(campaigns.id, input.campaignId)).returning({ id: campaigns.id });
  found(deleted[0]);
}

// ---------- Sections: budgets and channel stats (computed) ----------

const overlapsMonth = (c: CampaignRow, from: string, to: string) => (!c.startDate || c.startDate <= to) && (!c.endDate || c.endDate >= from);

/**
 * This month's budget per client: allocated = the client's monthly budget, spent = what its campaigns
 * that run during this month have spent. Shape of `budgets` in sections-mock.ts.
 */
export async function getClientBudgets(ctx: Ctx, companyId: string, month = new Date()) {
  const from = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const [clientRows, campaignRows] = await Promise.all([
    ctx.tx.select({ id: clients.id, allocated: clients.monthlyBudget }).from(clients).where(eq(clients.companyId, companyId)).orderBy(asc(clients.createdAt)),
    ctx.tx.select().from(campaigns).where(eq(campaigns.companyId, companyId)),
  ]);
  return clientRows.map((c) => ({
    clientId: c.id,
    allocated: c.allocated,
    spent: campaignRows.filter((k) => k.clientId === c.id && overlapsMonth(k, from, to)).reduce((sum, k) => sum + k.spent, 0),
  }));
}

/**
 * Per platform: how many campaigns use it, and totals from the campaigns' per-channel metrics.
 * conversion is a percentage (conversions / results); spendShare is 0–1 of all channel spend.
 */
export async function getChannelStats(ctx: Ctx, companyId: string): Promise<ChannelStat[]> {
  const rows = await ctx.tx.select().from(campaigns).where(eq(campaigns.companyId, companyId));
  const totals = new Map<Platform, ChannelMetrics & { campaigns: number }>();
  for (const k of rows) {
    for (const platform of k.channels) {
      const t = totals.get(platform) ?? { campaigns: 0, reach: 0, results: 0, conversions: 0, spend: 0 };
      const m = k.metrics[platform];
      t.campaigns += 1;
      if (m) {
        t.reach += m.reach;
        t.results += m.results;
        t.conversions += m.conversions;
        t.spend += m.spend;
      }
      totals.set(platform, t);
    }
  }
  const allSpend = [...totals.values()].reduce((sum, t) => sum + t.spend, 0);
  const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;
  return [...totals.entries()]
    .map(([platform, t]) => ({
      platform,
      campaigns: t.campaigns,
      reach: t.reach,
      costPerResult: t.results ? round(t.spend / t.results) : 0,
      conversion: t.results ? round((t.conversions / t.results) * 100) : 0,
      spendShare: allSpend ? round(t.spend / allSpend, 3) : 0,
    }))
    .sort((a, b) => b.spendShare - a.spendShare || b.campaigns - a.campaigns);
}

