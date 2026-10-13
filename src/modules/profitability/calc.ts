/**
 * Client profitability: how much each client really earns the agency per month, not just what it pays.
 * Pure functions (no database, no Next.js): the service feeds them real rows, the demo feeds sample rows,
 * and both run on the server. The UI only displays the result.
 *
 * Per client, per month:
 *   hours        = task time (timer, else the standard time of the task type) + revisions × minutes per revision + meetings
 *   team cost    = hours × internal hourly cost, where hourly cost = (salaries + rent + tools) ÷ monthly working hours
 *   profit       = income (invoices of that month) − (team cost + freelancer payments)
 *   margin %     = profit ÷ income × 100
 *   effective/h  = income ÷ hours
 *   package use  = delivered ÷ agreed in the contract × 100
 *   avg revisions per deliverable
 * Without income, hours or cost settings the month is "insufficient data", never a made-up number.
 */

type Localized = { ar: string; en: string };

export const TASK_TYPES = ["post", "reel", "carousel", "story", "video", "design", "other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
/** Task types that count as a delivered piece of content (package usage, revisions per post) */
export const DELIVERABLE_TYPES = new Set<string>(["post", "reel", "carousel", "story", "video", "design"]);
export const DEFAULT_STANDARD_MINUTES: Record<TaskType, number> = { post: 90, reel: 240, carousel: 120, story: 45, video: 360, design: 120, other: 60 };
export const DEFAULT_REVISION_MINUTES = 30;

/** Margin zones: green above 40 %, yellow 15–40 %, red below 15 % */
export const MARGIN_GREEN = 40;
export const MARGIN_RED = 15;
/** Meetings above this share of a client's hours count as "too many meetings" */
const MEETING_SHARE_LIMIT = 0.2;
/** Months of invoices behind a month's average payment delay */
const LATE_WINDOW_MONTHS = 6;

/** "YYYY-MM" */
export type Month = string;

export type ProfitSettings = {
  standardMinutes: Record<string, number>;
  revisionMinutes: number;
  monthlySalaries: number;
  monthlyRent: number;
  monthlyTools: number;
  monthlyHours: number;
};

export type ProfitInputs = {
  /** "YYYY-MM-DD", for unpaid invoices */
  today: string;
  /** Months to report, oldest first */
  months: Month[];
  settings: ProfitSettings | null;
  clients: { id: string; name: Localized; sector: Localized; packageDeliverables: number | null; packageRevisionsPerPost: number | null }[];
  /** Done tasks of clients; `completedOn` "YYYY-MM-DD" */
  tasks: { clientId: string; taskType: string | null; trackedMinutes: number | null; revisions: number; completedOn: string }[];
  meetings: { clientId: string; on: string; minutes: number }[];
  invoices: { clientId: string; period: Month; amount: number; dueOn: string; paidOn: string | null }[];
  freelancers: { clientId: string; paidOn: string; amount: number }[];
};

export type Zone = "green" | "yellow" | "red" | "insufficient";
export type AlertKind = "package" | "margin" | "revisions";
export type Cause = "revisions" | "scope" | "meetings" | "price";

export type Recommendation = {
  cause: Cause;
  /** Red for this month and the two before it: suggest ending the engagement */
  chronic: boolean;
  /** Numbers behind the advice (EGP, hours, counts) */
  extraRevisions: number;
  extraRevisionHours: number;
  extraRevisionCost: number;
  delivered: number;
  agreed: number | null;
  /** Monthly fee that would pay for what is delivered today at the same price per piece */
  upgradeFee: number | null;
  meetingHours: number;
  meetingShare: number;
  cost: number;
  /** Fee that would give a 40 % margin at today's cost */
  targetFee: number;
  targetIncreasePct: number | null;
};

export type ClientMonth = {
  month: Month;
  sufficient: boolean;
  /** What is missing when not sufficient */
  missing: ("settings" | "income" | "hours")[];
  income: number;
  hours: { tasks: number; revisions: number; meetings: number; total: number };
  /** Done tasks with neither a timer nor a standard time for their type (not in the hours) */
  untimedTasks: number;
  teamCost: number;
  freelancers: number;
  profit: number | null;
  margin: number | null;
  effectiveHourly: number | null;
  delivered: number;
  agreed: number | null;
  usage: number | null;
  revisions: number;
  avgRevisions: number | null;
  allowedRevisions: number | null;
  /** Average days invoices were paid late (unpaid: counted until today), over the last 6 months */
  latePaymentDays: number | null;
  zone: Zone;
  alerts: AlertKind[];
  recommendation: Recommendation | null;
};

export type ClientReport = { id: string; name: Localized; sector: Localized; months: Record<Month, ClientMonth> };
export type SectorAverage = { sector: Localized; clients: number; margin: number; effectiveHourly: number; income: number };

export type ProfitReport = {
  months: Month[];
  /** null while the cost settings are missing */
  hourlyCost: number | null;
  clients: ClientReport[];
  /** Average of clients with enough data, per sector and month (pricing new clients) */
  sectors: Record<Month, SectorAverage[]>;
};

// ---------- helpers ----------

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const monthOf = (day: string): Month => day.slice(0, 7);
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const lastDay = (month: Month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** Months back from `end` ("YYYY-MM"), oldest first. */
export function monthRange(end: Month, count: number): Month[] {
  const [y, m] = end.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export function hourlyCostOf(settings: ProfitSettings | null) {
  if (!settings || settings.monthlyHours <= 0) return null;
  const cost = (settings.monthlySalaries + settings.monthlyRent + settings.monthlyTools) / settings.monthlyHours;
  return cost > 0 ? round(cost) : null;
}

export function zoneOf(margin: number | null): Zone {
  if (margin === null) return "insufficient";
  return margin > MARGIN_GREEN ? "green" : margin >= MARGIN_RED ? "yellow" : "red";
}

// ---------- the report ----------

export function computeProfitability(input: ProfitInputs): ProfitReport {
  const hourlyCost = hourlyCostOf(input.settings);
  const standard = input.settings?.standardMinutes ?? {};
  const revisionMinutes = input.settings?.revisionMinutes ?? DEFAULT_REVISION_MINUTES;

  const clients: ClientReport[] = input.clients.map((client) => {
    const months: Record<Month, ClientMonth> = {};
    for (const month of input.months) {
      const tasks = input.tasks.filter((t) => t.clientId === client.id && monthOf(t.completedOn) === month);
      let taskMinutes = 0;
      let untimedTasks = 0;
      let revisions = 0;
      let delivered = 0;
      for (const task of tasks) {
        // A timer, when present, wins over the standard time
        const minutes = task.trackedMinutes ?? (task.taskType ? standard[task.taskType] : undefined);
        if (minutes === undefined || minutes === null) untimedTasks++;
        else taskMinutes += minutes;
        revisions += task.revisions;
        if (task.taskType && DELIVERABLE_TYPES.has(task.taskType)) delivered++;
      }
      const meetingMinutes = input.meetings.filter((m) => m.clientId === client.id && monthOf(m.on) === month).reduce((s, m) => s + m.minutes, 0);
      const hours = {
        tasks: round(taskMinutes / 60),
        revisions: round((revisions * revisionMinutes) / 60),
        meetings: round(meetingMinutes / 60),
        total: 0,
      };
      hours.total = round(hours.tasks + hours.revisions + hours.meetings);

      const income = round(input.invoices.filter((i) => i.clientId === client.id && i.period === month).reduce((s, i) => s + i.amount, 0));
      const freelancers = round(input.freelancers.filter((f) => f.clientId === client.id && monthOf(f.paidOn) === month).reduce((s, f) => s + f.amount, 0));

      const missing: ClientMonth["missing"] = [];
      if (hourlyCost === null) missing.push("settings");
      if (income <= 0) missing.push("income");
      if (hours.total <= 0) missing.push("hours");
      const sufficient = missing.length === 0;

      const teamCost = hourlyCost === null ? 0 : round(hours.total * hourlyCost);
      const profit = sufficient ? round(income - (teamCost + freelancers)) : null;
      const margin = sufficient ? round(((income - (teamCost + freelancers)) / income) * 100, 1) : null;
      const effectiveHourly = income > 0 && hours.total > 0 ? round(income / hours.total) : null;
      const agreed = client.packageDeliverables && client.packageDeliverables > 0 ? client.packageDeliverables : null;
      const usage = agreed ? round((delivered / agreed) * 100, 1) : null;
      const avgRevisions = delivered > 0 ? round(revisions / delivered, 1) : null;
      const allowedRevisions = client.packageRevisionsPerPost ?? null;

      // Payment delays: invoices of the last 6 months that were due by the end of this month
      const asOf = input.today < lastDay(month) ? input.today : lastDay(month);
      const window = new Set(monthRange(month, LATE_WINDOW_MONTHS));
      const due = input.invoices.filter((i) => i.clientId === client.id && window.has(i.period) && i.dueOn <= asOf);
      const latePaymentDays = due.length
        ? round(due.reduce((s, i) => s + Math.max(0, days(i.dueOn, i.paidOn && i.paidOn <= asOf ? i.paidOn : asOf)), 0) / due.length, 1)
        : null;

      const zone = zoneOf(margin);
      const alerts: AlertKind[] = [];
      if (usage !== null && usage > 100) alerts.push("package");
      if (margin !== null && margin < MARGIN_RED) alerts.push("margin");
      if (avgRevisions !== null && allowedRevisions !== null && avgRevisions > allowedRevisions) alerts.push("revisions");

      months[month] = {
        month,
        sufficient,
        missing,
        income,
        hours,
        untimedTasks,
        teamCost,
        freelancers,
        profit,
        margin,
        effectiveHourly,
        delivered,
        agreed,
        usage,
        revisions,
        avgRevisions,
        allowedRevisions,
        latePaymentDays,
        zone,
        alerts,
        recommendation: null,
      };
    }

    // Recommendations need the previous months (chronic = red three months in a row)
    input.months.forEach((month, index) => {
      const row = months[month];
      if (row.zone !== "red") return;
      const previous = input.months.slice(Math.max(0, index - 2), index).map((m) => months[m]);
      const chronic = previous.length === 2 && previous.every((p) => p.zone === "red");
      row.recommendation = recommend(row, revisionMinutes, hourlyCost ?? 0, chronic);
    });

    return { id: client.id, name: client.name, sector: client.sector, months };
  });

  const sectors: Record<Month, SectorAverage[]> = {};
  for (const month of input.months) {
    const groups = new Map<string, { sector: Localized; rows: ClientMonth[] }>();
    for (const c of clients) {
      const row = c.months[month];
      if (!row.sufficient) continue;
      const key = c.sector.ar || c.sector.en;
      const group = groups.get(key) ?? { sector: c.sector, rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    }
    sectors[month] = [...groups.values()]
      .map(({ sector, rows }) => ({
        sector,
        clients: rows.length,
        margin: round(rows.reduce((s, r) => s + (r.margin ?? 0), 0) / rows.length, 1),
        effectiveHourly: round(rows.reduce((s, r) => s + (r.effectiveHourly ?? 0), 0) / rows.length),
        income: round(rows.reduce((s, r) => s + r.income, 0) / rows.length),
      }))
      .sort((a, b) => b.margin - a.margin);
  }

  return { months: input.months, hourlyCost, clients, sectors };
}

/** The main reason a red client loses money: the biggest source of hours above what the contract covers. */
function recommend(row: ClientMonth, revisionMinutes: number, hourlyCost: number, chronic: boolean): Recommendation {
  const allowedTotal = row.allowedRevisions !== null ? row.allowedRevisions * row.delivered : null;
  const extraRevisions = allowedTotal !== null ? Math.max(0, row.revisions - allowedTotal) : 0;
  const extraRevisionHours = round((extraRevisions * revisionMinutes) / 60);
  const scopeHours = row.agreed && row.delivered > row.agreed ? round((row.hours.tasks * (row.delivered - row.agreed)) / row.delivered) : 0;
  const meetingExcess = Math.max(0, row.hours.meetings - MEETING_SHARE_LIMIT * row.hours.total);

  const candidates: [Cause, number][] = [
    ["revisions", extraRevisionHours],
    ["scope", scopeHours],
    ["meetings", meetingExcess],
  ];
  const [top] = candidates.sort((a, b) => b[1] - a[1]);
  const cause: Cause = top[1] > 0 ? top[0] : "price";

  const cost = round(row.teamCost + row.freelancers);
  const targetFee = round(cost / (1 - MARGIN_GREEN / 100));
  return {
    cause,
    chronic,
    extraRevisions,
    extraRevisionHours,
    extraRevisionCost: round(extraRevisionHours * hourlyCost),
    delivered: row.delivered,
    agreed: row.agreed,
    upgradeFee: row.agreed ? round((row.income / row.agreed) * row.delivered) : null,
    meetingHours: row.hours.meetings,
    meetingShare: row.hours.total > 0 ? round((row.hours.meetings / row.hours.total) * 100, 1) : 0,
    cost,
    targetFee,
    targetIncreasePct: row.income > 0 ? round(((targetFee - row.income) / row.income) * 100, 1) : null,
  };
}
