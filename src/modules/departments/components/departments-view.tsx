"use client";

import {
  Archive,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Check,
  Contact,
  DoorOpen,
  ExternalLink,
  LayoutGrid,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import type { DepartmentColor } from "@/modules/hq/mock";
import { createDepartment, deleteDepartment, updateDepartment } from "@/modules/hq/actions";
import { setRoom } from "../actions";
import type { RoomKey } from "../rooms";
import type { DepartmentsData } from "../service";

type Room = DepartmentsData["rooms"][number];
type Dept = DepartmentsData["departments"][number];

const roomIcon: Record<RoomKey, LucideIcon> = {
  hr: Contact,
  operations: Workflow,
  automation: Zap,
  marketing: Megaphone,
  meetings: DoorOpen,
  accounts: Banknote,
  sales: TrendingUp,
  agents: BriefcaseBusiness,
  archive: Archive,
};
/** Room → its page under /c/<slug> */
const roomPath: Partial<Record<RoomKey, string>> = { hr: "hr", operations: "operations", automation: "automation", marketing: "marketing", meetings: "meetings" };
const COLORS: DepartmentColor[] = ["blue", "violet", "amber", "emerald"];
const colorDot: Record<DepartmentColor, string> = { blue: "bg-[#2563eb]", violet: "bg-[#7c3aed]", amber: "bg-[#d97706]", emerald: "bg-[#059669]" };

/** On / off switch */
function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-success" : "bg-outline-variant")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "start-[22px]" : "start-0.5")} />
    </button>
  );
}

/**
 * HR → «إدارة الأقسام»: the HQ's rooms (on / off for the company, coming soon, manager) and the company's
 * departments (add, rename, colour, stop / restart, manager, delete). `companyId` null = the public demo.
 */
