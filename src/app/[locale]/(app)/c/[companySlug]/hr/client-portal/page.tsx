import { redirect } from "@/i18n/navigation";

/** «بوابة العملاء» moved out of HR into its own room in the sidebar. */
export default async function OldClientPortalPage({ params }: PageProps<"/[locale]/c/[companySlug]/hr/client-portal">) {
  const { locale, companySlug } = await params;
  redirect({ href: `/c/${companySlug}/clients`, locale });
}
