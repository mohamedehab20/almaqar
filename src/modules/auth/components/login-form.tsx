"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Link } from "@/i18n/navigation";
import { clerkEnabled } from "@/lib/clerk";
import { cn } from "@/lib/utils";
import { AuthNotConfigured, ClerkSignIn } from "./clerk-auth";

/** Employee portal login: Clerk sign-in; new employees activate their account from "Join your company". */
export function LoginForm() {
  const t = useTranslations("auth");
  const e = (key: string) => t(`employee.${key}`);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-ambient">
      <div className="p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold">{e("title")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{e("intro")}</p>

        <div className="mt-6">{clerkEnabled() ? <ClerkSignIn signUpPath="/join" /> : <AuthNotConfigured />}</div>

        <div className="mt-6 flex flex-col gap-6">
          <Divider label={t("common.or")} />
          <Link
            href="/visitor-login"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-13 text-on-surface")}
          >
            <span className="grid size-7 place-items-center rounded-sm bg-secondary-container text-on-primary">
              <UserRound className="size-4" aria-hidden />
            </span>
            {e("visitorLogin")}
          </Link>
        </div>
      </div>

      <div className="rounded-b-xl bg-surface-container-low px-6 py-5 text-center text-sm text-on-surface-variant">
        {e("noAccount")}{" "}
        <Link href="/join" className="font-bold text-primary hover:underline">
          {e("joinCompany")}
        </Link>
      </div>
    </div>
  );
}
