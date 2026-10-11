"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { clients } from "@/modules/marketing/sections-mock";
import { orderTotal, suppliers, type OrderItem, type OrderType } from "../mock";

export type NewOrder = { type: OrderType; partyId: string; items: OrderItem[]; deliveryDate: string; submit: boolean };

const emptyItem = (): OrderItem => ({ name: "", qty: 1, unitPrice: 0 });

/** Create a sales order (to a client) or a purchase order (from a supplier). */
export function OrderDialog({
  initialType,
  onClose,
  onCreate,
}: {
  initialType: OrderType;
  onClose: () => void;
  onCreate: (order: NewOrder) => void;
}) {
  const t = useTranslations("sales");
  const locale = useLocale() as "ar" | "en";
  const [type, setType] = useState<OrderType>(initialType);
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const parties = type === "sale" ? clients : suppliers;
  const [partyId, setPartyId] = useState(parties[0].id);
  const [deliveryDate, setDeliveryDate] = useState("");
  const total = orderTotal({ items });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const switchType = (next: OrderType) => {
    setType(next);
    setPartyId((next === "sale" ? clients : suppliers)[0].id);
  };
  const updateItem = (index: number, change: Partial<OrderItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...change } : item)));

  const create = (submit: boolean) =>
    onCreate({
      type,
      partyId,
      // Frontend phase: keep empty rows out instead of blocking on validation
      items: items.filter((item) => item.name.trim() || item.unitPrice > 0).map((item) => ({ ...item, name: item.name.trim() || t("dialog.unnamedItem") })),
      deliveryDate: deliveryDate || "—",
      submit,
    });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-dialog-title"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-xl bg-surface-container-lowest shadow-ambient-lg"
      >
        <header className="flex items-center justify-between gap-4 p-6 pb-4">
          <h2 id="order-dialog-title" className="text-xl font-extrabold">{t(`dialog.title.${type}`)}</h2>
          <button type="button" onClick={onClose} aria-label={t("dialog.close")} className="grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {/* Order type */}
          <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-container-low p-1" role="radiogroup" aria-label={t("dialog.type")}>
            {(["sale", "purchase"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={type === key}
                onClick={() => switchType(key)}
                className={cn(
                  "rounded-sm py-2 text-sm transition-colors",
                  type === key ? "bg-surface-container-lowest font-bold shadow-ambient" : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                {t(`types.${key}`)}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label={t(type === "sale" ? "dialog.client" : "dialog.supplier")} htmlFor="orderParty">
              <Select id="orderParty" value={partyId} onChange={(event) => setPartyId(event.target.value)}>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>{party.name[locale]}</option>
                ))}
              </Select>
            </Field>
            <Field label={t(type === "sale" ? "dialog.deliveryDate" : "dialog.receiveDate")} htmlFor="orderDelivery">
              <Input id="orderDelivery" type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
            </Field>
          </div>

          {/* Line items */}
          <div className="mt-6">
            <div className="mb-2 grid grid-cols-[minmax(0,1fr)_5rem_7rem_2.25rem] gap-2 text-xs font-semibold text-on-surface-variant">
              <span>{t("dialog.item")}</span>
              <span>{t("dialog.qty")}</span>
              <span>{t("dialog.unitPrice")}</span>
              <span />
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((item, index) => (
                <li key={index} className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_2.25rem] items-center gap-2">
                  <Input
                    aria-label={t("dialog.item")}
                    value={item.name}
                    onChange={(event) => updateItem(index, { name: event.target.value })}
                    placeholder={t(type === "sale" ? "dialog.itemPlaceholderSale" : "dialog.itemPlaceholderPurchase")}
                    className="h-11"
                  />
                  <Input
                    aria-label={t("dialog.qty")}
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(event) => updateItem(index, { qty: Math.max(0, Number(event.target.value)) })}
                    className="h-11 px-2 text-center"
                  />
                  <Input
                    aria-label={t("dialog.unitPrice")}
                    type="number"
                    min={0}
                    value={item.unitPrice || ""}
                    placeholder="0"
                    onChange={(event) => updateItem(index, { unitPrice: Math.max(0, Number(event.target.value)) })}
                    className="h-11 px-2 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyItem()]))}
                    aria-label={t("dialog.removeItem")}
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-container hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <Plus className="size-4" aria-hidden />
              {t("dialog.addItem")}
            </button>
          </div>
        </div>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 p-6">
          <p className="text-sm">
            {t("dialog.total")}:{" "}
            <span className="text-lg font-extrabold">
              <span dir="ltr" className="font-mono">{total.toLocaleString("en-US")}</span> {t("currency")}
            </span>
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => create(false)} className="h-11 rounded-sm bg-surface-container-low px-5 text-sm font-semibold hover:bg-surface-container">
              {t("dialog.saveDraft")}
            </button>
            <button type="button" onClick={() => create(true)} className="h-11 rounded-sm bg-tertiary px-6 text-sm font-bold text-on-tertiary transition hover:brightness-110">
              {t("dialog.submit")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
