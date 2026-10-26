"use client";

import { CalendarClock, Download, FileText, MapPin, Receipt } from "lucide-react";
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
