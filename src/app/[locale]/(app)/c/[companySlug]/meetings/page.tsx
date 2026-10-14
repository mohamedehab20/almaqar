import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { demoApprovalsData } from "@/modules/approvals/demo";
import { getApprovalsData } from "@/modules/approvals/queries";
import { getSignedInCompany } from "@/modules/hq/queries";
import { MeetingsRoom } from "@/modules/operations/components/meetings-room";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/meetings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meetings" });
  return { title: t("title") };
}

/** «غرفة الاجتماعات»: task management, the schedule and approvals. `?tab=tasks` / `?tab=approvals` opens that tab. */
export default async function MeetingsPage({ params, searchParams }: PageProps<"/[locale]/c/[companySlug]/meetings">) {
  const { locale, companySlug } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  const approvals = current ? await getApprovalsData(current.company.id) : demoApprovalsData(undefined, locale === "en" ? "en" : "ar");
  const initialTab = tab === "tasks" || tab === "approvals" ? tab : "schedule";
  return <MeetingsRoom initialTab={initialTab} approvals={approvals} companyId={current?.company.id ?? null} />;
}
