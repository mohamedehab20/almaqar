import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingView } from "@/modules/marketing/components/marketing-view";
import { getSignedInCompany } from "@/modules/hq/queries";
import { getMyPermissions } from "@/modules/permissions/queries";
import { computeProfitability, type ProfitReport } from "@/modules/profitability/calc";
import { demoProfitInputs } from "@/modules/profitability/demo";
import { getProfitabilityReport } from "@/modules/profitability/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/marketing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: t("navTitle") };
}

export default async function MarketingPage({ params }: PageProps<"/[locale]/c/[companySlug]/marketing">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);

  // Client profitability is computed here, on the server: the real company for the owner and whoever has
  // profitability.view (Admin by default); the sample clients in the public demo; nothing for the rest.
  let profitability: ProfitReport | null = null;
  const current = await getSignedInCompany(companySlug);
  if (!current) {
    profitability = computeProfitability(demoProfitInputs());
  } else if ((await getMyPermissions(current.company.id)).scopes["profitability.view"]) {
    profitability = await getProfitabilityReport(current.company.id);
  }
  return <MarketingView profitability={profitability} />;
}
