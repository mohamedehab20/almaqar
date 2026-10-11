import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { currentUserId, demoCompany, members } from "@/modules/hq/mock";

export default async function CompanyLayout({ children, params }: LayoutProps<"/[locale]/c/[companySlug]">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);

  // TODO(backend): load the company + membership for the signed-in user instead of the demo data
  if (companySlug !== demoCompany.slug) notFound();

  const lang = locale as "ar" | "en";
  const user = members.find((m) => m.id === currentUserId)!;

  return (
    <AppShell companySlug={companySlug} userName={user.name[lang]}>
      {children}
    </AppShell>
  );
}
