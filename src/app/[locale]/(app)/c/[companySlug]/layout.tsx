import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "@/i18n/navigation";
import { currentUserId, demoCompany, members } from "@/modules/hq/mock";
import { getSignedInCompany } from "@/modules/hq/queries";
import { getRoomAccess } from "@/modules/permissions/queries";

export default async function CompanyLayout({ children, params }: LayoutProps<"/[locale]/c/[companySlug]">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const lang = locale as "ar" | "en";

  // Signed in and a member: the real company
  const current = await getSignedInCompany(companySlug);
  if (current) {
    const access = await getRoomAccess(companySlug);
    return (
      <AppShell companySlug={companySlug} userName={current.me.name[lang] || current.me.name.ar || current.me.name.en} signedIn access={access}>
        {children}
      </AppShell>
    );
  }

  // Otherwise only the public demo is open (its screens still use mock data)
  if (companySlug !== demoCompany.slug) {
    if (current === null) notFound(); // signed in, but not a member of this company
    redirect({ href: "/login", locale });
  }
  const user = members.find((m) => m.id === currentUserId)!;
  return (
    <AppShell companySlug={companySlug} userName={user.name[lang]}>
      {children}
    </AppShell>
  );
}
