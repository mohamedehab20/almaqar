import { and, eq } from "drizzle-orm";
import { companyRooms } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { requireMember } from "@/server/membership";
import { hasPermission, requirePermission } from "@/server/permissions";
import { assertMemberInCompany, listDepartments, listMembers } from "@/modules/hq/service";
import { isSoon, ROOMS, type RoomKey } from "./rooms";

/** Rooms the company turned off (plus rooms still being built never count as on). */
export async function disabledRooms(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select({ room: companyRooms.room, enabled: companyRooms.enabled }).from(companyRooms).where(eq(companyRooms.companyId, companyId));
  return rows.filter((r) => !r.enabled).map((r) => r.room);
}

/**
 * «إدارة الأقسام»: every HQ room (on / off, coming soon, manager) and every company department (active,
 * manager, how many people), with what the caller may change.
 */
export async function getDepartmentsData(ctx: Ctx, companyId: string) {
  await requireMember(ctx, companyId);
  const [canRooms, canDepartments, rows, departments, members] = await Promise.all([
    hasPermission(ctx, companyId, "company.settings"),
    hasPermission(ctx, companyId, "departments.manage"),
    ctx.tx.select().from(companyRooms).where(eq(companyRooms.companyId, companyId)),
    listDepartments(ctx, companyId),
    listMembers(ctx, companyId),
  ]);
  return {
    canRooms,
    canDepartments,
    rooms: ROOMS.map(({ key, soon }) => {
      const row = rows.find((r) => r.room === key);
      return { key: key as RoomKey, soon, enabled: !soon && (row?.enabled ?? true), managerId: row?.managerId ?? null };
    }),
    departments: departments.map((d) => ({ ...d, active: d.active ?? true, managerId: d.managerId ?? null, memberCount: members.filter((m) => m.departmentId === d.id).length })),
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
  };
}

export type DepartmentsData = Awaited<ReturnType<typeof getDepartmentsData>>;

/** Turn a room on or off for the whole company, or set who runs it (company.settings). */
export async function setRoom(ctx: Ctx, input: { companyId: string; room: RoomKey; enabled?: boolean; managerId?: string | null }) {
  await requirePermission(ctx, input.companyId, "company.settings");
  if (!ROOMS.some((r) => r.key === input.room)) throw new AppError("invalid");
  if (input.enabled === true && isSoon(input.room)) throw new AppError("invalid");
  await assertMemberInCompany(ctx, input.companyId, input.managerId);
  const [current] = await ctx.tx.select().from(companyRooms).where(and(eq(companyRooms.companyId, input.companyId), eq(companyRooms.room, input.room)));
  const values = {
    companyId: input.companyId,
    room: input.room,
    enabled: input.enabled ?? current?.enabled ?? true,
    managerId: input.managerId === undefined ? (current?.managerId ?? null) : input.managerId,
    updatedAt: new Date(),
  };
  await ctx.tx.insert(companyRooms).values(values).onConflictDoUpdate({ target: [companyRooms.companyId, companyRooms.room], set: values });
  return { room: values.room, enabled: !isSoon(values.room) && values.enabled, managerId: values.managerId };
}
