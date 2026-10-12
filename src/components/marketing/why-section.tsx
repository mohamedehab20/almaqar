import { ArrowLeft, ArrowRight, Bot, Building2, Handshake, Languages, ShieldCheck, Workflow, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const features: { key: "presence" | "automation" | "agents" | "clients" | "bilingual" | "security"; icon: LucideIcon }[] = [
  { key: "presence", icon: Building2 },
  { key: "automation", icon: Workflow },
  { key: "agents", icon: Bot },
  { key: "clients", icon: Handshake },
  { key: "bilingual", icon: Languages },
  { key: "security", icon: ShieldCheck },
];

export function WhySection() {
  const t = useTranslations("landing.why");
  const Arrow = useLocale() === "ar" ? ArrowLeft : ArrowRight;

  return (
    <section id="why" className="bg-surface-container-low px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-tertiary">{t("eyebrow")}</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">{t("title")}</h2>
          <p className="mt-4 text-lg leading-8 text-on-surface-variant">{t("intro")}</p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon: Icon }, index) => (
            <article
              key={key}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-lg bg-surface-container-lowest p-6 shadow-ambient ghost-border transition hover:-translate-y-1 hover:shadow-ambient-lg"
            >
              <span className="absolute end-5 top-4 font-mono text-4xl font-black text-primary/15 transition-colors group-hover:text-primary/30" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="relative grid size-12 place-items-center rounded-md bg-primary-fixed text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="relative">
                <h3 className="text-lg font-extrabold">{t(`${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">{t(`${key}.text`)}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-5 text-center">
          <p className="text-xl font-bold">{t("closing")}</p>
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            {t("cta")}
            <Arrow className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
