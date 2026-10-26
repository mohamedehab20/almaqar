import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { homeSlug } from "@/modules/auth/session";
import { getMyPortal } from "@/modules/clients/queries";
import { ClientHome } from "@/modules/marketing/components/client-home";
import { getClaims } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/[locale]/client-portal">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clientPortal" });
  return { title: t("badge") };
}

/**
 * The client's portal. A signed-in client user (linked by their invite code) sees their own client and only
 * the parts the company allows (requests, invoices, meetings, files). Signed in without a client: their company
 * or /join. Not signed in: the demo client.
 */
export default async function ClientPortalPage({ params }: PageProps<"/[locale]/client-portal">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const now = new Date().toISOString();
  if (!(await getClaims())) return <ClientHome now={now} />;
  const portal = await getMyPortal();
  if (!portal) {
    const slug = await homeSlug();
    redirect({ href: slug ? `/c/${slug}` : "/join", locale });
  }
  return <ClientHome now={now} real={portal!} />;
}
