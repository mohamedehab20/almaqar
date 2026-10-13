import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MeetingsRoom } from "@/modules/operations/components/meetings-room";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/meetings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meetings" });
  return { title: t("title") };
}

/** «غرفة الاجتماعات»: schedule and task management. `?tab=tasks` opens task management (the sidebar's «مهام»). */
export default async function MeetingsPage({ params, searchParams }: PageProps<"/[locale]/c/[companySlug]/meetings">) {
  const { locale } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);
  return <MeetingsRoom initialTab={tab === "tasks" ? "tasks" : "schedule"} />;
}
