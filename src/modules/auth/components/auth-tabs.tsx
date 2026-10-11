import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Segmented control switching between /login and /signup. */
export function AuthTabs({ active }: { active: "login" | "signup" }) {
  const t = useTranslations("auth.login");
  const tabs = [
    { key: "login", href: "/login", label: t("tabLogin") },
    { key: "signup", href: "/signup", label: t("tabSignup") },
  ] as const;

  return (
    <nav className="grid grid-cols-2 gap-1 rounded-lg bg-surface-container p-1 shadow-ambient">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "rounded-md py-3 text-center text-sm font-semibold transition-colors",
            tab.key === active
              ? "bg-surface-container-lowest text-primary shadow-ambient"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
