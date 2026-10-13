"use client";

import { Check, Copy, Mail, UserPlus, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { inviteMember, removeMember } from "@/modules/hq/actions";
import type { Department, PresenceStatus } from "@/modules/hq/mock";

type Localized = { ar: string; en: string };
export type EmployeeRow = {
  id: string;
  name: Localized;
  title: Localized;
  departmentId: string;
  status: PresenceStatus;
  role: "owner" | "admin" | "employee";
  email: string | null;
  linked: boolean;
};

type EmployeesPanelProps = {
  companyId: string;
  companyCode: string;
  meId: string;
  meRole: EmployeeRow["role"];
  employees: EmployeeRow[];
  departments: Department[];
};

/** HR → employees: company code to share, the team, and adding/removing employees (owner and admins). */
export function EmployeesPanel({ companyId, companyCode, meId, meRole, employees, departments }: EmployeesPanelProps) {
  const t = useTranslations("hr.employees");
  const tErr = useTranslations("auth.errors");
  const lang = useLocale() as "ar" | "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canManage = meRole !== "employee";
  const text = (v: Localized) => v[lang] || v.ar || v.en;
  const departmentName = (id: string) => {
    const d = departments.find((x) => x.id === id);
    return d ? text(d.name) : t("noDepartment");
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(companyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="flex flex-col gap-6 rounded-xl bg-surface-container-lowest p-5 shadow-ambient sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-extrabold">{t("title")}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-surface-container-low px-4 py-3">
          <span className="text-sm text-on-surface-variant">{t("companyCode")}</span>
          <span dir="ltr" className="font-mono text-xl font-bold tracking-widest text-primary">
            {companyCode}
          </span>
          <button
            type="button"
            onClick={copyCode}
            title={copied ? t("copied") : t("copy")}
            aria-label={copied ? t("copied") : t("copy")}
            className="grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </button>
        </div>
      </header>
      <p className="rounded-md bg-primary-fixed/40 px-4 py-3 text-sm text-primary">{t("howTo")}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead>
            <tr className="text-on-surface-variant">
              {["colName", "colTitle", "colDepartment", "colRole", "colStatus"].map((key) => (
                <th key={key} className="px-3 py-2 text-start font-semibold">
                  {t(key)}
                </th>
              ))}
              {canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {employees.map((m) => (
              <tr key={m.id} className="border-t border-outline-variant/30">
                <td className="px-3 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={text(m.name)} status={m.linked ? m.status : "offline"} />
                    <span>
                      <span className="block font-bold">
                        {text(m.name)}
                        {m.id === meId && <span className="ms-2 text-xs font-normal text-on-surface-variant">({t("you")})</span>}
                      </span>
                      {m.email && (
                        <span dir="ltr" className="block text-xs text-on-surface-variant">
                          {m.email}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3">{text(m.title) || "—"}</td>
                <td className="px-3 py-3">{departmentName(m.departmentId)}</td>
                <td className="px-3 py-3">{t(`roles.${m.role}`)}</td>
                <td className="px-3 py-3">
                  <span
                    className={
                      m.linked
                        ? "rounded-full bg-success-container px-3 py-1 text-xs font-semibold text-success"
                        : "rounded-full bg-tertiary-fixed px-3 py-1 text-xs font-semibold text-tertiary"
                    }
                  >
                    {m.linked ? t("linked") : t("pending")}
                  </span>
                </td>
                {canManage && (
                  <td className="px-3 py-3 text-end">
                    {m.role !== "owner" && m.id !== meId && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(t("removeConfirm", { name: text(m.name) }))) return;
                          startTransition(async () => {
                            const result = await removeMember({ companyId, memberId: m.id });
                            setMessage(result.ok ? null : tErr(result.error));
                            router.refresh();
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        <X className="size-3.5" aria-hidden />
                        {t("remove")}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <form
          className="grid gap-4 rounded-lg bg-surface-container-low p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const value = (name: string) => String(data.get(name) ?? "").trim();
            const name = value("name");
            const title = value("jobTitle");
            startTransition(async () => {
              const result = await inviteMember({
                companyId,
                email: value("email"),
                name: { ar: name, en: name },
                title: title ? { ar: title, en: title } : undefined,
                departmentId: value("departmentId") || null,
                role: value("role") === "admin" ? "admin" : "employee",
              });
              if (!result.ok) return setMessage(tErr(result.error));
              setMessage(result.data.emailed ? t("addedEmailed", { name }) : t("added", { name, code: companyCode }));
              form.reset();
              router.refresh();
            });
          }}
        >
          <Field label={t("name")} htmlFor="emp-name">
            <Input id="emp-name" name="name" icon={UserRound} placeholder={t("namePlaceholder")} required minLength={2} />
          </Field>
          <Field label={t("email")} htmlFor="emp-email">
            <Input id="emp-email" name="email" type="email" icon={Mail} placeholder="name@company.com" required />
          </Field>
          <Field label={t("jobTitle")} htmlFor="emp-title">
            <Input id="emp-title" name="jobTitle" placeholder={t("jobTitlePlaceholder")} />
          </Field>
          <Field label={t("department")} htmlFor="emp-dept">
            <Select id="emp-dept" name="departmentId" placeholder={t("noDepartment")}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {text(d.name)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end gap-3">
            {meRole === "owner" && (
              <Field label={t("role")} htmlFor="emp-role" className="flex-1">
                <Select id="emp-role" name="role" defaultValue="employee">
                  <option value="employee">{t("roles.employee")}</option>
                  <option value="admin">{t("roles.admin")}</option>
                </Select>
              </Field>
            )}
            <Button type="submit" disabled={pending} className="h-12 flex-1">
              <UserPlus className="size-4" aria-hidden />
              {pending ? t("adding") : t("add")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-on-surface-variant">{t("onlyAdmins")}</p>
      )}
      <FormStatus message={message} />
    </section>
  );
}
