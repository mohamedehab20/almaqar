import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HqView } from "@/modules/hq/components/hq-view";
import { activity, currentUserId, demoCompany, departments, furniture, members, rooms, zones } from "@/modules/hq/mock";
import { getMainHall, getSignedInCompany } from "@/modules/hq/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hq" });
  return { title: t("title") };
}

/** Main hall: the real team, office and activity for a signed-in company; the demo office otherwise. */
export default async function MainHallPage({ params }: PageProps<"/[locale]/c/[companySlug]">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  if (current) {
    const hall = await getMainHall(current.company.id);
    return (
      <HqView
        companyId={current.company.id}
        currentUserId={hall.meId}
        members={hall.members}
        rooms={hall.rooms}
        furniture={hall.furniture}
        activity={hall.activity}
        zones={hall.zones}
        departments={hall.departments}
        floor={hall.floor}
      />
    );
  }

  return (
    <HqView
      companyId={null}
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
