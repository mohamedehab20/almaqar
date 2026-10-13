/**
 * Sample inputs for the five demo clients (Marketing → Clients in sections-mock.ts), covering every case:
 * - c1 Morning Bakery: healthy (green), timer on one reel.
 * - c2 Nour Clinics: delivered 18 of 12 this month (150 %), margin down to ~6 % → package + margin alerts, "scope" advice.
 * - c3 Al Masar Academy: ~4 revisions per post where 2 are allowed, red for six months → revisions advice + "consider ending".
 * - c4 Decor House: too many meetings this month, invoices paid ~25 days late → "meetings" advice.
 * - c5 Mishwar App: underpriced two months ago ("price" advice), paused since → "insufficient data".
 * The report is computed from these on the server, with the same code as real data.
 */
import { clients as demoClients } from "@/modules/marketing/sections-mock";
import { DEFAULT_REVISION_MINUTES, DEFAULT_STANDARD_MINUTES, monthRange, type ProfitInputs } from "./calc";

const pad = (n: number) => String(n).padStart(2, "0");
const day = (month: string, d: number) => `${month}-${pad(d)}`;
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86_400_000).toISOString().slice(0, 10);

export const DEMO_SETTINGS = {
  standardMinutes: { ...DEFAULT_STANDARD_MINUTES },
  revisionMinutes: DEFAULT_REVISION_MINUTES,
  monthlySalaries: 180_000,
  monthlyRent: 25_000,
  monthlyTools: 15_000,
  /** 5 people × 176 h → 250 EGP per hour */
  monthlyHours: 880,
};

const PACKAGES: Record<string, { deliverables: number; revisionsPerPost: number }> = {
  c1: { deliverables: 14, revisionsPerPost: 2 },
  c2: { deliverables: 12, revisionsPerPost: 2 },
  c3: { deliverables: 16, revisionsPerPost: 2 },
  c4: { deliverables: 8, revisionsPerPost: 2 },
  c5: { deliverables: 20, revisionsPerPost: 3 },
};

type Plan = {
  work?: [type: string, count: number, revisionsEach: number][];
  timer?: [type: string, minutes: number];
  meetings?: [count: number, minutes: number];
  fee?: number;
  freelancers?: number;
  /** Days after the due date the invoice was paid; null = still unpaid */
  paidLate?: number | null;
};

/** What happened for one client in month `i` (0 = oldest of six, 5 = this month). */
function plan(clientId: string, i: number, current: boolean): Plan {
  switch (clientId) {
    case "c1":
      return { work: [["post", 12, 0.5], ["reel", 2, 0.5]], timer: ["reel", 300], meetings: [2, 60], fee: 30_000, freelancers: 2_000 - i * 100, paidLate: 0 };
    case "c2":
      if (current) return { work: [["post", 12, 1], ["reel", 4, 1], ["carousel", 2, 1]], meetings: [3, 60], fee: 25_000, freelancers: 11_000, paidLate: null };
      return { work: [["post", 10 + (i > 3 ? 2 : 0), 1], ["reel", 2 + (i > 3 ? 1 : 0), 1]], meetings: [3, 60], fee: 25_000, freelancers: 6_000, paidLate: 5 };
    case "c3":
      return { work: [["post", 10, 4], ["reel", 4, 4], ["carousel", 2, 4]], meetings: [4, 60], fee: 32_000, freelancers: 11_000 + (i % 2) * 300, paidLate: 10 };
    case "c4":
      return { work: [["post", 8, 1]], meetings: current ? [12, 90] : [5, 90], fee: 9_000, freelancers: 0, paidLate: current ? null : 25 };
    case "c5":
      if (i <= 3) return { work: [["post", 20, 0]], timer: ["post", 150], meetings: [2, 60], fee: 20_000, freelancers: 5_000, paidLate: 40 };
      return { work: [["post", 1, 0]] };
    default:
      return {};
  }
}

export function demoProfitInputs(today = new Date().toISOString().slice(0, 10)): ProfitInputs {
  const months = monthRange(today.slice(0, 7), 6);
  const input: ProfitInputs = {
    today,
    months,
    settings: DEMO_SETTINGS,
    clients: demoClients.map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.industry,
      packageDeliverables: PACKAGES[c.id]?.deliverables ?? null,
      packageRevisionsPerPost: PACKAGES[c.id]?.revisionsPerPost ?? null,
    })),
    tasks: [],
    meetings: [],
    invoices: [],
    freelancers: [],
  };

  for (const client of demoClients) {
    months.forEach((month, i) => {
      const p = plan(client.id, i, i === months.length - 1);
      for (const [type, count, revisionsEach] of p.work ?? []) {
        // Spread fractional revisions (e.g. 0.5 each) over the tasks
        let owed = 0;
        for (let n = 0; n < count; n++) {
          owed += revisionsEach;
          const revisions = Math.floor(owed);
          owed -= revisions;
          const timed = p.timer && p.timer[0] === type && (type !== "reel" || n === 0);
          input.tasks.push({ clientId: client.id, taskType: type, trackedMinutes: timed ? p.timer![1] : null, revisions, completedOn: day(month, 2 + (n % 25)) });
        }
      }
      const [count, minutes] = p.meetings ?? [0, 0];
      for (let n = 0; n < count; n++) input.meetings.push({ clientId: client.id, on: day(month, 3 + n * 2), minutes });
      if (p.fee) {
        const dueOn = day(month, 15);
        const paidOn = p.paidLate === null || p.paidLate === undefined ? null : addDays(dueOn, p.paidLate);
        input.invoices.push({ clientId: client.id, period: month, amount: p.fee, dueOn, paidOn: paidOn && paidOn <= today ? paidOn : null });
      }
      if (p.freelancers) input.freelancers.push({ clientId: client.id, paidOn: day(month, 20), amount: p.freelancers });
    });
  }
  return input;
}
