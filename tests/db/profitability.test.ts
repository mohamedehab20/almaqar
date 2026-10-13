/** Client profitability: the formulas (pure), and the service end to end on Postgres with RLS. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as hq from "../../src/modules/hq/service";
import * as marketing from "../../src/modules/marketing/service";
import * as operations from "../../src/modules/operations/service";
import * as permissions from "../../src/modules/permissions/service";
import * as profit from "../../src/modules/profitability/service";
import { computeProfitability, monthRange, zoneOf, type ProfitInputs } from "../../src/modules/profitability/calc";
import { demoProfitInputs } from "../../src/modules/profitability/demo";
import { createTestDb, L, user } from "./setup";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

// ---------- Formulas ----------

const settings = { standardMinutes: { post: 90, reel: 240 }, revisionMinutes: 30, monthlySalaries: 80_000, monthlyRent: 15_000, monthlyTools: 5_000, monthlyHours: 400 };
const base = (over: Partial<ProfitInputs> = {}): ProfitInputs => ({
  today: "2026-10-31",
  months: ["2026-10"],
  settings,
  clients: [{ id: "a", name: L("A"), sector: L("Food"), packageDeliverables: 4, packageRevisionsPerPost: 1 }],
  tasks: [
    { clientId: "a", taskType: "post", trackedMinutes: null, revisions: 2, completedOn: "2026-10-03" },
    { clientId: "a", taskType: "post", trackedMinutes: null, revisions: 0, completedOn: "2026-10-04" },
    // The timer wins over the reel's standard 240 minutes
    { clientId: "a", taskType: "reel", trackedMinutes: 180, revisions: 2, completedOn: "2026-10-05" },
    // Other months and other clients are ignored
    { clientId: "a", taskType: "post", trackedMinutes: null, revisions: 5, completedOn: "2026-09-30" },
    { clientId: "b", taskType: "post", trackedMinutes: null, revisions: 5, completedOn: "2026-10-05" },
  ],
  meetings: [{ clientId: "a", on: "2026-10-10", minutes: 60 }],
  invoices: [{ clientId: "a", period: "2026-10", amount: 10_000, dueOn: "2026-10-15", paidOn: "2026-10-25" }],
  freelancers: [{ clientId: "a", paidOn: "2026-10-12", amount: 1_000 }],
  ...over,
});

test("formulas: hours, cost, profit, margin, hourly yield, package use, revisions, late days", () => {
  const r = computeProfitability(base());
  assert.equal(r.hourlyCost, 250, "(80k + 15k + 5k) ÷ 400 h");
  const m = r.clients[0].months["2026-10"];
  // tasks 90 + 90 + 180 = 6 h; revisions 4 × 30 min = 2 h; meetings 1 h
  assert.deepEqual(m.hours, { tasks: 6, revisions: 2, meetings: 1, total: 9 });
  assert.equal(m.teamCost, 2250);
  assert.equal(m.freelancers, 1000);
  assert.equal(m.profit, 6750, "10000 − (2250 + 1000)");
  assert.equal(m.margin, 67.5);
  assert.equal(m.effectiveHourly, 1111.11, "10000 ÷ 9 h");
  assert.deepEqual([m.delivered, m.agreed, m.usage], [3, 4, 75]);
  assert.equal(m.avgRevisions, 1.3, "4 revisions ÷ 3 posts");
  assert.equal(m.latePaymentDays, 10);
  assert.equal(m.zone, "green");
  assert.deepEqual(m.alerts, ["revisions"], "1.3 per post is above the 1 allowed");
  assert.equal(m.recommendation, null, "advice only for red clients");
});

test("zones and insufficient data", () => {
  assert.deepEqual([zoneOf(40.1), zoneOf(40), zoneOf(15), zoneOf(14.9), zoneOf(null)], ["green", "yellow", "yellow", "red", "insufficient"]);
  const noIncome = computeProfitability(base({ invoices: [] })).clients[0].months["2026-10"];
  assert.deepEqual([noIncome.sufficient, noIncome.margin, noIncome.profit, noIncome.zone, noIncome.missing], [false, null, null, "insufficient", ["income"]]);
  const noSettings = computeProfitability(base({ settings: null }));
  assert.equal(noSettings.hourlyCost, null);
  assert.deepEqual(noSettings.clients[0].months["2026-10"].missing, ["settings"]);
  const noWork = computeProfitability(base({ tasks: [], meetings: [] })).clients[0].months["2026-10"];
  assert.deepEqual(noWork.missing, ["hours"]);
  // A task with no timer and no standard time for its type is reported, not guessed
  const untimed = computeProfitability(base({ tasks: [{ clientId: "a", taskType: "podcast", trackedMinutes: null, revisions: 0, completedOn: "2026-10-03" }] })).clients[0].months["2026-10"];
  assert.equal(untimed.untimedTasks, 1);
});

test("alerts and the main cause behind a red client", () => {
  const months = monthRange("2026-10", 3);
  assert.deepEqual(months, ["2026-08", "2026-09", "2026-10"]);
  const cause = (over: Partial<ProfitInputs>) => computeProfitability(base(over)).clients[0].months["2026-10"];

  // Too many revisions: 10 posts with 3 each, 1 allowed → 20 extra revisions = 10 h
  const revisions = cause({
    tasks: Array.from({ length: 10 }, (_, n) => ({ clientId: "a", taskType: "post", trackedMinutes: null, revisions: 3, completedOn: `2026-10-${String(n + 1).padStart(2, "0")}` })),
    clients: [{ id: "a", name: L("A"), sector: L("Food"), packageDeliverables: 10, packageRevisionsPerPost: 1 }],
  });
  assert.equal(revisions.zone, "red");
  assert.equal(revisions.recommendation?.cause, "revisions");
  assert.deepEqual([revisions.recommendation?.extraRevisions, revisions.recommendation?.extraRevisionHours, revisions.recommendation?.extraRevisionCost], [20, 10, 2500]);

  // More than the package: 12 delivered of 4
  const scope = cause({ tasks: Array.from({ length: 12 }, () => ({ clientId: "a", taskType: "reel", trackedMinutes: null, revisions: 0, completedOn: "2026-10-03" })) });
  assert.deepEqual(scope.alerts, ["package", "margin"]);
  assert.equal(scope.recommendation?.cause, "scope");
  assert.equal(scope.recommendation?.upgradeFee, 30_000, "same price per piece for 12 instead of 4");

  // Meetings take most of the time
  const meetings = cause({ meetings: Array.from({ length: 30 }, () => ({ clientId: "a", on: "2026-10-10", minutes: 60 })) });
  assert.equal(meetings.recommendation?.cause, "meetings");

  // Nothing above the contract, just a low fee → raise the price, with the numbers
  const price = cause({ invoices: [{ clientId: "a", period: "2026-10", amount: 3_000, dueOn: "2026-10-15", paidOn: null }], tasks: base().tasks.map((t) => ({ ...t, revisions: 0 })) });
  assert.equal(price.zone, "red");
  assert.equal(price.recommendation?.cause, "price");
  assert.equal(price.recommendation?.targetFee, Math.round(((price.teamCost + price.freelancers) / 0.6) * 100) / 100, "fee for a 40 % margin");
  assert.equal(price.latePaymentDays, 16, "unpaid: counted until today");

  // Red three months in a row
  const chronic = computeProfitability({ ...base(), months, invoices: months.map((m) => ({ clientId: "a", period: m, amount: 1_000, dueOn: `${m}-15`, paidOn: `${m}-15` })), tasks: months.map((m) => ({ clientId: "a", taskType: "post", trackedMinutes: null, revisions: 0, completedOn: `${m}-05` })), freelancers: months.map((m) => ({ clientId: "a", paidOn: `${m}-12`, amount: 1_000 })) });
  assert.deepEqual(months.map((m) => chronic.clients[0].months[m].recommendation?.chronic), [false, false, true]);
});

test("demo data: five clients, five situations", () => {
  const r = computeProfitability(demoProfitInputs("2026-10-13"));
  const now = (id: string) => r.clients.find((c) => c.id === id)!.months["2026-10"];
  assert.equal(now("c1").zone, "green");
  assert.equal(now("c2").usage, 150);
  assert.deepEqual(now("c2").alerts, ["package", "margin"]);
  assert.equal(now("c3").recommendation?.cause, "revisions");
  assert.equal(now("c3").recommendation?.chronic, true);
  assert.equal(now("c4").recommendation?.cause, "meetings");
  assert.equal(now("c5").zone, "insufficient");
  assert.equal(r.clients.find((c) => c.id === "c5")!.months["2026-07"].recommendation?.cause, "price");
});

// ---------- Service + database ----------

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@profit.test");
const admin = user("admin@profit.test");
const staff = user("staff@profit.test");
let companyId = "";
const month = new Date().toISOString().slice(0, 7);

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('profit', 'PROF1', ${JSON.stringify(L("Agency"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
  const adminRole = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).roles.find((r) => r.systemKey === "admin")!.id;
  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: admin.email!, name: L("Admin"), roleId: adminRole }));
  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: staff.email!, name: L("Staff") }));
  for (const who of [admin, staff]) await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
});

test("only the owner and admins see profitability; only the owner sets the costs", async () => {
  await failsWith("forbidden", t.as(staff, (ctx) => profit.getProfitabilityReport(ctx, companyId)));
  const empty = await t.as(admin, (ctx) => profit.getProfitabilityReport(ctx, companyId));
  assert.equal(empty.hourlyCost, null, "no settings yet → insufficient data");
  await failsWith("forbidden", t.as(admin, (ctx) => profit.saveProfitabilitySettings(ctx, { companyId, ...settings })));
  await t.as(owner, (ctx) => profit.saveProfitabilitySettings(ctx, { companyId, ...settings, standardMinutes: { ...settings.standardMinutes, bogus: 5 } }));
  const saved = await t.as(admin, (ctx) => profit.getProfitabilitySettings(ctx, companyId));
  assert.equal(saved.saved, true);
  assert.equal(saved.standardMinutes.bogus, undefined, "unknown task types are dropped");
  // Money tables are closed to the rest of the team, also with raw SQL
  assert.equal((await t.sqlAs(staff.sub, "SELECT id FROM invoices")).length, 0);
  await assert.rejects(t.sqlAs(staff.sub, "INSERT INTO profitability_settings (company_id) VALUES ($1) ON CONFLICT (company_id) DO UPDATE SET monthly_rent = 0", [companyId]));
});

test("the report adds up tasks, approval-portal revisions, meetings, invoices and freelancers", async () => {
  const client = await t.as(owner, (ctx) => marketing.createClient(ctx, { companyId, name: L("Bakery"), industry: L("Food") }));
  await t.as(owner, (ctx) => profit.setClientPackage(ctx, { clientId: client.id, deliverables: 4, revisionsPerPost: 1 }));

  const post = await t.as(staff, (ctx) => operations.createTask(ctx, { companyId, title: "Post 1", clientId: client.id, taskType: "post" }));
  const reel = await t.as(staff, (ctx) => operations.createTask(ctx, { companyId, title: "Reel", clientId: client.id, taskType: "reel", trackedMinutes: 180 }));
  // The client asks for changes twice in the approval portal (delivery → changes), once per round
  const idea = await t.as(staff, (ctx) => marketing.createIdea(ctx, { companyId, title: L("Reel idea"), clientId: client.id }));
  await t.as(staff, (ctx) => marketing.updateIdea(ctx, { ideaId: idea.id, taskId: reel.id, delivery: { status: "awaiting", sentOn: `${month}-02` } }));
  for (const status of ["changes", "changes", "awaiting", "changes"] as const) {
    await t.as(staff, (ctx) => marketing.updateIdea(ctx, { ideaId: idea.id, delivery: { status, sentOn: `${month}-03` } }));
  }
  for (const task of [post, reel]) await t.as(staff, (ctx) => operations.updateTask(ctx, { taskId: task.id, status: "done" }));

  await t.as(staff, (ctx) => profit.createMeeting(ctx, { companyId, clientId: client.id, title: "Kick-off", startsAt: `${month}-05T10:00:00Z`, durationMinutes: 60 }));
  // A cancelled visit in the schedule does not count
  const visit = await t.as(staff, (ctx) => operations.createScheduleItem(ctx, { companyId, kind: "trip", clientId: client.id, title: "Visit", startsAt: `${month}-06T10:00:00Z`, durationMinutes: 120 }));
  await t.as(staff, (ctx) => operations.updateScheduleItem(ctx, { itemId: visit.id, status: "cancelled" }));
  await failsWith("forbidden", t.as(staff, (ctx) => profit.createInvoice(ctx, { clientId: client.id, period: month, amount: 5000, issuedOn: `${month}-01`, dueOn: `${month}-15` })));
  await t.as(admin, (ctx) => profit.createInvoice(ctx, { clientId: client.id, period: month, amount: 5000, issuedOn: `${month}-01`, dueOn: `${month}-15` }));
  await t.as(admin, (ctx) => profit.createFreelancerPayment(ctx, { clientId: client.id, taskId: reel.id, freelancer: "Editor", amount: 500, paidOn: `${month}-06` }));
  await failsWith("invalid", t.as(admin, (ctx) => profit.createInvoice(ctx, { clientId: client.id, period: month, amount: 1, issuedOn: `${month}-10`, dueOn: `${month}-01` })));

  const report = await t.as(owner, (ctx) => profit.getProfitabilityReport(ctx, companyId));
  const row = report.clients.find((c) => c.id === client.id)!.months[month];
  // Two change rounds: a second "changes" in a row is the same round. Hours: post 90 + reel timer 180 = 4.5 h, 2 × 30 min = 1 h, meeting 1 h
  assert.equal(row.revisions, 2, "two change rounds from the portal");
  assert.deepEqual(row.hours, { tasks: 4.5, revisions: 1, meetings: 1, total: 6.5 });
  assert.equal(row.teamCost, 1625);
  assert.equal(row.profit, 5000 - (1625 + 500));
  assert.equal(row.margin, 57.5);
  assert.deepEqual([row.delivered, row.agreed, row.usage, row.avgRevisions], [2, 4, 50, 1]);
});
