"use client";

import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarPlus,
  Check,
  Copy,
  FileText,
  Handshake,
  KeyRound,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
  Users,
  UserSearch,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import { ROOMS } from "@/modules/departments/rooms";
import { regenerateInviteCode } from "@/modules/marketing/actions";
import { createInvoice, markInvoicePaid } from "@/modules/profitability/actions";
import { useTimeZone } from "@/lib/time-zone";
import { normalizePhone } from "@/lib/phone";
import { bookClientMeeting, createPortalClient, deletePortalClient, sendPortalInviteEmail, updatePortalClient } from "../actions";
import { defaultAccess, FEATURES_BY_KIND, PORTAL_FEATURES, type ClientKind, type PortalFeature } from "../access";
import type { ClientInput, ClientInvoice, ClientMeeting, ClientPortalData, ClientStatus, PortalClient } from "../service";

const featureIcon: Record<PortalFeature, LucideIcon> = { briefs: Send, invoices: Receipt, meetings: CalendarClock, files: FileText, operation: Workflow, application: UserSearch };
const today = () => new Date().toISOString().slice(0, 10);

/** One value for who the person is: "room:<key>", "dept:<id>", "visitor", "operation", "candidate" or "" (a client not placed yet) */
type OwnerValue = string;
const SPECIAL_KINDS = ["visitor", "operation", "candidate"] as const;
const ownerOf = (c: Pick<PortalClient, "kind" | "room" | "departmentId">): OwnerValue =>
  c.kind !== "client" ? c.kind : c.room ? `room:${c.room}` : c.departmentId ? `dept:${c.departmentId}` : "";
const kindOf = (v: OwnerValue): ClientKind => ((SPECIAL_KINDS as readonly string[]).includes(v) ? (v as ClientKind) : "client");
const ownerInput = (v: OwnerValue): Pick<ClientInput, "kind" | "room" | "departmentId"> =>
  v.startsWith("room:")
    ? { kind: "client", room: v.slice(5), departmentId: null }
    : v.startsWith("dept:")
      ? { kind: "client", room: null, departmentId: v.slice(5) }
      : { kind: kindOf(v), room: null, departmentId: null };

const statusStyle: Record<ClientStatus, string> = {
  active: "bg-success-container text-success",
  onboarding: "bg-primary-fixed text-primary",
  paused: "bg-surface-container text-muted",
};
const ownerStyle = (v: OwnerValue) =>
  v === "visitor" || v === "operation" || v === "candidate"
    ? "bg-tertiary-fixed text-tertiary"
    : v.startsWith("room:")
      ? "bg-primary-fixed text-primary"
      : v.startsWith("dept:")
        ? "bg-secondary-container text-on-secondary-container"
        : "bg-surface-container text-muted";
const inputClass = "h-10 w-full rounded-md bg-surface-container-low px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40";

type Draft = {
  name: string;
  owner: OwnerValue;
  industry: string;
  status: ClientStatus;
  managerId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  portalAccess: PortalFeature[];
  runId: string;
  candidateId: string;
};

/**
 * HR → «بوابة العملاء»: every client and visitor of the company and who they belong to (an HQ room such as
 * marketing or sales, a company department, or «زائر اجتماع» for someone who only comes to a meeting), with
 * contact details, portal access code and meetings. `companyId` null = the public demo.
 */
