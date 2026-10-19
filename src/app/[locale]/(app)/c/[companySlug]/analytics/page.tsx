import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AnalyticsView } from "@/modules/analytics/components/analytics-view";
import { demoAnalyticsData } from "@/modules/analytics/demo";
import { getAnalyticsData } from "@/modules/analytics/queries";
import { getSignedInCompany } from "@/modules/hq/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/analytics">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  return { title: t("title") };
}

/** Analytics room: departments compared for one month, bottlenecks with evidence. `?month=YYYY-MM`. */
export default async function AnalyticsPage({ params, searchParams }: PageProps<"/[locale]/c/[companySlug]/analytics">) {
  const { locale, companySlug } = await params;
  const { month } = await searchParams;
  setRequestLocale(locale);
  const shown = typeof month === "string" ? month : undefined;
  const current = await getSignedInCompany(companySlug);
  if (!current) return <AnalyticsView data={demoAnalyticsData(undefined, shown)} companySlug={companySlug} demo />;
  return <AnalyticsView data={await getAnalyticsData(current.company.id, shown)} companySlug={companySlug} demo={false} />;
}
