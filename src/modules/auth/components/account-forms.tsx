"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { clerkEnabled } from "@/lib/clerk";
import { AuthNotConfigured, ClerkSignUp } from "./clerk-auth";

const card = "rounded-xl bg-surface-container-lowest p-6 shadow-ambient sm:p-10";

/**
 * Invited employee creates their account (Clerk) with the email they were added with; after-sign-in
 * links the invite and opens their company. ?status=no-invite: signed up, but nobody invited that email yet.
 */
export function JoinForm({ noInvite = false }: { noInvite?: boolean }) {
  const t = useTranslations("auth.join");

  return (
    <div className={card}>
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-sm text-on-surface-variant">{t("intro")}</p>
      {noInvite && <p className="mt-4 rounded-md bg-tertiary-fixed px-4 py-3 text-sm text-tertiary">{t("noInvite")}</p>}
      <div className="mt-6">{clerkEnabled() ? <ClerkSignUp signInPath="/employee-login" /> : <AuthNotConfigured />}</div>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        {t("haveAccount")}{" "}
        <Link href="/employee-login" className="font-bold text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
