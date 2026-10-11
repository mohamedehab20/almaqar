import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HqView } from "@/modules/hq/components/hq-view";
import { activity, currentUserId, demoCompany, departments, furniture, members, rooms, zones } from "@/modules/hq/mock";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hq" });
  return { title: t("title") };
}

export default async function MainHallPage({ params }: PageProps<"/[locale]/c/[companySlug]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <HqView
      currentUserId={currentUserId}
      members={members}
      rooms={rooms}
      furniture={furniture}
      activity={activity}
      zones={zones}
      departments={departments}
      floor={demoCompany.floor}
    />
  );
}
