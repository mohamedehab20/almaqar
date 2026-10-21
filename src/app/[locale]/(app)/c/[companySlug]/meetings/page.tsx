import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { demoApprovalsData } from "@/modules/approvals/demo";
import { getApprovalsData } from "@/modules/approvals/queries";
import { getSignedInCompany } from "@/modules/hq/queries";
import { MeetingsRoom } from "@/modules/operations/components/meetings-room";
import { demoScheduleBoard, demoTaskBoard } from "@/modules/operations/demo";
import { getScheduleBoard, getTaskBoard } from "@/modules/operations/queries";

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
  const [approvals, tasks, schedule] = current
    ? await Promise.all([getApprovalsData(current.company.id), getTaskBoard(current.company.id), getScheduleBoard(current.company.id)])
    : [demoApprovalsData(undefined, locale === "en" ? "en" : "ar"), demoTaskBoard(), demoScheduleBoard()];
  const initialTab = tab === "tasks" || tab === "approvals" ? tab : "schedule";
  return <MeetingsRoom initialTab={initialTab} approvals={approvals} tasks={tasks} schedule={schedule} companyId={current?.company.id ?? null} />;
}
