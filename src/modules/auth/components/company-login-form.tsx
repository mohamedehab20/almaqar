"use client";

import { clerkEnabled } from "@/lib/clerk";
import { AuthNotConfigured, ClerkSignIn } from "./clerk-auth";

/** Main login: Clerk sign-in (email + password, forgot password, verification) inside our card. */
export function CompanyLoginForm() {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-6 shadow-ambient sm:p-10">
      {clerkEnabled() ? <ClerkSignIn signUpPath="/signup" /> : <AuthNotConfigured />}
    </div>
  );
}
