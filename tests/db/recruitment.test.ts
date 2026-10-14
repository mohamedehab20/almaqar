/** Recruitment: jobs, candidates through the stages, interviews in the schedule, hiring into the team, referrals. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as hq from "../../src/modules/hq/service";
import * as permissions from "../../src/modules/permissions/service";
import * as rec from "../../src/modules/recruitment/service";
import { canMove, stageCounts } from "../../src/modules/recruitment/pipeline";
import { demoRecruitmentData } from "../../src/modules/recruitment/demo";
import { createTestDb, L, user } from "./setup";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

test("stage rules: one step at a time, reject from anywhere active, hire only from an offer, reopen", () => {
  assert.ok(canMove("applied", "screening"));
  assert.ok(canMove("interview", "screening"), "one step back");
  assert.ok(!canMove("applied", "interview"), "no skipping");
  assert.ok(canMove("screening", "rejected"));
  assert.ok(!canMove("interview", "hired"));
  assert.ok(canMove("offer", "hired"));
  assert.ok(canMove("rejected", "applied") && !canMove("hired", "offer"));
  const demo = demoRecruitmentData("2026-10-15T10:00:00Z");
  const counts = stageCounts(demo.candidates);
  assert.ok(Object.values(counts).every((n) => n > 0), "every stage has someone in the demo");
  assert.equal(stageCounts(demo.candidates, "j1").applied, 2);
});

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@rec.test");
const admin = user("admin@rec.test");
const staff = user("staff@rec.test");
let companyId = "";
let deptId = "";
const ids: Record<string, string> = {};

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('rec', 'RECR1', ${JSON.stringify(L("Agency"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
  deptId = (await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Design") }))).id;
  const adminRole = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).roles.find((r) => r.systemKey === "admin")!.id;
  ids.admin = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: admin.email!, name: L("Admin"), roleId: adminRole }))).id;
  ids.staff = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: staff.email!, name: L("Staff") }))).id;
  for (const who of [admin, staff]) await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
});

test("jobs: recruiters create and edit; employees see open jobs only", async () => {
  await failsWith("forbidden", t.as(staff, (ctx) => rec.createJob(ctx, { companyId, title: "Designer" })));
  await failsWith("invalid", t.as(admin, (ctx) => rec.createJob(ctx, { companyId, title: "Designer", salaryMin: 20_000, salaryMax: 10_000 })));
  const job = await t.as(admin, (ctx) => rec.createJob(ctx, { companyId, title: "Designer", departmentId: deptId, openings: 1, hiringManagerId: ids.admin, salaryMin: 15_000, salaryMax: 20_000 }));
  const paused = await t.as(admin, (ctx) => rec.createJob(ctx, { companyId, title: "Accountant", status: "paused" }));
  ids.job = job.id;
  ids.paused = paused.id;
  const seen = await t.as(staff, (ctx) => rec.getRecruitmentData(ctx, companyId));
  assert.equal(seen.canManage, false);
  assert.deepEqual(seen.jobs.map((j) => j.title), ["Designer"], "paused jobs stay hidden from employees");
  const edited = await t.as(admin, (ctx) => rec.updateJob(ctx, { jobId: job.id, openings: 1, description: "  Brand work  " }));
  assert.equal(edited.description, "Brand work");
});

test("referrals: an employee refers someone to an open job and sees only their own referrals", async () => {
  const referred = await t.as(staff, (ctx) => rec.addCandidate(ctx, { companyId, jobId: ids.job, name: "Friend", email: "Friend@Mail.com", source: "linkedin" }));
  assert.deepEqual([referred.source, referred.referredById, referred.stage, referred.email], ["referral", ids.staff, "applied", "friend@mail.com"]);
  await failsWith("not_found", t.as(staff, (ctx) => rec.addCandidate(ctx, { companyId, jobId: ids.paused, name: "Other" })));
  await t.as(admin, (ctx) => rec.addCandidate(ctx, { companyId, jobId: ids.job, name: "Direct", source: "wuzzuf" }));
  const mine = await t.as(staff, (ctx) => rec.getRecruitmentData(ctx, companyId));
  assert.deepEqual(mine.candidates.map((c) => c.name), ["Friend"]);
  await failsWith("forbidden", t.as(staff, (ctx) => rec.moveCandidate(ctx, { candidateId: referred.id, stage: "screening" })));
  // Raw SQL: no stage jumps, no peeking
  await assert.rejects(t.sqlAs(staff.sub, "INSERT INTO candidates (company_id, job_id, name, source, stage, referred_by_id) VALUES ($1, $2, 'X', 'referral', 'offer', $3)", [companyId, ids.job, ids.staff]));
  await t.sqlAs(staff.sub, "UPDATE candidates SET stage = 'offer'");
  assert.equal((await t.sqlAs(staff.sub, "SELECT stage FROM candidates"))[0].stage, "applied");
  ids.friend = referred.id;
});

test("pipeline: steps, interview in the schedule, rejection reason, hire into the team, job closes when filled", async () => {
  const id = ids.friend;
  await failsWith("invalid", t.as(admin, (ctx) => rec.moveCandidate(ctx, { candidateId: id, stage: "offer" })));
  await t.as(admin, (ctx) => rec.updateCandidate(ctx, { candidateId: id, rating: 4, notes: "Strong portfolio" }));

  const startsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const booked = await t.as(admin, (ctx) => rec.scheduleInterview(ctx, { candidateId: id, startsAt, durationMinutes: 45, location: "Meeting room", attendeeIds: [ids.staff] }));
  assert.equal(booked.stage, "interview", "booking an interview moves the candidate on");
  const [item] = await t.pg.query<{ kind: string; contact_name: string; attendee_ids: string[] }>("SELECT kind, contact_name, attendee_ids FROM meetings WHERE company_id = $1", [companyId]).then((r) => r.rows);
  assert.deepEqual([item.kind, item.contact_name, item.attendee_ids], ["interview", "Friend", [ids.staff]]);
  // Moving the interview updates the same schedule item
  await t.as(admin, (ctx) => rec.scheduleInterview(ctx, { candidateId: id, startsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString(), durationMinutes: 30 }));
  assert.equal((await t.pg.query("SELECT id FROM meetings WHERE company_id = $1", [companyId])).rows.length, 1);

  await failsWith("invalid", t.as(admin, (ctx) => rec.hireCandidate(ctx, { candidateId: id, invite: true })));
  await t.as(admin, (ctx) => rec.moveCandidate(ctx, { candidateId: id, stage: "offer" }));
  const hired = await t.as(admin, (ctx) => rec.hireCandidate(ctx, { candidateId: id, invite: true }));
  assert.equal(hired.candidate.stage, "hired");
  assert.ok(hired.memberId);
  assert.equal(hired.jobClosed, true, "the only opening is filled");
  const member = (await t.as(owner, (ctx) => hq.listMembers(ctx, companyId))).find((m) => m.id === hired.memberId)!;
  assert.deepEqual([member.email, member.departmentId, member.title.en, member.linked], ["friend@mail.com", deptId, "Designer", false]);
  const data = await t.as(admin, (ctx) => rec.getRecruitmentData(ctx, companyId));
  assert.equal(data.jobs.find((j) => j.id === ids.job)!.status, "closed");

  const other = data.candidates.find((c) => c.name === "Direct")!;
  const rejected = await t.as(admin, (ctx) => rec.moveCandidate(ctx, { candidateId: other.id, stage: "rejected", reason: "Too junior" }));
  assert.deepEqual([rejected.stage, rejected.rejectedReason], ["rejected", "Too junior"]);
  const reopened = await t.as(admin, (ctx) => rec.moveCandidate(ctx, { candidateId: other.id, stage: "applied" }));
  assert.equal(reopened.rejectedReason, null);
  await t.as(admin, (ctx) => rec.deleteCandidate(ctx, { candidateId: other.id }));
  await t.as(admin, (ctx) => rec.deleteJob(ctx, { jobId: ids.paused }));
});
