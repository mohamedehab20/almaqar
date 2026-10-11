"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <Link
      href={pathname}
      locale={locale === "ar" ? "en" : "ar"}
      className={cn("inline-flex items-center gap-1.5 text-sm hover:text-primary", className)}
    >
      <Languages className="size-4" aria-hidden />
      {t("switchLocale")}
    </Link>
  );
}
