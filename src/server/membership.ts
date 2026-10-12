import { and, eq } from "drizzle-orm";
import { members } from "@/db/schema";
import type { Ctx } from "./context";
import { AppError } from "./errors";

/** The caller's member row in this company. Throws `forbidden` if they are not a member. */
export async function requireMember(ctx: Ctx, companyId: string) {
  const [me] = await ctx.tx
    .select()
    .from(members)
    .where(and(eq(members.companyId, companyId), eq(members.userId, ctx.userId)));
  if (!me) throw new AppError("forbidden");
  return me;
}

/** Same as requireMember, but only for owners and admins. */
export async function requireAdmin(ctx: Ctx, companyId: string) {
  const me = await requireMember(ctx, companyId);
  if (me.role === "employee") throw new AppError("forbidden");
  return me;
}

/** Throws `not_found` when a query returned no row (RLS hides rows the caller may not see). */
export function found<T>(row: T | undefined): T {
  if (!row) throw new AppError("not_found");
  return row;
}
