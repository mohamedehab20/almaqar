import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { leaveRequests, leaveSettings, members, workSessions, workSettings } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { departmentOf, getMyPermissions, hasPermission, requirePermission } from "@/server/permissions";
import { listDepartments, listMembers } from "@/modules/hq/service";
import { DEFAULT_WEEKEND } from "@/modules/leave/calc";
import { checkManualEntry, localParts, monthDays, readWorkSettings, TIME_ZONES, toMinutes, type LeaveSpan, type WorkSession, type WorkSettings } from "./calc";

type SessionRow = typeof workSessions.$inferSelect;

function toSession(r: SessionRow): WorkSession {
  return { id: r.id, memberId: r.memberId, startedAt: r.startedAt.toISOString(), endedAt: r.endedAt?.toISOString() ?? null, source: r.source, note: r.note };
}

async function loadSettings(ctx: Ctx, companyId: string) {
  const [[work], [leave]] = await Promise.all([
    ctx.tx.select().from(workSettings).where(eq(workSettings.companyId, companyId)),
    ctx.tx.select({ weekendDays: leaveSettings.weekendDays }).from(leaveSettings).where(eq(leaveSettings.companyId, companyId)),
  ]);
  return { settings: readWorkSettings(work), weekendDays: leave?.weekendDays ?? DEFAULT_WEEKEND };
}

// ---------- Reading ----------

/** The company's time zone (work settings, or the default): every date on screen is shown in it. */
export async function getCompanyTimeZone(ctx: Ctx, companyId: string) {
  const [row] = await ctx.tx.select({ timeZone: workSettings.timeZone }).from(workSettings).where(eq(workSettings.companyId, companyId));
  return readWorkSettings(row).timeZone;
}

/**
 * The hours page for one month ("YYYY-MM", default: this month in the company's time zone): the company's
 * working day, the caller's sessions, and for whoever has hours.manage the sessions of the departments they
 * follow (RLS hides the rest), plus approved leave to excuse those days.
 */
export async function getWorkHoursData(ctx: Ctx, companyId: string, month?: string) {
  const me = await requireMember(ctx, companyId);
  const now = new Date().toISOString();
  const [{ settings, weekendDays }, mine, canSettings, allMembers, departments] = await Promise.all([
    loadSettings(ctx, companyId),
    getMyPermissions(ctx, companyId),
    hasPermission(ctx, companyId, "hours.manage"),
    listMembers(ctx, companyId),
    listDepartments(ctx, companyId),
  ]);
  const today = localParts(now, settings.timeZone).date;
  const shown = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
  const days = monthDays(shown);
  // A day of margin on each side: sessions are placed on their local day by calc
  const from = new Date(Date.parse(`${days[0]}T00:00:00Z`) - 86_400_000);
  const to = new Date(Date.parse(`${days.at(-1)}T23:59:59Z`) + 86_400_000);
  const [sessions, leaves] = await Promise.all([
    ctx.tx
      .select()
      .from(workSessions)
      .where(and(eq(workSessions.companyId, companyId), gte(workSessions.startedAt, from), lte(workSessions.startedAt, to))),
    ctx.tx
      .select({ memberId: leaveRequests.memberId, startsOn: leaveRequests.startsOn, endsOn: leaveRequests.endsOn })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.companyId, companyId), eq(leaveRequests.status, "approved"), lte(leaveRequests.startsOn, days.at(-1)!), gte(leaveRequests.endsOn, days[0]))),
  ]);
  // A session left running from an earlier month still shows (and can be stopped)
  const [open] = await ctx.tx.select().from(workSessions).where(and(eq(workSessions.memberId, me.id), isNull(workSessions.endedAt)));

  const scope = mine.scopes["hours.manage"];
  const follows = (departmentId: string) => scope === "all" || (Array.isArray(scope) && scope.includes(departmentId));
  const team = allMembers.filter((m) => m.id === me.id || follows(m.departmentId));
  const rows = sessions.map(toSession);
  if (open && !rows.some((s) => s.id === open.id)) rows.push(toSession(open));

  return {
    now,
    today,
    month: shown,
    meId: me.id,
    canManage: Boolean(scope && (scope === "all" || scope.length > 0)),
    canSettings,
    settings,
    weekendDays,
    members: team.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
    departments,
    sessions: rows,
    leaves: leaves satisfies LeaveSpan[],
  };
}

