import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSignedInCompany } from "@/modules/hq/queries";
import { OperationsView } from "@/modules/operations/components/operations-view";
import { demoOperationsData } from "@/modules/operations/demo";
import { getOperationsData } from "@/modules/operations/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/operations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ops" });
  return { title: t("navTitle") };
}

/** Operations room: real operations, figures, notes and tasks for a signed-in company; the demo otherwise. */
export default async function OperationsPage({ params }: PageProps<"/[locale]/c/[companySlug]/operations">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  if (!current) return <OperationsView data={demoOperationsData()} companyId={null} />;
  return <OperationsView data={await getOperationsData(current.company.id)} companyId={current.company.id} />;
}
