/**
 * Working-hours rules, shared by the server and the screen (and the public demo). Pure functions.
 *
 * - The company sets its day (start, end, break), a grace period for lateness and its time zone. The weekend
 *   comes from the leave policy, so both pages agree on which days are working days.
 * - A session counts on the local day it started. An open session (still clocked in) counts until `now`.
 * - Expected time = working days so far this month (before today), minus approved leave, × the daily hours.
 *   Today is shown on its own ("so far") and never counts as a shortfall.
 */

export type WorkSettings = {
  /** "HH:MM" in the company's time zone */
  dayStart: string;
  dayEnd: string;
  breakMinutes: number;
  /** Arriving later than start + grace counts as late */
  graceMinutes: number;
  timeZone: string;
};

export const DEFAULT_WORK_SETTINGS: WorkSettings = { dayStart: "09:00", dayEnd: "17:00", breakMinutes: 60, graceMinutes: 15, timeZone: "Africa/Cairo" };

export const TIME_ZONES = ["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Europe/London"] as const;

export type WorkSession = {
  id: string;
  memberId: string;
  startedAt: string;
  endedAt: string | null;
  source: "timer" | "manual";
  note: string | null;
};

/** Approved leave, enough to excuse days (same shape as the leave module's requests). */
export type LeaveSpan = { memberId: string; startsOn: string; endsOn: string };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Local date ("YYYY-MM-DD") and time ("HH:MM") of an instant in a time zone. */
export function localParts(at: string | number | Date, timeZone: string) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** The instant (ISO) of a local date and time in a time zone. */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const guess = Date.parse(`${date}T${time}:00Z`);
  const offsetAt = (ms: number) => {
    const p = localParts(ms, timeZone);
    return Date.parse(`${p.date}T${p.time}:00Z`) - ms;
  };
  // Twice, so a daylight-saving change between the guess and the answer is taken into account
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first)).toISOString();
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Paid minutes in one working day. */
export const dailyMinutes = (s: WorkSettings) => Math.max(0, toMinutes(s.dayEnd) - toMinutes(s.dayStart) - s.breakMinutes);

export function sessionMinutes(s: Pick<WorkSession, "startedAt" | "endedAt">, now: string) {
  return Math.max(0, Math.round((Date.parse(s.endedAt ?? now) - Date.parse(s.startedAt)) / 60_000));
}

/** Every date of a month ("YYYY-MM"). */
export function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export type DayStatus = "worked" | "late" | "absent" | "leave" | "weekend" | "today" | "future";

export type DayRow = {
  date: string;
  status: DayStatus;
  minutes: number;
  firstIn: string | null;
  lastOut: string | null;
  /** Still clocked in */
  open: boolean;
  manual: boolean;
  sessions: WorkSession[];
};

export type MonthSummary = {
  days: DayRow[];
  /** Working days before today that were not leave */
  expectedDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  expectedMinutes: number;
  /** Minutes on days before today */
  workedMinutes: number;
  /** worked − expected, on days before today */
  balanceMinutes: number;
  todayMinutes: number;
  working: boolean;
};

export function summarizeMonth(
  memberId: string,
  month: string,
  data: { settings: WorkSettings; weekendDays: number[]; sessions: WorkSession[]; leaves: LeaveSpan[]; now: string },
): MonthSummary {
  const { settings, weekendDays, now } = data;
  const today = localParts(now, settings.timeZone).date;
  const lateAfter = toMinutes(settings.dayStart) + settings.graceMinutes;
  const mine = data.sessions.filter((s) => s.memberId === memberId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const byDay = new Map<string, WorkSession[]>();
  for (const s of mine) {
    const day = localParts(s.startedAt, settings.timeZone).date;
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const onLeave = (date: string) => data.leaves.some((l) => l.memberId === memberId && l.startsOn <= date && l.endsOn >= date);

  const summary: MonthSummary = {
    days: [],
    expectedDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    leaveDays: 0,
    expectedMinutes: 0,
    workedMinutes: 0,
    balanceMinutes: 0,
    todayMinutes: 0,
    working: mine.some((s) => s.endedAt === null),
  };

  for (const date of monthDays(month)) {
    const sessions = byDay.get(date) ?? [];
    const minutes = sessions.reduce((sum, s) => sum + sessionMinutes(s, now), 0);
    const firstIn = sessions.length ? localParts(sessions[0].startedAt, settings.timeZone).time : null;
    const last = sessions.at(-1);
    const lastOut = last?.endedAt ? localParts(last.endedAt, settings.timeZone).time : null;
    const weekend = weekendDays.includes(weekday(date));
    const leave = !weekend && onLeave(date);
    const late = !weekend && !leave && firstIn !== null && toMinutes(firstIn) > lateAfter;

    let status: DayStatus;
    if (date > today) status = "future";
    else if (date === today) status = leave ? "leave" : weekend && !sessions.length ? "weekend" : "today";
    else if (weekend) status = "weekend";
    else if (leave) status = "leave";
    else if (!sessions.length) status = "absent";
    else status = late ? "late" : "worked";

    if (date === today) summary.todayMinutes = minutes;
    if (date < today) {
      summary.workedMinutes += minutes;
      if (!weekend && !leave) {
        summary.expectedDays++;
        if (sessions.length) summary.presentDays++;
        else summary.absentDays++;
        if (late) summary.lateDays++;
      }
    }
    if (leave && date <= today) summary.leaveDays++;

    summary.days.push({
      date,
      status,
      minutes,
      firstIn,
      lastOut,
      open: sessions.some((s) => s.endedAt === null),
      manual: sessions.some((s) => s.source === "manual"),
      sessions,
    });
  }
  summary.expectedMinutes = summary.expectedDays * dailyMinutes(settings);
  summary.balanceMinutes = summary.workedMinutes - summary.expectedMinutes;
  return summary;
}

/**
 * Why hours typed by hand cannot be saved, or null: the end must follow the start, it cannot start in the future,
 * and it cannot overlap the person's other hours. Returns the instants to store.
 */
export function checkManualEntry(
  input: { memberId: string; date: string; from: string; to: string },
  data: { settings: WorkSettings; sessions: Pick<WorkSession, "memberId" | "startedAt" | "endedAt">[]; now: string },
): { problem: "invalid" | "overlap"; startedAt?: undefined; endedAt?: undefined } | { problem: null; startedAt: string; endedAt: string } {
  if (toMinutes(input.to) <= toMinutes(input.from)) return { problem: "invalid" };
  const startedAt = zonedToUtc(input.date, input.from, data.settings.timeZone);
  const endedAt = zonedToUtc(input.date, input.to, data.settings.timeZone);
  if (startedAt > data.now) return { problem: "invalid" };
  const clash = data.sessions.some((s) => s.memberId === input.memberId && s.startedAt < endedAt && (s.endedAt ?? data.now) > startedAt);
  return clash ? { problem: "overlap" } : { problem: null, startedAt, endedAt };
}

/** "7:30" style hours and minutes (always Latin digits). Negative values keep their sign. */
export function formatMinutes(total: number) {
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(Math.round(total));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Normalises stored settings (missing fields get the defaults). */
export function readWorkSettings(row: Partial<WorkSettings> | null | undefined): WorkSettings {
  const d = DEFAULT_WORK_SETTINGS;
  return {
    dayStart: row?.dayStart ?? d.dayStart,
    dayEnd: row?.dayEnd ?? d.dayEnd,
    breakMinutes: row?.breakMinutes ?? d.breakMinutes,
    graceMinutes: row?.graceMinutes ?? d.graceMinutes,
    timeZone: row?.timeZone ?? d.timeZone,
  };
}
