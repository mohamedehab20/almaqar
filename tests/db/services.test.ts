/** Services end to end on a real Postgres, each call running as a user with RLS (same path as withUser). */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { AppError } from "../../src/server/errors";
import * as hq from "../../src/modules/hq/service";
import * as marketing from "../../src/modules/marketing/service";
import * as automation from "../../src/modules/automation/service";
import * as operations from "../../src/modules/operations/service";
import * as sales from "../../src/modules/sales/service";
import * as events from "../../src/modules/events/service";
import * as agents from "../../src/modules/agents/service";
import * as academy from "../../src/modules/academy/service";
import { createTestDb, L, user } from "./setup";

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@acme.test");
const employee = user("eman@acme.test");
const outsider = user();
const visitor = user();
let companyId = "";
let employeeMemberId = "";
let ownerMemberId = "";

const code = (error: unknown) => (error instanceof AppError ? error.code : (error as Error).message);
const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(code(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute<{ id: string }>(
      sql`select public.create_company('acme', 'ACME1', ${JSON.stringify(L("Acme"))}::jsonb, ${JSON.stringify(L("Ahmed"))}::jsonb) as id`,
    );
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
});

test("company, invite and presence", async () => {
  const found = await t.as(owner, (ctx) => hq.getCompanyBySlug(ctx, "acme"));
  assert.equal(found?.me.role, "owner");
  ownerMemberId = found!.me.id;
  assert.equal(await t.as(outsider, (ctx) => hq.getCompanyBySlug(ctx, "acme")), null, "outsiders do not see the company");

  const dept = await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Sales"), color: "amber" }));
  const invited = await t.as(owner, (ctx) =>
    hq.inviteMember(ctx, { companyId, email: "Eman@Acme.test", name: L("Eman"), departmentId: dept.id }),
  );
  assert.equal(invited.linked, false);
  await failsWith("conflict", t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: "eman@acme.test", name: L("Dup") })));

  // The employee signs in: claim_invites links them
  await t.as(employee, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
  const me = await t.as(employee, (ctx) => hq.setMyStatus(ctx, { companyId, status: "meeting", currentTask: L("Weekly sync") }));
  employeeMemberId = me.id;
  assert.equal(me.status, "meeting");
  await failsWith("forbidden", t.as(employee, (ctx) => hq.inviteMember(ctx, { companyId, email: "x@y.z", name: L("X") })));
  await failsWith("forbidden", t.as(employee, (ctx) => hq.removeMember(ctx, { companyId, memberId: ownerMemberId })));

  const list = await t.as(owner, (ctx) => hq.listMembers(ctx, companyId));
  assert.equal(list.length, 2);
  assert.equal(list.find((m) => m.id === employeeMemberId)?.departmentId, dept.id);
});

test("free plan: one workflow, five members", async () => {
  for (let i = 0; i < 3; i++) {
    await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: `p${i}@acme.test`, name: L(`P${i}`) }));
  }
  await failsWith("plan_limit", t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: "sixth@acme.test", name: L("Six") })));
});

test("approval workflow: start, approve by assignee only, complete", async () => {
  const wf = await t.as(owner, (ctx) =>
    automation.createWorkflow(ctx, {
      companyId,
      name: L("Leave request"),
      steps: [
        { title: L("Request"), assigneeId: employeeMemberId },
        { title: L("Manager"), assigneeId: ownerMemberId },
      ],
    }),
  );
  await failsWith("plan_limit", t.as(owner, (ctx) => automation.createWorkflow(ctx, { companyId, name: L("2nd"), steps: [{ title: L("s"), assigneeId: ownerMemberId }] })));

  const run = await t.as(employee, (ctx) => automation.startOperation(ctx, { companyId, workflowId: wf.id, subject: L("Eman leave — 3 days") }));
  assert.match(run.code, /^OP-\d{4}$/);
  assert.equal(run.currentStep, 1);
  await failsWith("forbidden", t.as(employee, (ctx) => automation.actOnRun(ctx, { runId: run.id, action: "approve" })));

  const changes = await t.as(owner, (ctx) => automation.actOnRun(ctx, { runId: run.id, action: "request_changes", note: "Dates?" }));
  assert.equal(changes.status, "changes_requested");
  const resubmitted = await t.as(employee, (ctx) => automation.actOnRun(ctx, { runId: run.id, action: "approve" }));
  assert.equal(resubmitted.currentStep, 1);
  const done = await t.as(owner, (ctx) => automation.actOnRun(ctx, { runId: run.id, action: "approve" }));
  assert.equal(done.status, "completed");
  assert.deepEqual(
    done.history.map((h) => h.action),
    ["started", "approved", "changes_requested", "resubmitted", "approved"],
  );
  await failsWith("invalid", t.as(owner, (ctx) => automation.actOnRun(ctx, { runId: run.id, action: "approve" })));
});

test("sales orders get numbers and events", async () => {
  const supplier = await t.as(employee, (ctx) => sales.createSupplier(ctx, { companyId, name: L("Future Tech") }));
  const order = await t.as(employee, (ctx) =>
    sales.createOrder(ctx, { companyId, type: "purchase", partyId: supplier.id, items: [{ name: "Laptop", qty: 2, unitPrice: 30000 }] }),
  );
  assert.equal(order.number, "PO-1001");
  const approved = await t.as(owner, (ctx) => sales.setOrderStatus(ctx, { orderId: order.id, status: "approved" }));
  assert.equal(approved.status, "approved");

  const log = await t.as(owner, (ctx) => events.listEvents(ctx, companyId, { type: ["order.created", "order.approved"] }));
  assert.equal(log.length, 2);
  assert.equal(log.find((e) => e.type === "order.created")?.payload.amount, 60000);
  assert.deepEqual(await t.as(outsider, (ctx) => events.listEvents(ctx, companyId)), []);
});

