import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingView } from "@/modules/marketing/components/marketing-view";
import { getSignedInCompany } from "@/modules/hq/queries";
import { getMyPermissions } from "@/modules/permissions/queries";
import { computeProfitability, type ProfitReport, type ProfitSettings } from "@/modules/profitability/calc";
import { DEMO_SETTINGS, demoProfitInputs } from "@/modules/profitability/demo";
import { getProfitabilityReport, getProfitabilitySettings } from "@/modules/profitability/queries";

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
  // «إعدادات الربحية» (the costs behind it) are the owner's only.
  let profitability: ProfitReport | null = null;
  let profitSettings: ProfitSettings | null = null;
  const current = await getSignedInCompany(companySlug);
  if (!current) {
    profitability = computeProfitability(demoProfitInputs());
    profitSettings = DEMO_SETTINGS;
  } else if ((await getMyPermissions(current.company.id)).scopes["profitability.view"]) {
    const owner = current.me.role === "owner";
    [profitability, profitSettings] = await Promise.all([getProfitabilityReport(current.company.id), owner ? getProfitabilitySettings(current.company.id) : null]);
  }
  return <MarketingView profitability={profitability} profitSettings={profitSettings} companyId={current?.company.id ?? null} />;
}
