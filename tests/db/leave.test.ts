/** Leave: the rules (pure), and requests, approvals and balances end to end on Postgres with RLS. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as hq from "../../src/modules/hq/service";
import * as leave from "../../src/modules/leave/service";
import * as permissions from "../../src/modules/permissions/service";
import { balanceOf, checkRequest, daysInYear, DEFAULT_ALLOWANCES, workingDays, type LeaveRequest } from "../../src/modules/leave/calc";
import { demoLeaveData } from "../../src/modules/leave/demo";
import { createTestDb, L, user } from "./setup";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

// ---------- Rules ----------

const settings = { allowances: DEFAULT_ALLOWANCES, weekendDays: [5, 6] };
const req = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: "r",
  memberId: "a",
  type: "annual",
  startsOn: "2026-10-18",
  endsOn: "2026-10-22",
  days: 5,
  reason: null,
  status: "approved",
  decidedById: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: "2026-10-01T00:00:00Z",
  ...over,
});

test("working days skip the weekend; a request across New Year counts in each year", () => {
  // Thu 15 → Wed 21 October 2026, without Friday and Saturday
  assert.equal(workingDays("2026-10-15", "2026-10-21"), 5);
  assert.equal(workingDays("2026-10-16", "2026-10-17"), 0, "Friday and Saturday only");
  assert.equal(workingDays("2026-10-16", "2026-10-17", [0]), 2, "another weekend");
  const newYear = { startsOn: "2026-12-30", endsOn: "2027-01-03" };
  assert.deepEqual([daysInYear(newYear, 2026, [5, 6]), daysInYear(newYear, 2027, [5, 6])], [2, 1]);
});

test("balance: allowance − approved − pending; per-person allowance; unpaid has no limit", () => {
  const data = {
    settings,
    overrides: [{ memberId: "b", year: 2026, type: "annual" as const, allowance: 30 }],
    requests: [req({}), req({ id: "p", startsOn: "2026-11-01", endsOn: "2026-11-02", status: "pending" }), req({ id: "x", status: "rejected" })],
  };
  assert.deepEqual(balanceOf("a", "annual", 2026, data), { allowance: 21, used: 5, pending: 2, remaining: 14 });
  assert.equal(balanceOf("b", "annual", 2026, data).remaining, 30);
  assert.equal(balanceOf("a", "unpaid", 2026, data).remaining, null);
  assert.equal(balanceOf("a", "annual", 2027, data).used, 0, "next year starts fresh");
});

test("a request is refused when dates clash, fall on the weekend only, or exceed the balance", () => {
  const data = { settings, overrides: [], requests: [req({})] };
  const ask = (over: object) => checkRequest({ memberId: "a", type: "annual", startsOn: "2026-11-01", endsOn: "2026-11-01", ...over }, data);
  assert.equal(ask({}), null);
  assert.equal(ask({ startsOn: "2026-10-22", endsOn: "2026-10-25" }), "overlap");
  assert.equal(ask({ startsOn: "2026-11-06", endsOn: "2026-11-07" }), "invalid", "weekend only");
  assert.equal(ask({ endsOn: "2026-10-01" }), "invalid", "ends before it starts");
  assert.equal(ask({ endsOn: "2026-11-30" }), "insufficient_balance", "21 working days, 16 left");
  assert.equal(ask({ type: "unpaid", endsOn: "2026-11-30" }), null);
  // Another person's leave on the same days is not a clash
  assert.equal(checkRequest({ memberId: "b", type: "annual", startsOn: "2026-10-18", endsOn: "2026-10-18" }, data), null);
});

test("demo data: balances add up and nobody is over their allowance", () => {
  const demo = demoLeaveData("2026-10-15");
  for (const m of demo.members) {
    for (const type of ["annual", "casual", "sick"] as const) {
      const b = balanceOf(m.id, type, 2026, demo);
      assert.ok(b.remaining === null || b.remaining >= 0, `${m.id} ${type}`);
    }
  }
  assert.ok(demo.requests.some((r) => r.status === "pending"));
});

// ---------- Service + database ----------

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@leave.test");
const admin = user("admin@leave.test");
const lead = user("lead@leave.test");
const staffA = user("a@leave.test");
const staffB = user("b@leave.test");
let companyId = "";
const ids: Record<string, string> = {};
const next = new Date().getUTCFullYear() + 1;
// A Monday-to-Thursday stretch in March next year, whatever the year
const monday = (() => {
  for (let d = 1; ; d++) {
    const iso = `${next}-03-${String(d).padStart(2, "0")}`;
    if (new Date(`${iso}T00:00:00Z`).getUTCDay() === 1) return d;
  }
})();
const march = (offset: number) => new Date(Date.UTC(next, 2, monday + offset)).toISOString().slice(0, 10);

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('leave', 'LEAV1', ${JSON.stringify(L("Agency"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
  const deptA = await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Design") }));
  const deptB = await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Sales") }));
  const adminRole = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).roles.find((r) => r.systemKey === "admin")!.id;
  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: admin.email!, name: L("Admin"), roleId: adminRole }));
  for (const [who, name, departmentId] of [
    [lead, "Lead", deptA.id],
    [staffA, "Staff A", deptA.id],
    [staffB, "Staff B", deptB.id],
  ] as const) {
    const m = await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: who.email!, name: L(name), departmentId }));
    ids[name] = m.id;
  }
  for (const who of [admin, lead, staffA, staffB]) await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
  // The design lead approves leave for the Design department only
  await t.as(owner, (ctx) => permissions.setMemberOverrides(ctx, { memberId: ids.Lead, overrides: [{ key: "leaves.manage", effect: "grant", departmentIds: [deptA.id] }] }));
});

test("an employee requests leave; working days are counted by the server; clashes and overdrafts are refused", async () => {
  const r = await t.as(staffA, (ctx) => leave.requestLeave(ctx, { companyId, type: "annual", startsOn: march(0), endsOn: march(6), reason: "Family trip" }));
  assert.deepEqual([r.status, r.days], ["pending", 5], "Mon → Sun, without Friday and Saturday");
  await failsWith("overlap", t.as(staffA, (ctx) => leave.requestLeave(ctx, { companyId, type: "casual", startsOn: march(3), endsOn: march(3) })));
  await failsWith("insufficient_balance", t.as(staffA, (ctx) => leave.requestLeave(ctx, { companyId, type: "annual", startsOn: march(7), endsOn: march(30) })));
  await failsWith("invalid", t.as(staffA, (ctx) => leave.requestLeave(ctx, { companyId, type: "annual", startsOn: march(4), endsOn: march(5) })));

  const mine = await t.as(staffA, (ctx) => leave.getLeaveData(ctx, companyId));
  assert.equal(mine.canManage, false);
  assert.deepEqual(mine.members.map((m) => m.id), [ids["Staff A"]], "an employee sees only themselves");
  const events = await t.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM events WHERE type = 'leave.requested' AND company_id = $1", [companyId]);
  assert.equal(events.rows[0].n, 1);
});

test("RLS: nobody reads or writes someone else's leave, or approves their own, with raw SQL", async () => {
  await t.as(staffB, (ctx) => leave.requestLeave(ctx, { companyId, type: "sick", startsOn: march(1), endsOn: march(1) }));
  assert.equal((await t.sqlAs(staffA.sub, "SELECT id FROM leave_requests")).length, 1, "only their own");
  await assert.rejects(
    t.sqlAs(staffA.sub, "INSERT INTO leave_requests (company_id, member_id, type, starts_on, ends_on, days) VALUES ($1, $2, 'annual', $3, $3, 1)", [companyId, ids["Staff B"], march(0)]),
  );
  await assert.rejects(t.sqlAs(staffA.sub, "UPDATE leave_requests SET status = 'approved'"), "an employee may only cancel");
  await assert.rejects(t.sqlAs(staffA.sub, "INSERT INTO leave_balances (company_id, member_id, year, type, allowance) VALUES ($1, $2, 2030, 'annual', 99)", [companyId, ids["Staff A"]]));
});

test("a manager decides for their departments only; the owner and admins for everyone", async () => {
  const lead$ = await t.as(lead, (ctx) => leave.getLeaveData(ctx, companyId));
  assert.equal(lead$.canManage, true);
  assert.equal(lead$.canSettings, false, "a scoped grant does not change the company policy");
  assert.deepEqual(new Set(lead$.members.map((m) => m.id)), new Set([ids.Lead, ids["Staff A"]]));
  assert.ok(lead$.requests.every((r) => r.memberId !== ids["Staff B"]), "Sales requests stay hidden");

  const [a] = (await t.as(staffA, (ctx) => leave.getLeaveData(ctx, companyId))).requests;
  const [b] = (await t.as(staffB, (ctx) => leave.getLeaveData(ctx, companyId))).requests;
  await failsWith("forbidden", t.as(staffA, (ctx) => leave.decideLeave(ctx, { requestId: a.id, decision: "approved" })));
  await failsWith("not_found", t.as(lead, (ctx) => leave.decideLeave(ctx, { requestId: b.id, decision: "approved" })));
  const approved = await t.as(lead, (ctx) => leave.decideLeave(ctx, { requestId: a.id, decision: "approved", note: "Enjoy" }));
  assert.deepEqual([approved.status, approved.decidedById, approved.decisionNote], ["approved", ids.Lead, "Enjoy"]);
  await failsWith("invalid", t.as(lead, (ctx) => leave.decideLeave(ctx, { requestId: a.id, decision: "rejected" })));
  const rejected = await t.as(admin, (ctx) => leave.decideLeave(ctx, { requestId: b.id, decision: "rejected", note: "Busy week" }));
  assert.equal(rejected.status, "rejected");

  // A manager does not approve their own request
  const own = await t.as(lead, (ctx) => leave.requestLeave(ctx, { companyId, type: "casual", startsOn: march(2), endsOn: march(2) }));
  await failsWith("forbidden", t.as(lead, (ctx) => leave.decideLeave(ctx, { requestId: own.id, decision: "approved" })));
  await t.as(owner, (ctx) => leave.decideLeave(ctx, { requestId: own.id, decision: "approved" }));
});

test("balances: a lower allowance blocks approval; reset goes back to the default; future approved leave can be cancelled", async () => {
  const pending = await t.as(staffA, (ctx) => leave.requestLeave(ctx, { companyId, type: "casual", startsOn: march(7), endsOn: march(9) }));
  await failsWith("forbidden", t.as(lead, (ctx) => leave.setLeaveAllowance(ctx, { memberId: ids["Staff B"], year: next, type: "casual", allowance: 1 })));
  await t.as(lead, (ctx) => leave.setLeaveAllowance(ctx, { memberId: ids["Staff A"], year: next, type: "casual", allowance: 2 }));
  await failsWith("insufficient_balance", t.as(lead, (ctx) => leave.decideLeave(ctx, { requestId: pending.id, decision: "approved" })));
  await t.as(lead, (ctx) => leave.setLeaveAllowance(ctx, { memberId: ids["Staff A"], year: next, type: "casual", allowance: null }));
  await t.as(lead, (ctx) => leave.decideLeave(ctx, { requestId: pending.id, decision: "approved" }));

  const data = await t.as(staffA, (ctx) => leave.getLeaveData(ctx, companyId));
  assert.deepEqual(balanceOf(ids["Staff A"], "annual", next, data), { allowance: 21, used: 5, pending: 0, remaining: 16 });
  assert.equal(balanceOf(ids["Staff A"], "casual", next, data).remaining, 3, "6 − 3 approved");

  await failsWith("not_found", t.as(staffB, (ctx) => leave.cancelLeave(ctx, { requestId: pending.id })));
  const cancelled = await t.as(staffA, (ctx) => leave.cancelLeave(ctx, { requestId: pending.id }));
  assert.equal(cancelled.status, "cancelled", "approved, not started yet");
  await failsWith("invalid", t.as(staffA, (ctx) => leave.cancelLeave(ctx, { requestId: pending.id })));
});

test("company policy: allowances and weekend, by the owner or an all-departments manager", async () => {
  await failsWith("forbidden", t.as(lead, (ctx) => leave.saveLeaveSettings(ctx, { companyId, allowances: DEFAULT_ALLOWANCES, weekendDays: [5] })));
  await failsWith("invalid", t.as(admin, (ctx) => leave.saveLeaveSettings(ctx, { companyId, allowances: DEFAULT_ALLOWANCES, weekendDays: [0, 1, 2, 3] })));
  const saved = await t.as(admin, (ctx) => leave.saveLeaveSettings(ctx, { companyId, allowances: { ...DEFAULT_ALLOWANCES, annual: 30 }, weekendDays: [5] }));
  assert.deepEqual(saved.weekendDays, [5]);
  const r = await t.as(staffB, (ctx) => leave.requestLeave(ctx, { companyId, type: "annual", startsOn: march(14), endsOn: march(20) }));
  assert.equal(r.days, 6, "only Friday is off now");
  const data = await t.as(staffB, (ctx) => leave.getLeaveData(ctx, companyId));
  assert.equal(balanceOf(ids["Staff B"], "annual", next, data).remaining, 24);
  // An employee's raw update touches nothing
  await t.sqlAs(staffB.sub, "UPDATE leave_settings SET weekend_days = '{}'");
  const [row] = await t.sqlAs(staffB.sub, "SELECT weekend_days FROM leave_settings");
  assert.deepEqual(row.weekend_days, [5]);
});
