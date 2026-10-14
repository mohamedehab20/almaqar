/** «إدارة الأقسام»: HQ rooms on / off with a manager, and company departments with a manager and an active flag. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import * as departments from "../../src/modules/departments/service";
import * as hq from "../../src/modules/hq/service";
import * as permissions from "../../src/modules/permissions/service";
import { demoDepartmentsData } from "../../src/modules/departments/demo";
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
const owner = user("owner@dept.test");
const admin = user("admin@dept.test");
const staff = user("staff@dept.test");
const outsider = user("outsider@dept.test");
let companyId = "";
let otherCompanyId = "";
const ids: Record<string, string> = {};

const newCompany = (who: typeof owner, slug: string, code: string) =>
  t.as(who, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company(${slug}, ${code}, ${JSON.stringify(L("Co"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });

before(async () => {
  t = await createTestDb();
  companyId = await newCompany(owner, "dept", "DEPT1");
  otherCompanyId = await newCompany(outsider, "other", "OTHR1");
  await t.pg.query("UPDATE companies SET plan = 'pro'");
  const adminRole = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).roles.find((r) => r.systemKey === "admin")!.id;
  ids.admin = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: admin.email!, name: L("Admin"), roleId: adminRole }))).id;
  ids.staff = (await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: staff.email!, name: L("Staff") }))).id;
  for (const who of [admin, staff]) await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
  ids.outsider = (await t.as(outsider, (ctx) => hq.listMembers(ctx, otherCompanyId)))[0].id;
});

test("demo: every built room on, coming-soon rooms off, managers set", () => {
  const demo = demoDepartmentsData();
  assert.ok(demo.rooms.every((r) => r.enabled === !r.soon));
  assert.ok(demo.rooms.find((r) => r.key === "hr")!.managerId);
  assert.ok(demo.departments.every((d) => d.managerId && d.memberCount > 0));
});

test("rooms: turned off for the company, a manager per room; coming-soon rooms stay off", async () => {
  const before = await t.as(staff, (ctx) => departments.getDepartmentsData(ctx, companyId));
  assert.equal(before.canRooms, false);
  assert.ok(before.rooms.find((r) => r.key === "marketing")!.enabled, "on by default");

  await t.as(admin, (ctx) => departments.setRoom(ctx, { companyId, room: "marketing", enabled: false, managerId: ids.staff }));
  assert.deepEqual(await t.as(staff, (ctx) => departments.disabledRooms(ctx, companyId)), ["marketing"]);
  const after = await t.as(owner, (ctx) => departments.getDepartmentsData(ctx, companyId));
  assert.deepEqual(after.rooms.find((r) => r.key === "marketing"), { key: "marketing", soon: false, locked: false, enabled: false, managerId: ids.staff });

  // Changing the manager keeps the room off
  await t.as(owner, (ctx) => departments.setRoom(ctx, { companyId, room: "marketing", managerId: null }));
  assert.deepEqual(await t.as(owner, (ctx) => departments.disabledRooms(ctx, companyId)), ["marketing"]);
  await t.as(owner, (ctx) => departments.setRoom(ctx, { companyId, room: "marketing", enabled: true }));
  assert.deepEqual(await t.as(owner, (ctx) => departments.disabledRooms(ctx, companyId)), []);

  await failsWith("invalid", t.as(owner, (ctx) => departments.setRoom(ctx, { companyId, room: "sales", enabled: true })));
  // HR holds this page: it cannot be turned off, and an old "off" row is ignored
  await failsWith("invalid", t.as(owner, (ctx) => departments.setRoom(ctx, { companyId, room: "hr", enabled: false })));
  await t.pg.query("INSERT INTO company_rooms (company_id, room, enabled) VALUES ($1, $2, false)", [companyId, "hr"]);
  assert.deepEqual(await t.as(owner, (ctx) => departments.disabledRooms(ctx, companyId)), []);
  assert.equal((await t.as(owner, (ctx) => departments.getDepartmentsData(ctx, companyId))).rooms.find((r) => r.key === "hr")!.enabled, true);
  await t.as(owner, (ctx) => departments.setRoom(ctx, { companyId, room: "sales", managerId: ids.admin }));
  await failsWith("invalid", t.as(owner, (ctx) => departments.setRoom(ctx, { companyId, room: "hr", managerId: ids.outsider })));
  await failsWith("forbidden", t.as(staff, (ctx) => departments.setRoom(ctx, { companyId, room: "hr", enabled: false })));
  await assert.rejects(t.sqlAs(staff.sub, "INSERT INTO company_rooms (company_id, room, enabled) VALUES ($1, 'hr', false)", [companyId]));
  await assert.rejects(t.sqlAs(owner.sub, "INSERT INTO company_rooms (company_id, room, manager_id) VALUES ($1, 'operations', $2)", [companyId, ids.outsider]));
});

test("departments: manager, stop / restart, delete; only with departments.manage", async () => {
  await failsWith("forbidden", t.as(staff, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Design") })));
  await assert.rejects(t.sqlAs(staff.sub, "INSERT INTO departments (company_id, name) VALUES ($1, '{\"ar\":\"x\",\"en\":\"x\"}')", [companyId]), "no longer open to every member");

  const design = await t.as(admin, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Design"), color: "violet", managerId: ids.staff }));
  assert.deepEqual([design.active, design.managerId], [true, ids.staff]);
  await failsWith("invalid", t.as(admin, (ctx) => hq.updateDepartment(ctx, { companyId, departmentId: design.id, managerId: ids.outsider })));

  const stopped = await t.as(admin, (ctx) => hq.updateDepartment(ctx, { companyId, departmentId: design.id, active: false, managerId: null }));
  assert.deepEqual([stopped.active, stopped.managerId, stopped.color], [false, null, "violet"], "other fields untouched");
  await t.as(owner, (ctx) => hq.updateMember(ctx, { companyId, memberId: ids.staff, departmentId: design.id }));
  const data = await t.as(staff, (ctx) => departments.getDepartmentsData(ctx, companyId));
  assert.equal(data.canDepartments, false);
  assert.deepEqual(data.departments.map((d) => [d.name.en, d.active, d.memberCount]), [["Design", false, 1]]);

  await t.as(owner, (ctx) => hq.deleteDepartment(ctx, { companyId, departmentId: design.id }));
  const [member] = (await t.as(owner, (ctx) => hq.listMembers(ctx, companyId))).filter((m) => m.id === ids.staff);
  assert.equal(member.departmentId, "", "the employee stays, without a department");
});
