import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AutomationView } from "@/modules/automation/components/automation-view";
import { demoAutomationData } from "@/modules/automation/demo";
import { getAutomationData } from "@/modules/automation/queries";
import { getSignedInCompany } from "@/modules/hq/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/automation">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "automation" });
  return { title: t("navTitle") };
}

/** Automation room: real workflows, runs and flows for a signed-in company; the demo otherwise. */
export default async function AutomationPage({ params }: PageProps<"/[locale]/c/[companySlug]/automation">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  if (!current) return <AutomationView data={demoAutomationData()} companyId={null} />;
  return <AutomationView data={await getAutomationData(current.company.id)} companyId={current.company.id} />;
}
