import { and, asc, eq } from "drizzle-orm";
import { companies, departments, furniture, members, roles, rooms, zones, type Localized } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { requirePermission } from "@/server/permissions";
import { assertWithinPlan } from "@/server/plans";
import { emitEvent } from "@/modules/events/service";
import type { Department, FurnitureItem, Member, PresenceStatus, Room, Zone } from "./mock";

const EMPTY: Localized = { ar: "", en: "" };

type MemberRow = typeof members.$inferSelect;
type MemberRole = MemberRow["role"];

export function toMember(r: MemberRow): Member & { role: MemberRole; roleId: string | null; email: string | null; linked: boolean } {
  return {
    id: r.id,
    name: r.name,
    title: r.title ?? EMPTY,
    departmentId: r.departmentId ?? "",
    status: r.status,
    currentTask: r.currentTask ?? undefined,
    role: r.role,
    roleId: r.roleId,
    email: r.email,
    linked: r.userId !== null,
  };
}

// ---------- Company ----------

/** The company at /c/<slug> and the caller's membership, or null if it does not exist or they are not a member. */
export async function getCompanyBySlug(ctx: Ctx, slug: string) {
  const [company] = await ctx.tx.select().from(companies).where(eq(companies.slug, slug));
  if (!company) return null;
  const me = await requireMember(ctx, company.id);
  return { company, me: toMember(me) };
}

/** Companies the caller belongs to (for the company picker after sign-in). */
export async function listMyCompanies(ctx: Ctx) {
  return ctx.tx
    .select({ id: companies.id, slug: companies.slug, name: companies.name, role: members.role })
    .from(members)
    .innerJoin(companies, eq(companies.id, members.companyId))
    .where(eq(members.userId, ctx.userId))
    .orderBy(asc(companies.createdAt));
}

export async function updateCompany(ctx: Ctx, input: { companyId: string; name?: Localized; floor?: { widthM: number; depthM: number } }) {
  await requirePermission(ctx, input.companyId, "company.settings");
  const [row] = await ctx.tx
    .update(companies)
    .set({ name: input.name, floor: input.floor })
    .where(eq(companies.id, input.companyId))
    .returning();
  return found(row);
}

// ---------- Members ----------

export async function listMembers(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select().from(members).where(eq(members.companyId, companyId)).orderBy(asc(members.createdAt));
  return rows.map(toMember);
}

/** Presence: any member may set their own status and current task. */
export async function setMyStatus(ctx: Ctx, input: { companyId: string; status: PresenceStatus; currentTask?: Localized | null }) {
  const me = await requireMember(ctx, input.companyId);
  const [row] = await ctx.tx
    .update(members)
    .set({ status: input.status, ...(input.currentTask !== undefined && { currentTask: input.currentTask }) })
    .where(eq(members.id, me.id))
    .returning();
  return toMember(found(row));
}

/** Your own name and job title in this company (role, department and email stay with owners/admins). */
export async function updateMyProfile(ctx: Ctx, input: { companyId: string; name?: Localized; title?: Localized }) {
  const me = await requireMember(ctx, input.companyId);
  const [row] = await ctx.tx
    .update(members)
    .set({ name: input.name, title: input.title })
    .where(eq(members.id, me.id))
    .returning();
  return toMember(found(row));
}

/** The company's default Employee role (every company has one, see private.seed_default_roles). */
async function employeeRoleId(ctx: Ctx, companyId: string) {
  const [role] = await ctx.tx.select({ id: roles.id }).from(roles).where(and(eq(roles.companyId, companyId), eq(roles.systemKey, "employee")));
  return role?.id ?? null;
}

/** A role id sent by the UI must belong to this company. */
async function assertRoleInCompany(ctx: Ctx, companyId: string, roleId: string) {
  const [role] = await ctx.tx.select({ id: roles.id }).from(roles).where(and(eq(roles.id, roleId), eq(roles.companyId, companyId)));
  if (!role) throw new AppError("not_found");
}

/**
 * Adds a member by email (needs members.invite for their department). They are linked to their account
 * when they first sign in (claim_invites). Choosing a role is owner-only; others add with the default Employee role.
 */
