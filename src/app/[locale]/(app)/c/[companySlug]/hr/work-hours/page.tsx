import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSignedInCompany } from "@/modules/hq/queries";
import { HoursView } from "@/modules/hours/components/hours-view";
import { demoWorkHoursData } from "@/modules/hours/demo";
import { getWorkHoursData } from "@/modules/hours/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr/work-hours">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hours" });
  return { title: t("title") };
}

/** HR → Working hours: clock in / out, the month day by day, the team's hours and the working day. `?month=YYYY-MM`. */
export default async function WorkHoursPage({ params, searchParams }: PageProps<"/[locale]/c/[companySlug]/hr/work-hours">) {
  const { locale, companySlug } = await params;
  const { month } = await searchParams;
  setRequestLocale(locale);
  const hrHref = `/c/${companySlug}/hr`;
  const shown = typeof month === "string" ? month : undefined;
  const current = await getSignedInCompany(companySlug);
  if (!current) return <HoursView data={demoWorkHoursData(undefined, locale === "en" ? "en" : "ar", shown)} companyId={null} hrHref={hrHref} />;
  return <HoursView data={await getWorkHoursData(current.company.id, shown)} companyId={current.company.id} hrHref={hrHref} />;
}
