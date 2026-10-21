import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { JoinForm } from "@/modules/auth/components/account-forms";
import { AuthSplitLayout } from "@/modules/auth/components/auth-split-layout";
import { NoCompany } from "@/modules/auth/components/no-company";
import { homeSlug } from "@/modules/auth/session";
import { getClaims } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/[locale]/join">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.join" });
  return { title: t("metaTitle") };
}

/**
 * Not signed in: an invited employee creates their account. Signed in: invites are linked and their company
 * opens; with no company yet, they create one or wait for an invite (never the demo company).
 */
export default async function JoinPage({ params, searchParams }: PageProps<"/[locale]/join">) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.employee" });
  const layout = (children: React.ReactNode) => (
    <AuthSplitLayout image="/landing/employee.jpg" panelTitle={t("panelTitle")} panelText={t("panelText")}>
      {children}
    </AuthSplitLayout>
  );

  if (await getClaims()) {
    const slug = await homeSlug();
    if (slug) redirect({ href: `/c/${slug}`, locale });
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    const name = user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    return layout(<NoCompany email={email} name={name} />);
  }
  return layout(<JoinForm noInvite={status === "no-invite"} />);
}
