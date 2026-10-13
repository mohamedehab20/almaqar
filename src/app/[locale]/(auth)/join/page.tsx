import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { JoinForm } from "@/modules/auth/components/account-forms";
import { AuthSplitLayout } from "@/modules/auth/components/auth-split-layout";

export async function generateMetadata({ params }: PageProps<"/[locale]/join">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.join" });
  return { title: t("metaTitle") };
}

export default function JoinPage({ params }: PageProps<"/[locale]/join">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("auth.employee");

  return (
    <AuthSplitLayout image="/landing/employee.jpg" panelTitle={t("panelTitle")} panelText={t("panelText")}>
      <JoinForm />
    </AuthSplitLayout>
  );
}
