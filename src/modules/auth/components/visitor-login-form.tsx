"use client";

import { ArrowLeft, ArrowRight, Link2, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useRouter } from "@/i18n/navigation";
import { QrScanBox } from "./qr-scan-box";

export function VisitorLoginForm() {
  const t = useTranslations("auth");
  const v = (key: string, values?: Record<string, string | number>) => t(`visitor.${key}`, values);
  const Arrow = useLocale() === "ar" ? ArrowLeft : ArrowRight;
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <QrScanBox onMessage={setStatus} />
      <Divider label={t("common.or")} />

      <form
        // Frontend-only phase: skip browser validation so the next page can be previewed with empty fields
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          // TODO(backend): verify invite code + OTP, then open this client's portal
          router.push("/client-portal");
        }}
      >
        <Field label={v("invite")} htmlFor="invite">
          <Input id="invite" name="invite" icon={Link2} placeholder={v("invitePlaceholder")} autoComplete="off" />
        </Field>
        <Field label={v("phone")} htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            icon={Smartphone}
            placeholder={v("phonePlaceholder")}
            autoComplete="tel"
          />
        </Field>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{v("otp")}</span>
            <button
              type="button"
              onClick={() => setStatus(v("resendNotConnected"))}
              className="font-semibold text-primary hover:underline"
            >
              {v("resend")}
            </button>
          </div>
          <OtpInput name="otp" label={v("otp")} digitLabel={(index) => v("otpDigit", { index })} />
        </div>

        <Button type="submit" size="lg" className="mt-2 h-14 text-base">
          {v("submit")}
          <Arrow className="size-5" aria-hidden />
        </Button>
        <FormStatus message={status} />
      </form>
    </div>
  );
}
