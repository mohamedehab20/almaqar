import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientPortalView } from "@/modules/clients/components/client-portal-view";
import { demoClientPortalData } from "@/modules/clients/demo";
import { getClientPortalData } from "@/modules/clients/queries";
import { getSignedInCompany } from "@/modules/hq/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/clients">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clientsPortal" });
  return { title: t("title") };
}

/**
 * «بوابة العملاء» (sidebar room): everyone outside the company who enters through the visitor login — clients of
 * any room or department, meeting visitors, people following an operation, and job candidates — with what each sees.
 */
export default async function ClientsPage({ params }: PageProps<"/[locale]/c/[companySlug]/clients">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  if (!current) return <ClientPortalView data={demoClientPortalData(undefined, locale === "en" ? "en" : "ar")} companyId={null} companySlug={companySlug} />;
  return <ClientPortalView data={await getClientPortalData(current.company.id)} companyId={current.company.id} companySlug={companySlug} />;
}
