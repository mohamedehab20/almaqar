import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingView } from "@/modules/marketing/components/marketing-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/marketing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: t("navTitle") };
}

export default async function MarketingPage({ params }: PageProps<"/[locale]/c/[companySlug]/marketing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketingView />;
}
