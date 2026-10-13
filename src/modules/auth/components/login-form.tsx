"use client";

import { Building2, IdCard, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormStatus } from "@/components/ui/form-status";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { signInWithCompanyCode } from "@/modules/auth/actions";
import { useAuthAction } from "@/modules/auth/use-auth-action";
import { DEMO_COMPANY_SLUG } from "@/modules/hq/mock";

/** Employee portal login: company code + email/employee ID + password. */
export function LoginForm() {
  const t = useTranslations("auth");
  const e = (key: string) => t(`employee.${key}`);
  const router = useRouter();
  const { submit, pending, message } = useAuthAction(signInWithCompanyCode, ({ slug }) => {
    router.push(`/c/${slug}`);
    router.refresh();
  });

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-ambient">
      <div className="p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold">{e("title")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{e("intro")}</p>

        <form
          className="mt-8 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            submit(
              { companyCode: String(data.get("companyCode") ?? ""), email: String(data.get("identifier") ?? ""), password: String(data.get("password") ?? "") },
              // No Supabase on this server (e.g. a preview deploy): keep the demo reachable
              (code) => code === "not_configured" && (router.push(`/c/${DEMO_COMPANY_SLUG}`), true),
            );
          }}
        >
          <Field label={e("companyCode")} htmlFor="companyCode">
            <Input
              id="companyCode"
              name="companyCode"
              icon={Building2}
              placeholder={e("companyCodePlaceholder")}
              autoComplete="organization"
              required
            />
          </Field>
          <Field label={e("identifier")} htmlFor="identifier">
            <Input
              id="identifier"
              name="identifier"
              type="email"
              icon={IdCard}
              placeholder={e("identifierPlaceholder")}
              autoComplete="email"
              required
            />
          </Field>
          <Field label={e("password")} htmlFor="password">
            <PasswordInput id="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
          </Field>

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="remember" className="size-4 accent-primary-container" />
              {e("remember")}
            </label>
            <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
              {e("forgot")}
            </Link>
          </div>

          <Button type="submit" size="lg" className="h-14 text-base" disabled={pending}>
            {pending ? e("working") : e("submit")}
          </Button>
          <FormStatus message={message} />
        </form>

        <div className="mt-6 flex flex-col gap-6">
          <Divider label={t("common.or")} />
          <Link
            href="/visitor-login"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-13 text-on-surface")}
          >
            <span className="grid size-7 place-items-center rounded-sm bg-secondary-container text-on-primary">
              <UserRound className="size-4" aria-hidden />
            </span>
            {e("visitorLogin")}
          </Link>
        </div>
      </div>

      <div className="rounded-b-xl bg-surface-container-low px-6 py-5 text-center text-sm text-on-surface-variant">
        {e("noAccount")}{" "}
        <Link href="/join" className="font-bold text-primary hover:underline">
          {e("joinCompany")}
        </Link>
      </div>
    </div>
  );
}
