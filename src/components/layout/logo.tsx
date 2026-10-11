import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-bold text-primary", className)}>
      <span className="grid size-7 place-items-center rounded-sm bg-brand-gradient text-on-primary">
        <Building2 className="size-4" aria-hidden />
      </span>
      <span className="text-base">{t("brand")}</span>
    </Link>
  );
}
