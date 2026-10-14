"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, BellRing, ChartColumn, ChevronDown, Lightbulb, PieChart, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { MARGIN_GREEN, MARGIN_RED, type ClientMonth, type ClientReport, type ProfitReport, type ProfitSettings, type Zone } from "../calc";
import { ProfitabilitySettingsForm } from "./settings-form";

type Localized = { ar: string; en: string };
type SortKey = "name" | "margin" | "effectiveHourly" | "usage" | "avgRevisions" | "latePaymentDays" | "profit";

const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits });
/** A percentage as a left-to-right island (Unicode isolates), safe inside right-to-left text */
const pct = (n: number, digits = 0) => `\u2066${fmt(n, digits)}%\u2069`;

const zoneStyle: Record<Zone, string> = {
  green: "bg-success-container text-success",
  yellow: "bg-tertiary-fixed text-tertiary",
  red: "bg-danger-container text-danger",
  insufficient: "bg-surface-container text-on-surface-variant",
};

/**
 * Marketing → Client profitability (owner and admins): the report, and for the owner «إعدادات الربحية»
 * (standard times, revision time, monthly costs). `settings` null = no settings tab for this viewer.
 */
export function ProfitabilitySection({
  report,
  settings = null,
  companyId,
  demo = false,
}: {
  report: ProfitReport;
  settings?: ProfitSettings | null;
  companyId: string;
  demo?: boolean;
}) {
  const t = useTranslations("profitability");
  const [tab, setTab] = useState<"report" | "settings">("report");
  return (
    <div className="flex flex-col gap-5">
      {settings && (
        <div role="tablist" className="flex w-fit gap-1 rounded-full bg-surface-container-low p-1">
          {(["report", "settings"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                tab === key ? "bg-surface-container-lowest text-primary shadow-ambient" : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {key === "report" ? <ChartColumn className="size-4" aria-hidden /> : <SlidersHorizontal className="size-4" aria-hidden />}
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>
      )}
      {tab === "settings" && settings ? <ProfitabilitySettingsForm companyId={companyId} settings={settings} demo={demo} /> : <ProfitabilityReport report={report} />}
    </div>
  );
}

/** The report itself. Everything is computed on the server (modules/profitability/calc.ts); this only filters, sorts and shows it. */
function ProfitabilityReport({ report }: { report: ProfitReport }) {
  const t = useTranslations("profitability");
  const locale = useLocale() as "ar" | "en";
  const text = (v: Localized) => v[locale] || v.ar || v.en;
  const [month, setMonth] = useState(report.months[report.months.length - 1]);
  const [sector, setSector] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "margin", desc: false });
  const [open, setOpen] = useState<string | null>(null);

  const monthName = (m: string) =>
    new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const money = (n: number) => (
    <span className="whitespace-nowrap">
      <span dir="ltr" className="font-mono">{fmt(n)}</span> {t("currency")}
    </span>
  );

  const sectors = useMemo(() => {
    const seen = new Map<string, Localized>();
    for (const c of report.clients) seen.set(c.sector.ar || c.sector.en, c.sector);
    return [...seen.entries()];
  }, [report.clients]);

  const rows = useMemo(() => {
    const list = report.clients.filter((c) => !sector || (c.sector.ar || c.sector.en) === sector);
    const value = (c: ClientReport): number | string | null => {
      const m = c.months[month];
      return sort.key === "name" ? text(c.name) : m[sort.key];
    };
    return [...list].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      // Missing numbers ("insufficient data") always go last
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === "string" ? va.localeCompare(String(vb), locale) : (va as number) - (vb as number);
      return sort.desc ? -cmp : cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.clients, sector, sort, month, locale]);

  const alerts = rows.filter((c) => c.months[month].alerts.length > 0);
  const insufficient = <span className="text-xs text-on-surface-variant">{t("insufficient")}</span>;

  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
    return (
      <th className="whitespace-nowrap px-4 py-3 text-start font-semibold" aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" && key !== "latePaymentDays" && key !== "avgRevisions" }))}
          className={cn("inline-flex items-center gap-1 hover:text-on-surface", active && "text-tertiary")}
        >
          {label}
          <Icon className="size-3.5" aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
          {t("month")}
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface ghost-border">
            {[...report.months].reverse().map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
          {t("sector")}
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface ghost-border">
            <option value="">{t("allSectors")}</option>
            {sectors.map(([key, label]) => (
              <option key={key} value={key}>
                {text(label)}
              </option>
            ))}
          </select>
        </label>
        <p className="ms-auto text-sm text-on-surface-variant">
          {report.hourlyCost === null ? (
            <span className="text-danger">{t("noSettings")}</span>
          ) : (
            <>
              {t("hourlyCost")}: {money(report.hourlyCost)}
            </>
          )}
        </p>
      </div>

      {/* Alerts for the owner */}
      {alerts.length > 0 && (
        <section aria-label={t("alertsTitle")} className="rounded-lg bg-danger-container/50 p-4 ghost-border">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-danger">
            <BellRing className="size-4" aria-hidden />
            {t("alertsTitle")}
          </h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {alerts.map((c) => {
              const m = c.months[month];
              const parts = m.alerts.map((kind) =>
                kind === "package"
                  ? t("alert.package", { usage: pct(m.usage ?? 0) })
                  : kind === "margin"
                    ? t("alert.margin", { margin: pct(m.margin ?? 0, 1) })
                    : t("alert.revisions", { avg: fmt(m.avgRevisions ?? 0, 1), allowed: m.allowedRevisions ?? 0 }),
              );
              return (
                <li key={c.id} className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  <span>
                    <b>{text(c.name)}</b> {parts.join(t("and"))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Table */}
      <section className="overflow-hidden rounded-lg bg-surface-container-lowest shadow-ambient ghost-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant">
              <tr>
                {header("name", t("cols.client"))}
                {header("margin", t("cols.margin"))}
                {header("effectiveHourly", t("cols.effectiveHourly"))}
                {header("usage", t("cols.usage"))}
                {header("avgRevisions", t("cols.avgRevisions"))}
                {header("latePaymentDays", t("cols.lateDays"))}
                {header("profit", t("cols.profit"))}
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const m = c.months[month];
                const expanded = open === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      onClick={() => setOpen(expanded ? null : c.id)}
                      className={cn("cursor-pointer border-t border-outline-variant/20 hover:bg-tertiary-fixed/40", expanded && "bg-tertiary-fixed/30")}
                    >
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{text(c.name)}</span>
                        <span className="block text-xs text-on-surface-variant">{text(c.sector)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {m.margin === null ? (
                          insufficient
                        ) : (
                          <span className={cn("inline-flex rounded-full px-3 py-1 font-mono text-xs font-bold", zoneStyle[m.zone])} dir="ltr">
                            {fmt(m.margin, 1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{m.effectiveHourly === null ? insufficient : money(m.effectiveHourly)}</td>
                      <td className="px-4 py-3">
                        {m.agreed === null ? (
                          <span className="text-xs text-on-surface-variant">{t("noPackage")}</span>
                        ) : (
                          <span className={cn((m.usage ?? 0) > 100 && "font-bold text-danger")}>
                            {t("delivered", { delivered: m.delivered, agreed: m.agreed })}
                            <span className="ms-1 font-mono text-xs" dir="ltr">({fmt(m.usage ?? 0)}%)</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <bdi dir="ltr">
                          {m.avgRevisions === null ? "—" : fmt(m.avgRevisions, 1)}
                          {m.allowedRevisions !== null && <span className="text-xs text-on-surface-variant"> / {m.allowedRevisions}</span>}
                        </bdi>
                      </td>
                      <td className="px-4 py-3">{m.latePaymentDays === null ? "—" : t("days", { count: m.latePaymentDays })}</td>
                      <td className="px-4 py-3">{m.profit === null ? insufficient : <span className={cn(m.profit < 0 && "text-danger")}>{money(m.profit)}</span>}</td>
                      <td className="px-2 py-3">
                        <ChevronDown className={cn("size-4 text-on-surface-variant transition-transform", expanded && "rotate-180")} aria-hidden />
                        <span className="sr-only">{t("details")}</span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={8} className="bg-surface-container-low/60 px-4 py-4">
                          <ClientDetails client={c} month={month} months={report.months} monthName={monthName} money={money} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
        <span className={cn("rounded-full px-2 py-0.5", zoneStyle.green)}>{t("legend.green", { value: pct(MARGIN_GREEN) })}</span>
        <span className={cn("rounded-full px-2 py-0.5", zoneStyle.yellow)}>{t("legend.yellow", { range: `\u2066${MARGIN_RED}–${MARGIN_GREEN}%\u2069` })}</span>
        <span className={cn("rounded-full px-2 py-0.5", zoneStyle.red)}>{t("legend.red", { value: pct(MARGIN_RED) })}</span>
      </p>

      {/* Sector averages (pricing new clients) */}
      <section className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
        <h3 className="mb-1 flex items-center gap-2 font-bold">
          <PieChart className="size-4 text-tertiary" aria-hidden />
          {t("sectorsTitle")}
        </h3>
        <p className="mb-3 text-sm text-on-surface-variant">{t("sectorsHint")}</p>
        {report.sectors[month]?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.sectors[month].map((s) => (
              <li key={s.sector.ar || s.sector.en} className="rounded-md bg-surface-container-low p-3">
                <span className="block font-semibold">{text(s.sector)}</span>
                <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 font-mono text-xs font-bold", zoneStyle[zoneFor(s.margin)])} dir="ltr">
                  {fmt(s.margin, 1)}%
                </span>
                <span className="mt-1 block text-xs text-on-surface-variant">
                  {t("cols.effectiveHourly")}: {money(s.effectiveHourly)} · {t("clientsCount", { count: s.clients })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">{t("insufficient")}</p>
        )}
      </section>
    </div>
  );
}

const zoneFor = (margin: number): Zone => (margin > MARGIN_GREEN ? "green" : margin >= MARGIN_RED ? "yellow" : "red");

function ClientDetails({
  client,
  month,
  months,
  monthName,
  money,
}: {
  client: ClientReport;
  month: string;
  months: string[];
  monthName: (m: string) => string;
  money: (n: number) => React.ReactNode;
}) {
  const t = useTranslations("profitability");
  const m = client.months[month];
  const parts = [
    { key: "tasks", hours: m.hours.tasks, className: "bg-tertiary" },
    { key: "revisions", hours: m.hours.revisions, className: "bg-danger" },
    { key: "meetings", hours: m.hours.meetings, className: "bg-primary" },
  ] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="mb-2 text-sm font-bold">{t("hoursTitle", { hours: fmt(m.hours.total, 1) })}</h4>
          {m.hours.total > 0 ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-container">
                {parts.map((p) => (
                  <div key={p.key} className={p.className} style={{ width: `${(p.hours / m.hours.total) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-4 text-xs">
                {parts.map((p) => (
                  <li key={p.key} className="flex items-center gap-1.5">
                    <span className={cn("size-2.5 rounded-full", p.className)} />
                    {t(`hours.${p.key}`)}: <b dir="ltr">{fmt(p.hours, 1)}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">{t("insufficient")}</p>
          )}
          {m.untimedTasks > 0 && <p className="mt-2 text-xs text-tertiary">{t("untimed", { count: m.untimedTasks })}</p>}
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {(
            [
              ["income", m.income],
              ["teamCost", m.teamCost],
              ["freelancers", m.freelancers],
              ["profit", m.profit],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-md bg-surface-container-lowest p-2.5">
              <dt className="text-xs text-on-surface-variant">{t(`money.${key}`)}</dt>
              <dd className="font-semibold">{value === null ? t("insufficient") : money(value)}</dd>
            </div>
          ))}
        </dl>

        {!m.sufficient && (
          <p className="text-xs text-on-surface-variant">{t("missing", { list: m.missing.map((k) => t(`missingItem.${k}`)).join("، ") })}</p>
        )}

        {m.recommendation && <RecommendationCard m={m} money={money} />}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold">{t("historyTitle")}</h4>
        <table className="w-full text-xs">
          <thead className="text-on-surface-variant">
            <tr>
              {["month", "margin", "hours", "income", "usage"].map((k) => (
                <th key={k} className="py-1.5 text-start font-semibold">
                  {t(`history.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((key) => {
              const h: ClientMonth = client.months[key];
              return (
                <tr key={key} className={cn("border-t border-outline-variant/20", key === month && "font-bold")}>
                  <td className="py-1.5">{monthName(key)}</td>
                  <td className="py-1.5">
                    {h.margin === null ? (
                      "—"
                    ) : (
                      <span className={cn("rounded-full px-2 py-0.5 font-mono", zoneStyle[h.zone])} dir="ltr">
                        {fmt(h.margin, 1)}%
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 font-mono">
                    <bdi dir="ltr">{fmt(h.hours.total, 1)}</bdi>
                  </td>
                  <td className="py-1.5">{h.income ? money(h.income) : "—"}</td>
                  <td className="py-1.5 font-mono">
                    <bdi dir="ltr">{h.usage === null ? "—" : `${fmt(h.usage)}%`}</bdi>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecommendationCard({ m, money }: { m: ClientMonth; money: (n: number) => React.ReactNode }) {
  const t = useTranslations("profitability");
  const r = m.recommendation!;
  const n = (v: number, d = 0) => fmt(v, d);
  const body =
    r.cause === "revisions"
      ? t.rich("advice.revisions", { extra: r.extraRevisions, hours: n(r.extraRevisionHours, 1), cost: () => money(r.extraRevisionCost) })
      : r.cause === "scope"
        ? t.rich("advice.scope", { delivered: r.delivered, agreed: r.agreed ?? 0, fee: () => money(r.upgradeFee ?? 0) })
        : r.cause === "meetings"
          ? t.rich("advice.meetings", { hours: n(r.meetingHours, 1), share: pct(r.meetingShare) })
          : t.rich("advice.price", { cost: () => money(r.cost), income: () => money(m.income), target: () => money(r.targetFee), pct: `\u2066+${fmt(r.targetIncreasePct ?? 0, 1)}%\u2069` });
  return (
    <div className="rounded-md bg-surface-container-lowest p-3 ghost-border">
      <h5 className="mb-1 flex items-center gap-2 text-sm font-bold text-tertiary">
        <Lightbulb className="size-4" aria-hidden />
        {t(`causes.${r.cause}`)}
      </h5>
      <p className="text-sm">{body}</p>
      {r.chronic && <p className="mt-2 text-sm font-semibold text-danger">{t("advice.chronic")}</p>}
    </div>
  );
}
