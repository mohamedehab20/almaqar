import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { departments, members } from "@/modules/hq/mock";
import { getSignedInCompany } from "@/modules/hq/queries";
import { EMPLOYEE_DEFAULTS, PERMISSION_KEYS } from "@/modules/permissions/catalog";
import { PermissionsManager, type PermissionsOverview } from "@/modules/permissions/components/permissions-manager";
import { NoAccess } from "@/modules/permissions/components/room-guard";
import { getPermissionsOverview } from "@/modules/permissions/queries";
import { DEMO_SETTINGS } from "@/modules/profitability/demo";
import { getProfitabilitySettings } from "@/modules/profitability/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/permissions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "permissions" });
  return { title: t("title") };
}

/** The public demo: the same screen on sample data; changes stay in the browser. */
function demoOverview(): PermissionsOverview {
  const all = (keys: readonly string[]) => keys.map((key) => ({ key, departmentIds: null })) as PermissionsOverview["roles"][number]["permissions"];
  return {
    companyId: "demo",
    roles: [
      { id: "r-admin", name: { ar: "مدير", en: "Admin" }, systemKey: "admin", memberCount: 1, permissions: all(PERMISSION_KEYS) },
      { id: "r-employee", name: { ar: "موظف", en: "Employee" }, systemKey: "employee", memberCount: members.length - 2, permissions: all(EMPLOYEE_DEFAULTS) },
    ],
    members: members.map((m, i) => ({
      id: m.id,
      name: m.name,
      title: m.title,
      email: null,
      departmentId: m.departmentId,
      isOwner: i === 0,
      roleId: i === 0 ? null : i === 1 ? "r-admin" : "r-employee",
      linked: true,
      overrides: [],
    })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
  };
}

export default async function PermissionsPage({ params }: PageProps<"/[locale]/c/[companySlug]/permissions">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);

  const current = await getSignedInCompany(companySlug);
  if (!current) return <PermissionsManager overview={demoOverview()} demo profitSettings={DEMO_SETTINGS} />;
  // Managing permissions is the owner's alone
  if (current.me.role !== "owner") return <NoAccess companySlug={companySlug} />;
  const [overview, profitSettings] = await Promise.all([getPermissionsOverview(current.company.id), getProfitabilitySettings(current.company.id)]);
  return <PermissionsManager overview={overview} demo={false} profitSettings={profitSettings} />;
}
