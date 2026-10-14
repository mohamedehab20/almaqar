import { and, eq, gte } from "drizzle-orm";
import { leaveBalances, leaveRequests, leaveSettings, members } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { departmentOf, getMyPermissions, hasPermission, requirePermission } from "@/server/permissions";
import { emitEvent } from "@/modules/events/service";
import { listDepartments, listMembers } from "@/modules/hq/service";
import {
  checkRequest,
  DEFAULT_WEEKEND,
  readAllowances,
  workingDays,
  type Allowances,
  type AllowanceOverride,
  type LeaveRequest,
  type LeaveSettings,
  type LeaveType,
} from "./calc";

const today = () => new Date().toISOString().slice(0, 10);

type RequestRow = typeof leaveRequests.$inferSelect;

function toRequest(r: RequestRow): LeaveRequest {
  return {
    id: r.id,
    memberId: r.memberId,
    type: r.type,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    days: r.days,
    reason: r.reason,
    status: r.status,
    decidedById: r.decidedById,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
  };
}

async function loadSettings(ctx: Ctx, companyId: string): Promise<LeaveSettings> {
  const [row] = await ctx.tx.select().from(leaveSettings).where(eq(leaveSettings.companyId, companyId));
  return { allowances: readAllowances(row?.allowances), weekendDays: row?.weekendDays ?? DEFAULT_WEEKEND };
}

/** Everything one person's balance depends on (their requests and per-year allowances). */
async function memberLeave(ctx: Ctx, companyId: string, memberId: string) {
  const [settings, requests, overrides] = await Promise.all([
    loadSettings(ctx, companyId),
    ctx.tx.select().from(leaveRequests).where(eq(leaveRequests.memberId, memberId)),
    ctx.tx.select().from(leaveBalances).where(eq(leaveBalances.memberId, memberId)),
  ]);
  return {
    settings,
    requests: requests.map(toRequest),
    overrides: overrides.map((o): AllowanceOverride => ({ memberId: o.memberId, year: o.year, type: o.type, allowance: o.allowance })),
  };
}

// ---------- Reading ----------

/**
 * The leave page: the company policy, the caller's own requests and balances, and, for whoever has
 * leaves.manage, the employees of the departments they manage (RLS hides everyone else's rows).
 * Requests and allowances go back to the start of last year.
 */
export async function getLeaveData(ctx: Ctx, companyId: string) {
  const me = await requireMember(ctx, companyId);
  const now = today();
  const year = Number(now.slice(0, 4));
  const since = `${year - 1}-01-01`;
  const [mine, canSettings, settings, allMembers, departments, requests, overrides] = await Promise.all([
    getMyPermissions(ctx, companyId),
    hasPermission(ctx, companyId, "leaves.manage"),
    loadSettings(ctx, companyId),
    listMembers(ctx, companyId),
    listDepartments(ctx, companyId),
    ctx.tx.select().from(leaveRequests).where(and(eq(leaveRequests.companyId, companyId), gte(leaveRequests.endsOn, since))),
    ctx.tx.select().from(leaveBalances).where(and(eq(leaveBalances.companyId, companyId), gte(leaveBalances.year, year - 1))),
  ]);
  const scope = mine.scopes["leaves.manage"];
  const manages = (departmentId: string) => scope === "all" || (Array.isArray(scope) && scope.includes(departmentId));
  const team = allMembers.filter((m) => m.id === me.id || manages(m.departmentId));
  return {
    today: now,
    year,
    meId: me.id,
    owner: me.role === "owner",
    canManage: Boolean(scope && (scope === "all" || scope.length > 0)),
    canSettings,
    settings,
    members: team.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
    // Names of whoever decided a request (may be outside the managed departments)
    names: Object.fromEntries(allMembers.map((m) => [m.id, m.name])),
    departments,
    requests: requests.map(toRequest),
    overrides: overrides.map((o): AllowanceOverride => ({ memberId: o.memberId, year: o.year, type: o.type, allowance: o.allowance })),
  };
}

export type LeaveData = Awaited<ReturnType<typeof getLeaveData>>;

// ---------- Employee: request and cancel ----------

/** Any member, for themselves. Working days are counted here; overlaps and an exhausted balance are refused. */
export async function requestLeave(ctx: Ctx, input: { companyId: string; type: LeaveType; startsOn: string; endsOn: string; reason?: string | null }) {
  const me = await requireMember(ctx, input.companyId);
  const data = await memberLeave(ctx, input.companyId, me.id);
  const problem = checkRequest({ memberId: me.id, type: input.type, startsOn: input.startsOn, endsOn: input.endsOn }, data);
  if (problem) throw new AppError(problem);
  const [row] = await ctx.tx
    .insert(leaveRequests)
    .values({
      companyId: input.companyId,
      memberId: me.id,
      type: input.type,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      days: workingDays(input.startsOn, input.endsOn, data.settings.weekendDays),
      reason: input.reason?.trim() || null,
    })
    .returning();
  await emitEvent(ctx, input.companyId, {
    type: "leave.requested",
    payload: { requestId: row.id, employeeId: me.id, leaveType: row.type, from: row.startsOn, to: row.endsOn, days: row.days },
  });
  return toRequest(row);
}

