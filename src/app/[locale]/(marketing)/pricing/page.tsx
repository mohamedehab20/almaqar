import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PricingPlans } from "@/components/marketing/pricing-plans";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return { title: t("metaTitle") };
}

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");

  return (
    <>
      <MarketingHeader />
      <main className="bg-[linear-gradient(180deg,var(--color-surface-container-low)_0,var(--color-surface)_160px)] px-4 pb-24 pt-14 sm:px-6">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-tertiary">{t("eyebrow")}</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 text-on-surface-variant">{t("subtitle")}</p>
        </header>
        <div className="mt-12">
          <PricingPlans />
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
