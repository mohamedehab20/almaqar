import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSignedInCompany } from "@/modules/hq/queries";
import { RecruitmentView } from "@/modules/recruitment/components/recruitment-view";
import { demoRecruitmentData } from "@/modules/recruitment/demo";
import { getRecruitmentData } from "@/modules/recruitment/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]/hr/recruitment">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recruitment" });
  return { title: t("title") };
}

/** HR → «التوظيف»: jobs, candidates through the stages, interviews and hiring; referrals for everyone else. */
export default async function RecruitmentPage({ params }: PageProps<"/[locale]/c/[companySlug]/hr/recruitment">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  if (!current) return <RecruitmentView data={demoRecruitmentData(undefined, locale === "en" ? "en" : "ar")} companyId={null} companySlug={companySlug} />;
  return <RecruitmentView data={await getRecruitmentData(current.company.id)} companyId={current.company.id} companySlug={companySlug} />;
}
