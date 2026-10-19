/** Analytics room (development-almaqar/10-analytics-srs.md, 15-security-qa.md): the formulas and who sees what. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as analytics from "../../src/modules/analytics/service";
import { computeAnalytics, expectedMinutes, runWaiting, type AnalyticsInput, type TaskInput } from "../../src/modules/analytics/calc";
import { demoAnalyticsData } from "../../src/modules/analytics/demo";
import * as hq from "../../src/modules/hq/service";
import * as permissions from "../../src/modules/permissions/service";
import { createTestDb, L, user } from "./setup";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

// ---------- Formulas (reference values worked out by hand) ----------

const done = (id: string, assigneeId: string, dueDate: string, completedOn: string): TaskInput => ({
  id,
  assigneeId,
  status: "done",
  dueDate,
  createdAt: "2026-09-28T09:00:00Z",
  completedAt: `${completedOn}T12:00:00Z`,
});

const base = (): AnalyticsInput => ({
  month: "2026-10",
  today: "2026-10-19",
  dayOf: (iso) => iso.slice(0, 10),
  dailyMinutes: 420,
  weekendDays: [5, 6],
  departments: [
    { id: "A", name: L("A"), color: "blue" },
    { id: "B", name: L("B"), color: "amber" },
  ],
  members: [
    { id: "a1", name: L("a1"), title: null, departmentId: "A" },
    { id: "a2", name: L("a2"), title: null, departmentId: "A" },
    { id: "b1", name: L("b1"), title: null, departmentId: "B" },
  ],
  tasks: [
    // A: six due and done (five on time, one two days late), one open and overdue since the 10th
    done("t1", "a1", "2026-10-02", "2026-10-01"),
    done("t2", "a1", "2026-10-05", "2026-10-05"),
    done("t3", "a1", "2026-10-07", "2026-10-06"),
    done("t4", "a2", "2026-10-08", "2026-10-08"),
    done("t5", "a2", "2026-10-12", "2026-10-11"),
    done("t6", "a2", "2026-10-13", "2026-10-15"),
    { id: "t7", assigneeId: "a2", status: "in_progress", dueDate: "2026-10-10", createdAt: "2026-10-01T09:00:00Z", completedAt: null },
    // due later this month: not due yet, not counted in delivery
    { id: "t8", assigneeId: "a1", status: "todo", dueDate: "2026-10-28", createdAt: "2026-10-15T09:00:00Z", completedAt: null },
    // B: two done (too few for a ratio)
    done("t9", "b1", "2026-10-06", "2026-10-06"),
    done("t10", "b1", "2026-10-09", "2026-10-09"),
    // nobody responsible
    { id: "t11", assigneeId: null, status: "todo", dueDate: null, createdAt: "2026-10-03T09:00:00Z", completedAt: null },
  ],
  minutes: { a1: 4620, a2: 2000, b1: 5460 },
  leaves: [{ memberId: "a1", startsOn: "2026-10-04", endsOn: "2026-10-05" }],
  approvals: [{ approverId: "a1", createdAt: "2026-10-14T08:00:00Z", dueOn: null }],
  runs: [{ id: "r1", code: "OP-1", waitingOnId: "b1", since: "2026-10-12T08:00:00Z" }],
  visible: new Set(["A", "B", "*"]),
  people: new Set(["A"]),
});

test("formulas: delivery, timeliness, overdue, expected hours after leave, small samples", () => {
  // 1–19 Oct 2026 with Friday/Saturday off = 13 working days; a1 took 2 of them off
  assert.equal(expectedMinutes("a1", base()), 11 * 420);
  assert.equal(expectedMinutes("a2", base()), 13 * 420);

  const r = computeAnalytics(base());
  const a = r.departments.find((d) => d.id === "A")!;
  assert.deepEqual([a.delivery.part, a.delivery.sample], [6, 7]);
  assert.deepEqual([a.timeliness.part, a.timeliness.sample, a.timeliness.insufficient], [5, 6, false]);
  assert.deepEqual(a.overdue, { count: 1, oldestDays: 9 });
  assert.equal(a.open, 2);
  assert.equal(a.openPerMember, 1);
  assert.equal(a.capacity.expectedMinutes, 24 * 420);
  assert.equal(a.capacity.loggedMinutes, 6620);
  assert.equal(a.status, "on_target"); // 6/7 ≈ 86% and 5/6 ≈ 83%
  assert.equal(a.people?.length, 2);
  assert.equal(a.waitingApprovals.count, 1);

  const b = r.departments.find((d) => d.id === "B")!;
  assert.ok(b.timeliness.insufficient && b.delivery.insufficient);
  assert.equal(b.status, "unknown");
  assert.equal(b.people, undefined, "no people without analytics.members for B");
  assert.equal(b.stuckRuns.count, 1, "waiting 7 days at b1");

  assert.ok(r.bottlenecks.some((x) => x.kind === "approvals" && x.memberId === "a1" && x.days === 5));
  assert.ok(r.bottlenecks.some((x) => x.kind === "stuck" && x.departmentId === "B"));
  assert.ok(r.bottlenecks.some((x) => x.kind === "unowned" && x.count === 1));
  assert.deepEqual([r.summary.onTarget, r.summary.known, r.summary.overdue], [1, 1, 1]);
});

test("formulas: departments outside the scope never appear; unowned work only for the whole company", () => {
  const r = computeAnalytics({ ...base(), visible: new Set(["A"]), people: new Set() });
  assert.deepEqual(r.departments.map((d) => d.id), ["A"]);
  assert.equal(r.departments[0].people, undefined);
  assert.ok(!r.bottlenecks.some((x) => x.kind === "unowned" || ("departmentId" in x && x.departmentId === "B")));
  // without people, waiting approvals are reported per department, never per person
  assert.ok(r.bottlenecks.some((x) => x.kind === "approvals" && !x.memberId));
});

test("runs wait on the current step's assignee, or on the owner after changes are requested", () => {
  const run = { id: "r", code: "OP-9", currentStep: 1, ownerId: "o", createdAt: "2026-10-01T00:00:00Z", history: [{ at: "2026-10-05T00:00:00Z" }] };
  const steps = [{ assigneeId: "s0" }, { assigneeId: "s1" }];
  assert.deepEqual(runWaiting({ ...run, status: "in_progress" }, steps), { id: "r", code: "OP-9", waitingOnId: "s1", since: "2026-10-05T00:00:00Z" });
  assert.equal(runWaiting({ ...run, status: "changes_requested" }, steps)?.waitingOnId, "o");
  assert.equal(runWaiting({ ...run, status: "completed" }, steps), null);
});

test("demo: every department, people visible, at least one bottleneck", () => {
  const demo = demoAnalyticsData();
  assert.equal(demo.departments.length, 5);
  assert.ok(demo.departments.every((d) => d.people));
  assert.ok(demo.bottlenecks.length > 0);
});

// ---------- Who sees what (SEC-TC-01…06), against the database ----------

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@ana.test");
const head = user("head@ana.test");
const staff = user("staff@ana.test");
const seller = user("seller@ana.test");
const techie = user("techie@ana.test");
const outsider = user("outsider@ana.test");
let companyId = "";
const ids: Record<string, string> = {};

const newCompany = (who: typeof owner, slug: string, code: string) =>
  t.as(who, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company(${slug}, ${code}, ${JSON.stringify(L("Co"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });

before(async () => {
  t = await createTestDb();
  companyId = await newCompany(owner, "ana", "ANA01");
  await newCompany(outsider, "anaother", "ANA02");
  await t.pg.query("UPDATE companies SET plan = 'pro'");
  ids.sales = (await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Sales") }))).id;
  ids.tech = (await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Tech") }))).id;

  const overview = await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId));
  const employeeRole = overview.roles.find((r) => r.systemKey === "employee")!.id;
  const headRole = await t.as(owner, (ctx) => permissions.createRole(ctx, { companyId, name: L("Head of sales"), copyFromRoleId: employeeRole }));
  await t.as(owner, (ctx) =>
    permissions.setRolePermissions(ctx, {
      roleId: headRole.id,
      permissions: [
        { key: "hr.view", departmentIds: null },
        { key: "analytics.view", departmentIds: null },
        { key: "analytics.departments", departmentIds: [ids.sales] },
      ],
    }),
  );
  for (const [who, name, dept, role] of [
    [head, "Head", ids.sales, headRole.id],
    [staff, "Staff", ids.sales, null],
    [seller, "Seller", ids.sales, null],
    [techie, "Techie", ids.tech, null],
  ] as const) {
    ids[name] = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: who.email!, name: L(name), departmentId: dept, roleId: role }))).id;
    await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
  }

  // Private rows the head may only see for Sales: hours, leave, a waiting approval
  for (const id of [ids.Seller, ids.Techie]) {
    await t.pg.query("INSERT INTO work_sessions (company_id, member_id, started_at, ended_at) VALUES ($1, $2, now() - interval '3 hours', now() - interval '1 hour')", [companyId, id]);
    await t.pg.query("INSERT INTO tasks (company_id, title, assignee_id, due_date, status) VALUES ($1, 'Late', $2, current_date - 5, 'todo')", [companyId, id]);
  }
  await t.pg.query("INSERT INTO approval_requests (company_id, requester_id, approver_id, title, created_at) VALUES ($1, $2, $3, 'Secret purchase', now() - interval '5 days')", [
    companyId,
    ids.Seller,
    ids.Techie,
  ]);
});

test("SEC-TC-01/04: no analytics.view (or another company) → forbidden", async () => {
  await failsWith("forbidden", t.as(staff, (ctx) => analytics.getAnalyticsData(ctx, companyId)));
  await failsWith("forbidden", t.as(outsider, (ctx) => analytics.getAnalyticsData(ctx, companyId)));
});

test("SEC-TC-02/06: a head scoped to Sales sees Sales totals only, and no people", async () => {
  const data = await t.as(head, (ctx) => analytics.getAnalyticsData(ctx, companyId));
  assert.deepEqual(data.departments.map((d) => d.id), [ids.sales]);
  assert.equal(data.canSeeMembers, false);
  assert.ok(data.departments.every((d) => d.people === undefined));
  assert.equal(data.departments[0].overdue.count, 1);
  assert.ok(data.departments[0].capacity.loggedMinutes >= 119, "the seller's two hours are counted");
  assert.equal(data.departments[0].waitingApprovals.count, 0, "the approval waits in Tech");
  assert.ok(!data.bottlenecks.some((b) => b.kind === "unowned"));
  assert.deepEqual(data.names, {});
});

test("SEC-TC-02: the database readers return nothing outside the caller's scope", async () => {
  const minutes = await t.sqlAs(head.sub, "select member_id from private.analytics_minutes($1, now() - interval '1 day', now() + interval '1 day')", [companyId]);
  assert.deepEqual(minutes.map((r) => r.member_id), [ids.Seller]);
  assert.equal((await t.sqlAs(head.sub, "select * from private.analytics_waiting_approvals($1)", [companyId])).length, 0);
  assert.equal((await t.sqlAs(staff.sub, "select * from private.analytics_minutes($1, now() - interval '1 day', now() + interval '1 day')", [companyId])).length, 0);
  assert.equal((await t.sqlAs(outsider.sub, "select * from private.analytics_waiting_approvals($1)", [companyId])).length, 0);
});

test("SEC-TC-05: a change of grants shows on the next call (people for Sales)", async () => {
  await t.as(owner, (ctx) => permissions.setMemberOverrides(ctx, { memberId: ids.Head, overrides: [{ key: "analytics.members", effect: "grant", departmentIds: [ids.sales] }] }));
  const data = await t.as(head, (ctx) => analytics.getAnalyticsData(ctx, companyId));
  assert.equal(data.canSeeMembers, true);
  assert.deepEqual(data.departments[0].people?.map((p) => p.id).sort(), [ids.Head, ids.Staff, ids.Seller].sort());
});

test("the owner sees every department, people, and the approval waiting on the techie", async () => {
  const data = await t.as(owner, (ctx) => analytics.getAnalyticsData(ctx, companyId));
  const ids2 = data.departments.map((d) => d.id);
  assert.ok(ids2.includes(ids.sales) && ids2.includes(ids.tech));
  assert.equal(data.departments.find((d) => d.id === ids.tech)!.waitingApprovals.count, 1);
  assert.ok(data.bottlenecks.some((b) => b.kind === "approvals" && b.memberId === ids.Techie));
  assert.ok(data.departments.every((d) => d.people));
});

test("the default Admin role has the analytics permissions, the Employee role has none", async () => {
  const overview = await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId));
  const keys = (key: string): string[] => overview.roles.find((r) => r.systemKey === key)!.permissions.map((p) => p.key);
  assert.ok(["analytics.view", "analytics.departments", "analytics.members"].every((k) => keys("admin").includes(k)));
  assert.ok(!keys("employee").some((k) => k.startsWith("analytics.")));
});
