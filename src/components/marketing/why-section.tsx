import { Blocks, Languages, Server, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const features: { key: "bilingual" | "security" | "integrations" | "infrastructure"; icon: LucideIcon }[] = [
  { key: "bilingual", icon: Languages },
  { key: "security", icon: ShieldCheck },
  { key: "integrations", icon: Blocks },
  { key: "infrastructure", icon: Server },
];

export function WhySection() {
  const t = useTranslations("landing.why");

  return (
    <section id="why" className="bg-surface-container-low px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">{t("title")}</h2>
          <p className="mt-3 text-on-surface-variant">{t("intro")}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {features.map(({ key, icon: Icon }) => (
            <article key={key} className="flex items-start gap-4 rounded-md bg-surface-container-lowest p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary-fixed text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-bold">{t(`${key}.title`)}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{t(`${key}.text`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
