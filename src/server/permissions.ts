import { and, eq, inArray, sql } from "drizzle-orm";
import { departments, memberPermissionOverrides, members, rolePermissions } from "@/db/schema";
import { PERMISSION_KEYS, SCOPED_KEYS, type PermissionKey } from "@/modules/permissions/catalog";
import { rowsOf, type Ctx } from "./context";
import { AppError } from "./errors";
import { requireMember } from "./membership";

/**
 * Permission checks for services. The rule itself lives in the database (private.has_permission):
 * owner → yes; a deny override → no; a grant override → yes; the member's role → yes; else no.
 * `departmentId` is the department the action is about (target member, task assignee, note author,
 * order creator); scoped grants only match it.
 */
export async function hasPermission(ctx: Ctx, companyId: string, key: PermissionKey, departmentId?: string | null) {
  const [row] = rowsOf<{ ok: boolean }>(
    await ctx.tx.execute(sql`select private.has_permission(${companyId}::uuid, ${key}, ${departmentId ?? null}::uuid) as ok`),
  );
  return row?.ok === true;
}

/** Throws `forbidden` unless the caller has the permission (for that department, if given). */
export async function requirePermission(ctx: Ctx, companyId: string, key: PermissionKey, departmentId?: string | null) {
  if (!(await hasPermission(ctx, companyId, key, departmentId))) throw new AppError("forbidden");
}

/** The department of a member (for scoped checks), or null. */
export async function departmentOf(ctx: Ctx, memberId: string | null | undefined) {
  if (!memberId) return null;
  const [m] = await ctx.tx.select({ departmentId: members.departmentId }).from(members).where(eq(members.id, memberId));
  return m?.departmentId ?? null;
}

/** "all" = every department; a list = only those departments. */
export type PermissionScope = "all" | string[];

/**
 * What the caller may do in this company, for the UI (hiding rooms and buttons). The server still
 * checks every action with requirePermission, so this never grants anything by itself.
 */
export async function getMyPermissions(ctx: Ctx, companyId: string) {
  const me = await requireMember(ctx, companyId);
  if (me.role === "owner") {
    return { owner: true, memberId: me.id, scopes: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, "all"])) as Partial<Record<PermissionKey, PermissionScope>> };
  }
  const [fromRole, overrides] = await Promise.all([
    me.roleId ? ctx.tx.select().from(rolePermissions).where(eq(rolePermissions.roleId, me.roleId)) : Promise.resolve([]),
    ctx.tx.select().from(memberPermissionOverrides).where(eq(memberPermissionOverrides.memberId, me.id)),
  ]);
  const scopes: Partial<Record<PermissionKey, PermissionScope>> = {};
  for (const p of fromRole) scopes[p.permission as PermissionKey] = p.departmentIds ?? "all";
  for (const o of overrides) {
    const key = o.permission as PermissionKey;
    if (o.effect === "grant") scopes[key] = o.departmentIds ?? "all";
    else if (!o.departmentIds) delete scopes[key];
    else if (Array.isArray(scopes[key])) scopes[key] = (scopes[key] as string[]).filter((d) => !o.departmentIds!.includes(d));
    // a partial deny on an "all" grant stays "all" here; the server check is exact
  }
  for (const key of Object.keys(scopes) as PermissionKey[]) {
    if (!SCOPED_KEYS.has(key)) scopes[key] = "all";
  }
  return { owner: false, memberId: me.id, scopes };
}

export type MyPermissions = Awaited<ReturnType<typeof getMyPermissions>>;

/** Throws `invalid` unless every department id belongs to this company (scopes sent by the UI). */
export async function assertDepartmentsInCompany(ctx: Ctx, companyId: string, departmentIds: string[] | null | undefined) {
  if (!departmentIds?.length) return;
  const rows = await ctx.tx
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.companyId, companyId), inArray(departments.id, departmentIds)));
  if (rows.length !== new Set(departmentIds).size) throw new AppError("invalid");
}
