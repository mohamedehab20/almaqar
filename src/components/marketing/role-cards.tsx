import { BriefcaseBusiness, Presentation, UserRound, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Role = {
  key: "owner" | "employee" | "visitor";
  href: string;
  image: string;
  icon: LucideIcon;
  iconClass: string;
  featured?: boolean;
};

// Order is reading order: in RTL the owner card sits on the right.
const roles: Role[] = [
  {
    key: "owner",
    href: "/login",
    image: "/landing/owner.jpg",
    icon: BriefcaseBusiness,
    iconClass: "bg-secondary-fixed text-secondary-container",
  },
  {
    key: "employee",
    href: "/employee-login",
    image: "/landing/employee.jpg",
    icon: Presentation,
    iconClass: "bg-white/15 text-on-primary",
    featured: true,
  },
  {
    key: "visitor",
    href: "/visitor-login",
    image: "/landing/visitor.jpg",
    icon: UserRound,
    iconClass: "bg-success-container text-success",
  },
];

export function RoleCards() {
  const t = useTranslations("landing.roles");

  return (
    <div id="roles" className="mx-auto mt-20 grid max-w-5xl items-center gap-8 md:mt-28 md:grid-cols-3">
      {roles.map(({ key, href, image, icon: Icon, iconClass, featured }) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "group flex flex-col items-center rounded-t-[110px] rounded-b-md px-6 pb-6 pt-8 text-center transition-[transform,box-shadow] duration-200 hover:-translate-y-1",
            featured
              ? "bg-brand-gradient text-on-primary shadow-ambient-lg md:min-h-[440px] md:py-10"
              : "bg-surface-container-lowest shadow-ambient hover:shadow-ambient-lg md:min-h-[390px]",
          )}
        >
          <span className={cn("grid size-16 place-items-center rounded-full", iconClass)}>
            <Icon className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-2xl font-bold">{t(`${key}.title`)}</h2>
          <p
            className={cn(
              "mt-2 max-w-xs text-sm leading-7",
              featured ? "text-on-primary/85" : "text-on-surface-variant",
            )}
          >
            {t(`${key}.description`)}
          </p>
          <div className="mt-auto w-full overflow-hidden rounded-md pt-6">
            <Image
              src={image}
              alt={t(`${key}.imageAlt`)}
              width={640}
              height={400}
              sizes="(min-width: 768px) 320px, 100vw"
              className="h-40 w-full rounded-md object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              priority={featured}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
