/** Services end to end on a real Postgres, each call running as a user with RLS (same path as withUser). */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as hq from "../../src/modules/hq/service";
import * as marketing from "../../src/modules/marketing/service";
import * as automation from "../../src/modules/automation/service";
import * as operations from "../../src/modules/operations/service";
import * as sales from "../../src/modules/sales/service";
import * as events from "../../src/modules/events/service";
import * as agents from "../../src/modules/agents/service";
import * as academy from "../../src/modules/academy/service";
import * as permissions from "../../src/modules/permissions/service";
import { EMPLOYEE_DEFAULTS } from "../../src/modules/permissions/catalog";
import { createTestDb, L, user } from "./setup";

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@acme.test");
const employee = user("eman@acme.test");
const outsider = user();
const visitor = user();
let companyId = "";
let employeeMemberId = "";
let ownerMemberId = "";

// Same mapping the app uses in action(): AppError codes and Postgres errors (RLS, unique, ...) become stable codes
const code = (error: unknown) => toErrorCode(error);
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

  const renamed = await t.as(employee, (ctx) => hq.updateMyProfile(ctx, { companyId, title: { ar: "مصممة", en: "Designer" } }));
  assert.deepEqual([renamed.id, renamed.title.en, renamed.name.en], [employeeMemberId, "Designer", "Eman"], "only the given fields change, on your own row");
  await failsWith("forbidden", t.as(outsider, (ctx) => hq.updateMyProfile(ctx, { companyId, name: L("x") })));

  // The default Employee role cannot manage suppliers; the owner gives Eman a custom role that can
  await failsWith("forbidden", t.as(employee, (ctx) => sales.createSupplier(ctx, { companyId, name: L("Too early") })));
  const coordinator = await t.as(owner, (ctx) => permissions.createRole(ctx, { companyId, name: L("Coordinator") }));
  const extra = ["suppliers.manage", "clients.manage", "briefs.manage", "campaigns.manage", "flows.manage"] as const;
  await t.as(owner, (ctx) =>
    permissions.setRolePermissions(ctx, { roleId: coordinator.id, permissions: [...EMPLOYEE_DEFAULTS, ...extra].map((key) => ({ key, departmentIds: null })) }),
  );
  await t.as(owner, (ctx) => permissions.assignRole(ctx, { memberId: employeeMemberId, roleId: coordinator.id }));

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
  const briefLog = await t.as(owner, (ctx) => events.listEvents(ctx, companyId, { type: ["brief.received", "brief.clarification_requested", "brief.acknowledged"] }));
  assert.deepEqual(
    briefLog.map((e) => e.type).sort(),
    ["brief.clarification_requested", "brief.received"],
    "sending (DB trigger) and the team's status changes are different events",
  );

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

