"use client";

import {
  AlarmClock,
  CalendarClock,
  ChevronDown,
  CircleHelp,
  Gauge,
  Hourglass,
  Info,
  ListTodo,
  Target,
  TimerReset,
  UserRoundX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/modules/hours/calc";
import { MIN_SAMPLE, NO_DEPARTMENT, TARGET, WAITING_DAYS, type Bottleneck, type DepartmentStats, type Ratio } from "../calc";
import type { AnalyticsData } from "../service";

const dot: Record<string, string> = { blue: "bg-[#2563eb]", violet: "bg-[#7c3aed]", amber: "bg-[#d97706]", emerald: "bg-[#059669]", slate: "bg-on-surface-variant" };

function recentMonths(today: string) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Analytics room: departments side by side for one month (delivery, timeliness, overdue work, flow, hours,
 * waiting approvals and stuck operations), the bottlenecks with their evidence, and how each number is computed.
 * Read-only. Departments and people the caller may not see never reach this component (decided on the server).
 */
export function AnalyticsView({ data, companySlug, demo }: { data: AnalyticsData; companySlug: string; demo: boolean }) {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "ar";
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);

  const monthName = (m: string) => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const readAt = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: "medium", timeStyle: "short", timeZone: data.timeZone }).format(new Date(data.readAt));
  const deptName = (id: string) => data.departments.find((d) => d.id === id)?.name[lang] ?? "";
  const s = data.summary;

  const tiles: { key: string; icon: LucideIcon; value: string; sub: string; tone?: string }[] = [
    { key: "onTarget", icon: Target, value: `${s.onTarget} / ${s.departments}`, sub: t("tiles.onTargetSub", { known: s.known, target: pct(TARGET) }) },
    { key: "overdue", icon: AlarmClock, value: String(s.overdue), sub: t("tiles.overdueSub"), tone: s.overdue ? "text-danger" : undefined },
    {
      key: "timeliness",
      icon: TimerReset,
      value: s.timeliness.insufficient || s.timeliness.value === null ? "—" : pct(s.timeliness.value),
      sub: s.timeliness.insufficient ? t("insufficient", { n: s.timeliness.sample }) : t("tiles.timelinessSub", { n: s.timeliness.sample }),
    },
    { key: "waiting", icon: Hourglass, value: String(s.waiting), sub: t("tiles.waitingSub"), tone: s.waiting ? "text-on-secondary-container" : undefined },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
            <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
            <p className="mt-2 text-xs text-on-surface-variant">{t("readAt", { time: readAt })}</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" aria-hidden />
            {t("month")}
            <Select value={data.month} onChange={(e) => router.push(`/c/${companySlug}/analytics?month=${e.target.value}`)} className="h-10 w-44" aria-label={t("month")}>
              {recentMonths(data.today).map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </Select>
          </label>
        </header>

        {demo && <p className="rounded-lg bg-surface-container-low px-5 py-3 text-sm text-on-surface-variant">{t("demoNotice")}</p>}

        {data.departments.length === 0 ? (
          <p className="rounded-xl bg-surface-container-lowest p-8 text-center text-on-surface-variant shadow-ambient">{t("empty")}</p>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tiles.map(({ key, icon: Icon, value, sub, tone }) => (
                <li key={key} className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
                  <span className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                    <Icon className="size-4 text-primary" aria-hidden />
                    {t(`tiles.${key}`)}
                  </span>
                  <span dir="ltr" className={cn("text-start text-3xl font-black rtl:text-end", tone)}>
                    {value}
                  </span>
                  <span className="text-xs text-on-surface-variant">{sub}</span>
                </li>
              ))}
            </ul>

            <section className="rounded-xl bg-surface-container-lowest shadow-ambient">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 px-5 py-4">
                <h3 className="text-lg font-bold">{t("compare.title", { month: monthName(data.month) })}</h3>
                <span className="text-xs text-on-surface-variant">{t("compare.hint")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="text-start text-xs text-on-surface-variant">
                      {(["department", "status", "delivery", "timeliness", "overdue", "cycle", "load", "hours", "waiting"] as const).map((c) => (
                        <th key={c} scope="col" className="px-4 py-3 text-start font-semibold">
                          {t(`compare.cols.${c}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.departments.map((d) => (
                      <Fragment key={d.id}>
                        <tr className="border-t border-outline-variant/30 align-top">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setOpen(open === d.id ? null : d.id)}
                              aria-expanded={open === d.id}
                              className="flex items-center gap-2 text-start font-bold hover:text-primary"
                            >
                              <span className={cn("size-2.5 shrink-0 rounded-full", dot[d.color] ?? dot.slate)} aria-hidden />
                              {d.id === NO_DEPARTMENT ? t("noDepartment") : d.name[lang]}
                              <ChevronDown className={cn("size-4 transition-transform", open === d.id && "rotate-180")} aria-hidden />
                            </button>
                            <span className="ms-4.5 text-xs text-on-surface-variant">{t("members", { n: d.members })}</span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusChip status={d.status} />
                          </td>
                          <td className="px-4 py-3">
                            <RatioBar r={d.delivery} />
                          </td>
                          <td className="px-4 py-3">
                            <RatioBar r={d.timeliness} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("font-bold", d.overdue.count && "text-danger")}>{d.overdue.count}</span>
                            {d.overdue.count > 0 && <span className="block text-xs text-on-surface-variant">{t("oldestDays", { n: d.overdue.oldestDays })}</span>}
                          </td>
                          <td className="px-4 py-3">
                            {d.medianCycleDays === null ? "—" : t("days", { n: d.medianCycleDays })}
                            <span className="block text-xs text-on-surface-variant">{t("doneCount", { n: d.doneCount })}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold">{d.openPerMember}</span>
                            <span className="block text-xs text-on-surface-variant">{t("openCount", { n: d.open })}</span>
                          </td>
                          <td className="px-4 py-3">
                            <RatioBar r={d.capacity} sample={false} />
                            {d.capacity.expectedMinutes > 0 && (
                              <span className="block text-xs text-on-surface-variant" dir="ltr">
                                {formatMinutes(d.capacity.loggedMinutes)} / {formatMinutes(d.capacity.expectedMinutes)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="block">{t("approvalsN", { n: d.waitingApprovals.count })}</span>
                            <span className={cn("block text-xs", d.stuckRuns.count ? "text-on-secondary-container" : "text-on-surface-variant")}>{t("stuckN", { n: d.stuckRuns.count })}</span>
                          </td>
                        </tr>
                        {open === d.id && (
                          <tr className="bg-surface-container-low/60">
                            <td colSpan={9} className="px-4 py-4">
                              <DepartmentDetails d={d} canSeeMembers={data.canSeeMembers} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
              <h3 className="text-lg font-bold">{t("bottlenecks.title")}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{t("bottlenecks.hint")}</p>
              {data.bottlenecks.length === 0 ? (
                <p className="mt-4 text-sm text-on-surface-variant">{t("bottlenecks.none")}</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {data.bottlenecks.map((b, i) => (
                    <BottleneckItem key={i} b={b} deptName={deptName} names={data.names} lang={lang} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <details className="group rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-bold">
            <CircleHelp className="size-5 text-primary" aria-hidden />
            {t("help.title")}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            {(["delivery", "timeliness", "overdue", "cycle", "load", "hours", "waiting", "status", "sample", "department"] as const).map((k) => (
              <div key={k}>
                <dt className="font-bold">{t(`help.${k}.title`)}</dt>
                <dd className="mt-1 text-on-surface-variant">{t(`help.${k}.text`, { min: MIN_SAMPLE, target: pct(TARGET), days: WAITING_DAYS })}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t("help.fairness")}
          </p>
        </details>
      </div>
    </div>
  );
}

function RatioBar({ r, sample = true }: { r: Ratio; sample?: boolean }) {
  const t = useTranslations("analytics");
  if (r.insufficient || r.value === null) return <span className="text-xs text-on-surface-variant">{sample ? t("insufficient", { n: r.sample }) : "—"}</span>;
  const good = r.value >= TARGET;
  return (
    <div className="flex min-w-24 flex-col gap-1">
      <span className="flex items-baseline gap-1">
        <span className="font-bold">{pct(r.value)}</span>
        {sample && <span className="text-xs text-on-surface-variant">({r.sample})</span>}
      </span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden>
        <span className={cn("block h-full rounded-full", good ? "bg-success" : "bg-tertiary")} style={{ width: `${Math.min(100, Math.round(r.value * 100))}%` }} />
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: DepartmentStats["status"] }) {
  const t = useTranslations("analytics");
  const tone = status === "on_target" ? "bg-success-container text-success" : status === "behind" ? "bg-danger-container text-danger" : "bg-surface-container text-on-surface-variant";
  return <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", tone)}>{t(`status.${status}`)}</span>;
}

function DepartmentDetails({ d, canSeeMembers }: { d: DepartmentStats; canSeeMembers: boolean }) {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "ar";
  if (!d.people) {
    return (
      <p className="flex items-center gap-2 text-sm text-on-surface-variant">
        <Users className="size-4" aria-hidden />
        {canSeeMembers ? t("details.notThisDepartment") : t("details.noPeople")}
      </p>
    );
  }
  if (!d.people.length) return <p className="text-sm text-on-surface-variant">{t("details.empty")}</p>;
  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-on-surface-variant">
            {(["person", "open", "overdue", "done", "timeliness", "hours"] as const).map((c) => (
              <th key={c} scope="col" className="px-3 py-2 text-start font-semibold">
                {t(`details.cols.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.people.map((p) => (
            <tr key={p.id} className="border-t border-outline-variant/30">
              <td className="px-3 py-2">
                <span className="font-semibold">{p.name[lang]}</span>
                {p.title && <span className="block text-xs text-on-surface-variant">{p.title[lang]}</span>}
              </td>
              <td className="px-3 py-2">{p.open}</td>
              <td className={cn("px-3 py-2", p.overdue && "font-bold text-danger")}>{p.overdue}</td>
              <td className="px-3 py-2">{p.done}</td>
              <td className="px-3 py-2">
                <RatioBar r={p.timeliness} />
              </td>
              <td className="px-3 py-2" dir="ltr">
                <span className="block text-start rtl:text-end">
                  {formatMinutes(p.loggedMinutes)} / {formatMinutes(p.expectedMinutes)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-on-surface-variant">{t("details.note")}</p>
    </div>
  );
}

const bottleneckIcon: Record<Bottleneck["kind"], LucideIcon> = {
  overdue: AlarmClock,
  approvals: Hourglass,
  stuck: TimerReset,
  overload: ListTodo,
  hours: Gauge,
  unowned: UserRoundX,
};

function BottleneckItem({ b, deptName, names, lang }: { b: Bottleneck; deptName: (id: string) => string; names: AnalyticsData["names"]; lang: "ar" | "en" }) {
  const t = useTranslations("analytics.bottlenecks");
  const Icon = bottleneckIcon[b.kind];
  const dept = "departmentId" in b ? (b.departmentId === NO_DEPARTMENT ? t("noDepartment") : deptName(b.departmentId)) : "";
  let text: string;
  switch (b.kind) {
    case "overdue":
      text = t("overdue", { dept, count: b.count, days: b.days });
      break;
    case "approvals":
      text = b.memberId && names[b.memberId] ? t("approvalsPerson", { dept, name: names[b.memberId][lang], count: b.count, days: b.days }) : t("approvals", { dept, count: b.count, days: b.days });
      break;
    case "stuck":
      text = t("stuck", { dept, count: b.count, days: b.days, codes: b.codes.join(lang === "ar" ? "، " : ", ") });
      break;
    case "overload":
      text = t("overload", { dept, perMember: b.perMember, average: b.average });
      break;
    case "hours":
      text = t("hours", { dept, value: pct(b.value) });
      break;
    case "unowned":
      text = t("unowned", { count: b.count });
      break;
  }
  return (
    <li className="flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-on-secondary-container" aria-hidden />
      <div>
        <p className="font-semibold">{text}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{t(`advice.${b.kind}`)}</p>
      </div>
    </li>
  );
}
