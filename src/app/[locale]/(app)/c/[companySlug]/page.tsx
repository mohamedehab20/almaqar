import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSignedInCompany } from "@/modules/hq/queries";
import { OfficeDesigner } from "@/modules/office-designer/components/office-designer";

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[companySlug]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hq" });
  return { title: t("title") };
}

/** The company's home: the office design (the signed-in company's own; the guest demo keeps it in the browser). */
export default async function OfficeDesignPage({ params }: PageProps<"/[locale]/c/[companySlug]">) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);
  const current = await getSignedInCompany(companySlug);
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
      <OfficeDesigner companyId={current?.company.id ?? null} />
    </div>
  );
}
