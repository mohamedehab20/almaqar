"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { categoryCounts, type OpsCategory, type RowNature } from "../mock";

export type NewOperation = { name: string; category: OpsCategory; nature: Extract<RowNature, "human" | "automated"> };

const categories = Object.keys(categoryCounts) as OpsCategory[];

/** Small modal to add an operation to the log (frontend only for now). */
export function AddOperationDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (operation: NewOperation) => void }) {
  const t = useTranslations("ops");
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-operation-title"
        className="relative w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-ambient-lg sm:p-8"
      >
        <header className="flex items-center justify-between gap-4">
          <h2 id="add-operation-title" className="text-xl font-extrabold">
            {t("add.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("add.close")}
            className="grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onAdd({
              // Frontend phase: fall back to a placeholder name instead of blocking on validation
              name: name.trim() || t("add.namePlaceholder"),
              category: data.get("category") as OpsCategory,
              nature: data.get("nature") as NewOperation["nature"],
            });
          }}
        >
          <Field label={t("add.name")} htmlFor="operationName">
            <Input
              ref={inputRef}
              id="operationName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("add.namePlaceholder")}
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("add.category")} htmlFor="operationCategory">
              <Select id="operationCategory" name="category" defaultValue="contracts">
                {categories.map((key) => (
                  <option key={key} value={key}>
                    {t(`tabs.${key}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("add.nature")} htmlFor="operationNature">
              <Select id="operationNature" name="nature" defaultValue="human">
                <option value="human">{t("table.nature.human")}</option>
                <option value="automated">{t("table.nature.automated")}</option>
              </Select>
            </Field>
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-sm bg-surface-container-low px-5 text-sm font-semibold hover:bg-surface-container"
            >
              {t("add.cancel")}
            </button>
            <button
              type="submit"
              className="h-11 rounded-sm bg-tertiary px-6 text-sm font-bold text-on-tertiary transition hover:brightness-110"
            >
              {t("add.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
