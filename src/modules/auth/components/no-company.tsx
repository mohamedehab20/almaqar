"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Building2, LogOut, MailCheck, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { createMyCompany } from "../actions";

/**
 * Signed in, but no company yet. Two real ways forward: create your own company (saved, you become its
 * owner) or wait for your manager to add your email, then check again. No demo data here.
 */
export function NoCompany({ email, name }: { email: string; name: string }) {
  const t = useTranslations("auth.noCompany");
  const tErr = useTranslations("auth.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checking, startChecking] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-surface-container-lowest p-6 shadow-ambient sm:p-10">
      <div>
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{t("intro", { email })}</p>
      </div>

      <form
        className="flex flex-col gap-4 rounded-lg bg-surface-container-low p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const company = String(data.get("company") ?? "").trim();
          const ownerName = String(data.get("ownerName") ?? "").trim();
          startTransition(async () => {
            const res = await createMyCompany({ name: company, ownerName });
            if (!res.ok) return setStatus(res.error === "invalid" ? t("invalid") : tErr(res.error));
            router.push(`/c/${res.data.slug}`);
          });
        }}
      >
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Building2 className="size-5 text-primary" aria-hidden />
          {t("createTitle")}
        </h2>
        <p className="text-sm text-on-surface-variant">{t("createIntro")}</p>
        <Field label={t("company")} htmlFor="nc-company">
          <Input id="nc-company" name="company" required minLength={2} maxLength={80} placeholder={t("companyPlaceholder")} />
        </Field>
        <Field label={t("ownerName")} htmlFor="nc-owner">
          <Input id="nc-owner" name="ownerName" required minLength={2} maxLength={80} defaultValue={name} />
        </Field>
        <Button type="submit" size="lg" disabled={pending} className="h-12">
          {pending ? t("creating") : t("create")}
        </Button>
        <FormStatus message={status} />
      </form>

      <div className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <MailCheck className="size-5 text-primary" aria-hidden />
          {t("inviteTitle")}
        </h2>
        <p className="text-sm text-on-surface-variant">{t("inviteIntro", { email })}</p>
        <Button type="button" variant="secondary" disabled={checking} onClick={() => startChecking(() => router.refresh())} className="h-11 w-fit">
          <RefreshCw className="size-4" aria-hidden />
          {checking ? t("checking") : t("checkAgain")}
        </Button>
      </div>

      <SignOutButton redirectUrl="/login">
        <button type="button" className="flex w-fit items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-danger">
          <LogOut className="size-4" aria-hidden />
          {t("signOut")}
        </button>
      </SignOutButton>
    </div>
  );
}
