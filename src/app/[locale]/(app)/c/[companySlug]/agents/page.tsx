import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AgentsView } from "@/modules/agents/components/agents-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/agents">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agents" });
  return { title: t("navTitle") };
}

export default async function AgentsPage({ params }: PageProps<"/[locale]/c/[companySlug]/agents">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AgentsView />;
}
