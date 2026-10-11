"use client";

import { ArrowDownToLine, ArrowUpFromLine, Check, Clock, ShoppingCart, Tag, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { clients } from "@/modules/marketing/sections-mock";
import { orders as demoOrders, orderTotal, suppliers, type Order, type OrderStatus, type OrderType } from "../mock";
import { OrderDialog, type NewOrder } from "./order-dialog";

const statusStyle: Record<OrderStatus, string> = {
  draft: "bg-surface-container text-on-surface-variant",
  pending: "bg-tertiary-fixed text-tertiary",
  approved: "bg-primary-fixed text-primary",
  fulfilled: "bg-success-container text-success",
  cancelled: "bg-danger-container text-danger",
};

const typeStyle: Record<OrderType, { className: string; icon: LucideIcon }> = {
  sale: { className: "bg-success-container text-success", icon: ArrowUpFromLine },
  purchase: { className: "bg-primary-fixed text-primary", icon: ArrowDownToLine },
};

export function SalesView() {
  const t = useTranslations("sales");
  const locale = useLocale() as "ar" | "en";
  const [orders, setOrders] = useState<Order[]>(demoOrders);
  const [filter, setFilter] = useState<OrderType | "all">("all");
  const [dialogType, setDialogType] = useState<OrderType | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const partyName = (order: Pick<Order, "type" | "partyId">) =>
    (order.type === "sale" ? clients : suppliers).find((p) => p.id === order.partyId)?.name[locale] ?? "—";
  const money = (value: number) => (
    <span className="whitespace-nowrap">
      <span dir="ltr" className="font-mono">{value.toLocaleString("en-US")}</span> {t("currency")}
    </span>
  );

  const live = orders.filter((o) => o.status !== "cancelled" && o.status !== "draft");
  const salesTotal = live.filter((o) => o.type === "sale").reduce((sum, o) => sum + orderTotal(o), 0);
  const purchasesTotal = live.filter((o) => o.type === "purchase").reduce((sum, o) => sum + orderTotal(o), 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const visible = filter === "all" ? orders : orders.filter((o) => o.type === filter);

  const setStatus = (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    const order = orders.find((o) => o.id === id);
    if (order) setNotice(t(`notices.${status}`, { number: order.number }));
  };

  const createOrder = ({ type, partyId, items, deliveryDate, submit }: NewOrder) => {
    // TODO(backend): save the order and start its approval workflow
    const prefix = type === "sale" ? "SO" : "PO";
    const last = Math.max(...orders.filter((o) => o.type === type).map((o) => Number(o.number.split("-")[1])), type === "sale" ? 1000 : 2000);
    const order: Order = {
      id: `new-${Date.now()}`,
      number: `${prefix}-${last + 1}`,
      type,
      partyId,
      items,
      date: new Date().toISOString().slice(0, 10),
      deliveryDate,
      status: submit ? "pending" : "draft",
    };
    setOrders((prev) => [order, ...prev]);
    setDialogType(null);
    setFilter("all");
    setNotice(t(submit ? "notices.created" : "notices.drafted", { number: order.number }));
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p dir="ltr" className="text-left font-mono text-xs tracking-wider text-tertiary rtl:text-right">SALES // ORDERS</p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDialogType("purchase")}
              className="flex h-11 items-center gap-2 rounded-sm bg-surface-container-lowest px-4 text-sm font-semibold text-primary ghost-border hover:bg-primary-fixed/50"
            >
              <ShoppingCart className="size-4" aria-hidden />
              {t("newPurchase")}
            </button>
            <button
              type="button"
              onClick={() => setDialogType("sale")}
              className="flex h-11 items-center gap-2 rounded-sm bg-tertiary px-5 text-sm font-bold text-on-tertiary shadow-ambient transition hover:brightness-110"
            >
              <Tag className="size-4" aria-hidden />
              {t("newSale")}
            </button>
          </div>
        </header>

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Metric icon={ArrowUpFromLine} iconClass="bg-success-container text-success" label={t("metrics.sales")} value={money(salesTotal)} />
          <Metric icon={ArrowDownToLine} iconClass="bg-primary-fixed text-primary" label={t("metrics.purchases")} value={money(purchasesTotal)} />
          <Metric icon={Clock} iconClass="bg-tertiary-fixed text-tertiary" label={t("metrics.pending")} value={<span>{pendingCount}</span>} />
        </div>

        {/* Orders */}
        <section className="min-w-0 rounded-lg bg-surface-container-lowest shadow-ambient ghost-border">
          <header className="flex flex-wrap items-center justify-between gap-3 p-5">
            <h3 className="text-lg font-extrabold">{t("table.title")}</h3>
            <nav className="flex gap-1 rounded-md bg-surface-container-low p-1" aria-label={t("table.filter")}>
              {(["all", "sale", "purchase"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-sm px-4 py-1.5 text-sm transition-colors",
                    filter === key ? "bg-surface-container-lowest font-bold shadow-ambient" : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {t(`table.tabs.${key}`)} ({key === "all" ? orders.length : orders.filter((o) => o.type === key).length})
                </button>
              ))}
            </nav>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-surface-container-low text-xs text-on-surface-variant">
                <tr>
                  {(["number", "type", "party", "items", "total", "date", "status", "actions"] as const).map((col) => (
                    <th key={col} className="whitespace-nowrap px-4 py-3 text-start font-semibold">{t(`table.cols.${col}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => {
                  const type = typeStyle[order.type];
                  const TypeIcon = type.icon;
                  return (
                    <tr key={order.id} className="even:bg-surface-container-low/40 hover:bg-tertiary-fixed/30">
                      <td className="whitespace-nowrap px-4 py-4 font-mono font-semibold" dir="ltr">{order.number}</td>
                      <td className="px-4 py-4">
                        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-xs font-semibold", type.className)}>
                          <TypeIcon className="size-3.5" aria-hidden />
                          {t(`types.${order.type}`)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="block font-semibold">{partyName(order)}</span>
                        <span className="block text-xs text-muted">{t(order.type === "sale" ? "table.client" : "table.supplier")}</span>
                      </td>
                      <td className="max-w-56 px-4 py-4 text-xs text-on-surface-variant">
                        {order.items.map((item) => `${item.name} × ${item.qty}`).join("، ")}
                      </td>
                      <td className="px-4 py-4 font-semibold">{money(orderTotal(order))}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-muted" dir="ltr">{order.date}</td>
                      <td className="px-4 py-4">
                        <span className={cn("inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", statusStyle[order.status])}>
                          {t(`status.${order.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          {(order.status === "pending" || order.status === "draft") && (
                            <ActionButton
                              label={t(order.status === "draft" ? "actions.submit" : "actions.approve")}
                              icon={Check}
                              className="text-success hover:bg-success-container"
                              onClick={() => setStatus(order.id, order.status === "draft" ? "pending" : "approved")}
                            />
                          )}
                          {order.status === "approved" && (
                            <ActionButton
                              label={t(order.type === "sale" ? "actions.deliver" : "actions.receive")}
                              icon={order.type === "sale" ? ArrowUpFromLine : ArrowDownToLine}
                              className="text-primary hover:bg-primary-fixed"
                              onClick={() => setStatus(order.id, "fulfilled")}
                            />
                          )}
                          {order.status !== "fulfilled" && order.status !== "cancelled" && (
                            <ActionButton
                              label={t("actions.cancel")}
                              icon={X}
                              className="text-danger hover:bg-danger-container"
                              onClick={() => setStatus(order.id, "cancelled")}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {dialogType && <OrderDialog initialType={dialogType} onClose={() => setDialogType(null)} onCreate={createOrder} />}

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

function Metric({ icon: Icon, iconClass, label, value }: { icon: LucideIcon; iconClass: string; label: string; value: React.ReactNode }) {
  return (
    <section className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="mt-2 text-2xl font-extrabold">{value}</p>
      </div>
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-md", iconClass)}>
        <Icon className="size-6" aria-hidden />
      </span>
    </section>
  );
}

function ActionButton({ label, icon: Icon, className, onClick }: { label: string; icon: LucideIcon; className: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn("flex h-8 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-xs font-semibold transition-colors", className)}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
