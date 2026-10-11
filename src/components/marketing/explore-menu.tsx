"use client";

import { BadgePercent, Building2, ChevronDown, House, Sparkles, UserPlus, UserRound, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
    key: "enter",
    items: [
      { key: "company", href: "/login", icon: Building2 },
      { key: "employee", href: "/employee-login", icon: UserRound },
      { key: "visitor", href: "/visitor-login", icon: UsersRound },
      { key: "signup", href: "/signup", icon: UserPlus },
    ],
  },
] as const;

/** Dropdown tab next to the logo that lists the public pages and the ways to sign in. */
export function ExploreMenu() {
  const t = useTranslations("common.explore");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
          open ? "bg-primary-fixed text-primary" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        )}
      >
        {t("label")}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div role="menu" className="absolute start-0 top-full z-40 mt-2 w-72 rounded-lg bg-surface-container-lowest p-2 shadow-ambient-lg ghost-border">
          {groups.map((group, index) => (
            <div key={group.key} className={cn(index > 0 && "mt-1 border-t border-outline-variant/30 pt-1")}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold text-muted">{t(`groups.${group.key}`)}</p>
              {group.items.map(({ key, href, icon: Icon }) => (
                <Link
                  key={key}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-container-low"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-fixed text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t(`items.${key}.title`)}</span>
                    <span className="block truncate text-xs text-muted">{t(`items.${key}.desc`)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
