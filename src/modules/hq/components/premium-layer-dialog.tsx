"use client";

import { Building, Check, Crown, Layers, Sofa, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const perks = [
  { key: "floors", icon: Layers },
  { key: "rooms", icon: Building },
  { key: "furniture", icon: Sofa },
] as const;

/** Shown when a Free company tries to add another layer (floor) to the HQ — the HQ editor is a Premium feature. */
export function PremiumLayerDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("hq.premium");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-layer-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-xl bg-inverse-surface text-inverse-on-surface shadow-ambient-lg ring-2 ring-secondary-container"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute end-3 top-3 grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-secondary-container text-on-secondary-container shadow-ambient">
            <Crown className="size-8" aria-hidden />
          </span>
          <span className="mt-4 rounded-full bg-secondary-container/15 px-3 py-1 text-xs font-bold text-secondary-container">{t("badge")}</span>
          <h2 id="premium-layer-title" className="mt-3 text-2xl font-extrabold text-white">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/70">{t("subtitle")}</p>
        </div>

        <ul className="flex flex-col gap-3 border-y border-white/10 px-6 py-5">
          {perks.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3 text-start">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white/10 text-secondary-container">
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-bold text-white">{t(`perks.${key}.title`)}</span>
                <span className="block text-xs text-white/60">{t(`perks.${key}.desc`)}</span>
              </span>
              <Check className="ms-auto mt-1 size-4 shrink-0 text-secondary-container" aria-hidden />
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 px-6 py-5">
          <Link href="/pricing" className={cn(buttonVariants({ variant: "gold", size: "lg" }), "h-12 w-full text-base font-bold")}>
            <Crown className="size-5" aria-hidden />
            {t("upgrade")}
          </Link>
          <p className="text-center text-xs text-white/60">{t("trial")}</p>
          <button type="button" onClick={onClose} className="mt-1 h-10 rounded-sm text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white">
            {t("later")}
          </button>
        </div>
      </div>
    </div>
  );
}
