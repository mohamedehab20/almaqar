import { and, asc, count, eq, inArray } from "drizzle-orm";
import { departments, memberPermissionOverrides, members, rolePermissions, roles, type Localized } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { assertDepartmentsInCompany } from "@/server/permissions";
import { emitEvent } from "@/modules/events/service";
import { PERMISSION_KEYS, SCOPED_KEYS, type PermissionKey } from "./catalog";

/** Managing permissions is owner-only (never grantable). */
async function requireOwner(ctx: Ctx, companyId: string) {
  const me = await requireMember(ctx, companyId);
  if (me.role !== "owner") throw new AppError("forbidden");
  return me;
}

export type PermissionGrant = { key: PermissionKey; departmentIds: string[] | null };
export type PermissionOverride = PermissionGrant & { effect: "grant" | "deny" };

/** Unknown keys are rejected; a department scope is kept only on permissions that support it. */
async function normalize<T extends PermissionGrant>(ctx: Ctx, companyId: string, list: T[]): Promise<T[]> {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (!PERMISSION_KEYS.includes(item.key)) throw new AppError("invalid");
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    const departmentIds = SCOPED_KEYS.has(item.key) && item.departmentIds?.length ? [...new Set(item.departmentIds)] : null;
    await assertDepartmentsInCompany(ctx, companyId, departmentIds);
    out.push({ ...item, departmentIds });
  }
  return out;
}

const systemOrder = (key: string | null) => (key === "admin" ? 0 : key === "employee" ? 1 : 2);

async function roleInCompany(ctx: Ctx, roleId: string) {
  const [role] = await ctx.tx.select().from(roles).where(eq(roles.id, roleId));
  return found(role);
}

/** Role names for every member (HR table, role picker): Admin, Employee, then custom roles. */
export async function listRoles(ctx: Ctx, companyId: string) {
  await requireMember(ctx, companyId);
  const rows = await ctx.tx.select({ id: roles.id, name: roles.name, systemKey: roles.systemKey }).from(roles).where(eq(roles.companyId, companyId)).orderBy(asc(roles.createdAt));
  return rows.sort((a, b) => systemOrder(a.systemKey) - systemOrder(b.systemKey));
}

/** Everything the permissions page shows: roles with their permissions, members with role and overrides, departments. */
export async function getPermissionsOverview(ctx: Ctx, companyId: string) {
  await requireOwner(ctx, companyId);
  const roleRows = await ctx.tx.select().from(roles).where(eq(roles.companyId, companyId)).orderBy(asc(roles.createdAt));
  const roleIds = roleRows.map((r) => r.id);
  const [grants, memberRows, overrideRows, departmentRows, counts] = await Promise.all([
    roleIds.length ? ctx.tx.select().from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds)) : Promise.resolve([]),
    ctx.tx.select().from(members).where(eq(members.companyId, companyId)).orderBy(asc(members.createdAt)),
    ctx.tx
      .select({ override: memberPermissionOverrides })
      .from(memberPermissionOverrides)
      .innerJoin(members, eq(members.id, memberPermissionOverrides.memberId))
      .where(eq(members.companyId, companyId)),
    ctx.tx.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.companyId, companyId)).orderBy(asc(departments.createdAt)),
    ctx.tx.select({ roleId: members.roleId, n: count() }).from(members).where(eq(members.companyId, companyId)).groupBy(members.roleId),
  ]);
  return {
    companyId,
    roles: roleRows
      // Admin, Employee, then the owner's roles in creation order
      .sort((a, b) => systemOrder(a.systemKey) - systemOrder(b.systemKey))
      .map((r) => ({
        id: r.id,
        name: r.name,
        systemKey: r.systemKey,
        memberCount: counts.find((c) => c.roleId === r.id)?.n ?? 0,
        permissions: grants.filter((g) => g.roleId === r.id).map((g) => ({ key: g.permission as PermissionKey, departmentIds: g.departmentIds })),
      })),
    members: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      title: m.title,
      email: m.email,
      departmentId: m.departmentId,
      isOwner: m.role === "owner",
      roleId: m.roleId,
      linked: m.userId !== null,
      overrides: overrideRows
        .filter((o) => o.override.memberId === m.id)
        .map((o) => ({ key: o.override.permission as PermissionKey, effect: o.override.effect, departmentIds: o.override.departmentIds })),
    })),
    departments: departmentRows,
  };
}

