import { Bell, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ExploreMenu } from "./explore-menu";

export function MarketingHeader() {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-30 glass shadow-[0_1px_0_rgba(195,198,215,0.35)]">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <ExploreMenu />
          <Logo />
        </div>
        <nav aria-label={t("accountNav")} className="flex items-center gap-2 sm:gap-3">
          <Link href="/signup" className={buttonVariants({ size: "sm" })}>
            {t("signup")}
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            {t("login")}
          </Link>
          <button
            type="button"
            aria-label={t("notifications")}
            className={cn(buttonVariants({ variant: "icon", size: "icon" }), "hidden sm:inline-flex")}
          >
            <Bell className="size-4" aria-hidden />
          </button>
          <span
            title={t("profile")}
            className="hidden size-8 place-items-center rounded-full sm:grid bg-inverse-surface text-inverse-on-surface ring-2 ring-success-container"
          >
            <UserRound className="size-4" aria-hidden />
          </span>
        </nav>
      </div>
    </header>
  );
}
