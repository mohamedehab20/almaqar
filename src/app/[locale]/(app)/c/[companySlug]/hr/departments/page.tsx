import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DepartmentsView } from "@/modules/departments/components/departments-view";
import { demoDepartmentsData } from "@/modules/departments/demo";
import { getDepartmentsData } from "@/modules/departments/queries";
import { getSignedInCompany } from "@/modules/hq/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr/departments">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "departments" });
  return { title: t("title") };
}

/** HR → «إدارة الأقسام»: the HQ's rooms (on / off, manager) and the company's departments. The public demo gets sample data. */
export default async function DepartmentsPage({ params }: PageProps<"/[locale]/c/[companySlug]/hr/departments">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  if (!current) return <DepartmentsView data={demoDepartmentsData()} companyId={null} companySlug={companySlug} />;
  return <DepartmentsView data={await getDepartmentsData(current.company.id)} companyId={current.company.id} companySlug={companySlug} />;
}
