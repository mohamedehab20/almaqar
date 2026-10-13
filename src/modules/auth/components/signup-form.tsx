"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { clerkEnabled } from "@/lib/clerk";
import { AuthNotConfigured, ClerkSignUp } from "./clerk-auth";

const businessTypes = ["startup", "agency", "training", "consulting", "services", "other"] as const;
const sizes = ["1-10", "11-50", "51-200", "200+"] as const;

type CompanyDetails = { firstName: string; lastName: string; company: string; businessType: string; size: string };

/**
 * New owner, two steps: 1) your name and the company (our form), 2) the account itself (Clerk: email,
 * password, verification). The company rides along in Clerk unsafeMetadata and is created by
 * /api/auth/after-sign-in, which then opens it.
 */
export function SignupForm() {
  const t = useTranslations("auth.signup");
  const Back = useLocale() === "ar" ? ArrowRight : ArrowLeft;
  const [details, setDetails] = useState<CompanyDetails | null>(null);

  if (details) {
    return (
      <section className="px-6 py-10 sm:px-12 sm:py-14">
        <h1 className="text-3xl font-extrabold">{t("step2")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{t("step2Intro", { company: details.company })}</p>
        <div className="mt-6">
          <ClerkSignUp
            signInPath="/login"
            initialValues={{ firstName: details.firstName, lastName: details.lastName }}
            unsafeMetadata={{
              pending_company: {
                name: details.company,
                businessType: details.businessType,
                size: details.size,
                ownerName: `${details.firstName} ${details.lastName}`.trim(),
              },
            }}
          />
        </div>
        <button type="button" onClick={() => setDetails(null)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <Back className="size-4" aria-hidden />
          {t("back")}
        </button>
      </section>
    );
  }

  return (
    <section className="px-6 py-10 sm:px-12 sm:py-14">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-sm text-on-surface-variant">{t("subtitle")}</p>

      {!clerkEnabled() ? (
        <div className="mt-8">
          <AuthNotConfigured />
        </div>
      ) : (
        <form
          className="mt-8 grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const value = (name: string) => String(data.get(name) ?? "").trim();
            setDetails({
              firstName: value("firstName"),
              lastName: value("lastName"),
              company: value("company"),
              businessType: value("businessType"),
              size: value("size"),
            });
          }}
        >
          <Field label={t("firstName")} htmlFor="firstName">
            <Input id="firstName" name="firstName" placeholder={t("firstNamePlaceholder")} autoComplete="given-name" required />
          </Field>
          <Field label={t("lastName")} htmlFor="lastName">
            <Input id="lastName" name="lastName" placeholder={t("lastNamePlaceholder")} autoComplete="family-name" required />
          </Field>
          <Field label={t("company")} htmlFor="company" className="sm:col-span-2">
            <Input id="company" name="company" placeholder={t("companyPlaceholder")} autoComplete="organization" required minLength={2} />
          </Field>
          <Field label={t("businessType")} htmlFor="businessType">
            <Select id="businessType" name="businessType" placeholder={t("businessTypePlaceholder")} required>
              {businessTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`businessTypes.${type}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("size")} htmlFor="size">
            <Select id="size" name="size" placeholder={t("sizePlaceholder")} required>
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {t(`sizes.${size}`)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-4 sm:col-span-2">
            <Button type="submit" size="lg" className="mt-2 h-14 text-base">
              {t("continue")}
            </Button>
            <p className="text-center text-sm text-on-surface-variant">
              {t("haveAccount")}{" "}
              <Link href="/login" className="font-bold text-primary hover:underline">
                {t("login")}
              </Link>
            </p>
          </div>
        </form>
      )}
    </section>
  );
}
