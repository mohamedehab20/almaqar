import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OperationsView } from "@/modules/operations/components/operations-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/operations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ops" });
  return { title: t("navTitle") };
}

export default async function OperationsPage({ params }: PageProps<"/[locale]/c/[companySlug]/operations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OperationsView />;
}
