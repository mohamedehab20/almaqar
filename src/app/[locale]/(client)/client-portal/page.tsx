import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientHome } from "@/modules/marketing/components/client-home";

export async function generateMetadata({ params }: PageProps<"/[locale]/client-portal">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clientPortal" });
  return { title: t("badge") };
}

export default async function ClientPortalPage({ params }: PageProps<"/[locale]/client-portal">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ClientHome />;
}
