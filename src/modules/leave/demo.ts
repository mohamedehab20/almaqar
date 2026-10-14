/**
 * Sample leave for the public demo company: the demo team (hq/mock), seen by its owner. Dates are built
 * around `today` so the page always has someone off today, requests waiting, and past leave.
 */
import { currentUserId, departments, members } from "@/modules/hq/mock";
import type { LeaveData } from "./service";
import { DEFAULT_ALLOWANCES, DEFAULT_WEEKEND, isoDay, workingDays, type LeaveRequest, type LeaveStatus, type LeaveType } from "./calc";

const DAY = 86_400_000;

/** The working day `n` working days away from `from` (n = 0: `from` itself, or the next working day). */
function shift(from: string, n: number) {
  let t = Date.parse(`${from}T00:00:00Z`);
  const working = () => !DEFAULT_WEEKEND.includes(new Date(t).getUTCDay());
  while (!working()) t += DAY;
  for (let left = Math.abs(n); left > 0; ) {
    t += Math.sign(n) * DAY;
    if (working()) left--;
  }
  return isoDay(t);
}

type Sample = [memberId: string, type: LeaveType, startIn: number, days: number, status: LeaveStatus, reason: { ar: string; en: string } | null, note?: { ar: string; en: string }];

const samples: Sample[] = [
  ["m6", "annual", 5, 3, "pending", { ar: "سفر مع العيلة", en: "Family trip" }],
  ["m4", "casual", 2, 1, "pending", { ar: "ظرف عائلي طارئ", en: "Family emergency" }],
  ["m5", "sick", 1, 2, "pending", { ar: "عملية بسيطة ومحتاج يومين راحة", en: "Minor surgery, two days of rest" }],
  ["m3", "annual", -1, 3, "approved", { ar: "إجازة قصيرة", en: "Short break" }, { ar: "تمام، سلّم مهام التصميم لعلي", en: "Fine, hand the design tasks to Ali" }],
  ["m2", "annual", 20, 7, "approved", { ar: "إجازة الصيف", en: "Summer holiday" }],
  ["m7", "unpaid", 10, 10, "rejected", { ar: "سفر للخارج", en: "Travelling abroad" }, { ar: "ضغط شغل آخر الربع، نأجلها للشهر الجاي", en: "End-of-quarter rush, let's move it to next month" }],
  ["m5", "annual", -40, 5, "approved", { ar: "إجازة سنوية", en: "Annual leave" }],
  ["m3", "sick", -60, 2, "approved", { ar: "دور برد", en: "Flu" }],
  ["m2", "casual", -15, 1, "approved", null],
  ["m1", "annual", -90, 5, "approved", { ar: "إجازة العيد", en: "Eid holiday" }],
  ["m4", "annual", -25, 4, "approved", { ar: "فرح أخويا", en: "My brother's wedding" }],
  ["m6", "casual", -8, 1, "cancelled", { ar: "مشوار حكومي", en: "Government errand" }],
];

export function demoLeaveData(today = new Date().toISOString().slice(0, 10), locale: "ar" | "en" = "ar"): LeaveData {
  const year = Number(today.slice(0, 4));
  const requests: LeaveRequest[] = samples.map(([memberId, type, startIn, days, status, reason, note], i) => {
    const startsOn = shift(today, startIn);
    const endsOn = shift(startsOn, days - 1);
    const decided = status === "approved" || status === "rejected";
    return {
      id: `demo-leave-${i + 1}`,
      memberId,
      type,
      startsOn,
      endsOn,
      days: workingDays(startsOn, endsOn, DEFAULT_WEEKEND),
      reason: reason?.[locale] ?? null,
      status,
      decidedById: decided ? currentUserId : null,
      decidedAt: decided ? `${shift(startsOn, -3)}T10:00:00.000Z` : null,
      decisionNote: note?.[locale] ?? null,
      createdAt: `${shift(startsOn, -5)}T09:00:00.000Z`,
    };
  });
  return {
    today,
    year,
    meId: currentUserId,
    owner: true,
    canManage: true,
    canSettings: true,
    settings: { allowances: { ...DEFAULT_ALLOWANCES }, weekendDays: [...DEFAULT_WEEKEND] },
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
    names: Object.fromEntries(members.map((m) => [m.id, m.name])),
    departments,
    requests,
    // Nour has more annual days for seniority
    overrides: [{ memberId: "m2", year, type: "annual", allowance: 25 }],
  };
}
