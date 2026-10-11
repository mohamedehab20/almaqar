import { BadgeCheck, LayoutGrid, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Logo } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Link } from "@/i18n/navigation";
import { SignupForm } from "@/modules/auth/components/signup-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signup" });
  return { title: t("metaTitle") };
}

export default function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("auth");
  const s = (key: string) => t(`signup.${key}`);

  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(180deg,var(--color-surface-container-low),var(--color-surface)_40%)]">
      <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo className="text-xl" />
        <nav className="hidden items-center gap-10 text-sm font-medium sm:flex">
          <Link href="/" className="hover:text-primary">{s("navHome")}</Link>
          <Link href="/#why" className="hover:text-primary">{s("navFeatures")}</Link>
          <Link href="/pricing" className="hover:text-primary">{s("navPricing")}</Link>
        </nav>
        <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
          {s("navLogin")}
        </Link>
      </header>

      <main className="flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-xl bg-surface-container-lowest shadow-ambient lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <SignupForm />

          <aside className="flex flex-col justify-between gap-12 bg-brand-gradient p-10 text-on-primary sm:p-14">
            <div>
              <h2 className="max-w-xs text-4xl font-extrabold leading-snug">{s("panelTitle")}</h2>
              <p className="mt-6 max-w-sm leading-8 text-on-primary/85">{s("panelText")}</p>
            </div>
            <div className="flex flex-col gap-5">
              <Benefit icon={BadgeCheck} title={s("benefitSecurity")} text={s("benefitSecurityText")} />
              <Benefit icon={LayoutGrid} title={s("benefitGrowth")} text={s("benefitGrowthText")} />
            </div>
          </aside>
        </div>
      </main>

      <footer className="bg-surface-container px-4 py-6 text-sm text-on-surface-variant sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span>{t("signup.rights", { year: new Date().getFullYear() })}</span>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            <a href="#" className="hover:text-primary">{t("common.terms")}</a>
            <a href="#" className="hover:text-primary">{t("common.privacy")}</a>
            <a href="#" className="hover:text-primary">{t("common.contact")}</a>
            <LocaleSwitcher />
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-md bg-white/10 text-secondary-container">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="text-sm text-on-primary/80">{text}</p>
      </div>
    </div>
  );
}
