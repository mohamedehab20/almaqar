"use client";

import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  HeartPulse,
  Palmtree,
  Pencil,
  RotateCcw,
  Settings2,
  Timer,
  Undo2,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import { cancelLeave, decideLeave, requestLeave, saveLeaveSettings, setLeaveAllowance } from "../actions";
import {
  allowanceOf,
  balanceOf,
  checkRequest,
  daysInYear,
  LEAVE_TYPES,
  offOn,
  workingDays,
  type Allowances,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "../calc";
import type { LeaveData } from "../service";

type Tab = "mine" | "team" | "balances" | "settings";

const typeIcon: Record<LeaveType, LucideIcon> = { annual: Palmtree, casual: Timer, sick: HeartPulse, unpaid: Wallet };
const typeStyle: Record<LeaveType, string> = {
  annual: "bg-primary-fixed text-primary",
  casual: "bg-secondary-container text-on-secondary-container",
  sick: "bg-danger-container text-danger",
  unpaid: "bg-surface-container text-on-surface-variant",
};
const statusStyle: Record<LeaveStatus, string> = {
  pending: "bg-secondary-container text-on-secondary-container",
  approved: "bg-success-container text-success",
  rejected: "bg-danger-container text-danger",
  cancelled: "bg-surface-container text-muted",
};
const inputClass = "h-11 w-full rounded-md bg-surface-container-low px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";
const num = (n: number) => n.toLocaleString("en-US");
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * HR → Leave: the employee's balances and requests, the team's requests to approve, per-employee balances
 * and the company policy. `companyId` null = the public demo (changes stay in the browser).
 */
export function LeaveView({ data, companyId, hrHref }: { data: LeaveData; companyId: string | null; hrHref: string }) {
  const t = useTranslations("leave");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const demo = companyId === null;
  const [pending, startTransition] = useTransition();

  // Local copy: the demo changes it directly; a real company gets fresh data from the server after each save
  const [state, setState] = useState(data);
  const [source, setSource] = useState(data);
  if (data !== source) {
    setSource(data);
    setState(data);
  }

  const [tab, setTab] = useState<Tab>("mine");
  const [year, setYear] = useState(data.year);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const memberById = useMemo(() => new Map(state.members.map((m) => [m.id, m])), [state.members]);
  const nameOf = (id: string | null) => (id ? (state.names[id]?.[locale] ?? "—") : "—");
  const errorText = (code: string) => (["overlap", "insufficient_balance", "invalid", "forbidden"].includes(code) ? t(`errors.${code}`) : tErr(code));

  /** Runs a change: locally in the demo, through the server otherwise. */
  function run(local: () => string | null, remote: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) {
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

  const actions = {
    request(input: { type: LeaveType; startsOn: string; endsOn: string; reason: string }, after: () => void) {
      run(
        () => {
          const problem = checkRequest({ memberId: state.meId, ...input }, state);
          if (problem) return problem;
          const request: LeaveRequest = {
            id: `demo-${Date.now()}`,
            memberId: state.meId,
            ...input,
            reason: input.reason.trim() || null,
            days: workingDays(input.startsOn, input.endsOn, state.settings.weekendDays),
            status: "pending",
            decidedById: null,
            decidedAt: null,
            decisionNote: null,
            createdAt: new Date().toISOString(),
          };
          setState((s) => ({ ...s, requests: [...s.requests, request] }));
          return null;
        },
        () => requestLeave({ companyId: companyId!, ...input, reason: input.reason.trim() || null }),
        t("notices.requested"),
        after,
      );
    },
    cancel(request: LeaveRequest) {
      run(
        () => {
          setState((s) => ({ ...s, requests: s.requests.map((r) => (r.id === request.id ? { ...r, status: "cancelled" } : r)) }));
          return null;
        },
        () => cancelLeave({ requestId: request.id }),
        t("notices.cancelled"),
      );
    },
    decide(request: LeaveRequest, decision: "approved" | "rejected", note: string) {
      run(
        () => {
          if (decision === "approved") {
            const problem = checkRequest(request, state, request.id);
            if (problem) return problem;
          }
          const decided = { status: decision, decidedById: state.meId, decidedAt: new Date().toISOString(), decisionNote: note.trim() || null };
          setState((s) => ({ ...s, requests: s.requests.map((r) => (r.id === request.id ? { ...r, ...decided } : r)) }));
          return null;
        },
        () => decideLeave({ requestId: request.id, decision, note: note.trim() || null }),
        t(decision === "approved" ? "notices.approved" : "notices.rejected"),
      );
    },
    setAllowance(memberId: string, type: LeaveType, allowance: number | null) {
      run(
        () => {
          setState((s) => ({
            ...s,
            overrides: [
              ...s.overrides.filter((o) => !(o.memberId === memberId && o.type === type && o.year === year)),
              ...(allowance === null ? [] : [{ memberId, type, year, allowance }]),
            ],
          }));
          return null;
        },
        () => setLeaveAllowance({ memberId, year, type, allowance }),
        t("notices.balanceSaved"),
      );
    },
    saveSettings(allowances: Allowances, weekendDays: number[]) {
      run(
        () => {
          if (weekendDays.length > 3) return "invalid";
          setState((s) => ({ ...s, settings: { allowances, weekendDays } }));
          return null;
        },
        () => saveLeaveSettings({ companyId: companyId!, allowances, weekendDays }),
        t("notices.settingsSaved"),
      );
    },
  };

  const fmt = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }), [locale]);
  const range = (r: Pick<LeaveRequest, "startsOn" | "endsOn">) => {
    const from = fmt.format(new Date(`${r.startsOn}T00:00:00Z`));
    return r.startsOn === r.endsOn ? from : `${from} ${locale === "ar" ? "←" : "→"} ${fmt.format(new Date(`${r.endsOn}T00:00:00Z`))}`;
  };

  const waiting = state.requests.filter((r) => r.status === "pending" && r.memberId !== state.meId).length;
  const tabs: { key: Tab; icon: LucideIcon; show: boolean; badge?: number }[] = [
    { key: "mine", icon: UserRound, show: true },
    { key: "team", icon: Users, show: state.canManage, badge: waiting },
    { key: "balances", icon: Wallet, show: state.canManage },
    { key: "settings", icon: Settings2, show: state.canSettings },
  ];

  const shared = { state, year, nameOf, range, pending, actions, memberById };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href={hrHref} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
              {t("backToHr")}
            </Link>
            <h2 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
            <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            {t("year")}
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 w-28" aria-label={t("year")}>
              {[data.year - 1, data.year, data.year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </label>
        </header>

        {demo && <p className="rounded-lg bg-surface-container-low px-5 py-3 text-sm text-on-surface-variant">{t("demoNotice")}</p>}

        <div role="tablist" aria-label={t("title")} className="flex flex-wrap gap-2">
          {tabs
            .filter((x) => x.show)
            .map(({ key, icon: Icon, badge }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-sm px-5 text-sm font-semibold ghost-border transition-colors",
                  tab === key ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`tabs.${key}`)}
                {Boolean(badge) && <span className="grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-white">{badge}</span>}
              </button>
            ))}
        </div>

        {tab === "mine" && <MyLeave {...shared} />}
        {tab === "team" && state.canManage && <TeamRequests {...shared} />}
        {tab === "balances" && state.canManage && <Balances {...shared} />}
        {tab === "settings" && state.canSettings && <PolicySettings {...shared} />}
      </div>

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

