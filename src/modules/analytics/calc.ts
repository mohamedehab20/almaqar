/**
 * Analytics room: pure calculations, shared by the server and the demo. Every metric is per department for one
 * month, in the company's time zone. Formulas and rules: development-almaqar/10-analytics-srs.md (KPI-01…07, BR-01…05).
 * A task counts in the department of its assignee today (tasks have no department of their own).
 */
import { workingDays } from "@/modules/leave/calc";

type Localized = { ar: string; en: string };

/** Ratios built on fewer items than this show «بيانات غير كافية» (BR-02). */
export const MIN_SAMPLE = 5;
/** "On target": timeliness and delivery at or above this (until companies can set their own targets). */
export const TARGET = 0.8;
/** An approval or a workflow step waiting longer than this many days is a bottleneck. */
export const WAITING_DAYS = 3;
/** "No department" group, for members without one (only for callers who see every department). */
export const NO_DEPARTMENT = "none";

const DAY = 86_400_000;

export type Ratio = { value: number | null; part: number; sample: number; insufficient: boolean };

export function ratio(part: number, sample: number): Ratio {
  return { value: sample > 0 ? part / sample : null, part, sample, insufficient: sample < MIN_SAMPLE };
}

export type TaskInput = {
  id: string;
  assigneeId: string | null;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type MemberInput = { id: string; name: Localized; title: Localized | null; departmentId: string | null };
export type DepartmentInput = { id: string; name: Localized; color: string };
export type LeaveInput = { memberId: string; startsOn: string; endsOn: string };
export type ApprovalInput = { approverId: string; createdAt: string; dueOn: string | null };
/** A workflow run waiting on someone: the current step's assignee, or the owner after "changes requested". */
export type RunInput = { id: string; code: string; waitingOnId: string | null; since: string };

export type AnalyticsInput = {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD in the company's time zone
  dayOf: (iso: string) => string; // instant → local YYYY-MM-DD
  dailyMinutes: number;
  weekendDays: number[];
  departments: DepartmentInput[];
  members: MemberInput[];
  tasks: TaskInput[];
  minutes: Record<string, number>;
  leaves: LeaveInput[];
  approvals: ApprovalInput[];
  runs: RunInput[];
  /** Which department ids (or NO_DEPARTMENT) the caller sees, and where they may see people */
  visible: Set<string>;
  people: Set<string>;
};

export type PersonStats = {
  id: string;
  name: Localized;
  title: Localized | null;
  open: number;
  overdue: number;
  done: number;
  timeliness: Ratio;
  loggedMinutes: number;
  expectedMinutes: number;
};

export type Status = "on_target" | "behind" | "unknown";

export type DepartmentStats = {
  id: string;
  name: Localized;
  color: string;
  members: number;
  status: Status;
  delivery: Ratio;
  timeliness: Ratio;
  overdue: { count: number; oldestDays: number };
  medianCycleDays: number | null;
  doneCount: number;
  open: number;
  openPerMember: number;
  capacity: Ratio & { loggedMinutes: number; expectedMinutes: number };
  waitingApprovals: { count: number; oldestDays: number };
  stuckRuns: { count: number; oldestDays: number };
  people?: PersonStats[];
};

export type Bottleneck =
  | { kind: "overdue"; departmentId: string; count: number; days: number }
  | { kind: "approvals"; departmentId: string; count: number; days: number; memberId?: string }
  | { kind: "stuck"; departmentId: string; count: number; days: number; codes: string[] }
  | { kind: "overload"; departmentId: string; perMember: number; average: number }
  | { kind: "hours"; departmentId: string; value: number }
  | { kind: "unowned"; count: number };

export type AnalyticsResult = {
  summary: { departments: number; onTarget: number; known: number; overdue: number; timeliness: Ratio; waiting: number };
  departments: DepartmentStats[];
  bottlenecks: Bottleneck[];
};

const daysBetween = (fromDay: string, toDay: string) => Math.max(0, Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY));

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** First and last day of a month, and the last day that has already started (for expected hours and due work). */
export function monthRange(month: string, today: string) {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const until = today < from ? null : today > to ? to : today;
  return { from, to, until };
}

