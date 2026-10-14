import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientPortalView } from "@/modules/clients/components/client-portal-view";
import { demoClientPortalData } from "@/modules/clients/demo";
import { getClientPortalData } from "@/modules/clients/queries";
import { getSignedInCompany } from "@/modules/hq/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr/client-portal">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clientsPortal" });
  return { title: t("title") };
}

/** HR → «بوابة العملاء»: clients and visitors, who each belongs to, portal codes and meetings. */
export default async function ClientPortalPage({ params }: PageProps<"/[locale]/c/[companySlug]/hr/client-portal">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  if (!current) return <ClientPortalView data={demoClientPortalData(undefined, locale === "en" ? "en" : "ar")} companyId={null} companySlug={companySlug} />;
  return <ClientPortalView data={await getClientPortalData(current.company.id)} companyId={current.company.id} companySlug={companySlug} />;
}
