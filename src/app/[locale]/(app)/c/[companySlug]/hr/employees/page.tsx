import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSignedInCompany, listDepartments, listMembers } from "@/modules/hq/queries";
import { EmployeesPanel } from "@/modules/hr/components/employees-panel";
import { getMyPermissions, listRoles } from "@/modules/permissions/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr/employees">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hr.employees" });
  return { title: t("title") };
}

/** HR → «إدارة الموظفين»: company code, the team, add and remove employees. The public demo shows a note. */
export default async function EmployeesPage({ params }: PageProps<"/[locale]/c/[companySlug]/hr/employees">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "hr" });
  const current = await getSignedInCompany(companySlug);

  let content: React.ReactNode;
  if (!current) {
    content = (
      <>
        <header>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("employees.title")}</h2>
          <p className="mt-1 text-on-surface-variant">{t("employees.subtitle")}</p>
        </header>
        <p className="rounded-lg bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">{t("employees.demoNotice")}</p>
      </>
    );
  } else {
    const { company, me } = current;
    const [employees, departments, roles, mine] = await Promise.all([
      listMembers(company.id),
      listDepartments(company.id),
      listRoles(company.id),
      getMyPermissions(company.id),
    ]);
    content = (
      <EmployeesPanel
        companyId={company.id}
        companyName={company.name}
        companyCode={company.code}
        meId={me.id}
        meRole={me.role}
        employees={employees}
        departments={departments}
        roles={roles}
        canInvite={Boolean(mine.scopes["members.invite"])}
        canRemove={Boolean(mine.scopes["members.remove"])}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-10">
        <Link href={`/c/${companySlug}/hr`} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {t("back")}
        </Link>
        {content}
      </div>
    </div>
  );
}
