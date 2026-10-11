import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { RoleCards } from "@/components/marketing/role-cards";
import { WhySection } from "@/components/marketing/why-section";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("landing");

  return (
    <>
      <MarketingHeader />
      <main>
        <section className="bg-[linear-gradient(180deg,var(--color-surface-container-low)_0,var(--color-surface)_120px)] px-4 pb-24 pt-14 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-1 text-xs text-muted shadow-ambient">
            <Sparkles className="size-3.5 text-secondary-container" aria-hidden />
            {t("badge")}
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight drop-shadow-[0_5px_20px_rgba(21,40,75,0.1)] sm:text-6xl lg:text-7xl lg:leading-[1.3]">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-base font-light leading-8 text-on-surface-variant">
            {t("subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              {t("startJourney")}
            </Link>
            <a href="#why" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              {t("tryNow")}
            </a>
          </div>
          <RoleCards />
        </section>
        <WhySection />
      </main>
      <MarketingFooter />
    </>
  );
}
