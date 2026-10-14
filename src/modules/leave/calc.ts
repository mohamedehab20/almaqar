/**
 * Leave rules, shared by the server (which enforces them) and the screen (which previews them and runs the
 * public demo). Pure functions: no database, no clock unless given.
 *
 * - A request counts working days only: the company's weekend days are skipped (Friday and Saturday by default).
 * - Each type has a yearly allowance (company default, or a per-employee figure for that year). null = no limit.
 * - A request spanning two years counts its days in each year.
 * - Remaining = allowance − approved − pending, so two pending requests cannot both spend the same days.
 */

export const LEAVE_TYPES = ["annual", "casual", "sick", "unpaid"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** Yearly days per type; null = no limit (unpaid leave). Egyptian labour law defaults: 21 annual, 6 casual. */
export type Allowances = Record<LeaveType, number | null>;
export const DEFAULT_ALLOWANCES: Allowances = { annual: 21, casual: 6, sick: 15, unpaid: null };

/** 0 = Sunday … 6 = Saturday. */
export const DEFAULT_WEEKEND = [5, 6];

export type LeaveSettings = { allowances: Allowances; weekendDays: number[] };

export type LeaveRequest = {
  id: string;
  memberId: string;
  type: LeaveType;
  startsOn: string;
  endsOn: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

/** A per-employee allowance for one year and type (replaces the company default). */
export type AllowanceOverride = { memberId: string; year: number; type: LeaveType; allowance: number | null };

export type Balance = { allowance: number | null; used: number; pending: number; remaining: number | null };

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Working days from `from` to `to` (both included), skipping the weekend. 0 when `to` is before `from`. */
export function workingDays(from: string, to: string, weekendDays: number[] = DEFAULT_WEEKEND) {
  let count = 0;
  for (let t = utc(from), end = utc(to); t <= end; t += DAY) {
    if (!weekendDays.includes(new Date(t).getUTCDay())) count++;
  }
  return count;
}

/** The part of a request that falls inside `year`, in working days. */
export function daysInYear(request: Pick<LeaveRequest, "startsOn" | "endsOn">, year: number, weekendDays: number[]) {
  const from = request.startsOn > `${year}-01-01` ? request.startsOn : `${year}-01-01`;
  const to = request.endsOn < `${year}-12-31` ? request.endsOn : `${year}-12-31`;
  return from > to ? 0 : workingDays(from, to, weekendDays);
}

export function allowanceOf(memberId: string, type: LeaveType, year: number, settings: LeaveSettings, overrides: AllowanceOverride[]) {
  const own = overrides.find((o) => o.memberId === memberId && o.type === type && o.year === year);
  return own ? own.allowance : settings.allowances[type];
}

export function balanceOf(
  memberId: string,
  type: LeaveType,
  year: number,
  data: { settings: LeaveSettings; overrides: AllowanceOverride[]; requests: LeaveRequest[] },
  /** Leave one request out (when re-checking it at approval) */
  except?: string,
): Balance {
  const allowance = allowanceOf(memberId, type, year, data.settings, data.overrides);
  let used = 0;
  let pending = 0;
  for (const r of data.requests) {
    if (r.memberId !== memberId || r.type !== type || r.id === except) continue;
    if (r.status === "approved") used += daysInYear(r, year, data.settings.weekendDays);
    else if (r.status === "pending") pending += daysInYear(r, year, data.settings.weekendDays);
  }
  return { allowance, used, pending, remaining: allowance === null ? null : allowance - used - pending };
}

export type RequestProblem = "invalid" | "overlap" | "insufficient_balance";

/**
 * Why a new request (or one being approved, with `except` = its id) cannot go through, or null.
 * `requests` must hold the member's requests that touch the request's years.
 */
export function checkRequest(
  request: { memberId: string; type: LeaveType; startsOn: string; endsOn: string },
  data: { settings: LeaveSettings; overrides: AllowanceOverride[]; requests: LeaveRequest[] },
  except?: string,
): RequestProblem | null {
  if (request.endsOn < request.startsOn) return "invalid";
  if (workingDays(request.startsOn, request.endsOn, data.settings.weekendDays) === 0) return "invalid";
  const clash = data.requests.some(
    (r) =>
      r.id !== except &&
      r.memberId === request.memberId &&
      (r.status === "pending" || r.status === "approved") &&
      r.startsOn <= request.endsOn &&
      r.endsOn >= request.startsOn,
  );
  if (clash) return "overlap";
  for (let year = Number(request.startsOn.slice(0, 4)); year <= Number(request.endsOn.slice(0, 4)); year++) {
    const { remaining } = balanceOf(request.memberId, request.type, year, data, except);
    if (remaining !== null && daysInYear(request, year, data.settings.weekendDays) > remaining) return "insufficient_balance";
  }
  return null;
}

/** Approved leave that covers `day`, for "who is off today". */
export const offOn = (requests: LeaveRequest[], day: string) => requests.filter((r) => r.status === "approved" && r.startsOn <= day && r.endsOn >= day);

/** Normalises stored allowances (unknown keys dropped, missing types get the default). */
export function readAllowances(stored: Partial<Record<string, number | null>> | null | undefined): Allowances {
  const out = { ...DEFAULT_ALLOWANCES };
  for (const type of LEAVE_TYPES) {
    if (stored && type in stored) {
      const v = stored[type];
      out[type] = v === null || v === undefined ? null : Math.max(0, Number(v));
    }
  }
  return out;
}
