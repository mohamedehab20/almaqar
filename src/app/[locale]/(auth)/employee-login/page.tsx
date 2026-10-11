import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { AuthSplitLayout } from "@/modules/auth/components/auth-split-layout";
import { LoginForm } from "@/modules/auth/components/login-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/employee-login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.employee" });
  return { title: t("metaTitle") };
}

export default function EmployeeLoginPage({ params }: PageProps<"/[locale]/employee-login">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("auth.employee");

  return (
    <AuthSplitLayout image="/landing/employee.jpg" panelTitle={t("panelTitle")} panelText={t("panelText")}>
      <LoginForm />
    </AuthSplitLayout>
  );
}
