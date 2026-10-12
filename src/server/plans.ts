import { and, count, eq, gte } from "drizzle-orm";
import { companies, members, orders, workflowRuns, workflows } from "@/db/schema";
import type { Ctx } from "./context";
import { AppError } from "./errors";
import { found } from "./membership";

/** Plan limits (see pricing-plans.tsx). null = unlimited. */
export const PLAN_LIMITS = {
  free: { members: 5, operationsPerMonth: 20, workflows: 1 },
  pro: { members: null, operationsPerMonth: null, workflows: null },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;
type Limited = "members" | "operationsPerMonth" | "workflows";

function limitsFor(plan: string) {
  return PLAN_LIMITS[(plan in PLAN_LIMITS ? plan : "free") as PlanId];
}

/** First instant of the current month (UTC). An "operation" is a workflow run or an order. */
function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function usage(ctx: Ctx, companyId: string, kind: Limited) {
  const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  if (kind === "members") {
    return one(ctx.tx.select({ n: count() }).from(members).where(eq(members.companyId, companyId)));
  }
  if (kind === "workflows") {
    return one(ctx.tx.select({ n: count() }).from(workflows).where(eq(workflows.companyId, companyId)));
  }
  const since = monthStart();
  const runs = await one(
    ctx.tx.select({ n: count() }).from(workflowRuns).where(and(eq(workflowRuns.companyId, companyId), gte(workflowRuns.createdAt, since))),
  );
  const ords = await one(ctx.tx.select({ n: count() }).from(orders).where(and(eq(orders.companyId, companyId), gte(orders.createdAt, since))));
  return runs + ords;
}

/** Throws `plan_limit` if adding one more `kind` would go over the company's plan. */
export async function assertWithinPlan(ctx: Ctx, companyId: string, kind: Limited) {
  const [company] = await ctx.tx.select({ plan: companies.plan }).from(companies).where(eq(companies.id, companyId));
  const limit = limitsFor(found(company).plan)[kind];
  if (limit !== null && (await usage(ctx, companyId, kind)) >= limit) throw new AppError("plan_limit");
}
