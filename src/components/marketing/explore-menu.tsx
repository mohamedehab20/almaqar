"use client";

import {
  BadgePercent,
  Building2,
  Compass,
  House,
  Menu,
  Sparkles,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const groups = [
  {
    key: "site",
    items: [
      { key: "home", href: "/", icon: House },
      { key: "why", href: "/#why", icon: Sparkles },
      { key: "pricing", href: "/pricing", icon: BadgePercent },
    ],
  },
  {
    key: "learn",
    items: [{ key: "compass", href: "/compass", icon: Compass }],
  },
  {
    key: "enter",
    items: [
      { key: "company", href: "/login", icon: Building2 },
      { key: "employee", href: "/employee-login", icon: UserRound },
      { key: "visitor", href: "/visitor-login", icon: UsersRound },
      { key: "signup", href: "/signup", icon: UserPlus },
    ],
  },
] as const;

const noop = () => () => {};

/** "Explore" tab next to the logo: opens a side drawer listing the public pages and the ways to sign in. */
export function ExploreMenu() {
  const t = useTranslations("common.explore");
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The header uses backdrop-filter, which traps fixed children — so the drawer is portaled to <body> once mounted
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="explore-drawer"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
          open
            ? "bg-primary-fixed text-primary"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        )}
      >
        <Menu className="size-4" aria-hidden />
        {t("label")}
      </button>

      {mounted &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              aria-hidden
              onClick={() => setOpen(false)}
              className={cn(
                "fixed inset-0 z-40 bg-black/30 transition-opacity",
                open ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            />

            {/* Drawer slides in from the start side (right in Arabic, left in English) */}
            <aside
              id="explore-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={t("label")}
              inert={!open}
              className={cn(
                "fixed inset-y-0 start-0 z-50 flex w-80 max-w-[85vw] flex-col bg-surface-container-lowest shadow-ambient-lg duration-300",
                open
                  ? "visible translate-x-0 transition-transform"
                  : "invisible transition-[transform,visibility] ltr:-translate-x-full rtl:translate-x-full",
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-5 py-4">
                <span className="flex items-center gap-2">
                  <Image
                    src="/brand/logo.png"
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 object-contain"
                  />
                  <span className="text-lg font-extrabold text-primary">
                    {t("label")}
                  </span>
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("close")}
                  className="grid size-9 place-items-center rounded-full hover:bg-surface-container"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3">
                {groups.map((group, index) => (
                  <div
                    key={group.key}
                    className={cn(
                      index > 0 &&
                        "mt-2 border-t border-outline-variant/30 pt-2",
                    )}
                  >
                    <p className="px-3 pb-1 pt-2 text-[11px] font-bold text-muted">
                      {t(`groups.${group.key}`)}
                    </p>
                    {group.items.map(({ key, href, icon: Icon }) => {
                      const featured = key === "compass";
                      return (
                        <Link
                          key={key}
                          href={href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2.5",
                            featured
                              ? "bg-secondary-fixed/60 hover:bg-secondary-fixed"
                              : "hover:bg-surface-container-low",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-md",
                              featured
                                ? "bg-secondary-container text-on-secondary-container"
                                : "bg-primary-fixed text-primary",
                            )}
                          >
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                              {t(`items.${key}.title`)}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {t(`items.${key}.desc`)}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
