"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Shown above every page of the public demo: guests see that nothing is saved, with a way to sign up or in. */
export function GuestBanner() {
  const t = useTranslations("app");

  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-secondary-fixed px-4 py-2 text-sm text-on-secondary-container">
      <span className="flex items-center gap-2">
        <Eye className="size-4 shrink-0" aria-hidden />
        {t("guestBanner")}
      </span>
      <span className="flex items-center gap-3">
        <Link href="/signup" className="rounded-full bg-secondary-container px-3 py-1 font-bold text-on-secondary-container hover:brightness-95">
          {t("guestCta")}
        </Link>
        <Link href="/login" className="font-semibold underline underline-offset-4">
          {t("guestLogin")}
        </Link>
      </span>
    </div>
  );
}
