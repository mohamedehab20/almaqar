"use client";

import { Check, Crown, Minus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

/** Monthly price in EGP; yearly billing gets 30% off. */
const PREMIUM_MONTHLY = 300;
const PREMIUM_YEARLY_PER_MONTH = 210;

const freeFeatures = ["employees5", "hq", "hr", "operationsLimited", "oneWorkflow", "emailSupport"] as const;
const freeMissing = ["automation", "clientPortal", "analytics", "ai"] as const;
const premiumFeatures = [
  "employeesUnlimited",
  "allRooms",
  "automation",
  "workflowsUnlimited",
  "clientPortal",
  "attachments",
  "analytics",
  "ai",
  "prioritySupport",
] as const;

export function PricingPlans() {
  const t = useTranslations("pricing");
  const [billing, setBilling] = useState<Billing>("monthly");
  const premiumPrice = billing === "monthly" ? PREMIUM_MONTHLY : PREMIUM_YEARLY_PER_MONTH;

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Billing toggle */}
      <div className="flex items-center gap-1 rounded-full bg-surface-container-lowest p-1 shadow-ambient ghost-border" role="radiogroup" aria-label={t("billing.label")}>
        {(["monthly", "yearly"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={billing === key}
            onClick={() => setBilling(key)}
            className={cn(
              "flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-colors",
              billing === key ? "bg-brand-gradient font-bold text-on-primary" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {t(`billing.${key}`)}
            {key === "yearly" && (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", billing === key ? "bg-white/20" : "bg-secondary-fixed text-tertiary")}>
                {t("billing.save")}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid w-full max-w-4xl items-stretch gap-6 md:grid-cols-2">
        {/* Free */}
        <section className="flex flex-col rounded-xl bg-surface-container-lowest p-8 shadow-ambient ghost-border">
          <span className="grid size-12 place-items-center rounded-md bg-primary-fixed text-primary">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold">{t("free.name")}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{t("free.tagline")}</p>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="text-5xl font-black">{t("free.price")}</span>
            <span className="text-sm text-muted">{t("free.forever")}</span>
          </p>
          <Link href="/signup" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-6 h-12 w-full text-base")}>
            {t("free.cta")}
          </Link>
          <ul className="mt-8 flex flex-col gap-3 text-sm">
            {freeFeatures.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {t(`features.${key}`)}
              </li>
            ))}
            {freeMissing.map((key) => (
              <li key={key} className="flex items-start gap-3 text-muted">
                <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="line-through decoration-muted/50">{t(`features.${key}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Premium */}
        <section className="relative flex flex-col rounded-xl bg-inverse-surface p-8 text-inverse-on-surface shadow-ambient-lg ring-2 ring-secondary-container">
          <span className="absolute -top-3.5 start-8 rounded-full bg-secondary-container px-4 py-1 text-xs font-bold text-on-secondary-container shadow-ambient">
            {t("premium.popular")}
          </span>
          <span className="grid size-12 place-items-center rounded-md bg-secondary-container text-on-secondary-container">
            <Crown className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold text-white">{t("premium.name")}</h2>
          <p className="mt-1 text-sm text-white/70">{t("premium.tagline")}</p>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="text-5xl font-black text-white" dir="ltr">{premiumPrice}</span>
            <span className="text-sm text-white/70">{t("premium.per")}</span>
          </p>
          <p className="mt-1 text-xs text-white/60">{t(billing === "yearly" ? "premium.billedYearly" : "premium.billedMonthly", { total: PREMIUM_YEARLY_PER_MONTH * 12 })}</p>
          <Link
            href="/signup"
            className={cn(buttonVariants({ variant: "gold", size: "lg" }), "mt-6 h-12 w-full text-base font-bold")}
          >
            {t("premium.cta")}
          </Link>
          <p className="mt-2 text-center text-xs text-white/60">{t("premium.trial")}</p>
          <ul className="mt-8 flex flex-col gap-3 text-sm">
            {premiumFeatures.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-secondary-container" aria-hidden />
                {t(`features.${key}`)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-sm text-on-surface-variant">
        {t("enterprise")}{" "}
        <a href="#" className="font-semibold text-primary hover:underline">{t("contactUs")}</a>
      </p>

      {/* FAQ */}
      <section className="w-full max-w-3xl">
        <h2 className="text-center text-2xl font-extrabold">{t("faq.title")}</h2>
        <div className="mt-6 flex flex-col gap-3">
          {(["switch", "trial", "cancel"] as const).map((key) => (
            <details key={key} className="group rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {t(`faq.${key}.q`)}
                <span className="text-xl text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">{t(`faq.${key}.a`)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
