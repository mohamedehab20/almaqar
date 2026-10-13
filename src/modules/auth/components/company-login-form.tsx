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
import { Link, useRouter } from "@/i18n/navigation";
import { signInWithCompanyCode } from "@/modules/auth/actions";
import { useAuthAction } from "@/modules/auth/use-auth-action";

const ssoProviders = ["Google", "Microsoft"] as const;

/** Main login: company code + email + password, with SSO options. */
export function CompanyLoginForm() {
  const t = useTranslations("auth");
  const l = (key: string, values?: Record<string, string>) => t(`login.${key}`, values);
  const Arrow = useLocale() === "ar" ? ArrowLeft : ArrowRight;
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();
  const { submit, pending, message } = useAuthAction(signInWithCompanyCode, ({ slug }) => {
    router.push(`/c/${slug}`);
    router.refresh();
  });

  return (
    <div className="rounded-xl bg-surface-container-lowest p-6 shadow-ambient sm:p-12">
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          submit(
            { companyCode: String(data.get("companyCode") ?? ""), email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") }
          );
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
            <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
              {l("forgot")}
            </Link>
          }
        >
          <PasswordInput id="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
        </Field>

        <Button type="submit" size="lg" className="mt-2 h-16 text-lg" disabled={pending}>
          {pending ? l("working") : l("submit")}
          <Arrow className="size-5" aria-hidden />
        </Button>
        <FormStatus message={message ?? status} />
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
