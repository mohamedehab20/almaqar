/** Owner-defined permissions: roles, per-member exceptions, department scopes, and the services that check them. */
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sql } from "drizzle-orm";
import { toErrorCode } from "../../src/server/errors";
import { getMyPermissions, hasPermission } from "../../src/server/permissions";
import * as hq from "../../src/modules/hq/service";
import * as sales from "../../src/modules/sales/service";
import * as operations from "../../src/modules/operations/service";
import * as permissions from "../../src/modules/permissions/service";
import { EMPLOYEE_DEFAULTS, PERMISSION_KEYS } from "../../src/modules/permissions/catalog";
import { createTestDb, L, user } from "./setup";

let t: Awaited<ReturnType<typeof createTestDb>>;
const owner = user("owner@perm.test");
const manager = user("manager@perm.test"); // Admin role
const eman = user("eman@perm.test"); // Employee role, in Sales
const omar = user("omar@perm.test"); // Employee role, in Support
let companyId = "";
let salesDept = "";
let supportDept = "";
const ids: Record<string, string> = {};
let adminRole = "";
let employeeRole = "";

const failsWith = async (expected: string, p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return assert.equal(toErrorCode(e), expected);
  }
  assert.fail(`expected ${expected}`);
};

before(async () => {
  t = await createTestDb();
  companyId = await t.as(owner, async ({ tx }) => {
    const res = await tx.execute(sql`select public.create_company('perm', 'PERM1', ${JSON.stringify(L("Perm"))}::jsonb, ${JSON.stringify(L("Owner"))}::jsonb) as id`);
    return (res as unknown as { rows: { id: string }[] }).rows[0].id;
  });
  await t.pg.query("UPDATE companies SET plan = 'pro' WHERE id = $1", [companyId]);
  salesDept = (await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Sales") }))).id;
  supportDept = (await t.as(owner, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Support") }))).id;
  const overview = await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId));
  adminRole = overview.roles.find((r) => r.systemKey === "admin")!.id;
  employeeRole = overview.roles.find((r) => r.systemKey === "employee")!.id;

  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: manager.email!, name: L("Manager"), roleId: adminRole }));
  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: eman.email!, name: L("Eman"), departmentId: salesDept }));
  await t.as(owner, (ctx) => hq.inviteMember(ctx, { companyId, email: omar.email!, name: L("Omar"), departmentId: supportDept }));
  for (const [name, who] of Object.entries({ manager, eman, omar })) {
    await t.as(who, ({ tx }) => tx.execute(sql`select public.claim_invites()`));
    ids[name] = (await t.as(who, (ctx) => hq.setMyStatus(ctx, { companyId, status: "available" }))).id;
  }
});

test("the database knows exactly the catalog's permissions", async () => {
  const rows = await t.pg.query<{ k: string[] }>("SELECT private.permission_keys() AS k");
  assert.deepEqual([...rows.rows[0].k].sort(), [...PERMISSION_KEYS].sort());
  const emp = await t.pg.query<{ k: string[] }>("SELECT private.employee_default_permissions() AS k");
  assert.deepEqual([...emp.rows[0].k].sort(), [...EMPLOYEE_DEFAULTS].sort());
});

test("a new company gets an Admin role with everything and an Employee role with the defaults", async () => {
  const overview = await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId));
  assert.deepEqual(overview.roles.map((r) => r.systemKey), ["admin", "employee"]);
  const admin = overview.roles[0];
  const employee = overview.roles[1];
  assert.equal(admin.permissions.length, PERMISSION_KEYS.length);
  assert.deepEqual(employee.permissions.map((p) => p.key).sort(), [...EMPLOYEE_DEFAULTS].sort());
  // Invited without a role → the default Employee role
  assert.equal(overview.members.find((m) => m.id === ids.eman)?.roleId, employeeRole);
  assert.equal(admin.memberCount, 1);
});

test("Admin keeps what admins could do; the Employee role cannot manage", async () => {
  const added = await t.as(manager, (ctx) => hq.inviteMember(ctx, { companyId, email: "new@perm.test", name: L("New"), departmentId: supportDept }));
  await t.as(manager, (ctx) => hq.removeMember(ctx, { companyId, memberId: added.id }));
  await failsWith("forbidden", t.as(eman, (ctx) => hq.inviteMember(ctx, { companyId, email: "x@perm.test", name: L("X") })));
  await failsWith("forbidden", t.as(eman, (ctx) => hq.createDepartment(ctx, { companyId, name: L("Nope") })));
  await failsWith("forbidden", t.as(eman, (ctx) => sales.createSupplier(ctx, { companyId, name: L("Nope") })));
  // Choosing roles stays with the owner, even for an Admin
  await failsWith("forbidden", t.as(manager, (ctx) => hq.inviteMember(ctx, { companyId, email: "y@perm.test", name: L("Y"), roleId: adminRole })));
  await failsWith("forbidden", t.as(manager, (ctx) => hq.updateMember(ctx, { companyId, memberId: ids.eman, roleId: adminRole })));
});

