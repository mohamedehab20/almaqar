"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { AFTER_AUTH_URL } from "@/lib/clerk";

/** Clerk's card blends into our own card: no second shadow or border, full width. */
const appearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0",
    card: "w-full shadow-none border-0 bg-transparent px-0",
  },
};

const withLocale = (path: string, locale: string) => (locale === "ar" ? path : `/en${path}`);

/** Where Clerk returns after auth: the after-sign-in route, with the page language and any extra params. */
export function useAfterAuthUrl(params: Record<string, string> = {}) {
  const locale = useLocale();
  return `${AFTER_AUTH_URL}?${new URLSearchParams({ locale, ...params })}`;
}

/** Shown instead of the forms when the server has no Clerk keys (nothing would be saved). */
export function AuthNotConfigured() {
  const t = useTranslations("auth.errors");
  return <p className="rounded-md bg-primary-fixed/50 px-4 py-3 text-sm text-primary">{t("not_configured")}</p>;
}

/** Email + password sign-in (with Clerk's own "forgot password" and verification steps). */
export function ClerkSignIn({ signUpPath = "/signup", params, withSignUp }: { signUpPath?: string; params?: Record<string, string>; withSignUp?: boolean }) {
  const locale = useLocale();
  const after = useAfterAuthUrl(params);
  return (
    <SignIn
      routing="hash"
      forceRedirectUrl={after}
      signUpForceRedirectUrl={after}
      signUpUrl={withLocale(signUpPath, locale)}
      withSignUp={withSignUp}
      appearance={appearance}
    />
  );
}

/** Account creation. `unsafeMetadata` carries the new owner's company until after-sign-in creates it. */
export function ClerkSignUp({
  signInPath = "/login",
  unsafeMetadata,
  initialValues,
}: {
  signInPath?: string;
  unsafeMetadata?: Record<string, unknown>;
  initialValues?: { firstName?: string; lastName?: string; emailAddress?: string };
}) {
  const locale = useLocale();
  const after = useAfterAuthUrl();
  return (
    <SignUp
      routing="hash"
      forceRedirectUrl={after}
      signInForceRedirectUrl={after}
      signInUrl={withLocale(signInPath, locale)}
      unsafeMetadata={unsafeMetadata}
      initialValues={initialValues}
      appearance={appearance}
    />
  );
}
