import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HrHome } from "@/modules/hr/components/hr-home";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hr" });
  return { title: t("navTitle") };
}

/** HR home: the tools grid (employee management, leave and working hours open; the rest coming soon). */
export default async function HrPage({ params }: PageProps<"/[locale]/c/[companySlug]/hr">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HrHome />;
}
