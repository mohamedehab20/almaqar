"use client";

import { ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";
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

/**
 * Placeholder with the shape of Clerk's form while its script loads (a few seconds on a cold visit),
 * so the page never shows only the guest button where the email field belongs.
 */
function FormSkeleton({ fields }: { fields: number }) {
  const t = useTranslations("auth.common");
  return (
    <div role="status" aria-busy="true" aria-label={t("loadingForm")} className="flex w-full animate-pulse flex-col gap-5">
      <div className="mx-auto h-6 w-40 rounded-sm bg-surface-container" />
      <div className="mx-auto h-4 w-56 rounded-sm bg-surface-container-low" />
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-3.5 w-24 rounded-sm bg-surface-container" />
          <div className="h-11 rounded-md bg-surface-container-low ring-1 ring-outline-variant/30" />
        </div>
      ))}
      <div className="h-11 rounded-md bg-primary/25" />
      <span className="sr-only">{t("loadingForm")}</span>
    </div>
  );
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
    <>
      <ClerkLoading>
        <FormSkeleton fields={2} />
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn
          routing="hash"
          forceRedirectUrl={after}
          signUpForceRedirectUrl={after}
          signUpUrl={withLocale(signUpPath, locale)}
          withSignUp={withSignUp}
          appearance={appearance}
        />
      </ClerkLoaded>
    </>
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
    <>
      <ClerkLoading>
        <FormSkeleton fields={3} />
      </ClerkLoading>
      <ClerkLoaded>
        <SignUp
          routing="hash"
          forceRedirectUrl={after}
          signInForceRedirectUrl={after}
          signInUrl={withLocale(signInPath, locale)}
          unsafeMetadata={unsafeMetadata}
          initialValues={initialValues}
          appearance={appearance}
        />
      </ClerkLoaded>
    </>
  );
}