test("orders with an approval workflow follow their run", async () => {
  const boss = user("boss@beta.test");
  const manager = user("manager@beta.test");
  const betaId = await t.as(boss, async ({ tx }) => {
    const res = await tx.execute<{ id: string }>(
      sql`select public.create_company('beta-orders', 'BETAO1', ${JSON.stringify(L("Beta"))}::jsonb, ${JSON.stringify(L("Boss"))}::jsonb) as id`,
    );
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [betaId]);
  const bossMember = (await t.as(boss, (ctx) => hq.getCompanyBySlug(ctx, "beta-orders")))!.me;
  await t.as(boss, (ctx) => hq.inviteMember(ctx, { companyId: betaId, email: "manager@beta.test", name: L("Manager") }));
  await t.as(manager, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
  const managerMember = (await t.as(manager, (ctx) => hq.getCompanyBySlug(ctx, "beta-orders")))!.me;

  const wf = await t.as(boss, (ctx) =>
    automation.createWorkflow(ctx, {
      companyId: betaId,
      name: L("Purchase approval"),
      steps: [
        { title: L("Request"), assigneeId: bossMember.id },
        { title: L("Manager approval"), assigneeId: managerMember.id },
      ],
    }),
  );
  const supplier = await t.as(boss, (ctx) => sales.createSupplier(ctx, { companyId: betaId, name: L("Supplier") }));
  const items = [{ name: "Desk", qty: 1, unitPrice: 5000 }];

  // Pending order with a workflow: the run starts right away and waits for the manager
  const order = await t.as(boss, (ctx) => sales.createOrder(ctx, { companyId: betaId, type: "purchase", partyId: supplier.id, items, workflowId: wf.id }));
  assert.equal(order.status, "pending");
  assert.ok(order.runId, "approval run started");
  await failsWith("invalid", t.as(boss, (ctx) => sales.setOrderStatus(ctx, { orderId: order.id, status: "approved" })));
  await t.as(manager, (ctx) => automation.actOnRun(ctx, { runId: order.runId!, action: "approve" }));
  const approved = (await t.as(boss, (ctx) => sales.listOrders(ctx, betaId))).find((o) => o.id === order.id);
  assert.equal(approved?.status, "approved", "completing the run approves the order");

  // Draft first; making it pending starts the run; rejected back to the requester and then closed → cancelled
  const draft = await t.as(boss, (ctx) =>
    sales.createOrder(ctx, { companyId: betaId, type: "purchase", partyId: supplier.id, items, workflowId: wf.id, status: "draft" }),
  );
  assert.equal(draft.runId, null, "drafts do not start a run");
  const pending = await t.as(boss, (ctx) => sales.setOrderStatus(ctx, { orderId: draft.id, status: "pending" }));
  assert.ok(pending.runId);
  await t.as(manager, (ctx) => automation.actOnRun(ctx, { runId: pending.runId!, action: "reject" }));
  assert.equal((await t.as(boss, (ctx) => sales.listOrders(ctx, betaId))).find((o) => o.id === draft.id)?.status, "pending");
  await t.as(boss, (ctx) => automation.actOnRun(ctx, { runId: pending.runId!, action: "reject" }));
  assert.equal((await t.as(boss, (ctx) => sales.listOrders(ctx, betaId))).find((o) => o.id === draft.id)?.status, "cancelled");

  const log = await t.as(boss, (ctx) => events.listEvents(ctx, betaId, { type: ["order.approved", "order.cancelled"] }));
  assert.deepEqual(log.map((e) => [e.type, e.source]).sort(), [["order.approved", "automation"], ["order.cancelled", "automation"]]);

  // Another company's workflow cannot be attached
  await failsWith("not_found", t.as(owner, (ctx) => sales.createOrder(ctx, { companyId, type: "sale", partyId: supplier.id, items, workflowId: wf.id })));
});

test("activity feed names the actor; operations KPIs come from the runs", async () => {
  const feed = await t.as(owner, (ctx) => events.listActivity(ctx, companyId, 50));
  assert.ok(feed.length > 0);
  const order = feed.find((a) => a.type === "order.created");
  assert.match(order!.text.ar, /^طلب جديد PO-\d{4} — Eman$/, "action, number, then the actor's name");
  assert.match(order!.text.en, /^New order PO-\d{4} — Eman$/);
  const brief = feed.find((a) => a.type === "brief.received");
  assert.equal(brief?.actorId, null, "a client portal user is not a member: no actor");
  assert.equal(brief?.text.ar, "طلب جديد من عميل");
  assert.ok(feed.every((a, i) => i === 0 || a.time <= feed[i - 1].time), "newest first");
  assert.deepEqual(await t.as(outsider, (ctx) => events.listActivity(ctx, companyId)), [], "other companies see nothing");

  const stats = await t.as(owner, (ctx) => operations.getOperationsStats(ctx, companyId));
  assert.equal(stats.total, 1, "one operation this month: the leave request run");
  assert.equal(stats.activeOperations, 0);
  assert.equal(stats.pendingApprovals, 0);
  assert.equal(stats.byCategory.operations, 1);
  assert.equal(typeof stats.avgCycleHours, "number");
  await failsWith("forbidden", t.as(outsider, (ctx) => operations.getOperationsStats(ctx, companyId)));
});

test("marketing sections: accounts, campaigns, budgets and channel stats; the client reads only its own", async () => {
  const bakery = (await t.as(owner, (ctx) => marketing.listClients(ctx, companyId))).find((c) => c.name.en === "Morning Bakery")!;
  const other = await t.as(owner, (ctx) => marketing.createClient(ctx, { companyId, name: L("Other client"), monthlyBudget: 5000 }));

  const account = await t.as(employee, (ctx) => marketing.createSocialAccount(ctx, { clientId: bakery.id, platform: "Instagram", handle: "@bakery", followers: 1200 }));
  assert.equal(account.status, "connected");
  await failsWith("conflict", t.as(employee, (ctx) => marketing.createSocialAccount(ctx, { clientId: bakery.id, platform: "Instagram", handle: "@bakery" })));

  const month = new Date().toISOString().slice(0, 8);
  const k1 = await t.as(employee, (ctx) =>
    marketing.createCampaign(ctx, { clientId: bakery.id, name: L("Ramadan reels"), channels: ["Instagram", "TikTok"], start: `${month}01`, end: `${month}28` }),
  );
  await failsWith("invalid", t.as(employee, (ctx) => marketing.createCampaign(ctx, { clientId: bakery.id, name: L("Bad dates"), channels: ["X"], start: "2026-12-10", end: "2026-12-01" })));
  await t.as(employee, (ctx) =>
    marketing.updateCampaign(ctx, {
      campaignId: k1.id,
      stage: "running",
      spent: 9000,
      metrics: {
        Instagram: { reach: 50000, results: 1000, conversions: 40, spend: 6000 },
        TikTok: { reach: 90000, results: 1500, conversions: 30, spend: 3000 },
      },
    }),
  );
  await t.as(employee, (ctx) => marketing.createCampaign(ctx, { clientId: other.id, name: L("Other launch"), channels: ["Instagram"] }));

  const budgets = await t.as(owner, (ctx) => marketing.getClientBudgets(ctx, companyId));
  assert.deepEqual(budgets.find((b) => b.clientId === bakery.id), { clientId: bakery.id, allocated: 0, spent: 9000 });
  assert.deepEqual(budgets.find((b) => b.clientId === other.id), { clientId: other.id, allocated: 5000, spent: 0 });

  const stats = await t.as(owner, (ctx) => marketing.getChannelStats(ctx, companyId));
  const ig = stats.find((s) => s.platform === "Instagram")!;
  assert.deepEqual(ig, { platform: "Instagram", campaigns: 2, reach: 50000, costPerResult: 6, conversion: 4, spendShare: 0.667 });
  assert.equal(stats[0].platform, "Instagram", "sorted by spend share");

  // The portal visitor of the bakery: reads the bakery's campaigns and accounts, nothing else, and cannot change them
  const mine = await t.as(visitor, (ctx) => marketing.listCampaigns(ctx, { clientId: bakery.id }));
  assert.deepEqual(mine.map((k) => k.name.en), ["Ramadan reels"]);
  assert.deepEqual(await t.as(visitor, (ctx) => marketing.listCampaigns(ctx, { clientId: other.id })), []);
  assert.equal((await t.as(visitor, (ctx) => marketing.listSocialAccounts(ctx, { clientId: bakery.id }))).length, 1);
  await failsWith("forbidden", t.as(visitor, (ctx) => marketing.updateCampaign(ctx, { campaignId: k1.id, spent: 1 })));
  await failsWith("forbidden", t.as(visitor, (ctx) => marketing.createCampaign(ctx, { clientId: bakery.id, name: L("x"), channels: ["X"] })));

  const done = await t.as(employee, (ctx) => marketing.updateCampaign(ctx, { campaignId: k1.id, stage: "done" }));
  assert.equal(done.progress, 1, "finishing a campaign completes its progress");
  const log = await t.as(owner, (ctx) => events.listEvents(ctx, companyId, { type: ["campaign.created", "campaign.running", "campaign.done"] }));
  assert.equal(log.length, 4);
});

test("automated flows: create, from template, enable/disable, runs and stats", async () => {
  const flow = await t.as(employee, (ctx) =>
    automation.createFlow(ctx, {
      companyId,
      name: L("Escalate late approvals"),
      trigger: L("An approval waits 24 hours"),
      condition: L("Priority is high"),
      action: L("Remind and escalate"),
      triggerEvent: "operation.started",
    }),
  );
  assert.deepEqual([flow.enabled, flow.runs, flow.lastRun.ar], [true, 0, "لسه ما اشتغلش"]);

  const fromTemplate = await t.as(owner, (ctx) => automation.createFlowFromTemplate(ctx, { companyId, templateId: "t1" }));
  assert.deepEqual([fromTemplate.templateId, fromTemplate.triggerEvent, fromTemplate.name.en], ["t1", "member.invited", "New employee onboarding"]);
  await failsWith("not_found", t.as(owner, (ctx) => automation.createFlowFromTemplate(ctx, { companyId, templateId: "nope" })));

  const ran = await t.as(employee, (ctx) => automation.recordFlowRun(ctx, { flowId: flow.id, result: "2 reminders sent" }));
  assert.deepEqual([ran.runs, ran.lastRun.en], [1, "Just now"]);
  await t.as(employee, (ctx) => automation.updateFlow(ctx, { flowId: flow.id, enabled: false }));
  await failsWith("invalid", t.as(employee, (ctx) => automation.recordFlowRun(ctx, { flowId: flow.id })));

  const listed = await t.as(owner, (ctx) => automation.listFlows(ctx, companyId));
  assert.equal(listed.length, 2);
  assert.deepEqual(await t.as(outsider, (ctx) => automation.listFlows(ctx, companyId)), [], "other companies see no flows");
  await failsWith("not_found", t.as(outsider, (ctx) => automation.updateFlow(ctx, { flowId: flow.id, enabled: true })));

  const stats = await t.as(owner, (ctx) => automation.getAutomationStats(ctx, companyId));
  const automationEvents = await t.as(owner, (ctx) => events.listEvents(ctx, companyId, { source: "automation" }));
  assert.ok(automationEvents.some((e) => e.type === "automation.flow_ran"), "the recorded run is logged as an automation event");
  assert.equal(stats.perWeek, automationEvents.length, "perWeek counts this week's automation events (flow runs, agent results)");
  assert.equal(stats.hoursSaved, 0, "1 run × 5 min rounds to 0 hours");
  assert.equal(typeof stats.automationRate, "number");
  await failsWith("forbidden", t.as(outsider, (ctx) => automation.getAutomationStats(ctx, companyId)));
});

test("tasks: create, assign inside the company only, move to done, delete rules", async () => {
  const mine = await t.as(employee, (ctx) => operations.createTask(ctx, { companyId, title: "Count the stock", dueDate: "2026-10-20", priority: "high" }));
  assert.deepEqual([mine.assigneeId, mine.status, mine.priority], [employeeMemberId, "todo", "high"], "defaults to the creator, to do");

  const forOwner = await t.as(employee, (ctx) => operations.createTask(ctx, { companyId, title: "Sign the contract", assigneeId: ownerMemberId }));
  assert.equal(forOwner.assigneeId, ownerMemberId);

  // A member of another company cannot be the assignee
  const otherBoss = user("boss@other-tasks.test");
  await t.as(otherBoss, ({ tx }) =>
    tx.execute(sql`select public.create_company('other-tasks', 'OTASK1', ${JSON.stringify(L("Other"))}::jsonb, ${JSON.stringify(L("Other boss"))}::jsonb)`),
  );
  const otherOwnerId = (await t.as(otherBoss, (ctx) => hq.getCompanyBySlug(ctx, "other-tasks")))!.me.id;
  await failsWith("invalid", t.as(employee, (ctx) => operations.createTask(ctx, { companyId, title: "x", assigneeId: otherOwnerId })));

  const done = await t.as(employee, (ctx) => operations.updateTask(ctx, { taskId: mine.id, status: "done" }));
  assert.equal(done.status, "done");
  const log = await t.as(owner, (ctx) => events.listEvents(ctx, companyId, { type: ["task.created", "task.completed"] }));
  assert.deepEqual(log.map((e) => e.type).sort(), ["task.completed", "task.created", "task.created"]);

  assert.equal((await t.as(owner, (ctx) => operations.listTasks(ctx, companyId))).length, 2);
  assert.deepEqual((await t.as(owner, (ctx) => operations.listTasks(ctx, companyId, ownerMemberId))).map((x) => x.title), ["Sign the contract"]);
  assert.deepEqual(await t.as(outsider, (ctx) => operations.listTasks(ctx, companyId)), [], "other companies see no tasks");

  // An employee who neither created nor owns a task cannot delete it; the owner (admin) can
  const ownersOwn = await t.as(owner, (ctx) => operations.createTask(ctx, { companyId, title: "Owner only" }));
  await failsWith("forbidden", t.as(employee, (ctx) => operations.deleteTask(ctx, { taskId: ownersOwn.id })));
  await t.as(owner, (ctx) => operations.deleteTask(ctx, { taskId: ownersOwn.id }));
  await t.as(employee, (ctx) => operations.deleteTask(ctx, { taskId: mine.id }));
  assert.equal((await t.as(owner, (ctx) => operations.listTasks(ctx, companyId))).length, 1);
});
