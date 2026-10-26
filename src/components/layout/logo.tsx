import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  const t = useTranslations("common");
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-bold text-primary", className)}>
      <Image src="/brand/logo.png" alt="" width={36} height={36} className="size-9 object-contain" priority />
      <span className="text-base">{t("brand")}</span>
    </Link>
  );
}
