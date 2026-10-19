import { and, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import { departments as departmentsTable, leaveSettings, tasks, workflowRuns, workflows, workSettings } from "@/db/schema";
import { rowsOf, type Ctx } from "@/server/context";
import { requirePermission } from "@/server/permissions";
import { listMembers } from "@/modules/hq/service";
import { DEFAULT_WEEKEND } from "@/modules/leave/calc";
import { dailyMinutes, localParts, readWorkSettings, zonedToUtc } from "@/modules/hours/calc";
import { computeAnalytics, monthRange, NO_DEPARTMENT, runWaiting, type AnalyticsResult, type RunInput } from "./calc";

export type AnalyticsData = AnalyticsResult & {
  month: string;
  today: string;
  readAt: string;
  timeZone: string;
  canSeeMembers: boolean;
  /** Names of people that bottlenecks point at (only where the caller may see people) */
  names: Record<string, { ar: string; en: string }>;
};

const iso = (v: unknown) => new Date(v as string).toISOString();
const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * The Analytics room for one month ("YYYY-MM", default this month). Opens with analytics.view. Which departments
 * appear, and where people appear, is decided here from the caller's grants (analytics.departments,
 * analytics.members); nothing in the request can widen it. Private rows (hours, leave, approvals) come from
 * database readers that apply the same scope (drizzle/0036_analytics.sql).
 */
export async function getAnalyticsData(ctx: Ctx, companyId: string, month?: string): Promise<AnalyticsData> {
  await requirePermission(ctx, companyId, "analytics.view");
  const readAt = new Date().toISOString();

  const [[work], [leave], scopeRows, allMembers, deptRows] = await Promise.all([
    ctx.tx.select().from(workSettings).where(eq(workSettings.companyId, companyId)),
    ctx.tx.select({ weekendDays: leaveSettings.weekendDays }).from(leaveSettings).where(eq(leaveSettings.companyId, companyId)),
    ctx.tx.execute(sql`
      select null::uuid as id,
             private.has_permission(${companyId}::uuid, 'analytics.departments', null) as see,
             private.has_permission(${companyId}::uuid, 'analytics.members', null) as people
      union all
      select d.id,
             private.has_permission(${companyId}::uuid, 'analytics.departments', d.id),
             private.has_permission(${companyId}::uuid, 'analytics.members', d.id)
      from public.departments d where d.company_id = ${companyId}::uuid`),
    listMembers(ctx, companyId),
    ctx.tx.select().from(departmentsTable).where(eq(departmentsTable.companyId, companyId)),
  ]);

  const settings = readWorkSettings(work);
  const tz = settings.timeZone;
  const today = localParts(readAt, tz).date;
  const shown = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
  const { from, to } = monthRange(shown, today);

  // Scope: a NULL row = "every department" (only an unscoped grant matches it)
  const visible = new Set<string>();
  const people = new Set<string>();
  for (const r of rowsOf<{ id: string | null; see: boolean; people: boolean }>(scopeRows)) {
    const key = r.id ?? NO_DEPARTMENT;
    if (r.see) visible.add(key);
    if (r.see && r.people) people.add(key);
    if (r.id === null && r.see) visible.add("*");
  }

  const [taskRows, runRows, minuteRows, leaveRows, approvalRows] = await Promise.all([
    ctx.tx
      .select({ id: tasks.id, assigneeId: tasks.assigneeId, status: tasks.status, dueDate: tasks.dueDate, createdAt: tasks.createdAt, completedAt: tasks.completedAt })
      .from(tasks)
      .where(
        and(
          eq(tasks.companyId, companyId),
          or(ne(tasks.status, "done"), and(gte(tasks.dueDate, from), lte(tasks.dueDate, to)), gte(tasks.completedAt, new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000))),
        ),
      ),
    ctx.tx
      .select({ run: workflowRuns, steps: workflows.steps })
      .from(workflowRuns)
      .leftJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
      .where(and(eq(workflowRuns.companyId, companyId), inArray(workflowRuns.status, ["in_progress", "changes_requested"]))),
    ctx.tx.execute(
      sql`select member_id, minutes from private.analytics_minutes(${companyId}::uuid, ${zonedToUtc(from, "00:00", tz)}::timestamptz, ${zonedToUtc(nextDay(to), "00:00", tz)}::timestamptz)`,
    ),
    ctx.tx.execute(sql`select member_id, starts_on::text as starts_on, ends_on::text as ends_on from private.analytics_leave(${companyId}::uuid, ${from}::date, ${to}::date)`),
    ctx.tx.execute(sql`select approver_id, created_at, due_on::text as due_on from private.analytics_waiting_approvals(${companyId}::uuid)`),
  ]);

  const minutes: Record<string, number> = {};
  for (const r of rowsOf<{ member_id: string; minutes: number }>(minuteRows)) minutes[r.member_id] = Number(r.minutes) || 0;

  const result = computeAnalytics({
    month: shown,
    today,
    dayOf: (at) => localParts(at, tz).date,
    dailyMinutes: dailyMinutes(settings),
    weekendDays: leave?.weekendDays ?? DEFAULT_WEEKEND,
    departments: deptRows
      .filter((d) => d.active || allMembers.some((m) => m.departmentId === d.id))
      .map((d) => ({ id: d.id, name: d.name, color: d.color })),
    members: allMembers.map((m) => ({ id: m.id, name: m.name, title: m.title ?? null, departmentId: m.departmentId || null })),
    tasks: taskRows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), completedAt: t.completedAt?.toISOString() ?? null })),
    minutes,
    leaves: rowsOf<{ member_id: string; starts_on: string; ends_on: string }>(leaveRows).map((l) => ({ memberId: l.member_id, startsOn: l.starts_on, endsOn: l.ends_on })),
    approvals: rowsOf<{ approver_id: string; created_at: string; due_on: string | null }>(approvalRows).map((a) => ({ approverId: a.approver_id, createdAt: iso(a.created_at), dueOn: a.due_on })),
    runs: runRows
      .map(({ run, steps }) => runWaiting({ ...run, createdAt: run.createdAt.toISOString() }, steps ?? undefined))
      .filter((r): r is RunInput => r !== null),
    visible,
    people,
  });

  const names: AnalyticsData["names"] = {};
  for (const b of result.bottlenecks) {
    if (b.kind === "approvals" && b.memberId) {
      const m = allMembers.find((x) => x.id === b.memberId);
      if (m) names[m.id] = m.name;
    }
  }
  return { ...result, month: shown, today, readAt, timeZone: tz, canSeeMembers: people.size > 0, names };
}
