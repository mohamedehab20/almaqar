"use client";

import {
  Archive,
  Award,
  BriefcaseBusiness,
  Banknote,
  CalendarDays,
  ChevronDown,
  Circle,
  CircleCheck,
  Contact,
  DoorOpen,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
  Video,
  Volume2,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ROOM_VIEW } from "@/modules/permissions/catalog";

type NavItem = { key: string; icon: LucideIcon; href?: string };
type NavGroup = NavItem & { children: NavItem[] };

/** Rooms a signed-in member may open, and whether they are the owner. null: the public demo (all open). */
export type RoomAccess = { owner: boolean; rooms: string[] } | null;

export function AppSidebar({ companySlug, access = null, onClose }: { companySlug: string; access?: RoomAccess; onClose?: () => void }) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const base = `/c/${companySlug}`;

  // Rooms without permission are hidden; the permissions page is the owner's (open in the demo).
  const visible = (item: NavItem) => {
    if (!access) return true;
    if (item.key === "permissions") return access.owner;
    return !(item.key in ROOM_VIEW) || access.rooms.includes(item.key);
  };

  // Items without href have no page yet and are marked "coming soon".
  const groups: NavGroup[] = [
    {
      key: "overview",
      icon: LayoutDashboard,
      href: base,
      children: [
        { key: "voice", icon: Volume2 },
        { key: "camera", icon: Video },
        { key: "recording", icon: Circle },
        { key: "calendar", icon: CalendarDays },
        { key: "chat", icon: MessageSquare },
      ],
    },
    {
      key: "departments",
      icon: Users,
      children: [
        { key: "hr", icon: Contact, href: `${base}/hr` },
        { key: "operations", icon: Workflow, href: `${base}/operations` },
        { key: "automation", icon: Zap, href: `${base}/automation` },
        { key: "accounts", icon: Banknote },
        { key: "sales", icon: TrendingUp }, // coming soon (page kept, closed in its layout)
        { key: "marketing", icon: Megaphone, href: `${base}/marketing` },
        { key: "agents", icon: BriefcaseBusiness }, // coming soon (page kept, closed in its layout)
        { key: "archive", icon: Archive },
        { key: "meetings", icon: DoorOpen },
        { key: "tasks", icon: CircleCheck },
        { key: "permissions", icon: ShieldCheck, href: `${base}/permissions` },
      ],
    },
  ].map((group) => ({ ...group, children: group.children.filter(visible) }));

  // A group starts open when the current page is one of its children
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((group) => [group.key, group.children.some((child) => child.href === pathname)])),
  );
  const toggle = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  // "Coming soon" message for items that have no page yet
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="flex h-full flex-col bg-[#1c1d1f] text-white/75">
      <div className="flex items-center gap-3 px-6 pb-6 pt-6">
        {/* Brand → back to the home page */}
        <Link
          href="/"
          onClick={onClose}
          aria-label={t("backHome")}
          title={t("backHome")}
          className="-m-1 flex flex-1 items-center gap-3 rounded-md p-1 transition-colors hover:bg-white/5"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-white p-1">
            <Image src="/brand/logo.png" alt="" width={40} height={40} className="size-10 object-contain" priority />
          </span>
          <span className="flex-1">
            <span className="block text-2xl font-extrabold leading-tight text-white">المقر</span>
            <span className="block text-[10px] tracking-[0.2em] text-white/50">{t("brandTagline")}</span>
          </span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMenu")}
            className="grid size-9 place-items-center rounded-full hover:bg-white/10"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <nav aria-label={t("mainNav")} className="flex-1 overflow-y-auto px-4">
        <ul className="flex flex-col gap-2">
          {groups.map((group, index) => {
            const open = openGroups[group.key];
            const listId = `nav-group-${group.key}`;
            const label = t(`nav.${group.key}`);
            const headerActive = group.href !== undefined && pathname === group.href;
            const Icon = group.icon;
            return (
              <li key={group.key} className={cn(index > 0 && "border-t border-white/10 pt-2")}>
                <div
                  className={cn(
                    "flex items-center rounded-full transition-colors",
                    headerActive
                      ? "border-s-4 border-primary-container bg-primary-container/20 text-[#8fb3ff]"
                      : "hover:bg-white/5 hover:text-white",
                  )}
                >
                  {group.href ? (
                    <Link
                      href={group.href}
                      onClick={onClose}
                      aria-current={headerActive ? "page" : undefined}
                      className="flex flex-1 items-center gap-4 py-2.5 ps-5 text-[15px] font-semibold"
                    >
                      <Icon className="size-5" aria-hidden />
                      {label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggle(group.key)}
                      aria-expanded={open}
                      aria-controls={listId}
                      className="flex flex-1 items-center gap-4 py-2.5 ps-5 text-start text-[15px] font-semibold"
                    >
                      <Icon className="size-5" aria-hidden />
                      {label}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-label={t(open ? "collapseGroup" : "expandGroup", { name: label })}
                    className="me-2 grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
                  >
                    <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                  </button>
                </div>

                {open && (
                  <ul id={listId} className="ms-7 mt-1 flex flex-col gap-0.5 border-s border-white/10 ps-2">
                    {group.children.map(({ key, icon: ChildIcon, href }) => {
                      const active = href !== undefined && pathname === href;
                      const content = (
                        <>
                          <ChildIcon className={cn("size-4", key === "recording" && "fill-current")} aria-hidden />
                          <span>{t(`nav.${key}`)}</span>
                        </>
                      );
                      const itemClass = cn(
                        "flex w-full items-center gap-3 rounded-full py-2 pe-4 ps-4 text-sm transition-colors",
                        active
                          ? "border-s-4 border-primary-container bg-primary-container/20 font-semibold text-[#8fb3ff]"
                          : "hover:bg-white/5 hover:text-white",
                      );
                      return (
                        <li key={key}>
                          {href ? (
                            <Link href={href} className={itemClass} aria-current={active ? "page" : undefined} onClick={onClose}>
                              {content}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              aria-disabled="true"
                              onClick={() => setNotice(t("comingSoonItem", { name: t(`nav.${key}`) }))}
                              className={cn(itemClass, "opacity-40 hover:bg-white/5 hover:text-white/75")}
                            >
                              {content}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-5">
        <Link
          href="/pricing"
          onClick={onClose}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-md bg-secondary-container font-bold text-on-secondary-container transition hover:brightness-105"
        >
          <Award className="size-5" aria-hidden />
          {t("upgrade")}
        </Link>
      </div>

      {notice && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-sm rounded-md bg-surface-container-lowest px-5 py-3 text-center text-sm font-semibold text-on-surface shadow-ambient-lg"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