/** Working minutes a member owed in the month so far: working days × daily minutes, minus approved leave days. */
export function expectedMinutes(memberId: string, input: Pick<AnalyticsInput, "month" | "today" | "dailyMinutes" | "weekendDays" | "leaves">) {
  const { from, until } = monthRange(input.month, input.today);
  if (!until) return 0;
  let days = workingDays(from, until, input.weekendDays);
  for (const l of input.leaves) {
    if (l.memberId !== memberId) continue;
    const s = l.startsOn > from ? l.startsOn : from;
    const e = l.endsOn < until ? l.endsOn : until;
    if (s <= e) days -= workingDays(s, e, input.weekendDays);
  }
  return Math.max(0, days) * input.dailyMinutes;
}

function statusOf(delivery: Ratio, timeliness: Ratio): Status {
  const known = [delivery, timeliness].filter((r) => !r.insufficient && r.value !== null);
  if (!known.length) return "unknown";
  return known.every((r) => (r.value ?? 0) >= TARGET) ? "on_target" : "behind";
}

export function computeAnalytics(input: AnalyticsInput): AnalyticsResult {
  const { from, to, until } = monthRange(input.month, input.today);
  const inMonth = (day: string) => day >= from && day <= to;

  const groups: DepartmentInput[] = [...input.departments];
  if (input.members.some((m) => !m.departmentId)) groups.push({ id: NO_DEPARTMENT, name: { ar: "بدون قسم", en: "No department" }, color: "slate" });

  const departments: DepartmentStats[] = [];
  const bottlenecks: Bottleneck[] = [];

  for (const d of groups) {
    if (!input.visible.has(d.id)) continue;
    const people = input.members.filter((m) => (m.departmentId ?? NO_DEPARTMENT) === d.id);
    if (d.id === NO_DEPARTMENT && !people.length) continue;
    const ids = new Set(people.map((m) => m.id));
    const tasks = input.tasks.filter((t) => t.assigneeId && ids.has(t.assigneeId));

    const statsFor = (ts: TaskInput[]) => {
      const due = ts.filter((t) => t.dueDate && inMonth(t.dueDate) && until !== null && t.dueDate <= until);
      const done = ts.filter((t) => t.status === "done" && t.completedAt && inMonth(input.dayOf(t.completedAt)));
      const dated = done.filter((t) => t.dueDate);
      const onTime = dated.filter((t) => input.dayOf(t.completedAt!) <= t.dueDate!);
      const open = ts.filter((t) => t.status !== "done");
      const late = open.filter((t) => t.dueDate && t.dueDate < input.today);
      return { due, done, dated, onTime, open, late };
    };
    const s = statsFor(tasks);
    const delivery = ratio(s.due.filter((t) => t.status === "done").length, s.due.length);
    const timeliness = ratio(s.onTime.length, s.dated.length);
    const oldestLate = s.late.reduce((max, t) => Math.max(max, daysBetween(t.dueDate!, input.today)), 0);
    const cycle = median(s.done.map((t) => (Date.parse(t.completedAt!) - Date.parse(t.createdAt)) / DAY));

    const logged = people.reduce((sum, m) => sum + (input.minutes[m.id] ?? 0), 0);
    const expected = people.reduce((sum, m) => sum + expectedMinutes(m.id, input), 0);
    const capacity = { ...ratio(logged, expected), insufficient: expected === 0, value: expected > 0 ? logged / expected : null, loggedMinutes: logged, expectedMinutes: expected };

    const approvals = input.approvals.filter((a) => ids.has(a.approverId));
    const oldApprovals = approvals.filter((a) => daysBetween(input.dayOf(a.createdAt), input.today) >= WAITING_DAYS);
    const runs = input.runs.filter((r) => r.waitingOnId && ids.has(r.waitingOnId));
    const stuck = runs.filter((r) => daysBetween(input.dayOf(r.since), input.today) >= WAITING_DAYS);
    const oldest = (list: { createdAt?: string; since?: string }[]) =>
      list.reduce((max, x) => Math.max(max, daysBetween(input.dayOf((x.createdAt ?? x.since)!), input.today)), 0);

    const stats: DepartmentStats = {
      id: d.id,
      name: d.name,
      color: d.color,
      members: people.length,
      status: statusOf(delivery, timeliness),
      delivery,
      timeliness,
      overdue: { count: s.late.length, oldestDays: oldestLate },
      medianCycleDays: cycle === null ? null : Math.round(cycle * 10) / 10,
      doneCount: s.done.length,
      open: s.open.length,
      openPerMember: people.length ? Math.round((s.open.length / people.length) * 10) / 10 : 0,
      capacity,
      waitingApprovals: { count: approvals.length, oldestDays: oldest(approvals) },
      stuckRuns: { count: stuck.length, oldestDays: oldest(stuck) },
    };

    if (input.people.has(d.id)) {
      stats.people = people.map((m) => {
        const p = statsFor(tasks.filter((t) => t.assigneeId === m.id));
        return {
          id: m.id,
          name: m.name,
          title: m.title,
          open: p.open.length,
          overdue: p.late.length,
          done: p.done.length,
          timeliness: ratio(p.onTime.length, p.dated.length),
          loggedMinutes: input.minutes[m.id] ?? 0,
          expectedMinutes: expectedMinutes(m.id, input),
        };
      });
    }
    departments.push(stats);

    // Bottlenecks: measurable facts with their evidence, never a judgement about people (BR-03)
    if (s.late.length >= 3 || oldestLate >= 7) bottlenecks.push({ kind: "overdue", departmentId: d.id, count: s.late.length, days: oldestLate });
    if (oldApprovals.length) {
      if (input.people.has(d.id)) {
        const byApprover = new Map<string, ApprovalInput[]>();
        for (const a of oldApprovals) byApprover.set(a.approverId, [...(byApprover.get(a.approverId) ?? []), a]);
        for (const [memberId, list] of byApprover) bottlenecks.push({ kind: "approvals", departmentId: d.id, memberId, count: list.length, days: oldest(list) });
      } else bottlenecks.push({ kind: "approvals", departmentId: d.id, count: oldApprovals.length, days: oldest(oldApprovals) });
    }
    if (stuck.length) bottlenecks.push({ kind: "stuck", departmentId: d.id, count: stuck.length, days: oldest(stuck), codes: stuck.map((r) => r.code).slice(0, 5) });
    if (!capacity.insufficient && capacity.value !== null && capacity.value < 0.6 && until) bottlenecks.push({ kind: "hours", departmentId: d.id, value: capacity.value });
  }

  // Workload: open work per person well above the average of the departments shown
  const withPeople = departments.filter((d) => d.members > 0);
  const totalOpen = withPeople.reduce((sum, d) => sum + d.open, 0);
  const totalPeople = withPeople.reduce((sum, d) => sum + d.members, 0);
  const average = totalPeople ? totalOpen / totalPeople : 0;
  for (const d of withPeople) {
    if (withPeople.length > 1 && d.openPerMember >= 3 && d.openPerMember >= average * 1.5) {
      bottlenecks.push({ kind: "overload", departmentId: d.id, perMember: d.openPerMember, average: Math.round(average * 10) / 10 });
    }
  }
  // Open work with nobody responsible: only for callers who see every department (it belongs to none)
  const unowned = input.tasks.filter((t) => !t.assigneeId && t.status !== "done").length;
  if (unowned && input.visible.has("*")) bottlenecks.push({ kind: "unowned", count: unowned });

  const onTarget = departments.filter((d) => d.status === "on_target").length;
  const known = departments.filter((d) => d.status !== "unknown").length;
  const dated = departments.reduce((sum, d) => sum + d.timeliness.sample, 0);
  const onTime = departments.reduce((sum, d) => sum + d.timeliness.part, 0);
  return {
    summary: {
      departments: departments.length,
      onTarget,
      known,
      overdue: departments.reduce((sum, d) => sum + d.overdue.count, 0),
      timeliness: ratio(onTime, dated),
      waiting: departments.reduce((sum, d) => sum + d.waitingApprovals.count + d.stuckRuns.count, 0),
    },
    departments,
    bottlenecks,
  };
}

/** Which run waits on whom, and since when: the current step's assignee (or the owner after "changes requested"). */
export function runWaiting(
  run: { id: string; code: string; status: string; currentStep: number; ownerId: string | null; createdAt: string; history: { at: string }[] },
  steps: { assigneeId: string }[] | undefined,
): RunInput | null {
  if (run.status !== "in_progress" && run.status !== "changes_requested") return null;
  const waitingOnId = run.status === "changes_requested" ? run.ownerId : (steps?.[run.currentStep]?.assigneeId ?? null);
  const since = run.history.at(-1)?.at ?? run.createdAt;
  return { id: run.id, code: run.code, waitingOnId, since };
}
