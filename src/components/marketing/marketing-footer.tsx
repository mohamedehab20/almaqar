import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export function MarketingFooter() {
  const t = useTranslations("landing.footer");

  return (
    <footer className="bg-surface-container px-4 py-6 text-sm text-on-surface-variant sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <span>{t("rights", { year: new Date().getFullYear() })}</span>
        <nav className="flex flex-wrap items-center justify-center gap-6">
          <a href="#" className="hover:text-primary">{t("support")}</a>
          <a href="#" className="hover:text-primary">{t("terms")}</a>
          <a href="#" className="hover:text-primary">{t("privacy")}</a>
          <LocaleSwitcher />
        </nav>
      </div>
    </footer>
  );
}
