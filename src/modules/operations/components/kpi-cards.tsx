"use client";

import { ClipboardClock, Network, Timer, TrendingUp, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { OpsKpis } from "../rows";

/** The headline metrics shown behind the Analysis button (last {periodDays} days of operations). */
export function KpiCards({ kpis }: { kpis: OpsKpis }) {
  const t = useTranslations("ops.kpi");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <KpiCard code="TOTAL_ACTIVE_WORKFLOWS" label={t("active")} icon={Network} iconClass="bg-surface-container-low text-on-surface">
        <div className="flex items-end justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold">{kpis.active}</span>
            <span className="text-sm text-on-surface-variant">{t("activeUnit")}</span>
          </p>
          {kpis.trend && (
            <span dir="ltr" className="flex items-center gap-1 rounded-sm bg-primary-fixed/60 px-2 py-1 font-mono text-xs font-semibold text-primary">
              <TrendingUp className="size-3.5" aria-hidden />
              {kpis.trend}
            </span>
          )}
        </div>
        <Progress value={kpis.total ? kpis.active / kpis.total : 0} className="bg-tertiary" />
      </KpiCard>

      <KpiCard
        code="ACTION_REQUIRED_QUEUE"
        codeClass="text-danger"
        label={t("pending")}
        icon={ClipboardClock}
        iconClass="bg-danger-container text-danger"
      >
        <div className="flex items-end justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold text-danger">{kpis.pending}</span>
            <span className="text-sm text-on-surface-variant">{t("pendingSub")}</span>
          </p>
          {kpis.pending > 0 && <span className="rounded-sm bg-danger-container px-2 py-1 text-xs font-bold text-danger">{t("critical")}</span>}
        </div>
        {kpis.oldest && (
          <p className="mt-4 flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-danger" />
            {t("oldest", kpis.oldest)}
          </p>
        )}
      </KpiCard>

      <KpiCard code="CYCLE_LATENCY_METRIC" label={t("cycle")} icon={Timer} iconClass="bg-tertiary-fixed text-secondary-container">
        <div className="flex items-end justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold">{kpis.cycleHours ?? "—"}</span>
            <span className="text-sm text-on-surface-variant">{t("hours")}</span>
          </p>
          {kpis.previousHours !== undefined && (
            <span className="text-xs text-muted line-through">
              {kpis.previousHours} {t("hours")} {t("previously")}
            </span>
          )}
        </div>
        {kpis.saved !== undefined ? (
          <p className="mt-4 text-xs font-semibold text-tertiary">{t("saved", { percent: kpis.saved })}</p>
        ) : (
          <p className="mt-4 text-xs text-on-surface-variant">{t("period", { days: kpis.periodDays })}</p>
        )}
      </KpiCard>
    </div>
  );
}

function KpiCard({
  code,
  codeClass,
  label,
  icon: Icon,
  iconClass,
  children,
}: {
  code: string;
  codeClass?: string;
  label: string;
  icon: LucideIcon;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col justify-between gap-5 rounded-lg bg-surface-container-lowest p-5 shadow-ambient">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p dir="ltr" className={cn("text-left font-mono text-[11px] tracking-wider text-muted rtl:text-right", codeClass)}>
            {code}
          </p>
          <h3 className="mt-1 font-bold">{label}</h3>
        </div>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-md", iconClass)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Progress({ value, className }: { value: number; className: string }) {
  return (
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
