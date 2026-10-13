"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DEMO_COMPANY_SLUG } from "@/modules/hq/mock";

/** "Continue as a guest": opens the public demo company (mock data, no account). */
export function GuestButton() {
  const t = useTranslations("auth.common");

  return (
    <div className="flex flex-col gap-4">
      <Divider label={t("or")} />
      <Link
        href={`/c/${DEMO_COMPANY_SLUG}`}
        className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-13 flex-col gap-0.5 py-2 text-on-surface")}
      >
        <span className="flex items-center gap-2 font-bold">
          <Eye className="size-4" aria-hidden />
          {t("guest")}
        </span>
        <span className="text-xs font-normal text-on-surface-variant">{t("guestHint")}</span>
      </Link>
    </div>
  );
}
