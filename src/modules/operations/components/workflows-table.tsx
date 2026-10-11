"use client";

import {
  Archive,
  Bot,
  CircleCheck,
  Download,
  EllipsisVertical,
  FileText,
  Fingerprint,
  ListFilter,
  ScrollText,
  SquareTerminal,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RowNature, RowStatus, WorkflowRow } from "../mock";

const natureStyle: Record<RowNature, { className: string; icon: LucideIcon }> = {
  human: { className: "bg-danger-container text-danger", icon: Fingerprint },
  automated: { className: "bg-primary-fixed text-primary", icon: Bot },
  autoCompleted: { className: "bg-primary-fixed/60 text-primary", icon: CircleCheck },
};

const statusStyle: Record<RowStatus, string> = {
  pending: "bg-danger-container text-danger",
  processing: "bg-primary-fixed text-primary",
  done: "bg-primary-fixed text-primary",
  review: "bg-surface-container text-on-surface-variant",
};

const stepTone = { danger: "text-danger", info: "text-primary", muted: "text-muted" } as const;

const avatarTint = ["bg-tertiary-fixed text-tertiary", "bg-primary-fixed text-primary", "bg-surface-container text-on-surface"];

/** Actions shown per row depend on the row's state. */
function rowActions(row: WorkflowRow): { key: string; icon: LucideIcon }[] {
  if (row.status === "done") return [{ key: "report", icon: FileText }, { key: "archive", icon: Archive }];
  if (row.nature === "automated") return [{ key: "logs", icon: SquareTerminal }, { key: "openFlow", icon: Workflow }];
  return [{ key: "run", icon: Zap }, { key: "openFlow", icon: Workflow }];
}

export function WorkflowsTable({ rows, onNotice }: { rows: WorkflowRow[]; onNotice: (message: string) => void }) {
  const t = useTranslations("ops");
  const locale = useLocale() as "ar" | "en";
  const [status, setStatus] = useState<RowStatus | "all">("all");
  const visible = status === "all" ? rows : rows.filter((row) => row.status === status);

  return (
    <section className="min-w-0 rounded-lg bg-surface-container-lowest shadow-ambient">
      <header className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <ScrollText className="size-6 text-on-surface" aria-hidden />
          <h2 className="text-lg font-extrabold">{t("table.title")}</h2>
          <span className="rounded-sm bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
            {t("table.shown", { count: visible.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative flex items-center">
            <ListFilter className="pointer-events-none absolute start-3 size-4 text-muted" aria-hidden />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as RowStatus | "all")}
              className="h-10 appearance-none rounded-sm bg-surface-container-low pe-4 ps-9 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">{t("table.allStatuses")}</option>
              {(Object.keys(statusStyle) as RowStatus[]).map((key) => (
                <option key={key} value={key}>
                  {t(`table.status.${key}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label={t("table.export")}
            onClick={() => onNotice(t("comingSoon"))}
            className="grid size-10 place-items-center rounded-sm bg-surface-container-low hover:bg-surface-container"
          >
            <Download className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-container-low text-xs text-on-surface-variant">
            <tr>
              {(["process", "owner", "step", "nature", "deciders", "status", "actions"] as const).map((col) => (
                <th key={col} scope="col" className="whitespace-nowrap px-3 py-3 text-start font-semibold">
                  {t(`table.cols.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  {t("table.empty")}
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const nature = natureStyle[row.nature];
              const NatureIcon = nature.icon;
              return (
                <tr key={row.id} className="align-middle transition-colors even:bg-surface-container-low/40 hover:bg-primary-fixed/20">
                  <td className="px-3 py-4">
                    <p className="min-w-40 font-semibold leading-snug">{row.title[locale]}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span className="whitespace-nowrap font-mono" dir="ltr">{row.code}</span>·<span>{row.categoryLabel[locale]}</span>
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
                        {row.owner.bot ? <Bot className="size-4" aria-hidden /> : row.owner.name[locale].charAt(0)}
                      </span>
                      <span>
                        <span className="block whitespace-nowrap font-semibold">{row.owner.name[locale]}</span>
                        <span className="block whitespace-nowrap text-xs text-muted">{row.owner.role[locale]}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <p className="min-w-36 leading-snug">{row.step.title[locale]}</p>
                    <p className={cn("mt-1 text-xs", stepTone[row.step.tone])}>{row.step.by[locale]}</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-xs font-semibold", nature.className)}>
                      <NatureIcon className="size-3.5" aria-hidden />
                      {t(`table.nature.${row.nature}`)}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    {Array.isArray(row.deciders) ? (
                      <div className="flex -space-x-2 rtl:space-x-reverse">
                        {row.deciders.map((initial, index) => (
                          <span
                            key={initial + index}
                            className={cn(
                              "grid size-8 place-items-center rounded-full text-xs font-bold ring-2 ring-surface-container-lowest",
                              avatarTint[index % avatarTint.length],
                            )}
                          >
                            {initial}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">{row.deciders[locale]}</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", statusStyle[row.status])}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {t(`table.status.${row.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1">
                      {rowActions(row).map(({ key, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          title={t(`table.${key}`)}
                          aria-label={t(`table.${key}`)}
                          onClick={() => onNotice(t("comingSoon"))}
                          className="grid size-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary"
                        >
                          <Icon className="size-4" aria-hidden />
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label={t("table.more")}
                        onClick={() => onNotice(t("comingSoon"))}
                        className="grid size-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
                      >
                        <EllipsisVertical className="size-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 p-5 text-xs text-muted">
        <span dir="ltr" className="font-mono">
          LATENCY: 18ms • SYNCHRONIZATION: LIVE_WEBSOCKET
        </span>
        <div className="flex items-center gap-2">
          <button type="button" disabled className="rounded-sm bg-surface-container-low px-3 py-1.5 disabled:opacity-50">
            {t("table.prev")}
          </button>
          <span className="font-mono" dir="ltr">
            1 / 1
          </span>
          <button type="button" disabled className="rounded-sm bg-surface-container-low px-3 py-1.5 disabled:opacity-50">
            {t("table.next")}
          </button>
        </div>
      </footer>
    </section>
  );
}
