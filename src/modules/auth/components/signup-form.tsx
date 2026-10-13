"use client";

import { Mail, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { signUp } from "@/modules/auth/actions";
import { useAuthAction } from "@/modules/auth/use-auth-action";
import { DEMO_COMPANY_SLUG } from "@/modules/hq/mock";

const businessTypes = ["startup", "agency", "training", "consulting", "services", "other"] as const;
const sizes = ["1-10", "11-50", "51-200", "200+"] as const;

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const { submit, pending, message } = useAuthAction(signUp, (result, say) => {
    if (result.needsEmailConfirmation) {
      say(t("checkEmail", { email }));
      return;
    }
    router.push(`/c/${result.slug}`);
    router.refresh();
  });

  return (
    <section className="px-6 py-10 sm:px-12 sm:py-14">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-sm text-on-surface-variant">{t("subtitle")}</p>

      <form
        className="mt-8 grid gap-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const value = (name: string) => String(data.get(name) ?? "").trim();
          setEmail(value("email"));
          submit(
            {
              firstName: value("firstName"),
              lastName: value("lastName"),
              phone: value("phone") || undefined,
              email: value("email"),
              password: String(data.get("password") ?? ""),
              company: value("company"),
              businessType: value("businessType") || undefined,
              size: value("size") || undefined,
            },
            // No Supabase on this server (e.g. a preview deploy): keep the demo reachable
            (code) => code === "not_configured" && (router.push(`/c/${DEMO_COMPANY_SLUG}`), true),
          );
        }}
      >
        <Field label={t("firstName")} htmlFor="firstName">
          <Input id="firstName" name="firstName" placeholder={t("firstNamePlaceholder")} autoComplete="given-name" required />
        </Field>
        <Field label={t("lastName")} htmlFor="lastName">
          <Input id="lastName" name="lastName" placeholder={t("lastNamePlaceholder")} autoComplete="family-name" required />
        </Field>
        <Field label={t("phone")} htmlFor="phone" className="sm:col-span-2">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            icon={Smartphone}
            placeholder={t("phonePlaceholder")}
            autoComplete="tel"
            required
          />
        </Field>
        <Field label={t("email")} htmlFor="email" className="sm:col-span-2">
          <Input
            id="email"
            name="email"
            type="email"
            icon={Mail}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            required
          />
        </Field>
        <Field label={t("company")} htmlFor="company" className="sm:col-span-2">
          <Input id="company" name="company" placeholder={t("companyPlaceholder")} autoComplete="organization" required />
        </Field>
        <Field label={t("businessType")} htmlFor="businessType">
          <Select id="businessType" name="businessType" placeholder={t("businessTypePlaceholder")} required>
            {businessTypes.map((type) => (
              <option key={type} value={type}>
                {t(`businessTypes.${type}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("size")} htmlFor="size">
          <Select id="size" name="size" placeholder={t("sizePlaceholder")} required>
            {sizes.map((size) => (
              <option key={size} value={size}>
                {t(`sizes.${size}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("password")} htmlFor="password" hint={t("passwordHint")} className="sm:col-span-2">
          <PasswordInput
            id="password"
            name="password"
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>

        <div className="flex flex-col gap-4 sm:col-span-2">
          <Button type="submit" size="lg" className="mt-2 h-14 text-base" disabled={pending}>
            {pending ? t("working") : t("submit")}
          </Button>
          <FormStatus message={message} />
          <p className="text-center text-sm text-on-surface-variant">
            {t("haveAccount")}{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              {t("login")}
            </Link>
          </p>
        </div>
      </form>
    </section>
  );
}