export function ClientPortalView({ data, companyId, companySlug }: { data: ClientPortalData; companyId: string | null; companySlug: string }) {
  const t = useTranslations("clientsPortal");
  const tNav = useTranslations("app.nav");
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
  const [filter, setFilter] = useState<OwnerValue | "all">("all");
  const [editing, setEditing] = useState<PortalClient | "new" | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const ownerLabel = (v: OwnerValue) =>
    v === "visitor" || v === "operation" || v === "candidate" ? t(`owner.${v}`) : v.startsWith("room:") ? tNav(v.slice(5)) : v.startsWith("dept:") ? (state.departments.find((d) => d.id === v.slice(5))?.name[locale] ?? "—") : t("owner.none");
  const memberName = (id: string | null) => (id ? state.members.find((m) => m.id === id)?.name[locale] : undefined);
  const timeZone = useTimeZone();
  const fmt = useMemo(() => new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }), [locale, timeZone]);

  function run(local: () => void, remote: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) {
    if (demo) {
      local();
      after?.();
      return setNotice(success);
    }
    startTransition(async () => {
      const result = await remote();
      if (!result.ok) return setNotice(tErr(result.error));
      after?.();
      setNotice(success);
      router.refresh();
    });
  }

  const save = (client: PortalClient | null, d: Draft) => {
    const input: ClientInput & { name: string } = {
      name: d.name.trim(),
      ...ownerInput(d.owner),
      industry: d.industry.trim() || null,
      status: d.status,
      managerId: d.managerId || null,
      contactName: d.contactName.trim() || null,
      contactPhone: d.contactPhone.trim() || null,
      contactEmail: d.contactEmail.trim() || null,
      notes: d.notes.trim() || null,
      portalAccess: d.portalAccess,
      // Only the link that fits the kind (switching kinds in the form leaves the other one behind)
      runId: kindOf(d.owner) === "operation" ? d.runId || null : null,
      candidateId: kindOf(d.owner) === "candidate" ? d.candidateId || null : null,
    };
    run(
      () =>
        setState((s) => ({
          ...s,
          clients: client
            ? s.clients.map((c) => (c.id === client.id ? ({ ...c, ...input } as PortalClient) : c))
            : [{ id: `demo-${Date.now()}`, inviteCode: "DEMO123", portalUsers: 0, createdAt: new Date().toISOString(), ...input } as PortalClient, ...s.clients],
        })),
      () => (client ? updatePortalClient({ clientId: client.id, ...input }) : createPortalClient({ companyId: companyId!, ...input })),
      t(client ? "notices.saved" : d.owner === "visitor" ? "notices.visitorAdded" : "notices.added", { name: input.name }),
      () => setEditing(null),
    );
  };

  const remove = (c: PortalClient) => {
    if (!window.confirm(t("deleteConfirm", { name: c.name }))) return;
    run(
      () => setState((s) => ({ ...s, clients: s.clients.filter((x) => x.id !== c.id), meetings: s.meetings.filter((m) => m.clientId !== c.id) })),
      () => deletePortalClient({ clientId: c.id }),
      t("notices.deleted", { name: c.name }),
    );
  };

  const book = (c: PortalClient, startsAt: string, durationMinutes: number, location: string, title: string) =>
    run(
      () =>
        setState((s) => ({
          ...s,
          meetings: [...s.meetings, { id: `demo-mt-${Date.now()}`, clientId: c.id, title: title || c.name, startsAt, durationMinutes, location: location || null }].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        })),
      () => bookClientMeeting({ clientId: c.id, startsAt, durationMinutes, location: location || null, title: title || null, attendeeIds: c.managerId ? [c.managerId] : [] }),
      t("notices.booked", { name: c.name }),
      () => setBooking(null),
    );

  // ---------- Invoices (profitability.view): shown to the client when «الفواتير» is allowed ----------
  const addInvoice = (c: PortalClient, amount: number, dueOn: string) => {
    const issuedOn = today();
    run(
      () =>
        setState((s) => ({
          ...s,
          invoices: [{ id: `demo-inv-${Date.now()}`, clientId: c.id, period: issuedOn.slice(0, 7), amount, issuedOn, dueOn, paidOn: null }, ...s.invoices],
        })),
      () => createInvoice({ clientId: c.id, period: issuedOn.slice(0, 7), amount, issuedOn, dueOn }),
      t("invoices.added", { name: c.name }),
    );
  };
  const markPaid = (inv: ClientInvoice) =>
    run(
      () => setState((s) => ({ ...s, invoices: s.invoices.map((i) => (i.id === inv.id ? { ...i, paidOn: today() } : i)) })),
      () => markInvoicePaid({ invoiceId: inv.id, paidOn: today() }),
      t("invoices.paidNotice"),
    );

  // ---------- Invite: WhatsApp (opens the chat with the message) and email (an invitation link) ----------
  const inviteLink = (c: PortalClient) => `${window.location.origin}${locale === "en" ? "/en" : ""}/visitor-login?invite=${encodeURIComponent(c.inviteCode ?? "")}`;
  const inviteOnWhatsApp = (c: PortalClient) => {
    const phone = normalizePhone(c.contactPhone);
    const message = t("invite.message", { name: c.contactName || c.name, company: state.companyName[locale] || state.companyName.ar, link: inviteLink(c), code: c.inviteCode ?? "" });
    window.open(`https://wa.me/${phone ?? ""}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };
  const inviteByEmail = (c: PortalClient) => {
    if (demo) return setNotice(t("invite.emailed", { email: c.contactEmail ?? "" }));
    startTransition(async () => {
      const res = await sendPortalInviteEmail({ clientId: c.id, locale });
      if (!res.ok) return setNotice(tErr(res.error));
      setNotice(res.data.emailed ? t("invite.emailed", { email: c.contactEmail ?? "" }) : t("invite.emailFailed"));
    });
  };

  const renewCode = (c: PortalClient) =>
    run(
      () => setState((s) => ({ ...s, clients: s.clients.map((x) => (x.id === c.id ? { ...x, inviteCode: Math.random().toString(36).slice(2, 9).toUpperCase() } : x)) })),
      () => regenerateInviteCode({ clientId: c.id }),
      t("notices.codeRenewed"),
    );

  // ---------- Groups for the filter ----------
  const groups = useMemo(() => {
    const counts = new Map<OwnerValue, number>();
    for (const c of state.clients) counts.set(ownerOf(c), (counts.get(ownerOf(c)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.clients]);
  const visible = state.clients.filter((c) => filter === "all" || ownerOf(c) === filter);
  const nextMeeting = (id: string) => state.meetings.find((m) => m.clientId === id);

  const stats: { key: string; icon: LucideIcon; value: number }[] = [
    { key: "clients", icon: Handshake, value: state.clients.filter((c) => c.kind === "client").length },
    { key: "visitors", icon: UserRound, value: state.clients.filter((c) => c.kind === "visitor").length },
    { key: "owners", icon: Building2, value: new Set(state.clients.filter((c) => c.kind === "client" && (c.room || c.departmentId)).map(ownerOf)).size },
    { key: "meetings", icon: CalendarClock, value: state.meetings.length },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header>
          <Link href={`/c/${companySlug}/hr`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
            {t("back")}
          </Link>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
          <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
        </header>

        {demo && <p className="rounded-lg bg-surface-container-low px-5 py-3 text-sm text-on-surface-variant">{t("demoNotice")}</p>}

        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ key, icon: Icon, value }) => (
            <li key={key} className="flex items-center gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
              <span className="grid size-11 place-items-center rounded-lg bg-primary-fixed text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs text-on-surface-variant">{t(`stats.${key}`)}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t("filters.all", { count: state.clients.length })} />
          {groups.map(([v, n]) => (
            <FilterChip key={v || "none"} active={filter === v} onClick={() => setFilter(v)} label={`${ownerLabel(v)} (${n})`} />
          ))}
          {state.canManage && editing === null && (
            <Button onClick={() => setEditing("new")} className="ms-auto">
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Button>
          )}
        </div>
        {!state.canManage && <p className="text-sm text-on-surface-variant">{t("readOnly")}</p>}

        {editing !== null && (
          <ClientForm
            client={editing === "new" ? null : editing}
            state={state}
            pending={pending}
            ownerLabel={ownerLabel}
            onClose={() => setEditing(null)}
            onSubmit={(d) => save(editing === "new" ? null : editing, d)}
          />
        )}

        {visible.length === 0 ? (
          <p className="rounded-lg bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">{t("empty")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((c) => {
              const owner = ownerOf(c);
              const meeting = nextMeeting(c.id);
              const manager = memberName(c.managerId);
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">{c.name}</h3>
                      {c.industry && <p className="text-sm text-on-surface-variant">{c.industry}</p>}
                    </div>
                    {c.kind === "client" && <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", statusStyle[c.status])}>{t(`status.${c.status}`)}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("rounded-full px-2.5 py-1 font-bold", ownerStyle(owner))}>
                      {owner === "visitor"
                        ? t("owner.visitor")
                        : owner === "operation"
                          ? t("owner.follows", { code: state.runs.find((r) => r.id === c.runId)?.code ?? "—" })
                          : owner === "candidate"
                            ? t("owner.appliedFor", { job: state.candidates.find((x) => x.id === c.candidateId)?.job ?? "—" })
                            : t("owner.belongsTo", { name: ownerLabel(owner) })}
                    </span>
                    {manager && <span className="text-on-surface-variant">{t("manager", { name: manager })}</span>}
                  </div>
                  {(c.contactName || c.contactPhone || c.contactEmail) && (
                    <ul className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-3 text-sm">
                      {c.contactName && (
                        <li className="flex items-center gap-2">
                          <UserRound className="size-4 text-primary" aria-hidden />
                          {c.contactName}
                        </li>
                      )}
                      {c.contactPhone && (
                        <li className="flex items-center gap-2">
                          <Phone className="size-4 text-primary" aria-hidden />
                          <a href={`tel:${c.contactPhone.replace(/\s/g, "")}`} dir="ltr" className="hover:underline">
                            {c.contactPhone}
                          </a>
                        </li>
                      )}
                      {c.contactEmail && (
                        <li className="flex items-center gap-2">
                          <Mail className="size-4 text-primary" aria-hidden />
                          <a href={`mailto:${c.contactEmail}`} dir="ltr" className="truncate hover:underline">
                            {c.contactEmail}
                          </a>
                        </li>
                      )}
                    </ul>
                  )}
                  {c.notes && <p className="text-sm text-on-surface-variant">{c.notes}</p>}
                  {meeting && <MeetingLine meeting={meeting} fmt={fmt} />}
                  <AccessChips access={c.portalAccess} />
                  {state.canMoney && c.portalAccess.includes("invoices") && (
                    <InvoicesBox invoices={state.invoices.filter((i) => i.clientId === c.id)} pending={pending} onAdd={(amount, dueOn) => addInvoice(c, amount, dueOn)} onPaid={markPaid} />
                  )}
                  {state.canManage && c.inviteCode && <PortalCode client={c} pending={pending} onRenew={() => renewCode(c)} onCopied={() => setNotice(t("notices.copied"))} />}
                  {state.canManage && c.inviteCode && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" disabled={!c.contactPhone} onClick={() => inviteOnWhatsApp(c)} className="bg-success bg-none text-white hover:bg-success/90" title={c.contactPhone ? undefined : t("invite.noPhone")}>
                        <MessageCircle className="size-4" aria-hidden />
                        {t("invite.whatsapp")}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={!c.contactEmail || pending} onClick={() => inviteByEmail(c)} title={c.contactEmail ? undefined : t("invite.noEmail")}>
                        <Mail className="size-4" aria-hidden />
                        {t("invite.email")}
                      </Button>
                      {(!c.contactPhone || !c.contactEmail) && <span className="text-xs text-on-surface-variant">{t(!c.contactPhone && !c.contactEmail ? "invite.addBoth" : !c.contactPhone ? "invite.noPhone" : "invite.noEmail")}</span>}
                    </div>
                  )}
                  {booking === c.id && <MeetingForm client={c} pending={pending} managerName={manager} onClose={() => setBooking(null)} onSubmit={(at, minutes, place, title) => book(c, at, minutes, place, title)} />}
                  {state.canManage && (
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {booking !== c.id && (
                        <Button size="sm" onClick={() => setBooking(c.id)}>
                          <CalendarPlus className="size-4" aria-hidden />
                          {t("book")}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                        <Pencil className="size-4" aria-hidden />
                        {t("edit")}
                      </Button>
                      <Button size="sm" variant="icon" disabled={pending} onClick={() => remove(c)} aria-label={t("delete")} title={t("delete")} className="text-danger">
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("h-9 rounded-full px-4 text-sm font-semibold transition-colors", active ? "bg-primary text-on-primary" : "bg-surface-container-low hover:bg-surface-container")}>
      {label}
    </button>
  );
}

function MeetingLine({ meeting, fmt }: { meeting: ClientMeeting; fmt: Intl.DateTimeFormat }) {
  const t = useTranslations("clientsPortal");
  return (
    <p className="flex items-start gap-2 rounded-lg bg-tertiary-fixed/40 px-3 py-2 text-sm">
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-tertiary" aria-hidden />
      <span>
        <span className="font-semibold">{t("nextMeeting", { date: fmt.format(new Date(meeting.startsAt)) })}</span>
        <span className="block text-xs text-on-surface-variant">{[meeting.title, meeting.location].filter(Boolean).join(" · ")}</span>
      </span>
    </p>
  );
}

/** What this client sees in their portal, as small chips. */
function AccessChips({ access }: { access: PortalFeature[] }) {
  const t = useTranslations("clientsPortal.access");
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-on-surface-variant">{t("label")}</span>
      {access.length === 0 ? (
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-muted">{t("nothing")}</span>
      ) : (
        access.map((f) => {
          const Icon = featureIcon[f];
          return (
            <span key={f} className="flex items-center gap-1 rounded-full bg-primary-fixed/60 px-2 py-0.5 font-semibold text-primary">
              <Icon className="size-3" aria-hidden />
              {t(`features.${f}`)}
            </span>
          );
        })
      )}
    </div>
  );
}

/** The client's invoices: amount, due date, paid or not; add one, or mark one as paid (recorded by hand). */
function InvoicesBox({ invoices, pending, onAdd, onPaid }: { invoices: ClientInvoice[]; pending: boolean; onAdd: (amount: number, dueOn: string) => void; onPaid: (i: ClientInvoice) => void }) {
  const t = useTranslations("clientsPortal.invoices");
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const now = today();
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <Wallet className="size-4 text-primary" aria-hidden />
          {t("title")}
        </span>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs font-bold text-primary hover:underline">
            {t("add")}
          </button>
        )}
      </div>
      {invoices.length === 0 && !adding && <p className="text-xs text-on-surface-variant">{t("empty")}</p>}
      <ul className="flex flex-col gap-1.5">
        {invoices.map((i) => {
          const late = !i.paidOn && i.dueOn < now;
          return (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-container-lowest px-2.5 py-1.5">
              <span>
                <bdi dir="ltr" className="font-bold">{i.amount.toLocaleString("en-US")}</bdi> {t("currency")}
                <span className="ms-2 text-xs text-on-surface-variant">{t.rich("due", { date: i.dueOn, d: (c) => <bdi dir="ltr">{c}</bdi> })}</span>
              </span>
              {i.paidOn ? (
                <span className="rounded-full bg-success-container px-2 py-0.5 text-xs font-bold text-success">{t("paid")}</span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", late ? "bg-danger-container text-danger" : "bg-tertiary-fixed text-tertiary")}>{t(late ? "late" : "unpaid")}</span>
                  <button type="button" disabled={pending} onClick={() => onPaid(i)} className="text-xs font-bold text-primary hover:underline">
                    {t("markPaid")}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {adding && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(amount);
            if (!(value > 0) || !dueOn) return;
            onAdd(value, dueOn);
            setAmount("");
            setDueOn("");
            setAdding(false);
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {t("amount")}
            <input type="number" min={1} step="any" required dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(inputClass, "w-32")} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {t("dueOn")}
            <input type="date" required min={now} value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={cn(inputClass, "w-40")} />
          </label>
          <Button type="submit" size="sm" disabled={pending} className="h-10">
            {t("save")}
          </Button>
          <Button size="sm" variant="tertiary" className="h-10" onClick={() => setAdding(false)}>
            {t("close")}
          </Button>
        </form>
      )}
    </div>
  );
}

function PortalCode({ client, pending, onRenew, onCopied }: { client: PortalClient; pending: boolean; onRenew: () => void; onCopied: () => void }) {
  const t = useTranslations("clientsPortal");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <KeyRound className="size-4 text-on-surface-variant" aria-hidden />
      <span className="text-on-surface-variant">{t("code")}</span>
      <code dir="ltr" className="rounded bg-surface-container-low px-2 py-0.5 font-mono font-bold tracking-widest">
        {client.inviteCode}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(client.inviteCode!);
          onCopied();
        }}
        aria-label={t("copy")}
        title={t("copy")}
        className="rounded-full p-1 hover:bg-surface-container-low"
      >
        <Copy className="size-3.5" aria-hidden />
      </button>
      <button type="button" disabled={pending} onClick={onRenew} aria-label={t("renew")} title={t("renew")} className="rounded-full p-1 hover:bg-surface-container-low">
        <RefreshCw className="size-3.5" aria-hidden />
      </button>
      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
        <Users className="size-3.5" aria-hidden />
        {t("portalUsers", { count: client.portalUsers })}
      </span>
    </div>
  );
}

function ClientForm({
  client,
  state,
  pending,
  ownerLabel,
  onSubmit,
  onClose,
}: {
  client: PortalClient | null;
  state: ClientPortalData;
  pending: boolean;
  ownerLabel: (v: OwnerValue) => string;
  onSubmit: (d: Draft) => void;
  onClose: () => void;
}) {
  const t = useTranslations("clientsPortal");
  const locale = useLocale() as "ar" | "en";
  const [d, setD] = useState<Draft>({
    name: client?.name ?? "",
    owner: client ? ownerOf(client) : "room:marketing",
    industry: client?.industry ?? "",
    status: client?.status ?? "onboarding",
    managerId: client?.managerId ?? "",
    contactName: client?.contactName ?? "",
    contactPhone: client?.contactPhone ?? "",
    contactEmail: client?.contactEmail ?? "",
    notes: client?.notes ?? "",
    portalAccess: client?.portalAccess ?? defaultAccess("client"),
    runId: client?.runId ?? "",
    candidateId: client?.candidateId ?? "",
  });
  const kind = kindOf(d.owner);
  const offered = FEATURES_BY_KIND[kind];
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  // A new client starts from the default of its kind; editing keeps what was chosen
  const setOwner = (e: { target: { value: string } }) => {
    const owner = e.target.value;
    const next = kindOf(owner);
    if (next === kind) return setD({ ...d, owner });
    // Another kind: a new person starts from its defaults; an existing one keeps only the parts that still fit
    const access = client ? d.portalAccess.filter((f) => FEATURES_BY_KIND[next].includes(f)) : defaultAccess(next);
    setD({ ...d, owner, portalAccess: access });
  };
  const toggleFeature = (f: PortalFeature) =>
    setD({ ...d, portalAccess: d.portalAccess.includes(f) ? d.portalAccess.filter((x) => x !== f) : PORTAL_FEATURES.filter((x) => x === f || d.portalAccess.includes(x)) });
  const visitor = kind !== "client";

  return (
    <form
      className="grid gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (d.name.trim() && !(kind === "operation" && !d.runId) && !(kind === "candidate" && !d.candidateId)) onSubmit(d);
      }}
    >
      <h3 className="text-lg font-bold sm:col-span-2 lg:col-span-4">{t(client ? "form.editTitle" : "form.newTitle")}</h3>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t(visitor ? "form.visitorName" : "form.name")}
        <input autoFocus required maxLength={120} value={d.name} onChange={set("name")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        {t("form.owner")}
        <Select value={d.owner} onChange={setOwner} className="h-10 bg-surface-container-low">
          <optgroup label={t("form.rooms")}>
            {ROOMS.filter((r) => r.key !== "clients").map((r) => (
              <option key={r.key} value={`room:${r.key}`}>
                {ownerLabel(`room:${r.key}`)}
              </option>
            ))}
          </optgroup>
          {state.departments.length > 0 && (
            <optgroup label={t("form.departments")}>
              {state.departments
                .filter((dep) => dep.active !== false || d.owner === `dept:${dep.id}`)
                .map((dep) => (
                  <option key={dep.id} value={`dept:${dep.id}`}>
                    {dep.name[locale]}
                  </option>
                ))}
            </optgroup>
          )}
          <optgroup label={t("form.other")}>
            <option value="visitor">{t("owner.visitor")}</option>
            <option value="operation">{t("owner.operation")}</option>
            <option value="candidate">{t("owner.candidate")}</option>
          </optgroup>
        </Select>
        <span className="text-xs font-normal text-on-surface-variant">{t(kind === "client" ? "form.ownerHint" : `form.${kind}Hint`)}</span>
      </label>
      {kind === "operation" && (
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
          {t("form.run")}
          <Select required value={d.runId} onChange={set("runId")} className="h-10 bg-surface-container-low">
            <option value="">—</option>
            {state.runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.subject[locale]}
              </option>
            ))}
          </Select>
          {state.runs.length === 0 && <span className="text-xs font-normal text-on-surface-variant">{t("form.noRuns")}</span>}
        </label>
      )}
      {kind === "candidate" && (
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
          {t("form.candidate")}
          <Select required value={d.candidateId} onChange={set("candidateId")} className="h-10 bg-surface-container-low">
            <option value="">—</option>
            {state.candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.job}
              </option>
            ))}
          </Select>
          {state.candidates.length === 0 && <span className="text-xs font-normal text-on-surface-variant">{t("form.noCandidates")}</span>}
        </label>
      )}
      {kind === "client" && (
        <>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("form.industry")}
            <input maxLength={80} value={d.industry} onChange={set("industry")} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("form.status")}
            <Select value={d.status} onChange={set("status")} className="h-10 bg-surface-container-low">
              {(["onboarding", "active", "paused"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t(visitor ? "form.host" : "form.manager")}
        <Select value={d.managerId} onChange={set("managerId")} className="h-10 bg-surface-container-low">
          <option value="">—</option>
          {state.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name[locale]}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.contactName")}
        <input maxLength={120} value={d.contactName} onChange={set("contactName")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.phone")}
        <input type="tel" dir="ltr" maxLength={40} value={d.contactPhone} onChange={set("contactPhone")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("form.email")}
        <input type="email" dir="ltr" maxLength={200} value={d.contactEmail} onChange={set("contactEmail")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2 lg:col-span-4">
        {t(visitor ? "form.visitPurpose" : "form.notes")}
        <textarea rows={2} maxLength={2000} value={d.notes} onChange={set("notes")} className="rounded-md bg-surface-container-low p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40" />
      </label>
      <fieldset className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2 lg:col-span-4">
        <legend className="mb-1">{t("access.title")}</legend>
        <div className="flex flex-wrap gap-2">
          {PORTAL_FEATURES.filter((f) => offered.includes(f)).map((f) => {
            const on = d.portalAccess.includes(f);
            const Icon = featureIcon[f];
            return (
              <button
                key={f}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggleFeature(f)}
                className={cn("flex h-10 items-center gap-2 rounded-md px-3 text-sm transition-colors", on ? "bg-primary-fixed font-bold text-primary ring-2 ring-primary/30" : "bg-surface-container-low text-on-surface-variant")}
              >
                <Icon className="size-4" aria-hidden />
                {t(`access.features.${f}`)}
              </button>
            );
          })}
        </div>
        <span className="text-xs font-normal text-on-surface-variant">{t("access.hint")}</span>
      </fieldset>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending || !d.name.trim()}>
          <Check className="size-4" aria-hidden />
          {t("form.save")}
        </Button>
        <Button variant="tertiary" onClick={onClose}>
          {t("form.close")}
        </Button>
      </div>
    </form>
  );
}

function MeetingForm({
  client,
  pending,
  managerName,
  onSubmit,
  onClose,
}: {
  client: PortalClient;
  pending: boolean;
  managerName?: string;
  onSubmit: (at: string, minutes: number, place: string, title: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("clientsPortal");
  const [date, setDate] = useState(() => {
    const x = new Date(Date.now() + 86_400_000);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
  const [time, setTime] = useState("11:00");
  const [minutes, setMinutes] = useState(60);
  const [place, setPlace] = useState("");
  const [title, setTitle] = useState("");
  return (
    <form
      className="grid gap-3 rounded-lg bg-tertiary-fixed/40 p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new Date(`${date}T${time}`).toISOString(), minutes, place.trim(), title.trim());
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
        {t("meeting.title")}
        <input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={client.name} className={cn(inputClass, "bg-surface-container-lowest")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("meeting.date")}
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "bg-surface-container-lowest")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("meeting.time")}
        <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputClass, "bg-surface-container-lowest")} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("meeting.duration")}
        <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-10 bg-surface-container-lowest">
          {[30, 45, 60, 90, 120].map((m) => (
            <option key={m} value={m}>
              {t("meeting.minutes", { count: m })}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {t("meeting.place")}
        <input maxLength={300} value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t("meeting.placeHint")} className={cn(inputClass, "bg-surface-container-lowest")} />
      </label>
      <p className="text-xs text-on-surface-variant sm:col-span-2">{managerName ? t("meeting.withManager", { name: managerName }) : t("meeting.inSchedule")}</p>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Check className="size-4" aria-hidden />
          {t("meeting.save")}
        </Button>
        <Button size="sm" variant="tertiary" onClick={onClose}>
          {t("form.close")}
        </Button>
      </div>
    </form>
  );
}
