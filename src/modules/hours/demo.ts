/**
 * Sample working hours for the public demo: the demo team over the current month, each with a habit (early and
 * long days, often late, short days, an absence), approved leave from the leave demo, and a few people clocked
 * in right now. Built from `now` so the month always looks lived in.
 */
import { currentUserId, departments, members } from "@/modules/hq/mock";
import { demoLeaveData } from "@/modules/leave/demo";
import { DEFAULT_WEEKEND } from "@/modules/leave/calc";
import { DEFAULT_WORK_SETTINGS, localParts, monthDays, toMinutes, zonedToUtc, type WorkSession } from "./calc";
import type { WorkHoursData } from "./service";

/** [start, end] in minutes after midnight, before the daily jitter */
const habits: Record<string, { start: number; end: number; absent?: number[]; manual?: number[] }> = {
  m1: { start: 8 * 60 + 45, end: 18 * 60 + 15 },
  m2: { start: 8 * 60 + 58, end: 17 * 60 + 5 },
  m3: { start: 9 * 60 + 35, end: 17 * 60 + 40 },
  m4: { start: 9 * 60 + 5, end: 15 * 60 + 50, manual: [3] },
  m5: { start: 8 * 60 + 55, end: 17 * 60 },
  m6: { start: 9 * 60, end: 17 * 60 + 10, absent: [6] },
  m7: { start: 9 * 60 + 10, end: 17 * 60 + 20 },
};

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
/** Stable small variation per person and day (−9 … +9 minutes) */
const jitter = (seed: string) => ([...seed].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 9973, 7) % 19) - 9;

export function demoWorkHoursData(now = new Date().toISOString(), locale: "ar" | "en" = "ar", shownMonth?: string): WorkHoursData {
  const settings = { ...DEFAULT_WORK_SETTINGS };
  const tz = settings.timeZone;
  const { date: today, time: nowTime } = localParts(now, tz);
  const month = shownMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(shownMonth) && shownMonth <= today.slice(0, 7) ? shownMonth : today.slice(0, 7);
  const leaves = demoLeaveData(today, locale)
    .requests.filter((r) => r.status === "approved")
    .map((r) => ({ memberId: r.memberId, startsOn: r.startsOn, endsOn: r.endsOn }));

  const sessions: WorkSession[] = [];
  for (const m of members) {
    const habit = habits[m.id] ?? habits.m2;
    let workday = 0;
    for (const date of monthDays(month)) {
      if (date > today) break;
      if (DEFAULT_WEEKEND.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) continue;
      workday++;
      if (leaves.some((l) => l.memberId === m.id && l.startsOn <= date && l.endsOn >= date)) continue;
      if (habit.absent?.includes(workday) && date < today) continue;
      const start = habit.start + jitter(`${m.id}${date}s`);
      const end = habit.end + jitter(`${m.id}${date}e`);
      const id = `demo-${m.id}-${date}`;
      if (date === today) {
        // Today: whoever has arrived is still clocked in
        if (toMinutes(nowTime) <= start) continue;
        sessions.push({ id, memberId: m.id, startedAt: zonedToUtc(date, hhmm(start), tz), endedAt: toMinutes(nowTime) >= end ? zonedToUtc(date, hhmm(end), tz) : null, source: "timer", note: null });
        continue;
      }
      const manual = habit.manual?.includes(workday);
      sessions.push({
        id,
        memberId: m.id,
        startedAt: zonedToUtc(date, hhmm(start), tz),
        endedAt: zonedToUtc(date, hhmm(end), tz),
        source: manual ? "manual" : "timer",
        note: manual ? (locale === "ar" ? "نسيت أسجّل، كنت عند عميل" : "Forgot to clock in, was at a client") : null,
      });
    }
  }

  return {
    now,
    today,
    month,
    meId: currentUserId,
    canManage: true,
    canSettings: true,
    settings,
    weekendDays: [...DEFAULT_WEEKEND],
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
    departments,
    sessions,
    leaves,
  };
}
