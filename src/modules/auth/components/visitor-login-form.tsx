"use client";

import { ArrowLeft, ArrowRight, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { clerkEnabled } from "@/lib/clerk";
import { checkInviteCode } from "@/modules/auth/actions";
import { AuthNotConfigured, ClerkSignIn } from "./clerk-auth";
import { QrScanBox } from "./qr-scan-box";

/**
 * Client visitor: 1) the invite code the company gave them (checked against the database),
 * 2) sign in or sign up with Clerk (email code or password). after-sign-in then links them to that
 * client and opens /client-portal.
 */
export function VisitorLoginForm({ badInvite = false }: { badInvite?: boolean }) {
  const t = useTranslations("auth");
  const v = (key: string, values?: Record<string, string | number>) => t(`visitor.${key}`, values);
  const Arrow = useLocale() === "ar" ? ArrowLeft : ArrowRight;
  const [status, setStatus] = useState<string | null>(badInvite ? v("badInvite") : null);
  const [code, setCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!clerkEnabled()) return <AuthNotConfigured />;

  if (code) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-success-container px-4 py-3 text-sm text-success">{v("codeOk")}</p>
        <ClerkSignIn withSignUp signUpPath="/visitor-login" params={{ invite: code }} />
        <button type="button" onClick={() => setCode(null)} className="text-sm font-semibold text-primary hover:underline">
          {v("changeCode")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <QrScanBox onMessage={setStatus} />
      <Divider label={t("common.or")} />

      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const inviteCode = String(new FormData(event.currentTarget).get("invite") ?? "").trim();
          startTransition(async () => {
            const result = await checkInviteCode({ inviteCode });
            if (result.ok) return setCode(result.data.inviteCode);
            setStatus(result.error === "not_found" || result.error === "invalid" ? v("badInvite") : t(`errors.${result.error}`));
          });
        }}
      >
        <Field label={v("invite")} htmlFor="invite">
          <Input id="invite" name="invite" icon={Link2} placeholder={v("invitePlaceholder")} autoComplete="off" required minLength={4} />
        </Field>
        <Button type="submit" size="lg" className="mt-2 h-14 text-base" disabled={pending}>
          {pending ? v("checking") : v("next")}
          <Arrow className="size-5" aria-hidden />
        </Button>
        <FormStatus message={status} />
      </form>
    </div>
  );
}
