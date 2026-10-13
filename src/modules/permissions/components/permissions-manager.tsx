"use client";

import { Check, HandCoins, Pencil, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, Trash2, UserRound, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import { assignRole, createRole, deleteRole, renameRole, setMemberOverrides, setRolePermissions } from "../actions";
import { AREAS, PERMISSIONS, SCOPED_KEYS, type PermissionKey } from "../catalog";
import type { getPermissionsOverview } from "../service";
import type { ProfitSettings } from "@/modules/profitability/calc";
import { ProfitabilitySettingsForm } from "@/modules/profitability/components/settings-form";

export type PermissionsOverview = Awaited<ReturnType<typeof getPermissionsOverview>>;
type Localized = { ar: string; en: string };
type Role = PermissionsOverview["roles"][number];
type MemberRow = PermissionsOverview["members"][number];
type Department = PermissionsOverview["departments"][number];
/** null = every department; a list = only those */
type Scope = string[] | null;
type Override = { key: PermissionKey; effect: "grant" | "deny"; departmentIds: Scope };

/** Owner → permissions: roles (what each role may do) and members (their role and personal exceptions). */
export function PermissionsManager({ overview, demo, profitSettings }: { overview: PermissionsOverview; demo: boolean; profitSettings: ProfitSettings }) {
  const t = useTranslations("permissions");
  const tErr = useTranslations("auth.errors");
  const lang = useLocale() as "ar" | "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"roles" | "members" | "marketing">("roles");

  // Local copy: the demo edits only this; real changes are saved, then the page refreshes from the server
  const [data, setData] = useState(overview);
  const [source, setSource] = useState(overview);
  if (overview !== source) {
    setSource(overview);
    setData(overview);
  }
  const [roleId, setRoleId] = useState(overview.roles[0]?.id ?? "");
  const role = data.roles.find((r) => r.id === roleId) ?? data.roles[0];

  const text = (v: Localized) => v[lang] || v.ar || v.en;

  /** Runs a save: in the demo only the local copy changes. */
  const save = (call: () => Promise<ActionResult<unknown>>, local: () => void, done: string) => {
    if (demo) {
      local();
      setMessage(t("demoSaved"));
      return;
    }
    startTransition(async () => {
      const result = await call();
      if (!result.ok) return setMessage(result.error === "forbidden" ? t("errors.forbidden") : tErr(result.error));
      local();
      setMessage(done);
      router.refresh();
    });
  };

  const updateRole = (id: string, patch: Partial<Role>) =>
    setData((d) => ({ ...d, roles: d.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const updateMember = (id: string, patch: Partial<MemberRow>) =>
    setData((d) => ({ ...d, members: d.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-10">
        <header className="flex flex-col gap-2">
          <h2 className="flex items-center gap-3 text-3xl font-black sm:text-4xl">
            <ShieldCheck className="size-8 text-primary" aria-hidden />
            {t("title")}
          </h2>
          <p className="text-lg text-on-surface-variant">{t("subtitle")}</p>
          {demo && <p className="rounded-lg bg-surface-container-low px-5 py-3 text-sm text-on-surface-variant">{t("demoNotice")}</p>}
        </header>

        <div role="tablist" className="flex w-fit gap-1 rounded-full bg-surface-container-low p-1">
          {(["roles", "members", "marketing"] as const).map((key) => (
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
              {key === "roles" ? <ShieldCheck className="size-4" aria-hidden /> : key === "members" ? <Users className="size-4" aria-hidden /> : <HandCoins className="size-4" aria-hidden />}
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>

        <FormStatus message={message} />

        {tab === "marketing" ? (
          <ProfitabilitySettingsForm companyId={data.companyId} settings={profitSettings} demo={demo} />
        ) : tab === "roles" ? (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2">
                {data.roles.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setRoleId(r.id)}
                      aria-current={r.id === role?.id}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-start transition-colors",
                        r.id === role?.id ? "bg-primary-fixed text-primary" : "bg-surface-container-low hover:bg-surface-container",
                      )}
                    >
                      <span>
                        <span className="block font-bold">{text(r.name)}</span>
                        <span className="block text-xs text-on-surface-variant">
                          {r.systemKey ? t("systemRole") : t("customRole")} · {t("memberCount", { count: r.memberCount })}
                        </span>
                      </span>
                      <span className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs font-semibold">{r.permissions.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <NewRoleForm
                roles={data.roles}
                text={text}
                pending={pending}
                onCreate={(name, copyFrom) => {
                  const localId = `local-${data.roles.length}`;
                  const copied = data.roles.find((r) => r.id === copyFrom)?.permissions ?? [];
                  const add = (id: string) =>
                    setData((d) => ({ ...d, roles: [...d.roles, { id, name, systemKey: null, memberCount: 0, permissions: copied }] }));
                  if (demo) {
                    add(localId);
                    setRoleId(localId);
                    return setMessage(t("demoSaved"));
                  }
                  startTransition(async () => {
                    const result = await createRole({ companyId: data.companyId, name, copyFromRoleId: copyFrom || null });
                    if (!result.ok) return setMessage(result.error === "forbidden" ? t("errors.forbidden") : tErr(result.error));
                    add(result.data.id);
                    setRoleId(result.data.id);
                    setMessage(t("roleCreated", { name: text(name) }));
                    router.refresh();
                  });
                }}
              />
            </aside>

            {role && (
              <RoleEditor
                key={role.id + JSON.stringify(role.permissions)}
                role={role}
                departments={data.departments}
                text={text}
                pending={pending}
                onRename={(name) => save(() => renameRole({ roleId: role.id, name }), () => updateRole(role.id, { name }), t("saved"))}
                onDelete={() => {
                  if (!window.confirm(t("deleteConfirm", { name: text(role.name) }))) return;
                  const fallback = data.roles.find((r) => r.systemKey === "employee")?.id ?? null;
                  save(
                    () => deleteRole({ roleId: role.id }),
                    () => {
                      setData((d) => ({
                        ...d,
                        roles: d.roles.filter((r) => r.id !== role.id),
                        members: d.members.map((m) => (m.roleId === role.id ? { ...m, roleId: fallback } : m)),
                      }));
                      setRoleId(data.roles[0]?.id ?? "");
                    },
                    t("roleDeleted"),
                  );
                }}
                onSave={(permissions) =>
                  save(() => setRolePermissions({ roleId: role.id, permissions }), () => updateRole(role.id, { permissions }), t("saved"))
                }
              />
            )}
          </div>
        ) : (
          <MembersTab
            data={data}
            text={text}
            pending={pending}
            onAssign={(member, newRoleId) =>
              save(() => assignRole({ memberId: member.id, roleId: newRoleId }), () => updateMember(member.id, { roleId: newRoleId }), t("saved"))
            }
            onOverrides={(member, overrides) =>
              save(() => setMemberOverrides({ memberId: member.id, overrides }), () => updateMember(member.id, { overrides }), t("saved"))
            }
          />
        )}
      </div>
    </div>
  );
}

// ---------- Roles ----------

function NewRoleForm({
  roles,
  text,
  pending,
  onCreate,
}: {
  roles: Role[];
  text: (v: Localized) => string;
  pending: boolean;
  onCreate: (name: Localized, copyFrom: string) => void;
}) {
  const t = useTranslations("permissions");
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const name = String(data.get("name") ?? "").trim();
        if (!name) return;
        onCreate({ ar: name, en: name }, String(data.get("copyFrom") ?? ""));
        form.reset();
      }}
    >
      <Field label={t("newRole")} htmlFor="role-name">
        <Input id="role-name" name="name" placeholder={t("newRolePlaceholder")} required minLength={2} maxLength={60} />
      </Field>
      <Field label={t("copyFrom")} htmlFor="role-copy">
        <Select id="role-copy" name="copyFrom" defaultValue="">
          <option value="">{t("startEmpty")}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {text(r.name)}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        <Plus className="size-4" aria-hidden />
        {t("createRole")}
      </Button>
    </form>
  );
}

type Grant = { key: PermissionKey; departmentIds: Scope };

function RoleEditor({
  role,
  departments,
  text,
  pending,
  onRename,
  onDelete,
  onSave,
}: {
  role: Role;
  departments: Department[];
  text: (v: Localized) => string;
  pending: boolean;
  onRename: (name: Localized) => void;
  onDelete: () => void;
  onSave: (permissions: Grant[]) => void;
}) {
  const t = useTranslations("permissions");
  const [draft, setDraft] = useState<Map<PermissionKey, Scope>>(() => new Map(role.permissions.map((p) => [p.key, p.departmentIds])));
  const [renaming, setRenaming] = useState(false);
  const toggle = (key: PermissionKey, on: boolean) =>
    setDraft((d) => {
      const next = new Map(d);
      if (on) next.set(key, null);
      else next.delete(key);
      return next;
    });
  const setScope = (key: PermissionKey, scope: Scope) => setDraft((d) => new Map(d).set(key, scope));
  // A scoped permission with no department picked grants nothing, so it is not saved
  const grants = [...draft].filter(([, scope]) => scope === null || scope.length > 0).map(([key, departmentIds]) => ({ key, departmentIds }));
  const incomplete = [...draft].some(([, scope]) => scope !== null && scope.length === 0);

  return (
    <section className="flex flex-col gap-5 rounded-xl bg-surface-container-lowest p-5 shadow-ambient">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {renaming ? (
          <form
            className="flex flex-1 items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
              if (name) onRename({ ar: name, en: name });
              setRenaming(false);
            }}
          >
            <Input name="name" defaultValue={text(role.name)} aria-label={t("roleName")} required minLength={2} maxLength={60} autoFocus />
            <Button type="submit" size="lg" disabled={pending}>
              <Check className="size-4" aria-hidden />
              {t("save")}
            </Button>
          </form>
        ) : (
          <h3 className="flex items-center gap-2 text-2xl font-black">
            {text(role.name)}
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label={t("rename")}
              title={t("rename")}
              className="grid size-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
          </h3>
        )}
        {!role.systemKey && (
          <Button variant="tertiary" size="sm" onClick={onDelete} disabled={pending} className="text-danger hover:bg-danger/10">
            <Trash2 className="size-4" aria-hidden />
            {t("deleteRole")}
          </Button>
        )}
      </header>
      {role.systemKey && <p className="text-sm text-on-surface-variant">{t(`systemHint.${role.systemKey}`)}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {AREAS.map(({ area, label }) => {
          const items = PERMISSIONS.filter((p) => p.area === area);
          const allOn = items.every((p) => draft.has(p.key));
          return (
            <fieldset key={area} className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4">
              <legend className="contents">
                <span className="flex items-center justify-between">
                  <span className="font-bold">{text(label)}</span>
                  <button
                    type="button"
                    onClick={() => items.forEach((p) => toggle(p.key, !allOn))}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {allOn ? t("clearAll") : t("selectAll")}
                  </button>
                </span>
              </legend>
              {items.map((p) => {
                const on = draft.has(p.key);
                return (
                  <div key={p.key} className="flex flex-col gap-2 rounded-md bg-surface-container-lowest px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                      <input type="checkbox" checked={on} onChange={(e) => toggle(p.key, e.target.checked)} className="size-4 accent-primary" />
                      <span className="flex-1">{text(p.label)}</span>
                      {SCOPED_KEYS.has(p.key) && <span className="text-[10px] font-semibold text-tertiary">{t("scopedBadge")}</span>}
                    </label>
                    {on && SCOPED_KEYS.has(p.key) && (
                      <ScopePicker value={draft.get(p.key) ?? null} departments={departments} text={text} onChange={(s) => setScope(p.key, s)} />
                    )}
                  </div>
                );
              })}
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onSave(grants)} disabled={pending} size="lg">
          <Check className="size-4" aria-hidden />
          {t("savePermissions")}
        </Button>
        <span className="text-sm text-on-surface-variant">{t("selectedCount", { count: grants.length, total: PERMISSIONS.length })}</span>
        {incomplete && <span className="text-sm text-danger">{t("pickDepartment")}</span>}
      </div>
    </section>
  );
}

/** "Every department" or a chosen list (only for permissions that support it). */
function ScopePicker({
  value,
  departments,
  text,
  onChange,
}: {
  value: Scope;
  departments: Department[];
  text: (v: Localized) => string;
  onChange: (scope: Scope) => void;
}) {
  const t = useTranslations("permissions");
  return (
    <div className="flex flex-wrap items-center gap-2 ps-7 text-xs">
      <select
        value={value === null ? "all" : "some"}
        onChange={(e) => onChange(e.target.value === "all" ? null : [])}
        aria-label={t("scope")}
        className="h-8 rounded-sm border border-outline-variant/50 bg-surface-container-lowest px-2"
      >
        <option value="all">{t("scopeAll")}</option>
        <option value="some" disabled={departments.length === 0}>
          {t("scopeSome")}
        </option>
      </select>
      {value !== null &&
        departments.map((d) => {
          const checked = value.includes(d.id);
          return (
            <label
              key={d.id}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 font-semibold",
                checked ? "bg-primary-fixed text-primary" : "bg-surface-container text-on-surface-variant",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => onChange(checked ? value.filter((id) => id !== d.id) : [...value, d.id])}
              />
              {text(d.name)}
            </label>
          );
        })}
    </div>
  );
}

// ---------- Members ----------

function MembersTab({
  data,
  text,
  pending,
  onAssign,
  onOverrides,
}: {
  data: PermissionsOverview;
  text: (v: Localized) => string;
  pending: boolean;
  onAssign: (member: MemberRow, roleId: string | null) => void;
  onOverrides: (member: MemberRow, overrides: Override[]) => void;
}) {
  const t = useTranslations("permissions");
  const [open, setOpen] = useState<string | null>(null);
  const departmentName = (id: string | null) => text(data.departments.find((d) => d.id === id)?.name ?? { ar: "—", en: "—" });

  return (
    <ul className="flex flex-col gap-3">
      {data.members.map((m) => {
        const role = data.roles.find((r) => r.id === m.roleId);
        const effective = effectiveKeys(m, role);
        return (
          <li key={m.id} className="rounded-xl bg-surface-container-lowest p-4 shadow-ambient">
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid size-10 place-items-center rounded-full bg-primary-fixed text-primary">
                <UserRound className="size-5" aria-hidden />
              </span>
              <span className="min-w-40 flex-1">
                <span className="block font-bold">{text(m.name)}</span>
                <span className="block text-xs text-on-surface-variant">
                  {departmentName(m.departmentId)}
                  {m.email && (
                    <>
                      {" · "}
                      <bdi dir="ltr">{m.email}</bdi>
                    </>
                  )}
                </span>
              </span>
              {m.isOwner ? (
                <span className="rounded-full bg-secondary-container px-3 py-1 text-sm font-semibold text-on-secondary-container">{t("ownerAll")}</span>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-on-surface-variant">{t("role")}</span>
                    <select
                      value={m.roleId ?? ""}
                      disabled={pending}
                      onChange={(e) => onAssign(m, e.target.value || null)}
                      className="h-10 rounded-sm border border-outline-variant/50 bg-surface-container-lowest px-3"
                    >
                      <option value="">{t("noRole")}</option>
                      {data.roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {text(r.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-sm text-on-surface-variant">{t("effectiveCount", { count: effective.size, total: PERMISSIONS.length })}</span>
                  <Button variant="secondary" size="sm" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
                    <SlidersHorizontal className="size-4" aria-hidden />
                    {t("exceptions")}
                    {m.overrides.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-on-primary">{m.overrides.length}</span>}
                  </Button>
                </>
              )}
            </div>
            {open === m.id && !m.isOwner && (
              <OverridesEditor
                key={JSON.stringify(m.overrides) + m.roleId}
                member={m}
                role={role}
                departments={data.departments}
                text={text}
                pending={pending}
                onSave={(overrides) => onOverrides(m, overrides)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** What the member ends up with (department scopes aside): role, plus grants, minus full denies. */
function effectiveKeys(member: MemberRow, role: Role | undefined) {
  const keys = new Set<PermissionKey>(role?.permissions.map((p) => p.key) ?? []);
  for (const o of member.overrides) {
    if (o.effect === "grant") keys.add(o.key);
    else if (!o.departmentIds) keys.delete(o.key);
  }
  return keys;
}

function OverridesEditor({
  member,
  role,
  departments,
  text,
  pending,
  onSave,
}: {
  member: MemberRow;
  role: Role | undefined;
  departments: Department[];
  text: (v: Localized) => string;
  pending: boolean;
  onSave: (overrides: Override[]) => void;
}) {
  const t = useTranslations("permissions");
  const [draft, setDraft] = useState<Map<PermissionKey, Override>>(() => new Map(member.overrides.map((o) => [o.key, o])));
  const fromRole = new Set(role?.permissions.map((p) => p.key) ?? []);
  const set = (key: PermissionKey, effect: "role" | "grant" | "deny") =>
    setDraft((d) => {
      const next = new Map(d);
      if (effect === "role") next.delete(key);
      else next.set(key, { key, effect, departmentIds: d.get(key)?.departmentIds ?? null });
      return next;
    });
  const list = [...draft.values()].filter((o) => o.departmentIds === null || o.departmentIds.length > 0);
  const preview = effectiveKeys({ ...member, overrides: list }, role);

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-outline-variant/30 pt-4">
      <p className="text-sm text-on-surface-variant">{t("exceptionsHint")}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {AREAS.map(({ area, label }) => (
          <fieldset key={area} className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4">
            <legend className="contents">
              <span className="font-bold">{text(label)}</span>
            </legend>
            {PERMISSIONS.filter((p) => p.area === area).map((p) => {
              const o = draft.get(p.key);
              const state = o?.effect ?? "role";
              return (
                <div key={p.key} className="flex flex-col gap-2 rounded-md bg-surface-container-lowest px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-36 flex-1">
                      {text(p.label)}
                      <span className={cn("ms-2 text-xs", preview.has(p.key) ? "text-success" : "text-on-surface-variant")}>
                        {preview.has(p.key) ? "✓" : "—"}
                      </span>
                    </span>
                    <div role="radiogroup" aria-label={text(p.label)} className="flex gap-1 rounded-full bg-surface-container p-0.5 text-xs">
                      {(["role", "grant", "deny"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={state === s}
                          onClick={() => set(p.key, s)}
                          className={cn(
                            "rounded-full px-3 py-1 font-semibold transition-colors",
                            state === s
                              ? s === "grant"
                                ? "bg-success text-white"
                                : s === "deny"
                                  ? "bg-danger text-white"
                                  : "bg-surface-container-lowest text-on-surface shadow-ambient"
                              : "text-on-surface-variant hover:text-on-surface",
                          )}
                        >
                          {s === "role" ? t(fromRole.has(p.key) ? "byRoleOn" : "byRoleOff") : t(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {o && SCOPED_KEYS.has(p.key) && (
                    <ScopePicker
                      value={o.departmentIds}
                      departments={departments}
                      text={text}
                      onChange={(scope) => setDraft((d) => new Map(d).set(p.key, { ...o, departmentIds: scope }))}
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onSave(list)} disabled={pending}>
          <Check className="size-4" aria-hidden />
          {t("saveExceptions")}
        </Button>
        {draft.size > 0 && (
          <Button variant="tertiary" onClick={() => setDraft(new Map())} disabled={pending}>
            <RotateCcw className="size-4" aria-hidden />
            {t("resetToRole")}
          </Button>
        )}
      </div>
    </div>
  );
}
