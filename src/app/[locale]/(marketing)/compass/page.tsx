import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { AcademyView } from "@/modules/academy/components/academy-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/compass">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compass" });
  return { title: t("metaTitle") };
}

export default async function CompassPage({ params }: PageProps<"/[locale]/compass">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("compass");

  return (
    <>
      <MarketingHeader />
      <main className="bg-[linear-gradient(180deg,var(--color-surface-container-low)_0,var(--color-surface)_160px)] px-4 pb-24 pt-14 sm:px-6">
        <header className="mx-auto max-w-2xl text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-secondary-container text-on-secondary-container shadow-ambient">
            <Compass className="size-8" aria-hidden />
          </span>
          <p className="mt-4 text-sm font-semibold text-tertiary">{t("eyebrow")}</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 text-on-surface-variant">{t("subtitle")}</p>
        </header>
        <div className="mx-auto mt-12 max-w-6xl">
          <AcademyView />
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