test("only the owner manages roles and exceptions", async () => {
  await failsWith("forbidden", t.as(manager, (ctx) => permissions.createRole(ctx, { companyId, name: L("Sneaky") })));
  await failsWith("forbidden", t.as(manager, (ctx) => permissions.setRolePermissions(ctx, { roleId: adminRole, permissions: [] })));
  await failsWith("forbidden", t.as(manager, (ctx) => permissions.assignRole(ctx, { memberId: ids.eman, roleId: adminRole })));
  await failsWith("forbidden", t.as(eman, (ctx) => permissions.setMemberOverrides(ctx, { memberId: ids.eman, overrides: [{ key: "orders.approve", effect: "grant", departmentIds: null }] })));
  await failsWith("forbidden", t.as(manager, (ctx) => permissions.getPermissionsOverview(ctx, companyId)));
  // Not even with raw SQL (RLS)
  await assert.rejects(t.sqlAs(manager.sub, "INSERT INTO roles (company_id, name) VALUES ($1, $2)", [companyId, JSON.stringify(L("x"))]));
  await assert.rejects(t.sqlAs(eman.sub, "INSERT INTO member_permission_overrides (member_id, permission, effect) VALUES ($1, 'company.settings', 'grant')", [ids.eman]));
  // System roles cannot be deleted, unknown permissions are rejected
  await failsWith("invalid", t.as(owner, (ctx) => permissions.deleteRole(ctx, { roleId: employeeRole })));
  await failsWith("invalid", t.as(owner, (ctx) => permissions.setRolePermissions(ctx, { roleId: employeeRole, permissions: [{ key: "root.everything" as never, departmentIds: null }] })));
});

test("order: owner → deny → grant → role, and the effective list follows", async () => {
  const check = (who: typeof eman, key: Parameters<typeof hasPermission>[2], dept?: string | null) =>
    t.as(who, (ctx) => hasPermission(ctx, companyId, key, dept));
  assert.equal(await check(owner, "company.settings"), true, "owner has everything");
  assert.equal(await check(eman, "orders.create"), true, "from the Employee role");
  assert.equal(await check(eman, "suppliers.manage"), false);

  await t.as(owner, (ctx) =>
    permissions.setMemberOverrides(ctx, {
      memberId: ids.eman,
      overrides: [
        { key: "suppliers.manage", effect: "grant", departmentIds: null },
        { key: "orders.create", effect: "deny", departmentIds: null },
      ],
    }),
  );
  assert.equal(await check(eman, "suppliers.manage"), true, "a grant adds to the role");
  assert.equal(await check(eman, "orders.create"), false, "a deny beats the role");
  await failsWith("forbidden", t.as(eman, (ctx) => sales.createOrder(ctx, { companyId, type: "sale", partyId: crypto.randomUUID(), items: [] })));
  const supplier = await t.as(eman, (ctx) => sales.createSupplier(ctx, { companyId, name: L("Granted") }));
  assert.ok(supplier.id);

  const mine = await t.as(eman, (ctx) => getMyPermissions(ctx, companyId));
  assert.equal(mine.owner, false);
  assert.equal(mine.scopes["suppliers.manage"], "all");
  assert.equal(mine.scopes["orders.create"], undefined);
  assert.equal(mine.scopes["hr.view"], "all");

  await t.as(owner, (ctx) => permissions.setMemberOverrides(ctx, { memberId: ids.eman, overrides: [] }));
  assert.equal(await check(eman, "orders.create"), true, "clearing the exceptions restores the role");
});

