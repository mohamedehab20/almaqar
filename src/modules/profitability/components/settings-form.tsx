"use client";

import { Calculator, Check, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormStatus } from "@/components/ui/form-status";
import { useRouter } from "@/i18n/navigation";
import { saveProfitabilitySettings } from "../actions";
import { hourlyCostOf, TASK_TYPES, type ProfitSettings, type TaskType } from "../calc";

const inputClass = "h-10 w-full rounded-sm bg-surface-container-lowest px-3 text-sm ghost-border";

/**
 * Marketing → Client profitability → «إعدادات الربحية» (owner): the standard time of each task type, the time one revision
 * adds, and the monthly costs behind the internal hourly cost. Client profitability uses them.
 */
export function ProfitabilitySettingsForm({ companyId, settings, demo }: { companyId: string; settings: ProfitSettings; demo: boolean }) {
  const t = useTranslations("profitability.settings");
  const tErr = useTranslations("auth.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState(settings);
  const hourly = hourlyCostOf(draft);

  const num = (value: string) => (value === "" ? 0 : Math.max(0, Number(value)));
  const money = (key: "monthlySalaries" | "monthlyRent" | "monthlyTools" | "monthlyHours") => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{t(key)}</span>
      <input type="number" min={0} inputMode="decimal" dir="ltr" value={draft[key] || ""} onChange={(e) => setDraft({ ...draft, [key]: num(e.target.value) })} className={inputClass} />
    </label>
  );

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (demo) return setMessage(t("demoSaved"));
        startTransition(async () => {
          const result = await saveProfitabilitySettings({ companyId, ...draft, standardMinutes: Object.fromEntries(TASK_TYPES.map((k) => [k, Math.round(draft.standardMinutes[k] ?? 0)])) as Record<TaskType, number> });
          if (!result.ok) return setMessage(tErr(result.error));
          setMessage(t("saved"));
          router.refresh();
        });
      }}
    >
      <p className="text-on-surface-variant">{t("intro")}</p>

      <section className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Clock className="size-5 text-tertiary" aria-hidden />
          {t("timesTitle")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TASK_TYPES.map((type) => (
            <label key={type} className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">{t(`types.${type}`)}</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  dir="ltr"
                  value={(draft.standardMinutes[type] ?? 0) / 60 || ""}
                  onChange={(e) => setDraft({ ...draft, standardMinutes: { ...draft.standardMinutes, [type]: Math.round(num(e.target.value) * 60) } })}
                  className={inputClass}
                />
                <span className="text-xs text-on-surface-variant">{t("hoursUnit")}</span>
              </span>
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{t("revisionMinutes")}</span>
            <span className="flex items-center gap-2">
              <input type="number" min={0} dir="ltr" value={draft.revisionMinutes || ""} onChange={(e) => setDraft({ ...draft, revisionMinutes: Math.round(num(e.target.value)) })} className={inputClass} />
              <span className="text-xs text-on-surface-variant">{t("minutesUnit")}</span>
            </span>
          </label>
        </div>
        <p className="text-xs text-on-surface-variant">{t("timerHint")}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Calculator className="size-5 text-tertiary" aria-hidden />
          {t("costsTitle")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {money("monthlySalaries")}
          {money("monthlyRent")}
          {money("monthlyTools")}
          {money("monthlyHours")}
        </div>
        <p className="rounded-md bg-primary-fixed/40 px-4 py-3 text-sm text-primary">
          {hourly === null ? t("hourlyMissing") : t("hourlyPreview", { cost: hourly.toLocaleString("en-US") })}
        </p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          <Check className="size-4" aria-hidden />
          {t("save")}
        </Button>
      </div>
      <FormStatus message={message} />
    </form>
  );
}
