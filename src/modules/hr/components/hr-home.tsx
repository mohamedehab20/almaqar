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
  Timer,
  TrendingUp,
  TriangleAlert,
  UserCog,
  UserSearch,
  Users,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Tools with their own page under /c/<slug>/hr, shown first (reading order: right → left in Arabic). */
const ready: { key: string; icon: LucideIcon; page: string }[] = [
  { key: "employees", icon: UserCog, page: "employees" },
  { key: "leave", icon: CalendarPlus, page: "leave" },
  { key: "workHours", icon: Timer, page: "work-hours" },
  { key: "departments", icon: Users, page: "departments" },
  { key: "recruitment", icon: UserSearch, page: "recruitment" },
];

/** Tools still to come: marked «قريباً». Permissions live in the sidebar («الصلاحيات»), not here. */
const soon: { key: string; icon: LucideIcon }[] = [
  { key: "attendance", icon: CalendarCheck },
  { key: "payroll", icon: Banknote },
  { key: "integration", icon: ArrowLeftRight },
  { key: "contracts", icon: ReceiptText },
  { key: "complaints", icon: TriangleAlert },
  { key: "communication", icon: MessagesSquare },
  { key: "schedules", icon: Clock },
  { key: "performance", icon: TrendingUp },
  { key: "archive", icon: Archive },
  { key: "employeeFiles", icon: FolderOpen },
  { key: "knowledgeBase", icon: BookOpen },
  { key: "offboarding", icon: UserX },
];

const tile =
  "group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-xl bg-surface-container-low p-4 text-center transition";

/** HR home: a launcher grid of HR tools. The ones that work open their page; the rest say "soon". */
export function HrHome() {
  const t = useTranslations("hr");
  const { companySlug } = useParams<{ companySlug: string }>();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const body = (key: string, Icon: LucideIcon) => (
    <>
      <span className="grid size-16 place-items-center rounded-lg bg-surface-container-lowest text-primary shadow-ambient transition group-hover:bg-primary-fixed">
        <Icon className="size-7" aria-hidden />
      </span>
      <span className="text-base font-bold leading-snug sm:text-lg">{t(`tools.${key}`)}</span>
    </>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 p-4 sm:p-10">
        <header>
          <h2 className="text-3xl font-black sm:text-4xl">{t("title")}</h2>
          <p className="mt-2 text-lg text-on-surface-variant">{t("subtitle")}</p>
        </header>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {ready.map(({ key, icon, page }) => (
            <li key={key}>
              <Link href={`/c/${companySlug}/hr/${page}`} className={cn(tile, "hover:-translate-y-1 hover:bg-surface-container-lowest hover:shadow-ambient-lg")}>
                {body(key, icon)}
              </Link>
            </li>
          ))}
          {soon.map(({ key, icon }) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => setNotice(t("comingSoon", { name: t(`tools.${key}`) }))}
                className={cn(tile, "opacity-60 hover:opacity-80")}
              >
                <span className="absolute end-3 top-3 rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-bold text-on-secondary-container">{t("soon")}</span>
                {body(key, icon)}
              </button>
            </li>
          ))}
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
