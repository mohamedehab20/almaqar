"use client";

import {
  Archive,
  ArrowLeftRight,
  Banknote,
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Clock,
  FolderOpen,
  MessagesSquare,
  ReceiptText,
  ShieldUser,
  Timer,
  TrendingUp,
  TriangleAlert,
  UserSearch,
  Users,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

// Reading order (RTL: right → left, row by row), same as the design. `page`: the tool's page under /c/<slug>/hr
const tools: { key: string; icon: LucideIcon; page?: string }[] = [
  { key: "attendance", icon: CalendarCheck },
  { key: "leave", icon: CalendarPlus, page: "leave" },
  { key: "payroll", icon: Banknote },
  { key: "integration", icon: ArrowLeftRight },
  { key: "contracts", icon: ReceiptText },
  { key: "complaints", icon: TriangleAlert },
  { key: "departments", icon: Users },
  { key: "communication", icon: MessagesSquare },
  { key: "schedules", icon: Clock },
  { key: "permissions", icon: ShieldUser },
  { key: "performance", icon: TrendingUp },
  { key: "workHours", icon: Timer },
  { key: "archive", icon: Archive },
  { key: "recruitment", icon: UserSearch },
  { key: "employeeFiles", icon: FolderOpen },
  { key: "knowledgeBase", icon: BookOpen },
  { key: "offboarding", icon: UserX },
];

/** HR home: a launcher grid of HR tools (open ones link to their page, the rest say "soon"). `children` (e.g. the employees panel) go above the grid. */
export function HrHome({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("hr");
  const { companySlug } = useParams<{ companySlug: string }>();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 p-4 sm:p-10">
        <header>
          <h2 className="text-3xl font-black sm:text-4xl">{t("title")}</h2>
          <p className="mt-2 text-lg text-on-surface-variant">{t("subtitle")}</p>
        </header>

        {children}

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {tools.map(({ key, icon: Icon, page }) => {
            const body = (
              <>
                <span className="grid size-16 place-items-center rounded-lg bg-surface-container-lowest text-primary shadow-ambient transition group-hover:bg-primary-fixed">
                  <Icon className="size-7" aria-hidden />
                </span>
                <span className="text-base font-bold leading-snug sm:text-lg">{t(`tools.${key}`)}</span>
              </>
            );
            const tile =
              "group flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-xl bg-surface-container-low p-4 text-center transition hover:-translate-y-1 hover:bg-surface-container-lowest hover:shadow-ambient-lg";
            return (
              <li key={key}>
                {page ? (
                  <Link href={`/c/${companySlug}/hr/${page}`} className={tile}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" onClick={() => setNotice(t("comingSoon", { name: t(`tools.${key}`) }))} className={tile}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {notice && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
