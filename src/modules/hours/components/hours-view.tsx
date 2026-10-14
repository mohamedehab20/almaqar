"use client";

import {
  AlarmClock,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Hourglass,
  Play,
  Plus,
  Settings2,
  Square,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import {
  addWorkSession,
  clockIn,
  clockOut,
  deleteWorkSession,
  saveWorkSettings,
} from "../actions";
import {
  checkManualEntry,
  dailyMinutes,
  formatMinutes,
  localParts,
  sessionMinutes,
  summarizeMonth,
  TIME_ZONES,
  toMinutes,
  type DayRow,
  type DayStatus,
  type MonthSummary,
  type WorkSession,
  type WorkSettings,
} from "../calc";
import type { WorkHoursData } from "../service";

type Tab = "mine" | "team" | "settings";

const statusStyle: Record<DayStatus, string> = {
  worked: "bg-success-container text-success",
  late: "bg-secondary-container text-on-secondary-container",
  absent: "bg-danger-container text-danger",
  leave: "bg-primary-fixed text-primary",
  weekend: "bg-surface-container text-muted",
  today: "bg-tertiary-fixed text-tertiary",
  future: "bg-surface-container-low text-muted",
};
const inputClass =
  "h-10 w-full rounded-md bg-surface-container-lowest px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";

/** Last six months, newest first ("YYYY-MM"). */
function recentMonths(today: string) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) =>
    new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7),
  );
}

/** Hours with a sign, wrapped so "+3:20" keeps its sign on the right side in Arabic text. */
const signed = (minutes: number) =>
  `⁦${minutes > 0 ? "+" : ""}${formatMinutes(minutes)}⁩`;

/**
 * HR → Working hours: clock in / out, the month day by day (worked, late, absent, leave), hours typed by hand,
 * the team's month for whoever follows it (hours.manage), and the company's working day.
 * `companyId` null = the public demo (changes stay in the browser).
 */
