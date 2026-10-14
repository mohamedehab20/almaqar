/** Working hours: the rules (pure), and clock in/out, hand entries and team follow-up on Postgres with RLS. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as hq from "../../src/modules/hq/service";
import * as hours from "../../src/modules/hours/service";
import * as leave from "../../src/modules/leave/service";
import * as permissions from "../../src/modules/permissions/service";
import { DEFAULT_WORK_SETTINGS, formatMinutes, localParts, summarizeMonth, zonedToUtc, type WorkSession } from "../../src/modules/hours/calc";
import { demoWorkHoursData } from "../../src/modules/hours/demo";
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

test("time zones: local times to instants and back, with daylight saving", () => {
  // Egypt is on summer time (UTC+3) in mid-October 2026 and on UTC+2 in December
  assert.equal(zonedToUtc("2026-10-15", "09:00", "Africa/Cairo"), "2026-10-15T06:00:00.000Z");
  assert.equal(zonedToUtc("2026-12-01", "09:00", "Africa/Cairo"), "2026-12-01T07:00:00.000Z");
  assert.equal(zonedToUtc("2026-12-01", "09:00", "Asia/Riyadh"), "2026-12-01T06:00:00.000Z");
  assert.deepEqual(localParts("2026-10-15T21:30:00Z", "Africa/Cairo"), { date: "2026-10-16", time: "00:30" });
  assert.deepEqual([formatMinutes(450), formatMinutes(-2850), formatMinutes(5)], ["7:30", "-47:30", "0:05"]);
});

test("month summary: expected vs worked, lateness, absence, leave, weekend work, today on its own", () => {
  const tz = "Africa/Cairo";
  const at = (date: string, time: string) => zonedToUtc(date, time, tz);
  const s = (id: string, date: string, from: string, to: string | null): WorkSession => ({ id, memberId: "a", startedAt: at(date, from), endedAt: to ? at(date, to) : null, source: "timer", note: null });
  const r = summarizeMonth("a", "2026-10", {
    settings: DEFAULT_WORK_SETTINGS,
    weekendDays: [5, 6],
    now: "2026-10-15T12:00:00Z", // 15:00 in Cairo
    leaves: [{ memberId: "a", startsOn: "2026-10-05", endsOn: "2026-10-05" }],
    sessions: [
      s("1", "2026-10-01", "09:00", "17:00"), // on time, 8 h
      s("2", "2026-10-02", "10:00", "12:00"), // Friday: counts as work, not as a day present
      s("3", "2026-10-04", "09:30", "17:00"), // late (after 09:15)
      s("4", "2026-10-15", "09:00", null), // today, still clocked in
    ],
  });
  // Working days before the 15th: 1, 4–8, 11–14 = 10; one on leave → 9 × 7 h
  assert.deepEqual(
    [r.expectedDays, r.presentDays, r.absentDays, r.lateDays, r.leaveDays],
    [9, 2, 7, 1, 1],
  );
  assert.equal(r.expectedMinutes, 9 * 420);
  assert.equal(r.workedMinutes, 480 + 120 + 450);
  assert.equal(r.balanceMinutes, 1050 - 3780);
  assert.deepEqual([r.todayMinutes, r.working], [360, true]);
  const day = (d: string) => r.days.find((x) => x.date === d)!;
  assert.deepEqual([day("2026-10-01").status, day("2026-10-04").status, day("2026-10-05").status, day("2026-10-06").status, day("2026-10-15").status, day("2026-10-20").status], ["worked", "late", "leave", "absent", "today", "future"]);
  assert.deepEqual([day("2026-10-04").firstIn, day("2026-10-04").lastOut], ["09:30", "17:00"]);
});

test("demo data: a month with habits, leave and people clocked in", () => {
  const demo = demoWorkHoursData("2026-10-15T10:00:00Z");
  const sum = (id: string) => summarizeMonth(id, demo.month, demo);
  assert.ok(sum("m1").balanceMinutes > 0, "long days → extra time");
  assert.ok(sum("m3").lateDays >= 5, "often late");
  assert.ok(sum("m4").balanceMinutes < 0, "short days");
  assert.equal(sum("m6").absentDays, 1);
  assert.ok(demo.sessions.some((s) => s.endedAt === null), "someone is in right now");
});

// ---------- Service + database ----------

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@hours.test");
const admin = user("admin@hours.test");
const lead = user("lead@hours.test");
const staffA = user("a@hours.test");
const staffB = user("b@hours.test");
let companyId = "";
const ids: Record<string, string> = {};
const daysAgo = (n: number) => localParts(Date.now() - n * 86_400_000, "Africa/Cairo").date;
/** The latest working day (not Friday or Saturday) at least n days ago */
const workdayAgo = (n: number) => {
  for (let k = n; ; k++) if (![5, 6].includes(new Date(`${daysAgo(k)}T00:00:00Z`).getUTCDay())) return daysAgo(k);
};

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('hours', 'HOUR1', ${JSON.stringify(L("Agency"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
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
    ids[name] = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: who.email!, name: L(name), departmentId }))).id;
  }
  for (const who of [admin, lead, staffA, staffB]) await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
  // The design lead follows the Design department's hours (and has no leave permission)
  await t.as(owner, (ctx) => permissions.setMemberOverrides(ctx, { memberId: ids.Lead, overrides: [{ key: "hours.manage", effect: "grant", departmentIds: [deptA.id] }] }));
});

