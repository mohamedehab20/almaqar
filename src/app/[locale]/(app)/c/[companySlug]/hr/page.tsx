import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSignedInCompany, listDepartments, listMembers } from "@/modules/hq/queries";
import { EmployeesPanel } from "@/modules/hr/components/employees-panel";
import { HrHome } from "@/modules/hr/components/hr-home";
import { getMyPermissions, listRoles } from "@/modules/permissions/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hr" });
  return { title: t("navTitle") };
}

export default async function HrPage({ params }: PageProps<"/[locale]/c/[companySlug]/hr">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);

  const current = await getSignedInCompany(companySlug);
  if (!current) {
    const t = await getTranslations({ locale, namespace: "hr.employees" });
    return (
      <HrHome>
        <p className="rounded-lg bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">{t("demoNotice")}</p>
      </HrHome>
    );
  }

  const { company, me } = current;
  const [employees, departments, roles, mine] = await Promise.all([
    listMembers(company.id),
    listDepartments(company.id),
    listRoles(company.id),
    getMyPermissions(company.id),
  ]);
  return (
    <HrHome>
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
    </HrHome>
  );
}
