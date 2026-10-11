import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SalesView } from "@/modules/sales/components/sales-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/sales">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sales" });
  return { title: t("navTitle") };
}

export default async function SalesPage({ params }: PageProps<"/[locale]/c/[companySlug]/sales">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SalesView />;
}
