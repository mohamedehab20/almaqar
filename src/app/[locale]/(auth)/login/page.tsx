import { CircleAlert, LayoutDashboard, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Logo } from "@/components/layout/logo";
import { Link } from "@/i18n/navigation";
import { AuthTabs } from "@/modules/auth/components/auth-tabs";
import { CompanyLoginForm } from "@/modules/auth/components/company-login-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.login" });
  return { title: t("metaTitle") };
}

export default function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("auth.login");

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,45%)]">
      <section className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="flex w-full max-w-xl flex-col gap-10">
          <header>
            <Logo className="mb-8 w-fit text-xl" />
            <h1 className="text-4xl font-extrabold sm:text-5xl">{t("title")}</h1>
            <p className="mt-3 text-lg text-on-surface-variant">{t("subtitle")}</p>
          </header>

          <div className="w-full max-w-sm">
            <AuthTabs active="login" />
          </div>

          <CompanyLoginForm />

          <p className="flex items-center gap-3 rounded-lg bg-secondary-fixed px-6 py-5 text-sm text-on-secondary-container ring-1 ring-secondary-container/30">
            <CircleAlert className="size-6 shrink-0 fill-on-secondary-container text-secondary-fixed" aria-hidden />
            <span>
              {t("ownerPrompt")}{" "}
              <Link href="/signup" className="font-bold underline underline-offset-4">
                {t("ownerLink")}
              </Link>{" "}
              {t("ownerSuffix")}
            </span>
          </p>

          <footer className="flex flex-wrap items-center justify-center gap-6 text-xs uppercase tracking-[0.15em] text-muted">
            <span dir="ltr">{t("rights", { year: new Date().getFullYear() })}</span>
            <LocaleSwitcher className="normal-case tracking-normal" />
          </footer>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-inverse-surface text-inverse-on-surface lg:block">
        <Image src="/auth/diwan.png" alt="" fill priority sizes="45vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,16,0.35),rgba(20,18,16,0.7))]" />

        <div className="relative flex h-full flex-col justify-between gap-12 p-12 xl:p-20">
          <div>
            <p className="text-6xl font-black tracking-tight text-white">
              {t("wordmark")}
            </p>
            <p className="mt-4 max-w-md text-2xl leading-relaxed text-primary-fixed/80">{t("tagline")}</p>
          </div>

          <div className="flex flex-col gap-8">
            <Feature icon={LayoutDashboard} title={t("featureDashboard")} text={t("featureDashboardText")} />
            <Feature icon={ShieldCheck} title={t("featureSecurity")} text={t("featureSecurityText")} />
          </div>

          {/* Placeholder testimonial from the design — replace with a real customer before launch */}
          <figure className="rounded-xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-md">
            <blockquote className="text-lg italic leading-relaxed text-white/85">“{t("quote")}”</blockquote>
            <figcaption className="mt-6 flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container">
                {t("quoteAuthor").charAt(0)}
              </span>
              <span>
                <span className="block font-bold text-white">{t("quoteAuthor")}</span>
                <span className="block text-xs uppercase tracking-[0.2em] text-white/50">{t("quoteRole")}</span>
              </span>
            </figcaption>
          </figure>
        </div>
      </aside>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex items-center gap-5">
      <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-primary/30 text-primary-fixed ring-1 ring-white/10 backdrop-blur-sm">
        <Icon className="size-7" aria-hidden />
      </span>
      <div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="mt-1 text-white/60">{text}</p>
      </div>
    </div>
  );
}
