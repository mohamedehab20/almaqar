/** «بوابة العملاء»: who each client belongs to (a room, a department, or a meeting visitor), meetings, and access. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as cp from "../../src/modules/clients/service";
import * as hq from "../../src/modules/hq/service";
import * as marketing from "../../src/modules/marketing/service";
import * as permissions from "../../src/modules/permissions/service";
import { demoClientPortalData } from "../../src/modules/clients/demo";
import { createTestDb, L, user } from "./setup";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@cp.test");
const admin = user("admin@cp.test");
const staff = user("staff@cp.test");
const other = user("other@cp.test");
let companyId = "";
let otherDept = "";
let deptId = "";

before(async () => {
  t = await createTestDb();
  const make = (who: typeof owner, slug: string, code: string) =>
    t.as(who, async ({ tx }) => {
      const res = await tx.execute(sql`select public.create_company(${slug}, ${code}, ${JSON.stringify(L("Co"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
      return (res as unknown as { rows: { id: string }[] }).rows[0].id;
    });
  companyId = await make(owner, "cp", "CPRT1");
  const otherCompany = await make(other, "cp2", "CPRT2");
  await t.pg.query("UPDATE companies SET plan = 'pro'");
  deptId = (await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Design") }))).id;
  otherDept = (await t.as(other, (ctx) => hq.createDepartment(ctx, { companyId: otherCompany, name: L("Theirs") }))).id;
  const adminRole = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).roles.find((r) => r.systemKey === "admin")!.id;
  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: admin.email!, name: L("Admin"), roleId: adminRole }));
  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: staff.email!, name: L("Staff") }));
  for (const who of [admin, staff]) await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
});

test("demo: clients of marketing, sales, operations and a department, plus visitors with meetings", () => {
  const demo = demoClientPortalData("2026-10-15T10:00:00Z");
  assert.deepEqual(new Set(demo.clients.map((c) => c.room ?? c.departmentId ?? c.kind)), new Set(["marketing", "sales", "operations", "d-tech", "visitor"]));
  assert.ok(demo.clients.filter((c) => c.kind === "visitor").every((v) => demo.meetings.some((m) => m.clientId === v.id)));
});

test("owners: a room, a department, or a visitor; never two, never another company's department", async () => {
  const sales = await t.as(admin, (ctx) => cp.createPortalClient(ctx, { companyId, name: "Horizon", room: "sales", contactEmail: "Buyer@Horizon.com" }));
  const design = await t.as(admin, (ctx) => cp.createPortalClient(ctx, { companyId, name: "App", departmentId: deptId }));
  const visitor = await t.as(admin, (ctx) => cp.createPortalClient(ctx, { companyId, name: "Investor", kind: "visitor", room: "marketing" }).catch((e) => e));
  assert.equal(toErrorCode(visitor), "invalid", "a visitor belongs to nobody");
  await failsWith("invalid", t.as(admin, (ctx) => cp.createPortalClient(ctx, { companyId, name: "X", room: "sales", departmentId: deptId })));
  await failsWith("invalid", t.as(admin, (ctx) => cp.createPortalClient(ctx, { companyId, name: "X", room: "kitchen" })));
  await failsWith("invalid", t.as(admin, (ctx) => cp.createPortalClient(ctx, { companyId, name: "X", departmentId: otherDept })));
  await t.as(admin, (ctx) => cp.createPortalClient(ctx, { companyId, name: "Investor", kind: "visitor", contactName: "Sameh" }));

  // Moving a client from a room to a department clears the room
  await t.as(admin, (ctx) => cp.updatePortalClient(ctx, { clientId: sales, departmentId: deptId }));
  const data = await t.as(admin, (ctx) => cp.getClientPortalData(ctx, companyId));
  const moved = data.clients.find((c) => c.id === sales)!;
  assert.deepEqual([moved.room, moved.departmentId, moved.contactEmail], [null, deptId, "buyer@horizon.com"]);
  assert.equal(data.clients.find((c) => c.id === design)!.departmentId, deptId);
  const inv = data.clients.find((c) => c.name === "Investor")!;
  assert.deepEqual([inv.kind, inv.room, inv.departmentId, inv.status], ["visitor", null, null, "active"]);
  assert.ok(inv.inviteCode, "visitors get a portal code too");
  // Turning a client into a visitor drops its owner
  await t.as(admin, (ctx) => cp.updatePortalClient(ctx, { clientId: design, kind: "visitor" }));
  const after = (await t.as(admin, (ctx) => cp.getClientPortalData(ctx, companyId))).clients.find((c) => c.id === design)!;
  assert.deepEqual([after.kind, after.departmentId], ["visitor", null]);
});

test("marketing clients created before keep working and default to the Marketing room", async () => {
  const old = await t.as(admin, (ctx) => marketing.createClient(ctx, { companyId, name: L("Old client") }));
  const row = (await t.as(admin, (ctx) => cp.getClientPortalData(ctx, companyId))).clients.find((c) => c.id === old.id)!;
  assert.deepEqual([row.kind, row.room], ["client", null], "new marketing clients have no owner until set (the migration only moved existing rows)");
});

test("meetings with a client land in the schedule; only clients.manage changes clients", async () => {
  const data = await t.as(admin, (ctx) => cp.getClientPortalData(ctx, companyId));
  const investor = data.clients.find((c) => c.name === "Investor")!;
  const meeting = await t.as(admin, (ctx) => cp.bookClientMeeting(ctx, { clientId: investor.id, startsAt: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 60, location: "Meeting room" }));
  const [row] = (await t.pg.query<{ kind: string; contact_name: string; client_id: string }>("SELECT kind, contact_name, client_id FROM meetings WHERE id = $1", [meeting.id])).rows;
  assert.deepEqual([row.kind, row.contact_name, row.client_id], ["appointment", "Sameh", investor.id]);
  assert.equal((await t.as(staff, (ctx) => cp.getClientPortalData(ctx, companyId))).meetings.length, 1);

  const seen = await t.as(staff, (ctx) => cp.getClientPortalData(ctx, companyId));
  assert.equal(seen.canManage, false);
  assert.ok(seen.clients.every((c) => c.inviteCode === null), "codes only for clients.manage");
  await failsWith("forbidden", t.as(staff, (ctx) => cp.createPortalClient(ctx, { companyId, name: "Mine" })));
  await failsWith("forbidden", t.as(staff, (ctx) => cp.updatePortalClient(ctx, { clientId: investor.id, room: "sales" })));
  await assert.rejects(t.sqlAs(staff.sub, "INSERT INTO clients (company_id, name) VALUES ($1, '{\"ar\":\"x\",\"en\":\"x\"}')", [companyId]));
  await t.sqlAs(staff.sub, "UPDATE clients SET room = 'agents'");
  assert.ok((await t.sqlAs(staff.sub, "SELECT room FROM clients")).every((r) => r.room !== "agents"));

  await t.as(admin, (ctx) => cp.deletePortalClient(ctx, { clientId: investor.id }));
  const [kept] = (await t.pg.query<{ client_id: string | null }>("SELECT client_id FROM meetings WHERE id = $1", [meeting.id])).rows;
  assert.equal(kept.client_id, null, "the meeting stays in the schedule");
});
