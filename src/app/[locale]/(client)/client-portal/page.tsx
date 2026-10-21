import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientHome } from "@/modules/marketing/components/client-home";
import { getMyClients, listClientBriefs } from "@/modules/marketing/queries";
import { getClaims } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/[locale]/client-portal">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clientPortal" });
  return { title: t("badge") };
}

/**
 * The client's portal. A signed-in client user (linked by their invite code) sees their own client and
 * briefs, saved for real; anyone else sees the demo client.
 */
export default async function ClientPortalPage({ params }: PageProps<"/[locale]/client-portal">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [client] = (await getClaims()) ? await getMyClients() : [];
  if (!client) return <ClientHome />;
  const briefs = await listClientBriefs(client.id);
  return <ClientHome real={{ client: { id: client.id, name: client.name }, briefs }} />;
}