export type WorkHoursData = Awaited<ReturnType<typeof getWorkHoursData>>;

// ---------- Clock in / out ----------

export async function clockIn(ctx: Ctx, input: { companyId: string }) {
  const me = await requireMember(ctx, input.companyId);
  const [open] = await ctx.tx.select({ id: workSessions.id }).from(workSessions).where(and(eq(workSessions.memberId, me.id), isNull(workSessions.endedAt)));
  if (open) throw new AppError("conflict");
  const [row] = await ctx.tx
    .insert(workSessions)
    .values({ companyId: input.companyId, memberId: me.id, startedAt: new Date(), source: "timer", createdById: me.id })
    .returning();
  return toSession(row);
}

export async function clockOut(ctx: Ctx, input: { companyId: string }) {
  const me = await requireMember(ctx, input.companyId);
  const [open] = await ctx.tx.select().from(workSessions).where(and(eq(workSessions.memberId, me.id), isNull(workSessions.endedAt)));
  if (!open) throw new AppError("invalid");
  const endedAt = new Date(Math.max(Date.now(), open.startedAt.getTime() + 1000));
  const [row] = await ctx.tx.update(workSessions).set({ endedAt }).where(eq(workSessions.id, open.id)).returning();
  return toSession(row);
}

// ---------- Entries by hand ----------

/**
 * Hours typed in for one day (a forgotten clock-in, work outside the office). For yourself, or for someone in
 * a department you follow (hours.manage). Marked "manual"; no overlap with other hours, nothing in the future.
 */
export async function addWorkSession(ctx: Ctx, input: { companyId: string; memberId?: string | null; date: string; from: string; to: string; note?: string | null }) {
  const me = await requireMember(ctx, input.companyId);
  const memberId = input.memberId ?? me.id;
  if (memberId !== me.id) {
    const [target] = await ctx.tx.select({ companyId: members.companyId }).from(members).where(eq(members.id, memberId));
    if (found(target).companyId !== input.companyId) throw new AppError("not_found");
    await requirePermission(ctx, input.companyId, "hours.manage", await departmentOf(ctx, memberId));
  }
  const [{ settings }, theirs] = await Promise.all([loadSettings(ctx, input.companyId), ctx.tx.select().from(workSessions).where(eq(workSessions.memberId, memberId))]);
  const check = checkManualEntry({ memberId, date: input.date, from: input.from, to: input.to }, { settings, sessions: theirs.map(toSession), now: new Date().toISOString() });
  if (check.problem) throw new AppError(check.problem);
  const [row] = await ctx.tx
    .insert(workSessions)
    .values({ companyId: input.companyId, memberId, startedAt: new Date(check.startedAt), endedAt: new Date(check.endedAt), source: "manual", note: input.note?.trim() || null, createdById: me.id })
    .returning();
  return toSession(row);
}

/** Your own hours typed by hand, or anyone's in a department you follow. */
export async function deleteWorkSession(ctx: Ctx, input: { sessionId: string }) {
  const [current] = await ctx.tx.select().from(workSessions).where(eq(workSessions.id, input.sessionId));
  const session = found(current);
  const me = await requireMember(ctx, session.companyId);
  const manager = await hasPermission(ctx, session.companyId, "hours.manage", await departmentOf(ctx, session.memberId));
  if (!manager && !(session.memberId === me.id && session.source === "manual")) throw new AppError("forbidden");
  await ctx.tx.delete(workSessions).where(eq(workSessions.id, session.id));
}

// ---------- Company working day ----------

export async function saveWorkSettings(ctx: Ctx, input: { companyId: string } & WorkSettings) {
  await requirePermission(ctx, input.companyId, "hours.manage");
  const length = toMinutes(input.dayEnd) - toMinutes(input.dayStart);
  if (length <= 0 || input.breakMinutes >= length || !(TIME_ZONES as readonly string[]).includes(input.timeZone)) throw new AppError("invalid");
  const values = {
    companyId: input.companyId,
    dayStart: input.dayStart,
    dayEnd: input.dayEnd,
    breakMinutes: input.breakMinutes,
    graceMinutes: input.graceMinutes,
    timeZone: input.timeZone,
    updatedAt: new Date(),
  };
  await ctx.tx.insert(workSettings).values(values).onConflictDoUpdate({ target: workSettings.companyId, set: values });
  return readWorkSettings(values);
}