test("client portal: invite code, brief, clarification, idea", async () => {
  const client = await t.as(employee, (ctx) => marketing.createClient(ctx, { companyId, name: L("Morning Bakery"), managerId: employeeMemberId }));
  assert.match(client.inviteCode!, /^[A-Z2-9]{7}$/);

  await t.as(visitor, ({ tx }) => tx.execute(sql`select public.redeem_client_invite(${client.inviteCode})`));
  const mine = await t.as(visitor, (ctx) => marketing.getMyClients(ctx));
  assert.deepEqual(mine.map((c) => c.id), [client.id]);

  const brief = await t.as(visitor, (ctx) =>
    marketing.sendBrief(ctx, { clientId: client.id, type: "paidAds", objective: L("Launch"), audience: L("Families"), details: L("Ramadan offer"), budget: 15000 }),
  );
  assert.equal(brief.status, "new");
  const asked = await t.as(employee, (ctx) => marketing.setBriefStatus(ctx, { briefId: brief.id, status: "clarification" }));
  assert.equal(asked.status, "clarification");
  const replied = await t.as(visitor, (ctx) => marketing.replyToBrief(ctx, { briefId: brief.id, reply: "Budget is firm" }));
  assert.equal(replied.status, "new");
  await failsWith("forbidden", t.as(visitor, (ctx) => marketing.setBriefStatus(ctx, { briefId: brief.id, status: "received" })));

  const idea = await t.as(employee, (ctx) => marketing.createIdea(ctx, { companyId, title: L("Iftar countdown reel"), briefId: brief.id }));
  assert.equal(idea.clientId, client.id);
  await t.as(employee, (ctx) => marketing.updateIdea(ctx, { ideaId: idea.id, stage: "delivery", delivery: { status: "awaiting", sentOn: "2026-10-12" } }));
  const clients = await t.as(owner, (ctx) => marketing.listClients(ctx, companyId));
  assert.equal(clients[0].activeCampaigns, 1);
  assert.deepEqual(clients[0].manager, L("Eman"));
});

test("notes, agents, academy", async () => {
  const note = await t.as(employee, (ctx) => operations.createNote(ctx, { companyId, text: "Stock count Thursday", audience: { type: "company" } }));
  await t.as(owner, (ctx) => operations.setNotePinned(ctx, { noteId: note.id, pinned: true }));
  const listed = await t.as(owner, (ctx) => operations.listNotes(ctx, companyId));
  assert.equal(listed[0].pinned, true);
  await t.as(owner, (ctx) => operations.deleteNote(ctx, { noteId: note.id }));

  const agent = await t.as(owner, (ctx) => agents.createAgent(ctx, { companyId, kind: "general", name: L("Rafeeq") }));
  const busy = await t.as(employee, (ctx) => agents.queueTask(ctx, { agentId: agent.id, task: "Summarise last week" }));
  assert.deepEqual([busy.queue, busy.status], [1, "busy"]);
  const done = await t.as(employee, (ctx) => agents.completeTask(ctx, { agentId: agent.id, result: "ok" }));
  assert.deepEqual([done.queue, done.tasksDone, done.status], [0, 1, "active"]);

  assert.deepEqual(await t.as(employee, (ctx) => academy.setLessonDone(ctx, { lessonId: "l1", done: true })), ["l1"]);
  assert.deepEqual(await t.as(owner, (ctx) => academy.getMyProgress(ctx)), []);
});

test("demo seed loads every mock module and links the owner", async () => {
  const { seedDemo } = await import("../../src/db/seed");
  const demoOwner = user("demo-owner@acme.test");
  const { companyId: demoId, code: demoCode } = await seedDemo(t.db, { ownerEmail: "Demo-Owner@acme.test" });
  assert.equal(demoCode, "DEMO01");
  await t.as(demoOwner, ({ tx }) => tx.execute(sql`select public.claim_invites()`));

  const found = await t.as(demoOwner, (ctx) => hq.getCompanyBySlug(ctx, "demo"));
  assert.equal(found?.me.role, "owner");
  const counts = await t.as(demoOwner, async (ctx) => ({
    members: (await hq.listMembers(ctx, demoId)).length,
    floor: (await hq.getFloorPlan(ctx, demoId)).rooms.length,
    briefs: (await marketing.listBriefs(ctx, { companyId: demoId })).length,
    ideas: (await marketing.listIdeas(ctx, demoId)).length,
    orders: (await sales.listOrders(ctx, demoId)).length,
    runs: (await automation.listRuns(ctx, demoId)).length,
    notes: (await operations.listNotes(ctx, demoId)).length,
    agents: (await agents.listAgents(ctx, demoId)).length,
  }));
  for (const [name, n] of Object.entries(counts)) assert.ok(n > 0, `${name} seeded`);
  await assert.rejects(seedDemo(t.db), /already exists/);
  await seedDemo(t.db, { reset: true });
});
