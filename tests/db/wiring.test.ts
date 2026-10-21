/** Screens wired to real data: main hall, task board, operations room, schedule, automation, client portal. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as automation from "../../src/modules/automation/service";
import * as hq from "../../src/modules/hq/service";
import { defaultOffice } from "../../src/modules/hq/layout";
import * as marketing from "../../src/modules/marketing/service";
import * as ops from "../../src/modules/operations/service";
import { runToRow } from "../../src/modules/operations/rows";
import { createTestDb, L, user } from "./setup";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

// ---------- pure ----------

test("default office: the owner's desk, one section per staffed department, a desk per person", () => {
  const office = defaultOffice(
    [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
    [
      { id: "o", departmentId: null },
      { id: "a", departmentId: "d2" },
      { id: "b", departmentId: "d2" },
      { id: "c", departmentId: "d3" },
    ],
    "o",
  );
  assert.deepEqual(office.rooms.map((r) => r.type), ["meeting", "ceo", "open"]);
  assert.deepEqual(office.zones.map((z) => z.departmentId), ["d2", "d3", "d1"], "staffed departments first");
  const desks = office.furniture.filter((f) => f.kind === "desk");
  assert.deepEqual(desks.map((d) => d.memberId).sort(), ["a", "b", "c", "o"]);
  for (const d of desks) assert.ok(d.x >= 0 && d.x + d.w <= 1000 && d.y + d.h <= 650, "inside the floor");
});

test("operation rows: step, status and deciders from the run", () => {
  const people = [
    { id: "p1", name: L("Owner"), title: L("CEO") },
    { id: "p2", name: L("Boss"), title: null },
  ];
  const base = { id: "r", code: "OP-1", category: "finance", nature: "human" as const, subject: L("Pay"), ownerId: "p1", currentStep: 1 };
  const steps = [
    { title: L("Ask"), assigneeId: "p1" },
    { title: L("Approve"), assigneeId: "p2" },
  ];
  const waiting = runToRow({ ...base, status: "in_progress", steps }, people);
  assert.deepEqual([waiting.status, waiting.step.title.en, waiting.step.by.en, waiting.deciders], ["pending", "Approve", "With Boss", ["O", "B"]]);
  assert.equal(runToRow({ ...base, status: "changes_requested", steps }, people).status, "review");
  assert.equal(runToRow({ ...base, status: "completed", steps }, people).status, "done");
  const standalone = runToRow({ ...base, category: "unknown", status: "in_progress", steps: null }, people);
  assert.deepEqual([standalone.status, standalone.category], ["processing", "operations"]);
  assert.equal(runToRow({ ...base, ownerId: null, status: "in_progress", steps: null }, people).owner.bot, true);
});

// ---------- database ----------

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@wire.test");
const staff = user("staff@wire.test");
const visitor = user("visitor@wire.test");
const outsider = user("out@wire.test");
let companyId = "";
const ids: Record<string, string> = {};

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('wire', 'WIRE1', ${JSON.stringify(L("Co"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
  ids.dept = (await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Sales") }))).id;
  ids.staff = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: staff.email!, name: L("Staff"), departmentId: ids.dept }))).id;
  await t.as(staff, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
});

test("main hall: the real people, a starting office with their desks, the activity", async () => {
  const hall = await t.as(staff, (ctx) => hq.getMainHall(ctx, companyId));
  assert.equal(hall.members.length, 2);
  assert.equal(hall.meId, ids.staff);
  assert.ok(hall.furniture.some((f) => f.memberId === ids.staff), "a desk for the employee");
  assert.ok(hall.zones.some((z) => z.departmentId === ids.dept));
  assert.ok(hall.activity.some((a) => /^\d{2}:\d{2}$/.test(a.time)), "activity at company time");
  await failsWith("forbidden", t.as(outsider, (ctx) => hq.getMainHall(ctx, companyId)));
});

test("tasks: saved, moved and deleted for real; only the people concerned or managers change them", async () => {
  const task = await t.as(owner, (ctx) => ops.createTask(ctx, { companyId, title: "Call the client", assigneeId: ids.staff, dueDate: "2026-10-30" }));
  const board = await t.as(staff, (ctx) => ops.getTaskBoard(ctx, companyId));
  assert.deepEqual([board.meId, board.tasks.length, board.members.length], [ids.staff, 1, 2]);
  await t.as(staff, (ctx) => ops.updateTask(ctx, { taskId: task.id, status: "done" }));
  const [row] = (await t.pg.query<{ status: string; completed_at: Date | null }>("SELECT status, completed_at FROM tasks WHERE id = $1", [task.id])).rows;
  assert.ok(row.status === "done" && row.completed_at);
  const other = await t.as(owner, (ctx) => ops.createTask(ctx, { companyId, title: "Owner's own" }));
  await failsWith("forbidden", t.as(staff, (ctx) => ops.deleteTask(ctx, { taskId: other.id })));
});

test("operations room: real operations as rows, figures, notes, tasks and schedule", async () => {
  await t.as(owner, (ctx) => automation.startOperation(ctx, { companyId, subject: L("Buy chairs"), category: "purchasing" }));
  await t.as(owner, (ctx) => ops.createNote(ctx, { companyId, text: "Hello team", audience: { type: "company" } }));
  const data = await t.as(staff, (ctx) => ops.getOperationsData(ctx, companyId));
  assert.equal(data.rows.length, 1);
  assert.deepEqual([data.rows[0].title.en, data.rows[0].category, data.rows[0].status], ["Buy chairs", "purchasing", "processing"]);
  assert.equal(data.counts.purchasing, 1);
  assert.equal(data.kpis.active, 1);
  assert.equal(data.notes.length, 1);
  assert.equal(data.tasks.tasks.length, 2);
  assert.equal(data.schedule.items.length, 0);
});

test("schedule: saved in UTC, shown in the company's local time", async () => {
  // 10:30 in Cairo (default zone) on a day without daylight saving
  await t.as(staff, (ctx) => ops.createScheduleItem(ctx, { companyId, kind: "meeting", title: "Standup", startsAt: "2026-12-01T08:30:00Z", durationMinutes: 30, attendeeIds: [] }));
  const board = await t.as(owner, (ctx) => ops.getScheduleBoard(ctx, companyId));
  const item = board.items.find((i) => i.title === "Standup")!;
  assert.equal(item.startsAt, "2026-12-01T10:30");
  assert.equal(item.organizerId, ids.staff);
  assert.equal(board.timeZone, "Africa/Cairo");
});

test("automation room: workflows, runs, flows and figures; an empty company has none", async () => {
  const empty = await t.as(owner, (ctx) => automation.getAutomationData(ctx, companyId));
  assert.deepEqual([empty.workflows.length, empty.flows.length], [0, 0]);
  const wf = await t.as(owner, (ctx) => automation.createWorkflow(ctx, { companyId, name: L("Purchase"), steps: [{ title: L("Ask"), assigneeId: ids.staff }, { title: L("Approve"), assigneeId: ids.staff }] }));
  await t.as(owner, (ctx) => automation.startOperation(ctx, { companyId, subject: L("Laptop"), workflowId: wf.id }));
  await t.as(owner, (ctx) => automation.createFlowFromTemplate(ctx, { companyId, templateId: "t1" }));
  const data = await t.as(staff, (ctx) => automation.getAutomationData(ctx, companyId));
  assert.deepEqual([data.workflows.length, data.runs.length, data.flows.length, data.meId], [1, 1, 1, ids.staff]);
});

test("client portal: a visitor reads their own client and briefs, and sends one", async () => {
  const client = await t.as(owner, (ctx) => marketing.createClient(ctx, { companyId, name: L("Acme") }));
  const code = (await t.pg.query<{ invite_code: string }>("SELECT invite_code FROM clients WHERE id = $1", [client.id])).rows[0].invite_code;
  await t.as(visitor, ({ tx }) => tx.execute(sql`select public.redeem_client_invite(${code})`));
  const [mine] = await t.as(visitor, (ctx) => marketing.getMyClients(ctx));
  assert.equal(mine.name.en, "Acme");
  await t.as(visitor, (ctx) => marketing.sendBrief(ctx, { clientId: client.id, type: "shortVideo", objective: L("Launch"), audience: L("Youth"), details: L("30s ad"), budget: 1000 }));
  assert.equal((await t.as(visitor, (ctx) => marketing.listBriefs(ctx, { clientId: client.id }))).length, 1);
  assert.equal((await t.as(outsider, (ctx) => marketing.getMyClients(ctx))).length, 0);
});
