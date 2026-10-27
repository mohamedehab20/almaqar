/** Client portal access: the company chooses per client what the portal shows; the database enforces it. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { defaultAccess } from "../../src/modules/clients/access";
import * as clients from "../../src/modules/clients/service";
import * as marketing from "../../src/modules/marketing/service";
import * as profit from "../../src/modules/profitability/service";
import * as automation from "../../src/modules/automation/service";
import * as rec from "../../src/modules/recruitment/service";
import { toErrorCode } from "../../src/server/errors";
import { createTestDb, L, user } from "./setup";

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@portal.test");
const buyer = user("buyer@portal.test");
const guest = user("guest@portal.test");
const supplier = user("supplier@portal.test");
const applicant = user("applicant@portal.test");
let companyId = "";
const ids: Record<string, string> = {};

const codeOf = async (clientId: string) => (await t.pg.query<{ invite_code: string }>("SELECT invite_code FROM clients WHERE id = $1", [clientId])).rows[0].invite_code;
const brief = (clientId: string) => ({ clientId, type: "shortVideo" as const, objective: L("Launch"), audience: L("Youth"), details: L("30s"), budget: 500 });

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('portal', 'PORT1', ${JSON.stringify(L("Co"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
  ids.client = await t.as(owner, (ctx) => clients.createPortalClient(ctx, { companyId, name: "Acme", room: "sales" }));
  ids.visitor = await t.as(owner, (ctx) => clients.createPortalClient(ctx, { companyId, name: "Mr. Visitor", kind: "visitor" }));
  for (const [who, id] of [
    [buyer, ids.client],
    [guest, ids.visitor],
  ] as const) {
    const code = await codeOf(id);
    await t.as(who, ({ tx }) => tx.execute(sql`select public.redeem_client_invite(${code})`));
  }
  await t.as(owner, (ctx) => profit.createInvoice(ctx, { clientId: ids.client, period: "2026-10", amount: 1500, issuedOn: "2026-10-01", dueOn: "2026-10-15" }));
  await t.as(owner, (ctx) => clients.bookClientMeeting(ctx, { clientId: ids.visitor, startsAt: "2026-12-01T08:00:00Z", durationMinutes: 30 }));
});

test("defaults: a client gets the whole portal, a meeting visitor only meetings", async () => {
  assert.deepEqual(defaultAccess("visitor"), ["meetings"]);
  const data = await t.as(owner, (ctx) => clients.getClientPortalData(ctx, companyId));
  assert.deepEqual(data.clients.find((c) => c.id === ids.client)!.portalAccess, ["briefs", "invoices", "meetings", "files"]);
  assert.deepEqual(data.clients.find((c) => c.id === ids.visitor)!.portalAccess, ["meetings"]);
  assert.equal(data.canMoney, true);
  assert.equal(data.invoices.length, 1);
});

test("the client's portal shows what is allowed, the visitor's only their meetings", async () => {
  const mine = await t.as(buyer, (ctx) => clients.getMyPortal(ctx));
  assert.deepEqual([mine!.client.id, mine!.invoices.length, mine!.invoices[0].amount], [ids.client, 1, 1500]);
  const visitor = await t.as(guest, (ctx) => clients.getMyPortal(ctx));
  assert.deepEqual([visitor!.access, visitor!.meetings.length, visitor!.invoices.length, visitor!.briefs.length], [["meetings"], 1, 0, 0]);
});

test("the company turns parts off: hidden in the portal and refused by the database", async () => {
  await t.as(owner, (ctx) => clients.updatePortalClient(ctx, { clientId: ids.client, portalAccess: ["meetings"] }));
  const mine = await t.as(buyer, (ctx) => clients.getMyPortal(ctx));
  assert.deepEqual([mine!.access, mine!.invoices.length, mine!.briefs.length], [["meetings"], 0, 0]);
  // Even called directly, the readers and RLS say no
  assert.equal((await t.sqlAs(buyer.sub, "select * from private.portal_invoices($1)", [ids.client])).length, 0);
  await assert.rejects(t.as(buyer, (ctx) => marketing.sendBrief(ctx, brief(ids.client))));
  await t.as(owner, (ctx) => clients.updatePortalClient(ctx, { clientId: ids.client, portalAccess: ["briefs", "invoices"] }));
  await t.as(buyer, (ctx) => marketing.sendBrief(ctx, brief(ids.client)));
  assert.equal((await t.as(buyer, (ctx) => clients.getMyPortal(ctx)))!.briefs.length, 1);
});

test("a portal user never reads another client's invoices or meetings, and unknown parts are refused", async () => {
  assert.equal((await t.sqlAs(guest.sub, "select * from private.portal_invoices($1)", [ids.client])).length, 0);
  assert.equal((await t.sqlAs(buyer.sub, "select * from private.portal_meetings($1)", [ids.visitor])).length, 0);
  await assert.rejects(t.pg.query("UPDATE clients SET portal_access = '{payments}' WHERE id = $1", [ids.client]));
});

test("an operation follower sees their operation's steps; a candidate their stage; both reach only their own", async () => {
  const ownerId = (await t.as(owner, (c) => clients.getClientPortalData(c, companyId))).members[0].id;
  const wf = await t.as(owner, (ctx) => automation.createWorkflow(ctx, { companyId, name: L("Fit-out"), steps: [{ title: L("Quote"), assigneeId: ownerId }, { title: L("Build"), assigneeId: ownerId }] }));
  const run = await t.as(owner, (ctx) => automation.startOperation(ctx, { companyId, subject: L("Lobby finishing"), workflowId: wf.id }));
  const job = await t.as(owner, (ctx) => rec.createJob(ctx, { companyId, title: "Designer" }));
  const cand = await t.as(owner, (ctx) => rec.addCandidate(ctx, { companyId, jobId: job.id, name: "Mariam" }));

  // The link is required and must be this company's
  const failsWith = async (code: string, p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return assert.equal(toErrorCode(e), code);
    }
    assert.fail("expected " + code);
  };
  await failsWith("invalid", t.as(owner, (ctx) => clients.createPortalClient(ctx, { companyId, name: "No link", kind: "operation" })));

  const opId = await t.as(owner, (ctx) => clients.createPortalClient(ctx, { companyId, name: "Contractor", kind: "operation", runId: run.id }));
  await failsWith("invalid", t.as(owner, (ctx) => clients.createPortalClient(ctx, { companyId, name: "Both", kind: "operation", runId: run.id, room: "marketing" })));
  const candId = await t.as(owner, (ctx) => clients.createPortalClient(ctx, { companyId, name: "Mariam", kind: "candidate", candidateId: cand.id }));
  const data = await t.as(owner, (ctx) => clients.getClientPortalData(ctx, companyId));
  const op = data.clients.find((c) => c.id === opId)!;
  assert.deepEqual([op.kind, op.runId, op.room, op.portalAccess], ["operation", run.id, null, ["meetings", "operation"]], "no room, defaults for the kind");
  assert.deepEqual(data.clients.find((c) => c.id === candId)!.portalAccess, ["meetings", "application"]);

  for (const [who, id] of [
    [supplier, opId],
    [applicant, candId],
  ] as const) {
    const code = await codeOf(id);
    await t.as(who, ({ tx }) => tx.execute(sql`select public.redeem_client_invite(${code})`));
  }
  const mine = await t.as(supplier, (ctx) => clients.getMyPortal(ctx));
  assert.deepEqual([mine!.client.kind, mine!.operation?.code, mine!.operation?.currentStep, mine!.operation?.steps.length], ["operation", run.code, 1, 2]);
  assert.equal(mine!.application, null);
  const app = await t.as(applicant, (ctx) => clients.getMyPortal(ctx));
  assert.deepEqual([app!.application?.jobTitle, app!.application?.stage], ["Designer", "applied"]);
  // Not each other's
  assert.equal((await t.sqlAs(supplier.sub, "select * from private.portal_application($1)", [candId])).length, 0);
  assert.equal((await t.sqlAs(applicant.sub, "select * from private.portal_operation($1)", [opId])).length, 0);
  // Turned off by the company → gone
  await t.as(owner, (ctx) => clients.updatePortalClient(ctx, { clientId: opId, portalAccess: ["meetings"] }));
  assert.equal((await t.as(supplier, (ctx) => clients.getMyPortal(ctx)))!.operation, null);
});

test("the client portal is its own room (clients.view) for Admin and Employee; marketing lists only real clients", async () => {
  const marketing = await import("../../src/modules/marketing/service");
  const list = await t.as(owner, (ctx) => marketing.listClients(ctx, companyId));
  assert.ok(!list.some((c) => c.id === ids.visitor), "the meeting visitor is not a marketing client");
  const keys = await t.pg.query<{ system_key: string; n: number }>(
    "SELECT r.system_key, count(*)::int n FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE rp.permission = 'clients.view' AND r.company_id = $1 GROUP BY 1 ORDER BY 1",
    [companyId],
  );
  assert.deepEqual(keys.rows.map((r) => r.system_key), ["admin", "employee"]);
});