export async function inviteMember(
  ctx: Ctx,
  input: { companyId: string; email: string; name: Localized; title?: Localized; departmentId?: string | null; roleId?: string | null },
) {
  const me = await requireMember(ctx, input.companyId);
  await requirePermission(ctx, input.companyId, "members.invite", input.departmentId);
  if (input.roleId && me.role !== "owner") throw new AppError("forbidden");
  if (input.roleId) await assertRoleInCompany(ctx, input.companyId, input.roleId);
  await assertWithinPlan(ctx, input.companyId, "members");
  const email = input.email.trim().toLowerCase();
  const [taken] = await ctx.tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.companyId, input.companyId), eq(members.email, email)));
  if (taken) throw new AppError("conflict");

  const [row] = await ctx.tx
    .insert(members)
    .values({
      companyId: input.companyId,
      email,
      name: input.name,
      title: input.title,
      departmentId: input.departmentId ?? null,
      role: "employee",
      roleId: input.roleId ?? (await employeeRoleId(ctx, input.companyId)),
    })
    .returning();
  await emitEvent(ctx, input.companyId, { type: "member.invited", payload: { memberId: row.id } });
  return toMember(row);
}

/** Edits a member (members.edit for their department, and for the new one when moving). Roles: owner only, never the owner's own record. */
export async function updateMember(
  ctx: Ctx,
  input: { companyId: string; memberId: string; name?: Localized; title?: Localized; departmentId?: string | null; roleId?: string | null },
) {
  const me = await requireMember(ctx, input.companyId);
  const [target] = await ctx.tx
    .select()
    .from(members)
    .where(and(eq(members.id, input.memberId), eq(members.companyId, input.companyId)));
  found(target);
  if (input.roleId !== undefined) {
    if (me.role !== "owner" || target.role === "owner") throw new AppError("forbidden");
    if (input.roleId) await assertRoleInCompany(ctx, input.companyId, input.roleId);
  }
  if (input.name !== undefined || input.title !== undefined || input.departmentId !== undefined) {
    if (target.role === "owner" && me.role !== "owner") throw new AppError("forbidden");
    await requirePermission(ctx, input.companyId, "members.edit", target.departmentId);
    if (input.departmentId !== undefined && input.departmentId !== target.departmentId) {
      await requirePermission(ctx, input.companyId, "members.edit", input.departmentId);
    }
  }

  const [row] = await ctx.tx
    .update(members)
    .set({ name: input.name, title: input.title, departmentId: input.departmentId, roleId: input.roleId })
    .where(eq(members.id, input.memberId))
    .returning();
  return toMember(found(row));
}

export async function removeMember(ctx: Ctx, input: { companyId: string; memberId: string }) {
  const me = await requireMember(ctx, input.companyId);
  const [target] = await ctx.tx
    .select()
    .from(members)
    .where(and(eq(members.id, input.memberId), eq(members.companyId, input.companyId)));
  found(target);
  if (target.role === "owner" || target.id === me.id) throw new AppError("forbidden");
  await requirePermission(ctx, input.companyId, "members.remove", target.departmentId);
  await ctx.tx.delete(members).where(eq(members.id, input.memberId));
  await emitEvent(ctx, input.companyId, { type: "member.removed", payload: { memberId: input.memberId } });
}

// ---------- Departments ----------

export async function listDepartments(ctx: Ctx, companyId: string): Promise<Department[]> {
  const rows = await ctx.tx.select().from(departments).where(eq(departments.companyId, companyId)).orderBy(asc(departments.createdAt));
  return rows.map(toDepartment);
}

const toDepartment = (r: typeof departments.$inferSelect): Department => ({ id: r.id, name: r.name, color: r.color, active: r.active, managerId: r.managerId });

/** Throws `invalid` unless the member belongs to this company (department and room managers). */
export async function assertMemberInCompany(ctx: Ctx, companyId: string, memberId: string | null | undefined) {
  if (!memberId) return;
  const [m] = await ctx.tx.select({ companyId: members.companyId }).from(members).where(eq(members.id, memberId));
  if (m?.companyId !== companyId) throw new AppError("invalid");
}

