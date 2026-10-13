"use client";

import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Car,
  Check,
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
  UserSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { currentUserId, members } from "@/modules/hq/mock";
import { clients } from "@/modules/marketing/sections-mock";
import { conflicts, scheduleKinds, transports, type ScheduleItem, type ScheduleKind, type Transport } from "../schedule";

type ScheduleSectionProps = {
  items: ScheduleItem[];
  setItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  onNotice: (message: string) => void;
};

const kindIcon: Record<ScheduleKind, LucideIcon> = { meeting: Users, appointment: CalendarClock, trip: Car, interview: UserSearch };
const kindStyle: Record<ScheduleKind, string> = {
  meeting: "bg-primary-fixed text-primary",
  appointment: "bg-tertiary-fixed text-tertiary",
  trip: "bg-secondary-container text-on-secondary-container",
  interview: "bg-success-container text-success",
};
/** Kinds that involve someone outside the company (contact name and phone) */
const external = new Set<ScheduleKind>(["appointment", "trip", "interview"]);

const inputClass = "h-11 rounded-md bg-surface-container-low px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40";
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Company schedule: meetings, appointments, trips outside the office and interviews, grouped by day,
 * with full details per item (place, people, client, contact, purpose, transport) and double-booking warnings.
 */
export function ScheduleSection({ items, setItems, onNotice }: ScheduleSectionProps) {
  const t = useTranslations("ops.schedule");
  const locale = useLocale() as "ar" | "en";
  const [[today, tomorrow]] = useState(() => [localDay(new Date()), localDay(new Date(Date.now() + 86_400_000))]);
  const [kindFilter, setKindFilter] = useState<ScheduleKind | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [range, setRange] = useState<"upcoming" | "past">("upcoming");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name[locale] ?? "—";
  const clash = useMemo(() => conflicts(items), [items]);

  const visible = items
    .filter((i) => kindFilter === "all" || i.kind === kindFilter)
    .filter((i) => !onlyMine || i.organizerId === currentUserId || i.attendeeIds.includes(currentUserId))
    .filter((i) => (range === "upcoming" ? i.startsAt.slice(0, 10) >= today : i.startsAt.slice(0, 10) < today))
    .sort((a, b) => (range === "upcoming" ? a.startsAt.localeCompare(b.startsAt) : b.startsAt.localeCompare(a.startsAt)));

  const days = visible.reduce<Map<string, ScheduleItem[]>>((map, item) => {
    const key = item.startsAt.slice(0, 10);
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map());

  const dayLabel = (key: string) => {
    const date = new Date(`${key}T00:00:00`);
    const name = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: "long", day: "numeric", month: "long" }).format(date);
    return key === today ? `${t("today")} · ${name}` : key === tomorrow ? `${t("tomorrow")} · ${name}` : name;
  };
  const timeRange = (item: ScheduleItem) => {
    const start = new Date(`${item.startsAt}:00`);
    const end = new Date(start.getTime() + item.durationMinutes * 60_000);
    const f = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${f(start)} – ${f(end)}`;
  };

  const counts = scheduleKinds.map((k) => [k, items.filter((i) => i.kind === k && i.status === "scheduled" && i.startsAt.slice(0, 10) >= today).length] as const);

  const setStatus = (item: ScheduleItem, status: ScheduleItem["status"]) => {
    // TODO(backend): updateScheduleItem({ itemId, status })
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
    onNotice(t(`notices.${status}`, { title: item.title }));
  };
  const remove = (item: ScheduleItem) => {
    // TODO(backend): deleteScheduleItem({ itemId })
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    onNotice(t("notices.deleted"));
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold">
          <CalendarClock className="size-5 text-primary" aria-hidden />
          {t("title")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md bg-surface-container-low p-1" role="radiogroup" aria-label={t("range")}>
            {(["upcoming", "past"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                onClick={() => setRange(r)}
                className={cn("rounded-sm px-3 py-1.5 text-sm", range === r ? "bg-surface-container-lowest font-bold text-primary shadow-ambient" : "text-on-surface-variant")}
              >
                {t(r)}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={onlyMine}
            onClick={() => setOnlyMine((v) => !v)}
            className={cn("rounded-md px-3 py-2 text-sm ghost-border", onlyMine ? "bg-primary-fixed font-bold text-primary" : "bg-surface-container-lowest text-on-surface-variant")}
          >
            {t("mine")}
          </button>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            aria-expanded={adding}
            className="flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-on-primary hover:brightness-110"
          >
            {adding ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {t("add")}
          </button>
        </div>
      </div>

      {/* Kind filter with upcoming counts */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={kindFilter === "all"}
          onClick={() => setKindFilter("all")}
          className={cn("rounded-full px-3 py-1.5 text-xs font-semibold ghost-border", kindFilter === "all" ? "bg-inverse-surface text-inverse-on-surface" : "bg-surface-container-lowest")}
        >
          {t("allKinds")}
        </button>
        {counts.map(([kind, n]) => {
          const Icon = kindIcon[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ghost-border",
                kindFilter === kind ? kindStyle[kind] : "bg-surface-container-lowest text-on-surface-variant",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {t(`kinds.${kind}`)}
              <span className="rounded-sm bg-surface-container px-1.5 text-on-surface">{n}</span>
            </button>
          );
        })}
      </div>

      {adding && (
        <NewItemForm
          onCancel={() => setAdding(false)}
          onAdd={(item) => {
            // TODO(backend): createScheduleItem (operations/actions.ts)
            setItems((prev) => [...prev, item]);
            setAdding(false);
            setRange(item.startsAt.slice(0, 10) >= today ? "upcoming" : "past");
            onNotice(t("notices.added", { title: item.title }));
          }}
        />
      )}

      {days.size === 0 ? (
        <p className="rounded-lg bg-surface-container-low py-10 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...days].map(([key, dayItems]) => (
            <div key={key} className="flex flex-col gap-2">
              <h4 className={cn("text-sm font-bold", key === today && "text-primary")}>{dayLabel(key)}</h4>
              <ul className="flex flex-col gap-2">
                {dayItems.map((item) => {
                  const Icon = kindIcon[item.kind];
                  const expanded = open === item.id;
                  const client = clients.find((c) => c.id === item.clientId);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-lg bg-surface-container-lowest shadow-ambient ghost-border",
                        item.status === "cancelled" && "opacity-60",
                        clash.has(item.id) && item.status === "scheduled" && "ring-1 ring-danger/40",
                      )}
                    >
                      <button type="button" onClick={() => setOpen(expanded ? null : item.id)} aria-expanded={expanded} className="flex w-full flex-wrap items-center gap-3 p-3 text-start">
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", kindStyle[item.kind])}>
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-48 flex-1">
                          <span className={cn("block font-semibold", item.status === "cancelled" && "line-through")}>{item.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" aria-hidden />
                              <bdi dir="ltr" className="font-mono">{timeRange(item)}</bdi>
                            </span>
                            <span className="flex min-w-0 items-center gap-1">
                              <MapPin className="size-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{item.location}</span>
                            </span>
                            {client && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="size-3.5" aria-hidden />
                                {client.name[locale]}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="flex -space-x-2 rtl:space-x-reverse">
                          {[item.organizerId, ...item.attendeeIds].slice(0, 4).map((id) => (
                            <Avatar key={id} name={memberName(id)} size="sm" />
                          ))}
                        </span>
                        {clash.has(item.id) && item.status === "scheduled" && (
                          <span className="flex items-center gap-1 rounded-full bg-danger-container px-2 py-0.5 text-[11px] font-bold text-danger">
                            <AlertTriangle className="size-3" aria-hidden />
                            {t("conflict")}
                          </span>
                        )}
                        {item.status !== "scheduled" && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", item.status === "done" ? "bg-success-container text-success" : "bg-surface-container text-on-surface-variant")}>
                            {t(`statuses.${item.status}`)}
                          </span>
                        )}
                        <ChevronDown className={cn("size-4 shrink-0 text-on-surface-variant transition-transform", expanded && "rotate-180")} aria-hidden />
                      </button>

                      {expanded && (
                        <div className="grid gap-4 border-t border-outline-variant/30 p-4 text-sm md:grid-cols-2">
                          <dl className="flex flex-col gap-2">
                            <Detail label={t("kind")}>{t(`kinds.${item.kind}`)}</Detail>
                            <Detail label={t("when")}>
                              <bdi dir="ltr" className="font-mono">{item.startsAt.replace("T", " ")}</bdi> · {t("duration", { minutes: item.durationMinutes })}
                            </Detail>
                            <Detail label={t("location")}>{item.location}</Detail>
                            {item.transport && <Detail label={t("transport")}>{t(`transports.${item.transport}`)}</Detail>}
                            {item.purpose && <Detail label={t("purpose")}>{item.purpose}</Detail>}
                            {item.notes && <Detail label={t("notes")}>{item.notes}</Detail>}
                          </dl>
                          <dl className="flex flex-col gap-2">
                            <Detail label={t("organizer")}>{memberName(item.organizerId)}</Detail>
                            <Detail label={t("attendees")}>{item.attendeeIds.length ? item.attendeeIds.map(memberName).join("، ") : t("noAttendees")}</Detail>
                            {client && <Detail label={t("client")}>{client.name[locale]}</Detail>}
                            {item.contact && (
                              <Detail label={item.kind === "interview" ? t("candidate") : t("contact")}>
                                <span className="flex flex-col">
                                  <span className="flex items-center gap-1 font-semibold">
                                    <UserRound className="size-3.5" aria-hidden />
                                    {item.contact.name}
                                  </span>
                                  {item.contact.role && <span className="text-xs text-on-surface-variant">{item.contact.role}</span>}
                                  {item.contact.phone && (
                                    <a href={`tel:${item.contact.phone}`} className="mt-0.5 flex w-fit items-center gap-1 text-primary hover:underline">
                                      <Phone className="size-3.5" aria-hidden />
                                      <bdi dir="ltr" className="font-mono">{item.contact.phone}</bdi>
                                    </a>
                                  )}
                                </span>
                              </Detail>
                            )}
                          </dl>
                          <div className="flex flex-wrap gap-2 md:col-span-2">
                            {item.status === "scheduled" ? (
                              <>
                                <button type="button" onClick={() => setStatus(item, "done")} className="flex h-9 items-center gap-1.5 rounded-sm bg-success px-3 text-xs font-bold text-white hover:brightness-110">
                                  <Check className="size-4" aria-hidden />
                                  {t("markDone")}
                                </button>
                                <button type="button" onClick={() => setStatus(item, "cancelled")} className="flex h-9 items-center gap-1.5 rounded-sm bg-surface-container-low px-3 text-xs font-semibold ghost-border hover:bg-surface-container">
                                  <X className="size-4" aria-hidden />
                                  {t("cancel")}
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setStatus(item, "scheduled")} className="flex h-9 items-center gap-1.5 rounded-sm bg-surface-container-low px-3 text-xs font-semibold ghost-border">
                                {t("reopen")}
                              </button>
                            )}
                            <button type="button" onClick={() => remove(item)} className="flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold text-danger hover:bg-danger/10">
                              <Trash2 className="size-4" aria-hidden />
                              {t("delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function NewItemForm({ onAdd, onCancel }: { onAdd: (item: ScheduleItem) => void; onCancel: () => void }) {
  const t = useTranslations("ops.schedule");
  const locale = useLocale() as "ar" | "en";
  const [kind, setKind] = useState<ScheduleKind>("meeting");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 rounded-lg bg-surface-container-lowest p-4 shadow-ambient ghost-border md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const v = (name: string) => String(data.get(name) ?? "").trim();
        if (!v("title") || !v("date") || !v("time") || !v("location")) return setError(t("required"));
        const contactName = v("contactName");
        onAdd({
          id: `s-${Date.now()}`,
          kind,
          title: v("title"),
          startsAt: `${v("date")}T${v("time")}`,
          durationMinutes: Math.max(5, Number(v("duration")) || 60),
          location: v("location"),
          organizerId: currentUserId,
          attendeeIds: attendees,
          clientId: v("clientId") || undefined,
          contact: contactName ? { name: contactName, phone: v("contactPhone") || undefined, role: v("contactRole") || undefined } : undefined,
          purpose: v("purpose") || undefined,
          transport: (v("transport") as Transport) || undefined,
          notes: v("notes") || undefined,
          status: "scheduled",
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-xs font-semibold">
        {t("kind")}
        <Select value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)} className="h-11 text-sm">
          {scheduleKinds.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold md:col-span-1 xl:col-span-3">
        {t("titleField")}
        <input name="title" maxLength={200} placeholder={t(`placeholders.${kind}`)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold">
        {t("date")}
        <input name="date" type="date" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold">
        {t("time")}
        <input name="time" type="time" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold">
        {t("durationField")}
        <input name="duration" type="number" min={5} step={5} defaultValue={60} dir="ltr" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold">
        {t("client")}
        <Select name="clientId" defaultValue="" className="h-11 text-sm">
          <option value="">{t("noClient")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name[locale]}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold md:col-span-2">
        {t("location")}
        <input name="location" maxLength={300} placeholder={t(kind === "trip" ? "locationTrip" : "locationOffice")} className={inputClass} />
      </label>
      {(kind === "trip" || kind === "appointment") && (
        <label className="flex flex-col gap-1.5 text-xs font-semibold">
          {t("transport")}
          <Select name="transport" defaultValue={kind === "trip" ? "companyCar" : ""} className="h-11 text-sm">
            <option value="">—</option>
            {transports.map((tr) => (
              <option key={tr} value={tr}>
                {t(`transports.${tr}`)}
              </option>
            ))}
          </Select>
        </label>
      )}
      {external.has(kind) && (
        <>
          <label className="flex flex-col gap-1.5 text-xs font-semibold">
            {kind === "interview" ? t("candidate") : t("contact")}
            <input name="contactName" maxLength={120} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold">
            {t("phone")}
            <input name="contactPhone" type="tel" dir="ltr" maxLength={30} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold">
            {kind === "interview" ? t("position") : t("contactRole")}
            <input name="contactRole" maxLength={120} className={inputClass} />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1.5 text-xs font-semibold md:col-span-2">
        {t("purpose")}
        <input name="purpose" maxLength={300} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold md:col-span-2">
        {t("notes")}
        <input name="notes" maxLength={500} placeholder={t("notesPlaceholder")} className={inputClass} />
      </label>
      <fieldset className="flex flex-col gap-1.5 text-xs font-semibold md:col-span-2 xl:col-span-4">
        <legend className="mb-1.5">{t("attendees")}</legend>
        <div className="flex flex-wrap gap-2">
          {members
            .filter((m) => m.id !== currentUserId)
            .map((m) => {
              const on = attendees.includes(m.id);
              return (
                <label key={m.id} className={cn("cursor-pointer rounded-full px-3 py-1.5 font-semibold", on ? "bg-primary-fixed text-primary" : "bg-surface-container-low text-on-surface-variant")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setAttendees((a) => (on ? a.filter((x) => x !== m.id) : [...a, m.id]))} />
                  {m.name[locale]}
                </label>
              );
            })}
        </div>
      </fieldset>
      {error && <p className="text-sm text-danger md:col-span-2 xl:col-span-4">{error}</p>}
      <div className="flex gap-2 md:col-span-2 xl:col-span-4">
        <button type="submit" className="flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-sm font-bold text-on-primary hover:brightness-110">
          <Plus className="size-4" aria-hidden />
          {t("save")}
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-sm px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low">
          {t("close")}
        </button>
      </div>
    </form>
  );
}
