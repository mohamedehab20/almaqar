import { asc, desc, eq } from "drizzle-orm";
import { orders, suppliers, workflowRuns, workflows, type Localized, type OrderItem } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { AppError } from "@/server/errors";
import { found, requireMember } from "@/server/membership";
import { departmentOf, requirePermission } from "@/server/permissions";
import { assertWithinPlan } from "@/server/plans";
import { emitEvent } from "@/modules/events/service";
import { startOperation } from "@/modules/automation/service";
import type { Order, OrderStatus, OrderType, Supplier } from "./mock";

const EMPTY: Localized = { ar: "", en: "" };

type OrderRow = typeof orders.$inferSelect;

function toOrder(r: OrderRow): Order & { workflowId: string | null; runId: string | null } {
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    partyId: r.partyId,
    items: r.items,
    date: r.date,
    deliveryDate: r.deliveryDate ?? "",
    status: r.status,
    workflowId: r.workflowId,
    runId: r.runId,
  };
}

const orderTotal = (items: OrderItem[]) => items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

export async function listOrders(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select().from(orders).where(eq(orders.companyId, companyId)).orderBy(desc(orders.createdAt));
  return rows.map(toOrder);
}

/**
 * Starts the order's approval run (once) when it has a workflow. The run's outcome later sets the
 * order status (see syncOrderWithRun). The order already counted toward the plan, so the run does not.
 */
async function startApproval(ctx: Ctx, order: OrderRow): Promise<OrderRow> {
  if (!order.workflowId || order.runId) return order;
  const run = await startOperation(
    ctx,
    {
      companyId: order.companyId,
      workflowId: order.workflowId,
      subject: { ar: `اعتماد الطلب ${order.number}`, en: `Approve order ${order.number}` },
      category: order.type === "sale" ? "sales" : "purchasing",
    },
    { countsTowardPlan: false, internal: true },
  );
  // A one-step workflow is approved by the starter right away
  const status = run.status === "completed" ? "approved" : order.status;
  const [row] = await ctx.tx.update(orders).set({ runId: run.id, status }).where(eq(orders.id, order.id)).returning();
  return row;
}

/** The number (SO-#### / PO-####) is assigned by the database. Counts toward the plan's monthly operations. */
export async function createOrder(
  ctx: Ctx,
  input: {
    companyId: string;
    type: OrderType;
    partyId: string;
    items: OrderItem[];
    deliveryDate?: string | null;
    status?: "draft" | "pending";
    /** Approval workflow to run when the order is pending */
    workflowId?: string | null;
  },
) {
  const me = await requireMember(ctx, input.companyId);
  await requirePermission(ctx, input.companyId, "orders.create");
  await assertWithinPlan(ctx, input.companyId, "operationsPerMonth");
  if (input.workflowId) {
    const [workflow] = await ctx.tx.select({ companyId: workflows.companyId }).from(workflows).where(eq(workflows.id, input.workflowId));
    if (found(workflow).companyId !== input.companyId) throw new AppError("not_found");
  }
  const [inserted] = await ctx.tx
    .insert(orders)
    .values({ ...input, number: "", status: input.status ?? "pending", createdById: me.id })
    .returning();
  await emitEvent(ctx, input.companyId, {
    type: "order.created",
    payload: { orderId: inserted.id, number: inserted.number, type: inserted.type, amount: orderTotal(inserted.items) },
  });
  const row = inserted.status === "pending" ? await startApproval(ctx, inserted) : inserted;
  return toOrder(row);
}

/**
 * Manual status change. With an approval workflow, "pending" starts the run, and "approved" is only
 * possible once the run is completed (the run approves the order itself).
 */
export async function setOrderStatus(ctx: Ctx, input: { orderId: string; status: OrderStatus }) {
  const [current] = await ctx.tx.select().from(orders).where(eq(orders.id, input.orderId));
  const order = found(current);
  // The creator may submit or withdraw their own draft; any other change needs orders.approve.
  const ownDraft = order.status === "draft" && (input.status === "pending" || input.status === "cancelled");
  await requireOrderAccess(ctx, order, ownDraft);
  if (input.status === "approved" && order.workflowId) {
    const [run] = order.runId
      ? await ctx.tx.select({ status: workflowRuns.status }).from(workflowRuns).where(eq(workflowRuns.id, order.runId))
      : [];
    if (run?.status !== "completed") throw new AppError("invalid");
  }
  let [row] = await ctx.tx.update(orders).set({ status: input.status }).where(eq(orders.id, order.id)).returning();
  if (input.status === "pending") row = await startApproval(ctx, row);
  await emitEvent(ctx, row.companyId, { type: `order.${input.status}`, payload: { orderId: row.id, number: row.number } });
  return toOrder(row);
}

/**
 * Called when an approval run changes: a completed run approves its order, a closed (rejected) run
 * cancels it. Orders without a run are untouched.
 */
export async function syncOrderWithRun(ctx: Ctx, run: { id: string; status: string }) {
  const status = run.status === "completed" ? "approved" : run.status === "closed" ? "cancelled" : null;
  if (!status) return;
  const updated = await ctx.tx.update(orders).set({ status }).where(eq(orders.runId, run.id)).returning();
  for (const order of updated) {
    await emitEvent(ctx, order.companyId, {
      type: `order.${status}`,
      source: "automation",
      payload: { orderId: order.id, number: order.number, runId: run.id },
    });
  }
}

/** The creator editing their own draft needs orders.create; everything else orders.approve for the creator's department. */
async function requireOrderAccess(ctx: Ctx, order: OrderRow, creatorMayAct: boolean) {
  const me = await requireMember(ctx, order.companyId);
  if (creatorMayAct && order.createdById === me.id) await requirePermission(ctx, order.companyId, "orders.create");
  else await requirePermission(ctx, order.companyId, "orders.approve", await departmentOf(ctx, order.createdById));
}

export async function updateOrder(ctx: Ctx, input: { orderId: string; items?: OrderItem[]; deliveryDate?: string | null; partyId?: string }) {
  const { orderId, ...patch } = input;
  const [current] = await ctx.tx.select().from(orders).where(eq(orders.id, orderId));
  const order = found(current);
  await requireOrderAccess(ctx, order, order.status === "draft");
  const [row] = await ctx.tx.update(orders).set(patch).where(eq(orders.id, orderId)).returning();
  return toOrder(found(row));
}

// ---------- Suppliers ----------

export async function listSuppliers(ctx: Ctx, companyId: string): Promise<Supplier[]> {
  const rows = await ctx.tx.select().from(suppliers).where(eq(suppliers.companyId, companyId)).orderBy(asc(suppliers.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.name, category: r.category ?? EMPTY }));
}

export async function createSupplier(ctx: Ctx, input: { companyId: string; name: Localized; category?: Localized }): Promise<Supplier> {
  await requirePermission(ctx, input.companyId, "suppliers.manage");
  const [row] = await ctx.tx.insert(suppliers).values(input).returning();
  return { id: row.id, name: row.name, category: row.category ?? EMPTY };
}
