"use client";

import { clerkEnabled } from "@/lib/clerk";
import { AuthNotConfigured, ClerkSignIn } from "./clerk-auth";
import { GuestButton } from "./guest-button";

/** Main login: Clerk sign-in (email + password, forgot password, verification) inside our card. `next`: page to return to. */
export function CompanyLoginForm({ next }: { next?: string }) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-6 shadow-ambient sm:p-10">
      {clerkEnabled() ? <ClerkSignIn signUpPath="/signup" params={next ? { next } : undefined} /> : <AuthNotConfigured />}
      <div className="mt-6">
        <GuestButton />
      </div>
    </div>
  );
}
