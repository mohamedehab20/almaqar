"use client";

import { Mail, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormStatus } from "@/components/ui/form-status";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Link, useRouter } from "@/i18n/navigation";
import { requestPasswordReset, signUpEmployee, updatePassword } from "@/modules/auth/actions";
import { useAuthAction } from "@/modules/auth/use-auth-action";

const card = "rounded-xl bg-surface-container-lowest p-6 shadow-ambient sm:p-10";

/** Invited employee creates a password with the email they were added with, then lands in their company. */
export function JoinForm() {
  const t = useTranslations("auth.join");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const { submit, pending, message } = useAuthAction(signUpEmployee, (result, say) => {
    if (result.needsEmailConfirmation) return say(t("checkEmail", { email }));
    if (result.noInvite || !result.slug) return say(t("noInvite"));
    router.push(`/c/${result.slug}`);
    router.refresh();
  });

  return (
    <div className={card}>
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-sm text-on-surface-variant">{t("intro")}</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const value = (name: string) => String(data.get(name) ?? "").trim();
          setEmail(value("email"));
          submit({ fullName: value("fullName"), email: value("email"), password: String(data.get("password") ?? "") });
        }}
      >
        <Field label={t("fullName")} htmlFor="fullName">
          <Input id="fullName" name="fullName" icon={UserRound} placeholder={t("fullNamePlaceholder")} autoComplete="name" required />
        </Field>
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" icon={Mail} placeholder="name@company.com" autoComplete="email" required />
        </Field>
        <Field label={t("password")} htmlFor="password" hint={t("passwordHint")}>
          <PasswordInput id="password" name="password" placeholder="••••••••" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" size="lg" className="h-14 text-base" disabled={pending}>
          {pending ? t("working") : t("submit")}
        </Button>
        <FormStatus message={message} />
      </form>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        {t("haveAccount")}{" "}
        <Link href="/employee-login" className="font-bold text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}

/** "Forgot password": always answers the same, so it never reveals which emails have accounts. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const { submit, pending, message } = useAuthAction(requestPasswordReset, (_, say) => say(t("sent")));

  return (
    <div className={card}>
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-sm text-on-surface-variant">{t("intro")}</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit({ email: String(new FormData(event.currentTarget).get("email") ?? "").trim() });
        }}
      >
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" icon={Mail} placeholder="name@company.com" autoComplete="email" required />
        </Field>
        <Button type="submit" size="lg" className="h-14 text-base" disabled={pending}>
          {pending ? t("working") : t("submit")}
        </Button>
        <FormStatus message={message} />
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}

/** Reached from the reset email (via /api/auth/confirm, which signed the user in). */
export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const router = useRouter();
  const { submit, pending, message, setMessage } = useAuthAction(updatePassword, (_, say) => {
    say(t("done"));
    setTimeout(() => router.push("/login"), 1500);
  });

  return (
    <div className={card}>
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-sm text-on-surface-variant">{t("intro")}</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const password = String(data.get("password") ?? "");
          if (password !== String(data.get("confirm") ?? "")) return setMessage(t("mismatch"));
          // No session means the link expired or was opened in another browser
          submit({ password }, (code) => code === "unauthorized" && (setMessage(t("expired")), true));
        }}
      >
        <Field label={t("password")} htmlFor="password">
          <PasswordInput id="password" name="password" placeholder="••••••••" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label={t("confirm")} htmlFor="confirm">
          <PasswordInput id="confirm" name="confirm" placeholder="••••••••" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" size="lg" className="h-14 text-base" disabled={pending}>
          {pending ? t("working") : t("submit")}
        </Button>
        <FormStatus message={message} />
      </form>
    </div>
  );
}
