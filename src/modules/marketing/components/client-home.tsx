"use client";

import { CalendarDays, CheckCircle2, Clock, LogOut, MessageCircleQuestion, Send, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SignOutButton } from "@clerk/nextjs";
import { useEffect, useState, useTransition } from "react";
import { Logo } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Brief, BriefStatus } from "../briefs-mock";
import { replyToBrief, sendBrief } from "../actions";
import { updateBriefs, useBriefs } from "../briefs-store";
import { clients } from "../sections-mock";
import { BriefForm, type NewBrief } from "./client-portal";
import {
  ApplicationSection,
  FilesSection,
  InvoicesSection,
  MeetingsSection,
  OperationSection,
  type PortalApplication,
  type PortalFile,
  type PortalInvoice,
  type PortalMeeting,
  type PortalOperation,
} from "./portal-sections";

/** The demo client (public demo). A signed-in client user gets their own client from the page. */
export const DEMO_CLIENT_ID = "c1";

type Localized = { ar: string; en: string };
type Feature = "briefs" | "invoices" | "meetings" | "files" | "operation" | "application";

/** A signed-in client user's portal: their client and only what the company allows them (`access`). */
export type RealPortal = {
  client: { id: string; name: Localized; kind: "client" | "visitor" | "operation" | "candidate" };
  access: Feature[];
  briefs: Brief[];
  invoices: PortalInvoice[];
  meetings: PortalMeeting[];
  files: PortalFile[];
  operation: PortalOperation | null;
  application: PortalApplication | null;
};

const statusStyle: Record<BriefStatus, { className: string; icon: typeof Clock }> = {
  new: { className: "bg-primary-fixed text-primary", icon: Clock },
  received: { className: "bg-success-container text-success", icon: CheckCircle2 },
  clarification: { className: "bg-tertiary-fixed text-tertiary", icon: MessageCircleQuestion },
};

/**
 * The client's side of the portal: send briefs and follow their status. `real`: a signed-in client user
 * (their client and briefs, saved through the actions); without it, the demo client.
 */