test("clock in and out: one running session at a time", async () => {
  const started = await t.as(staffA, (ctx) => hours.clockIn(ctx, { companyId }));
  assert.equal(started.endedAt, null);
  await failsWith("conflict", t.as(staffA, (ctx) => hours.clockIn(ctx, { companyId })));
  const data = await t.as(staffA, (ctx) => hours.getWorkHoursData(ctx, companyId));
  assert.ok(data.sessions.some((s) => s.id === started.id && s.endedAt === null));
  const stopped = await t.as(staffA, (ctx) => hours.clockOut(ctx, { companyId }));
  assert.ok(stopped.endedAt && stopped.endedAt > stopped.startedAt);
  await failsWith("invalid", t.as(staffA, (ctx) => hours.clockOut(ctx, { companyId })));
  // The timer's record cannot be removed by its owner
  await failsWith("forbidden", t.as(staffA, (ctx) => hours.deleteWorkSession(ctx, { sessionId: started.id })));
});

test("hours typed by hand: marked manual, no overlaps, nothing in the future", async () => {
  const day = daysAgo(3);
  const manual = await t.as(staffA, (ctx) => hours.addWorkSession(ctx, { companyId, date: day, from: "09:00", to: "17:00", note: "At a client" }));
  assert.equal(manual.source, "manual");
  assert.equal(manual.startedAt, zonedToUtc(day, "09:00", "Africa/Cairo"), "read in the company's time zone");
  await failsWith("overlap", t.as(staffA, (ctx) => hours.addWorkSession(ctx, { companyId, date: day, from: "16:00", to: "18:00" })));
  await failsWith("invalid", t.as(staffA, (ctx) => hours.addWorkSession(ctx, { companyId, date: day, from: "12:00", to: "11:00" })));
  await failsWith("invalid", t.as(staffA, (ctx) => hours.addWorkSession(ctx, { companyId, date: localParts(Date.now() + 3 * 86_400_000, "Africa/Cairo").date, from: "09:00", to: "10:00" })));
  await failsWith("forbidden", t.as(staffA, (ctx) => hours.addWorkSession(ctx, { companyId, memberId: ids["Staff B"], date: day, from: "09:00", to: "10:00" })));
  const extra = await t.as(staffA, (ctx) => hours.addWorkSession(ctx, { companyId, date: day, from: "18:00", to: "19:00" }));
  await t.as(staffA, (ctx) => hours.deleteWorkSession(ctx, { sessionId: extra.id }));
});