export async function createDepartment(ctx: Ctx, input: { companyId: string; name: Localized; color?: Department["color"]; managerId?: string | null }) {
  await requirePermission(ctx, input.companyId, "departments.manage");
  await assertMemberInCompany(ctx, input.companyId, input.managerId);
  const [row] = await ctx.tx.insert(departments).values(input).returning();
  return toDepartment(row);
}

/** Rename, recolour, stop / restart (`active`) or set the manager (null = none). */
export async function updateDepartment(
  ctx: Ctx,
  input: { companyId: string; departmentId: string; name?: Localized; color?: Department["color"]; active?: boolean; managerId?: string | null },
) {
  await requirePermission(ctx, input.companyId, "departments.manage");
  await assertMemberInCompany(ctx, input.companyId, input.managerId);
  const [row] = await ctx.tx
    .update(departments)
    .set({ name: input.name, color: input.color, active: input.active, managerId: input.managerId })
    .where(and(eq(departments.id, input.departmentId), eq(departments.companyId, input.companyId)))
    .returning();
  return toDepartment(found(row));
}

export async function deleteDepartment(ctx: Ctx, input: { companyId: string; departmentId: string }) {
  await requirePermission(ctx, input.companyId, "departments.manage");
  const deleted = await ctx.tx
    .delete(departments)
    .where(and(eq(departments.id, input.departmentId), eq(departments.companyId, input.companyId)))
    .returning({ id: departments.id });
  found(deleted[0]);
}

// ---------- Floor plan ----------

export async function getFloorPlan(ctx: Ctx, companyId: string) {
  const [company] = await ctx.tx.select({ floor: companies.floor }).from(companies).where(eq(companies.id, companyId));
  const [roomRows, furnitureRows, zoneRows] = await Promise.all([
    ctx.tx.select().from(rooms).where(eq(rooms.companyId, companyId)),
    ctx.tx.select().from(furniture).where(eq(furniture.companyId, companyId)),
    ctx.tx.select().from(zones).where(eq(zones.companyId, companyId)),
  ]);
  return {
    floor: found(company).floor,
    rooms: roomRows.map((r): Room => ({ id: r.id, type: r.type, code: r.code ?? undefined, x: r.x, y: r.y, w: r.w, h: r.h })),
    furniture: furnitureRows.map(
      (f): FurnitureItem => ({ id: f.id, kind: f.kind, roomId: f.roomId, memberId: f.memberId ?? undefined, x: f.x, y: f.y, w: f.w, h: f.h }),
    ),
    zones: zoneRows.map((z): Zone => ({ id: z.id, roomId: z.roomId, departmentId: z.departmentId, x: z.x, y: z.y, w: z.w, h: z.h })),
  };
}

/** Replaces the whole floor plan in one go (the floor editor saves everything together). */
export async function saveFloorPlan(
  ctx: Ctx,
  input: {
    companyId: string;
    rooms: Omit<Room, "id">[];
    furniture: (Omit<FurnitureItem, "id" | "roomId"> & { roomIndex: number })[];
    zones: (Omit<Zone, "id" | "roomId"> & { roomIndex: number })[];
  },
) {
  await requirePermission(ctx, input.companyId, "company.settings");
  const { companyId } = input;
  await ctx.tx.delete(rooms).where(eq(rooms.companyId, companyId)); // cascades to furniture and zones
  const roomRows = input.rooms.length
    ? await ctx.tx
        .insert(rooms)
        .values(input.rooms.map((r) => ({ companyId, type: r.type, code: r.code, x: r.x, y: r.y, w: r.w, h: r.h })))
        .returning({ id: rooms.id })
    : [];
  const roomId = (i: number) => {
    const room = roomRows[i];
    if (!room) throw new AppError("invalid");
    return room.id;
  };
  if (input.furniture.length) {
    await ctx.tx.insert(furniture).values(
      input.furniture.map((f) => ({ companyId, roomId: roomId(f.roomIndex), kind: f.kind, memberId: f.memberId, x: f.x, y: f.y, w: f.w, h: f.h })),
    );
  }
  if (input.zones.length) {
    await ctx.tx
      .insert(zones)
      .values(input.zones.map((z) => ({ companyId, roomId: roomId(z.roomIndex), departmentId: z.departmentId, x: z.x, y: z.y, w: z.w, h: z.h })));
  }
  return getFloorPlan(ctx, companyId);
}
