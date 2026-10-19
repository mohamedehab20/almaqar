/**
 * Sample analytics for the public demo (/c/demo/analytics): the demo team's month built from habits per person
 * (finished work, how much of it on time, open and late work, hours logged), plus waiting approvals and a stuck
 * operation. Dates are relative to today so the month always looks current. Everyone is visible (the owner).
 */
import { departments, members } from "@/modules/hq/mock";
import { DEFAULT_WEEKEND } from "@/modules/leave/calc";
import { DEFAULT_WORK_SETTINGS, dailyMinutes, localParts } from "@/modules/hours/calc";
import { computeAnalytics, expectedMinutes, monthRange, NO_DEPARTMENT, type TaskInput } from "./calc";
import type { AnalyticsData } from "./service";

const DAY = 86_400_000;

/** Per person: finished this month, of which on time, still open, of which late, share of expected hours logged */
const habits: Record<string, { done: number; onTime: number; open: number; late: number; hours: number }> = {
  m1: { done: 6, onTime: 5, open: 3, late: 0, hours: 1.05 },
  m2: { done: 14, onTime: 13, open: 4, late: 0, hours: 0.98 },
  m3: { done: 9, onTime: 5, open: 9, late: 4, hours: 1.12 },
  m4: { done: 7, onTime: 4, open: 8, late: 3, hours: 1.08 },
  m5: { done: 6, onTime: 3, open: 5, late: 3, hours: 0.92 },
  m6: { done: 2, onTime: 2, open: 1, late: 0, hours: 0.9 },
  m7: { done: 1, onTime: 1, open: 2, late: 0, hours: 0.55 },
};

export function demoAnalyticsData(now = new Date().toISOString(), shownMonth?: string): AnalyticsData {
  const tz = DEFAULT_WORK_SETTINGS.timeZone;
  const today = localParts(now, tz).date;
  const month = shownMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(shownMonth) && shownMonth <= today.slice(0, 7) ? shownMonth : today.slice(0, 7);
  const { from, until } = monthRange(month, today);
  const last = until ?? from;
  const dayMs = (day: string) => Date.parse(`${day}T09:00:00Z`);
  const span = Math.max(1, Math.round((dayMs(last) - dayMs(from)) / DAY));
  const at = (fraction: number) => new Date(dayMs(from) + Math.round(span * fraction) * DAY).toISOString();
  const ago = (days: number) => new Date(Date.parse(now) - days * DAY).toISOString();
  const dayOf = (iso: string) => iso.slice(0, 10);

  const tasks: TaskInput[] = [];
  for (const [memberId, h] of Object.entries(habits)) {
    for (let i = 0; i < h.done; i++) {
      const completedAt = at((i + 1) / (h.done + 1));
      const late = i >= h.onTime;
      const due = new Date(Date.parse(completedAt) + (late ? -2 : 1) * DAY).toISOString().slice(0, 10);
      tasks.push({ id: `${memberId}-d${i}`, assigneeId: memberId, status: "done", dueDate: due, createdAt: new Date(Date.parse(completedAt) - (3 + (i % 4)) * DAY).toISOString(), completedAt });
    }
    for (let i = 0; i < h.open; i++) {
      const late = i < h.late;
      const due = new Date(Date.parse(`${today}T00:00:00Z`) + (late ? -(2 + i * 3) : 3 + i) * DAY).toISOString().slice(0, 10);
      tasks.push({ id: `${memberId}-o${i}`, assigneeId: memberId, status: i % 2 ? "in_progress" : "todo", dueDate: due, createdAt: ago(5 + i), completedAt: null });
    }
  }
  tasks.push({ id: "u1", assigneeId: null, status: "todo", dueDate: null, createdAt: ago(4), completedAt: null });
  tasks.push({ id: "u2", assigneeId: null, status: "todo", dueDate: null, createdAt: ago(9), completedAt: null });

  const leaves = [{ memberId: "m6", startsOn: from, endsOn: from }];
  const base = { month, today, dailyMinutes: dailyMinutes(DEFAULT_WORK_SETTINGS), weekendDays: DEFAULT_WEEKEND, leaves };
  const minutes = Object.fromEntries(Object.entries(habits).map(([id, h]) => [id, Math.round(expectedMinutes(id, base) * h.hours)]));
  const all = new Set<string>([...departments.map((d) => d.id), NO_DEPARTMENT, "*"]);

  const result = computeAnalytics({
    ...base,
    dayOf,
    departments: departments.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
    tasks,
    minutes,
    approvals: [
      { approverId: "m1", createdAt: ago(5), dueOn: null },
      { approverId: "m1", createdAt: ago(4), dueOn: null },
      { approverId: "m5", createdAt: ago(1), dueOn: null },
    ],
    runs: [
      { id: "r1", code: "OP-1042", waitingOnId: "m3", since: ago(6) },
      { id: "r2", code: "OP-1047", waitingOnId: "m2", since: ago(1) },
    ],
    visible: all,
    people: all,
  });
  const names = Object.fromEntries(members.filter((m) => result.bottlenecks.some((b) => b.kind === "approvals" && b.memberId === m.id)).map((m) => [m.id, m.name]));
  return { ...result, month, today, readAt: now, timeZone: tz, canSeeMembers: true, names };
}