type Shared = {
  state: LeaveData;
  year: number;
  nameOf: (id: string | null) => string;
  range: (r: Pick<LeaveRequest, "startsOn" | "endsOn">) => string;
  pending: boolean;
  actions: {
    request: (input: { type: LeaveType; startsOn: string; endsOn: string; reason: string }, after: () => void) => void;
    cancel: (request: LeaveRequest) => void;
    decide: (request: LeaveRequest, decision: "approved" | "rejected", note: string) => void;
    setAllowance: (memberId: string, type: LeaveType, allowance: number | null) => void;
    saveSettings: (allowances: Allowances, weekendDays: number[]) => void;
  };
  memberById: Map<string, LeaveData["members"][number]>;
};

const touchesYear = (r: LeaveRequest, year: number) => r.startsOn <= `${year}-12-31` && r.endsOn >= `${year}-01-01`;

// ---------- My leave ----------

function MyLeave({ state, year, nameOf, range, pending, actions }: Shared) {
  const t = useTranslations("leave");
  const [asking, setAsking] = useState(false);
  const mine = state.requests.filter((r) => r.memberId === state.meId && touchesYear(r, year)).sort((a, b) => b.startsOn.localeCompare(a.startsOn));

  return (
    <div className="flex flex-col gap-6">
      <BalanceCards memberId={state.meId} state={state} year={year} />

      <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{t("mine.title")}</h3>
          {!asking && (
            <Button onClick={() => setAsking(true)}>
              <CalendarPlus className="size-4" aria-hidden />
              {t("mine.new")}
            </Button>
          )}
        </div>
        {asking && <RequestForm state={state} pending={pending} onCancel={() => setAsking(false)} onSubmit={(input) => actions.request(input, () => setAsking(false))} />}
        {mine.length === 0 ? (
          <p className="rounded-lg bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">{t("mine.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mine.map((r) => (
              <RequestCard key={r.id} request={r} range={range} nameOf={nameOf}>
                {(r.status === "pending" || (r.status === "approved" && r.startsOn > state.today)) && (
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => actions.cancel(r)}>
                    <Undo2 className="size-4" aria-hidden />
                    {t("actions.cancel")}
                  </Button>
                )}
              </RequestCard>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BalanceCards({ memberId, state, year }: { memberId: string; state: LeaveData; year: number }) {
  const t = useTranslations("leave");
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {LEAVE_TYPES.map((type) => {
        const b = balanceOf(memberId, type, year, state);
        const Icon = typeIcon[type];
        const total = b.allowance ?? 0;
        return (
          <li key={type} className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
            <div className="flex items-center gap-3">
              <span className={cn("grid size-10 place-items-center rounded-lg", typeStyle[type])}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="font-bold">{t(`types.${type}`)}</span>
            </div>
            {b.remaining === null ? (
              <p className="text-2xl font-extrabold">{t("balance.unlimited")}</p>
            ) : (
              <p className="text-3xl font-black">
                {num(b.remaining)} <span className="text-base font-semibold text-on-surface-variant">{t("balance.daysLeft")}</span>
              </p>
            )}
            {total > 0 && (
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-container" aria-hidden>
                <span className="bg-primary" style={{ width: `${Math.min(100, (b.used / total) * 100)}%` }} />
                <span className="bg-secondary-container" style={{ width: `${Math.min(100, (b.pending / total) * 100)}%` }} />
              </div>
            )}
            <p className="text-xs text-on-surface-variant">
              {b.allowance === null
                ? t("balance.takenOnly", { used: num(b.used), pending: num(b.pending) })
                : t("balance.detail", { used: num(b.used), pending: num(b.pending), total: num(b.allowance) })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function RequestForm({
  state,
  pending,
  onSubmit,
  onCancel,
}: {
  state: LeaveData;
  pending: boolean;
  onSubmit: (input: { type: LeaveType; startsOn: string; endsOn: string; reason: string }) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("leave");
  const [type, setType] = useState<LeaveType>("annual");
  // The form opens after a click (browser only), so it can start from the viewer's own date
  const [startsOn, setStartsOn] = useState(localToday);
  const [endsOn, setEndsOn] = useState(localToday);
  const [reason, setReason] = useState("");

  const days = endsOn >= startsOn ? workingDays(startsOn, endsOn, state.settings.weekendDays) : 0;
  const problem = startsOn && endsOn ? checkRequest({ memberId: state.meId, type, startsOn, endsOn }, state) : "invalid";
  const year = Number(startsOn.slice(0, 4)) || state.year;
  const left = balanceOf(state.meId, type, year, state).remaining;

  return (
    <form
      className="grid gap-4 rounded-lg bg-surface-container-low p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ type, startsOn, endsOn, reason });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.type")}
        <Select value={type} onChange={(e) => setType(e.target.value as LeaveType)} className="bg-surface-container-lowest">
          {LEAVE_TYPES.map((k) => {
            const r = balanceOf(state.meId, k, year, state).remaining;
            return (
              <option key={k} value={k}>
                {t(`types.${k}`)} — {r === null ? t("balance.unlimited") : t("form.left", { days: num(r) })}
              </option>
            );
          })}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.from")}
        <input
          type="date"
          required
          value={startsOn}
          onChange={(e) => {
            setStartsOn(e.target.value);
            if (endsOn < e.target.value) setEndsOn(e.target.value);
          }}
          className={cn(inputClass, "bg-surface-container-lowest")}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.to")}
        <input type="date" required min={startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={cn(inputClass, "bg-surface-container-lowest")} />
      </label>
      <div className="flex flex-col justify-center gap-1 rounded-md bg-surface-container-lowest px-4 py-2 text-sm">
        <span className="font-bold">{t("form.workingDays", { days: num(days) })}</span>
        {left !== null && problem !== "insufficient_balance" && <span className="text-on-surface-variant">{t("form.after", { days: num(left - days) })}</span>}
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2 lg:col-span-4">
        {t("form.reason")}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={2} placeholder={t("form.reasonHint")} className="rounded-md bg-surface-container-lowest p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
        <p className={cn("text-sm", problem ? "text-danger" : "text-on-surface-variant")} role={problem ? "alert" : undefined}>
          {problem ? t(`errors.${problem}`) : t("form.ok")}
        </p>
        <div className="flex gap-2">
          <Button variant="tertiary" onClick={onCancel}>
            {t("actions.close")}
          </Button>
          <Button type="submit" disabled={pending || Boolean(problem)}>
            <Check className="size-4" aria-hidden />
            {t("form.submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function RequestCard({
  request: r,
  range,
  nameOf,
  who,
  extra,
  children,
}: {
  request: LeaveRequest;
  range: Shared["range"];
  nameOf: Shared["nameOf"];
  who?: { name: string; sub: string };
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = useTranslations("leave");
  const Icon = typeIcon[r.type];
  return (
    <li className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-4 sm:flex-row sm:items-start">
      {who ? (
        <div className="flex min-w-48 items-center gap-3">
          <Avatar name={who.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-bold">{who.name}</p>
            <p className="truncate text-xs text-on-surface-variant">{who.sub}</p>
          </div>
        </div>
      ) : (
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", typeStyle[r.type])}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {who && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", typeStyle[r.type])}>{t(`types.${r.type}`)}</span>}
          {!who && <span className="font-bold">{t(`types.${r.type}`)}</span>}
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", statusStyle[r.status])}>{t(`status.${r.status}`)}</span>
        </div>
        <p className="text-sm">
          <bdi>{range(r)}</bdi> · <span className="font-semibold">{t("days", { count: r.days })}</span>
        </p>
        {r.reason && <p className="text-sm text-on-surface-variant">{r.reason}</p>}
        {(r.status === "approved" || r.status === "rejected") && r.decidedById && (
          <p className="text-xs text-on-surface-variant">
            {t(r.status === "approved" ? "decision.approvedBy" : "decision.rejectedBy", { name: nameOf(r.decidedById) })}
            {r.decisionNote && <> — «{r.decisionNote}»</>}
          </p>
        )}
        {extra}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </li>
  );
}

// ---------- Team requests (managers) ----------

function TeamRequests({ state, year, nameOf, range, pending, actions, memberById }: Shared) {
  const t = useTranslations("leave");
  const locale = useLocale() as "ar" | "en";
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [department, setDepartment] = useState("all");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const visible = state.requests
    .filter((r) => memberById.has(r.memberId) && (r.memberId !== state.meId || state.owner))
    .filter((r) => (filter === "all" ? touchesYear(r, year) : r.status === filter && (filter === "pending" || touchesYear(r, year))))
    .filter((r) => department === "all" || memberById.get(r.memberId)?.departmentId === department)
    .sort((a, b) => (filter === "pending" ? a.startsOn.localeCompare(b.startsOn) : b.startsOn.localeCompare(a.startsOn)));

  const offToday = offOn(state.requests, state.today).filter((r) => memberById.has(r.memberId));
  const deptName = (id: string) => state.departments.find((d) => d.id === id)?.name[locale] ?? "";

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-ambient">
        <span className="flex items-center gap-2 font-bold">
          <Palmtree className="size-5 text-primary" aria-hidden />
          {t("team.offToday")}
        </span>
        {offToday.length === 0 ? (
          <span className="text-sm text-on-surface-variant">{t("team.nobodyOff")}</span>
        ) : (
          offToday.map((r) => (
            <span key={r.id} className="flex items-center gap-2 rounded-full bg-surface-container-low py-1 ps-1 pe-3 text-sm">
              <Avatar name={nameOf(r.memberId)} size="sm" />
              {nameOf(r.memberId)}
              <span className="text-xs text-on-surface-variant">
                · {t(`types.${r.type}`)} · {t("team.backOn", { date: range({ startsOn: r.endsOn, endsOn: r.endsOn }) })}
              </span>
            </span>
          ))
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn("h-9 rounded-full px-4 text-sm font-semibold transition-colors", filter === f ? "bg-primary text-on-primary" : "bg-surface-container-low hover:bg-surface-container")}
          >
            {t(`team.filters.${f}`)}
          </button>
        ))}
        {state.departments.length > 1 && (
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-9 w-48 text-sm" aria-label={t("team.department")}>
            <option value="all">{t("team.allDepartments")}</option>
            {state.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name[locale]}
              </option>
            ))}
          </Select>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">{t(filter === "pending" ? "team.noPending" : "team.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((r) => {
            const m = memberById.get(r.memberId)!;
            const b = balanceOf(r.memberId, r.type, Number(r.startsOn.slice(0, 4)), state, r.id);
            // Colleagues from the same department away on overlapping days
            const overlapping = state.requests.filter(
              (o) =>
                o.id !== r.id &&
                o.memberId !== r.memberId &&
                (o.status === "approved" || o.status === "pending") &&
                o.startsOn <= r.endsOn &&
                o.endsOn >= r.startsOn &&
                memberById.get(o.memberId)?.departmentId === m.departmentId,
            );
            const canDecide = r.status === "pending" && (r.memberId !== state.meId || state.owner);
            return (
              <RequestCard
                key={r.id}
                request={r}
                range={range}
                nameOf={nameOf}
                who={{ name: m.name[locale], sub: [m.title[locale], deptName(m.departmentId)].filter(Boolean).join(" · ") }}
                extra={
                  r.status === "pending" && (
                    <div className="flex flex-col gap-1 text-xs">
                      <span className={cn(b.remaining !== null && b.remaining < daysInYear(r, Number(r.startsOn.slice(0, 4)), state.settings.weekendDays) ? "text-danger" : "text-on-surface-variant")}>
                        {b.remaining === null ? t("team.noLimit") : t("team.balanceBefore", { days: num(b.remaining) })}
                      </span>
                      {overlapping.length > 0 && (
                        <span className="text-on-secondary-container">
                          {t("team.overlap", { names: [...new Set(overlapping.map((o) => nameOf(o.memberId)))].join(locale === "ar" ? "، " : ", ") })}
                        </span>
                      )}
                      {rejecting === r.id && (
                        <form
                          className="mt-2 flex flex-wrap gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            actions.decide(r, "rejected", note);
                            setRejecting(null);
                            setNote("");
                          }}
                        >
                          <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={t("team.rejectNote")} className={cn(inputClass, "h-9 flex-1 bg-surface-container-lowest")} />
                          <Button type="submit" size="sm" disabled={pending} className="bg-danger bg-none text-white">
                            {t("actions.confirmReject")}
                          </Button>
                          <Button variant="tertiary" size="sm" onClick={() => setRejecting(null)}>
                            {t("actions.close")}
                          </Button>
                        </form>
                      )}
                    </div>
                  )
                }
              >
                {canDecide && rejecting !== r.id && (
                  <>
                    <Button size="sm" disabled={pending} onClick={() => actions.decide(r, "approved", "")}>
                      <Check className="size-4" aria-hidden />
                      {t("actions.approve")}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => setRejecting(r.id)} className="text-danger">
                      <X className="size-4" aria-hidden />
                      {t("actions.reject")}
                    </Button>
                  </>
                )}
              </RequestCard>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Balances (managers) ----------

function Balances({ state, year, pending, actions }: Shared) {
  const t = useTranslations("leave");
  const locale = useLocale() as "ar" | "en";
  const [editing, setEditing] = useState<{ memberId: string; type: LeaveType; value: string } | null>(null);
  const limited: LeaveType[] = LEAVE_TYPES.filter((k) => k !== "unpaid");

  return (
    <section className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-ambient">
      <p className="px-5 pt-4 text-sm text-on-surface-variant">{t("balances.intro", { year })}</p>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-start text-xs text-on-surface-variant">
            <th className="px-5 py-3 text-start font-semibold">{t("balances.employee")}</th>
            {LEAVE_TYPES.map((type) => (
              <th key={type} className="px-3 py-3 text-start font-semibold">
                {t(`types.${type}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.members.map((m) => (
            <tr key={m.id} className="border-t border-outline-variant/30">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name[locale]} size="sm" />
                  <div>
                    <p className="font-bold">{m.name[locale]}</p>
                    <p className="text-xs text-on-surface-variant">{m.title[locale]}</p>
                  </div>
                </div>
              </td>
              {LEAVE_TYPES.map((type) => {
                const b = balanceOf(m.id, type, year, state);
                const own = state.overrides.some((o) => o.memberId === m.id && o.type === type && o.year === year);
                const isEditing = editing?.memberId === m.id && editing.type === type;
                if (!limited.includes(type)) {
                  return (
                    <td key={type} className="px-3 py-3 text-on-surface-variant">
                      {t("balances.taken", { days: num(b.used) })}
                    </td>
                  );
                }
                return (
                  <td key={type} className="px-3 py-3">
                    {isEditing ? (
                      <form
                        className="flex items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          actions.setAllowance(m.id, type, editing.value === "" ? null : Math.max(0, Number(editing.value)));
                          setEditing(null);
                        }}
                      >
                        <input
                          autoFocus
                          type="number"
                          min={0}
                          max={366}
                          dir="ltr"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          aria-label={t("balances.allowance")}
                          className="h-8 w-16 rounded-sm bg-surface-container-low px-2 text-sm"
                        />
                        <Button type="submit" variant="icon" size="icon" disabled={pending} aria-label={t("actions.save")} className="size-8">
                          <Check className="size-4" aria-hidden />
                        </Button>
                        <Button variant="icon" size="icon" onClick={() => setEditing(null)} aria-label={t("actions.close")} className="size-8">
                          <X className="size-4" aria-hidden />
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className={cn("font-bold", b.remaining !== null && b.remaining <= 2 && "text-danger")}>
                          {num(b.remaining ?? 0)}
                          <span className="font-normal text-on-surface-variant"> / {num(b.allowance ?? 0)}</span>
                        </span>
                        {own && <span className="rounded-full bg-tertiary-fixed px-1.5 text-[10px] font-bold text-tertiary">{t("balances.custom")}</span>}
                        <Button
                          variant="icon"
                          size="icon"
                          className="size-7"
                          aria-label={t("balances.edit", { name: m.name[locale], type: t(`types.${type}`) })}
                          onClick={() => setEditing({ memberId: m.id, type, value: String(allowanceOf(m.id, type, year, state.settings, state.overrides) ?? "") })}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                        {own && (
                          <Button variant="icon" size="icon" className="size-7" disabled={pending} aria-label={t("balances.reset")} title={t("balances.reset")} onClick={() => actions.setAllowance(m.id, type, null)}>
                            <RotateCcw className="size-3.5" aria-hidden />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 pb-4 pt-2 text-xs text-on-surface-variant">{t("balances.legend")}</p>
    </section>
  );
}

// ---------- Company policy ----------

function PolicySettings({ state, pending, actions }: Shared) {
  const t = useTranslations("leave");
  const locale = useLocale() as "ar" | "en";
  const [allowances, setAllowances] = useState(state.settings.allowances);
  const [weekend, setWeekend] = useState(state.settings.weekendDays);
  // Sunday … Saturday, labelled in the page language
  const dayName = (d: number) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + d)));

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        actions.saveSettings(allowances, weekend);
      }}
    >
      <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
        <h3 className="text-lg font-bold">{t("settings.allowancesTitle")}</h3>
        <p className="text-sm text-on-surface-variant">{t("settings.allowancesHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {LEAVE_TYPES.map((type) => (
            <label key={type} className="flex flex-col gap-1 text-sm font-semibold">
              {t(`types.${type}`)}
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={366}
                  dir="ltr"
                  value={allowances[type] ?? ""}
                  placeholder={t("settings.noLimit")}
                  onChange={(e) => setAllowances({ ...allowances, [type]: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                  className={inputClass}
                />
                <span className="shrink-0 text-on-surface-variant">{t("settings.perYear")}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
        <h3 className="text-lg font-bold">{t("settings.weekendTitle")}</h3>
        <p className="text-sm text-on-surface-variant">{t("settings.weekendHint")}</p>
        <div className="flex flex-wrap gap-2">
          {[6, 0, 1, 2, 3, 4, 5].map((d) => {
            const on = weekend.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setWeekend(on ? weekend.filter((x) => x !== d) : [...weekend, d].sort())}
                className={cn("h-10 rounded-full px-4 text-sm font-semibold transition-colors", on ? "bg-primary text-on-primary" : "bg-surface-container-low hover:bg-surface-container")}
              >
                {dayName(d)}
              </button>
            );
          })}
        </div>
        {weekend.length > 3 && <p className="text-sm text-danger">{t("settings.tooMany")}</p>}
      </section>

      <div>
        <Button type="submit" disabled={pending || weekend.length > 3}>
          <Check className="size-4" aria-hidden />
          {t("actions.save")}
        </Button>
      </div>
    </form>
  );
}
