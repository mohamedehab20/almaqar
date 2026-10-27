"use client";

import { CalendarClock, Check, Download, FileText, MapPin, Receipt, UserSearch, Workflow } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useTimeZone } from "@/lib/time-zone";
import { cn } from "@/lib/utils";

export type PortalInvoice = { id: string; period: string; amount: number; issuedOn: string; dueOn: string; paidOn: string | null };
export type PortalMeeting = { id: string; title: string; startsAt: string; durationMinutes: number; location: string | null; status: string };
export type PortalFile = { path: string; name: string; url: string | null };

const card = "rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border";

/** The client's invoices (read-only): what is paid, what is waiting, what is late. Payments are recorded by the company. */
export function InvoicesSection({ invoices, today }: { invoices: PortalInvoice[]; today: string }) {
  const t = useTranslations("clientPortal.invoices");
  const tm = useTranslations("marketing");
  const unpaid = invoices.filter((i) => !i.paidOn).reduce((sum, i) => sum + i.amount, 0);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Receipt className="size-5 text-primary" aria-hidden />
        {t("title")}
      </h2>
      {invoices.length === 0 ? (
        <p className={cn(card, "text-center text-muted")}>{t("empty")}</p>
      ) : (
        <div className={card}>
          {unpaid > 0 && (
            <p className="mb-3 rounded-md bg-tertiary-fixed px-3 py-2 text-sm font-semibold text-tertiary">
              {t("due", { amount: unpaid.toLocaleString("en-US") })} {tm("currency")}
            </p>
          )}
          <ul className="flex flex-col divide-y divide-outline-variant/30">
            {invoices.map((i) => {
              const late = !i.paidOn && i.dueOn < today;
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <span className="font-bold">
                      <bdi dir="ltr">{i.amount.toLocaleString("en-US")}</bdi> {tm("currency")}
                    </span>
                    <span className="block text-xs text-on-surface-variant">{t.rich("line", { period: i.period, issued: i.issuedOn, due: i.dueOn, d: (c) => <bdi dir="ltr">{c}</bdi> })}</span>
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", i.paidOn ? "bg-success-container text-success" : late ? "bg-danger-container text-danger" : "bg-tertiary-fixed text-tertiary")}>
                    {i.paidOn ? t.rich("paid", { date: i.paidOn, d: (c) => <bdi dir="ltr">{c}</bdi> }) : t(late ? "late" : "unpaid")}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-on-surface-variant">{t("howToPay")}</p>
        </div>
      )}
    </section>
  );
}

/** Upcoming and past meetings with the company, in the company's time zone. */
export function MeetingsSection({ meetings, now }: { meetings: PortalMeeting[]; now: string }) {
  const t = useTranslations("clientPortal.meetings");
  const locale = useLocale();
  const timeZone = useTimeZone();
  const fmt = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone }), [locale, timeZone]);
  const upcoming = meetings.filter((m) => m.startsAt >= now && m.status === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = meetings.filter((m) => !upcoming.includes(m)).slice(0, 5);
  const row = (m: PortalMeeting, faded = false) => (
    <li key={m.id} className={cn("flex items-start gap-3 py-2.5", faded && "opacity-70")}>
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="text-sm">
        <span className="block font-semibold">{m.title}</span>
        <span className="block text-on-surface-variant">
          {fmt.format(new Date(m.startsAt))} · {t("minutes", { n: m.durationMinutes })}
        </span>
        {m.location && (
          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
            <MapPin className="size-3" aria-hidden />
            {m.location}
          </span>
        )}
        {m.status === "cancelled" && <span className="text-xs font-bold text-danger">{t("cancelled")}</span>}
      </span>
    </li>
  );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <CalendarClock className="size-5 text-primary" aria-hidden />
        {t("title")}
      </h2>
      <div className={card}>
        {upcoming.length === 0 ? <p className="text-sm text-muted">{t("none")}</p> : <ul className="divide-y divide-outline-variant/30">{upcoming.map((m) => row(m))}</ul>}
        {past.length > 0 && (
          <>
            <p className="mt-4 text-xs font-semibold text-on-surface-variant">{t("past")}</p>
            <ul className="divide-y divide-outline-variant/30">{past.map((m) => row(m, true))}</ul>
          </>
        )}
      </div>
    </section>
  );
}