export function DepartmentsView({ data, companyId, companySlug }: { data: DepartmentsData; companyId: string | null; companySlug: string }) {
  const t = useTranslations("departments");
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
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const memberName = (id: string | null) => (id ? (state.members.find((m) => m.id === id)?.name[locale] ?? "—") : null);

  function run(local: () => void, remote: () => Promise<ActionResult<unknown>>, success: string) {
    if (demo) {
      local();
      return setNotice(success);
    }
    startTransition(async () => {
      const result = await remote();
      if (!result.ok) return setNotice(tErr(result.error));
      setNotice(success);
      router.refresh();
    });
  }

  const updateRoom = (room: Room, change: { enabled?: boolean; managerId?: string | null }) =>
    run(
      () => setState((s) => ({ ...s, rooms: s.rooms.map((r) => (r.key === room.key ? { ...r, ...change } : r)) })),
      () => setRoom({ companyId: companyId!, room: room.key, ...change }),
      change.enabled === undefined ? t("notices.saved") : t(change.enabled ? "notices.roomOn" : "notices.roomOff", { name: tNav(room.key) }),
    );

  const updateDept = (dept: Dept, change: { name?: { ar: string; en: string }; color?: DepartmentColor; active?: boolean; managerId?: string | null }) =>
    run(
      () => setState((s) => ({ ...s, departments: s.departments.map((d) => (d.id === dept.id ? { ...d, ...change } : d)) })),
      () => updateDepartment({ companyId: companyId!, departmentId: dept.id, ...change }),
      change.active === undefined ? t("notices.saved") : t(change.active ? "notices.deptOn" : "notices.deptOff", { name: (change.name ?? dept.name)[locale] }),
    );

  const addDept = (name: string, color: DepartmentColor, managerId: string | null) =>
    run(
      () =>
        setState((s) => ({
          ...s,
          departments: [...s.departments, { id: `demo-${Date.now()}`, name: { ar: name, en: name }, color, active: true, managerId, memberCount: 0 }],
        })),
      () => createDepartment({ companyId: companyId!, name: { ar: name, en: name }, color, managerId }),
      t("notices.added", { name }),
    );

  const removeDept = (dept: Dept) => {
    if (!window.confirm(t(dept.memberCount ? "departments.deleteConfirmMembers" : "departments.deleteConfirm", { name: dept.name[locale], count: dept.memberCount }))) return;
    run(
      () => setState((s) => ({ ...s, departments: s.departments.filter((d) => d.id !== dept.id) })),
      () => deleteDepartment({ companyId: companyId!, departmentId: dept.id }),
      t("notices.deleted", { name: dept.name[locale] }),
    );
  };

  const managerSelect = (value: string | null, disabled: boolean, label: string, onChange: (id: string | null) => void) => (
    <Select value={value ?? ""} disabled={disabled || pending} onChange={(e) => onChange(e.target.value || null)} aria-label={label} className="h-10 bg-surface-container-low text-sm">
      <option value="">{t("noManager")}</option>
      {state.members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name[locale]}
          {m.title[locale] ? ` — ${m.title[locale]}` : ""}
        </option>
      ))}
    </Select>
  );

  const on = state.rooms.filter((r) => r.enabled).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 sm:p-10">
        <header>
          <Link href={`/c/${companySlug}/hr`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
            {t("back")}
          </Link>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
          <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
        </header>

        {demo && <p className="rounded-lg bg-surface-container-low px-5 py-3 text-sm text-on-surface-variant">{t("demoNotice")}</p>}

        {/* ---------- Rooms of the HQ ---------- */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold">
                <LayoutGrid className="size-5 text-primary" aria-hidden />
                {t("rooms.title")}
              </h3>
              <p className="text-sm text-on-surface-variant">{t("rooms.subtitle")}</p>
            </div>
            <span className="rounded-full bg-surface-container-low px-3 py-1 text-sm font-semibold">{t("rooms.count", { on, total: state.rooms.length })}</span>
          </div>
          {!state.canRooms && <p className="text-sm text-on-surface-variant">{t("rooms.readOnly")}</p>}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.rooms.map((room) => {
              const Icon = roomIcon[room.key];
              const path = roomPath[room.key];
              return (
                <li key={room.key} className={cn("flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient", room.soon && "opacity-75")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={cn("grid size-11 place-items-center rounded-lg", room.enabled ? "bg-primary-fixed text-primary" : "bg-surface-container text-muted")}>
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <p className="font-bold">{tNav(room.key)}</p>
                        <span
                          className={cn(
                            "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold",
                            room.soon ? "bg-secondary-container text-on-secondary-container" : room.enabled ? "bg-success-container text-success" : "bg-surface-container text-muted",
                          )}
                        >
                          {t(room.soon ? "rooms.soon" : room.enabled ? "rooms.on" : "rooms.off")}
                        </span>
                      </div>
                    </div>
                    <Switch
                      on={room.enabled}
                      disabled={room.soon || room.locked || !state.canRooms || pending}
                      label={t("rooms.toggle", { name: tNav(room.key) })}
                      onChange={(enabled) => updateRoom(room, { enabled })}
                    />
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                    {t("manager")}
                    {managerSelect(room.managerId, !state.canRooms, t("managerOf", { name: tNav(room.key) }), (managerId) => updateRoom(room, { managerId }))}
                  </label>
                  <p className="text-xs text-on-surface-variant">
                    {room.locked ? t("rooms.lockedHint") : room.soon ? t("rooms.soonHint") : room.enabled ? t("rooms.onHint") : t("rooms.offHint")}
                  </p>
                  {path && room.enabled && (
                    <Link href={`/c/${companySlug}/${path}`} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline">
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t("rooms.open")}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---------- Company departments ---------- */}
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold">
              <Building2 className="size-5 text-primary" aria-hidden />
              {t("departments.title")}
            </h3>
            <p className="text-sm text-on-surface-variant">{t("departments.subtitle")}</p>
          </div>
          {state.canDepartments ? <AddDepartment pending={pending} managerSelect={managerSelect} onAdd={addDept} /> : <p className="text-sm text-on-surface-variant">{t("departments.readOnly")}</p>}
          {state.departments.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">{t("departments.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {state.departments.map((dept) => (
                <DepartmentRow
                  key={dept.id}
                  dept={dept}
                  canEdit={state.canDepartments}
                  pending={pending}
                  managerName={memberName(dept.managerId)}
                  managerSelect={managerSelect}
                  onChange={(change) => updateDept(dept, change)}
                  onDelete={() => removeDept(dept)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

type ManagerSelect = (value: string | null, disabled: boolean, label: string, onChange: (id: string | null) => void) => React.ReactNode;

function ColorPicker({ value, onChange, disabled }: { value: DepartmentColor; onChange: (c: DepartmentColor) => void; disabled?: boolean }) {
  const t = useTranslations("departments");
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={t("departments.color")}>
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t(`colors.${c}`)}
          disabled={disabled}
          onClick={() => onChange(c)}
          className={cn("size-7 rounded-full ring-offset-2 transition", colorDot[c], value === c ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100")}
        />
      ))}
    </div>
  );
}

function AddDepartment({ pending, managerSelect, onAdd }: { pending: boolean; managerSelect: ManagerSelect; onAdd: (name: string, color: DepartmentColor, managerId: string | null) => void }) {
  const t = useTranslations("departments");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<DepartmentColor>("blue");
  const [managerId, setManagerId] = useState<string | null>(null);
  if (!open)
    return (
      <div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t("departments.add")}
        </Button>
      </div>
    );
  return (
    <form
      className="grid gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-ambient sm:grid-cols-[2fr_auto_2fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim(), color, managerId);
        setName("");
        setManagerId(null);
        setOpen(false);
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("departments.name")}
        <input autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("departments.namePlaceholder")} className="h-10 rounded-md bg-surface-container-low px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40" />
      </label>
      <div className="flex flex-col gap-2 text-sm font-semibold">
        {t("departments.color")}
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {t("manager")}
        {managerSelect(managerId, false, t("manager"), setManagerId)}
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          <Check className="size-4" aria-hidden />
          {t("departments.save")}
        </Button>
        <Button variant="tertiary" onClick={() => setOpen(false)}>
          {t("departments.cancel")}
        </Button>
      </div>
    </form>
  );
}

function DepartmentRow({
  dept,
  canEdit,
  pending,
  managerName,
  managerSelect,
  onChange,
  onDelete,
}: {
  dept: Dept;
  canEdit: boolean;
  pending: boolean;
  managerName: string | null;
  managerSelect: ManagerSelect;
  onChange: (change: { name?: { ar: string; en: string }; color?: DepartmentColor; active?: boolean; managerId?: string | null }) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("departments");
  const locale = useLocale() as "ar" | "en";
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(dept.name[locale]);

  return (
    <li className={cn("grid items-center gap-4 rounded-xl bg-surface-container-lowest p-4 shadow-ambient md:grid-cols-[2fr_2fr_auto]", !dept.active && "opacity-70")}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("size-3.5 shrink-0 rounded-full", colorDot[dept.color])} aria-hidden />
        {renaming ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onChange({ name: { ...dept.name, [locale]: name.trim() } });
              setRenaming(false);
            }}
          >
            <input autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("departments.name")} className="h-9 min-w-0 flex-1 rounded-md bg-surface-container-low px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            <Button type="submit" variant="icon" size="icon" aria-label={t("departments.save")} className="size-8">
              <Check className="size-4" aria-hidden />
            </Button>
            <Button variant="icon" size="icon" aria-label={t("departments.cancel")} onClick={() => setRenaming(false)} className="size-8">
              <X className="size-4" aria-hidden />
            </Button>
          </form>
        ) : (
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-bold">
              <span className="truncate">{dept.name[locale]}</span>
              {canEdit && (
                <button type="button" onClick={() => setRenaming(true)} aria-label={t("departments.rename")} className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-low">
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              )}
              {!dept.active && <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-muted">{t("departments.stopped")}</span>}
            </p>
            <p className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Users className="size-3.5" aria-hidden />
              {t("departments.members", { count: dept.memberCount })}
              {managerName && <> · {t("departments.managedBy", { name: managerName })}</>}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">{managerSelect(dept.managerId, !canEdit, t("managerOf", { name: dept.name[locale] }), (managerId) => onChange({ managerId }))}</div>
        {canEdit && <ColorPicker value={dept.color} disabled={pending} onChange={(color) => onChange({ color })} />}
      </div>
      <div className="flex items-center gap-3 justify-self-end">
        <span className="text-xs font-semibold text-on-surface-variant">{t(dept.active ? "departments.active" : "departments.stopped")}</span>
        <Switch on={dept.active} disabled={!canEdit || pending} label={t("departments.toggle", { name: dept.name[locale] })} onChange={(active) => onChange({ active })} />
        {canEdit && (
          <Button variant="icon" size="icon" disabled={pending} onClick={onDelete} aria-label={t("departments.delete")} title={t("departments.delete")} className="text-danger">
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );
}
