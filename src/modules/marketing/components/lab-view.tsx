"use client";

import { Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { criteria, type Criterion, type Idea } from "../mock";

export type Decision = "continue" | "revise" | "cancel";

type LabViewProps = {
  ideas: Idea[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onRate: (id: string, criterion: Criterion, value: number) => void;
  notes: Record<string, string>;
  onNotes: (id: string, value: string) => void;
  onDecide: (id: string, decision: Decision) => void;
};

/** Test lab: the idea under test, A/B version comparison and the scoring panel. */
export function LabView({ ideas, selectedId, onSelect, onRate, notes, onNotes, onDecide }: LabViewProps) {
  const t = useTranslations("marketing");
  const locale = useLocale() as "ar" | "en";
  const idea = ideas.find((item) => item.id === selectedId) ?? ideas[0];

  if (!idea) return <p className="rounded-lg bg-surface-container-lowest p-10 text-center text-muted shadow-ambient">{t("lab.empty")}</p>;

  const ratings = idea.ratings ?? { hook: 3, clarity: 3, fit: 3, effort: 3 };
  const total = criteria.reduce((sum, key) => sum + ratings[key], 0);
  const versions = idea.versions ?? [];
  const best = versions.length > 1 ? versions.reduce((a, b) => (b.completion > a.completion ? b : a)) : undefined;
  const number = (value: number) => value.toLocaleString("en-US");

  return (
    <div className="flex flex-col gap-4">
      {ideas.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("lab.pick")}>
          {ideas.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === idea.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                item.id === idea.id ? "bg-tertiary text-on-tertiary" : "bg-surface-container-lowest ghost-border hover:bg-surface-container-low",
              )}
            >
              {item.title[locale]}
            </button>
          ))}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Idea card */}
          <section className="rounded-lg bg-surface-container-lowest p-6 shadow-ambient ghost-border">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold sm:text-2xl">{idea.title[locale]}</h2>
              <span className="rounded-sm bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">{t("lab.underTest")}</span>
            </header>
            <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-on-surface-variant">
              <span>{t("meta.client")}: {idea.client[locale]}</span>
              <span>{t("meta.format")}: {idea.format[locale]}</span>
              <span>{t("meta.owner")}: {idea.owner[locale]}</span>
            </p>
            <div className="mt-5 grid gap-5 border-t border-dashed border-outline-variant/70 pt-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-tertiary">{t("lab.hook")}</p>
                <p className="mt-2">{idea.hook[locale]}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-tertiary">{t("lab.message")}</p>
                <p className="mt-2">{idea.message[locale]}</p>
              </div>
            </div>
          </section>

          {/* Version comparison */}
          <section>
            <header className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold">{t("lab.compare")}</h3>
              <span className="rounded-sm bg-surface-container-lowest px-2 py-1 text-xs text-on-surface-variant ghost-border">{t("lab.demoNumbers")}</span>
            </header>
            {versions.length === 0 ? (
              <p className="rounded-lg bg-surface-container-lowest p-8 text-center text-muted ghost-border">{t("lab.noVersions")}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {versions.map((version) => {
                  const isBest = version === best;
                  return (
                    <article
                      key={version.id}
                      className={cn(
                        "rounded-lg bg-surface-container-lowest p-4 shadow-ambient",
                        isBest ? "ring-2 ring-primary-container" : "ghost-border",
                      )}
                    >
                      <div className="flex gap-4">
                        <div className="relative grid aspect-[9/16] w-20 shrink-0 place-items-center rounded-md bg-[#1f2937] text-secondary-container sm:w-24">
                          <Play className="size-6" aria-hidden />
                          <span className="absolute bottom-1.5 start-1.5 rounded-sm bg-black/60 px-1.5 font-mono text-[10px] text-white" dir="ltr">
                            {version.duration}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {t("lab.version")} <span className="font-mono">{version.label}</span>
                            {isBest && (
                              <span className="rounded-sm bg-success-container px-2 py-0.5 text-xs text-success">{t("lab.best")}</span>
                            )}
                          </p>
                          <p className="mt-2 text-sm text-on-surface-variant">{version.description[locale]}</p>
                        </div>
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-outline-variant/40 pt-3 text-xs">
                        {(
                          [
                            ["views", number(version.views)],
                            ["completion", `${version.completion}%`],
                            ["engagement", `${version.engagement}%`],
                          ] as const
                        ).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-muted">{t(`lab.stats.${key}`)}</dt>
                            <dd className="mt-1 font-mono text-sm font-semibold text-primary" dir="ltr">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Scoring panel */}
        <aside className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
          <h3 className="text-lg font-extrabold">{t("rating.title")}</h3>
          <ul className="mt-4 flex flex-col gap-4">
            {criteria.map((key) => (
              <li key={key}>
                <div className="flex items-center justify-between text-sm">
                  <span>{t(`rating.criteria.${key}`)}</span>
                  <span className="font-mono text-xs" dir="ltr">
                    {ratings[key]}/5
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label={t(`rating.criteria.${key}`)}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={ratings[key] === value}
                      aria-label={`${value}/5`}
                      onClick={() => onRate(idea.id, key, value)}
                      className={cn(
                        "h-2.5 flex-1 rounded-full transition-colors",
                        value <= ratings[key] ? "bg-tertiary" : "bg-surface-container hover:bg-tertiary/30",
                      )}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between border-t border-outline-variant/40 pt-4">
            <span className="font-bold">{t("rating.total")}</span>
            <span className="font-mono text-xl font-bold" dir="ltr">
              {total}/20
            </span>
          </div>

          <label htmlFor="lab-notes" className="mt-4 block text-sm text-on-surface-variant">
            {t("rating.notes")}
          </label>
          <textarea
            id="lab-notes"
            rows={4}
            value={notes[idea.id] ?? ""}
            onChange={(event) => onNotes(idea.id, event.target.value)}
            placeholder={t("rating.notesPlaceholder")}
            className="mt-2 w-full resize-y rounded-md bg-surface-container-low p-3 text-sm outline-none placeholder:text-muted focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
          />

          <p className="mt-4 font-bold">{t("rating.decision")}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["continue", "revise", "cancel"] as const).map((decision) => (
              <button
                key={decision}
                type="button"
                onClick={() => onDecide(idea.id, decision)}
                className={cn(
                  "h-11 rounded-sm text-sm font-bold transition-colors ghost-border",
                  decision === "continue" && "hover:bg-success-container hover:text-success",
                  decision === "revise" && "hover:bg-tertiary-fixed hover:text-tertiary",
                  decision === "cancel" && "hover:bg-danger-container hover:text-danger",
                )}
              >
                {t(`rating.decisions.${decision}`)}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
