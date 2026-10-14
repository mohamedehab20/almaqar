import { and, eq, gte, isNotNull } from "drizzle-orm";
import { clients, clientUsers, departments, meetings } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { hasPermission, requirePermission } from "@/server/permissions";
import { emitEvent } from "@/modules/events/service";
import { ROOM_KEYS } from "@/modules/departments/rooms";
import { assertMemberInCompany, listDepartments, listMembers } from "@/modules/hq/service";
import { newInviteCode } from "@/modules/marketing/service";

export type ClientKind = "client" | "visitor";
export type ClientStatus = "active" | "onboarding" | "paused";

/** Who a client belongs to: an HQ room, a company department, or nobody (a visitor who only comes for a meeting). */
export type ClientOwner = { kind: ClientKind; room: string | null; departmentId: string | null };

export type PortalClient = ClientOwner & {
  id: string;
  name: string;
  industry: string | null;
  status: ClientStatus;
  managerId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  /** Only for clients.manage */
  inviteCode: string | null;
  portalUsers: number;
  createdAt: string;
};

export type ClientMeeting = { id: string; clientId: string; title: string; startsAt: string; durationMinutes: number; location: string | null };

const clean = (s: string | null | undefined) => s?.trim() || null;

/** Throws `invalid` unless the owner is consistent: a visitor belongs to nobody; a client to one room or one department of this company. */
async function checkOwner(ctx: Ctx, companyId: string, owner: Partial<ClientOwner>) {
  if (owner.kind === "visitor" && (owner.room || owner.departmentId)) throw new AppError("invalid");
  if (owner.room && owner.departmentId) throw new AppError("invalid");
  if (owner.room && !(ROOM_KEYS as string[]).includes(owner.room)) throw new AppError("invalid");
  if (owner.departmentId) {
    const [d] = await ctx.tx.select({ companyId: departments.companyId }).from(departments).where(eq(departments.id, owner.departmentId));
    if (d?.companyId !== companyId) throw new AppError("invalid");
  }
}

// ---------- Reading ----------