/** Files the company shares with the client (the signed contract today). */
export function FilesSection({ files }: { files: PortalFile[] }) {
  const t = useTranslations("clientPortal.files");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <FileText className="size-5 text-primary" aria-hidden />
        {t("title")}
      </h2>
      {files.length === 0 ? (
        <p className={cn(card, "text-center text-muted")}>{t("empty")}</p>
      ) : (
        <ul className={cn(card, "flex flex-col gap-2")}>
          {files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <FileText className="size-4 text-primary" aria-hidden />
                {t(`names.${f.name}`)}
              </span>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-primary hover:underline">
                  <Download className="size-4" aria-hidden />
                  {t("open")}
                </a>
              ) : (
                <span className="text-xs text-muted">{t("unavailable")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type PortalOperation = { code: string; subject: { ar: string; en: string }; status: string; currentStep: number; steps: { title: { ar: string; en: string } }[]; updatedAt: string };
export type PortalApplication = { jobTitle: string; stage: string; interviewAt: string | null; stageChangedAt: string };

/** The one operation this person follows: where it stands, step by step. */
export function OperationSection({ operation }: { operation: PortalOperation | null }) {
  const t = useTranslations("clientPortal.operation");
  const locale = useLocale() as "ar" | "en";
  const timeZone = useTimeZone();
  const fmt = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone }), [locale, timeZone]);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Workflow className="size-5 text-primary" aria-hidden />
        {t("title")}
      </h2>
      {!operation ? (
        <p className={cn(card, "text-center text-muted")}>{t("none")}</p>
      ) : (
        <div className={cn(card, "flex flex-col gap-4")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs text-on-surface-variant" dir="ltr">
                {operation.code}
              </p>
              <p className="text-lg font-bold">{operation.subject[locale]}</p>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold", operation.status === "completed" ? "bg-success-container text-success" : operation.status === "closed" ? "bg-surface-container text-muted" : operation.status === "changes_requested" ? "bg-tertiary-fixed text-tertiary" : "bg-primary-fixed text-primary")}>
              {t(`status.${operation.status}`)}
            </span>
          </div>
          {operation.steps.length > 0 && (
            <ol className="flex flex-col gap-2">
              {operation.steps.map((s, i) => {
                const done = operation.status === "completed" || i < operation.currentStep;
                const now = operation.status !== "completed" && operation.status !== "closed" && i === operation.currentStep;
                return (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", done ? "bg-success text-white" : now ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant")}>
                      {done ? <Check className="size-4" aria-hidden /> : i + 1}
                    </span>
                    <span className={cn(now && "font-bold")}>{s.title[locale]}</span>
                    {now && <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-bold text-primary">{t("now")}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs text-on-surface-variant">{t("updated", { date: fmt.format(new Date(operation.updatedAt)) })}</p>
        </div>
      )}
    </section>
  );
}

const STAGES = ["applied", "screening", "interview", "offer", "hired"] as const;

/** The candidate's application: the job, the stage reached, and the interview time. */
export function ApplicationSection({ application }: { application: PortalApplication | null }) {
  const t = useTranslations("clientPortal.application");
  const locale = useLocale();
  const timeZone = useTimeZone();
  const fmt = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone }), [locale, timeZone]);
  const reached = application ? STAGES.indexOf(application.stage as (typeof STAGES)[number]) : -1;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <UserSearch className="size-5 text-primary" aria-hidden />
        {t("title")}
      </h2>
      {!application ? (
        <p className={cn(card, "text-center text-muted")}>{t("none")}</p>
      ) : (
        <div className={cn(card, "flex flex-col gap-4")}>
          <p className="text-lg font-bold">{application.jobTitle}</p>
          {application.stage === "rejected" ? (
            <p className="rounded-md bg-surface-container-low px-3 py-2 text-sm">{t("rejected")}</p>
          ) : (
            <ol className="flex flex-wrap items-center gap-2 text-xs">
              {STAGES.map((s, i) => (
                <li key={s} className={cn("rounded-full px-3 py-1 font-bold", i < reached ? "bg-success-container text-success" : i === reached ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant")}>
                  {t(`stages.${s}`)}
                </li>
              ))}
            </ol>
          )}
          {application.interviewAt && application.stage === "interview" && (
            <p className="flex items-center gap-2 rounded-md bg-tertiary-fixed px-3 py-2 text-sm font-semibold text-tertiary">
              <CalendarClock className="size-4" aria-hidden />
              {t("interview", { date: fmt.format(new Date(application.interviewAt)) })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
