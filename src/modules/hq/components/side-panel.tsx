"use client";

import { EllipsisVertical } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/shared/avatar";
import type { ActivityItem, Member } from "../mock";

const statusOrder = { available: 0, busy: 1, meeting: 2, restroom: 3, waiting: 4, away: 5, offline: 6 } as const;

export function PresencePanel({ members }: { members: Member[] }) {
  const t = useTranslations("hq");
  const locale = useLocale() as "ar" | "en";
  const online = members.filter((m) => m.status !== "offline").length;
  const sorted = [...members].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return (
    <PanelFrame
      title={t("presence.title")}
      badge={t("presence.online", { count: online })}
      footer={
        <button
          type="button"
          className="h-12 w-full rounded-md bg-surface-container-lowest text-sm font-semibold ghost-border hover:bg-surface-container-low"
        >
          {t("presence.viewAll")}
        </button>
      }
    >
      <ul className="flex flex-col gap-1">
        {sorted.map((member) => (
          <li key={member.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-surface-container-low">
            <Avatar name={member.name[locale]} status={member.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{member.name[locale]}</p>
              <p className="truncate text-xs text-muted">
                {member.title[locale]} · {t(`status.${member.status}`)}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("presence.options", { name: member.name[locale] })}
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-container"
            >
              <EllipsisVertical className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </PanelFrame>
  );
}

export function ActivityPanel({ items }: { items: ActivityItem[] }) {
  const t = useTranslations("hq");
  const locale = useLocale() as "ar" | "en";

  return (
    <PanelFrame title={t("history.title")}>
      <ol className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 text-sm">
            <span className="mt-0.5 font-mono text-xs text-muted" dir="ltr">
              {item.time}
            </span>
            <span>{item.text[locale]}</span>
          </li>
        ))}
      </ol>
    </PanelFrame>
  );
}

function PanelFrame({
  title,
  badge,
  footer,
  children,
}: {
  title: string;
  badge?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <aside className="absolute inset-y-0 end-0 z-10 hidden w-80 flex-col bg-surface-container-lowest/85 shadow-ambient backdrop-blur-md md:flex">
      <header className="flex items-center justify-between px-6 pb-4 pt-6">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {badge && (
          <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary">{badge}</span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>
      {footer && <div className="p-4">{footer}</div>}
    </aside>
  );
}