/** «بوابة العملاء»: every client and visitor of the company, who they belong to, portal access and upcoming meetings. */
export async function getClientPortalData(ctx: Ctx, companyId: string) {
  await requireMember(ctx, companyId);
  const since = new Date(Date.now() - 12 * 3_600_000);
  const [canManage, rows, users, upcoming, departmentList, memberList] = await Promise.all([
    hasPermission(ctx, companyId, "clients.manage"),
    ctx.tx.select().from(clients).where(eq(clients.companyId, companyId)),
    ctx.tx.select({ clientId: clientUsers.clientId }).from(clientUsers).innerJoin(clients, eq(clients.id, clientUsers.clientId)).where(eq(clients.companyId, companyId)),
    ctx.tx
      .select()
      .from(meetings)
      .where(and(eq(meetings.companyId, companyId), isNotNull(meetings.clientId), eq(meetings.status, "scheduled"), gte(meetings.startsAt, since))),
    listDepartments(ctx, companyId),
    listMembers(ctx, companyId),
  ]);
  return {
    now: new Date().toISOString(),
    canManage,
    clients: rows
      .map(
        (r): PortalClient => ({
          id: r.id,
          name: r.name.ar || r.name.en,
          industry: r.industry ? r.industry.ar || r.industry.en || null : null,
          status: r.status,
          kind: r.kind,
          room: r.room,
          departmentId: r.departmentId,
          managerId: r.managerId,
          contactName: r.contactName,
          contactPhone: r.contactPhone,
          contactEmail: r.contactEmail,
          notes: r.notes,
          inviteCode: canManage ? r.inviteCode : null,
          portalUsers: users.filter((u) => u.clientId === r.id).length,
          createdAt: r.createdAt.toISOString(),
        }),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    meetings: upcoming
      .map((m): ClientMeeting => ({ id: m.id, clientId: m.clientId!, title: m.title, startsAt: m.startsAt.toISOString(), durationMinutes: m.durationMinutes, location: m.location }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    departments: departmentList,
    members: memberList.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
  };
}

export type ClientPortalData = Awaited<ReturnType<typeof getClientPortalData>>;

// ---------- Changes (clients.manage) ----------

export type ClientInput = Partial<ClientOwner> & {
  name?: string;
  industry?: string | null;
  status?: ClientStatus;
  managerId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
};

function values(input: ClientInput) {
  return {
    ...(input.name !== undefined && { name: { ar: input.name.trim(), en: input.name.trim() } }),
    ...(input.industry !== undefined && { industry: clean(input.industry) ? { ar: clean(input.industry)!, en: clean(input.industry)! } : null }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.kind !== undefined && { kind: input.kind }),
    ...(input.room !== undefined && { room: input.room }),
    ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
    ...(input.managerId !== undefined && { managerId: input.managerId }),
    ...(input.contactName !== undefined && { contactName: clean(input.contactName) }),
    ...(input.contactPhone !== undefined && { contactPhone: clean(input.contactPhone) }),
    ...(input.contactEmail !== undefined && { contactEmail: clean(input.contactEmail)?.toLowerCase() ?? null }),
    ...(input.notes !== undefined && { notes: clean(input.notes) }),
  };
}

/** A new client (with a portal invite code) or a visitor. */
export async function createPortalClient(ctx: Ctx, input: { companyId: string; name: string } & ClientInput) {
  await requirePermission(ctx, input.companyId, "clients.manage");
  const owner = { kind: input.kind ?? "client", room: input.room ?? null, departmentId: input.departmentId ?? null };
  await checkOwner(ctx, input.companyId, owner);
  await assertMemberInCompany(ctx, input.companyId, input.managerId);
  const [row] = await ctx.tx
    .insert(clients)
    .values({ ...values(input), ...owner, name: { ar: input.name.trim(), en: input.name.trim() }, companyId: input.companyId, status: input.status ?? (owner.kind === "visitor" ? "active" : "onboarding"), inviteCode: newInviteCode() })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "client.created", payload: { clientId: row.id, kind: row.kind, room: row.room, departmentId: row.departmentId } });
  return row.id;
}

/** Edit a client; changing who it belongs to clears the other owner (a room or a department, never both). */
export async function updatePortalClient(ctx: Ctx, input: { clientId: string } & ClientInput) {
  const [current] = await ctx.tx.select().from(clients).where(eq(clients.id, input.clientId));
  const client = found(current);
  await requirePermission(ctx, client.companyId, "clients.manage");
  const owner =
    input.kind === "visitor"
      ? { kind: "visitor" as const, room: null, departmentId: null }
      : input.room !== undefined || input.departmentId !== undefined || input.kind !== undefined
        ? { kind: input.kind ?? client.kind, room: input.room ?? null, departmentId: input.departmentId ?? null }
        : {};
  await checkOwner(ctx, client.companyId, owner);
  await assertMemberInCompany(ctx, client.companyId, input.managerId);
  const [row] = await ctx.tx
    .update(clients)
    .set({ ...values(input), ...owner })
    .where(eq(clients.id, client.id))
    .returning();
  return row.id;
}

/** Removes the client with everything attached to it (briefs, portal users); its meetings stay in the schedule. */
export async function deletePortalClient(ctx: Ctx, input: { clientId: string }) {
  const [current] = await ctx.tx.select({ companyId: clients.companyId }).from(clients).where(eq(clients.id, input.clientId));
  await requirePermission(ctx, found(current).companyId, "clients.manage");
  await ctx.tx.update(meetings).set({ clientId: null }).where(eq(meetings.clientId, input.clientId));
  await ctx.tx.delete(clients).where(eq(clients.id, input.clientId));
}

/** A meeting with the client (or visitor) in the company schedule, organised by the caller, with the contact filled in. */
export async function bookClientMeeting(
  ctx: Ctx,
  input: { clientId: string; title?: string | null; startsAt: string; durationMinutes: number; location?: string | null; attendeeIds?: string[] },
) {
  const [current] = await ctx.tx.select().from(clients).where(eq(clients.id, input.clientId));
  const client = found(current);
  await requirePermission(ctx, client.companyId, "clients.manage");
  const me = await requireMember(ctx, client.companyId);
  for (const id of input.attendeeIds ?? []) await assertMemberInCompany(ctx, client.companyId, id);
  const name = client.name.ar || client.name.en;
  const [row] = await ctx.tx
    .insert(meetings)
    .values({
      companyId: client.companyId,
      clientId: client.id,
      kind: client.kind === "visitor" ? "appointment" : "meeting",
      title: clean(input.title) ?? name,
      startsAt: new Date(input.startsAt),
      durationMinutes: input.durationMinutes,
      location: clean(input.location),
      organizerId: me.id,
      attendeeIds: [...new Set(input.attendeeIds ?? [])].filter((id) => id !== me.id),
      contactName: client.contactName ?? name,
      contactPhone: client.contactPhone,
    })
    .returning();
  return { id: row.id, clientId: client.id, title: row.title, startsAt: row.startsAt.toISOString(), durationMinutes: row.durationMinutes, location: row.location } satisfies ClientMeeting;
}
