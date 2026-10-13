import { redirect } from "@/i18n/navigation";

/** Coming soon: src/proxy.ts sends this URL back to the main hall; this is the fallback if it is reached anyway. */
export default async function RoomLayout({ params }: LayoutProps<"/[locale]/c/[companySlug]/agents">) {
  const { locale, companySlug } = await params;
  redirect({ href: `/c/${companySlug}`, locale });
}
