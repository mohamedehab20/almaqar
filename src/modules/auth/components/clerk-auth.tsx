"use client";

import { ClerkFailed, SignIn, SignUp } from "@clerk/nextjs";
import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
 * Placeholder with the shape of Clerk's form. Clerk loads in three steps after the page (its script,
 * the account settings, then the form's own code), which can take several seconds on a first visit.
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

/**
 * Shows the skeleton until Clerk's form has really drawn its first field (not just until Clerk's script is
 * ready: the form's own code loads after that), so the page never shows only the guest button.
 */
function FormGate({ fields, children }: { fields: number; children: React.ReactNode }) {
  const t = useTranslations("auth.common");
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => {
      if (el.querySelector("input, button")) setReady(true);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      {!ready && <FormSkeleton fields={fields} />}
      {/* Mounted from the start so Clerk can draw into it; invisible until its first field exists */}
      <div ref={box} className={ready ? undefined : "pointer-events-none absolute inset-x-0 top-0 opacity-0"} aria-hidden={!ready}>
        {children}
      </div>
      <ClerkFailed>
        <p className="mt-4 flex items-center justify-between gap-3 rounded-md bg-danger-container/60 px-4 py-3 text-sm text-danger">
          {t("formFailed")}
          <button type="button" onClick={() => window.location.reload()} className="flex shrink-0 items-center gap-1 font-bold underline-offset-4 hover:underline">
            <RefreshCw className="size-4" aria-hidden />
            {t("reload")}
          </button>
        </p>
      </ClerkFailed>
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
    <FormGate fields={2}>
      <SignIn
        routing="hash"
        forceRedirectUrl={after}
        signUpForceRedirectUrl={after}
        signUpUrl={withLocale(signUpPath, locale)}
        withSignUp={withSignUp}
        appearance={appearance}
      />
    </FormGate>
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
    <FormGate fields={3}>
      <SignUp
        routing="hash"
        forceRedirectUrl={after}
        signInForceRedirectUrl={after}
        signInUrl={withLocale(signInPath, locale)}
        unsafeMetadata={unsafeMetadata}
        initialValues={initialValues}
        appearance={appearance}
      />
    </FormGate>
  );
}