export function ClientHome({ real, now }: { real?: RealPortal; now: string }) {
  const t = useTranslations("clientPortal");
  const tp = useTranslations("marketing.portal");
  const tm = useTranslations("marketing");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const demoBriefs = useBriefs();
  const client = real?.client ?? clients.find((c) => c.id === DEMO_CLIENT_ID) ?? clients[0];
  const myBriefs = real ? real.briefs : demoBriefs.filter((brief) => brief.clientId === client.id);
  // The demo shows every part of the portal; a real client only what the company allows
  const access: Feature[] = real ? real.access : ["briefs", "invoices", "meetings", "files"];
  const isClient = !real || real.client.kind === "client";
  const allowed = (f: Feature) => access.includes(f);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const submit = (brief: NewBrief) => {
    if (real) {
      if (pending) return;
      startTransition(async () => {
        const res = await sendBrief({ clientId: client.id, type: brief.type, objective: brief.objective, audience: brief.audience, details: brief.details, budget: brief.budget, deadline: brief.deadline || null });
        if (!res.ok) return setNotice(tErr(res.error));
        setNotice(t("notices.sent"));
        router.refresh();
      });
      return;
    }
    updateBriefs((prev) => [{ ...brief, id: `br-${Date.now()}`, receivedOn: new Date().toISOString().slice(0, 10), status: "new" }, ...prev]);
    setNotice(t("notices.sent"));
  };

  const reply = (brief: Brief) => {
    const text = (replies[brief.id] ?? "").trim();
    if (!text) {
      setNotice(t("notices.emptyReply"));
      return;
    }
    if (real) {
      startTransition(async () => {
        const res = await replyToBrief({ briefId: brief.id, reply: text });
        if (!res.ok) return setNotice(tErr(res.error));
        setReplies((prev) => ({ ...prev, [brief.id]: "" }));
        setNotice(t("notices.replied"));
        router.refresh();
      });
      return;
    }
    // The answer goes back to the team as a new request
    updateBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, clientReply: text, status: "new" } : b)));
    setReplies((prev) => ({ ...prev, [brief.id]: "" }));
    setNotice(t("notices.replied"));
  };

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 glass shadow-[0_1px_0_rgba(195,198,215,0.35)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href={real ? "/client-portal" : "/"} />
            <span className="hidden rounded-full bg-tertiary-fixed px-3 py-1 text-xs font-semibold text-tertiary sm:inline">{t("badge")}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <LocaleSwitcher />
            <span className="hidden font-semibold sm:inline">{client.name[locale]}</span>
            {real ? (
              <SignOutButton redirectUrl="/visitor-login">
                <button type="button" className="flex items-center gap-1.5 text-on-surface-variant hover:text-danger">
                  <LogOut className="size-4" aria-hidden />
                  {t("logout")}
                </button>
              </SignOutButton>
            ) : (
              <Link href="/" className="flex items-center gap-1.5 text-on-surface-variant hover:text-danger">
                <LogOut className="size-4" aria-hidden />
                {t("logout")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-8">
        <div>
          <h1 className="text-3xl font-extrabold">{t("welcome", { name: client.name[locale] })}</h1>
          <p className="mt-1 text-on-surface-variant">{t(allowed("briefs") ? "subtitle" : isClient ? "subtitleNoBriefs" : "subtitleOther")}</p>
        </div>

        {access.length === 0 && <p className="rounded-lg bg-surface-container-lowest p-8 text-center text-muted shadow-ambient ghost-border">{t("nothingAllowed")}</p>}

        {(allowed("operation") || allowed("application")) && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {allowed("operation") && <OperationSection operation={real?.operation ?? null} />}
            {allowed("application") && <ApplicationSection application={real?.application ?? null} />}
          </div>
        )}

        {(allowed("invoices") || allowed("meetings") || allowed("files")) && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {allowed("meetings") && <MeetingsSection meetings={real?.meetings ?? []} now={now} />}
            {allowed("invoices") && <InvoicesSection invoices={real?.invoices ?? []} today={now.slice(0, 10)} />}
            {allowed("files") && <FilesSection files={real?.files ?? []} />}
          </div>
        )}

        {allowed("briefs") && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* My requests */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">
              {t("myRequests")} <span className="text-sm font-normal text-muted">({myBriefs.length})</span>
            </h2>
            {myBriefs.length === 0 ? (
              <p className="rounded-lg bg-surface-container-lowest p-8 text-center text-muted shadow-ambient ghost-border">{t("empty")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {myBriefs.map((brief) => {
                  const status = statusStyle[brief.status];
                  const StatusIcon = status.icon;
                  return (
                    <li key={brief.id} className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-tertiary">{tp(`types.${brief.type}`)}</p>
                        <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", status.className)}>
                          <StatusIcon className="size-3.5" aria-hidden />
                          {t(`status.${brief.status}`)}
                        </span>
                      </div>
                      <p className="mt-2 font-bold">{brief.objective[locale]}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{brief.details[locale]}</p>
                      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Wallet className="size-3" aria-hidden />
                          <span dir="ltr" className="font-mono">{brief.budget.toLocaleString("en-US")}</span> {tm("currency")}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" aria-hidden />
                          {tp("fields.deadline")}: <span dir="ltr">{brief.deadline}</span>
                        </span>
                        <span>
                          {t("sentOn")} <span dir="ltr">{brief.receivedOn}</span>
                        </span>
                      </p>
                      {brief.clientReply && brief.status !== "clarification" && (
                        <p className="mt-3 rounded-md bg-surface-container-low px-3 py-2 text-xs">
                          <span className="font-semibold">{t("yourReply")}: </span>
                          {brief.clientReply}
                        </p>
                      )}
                      {brief.status === "clarification" && (
                        <div className="mt-4 flex flex-col gap-2 rounded-md bg-tertiary-fixed p-3">
                          <p className="text-sm font-semibold text-tertiary">{t("clarifyAsk")}</p>
                          <textarea
                            rows={2}
                            value={replies[brief.id] ?? ""}
                            onChange={(event) => setReplies((prev) => ({ ...prev, [brief.id]: event.target.value }))}
                            placeholder={t("replyPlaceholder")}
                            aria-label={t("replyPlaceholder")}
                            className="w-full resize-y rounded-sm bg-surface-container-lowest p-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => reply(brief)}
                            className="flex h-10 items-center justify-center gap-2 self-end rounded-sm bg-tertiary px-4 text-sm font-bold text-on-tertiary hover:brightness-110"
                          >
                            <Send className="size-4" aria-hidden />
                            {t("sendReply")}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* New brief */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold">{t("newBrief")}</h2>
            <div className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
              <BriefForm fixedClientId={client.id} intro={t("formIntro")} onSubmit={submit} />
            </div>
          </section>
        </div>
        )}
      </main>

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}
