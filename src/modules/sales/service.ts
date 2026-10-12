import { asc, desc, eq } from "drizzle-orm";
import { orders, suppliers, type Localized, type OrderItem } from "@/db/schema";
import type { Ctx } from "@/server/context";
import { found, requireMember } from "@/server/membership";
import { assertWithinPlan } from "@/server/plans";
import { emitEvent } from "@/modules/events/service";
import type { Order, OrderStatus, OrderType, Supplier } from "./mock";

const EMPTY: Localized = { ar: "", en: "" };

type OrderRow = typeof orders.$inferSelect;

function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    partyId: r.partyId,
    items: r.items,
    date: r.date,
    deliveryDate: r.deliveryDate ?? "",
    status: r.status,
  };
}

const orderTotal = (items: OrderItem[]) => items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

export async function listOrders(ctx: Ctx, companyId: string) {
  const rows = await ctx.tx.select().from(orders).where(eq(orders.companyId, companyId)).orderBy(desc(orders.createdAt));
  return rows.map(toOrder);
}

/** The number (SO-#### / PO-####) is assigned by the database. Counts toward the plan's monthly operations. */
export async function createOrder(
  ctx: Ctx,
  input: { companyId: string; type: OrderType; partyId: string; items: OrderItem[]; deliveryDate?: string | null; status?: "draft" | "pending" },
) {
  await requireMember(ctx, input.companyId);
  await assertWithinPlan(ctx, input.companyId, "operationsPerMonth");
  const [row] = await ctx.tx
    .insert(orders)
    .values({ ...input, number: "", status: input.status ?? "pending" })
    .returning();
  await emitEvent(ctx, input.companyId, {
    type: "order.created",
    payload: { orderId: row.id, number: row.number, type: row.type, amount: orderTotal(row.items) },
  });
  return toOrder(row);
}

export async function setOrderStatus(ctx: Ctx, input: { orderId: string; status: OrderStatus }) {
  const [row] = await ctx.tx.update(orders).set({ status: input.status }).where(eq(orders.id, input.orderId)).returning();
  const order = found(row);
  await emitEvent(ctx, order.companyId, { type: `order.${input.status}`, payload: { orderId: order.id, number: order.number } });
  return toOrder(order);
}

export async function updateOrder(ctx: Ctx, input: { orderId: string; items?: OrderItem[]; deliveryDate?: string | null; partyId?: string }) {
  const { orderId, ...patch } = input;
  const [row] = await ctx.tx.update(orders).set(patch).where(eq(orders.id, orderId)).returning();
  return toOrder(found(row));
}

// ---------- Suppliers ----------

export async function listSuppliers(ctx: Ctx, companyId: string): Promise<Supplier[]> {
  const rows = await ctx.tx.select().from(suppliers).where(eq(suppliers.companyId, companyId)).orderBy(asc(suppliers.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.name, category: r.category ?? EMPTY }));
}

export async function createSupplier(ctx: Ctx, input: { companyId: string; name: Localized; category?: Localized }): Promise<Supplier> {
  await requireMember(ctx, input.companyId);
  const [row] = await ctx.tx.insert(suppliers).values(input).returning();
  return { id: row.id, name: row.name, category: row.category ?? EMPTY };
}