export async function createRole(ctx: Ctx, input: { companyId: string; name: Localized; copyFromRoleId?: string | null }) {
  await requireOwner(ctx, input.companyId);
  const [role] = await ctx.tx.insert(roles).values({ companyId: input.companyId, name: input.name }).returning();
  if (input.copyFromRoleId) {
    const source = await roleInCompany(ctx, input.copyFromRoleId);
    if (source.companyId !== input.companyId) throw new AppError("not_found");
    const grants = await ctx.tx.select().from(rolePermissions).where(eq(rolePermissions.roleId, source.id));
    if (grants.length) await ctx.tx.insert(rolePermissions).values(grants.map((g) => ({ ...g, roleId: role.id })));
  }
  await emitEvent(ctx, input.companyId, { type: "permissions.role_created", payload: { roleId: role.id } });
  return role;
}

export async function renameRole(ctx: Ctx, input: { roleId: string; name: Localized }) {
  const role = await roleInCompany(ctx, input.roleId);
  await requireOwner(ctx, role.companyId);
  const [row] = await ctx.tx.update(roles).set({ name: input.name }).where(eq(roles.id, role.id)).returning();
  return row;
}

/** Custom roles only; their members fall back to the default Employee role. */
export async function deleteRole(ctx: Ctx, input: { roleId: string }) {
  const role = await roleInCompany(ctx, input.roleId);
  await requireOwner(ctx, role.companyId);
  if (role.systemKey) throw new AppError("invalid");
  const [fallback] = await ctx.tx
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.companyId, role.companyId), eq(roles.systemKey, "employee")));
  await ctx.tx.update(members).set({ roleId: fallback?.id ?? null }).where(eq(members.roleId, role.id));
  await ctx.tx.delete(roles).where(eq(roles.id, role.id));
  await emitEvent(ctx, role.companyId, { type: "permissions.role_deleted", payload: { roleId: role.id } });
}

/** Replaces the role's permissions with exactly this list. */
export async function setRolePermissions(ctx: Ctx, input: { roleId: string; permissions: PermissionGrant[] }) {
  const role = await roleInCompany(ctx, input.roleId);
  await requireOwner(ctx, role.companyId);
  const list = await normalize(ctx, role.companyId, input.permissions);
  await ctx.tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  if (list.length) {
    await ctx.tx.insert(rolePermissions).values(list.map((p) => ({ roleId: role.id, permission: p.key, departmentIds: p.departmentIds })));
  }
  await emitEvent(ctx, role.companyId, { type: "permissions.role_updated", payload: { roleId: role.id, count: list.length } });
  return list;
}

export async function assignRole(ctx: Ctx, input: { memberId: string; roleId: string | null }) {
  const [member] = await ctx.tx.select().from(members).where(eq(members.id, input.memberId));
  const target = found(member);
  await requireOwner(ctx, target.companyId);
  if (target.role === "owner") throw new AppError("invalid");
  if (input.roleId) {
    const role = await roleInCompany(ctx, input.roleId);
    if (role.companyId !== target.companyId) throw new AppError("not_found");
  }
  await ctx.tx.update(members).set({ roleId: input.roleId }).where(eq(members.id, target.id));
  await emitEvent(ctx, target.companyId, { type: "permissions.member_role", payload: { memberId: target.id, roleId: input.roleId } });
}

/** Replaces the member's exceptions with exactly this list. */
export async function setMemberOverrides(ctx: Ctx, input: { memberId: string; overrides: PermissionOverride[] }) {
  const [member] = await ctx.tx.select().from(members).where(eq(members.id, input.memberId));
  const target = found(member);
  await requireOwner(ctx, target.companyId);
  if (target.role === "owner") throw new AppError("invalid");
  const list = await normalize(ctx, target.companyId, input.overrides);
  await ctx.tx.delete(memberPermissionOverrides).where(eq(memberPermissionOverrides.memberId, target.id));
  if (list.length) {
    await ctx.tx
      .insert(memberPermissionOverrides)
      .values(list.map((o) => ({ memberId: target.id, permission: o.key, effect: o.effect, departmentIds: o.departmentIds })));
  }
  await emitEvent(ctx, target.companyId, { type: "permissions.member_overrides", payload: { memberId: target.id, count: list.length } });
  return list;
}
