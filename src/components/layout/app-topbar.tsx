"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Bell, Grip, LogOut, Menu } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/shared/avatar";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type AppTopbarProps = {
  userName: string;
  signedIn?: boolean;
  onMenu: () => void;
};

const tabs = ["dashboard", "office", "resources", "settings"] as const;

export function AppTopbar({ userName, signedIn = false, onMenu }: AppTopbarProps) {
  const t = useTranslations("app");
  const tPage = useTranslations();
  // "/c/<slug>" is the main hall; "/c/<slug>/<section>" are the other pages
  const section = usePathname().split("/")[3];
  const isHall = !section;
  const sectionTitles: Record<string, string> = { operations: "ops.navTitle", hr: "hr.navTitle", marketing: "marketing.navTitle", automation: "automation.navTitle", sales: "sales.navTitle", agents: "agents.navTitle" };
  const title = tPage(sectionTitles[section] ?? "hq.title");

  return (
    <header className="flex h-20 shrink-0 items-center gap-2 sm:gap-4 bg-surface-container-lowest px-4 shadow-[0_1px_0_rgba(195,198,215,0.35)] sm:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label={t("openMenu")}
        className="grid size-10 place-items-center rounded-full hover:bg-surface-container-low lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {/* Logo → home page (the sidebar logo is hidden on small screens) */}
      <Link href="/" aria-label={t("backHome")} title={t("backHome")} className="shrink-0 lg:hidden">
        <Image src="/brand/logo.png" alt="" width={36} height={36} className="size-9 object-contain" />
      </Link>

      <h1 className="truncate text-2xl font-extrabold text-primary sm:text-3xl">{title}</h1>

      {/* Main-hall tabs. Only "dashboard" exists for now; the others are placeholders */}
      <nav className={cn("ms-6 hidden items-center gap-8 text-sm", isHall && "md:flex")}>
        {tabs.map((tab, index) => (
          <span
            key={tab}
            title={index === 0 ? undefined : t("comingSoon")}
            aria-current={index === 0 ? "page" : undefined}
            className={cn(
              "border-b-2 py-1",
              index === 0 ? "border-primary font-semibold text-primary" : "border-transparent text-on-surface-variant",
            )}
          >
            {t(`tabs.${tab}`)}
          </span>
        ))}
      </nav>

      <div className="ms-auto flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          aria-label={t("notifications")}
          className="relative grid size-10 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
        >
          <Bell className="size-5 fill-current" aria-hidden />
          <span className="absolute end-2.5 top-2 size-2 rounded-full bg-danger ring-2 ring-surface-container-lowest" />
        </button>
        <button
          type="button"
          aria-label={t("apps")}
          className="hidden size-10 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low sm:grid"
        >
          <Grip className="size-5" aria-hidden />
        </button>
        <span title={userName}>
          <Avatar name={userName} status="available" />
        </span>
        {signedIn && (
          // Only rendered with a real Clerk session (signedIn), so ClerkProvider is present
          <SignOutButton redirectUrl="/login">
            <button
              type="button"
              aria-label={t("signOut")}
              title={t("signOut")}
              className="grid size-10 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
            >
              <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          </SignOutButton>
        )}
      </div>
    </header>
  );
}
