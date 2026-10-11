"use client";

import { ArrowLeft, ArrowRight, Building2, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useRouter } from "@/i18n/navigation";
import { DEMO_COMPANY_SLUG } from "@/modules/hq/mock";

const ssoProviders = ["Google", "Microsoft"] as const;

/** Main login: company code + email + password, with SSO options. */
export function CompanyLoginForm() {
  const t = useTranslations("auth");
  const l = (key: string, values?: Record<string, string>) => t(`login.${key}`, values);
  const Arrow = useLocale() === "ar" ? ArrowLeft : ArrowRight;
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="rounded-xl bg-surface-container-lowest p-6 shadow-ambient sm:p-12">
      <form
        // Frontend-only phase: skip browser validation so the next page can be previewed with empty fields
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          // TODO(backend): resolve company by code, sign in with Supabase Auth, then open that company
          router.push(`/c/${DEMO_COMPANY_SLUG}`);
        }}
      >
        <Field label={l("companyCode")} htmlFor="companyCode">
          <Input
            id="companyCode"
            name="companyCode"
            icon={Building2}
            placeholder={l("companyCodePlaceholder")}
            autoComplete="organization"
            required
          />
        </Field>
        <Field label={l("email")} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            icon={Mail}
            placeholder={l("emailPlaceholder")}
            autoComplete="email"
            required
          />
        </Field>
        <Field
          label={l("password")}
          htmlFor="password"
          action={
            <a href="#" className="text-xs font-semibold text-primary hover:underline">
              {l("forgot")}
            </a>
          }
        >
          <PasswordInput id="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
        </Field>

        <Button type="submit" size="lg" className="mt-2 h-16 text-lg">
          {l("submit")}
          <Arrow className="size-5" aria-hidden />
        </Button>
        <FormStatus message={status} />
      </form>

      <div className="mt-8 flex flex-col gap-8">
        <Divider label={l("orVia")} />
        <div className="grid grid-cols-2 gap-4">
          {ssoProviders.map((provider) => (
            <Button
              key={provider}
              variant="secondary"
              size="lg"
              className="h-14 font-bold text-on-surface"
              onClick={() => setStatus(l("ssoNotConnected", { provider }))}
            >
              {provider}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