export function HoursView({
  data,
  companyId,
  hrHref,
}: {
  data: WorkHoursData;
  companyId: string | null;
  hrHref: string;
}) {
  const t = useTranslations("hours");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const demo = companyId === null;
  const [pending, startTransition] = useTransition();

  const [state, setState] = useState(data);
  const [source, setSource] = useState(data);
  if (data !== source) {
    setSource(data);
    setState(data);
  }

  // The clock ticks every 30 s (starts from the server's time, so the first render matches)
  const [now, setNow] = useState(data.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const [tab, setTab] = useState<Tab>("mine");
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const errorText = (code: string) =>
    ["overlap", "invalid", "conflict", "forbidden"].includes(code)
      ? t(`errors.${code}`)
      : tErr(code);
  const live = { ...state, now };
  const summaryOf = (memberId: string) =>
    summarizeMonth(memberId, state.month, live);

  function run(
    local: () => string | null,
    remote: () => Promise<ActionResult<unknown>>,
    success: string,
    after?: () => void,
  ) {
    if (demo) {
      const problem = local();
      if (problem) return setNotice(errorText(problem));
      after?.();
      return setNotice(success);
    }
    startTransition(async () => {
      const result = await remote();
      if (!result.ok) return setNotice(errorText(result.error));
      after?.();
      setNotice(success);
      router.refresh();
    });
  }

  const actions: Actions = {
    clockIn() {
      run(
        () => {
          if (
            state.sessions.some((s) => s.memberId === state.meId && !s.endedAt)
          )
            return "conflict";
          const at = new Date().toISOString();
          setState((s) => ({
            ...s,
            sessions: [
              ...s.sessions,
              {
                id: `demo-${Date.now()}`,
                memberId: s.meId,
                startedAt: at,
                endedAt: null,
                source: "timer",
                note: null,
              },
            ],
          }));
          setNow(at);
          return null;
        },
        () => clockIn({ companyId: companyId! }),
        t("notices.clockedIn"),
      );
    },
    clockOut() {
      run(
        () => {
          const at = new Date().toISOString();
          setState((s) => ({
            ...s,
            sessions: s.sessions.map((x) =>
              x.memberId === s.meId && !x.endedAt ? { ...x, endedAt: at } : x,
            ),
          }));
          setNow(at);
          return null;
        },
        () => clockOut({ companyId: companyId! }),
        t("notices.clockedOut"),
      );
    },
    add(input, after) {
      run(
        () => {
          const check = checkManualEntry(input, {
            settings: state.settings,
            sessions: state.sessions,
            now: new Date().toISOString(),
          });
          if (check.problem) return check.problem;
          const session: WorkSession = {
            id: `demo-${Date.now()}`,
            memberId: input.memberId,
            startedAt: check.startedAt,
            endedAt: check.endedAt,
            source: "manual",
            note: input.note.trim() || null,
          };
          setState((s) => ({ ...s, sessions: [...s.sessions, session] }));
          return null;
        },
        () =>
          addWorkSession({
            companyId: companyId!,
            memberId: input.memberId === state.meId ? null : input.memberId,
            date: input.date,
            from: input.from,
            to: input.to,
            note: input.note.trim() || null,
          }),
        t("notices.added"),
        after,
      );
    },
    remove(session) {
      run(
        () => {
          setState((s) => ({
            ...s,
            sessions: s.sessions.filter((x) => x.id !== session.id),
          }));
          return null;
        },
        () => deleteWorkSession({ sessionId: session.id }),
        t("notices.removed"),
      );
    },
    saveSettings(settings) {
      run(
        () => {
          if (
            toMinutes(settings.dayEnd) <= toMinutes(settings.dayStart) ||
            settings.breakMinutes >=
              toMinutes(settings.dayEnd) - toMinutes(settings.dayStart)
          )
            return "invalid";
          setState((s) => ({ ...s, settings }));
          return null;
        },
        () =>
          saveWorkSettings({
            companyId: companyId!,
            ...settings,
            timeZone: settings.timeZone as (typeof TIME_ZONES)[number],
          }),
        t("notices.settingsSaved"),
      );
    },
  };

  const monthName = (m: string) =>
    new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${m}-01T00:00:00Z`));
  const tabs: { key: Tab; icon: LucideIcon; show: boolean }[] = [
    { key: "mine", icon: UserRound, show: true },
    { key: "team", icon: Users, show: state.canManage },
    { key: "settings", icon: Settings2, show: state.canSettings },
  ];
  const shared: Shared = { state, now, pending, actions, summaryOf };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href={hrHref}
              className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
              {t("backToHr")}
            </Link>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              {t("title")}
            </h2>
            <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" aria-hidden />
            {t("month")}
            <Select
              value={state.month}
              onChange={(e) =>
                router.push(`${hrHref}/work-hours?month=${e.target.value}`)
              }
              className="h-10 w-44"
              aria-label={t("month")}
            >
              {recentMonths(state.today).map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </Select>
          </label>
        </header>

        {demo && (
          <p className="rounded-lg bg-surface-container-low px-5 py-3 text-sm text-on-surface-variant">
            {t("demoNotice")}
          </p>
        )}

        <div
          role="tablist"
          aria-label={t("title")}
          className="flex flex-wrap gap-2"
        >
          {tabs
            .filter((x) => x.show)
            .map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-sm px-5 text-sm font-semibold ghost-border transition-colors",
                  tab === key
                    ? "bg-primary-fixed text-primary"
                    : "bg-surface-container-lowest hover:bg-surface-container-low",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`tabs.${key}`)}
              </button>
            ))}
        </div>

        {tab === "mine" && <MyHours {...shared} />}
        {tab === "team" && state.canManage && <TeamHours {...shared} />}
        {tab === "settings" && state.canSettings && (
          <WorkDaySettings {...shared} />
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg"
        >
          {notice}
        </p>
      )}
    </div>
  );
}

type Actions = {
  clockIn: () => void;
  clockOut: () => void;
  add: (
    input: {
      memberId: string;
      date: string;
      from: string;
      to: string;
      note: string;
    },
    after: () => void,
  ) => void;
  remove: (session: WorkSession) => void;
  saveSettings: (settings: WorkSettings) => void;
};

type Shared = {
  state: WorkHoursData;
  now: string;
  pending: boolean;
  actions: Actions;
  summaryOf: (memberId: string) => MonthSummary;
};

// ---------- My hours ----------

function MyHours({ state, now, pending, actions, summaryOf }: Shared) {
  const t = useTranslations("hours");
  const summary = summaryOf(state.meId);
  const open = state.sessions.find(
    (s) => s.memberId === state.meId && !s.endedAt,
  );
  const since = open
    ? localParts(open.startedAt, state.settings.timeZone).time
    : null;
  const isCurrentMonth = state.today.startsWith(state.month);

  return (
    <div className="flex flex-col gap-6">
      <section
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 rounded-xl p-5 shadow-ambient",
          open ? "bg-success-container/60" : "bg-surface-container-lowest",
        )}
      >
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "grid size-14 place-items-center rounded-full",
              open
                ? "bg-success text-white"
                : "bg-surface-container text-on-surface-variant",
            )}
          >
            <AlarmClock className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-extrabold">
              {open
                ? t("clock.working", { since: since! })
                : t("clock.notWorking")}
            </p>
            <p className="text-sm text-on-surface-variant">
              {open
                ? t("clock.running", {
                    time: formatMinutes(sessionMinutes(open, now)),
                  })
                : t("clock.todaySoFar", {
                    time: formatMinutes(summary.todayMinutes),
                  })}
              {" · "}
              {t("clock.schedule", {
                start: state.settings.dayStart,
                end: state.settings.dayEnd,
              })}
            </p>
          </div>
        </div>
        {open ? (
          <Button
            size="lg"
            disabled={pending}
            onClick={actions.clockOut}
            className="bg-danger bg-none text-white"
          >
            <Square className="size-4" aria-hidden />
            {t("clock.stop")}
          </Button>
        ) : (
          <Button size="lg" disabled={pending} onClick={actions.clockIn}>
            <Play className="size-4" aria-hidden />
            {t("clock.start")}
          </Button>
        )}
      </section>

      <SummaryCards summary={summary} showToday={isCurrentMonth} />

      <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
        <h3 className="text-lg font-bold">{t("days.title")}</h3>
        <DayTable
          rows={summary.days}
          state={state}
          memberId={state.meId}
          canDelete={(s) => s.source === "manual" || state.canManage}
          pending={pending}
          actions={actions}
        />
      </section>
    </div>
  );
}

function SummaryCards({
  summary: s,
  showToday,
}: {
  summary: MonthSummary;
  showToday: boolean;
}) {
  const t = useTranslations("hours");
  const cards: {
    key: string;
    icon: LucideIcon;
    value: string;
    sub?: string;
    tone?: string;
  }[] = [
    {
      key: "worked",
      icon: Clock,
      value: formatMinutes(s.workedMinutes),
      sub: showToday
        ? t("summary.plusToday", { time: formatMinutes(s.todayMinutes) })
        : undefined,
    },
    {
      key: "expected",
      icon: Hourglass,
      value: formatMinutes(s.expectedMinutes),
      sub: t("summary.expectedDays", { days: s.expectedDays }),
    },
    {
      key: "balance",
      icon: s.balanceMinutes >= 0 ? TrendingUp : TrendingDown,
      value: signed(s.balanceMinutes),
      sub: t(s.balanceMinutes >= 0 ? "summary.extra" : "summary.short"),
      tone: s.balanceMinutes >= 0 ? "text-success" : "text-danger",
    },
    {
      key: "late",
      icon: AlarmClock,
      value: String(s.lateDays),
      sub: t("summary.ofDays", { days: s.presentDays }),
      tone: s.lateDays ? "text-on-secondary-container" : undefined,
    },
    {
      key: "absent",
      icon: UserX,
      value: String(s.absentDays),
      sub: t("summary.leaveDays", { days: s.leaveDays }),
      tone: s.absentDays ? "text-danger" : undefined,
    },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ key, icon: Icon, value, sub, tone }) => (
        <li
          key={key}
          className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-5 shadow-ambient"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
            <Icon className="size-4 text-primary" aria-hidden />
            {t(`summary.${key}`)}
          </span>
          <span
            dir="ltr"
            className={cn("text-start text-3xl font-black rtl:text-end", tone)}
          >
            {value}
          </span>
          {sub && (
            <span className="text-xs text-on-surface-variant">{sub}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The month day by day, with sessions, and a form to add hours by hand for `memberId`. */
function DayTable({
  rows,
  state,
  memberId,
  canDelete,
  pending,
  actions,
}: {
  rows: DayRow[];
  state: WorkHoursData;
  memberId: string;
  canDelete: (s: WorkSession) => boolean;
  pending: boolean;
  actions: Actions;
}) {
  const t = useTranslations("hours");
  const locale = useLocale() as "ar" | "en";
  const [adding, setAdding] = useState(false);
  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [locale],
  );
  const visible = rows.filter((r) => r.status !== "future").reverse();

  return (
    <div className="flex flex-col gap-3">
      {adding ? (
        <AddForm
          state={state}
          memberId={memberId}
          pending={pending}
          onClose={() => setAdding(false)}
          onSubmit={(input) => actions.add(input, () => setAdding(false))}
        />
      ) : (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            {t("days.add")}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-xs text-on-surface-variant">
              <th className="px-3 py-2 text-start font-semibold">
                {t("days.date")}
              </th>
              <th className="px-3 py-2 text-start font-semibold">
                {t("days.status")}
              </th>
              <th className="px-3 py-2 text-start font-semibold">
                {t("days.in")}
              </th>
              <th className="px-3 py-2 text-start font-semibold">
                {t("days.out")}
              </th>
              <th className="px-3 py-2 text-start font-semibold">
                {t("days.hours")}
              </th>
              <th className="px-3 py-2 text-start font-semibold">
                {t("days.details")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.date}
                className={cn(
                  "border-t border-outline-variant/30",
                  r.status === "weekend" && !r.minutes && "text-muted",
                )}
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  {fmt.format(new Date(`${r.date}T00:00:00Z`))}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
                      statusStyle[r.status],
                    )}
                  >
                    {t(`status.${r.status}`)}
                  </span>
                </td>
                <td
                  dir="ltr"
                  className="px-3 py-2.5 text-start font-mono rtl:text-end"
                >
                  {r.firstIn ?? "—"}
                </td>
                <td
                  dir="ltr"
                  className="px-3 py-2.5 text-start font-mono rtl:text-end"
                >
                  {r.open ? (
                    <span className="font-sans text-success">
                      {t("days.stillIn")}
                    </span>
                  ) : (
                    (r.lastOut ?? "—")
                  )}
                </td>
                <td
                  dir="ltr"
                  className="px-3 py-2.5 text-start font-mono font-bold rtl:text-end"
                >
                  {r.minutes ? formatMinutes(r.minutes) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    {r.sessions
                      .filter(
                        (s) =>
                          s.source === "manual" ||
                          s.note ||
                          r.sessions.length > 1,
                      )
                      .map((s) => (
                        <span
                          key={s.id}
                          className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant"
                        >
                          <span dir="ltr" className="font-mono">
                            {
                              localParts(s.startedAt, state.settings.timeZone)
                                .time
                            }
                            –
                            {s.endedAt
                              ? localParts(s.endedAt, state.settings.timeZone)
                                  .time
                              : "…"}
                          </span>
                          {s.source === "manual" && (
                            <span className="rounded-full bg-tertiary-fixed px-1.5 text-[10px] font-bold text-tertiary">
                              {t("days.manual")}
                            </span>
                          )}
                          {s.note && <span>«{s.note}»</span>}
                          {canDelete(s) && s.endedAt && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => actions.remove(s)}
                              aria-label={t("days.remove")}
                              title={t("days.remove")}
                              className="rounded-full p-1 text-danger hover:bg-danger-container/60"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </span>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddForm({
  state,
  memberId,
  pending,
  onSubmit,
  onClose,
}: {
  state: WorkHoursData;
  memberId: string;
  pending: boolean;
  onSubmit: (input: {
    memberId: string;
    date: string;
    from: string;
    to: string;
    note: string;
  }) => void;
  onClose: () => void;
}) {
  const t = useTranslations("hours");
  const [date, setDate] = useState(state.today);
  const [from, setFrom] = useState(state.settings.dayStart);
  const [to, setTo] = useState(state.settings.dayEnd);
  const [note, setNote] = useState("");
  const minutes = toMinutes(to) - toMinutes(from);

  return (
    <form
      className="grid gap-3 rounded-lg bg-surface-container-low p-4 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ memberId, date, from, to, note });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.date")}
        <input
          type="date"
          required
          max={state.today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.from")}
        <input
          type="time"
          required
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.to")}
        <input
          type="time"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t("form.note")}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder={t("form.noteHint")}
          className={inputClass}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-5">
        <p
          className={cn(
            "text-sm",
            minutes > 0 ? "text-on-surface-variant" : "text-danger",
          )}
        >
          {minutes > 0
            ? t("form.total", { time: formatMinutes(minutes) })
            : t("errors.invalid")}
          {" · "}
          {t("form.manualHint")}
        </p>
        <div className="flex gap-2">
          <Button variant="tertiary" onClick={onClose}>
            {t("form.close")}
          </Button>
          <Button type="submit" disabled={pending || minutes <= 0}>
            <Check className="size-4" aria-hidden />
            {t("form.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------- Team (hours.manage) ----------

function TeamHours({ state, now, pending, actions, summaryOf }: Shared) {
  const t = useTranslations("hours");
  const locale = useLocale() as "ar" | "en";
  const [open, setOpen] = useState<string | null>(null);
  const [department, setDepartment] = useState("all");
  const deptName = (id: string) =>
    state.departments.find((d) => d.id === id)?.name[locale] ?? "";

  const people = state.members
    .filter((m) => department === "all" || m.departmentId === department)
    .map((m) => ({ ...m, summary: summaryOf(m.id) }));
  const workingNow = state.sessions.filter(
    (s) => !s.endedAt && state.members.some((m) => m.id === s.memberId),
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-ambient">
        <span className="flex items-center gap-2 font-bold">
          <span className="size-2.5 rounded-full bg-success" aria-hidden />
          {t("team.workingNow", { count: workingNow.length })}
        </span>
        {workingNow.map((s) => {
          const m = state.members.find((x) => x.id === s.memberId)!;
          return (
            <span
              key={s.id}
              className="flex items-center gap-2 rounded-full bg-surface-container-low py-1 ps-1 pe-3 text-sm"
            >
              <Avatar name={m.name[locale]} size="sm" />
              {m.name[locale]}
              <span className="text-xs text-on-surface-variant">
                ·{" "}
                {t("team.since", {
                  time: localParts(s.startedAt, state.settings.timeZone).time,
                })}{" "}
                ({formatMinutes(sessionMinutes(s, now))})
              </span>
            </span>
          );
        })}
      </section>

      {state.departments.length > 1 && (
        <div className="w-56">
          <Select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-10"
            aria-label={t("team.department")}
          >
            <option value="all">{t("team.allDepartments")}</option>
            {state.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name[locale]}
              </option>
            ))}
          </Select>
        </div>
      )}

      <section className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-ambient">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-xs text-on-surface-variant">
              {(
                [
                  "employee",
                  "present",
                  "late",
                  "absent",
                  "leave",
                  "worked",
                  "expected",
                  "balance",
                ] as const
              ).map((k) => (
                <th
                  key={k}
                  className={cn(
                    "py-3 text-start font-semibold",
                    k === "employee" ? "px-5" : "px-3",
                  )}
                >
                  {t(`team.columns.${k}`)}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {people.map((m) => {
              const s = m.summary;
              const expanded = open === m.id;
              return (
                <Fragment key={m.id}>
                  <tr
                    className="cursor-pointer border-t border-outline-variant/30 hover:bg-surface-container-low/60"
                    onClick={() => setOpen(expanded ? null : m.id)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name[locale]} size="sm" />
                        <div>
                          <p className="flex items-center gap-2 font-bold">
                            {m.name[locale]}
                            {s.working && (
                              <span
                                className="size-2 rounded-full bg-success"
                                title={t("team.inNow")}
                              />
                            )}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {[m.title[locale], deptName(m.departmentId)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {s.presentDays} / {s.expectedDays}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3",
                        s.lateDays > 2 &&
                          "font-bold text-on-secondary-container",
                      )}
                    >
                      {s.lateDays}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3",
                        s.absentDays > 0 && "font-bold text-danger",
                      )}
                    >
                      {s.absentDays}
                    </td>
                    <td className="px-3 py-3">{s.leaveDays}</td>
                    <td
                      dir="ltr"
                      className="px-3 py-3 text-start font-mono rtl:text-end"
                    >
                      {formatMinutes(s.workedMinutes)}
                    </td>
                    <td
                      dir="ltr"
                      className="px-3 py-3 text-start font-mono rtl:text-end"
                    >
                      {formatMinutes(s.expectedMinutes)}
                    </td>
                    <td
                      dir="ltr"
                      className={cn(
                        "px-3 py-3 text-start font-mono font-bold rtl:text-end",
                        s.balanceMinutes >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {signed(s.balanceMinutes)}
                    </td>
                    <td className="px-2">
                      <ChevronDown
                        className={cn(
                          "size-4 text-on-surface-variant transition-transform",
                          expanded && "rotate-180",
                        )}
                        aria-label={t(expanded ? "team.hide" : "team.show")}
                      />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-surface-container-low/40">
                      <td colSpan={9} className="px-5 py-4">
                        <DayTable
                          rows={s.days}
                          state={state}
                          memberId={m.id}
                          canDelete={() => true}
                          pending={pending}
                          actions={actions}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <p className="px-5 pb-4 pt-2 text-xs text-on-surface-variant">
          {t("team.legend")}
        </p>
      </section>
    </div>
  );
}

// ---------- The company's working day ----------

function WorkDaySettings({ state, pending, actions }: Shared) {
  const t = useTranslations("hours");
  const [draft, setDraft] = useState(state.settings);
  const daily = dailyMinutes(draft);
  const valid =
    toMinutes(draft.dayEnd) > toMinutes(draft.dayStart) && daily > 0;

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        actions.saveSettings(draft);
      }}
    >
      <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
        <h3 className="text-lg font-bold">{t("settings.title")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("settings.start")}
            <input
              type="time"
              required
              value={draft.dayStart}
              onChange={(e) => setDraft({ ...draft, dayStart: e.target.value })}
              className={cn(inputClass, "bg-surface-container-low")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("settings.end")}
            <input
              type="time"
              required
              value={draft.dayEnd}
              onChange={(e) => setDraft({ ...draft, dayEnd: e.target.value })}
              className={cn(inputClass, "bg-surface-container-low")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("settings.break")}
            <input
              type="number"
              min={0}
              max={600}
              dir="ltr"
              value={draft.breakMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  breakMinutes: Math.max(0, Number(e.target.value)),
                })
              }
              className={cn(inputClass, "bg-surface-container-low")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("settings.grace")}
            <input
              type="number"
              min={0}
              max={240}
              dir="ltr"
              value={draft.graceMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  graceMinutes: Math.max(0, Number(e.target.value)),
                })
              }
              className={cn(inputClass, "bg-surface-container-low")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
            {t("settings.timeZone")}
            <Select
              value={draft.timeZone}
              onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })}
            >
              {TIME_ZONES.map((z) => (
                <option key={z} value={z}>
                  {t(`zones.${z.replace("/", "_")}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <p
          className={cn(
            "rounded-md px-4 py-3 text-sm",
            valid
              ? "bg-surface-container-low"
              : "bg-danger-container/60 text-danger",
          )}
        >
          {valid
            ? t("settings.daily", {
                time: formatMinutes(daily),
                late: draft.dayStart,
                grace: draft.graceMinutes,
              })
            : t("errors.invalid")}
        </p>
        <p className="text-sm text-on-surface-variant">
          {t("settings.weekendNote")}
        </p>
      </section>
      <div>
        <Button type="submit" disabled={pending || !valid}>
          <Check className="size-4" aria-hidden />
          {t("form.save")}
        </Button>
      </div>
    </form>
  );
}
