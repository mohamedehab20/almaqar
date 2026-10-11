"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { memberLabel, members } from "@/modules/hq/mock";
import type { Workflow } from "../workflows";

type DraftStep = { title: string; assigneeId: string };

/** Build a new approval workflow: ordered steps, each owned by an employee. */
export function WorkflowBuilderDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (workflow: Workflow) => void }) {
  const t = useTranslations("automation.workflows.builder");
  const locale = useLocale() as "ar" | "en";
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([
    { title: "", assigneeId: members[1].id },
    { title: "", assigneeId: members[0].id },
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const update = (index: number, change: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...change } : s)));
  const move = (index: number, delta: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const create = () => {
    const text = (value: string) => ({ ar: value, en: value });
    const stamp = Date.now();
    // Frontend phase: fill empty fields with defaults instead of blocking
    onCreate({
      id: `wf-${stamp}`,
      name: text(name.trim() || t("defaultName")),
      steps: steps.map((s, i) => ({ id: `st-${stamp}-${i}`, title: text(s.title.trim() || t("defaultStep", { n: i + 1 })), assigneeId: s.assigneeId })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="wf-builder-title" className="relative flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-xl bg-surface-container-lowest shadow-ambient-lg">
        <header className="flex items-center justify-between gap-4 p-6 pb-4">
          <div>
            <h2 id="wf-builder-title" className="text-xl font-extrabold">{t("title")}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t("intro")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <Field label={t("name")} htmlFor="wfName">
            <Input id="wfName" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("namePlaceholder")} autoComplete="off" />
          </Field>

          <p className="mt-6 text-sm font-semibold">{t("steps")}</p>
          <ol className="mt-2 flex flex-col gap-2">
            {steps.map((s, index) => (
              <li key={index} className="flex items-center gap-2 rounded-md bg-surface-container-low p-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-tertiary font-mono text-sm font-bold text-on-tertiary">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label={t("stepTitle")}
                    value={s.title}
                    onChange={(event) => update(index, { title: event.target.value })}
                    placeholder={t("stepPlaceholder")}
                    className="h-11 bg-surface-container-lowest"
                  />
                </div>
                <div className="w-80 shrink-0">
                  <Select aria-label={t("assignee")} value={s.assigneeId} onChange={(event) => update(index, { assigneeId: event.target.value })} className="h-11 bg-surface-container-lowest">
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{memberLabel(m, locale)}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex shrink-0">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("moveUp")} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-container disabled:opacity-30">
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === steps.length - 1} aria-label={t("moveDown")} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-container disabled:opacity-30">
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                    disabled={steps.length <= 2}
                    aria-label={t("remove")}
                    className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger-container hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, { title: "", assigneeId: members[0].id }])}
            className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <Plus className="size-4" aria-hidden />
            {t("addStep")}
          </button>
          <p className="mt-4 rounded-md bg-tertiary-fixed px-4 py-3 text-xs leading-6 text-tertiary">{t("rules")}</p>
        </div>

        <footer className="mt-4 flex justify-end gap-3 border-t border-outline-variant/40 p-6">
          <button type="button" onClick={onClose} className="h-11 rounded-sm bg-surface-container-low px-5 text-sm font-semibold hover:bg-surface-container">
            {t("cancel")}
          </button>
          <button type="button" onClick={create} className="h-11 rounded-sm bg-tertiary px-6 text-sm font-bold text-on-tertiary transition hover:brightness-110">
            {t("create")}
          </button>
        </footer>
      </div>
    </div>
  );
}
