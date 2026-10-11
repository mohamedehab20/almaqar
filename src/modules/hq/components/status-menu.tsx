"use client";

import { Check, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { statusColor } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";
import { selectableStatuses, type PresenceStatus } from "../mock";

/** The blue status pill in the control bar; opens an upward menu of statuses. */
export function StatusMenu({
  status,
  onChange,
}: {
  status: PresenceStatus;
  onChange: (status: PresenceStatus) => void;
}) {
  const t = useTranslations("hq.status");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("change")}
        className="flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-brand-gradient px-4 text-sm font-bold sm:gap-3 sm:text-base text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition hover:brightness-110 sm:h-14 sm:px-8"
      >
        <span className={cn("size-2.5 rounded-full", statusColor[status])} />
        {t(status)}
        <ChevronUp className={cn("size-4 transition-transform", !open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("menu")}
          className="absolute bottom-full left-1/2 z-30 mb-3 w-56 -translate-x-1/2 rounded-lg bg-surface-container-lowest p-2 text-on-surface shadow-ambient-lg ghost-border"
        >
          {selectableStatuses.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === status}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-surface-container-low",
                option === status && "bg-primary-fixed/50 font-semibold text-primary",
              )}
            >
              <span className={cn("size-2.5 shrink-0 rounded-full", statusColor[option])} />
              <span className="flex-1 text-start">{t(option)}</span>
              {option === status && <Check className="size-4" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
