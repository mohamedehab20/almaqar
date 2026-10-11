import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AutomationView } from "@/modules/automation/components/automation-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/automation">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "automation" });
  return { title: t("navTitle") };
}

export default async function AutomationPage({ params }: PageProps<"/[locale]/c/[companySlug]/automation">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AutomationView />;
}
