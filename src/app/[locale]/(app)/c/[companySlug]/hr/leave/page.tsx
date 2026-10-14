import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSignedInCompany } from "@/modules/hq/queries";
import { LeaveView } from "@/modules/leave/components/leave-view";
import { demoLeaveData } from "@/modules/leave/demo";
import { getLeaveData } from "@/modules/leave/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr/leave">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leave" });
  return { title: t("title") };
}

/** HR → Leave: requests, balances, approvals and the company policy. The public demo gets sample data. */
export default async function LeavePage({ params }: PageProps<"/[locale]/c/[companySlug]/hr/leave">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const hrHref = `/c/${companySlug}/hr`;
  const current = await getSignedInCompany(companySlug);
  if (!current) return <LeaveView data={demoLeaveData(undefined, locale === "en" ? "en" : "ar")} companyId={null} hrHref={hrHref} />;
  return <LeaveView data={await getLeaveData(current.company.id)} companyId={current.company.id} hrHref={hrHref} />;
}
