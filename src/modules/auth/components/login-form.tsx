"use client";

import { Building2, IdCard, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DEMO_COMPANY_SLUG } from "@/modules/hq/mock";

/** Employee portal login: company code + email/employee ID + password. */
export function LoginForm() {
  const t = useTranslations("auth");
  const e = (key: string) => t(`employee.${key}`);
  const router = useRouter();

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-ambient">
      <div className="p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold">{e("title")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{e("intro")}</p>

        <form
          // Frontend-only phase: skip browser validation so the next page can be previewed with empty fields
          noValidate
          className="mt-8 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            // TODO(backend): sign in with Supabase Auth, then open the employee's company
            router.push(`/c/${DEMO_COMPANY_SLUG}`);
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
              icon={IdCard}
              placeholder={e("identifierPlaceholder")}
              autoComplete="username"
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
            <a href="#" className="font-semibold text-primary hover:underline">
              {e("forgot")}
            </a>
          </div>

          <Button type="submit" size="lg" className="h-14 text-base">
            {e("submit")}
          </Button>
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
        <a href="#" className="font-bold text-primary hover:underline">
          {e("joinCompany")}
        </a>
      </div>
    </div>
  );
}