test("RLS: nobody reads, adds or removes someone else's hours with raw SQL", async () => {
  await t.as(staffB, (ctx) => hours.addWorkSession(ctx, { companyId, date: daysAgo(2), from: "09:00", to: "17:00" }));
  const seen = await t.sqlAs(staffA.sub, "SELECT member_id FROM work_sessions");
  assert.ok(seen.length > 0 && seen.every((r) => r.member_id === ids["Staff A"]));
  await assert.rejects(
    t.sqlAs(staffA.sub, "INSERT INTO work_sessions (company_id, member_id, started_at, ended_at, source) VALUES ($1, $2, now() - interval '2 hours', now() - interval '1 hour', 'manual')", [companyId, ids["Staff B"]]),
  );
  // Own timer rows stay: the delete matches nothing
  await t.sqlAs(staffA.sub, "DELETE FROM work_sessions WHERE source = 'timer'");
  assert.equal((await t.sqlAs(staffA.sub, "SELECT id FROM work_sessions WHERE source = 'timer'")).length, 1);
  await assert.rejects(t.sqlAs(staffA.sub, "INSERT INTO work_settings (company_id) VALUES ($1)", [companyId]));
});

test("a lead follows their department only, and sees its approved leave", async () => {
  const leaveDay = workdayAgo(1);
  const request = await t.as(staffA, (ctx) => leave.requestLeave(ctx, { companyId, type: "unpaid", startsOn: leaveDay, endsOn: leaveDay }));
  await t.as(admin, (ctx) => leave.decideLeave(ctx, { requestId: request.id, decision: "approved" }));

  const data = await t.as(lead, (ctx) => hours.getWorkHoursData(ctx, companyId));
  assert.equal(data.canManage, true);
  assert.equal(data.canSettings, false);
  assert.deepEqual(new Set(data.members.map((m) => m.id)), new Set([ids.Lead, ids["Staff A"]]));
  assert.ok(data.sessions.every((s) => s.memberId !== ids["Staff B"]), "Sales hours stay hidden");
  assert.ok(data.leaves.some((l) => l.memberId === ids["Staff A"]), "approved leave of the followed team is visible");

  const fixed = await t.as(lead, (ctx) => hours.addWorkSession(ctx, { companyId, memberId: ids["Staff A"], date: daysAgo(5), from: "10:00", to: "14:00", note: "Forgot to clock in" }));
  await failsWith("forbidden", t.as(lead, (ctx) => hours.addWorkSession(ctx, { companyId, memberId: ids["Staff B"], date: daysAgo(5), from: "10:00", to: "14:00" })));
  await t.as(lead, (ctx) => hours.deleteWorkSession(ctx, { sessionId: fixed.id }));
  const timer = (await t.as(staffA, (ctx) => hours.getWorkHoursData(ctx, companyId))).sessions.find((s) => s.source === "timer")!;
  await t.as(lead, (ctx) => hours.deleteWorkSession(ctx, { sessionId: timer.id }));
});

test("the working day: set by the owner or an all-departments manager", async () => {
  const day = { dayStart: "08:00", dayEnd: "16:00", breakMinutes: 30, graceMinutes: 10, timeZone: "Asia/Riyadh" };
  await failsWith("forbidden", t.as(lead, (ctx) => hours.saveWorkSettings(ctx, { companyId, ...day })));
  await failsWith("invalid", t.as(admin, (ctx) => hours.saveWorkSettings(ctx, { companyId, ...day, dayEnd: "07:00" })));
  await failsWith("invalid", t.as(admin, (ctx) => hours.saveWorkSettings(ctx, { companyId, ...day, timeZone: "Mars/Base" })));
  await t.as(admin, (ctx) => hours.saveWorkSettings(ctx, { companyId, ...day }));
  const data = await t.as(staffB, (ctx) => hours.getWorkHoursData(ctx, companyId));
  assert.deepEqual(data.settings, day);
  const s = await t.as(staffB, (ctx) => hours.addWorkSession(ctx, { companyId, date: daysAgo(4), from: "08:00", to: "09:00" }));
  assert.equal(s.startedAt, zonedToUtc(daysAgo(4), "08:00", "Asia/Riyadh"));
});