/** The employee withdraws their own request: while pending, or once approved if it has not started yet. */
export async function cancelLeave(ctx: Ctx, input: { requestId: string }) {
  const [current] = await ctx.tx.select().from(leaveRequests).where(eq(leaveRequests.id, input.requestId));
  const request = found(current);
  const me = await requireMember(ctx, request.companyId);
  if (request.memberId !== me.id) throw new AppError("forbidden");
  const cancellable = request.status === "pending" || (request.status === "approved" && request.startsOn > today());
  if (!cancellable) throw new AppError("invalid");
  const [row] = await ctx.tx.update(leaveRequests).set({ status: "cancelled" }).where(eq(leaveRequests.id, request.id)).returning();
  await emitEvent(ctx, request.companyId, { type: "leave.cancelled", payload: { requestId: row.id, employeeId: me.id } });
  return toRequest(row);
}

// ---------- Manager: decide and set balances ----------

/**
 * Approve or reject a pending request (leaves.manage for the employee's department). Nobody but the owner
 * decides their own request. Approval re-checks the balance, which may have been lowered since.
 */
export async function decideLeave(ctx: Ctx, input: { requestId: string; decision: "approved" | "rejected"; note?: string | null }) {
  const [current] = await ctx.tx.select().from(leaveRequests).where(eq(leaveRequests.id, input.requestId));
  const request = found(current);
  await requirePermission(ctx, request.companyId, "leaves.manage", await departmentOf(ctx, request.memberId));
  const me = await requireMember(ctx, request.companyId);
  if (request.memberId === me.id && me.role !== "owner") throw new AppError("forbidden");
  if (request.status !== "pending") throw new AppError("invalid");
  if (input.decision === "approved") {
    const data = await memberLeave(ctx, request.companyId, request.memberId);
    const problem = checkRequest(request, data, request.id);
    if (problem) throw new AppError(problem);
  }
  const [row] = await ctx.tx
    .update(leaveRequests)
    .set({ status: input.decision, decidedById: me.id, decidedAt: new Date(), decisionNote: input.note?.trim() || null })
    .where(eq(leaveRequests.id, request.id))
    .returning();
  await emitEvent(ctx, request.companyId, {
    type: input.decision === "approved" ? "leave.approved" : "leave.rejected",
    payload: { requestId: row.id, employeeId: row.memberId, days: row.days },
  });
  return toRequest(row);
}

/** One employee's allowance of one type for one year. null = back to the company default. */
export async function setLeaveAllowance(ctx: Ctx, input: { memberId: string; year: number; type: LeaveType; allowance: number | null }) {
  const [member] = await ctx.tx.select({ companyId: members.companyId, departmentId: members.departmentId }).from(members).where(eq(members.id, input.memberId));
  const { companyId, departmentId } = found(member);
  await requirePermission(ctx, companyId, "leaves.manage", departmentId);
  const key = and(eq(leaveBalances.memberId, input.memberId), eq(leaveBalances.year, input.year), eq(leaveBalances.type, input.type));
  if (input.allowance === null) {
    await ctx.tx.delete(leaveBalances).where(key);
  } else {
    await ctx.tx
      .insert(leaveBalances)
      .values({ companyId, memberId: input.memberId, year: input.year, type: input.type, allowance: input.allowance })
      .onConflictDoUpdate({ target: [leaveBalances.memberId, leaveBalances.year, leaveBalances.type], set: { allowance: input.allowance } });
  }
}

/** The company policy: yearly days per type and the weekend. Needs leaves.manage for every department. */
export async function saveLeaveSettings(ctx: Ctx, input: { companyId: string; allowances: Allowances; weekendDays: number[] }) {
  await requirePermission(ctx, input.companyId, "leaves.manage");
  const weekendDays = [...new Set(input.weekendDays)].filter((d) => d >= 0 && d <= 6).sort();
  if (weekendDays.length > 3) throw new AppError("invalid");
  const values = { companyId: input.companyId, allowances: readAllowances(input.allowances), weekendDays, updatedAt: new Date() };
  await ctx.tx.insert(leaveSettings).values(values).onConflictDoUpdate({ target: leaveSettings.companyId, set: values });
  return { allowances: values.allowances, weekendDays };
}