test("department scopes: a role that manages only Sales members", async () => {
  const lead = await t.as(owner, (ctx) => permissions.createRole(ctx, { companyId, name: L("Sales lead"), copyFromRoleId: employeeRole }));
  const base = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).roles.find((r) => r.id === lead.id)!.permissions;
  assert.equal(base.length, EMPLOYEE_DEFAULTS.length, "copied from Employee");
  await t.as(owner, (ctx) =>
    permissions.setRolePermissions(ctx, {
      roleId: lead.id,
      permissions: [
        ...base,
        { key: "members.invite", departmentIds: [salesDept] },
        { key: "members.edit", departmentIds: [salesDept] },
        { key: "tasks.manage", departmentIds: [salesDept] },
        // Not a scoped permission: the scope is dropped
        { key: "suppliers.manage", departmentIds: [salesDept] },
      ],
    }),
  );
  const saved = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).roles.find((r) => r.id === lead.id)!;
  assert.equal(saved.permissions.find((p) => p.key === "suppliers.manage")?.departmentIds, null);
  await failsWith("invalid", t.as(owner, (ctx) => permissions.setRolePermissions(ctx, { roleId: lead.id, permissions: [{ key: "members.edit", departmentIds: [crypto.randomUUID()] }] })));

  await t.as(owner, (ctx) => permissions.assignRole(ctx, { memberId: ids.eman, roleId: lead.id }));
  const added = await t.as(eman, (ctx) => hq.inviteMember(ctx, { companyId, email: "rep@perm.test", name: L("Rep"), departmentId: salesDept }));
  assert.equal(added.roleId, employeeRole, "added with the default role");
  await failsWith("forbidden", t.as(eman, (ctx) => hq.inviteMember(ctx, { companyId, email: "sup@perm.test", name: L("Sup"), departmentId: supportDept })));
  await failsWith("forbidden", t.as(eman, (ctx) => hq.inviteMember(ctx, { companyId, email: "none@perm.test", name: L("None") })));
  await t.as(eman, (ctx) => hq.updateMember(ctx, { companyId, memberId: added.id, title: L("Sales rep") }));
  await failsWith("forbidden", t.as(eman, (ctx) => hq.updateMember(ctx, { companyId, memberId: ids.omar, title: L("x") })));
  await failsWith("forbidden", t.as(eman, (ctx) => hq.updateMember(ctx, { companyId, memberId: added.id, departmentId: supportDept }))); // cannot move someone out of their scope
  // Raw SQL is held to the same scope (RLS: the row is not updatable)
  assert.equal((await t.sqlAs(eman.sub, "UPDATE members SET title = $2 WHERE id = $1 RETURNING id", [ids.omar, JSON.stringify(L("x"))])).length, 0);

  const mine = await t.as(eman, (ctx) => getMyPermissions(ctx, companyId));
  assert.deepEqual(mine.scopes["members.invite"], [salesDept]);

  // Tasks: manages Sales people's tasks, not Support's
  const repTask = await t.as(owner, (ctx) => operations.createTask(ctx, { companyId, title: "Call client", assigneeId: ids.manager }));
  await failsWith("forbidden", t.as(eman, (ctx) => operations.updateTask(ctx, { taskId: repTask.id, status: "done" }))); // the manager has no department yet
  const omarTask = await t.as(owner, (ctx) => operations.createTask(ctx, { companyId, title: "Fix ticket", assigneeId: ids.omar }));
  await failsWith("forbidden", t.as(eman, (ctx) => operations.deleteTask(ctx, { taskId: omarTask.id })));
  await t.as(owner, (ctx) => hq.updateMember(ctx, { companyId, memberId: ids.manager, departmentId: salesDept }));
  const done = await t.as(eman, (ctx) => operations.updateTask(ctx, { taskId: repTask.id, status: "done" }));
  assert.equal(done.status, "done");

  // Deleting the custom role puts its members back on Employee
  await t.as(owner, (ctx) => permissions.deleteRole(ctx, { roleId: lead.id }));
  const after = await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId));
  assert.equal(after.members.find((m) => m.id === ids.eman)?.roleId, employeeRole);
});

test("a member without a role has no permissions, and the owner cannot be re-roled", async () => {
  await t.as(owner, (ctx) => permissions.assignRole(ctx, { memberId: ids.omar, roleId: null }));
  assert.equal(await t.as(omar, (ctx) => hasPermission(ctx, companyId, "operations.view")), false);
  await failsWith("forbidden", t.as(omar, (ctx) => operations.createNote(ctx, { companyId, text: "hi", audience: { type: "company" } })));
  const ownerId = (await t.as(owner, (ctx) => permissions.getPermissionsOverview(ctx, companyId))).members.find((m) => m.isOwner)!.id;
  await failsWith("invalid", t.as(owner, (ctx) => permissions.assignRole(ctx, { memberId: ownerId, roleId: employeeRole })));
});
