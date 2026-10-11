import { Building2, CircleHelp, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { VisitorLoginForm } from "@/modules/auth/components/visitor-login-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/visitor-login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.visitor" });
  return { title: t("metaTitle") };
}

export default function VisitorLoginPage({ params }: PageProps<"/[locale]/visitor-login">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("auth.visitor");

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_30%_0%,#cbdaf6_0,transparent_40%),linear-gradient(140deg,#f2f6ff,#f8f8f9_60%,#f9f2e7)] px-4 py-10">
      {/* Reception photo strip on the end side, wide screens only */}
      <div className="absolute inset-y-0 end-0 hidden w-1/4 lg:block">
        <Image src="/landing/visitor.jpg" alt="" fill sizes="25vw" className="object-cover" priority />
      </div>

      <section className="relative w-full max-w-lg overflow-hidden rounded-xl bg-surface-container-lowest shadow-ambient-lg">
        <div className="p-6 sm:p-10">
          <header className="mb-8 flex flex-col items-center text-center">
            <span className="grid size-20 place-items-center rounded-lg bg-surface-container-low text-primary-container">
              <Building2 className="size-10" aria-hidden />
            </span>
            <h1 className="mt-5 text-3xl font-extrabold">{t("title")}</h1>
            <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
          </header>
          <VisitorLoginForm />
        </div>
        <footer className="flex items-center justify-between bg-surface-container-low px-6 py-4 text-xs text-muted sm:px-10">
          <span>{t("rights", { year: new Date().getFullYear() })}</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-success" aria-hidden />
            {t("secure")}
          </span>
        </footer>
      </section>

      <div className="relative flex flex-wrap items-center justify-center gap-6 text-sm text-on-surface-variant">
        <a href="#" className="flex items-center gap-1.5 hover:text-primary">
          <CircleHelp className="size-4" aria-hidden />
          {t("help")}
        </a>
        <LocaleSwitcher />
      </div>
    </main>
  );
}
