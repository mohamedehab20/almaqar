"use client";

import { CalendarDays, Clapperboard, Eye, FileVideo, MessageSquareQuote, RefreshCw, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { DeliveryStatus, Idea } from "../mock";
import { clients } from "../sections-mock";

/** Keeps "61%" left to right inside Arabic text (Unicode isolate marks) */
const isolate = (value: string) => `\u2066${value}\u2069`;

const statusStyle: Record<DeliveryStatus, string> = {
  awaiting: "bg-tertiary-fixed text-tertiary",
  approved: "bg-success-container text-success",
  changes: "bg-danger-container text-danger",
};

/**
 * Client portal → «الفيديوهات المرسلة»: everything sent to clients for approval, newest first, with the
 * files (duration, aspect, size, version), the status, the client's feedback and the lab test results.
 */
export function SentVideos({ sent }: { sent: Idea[] }) {
  const t = useTranslations("marketing.portal.sent");
  const td = useTranslations("marketing.delivery");
  const locale = useLocale() as "ar" | "en";
  const [clientId, setClientId] = useState("");

  const list = sent
    .filter((idea) => !clientId || idea.clientId === clientId)
    .sort((a, b) => (b.delivery?.sentOn ?? "").localeCompare(a.delivery?.sentOn ?? ""));
  const files = list.reduce((n, idea) => n + (idea.videos?.length ?? 0), 0);
  const count = (status: DeliveryStatus) => list.filter((idea) => (idea.delivery?.status ?? "awaiting") === status).length;
  const used = clients.filter((c) => sent.some((idea) => idea.clientId === c.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-label={t("client")}
          className="h-9 rounded-sm bg-surface-container-lowest px-3 text-sm ghost-border"
        >
          <option value="">{t("allClients")}</option>
          {used.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name[locale]}
            </option>
          ))}
        </select>
        <span className="text-sm text-on-surface-variant">{t("summary", { items: list.length, files })}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {(["awaiting", "approved", "changes"] as const).map((status) => (
          <div key={status} className={cn("rounded-md px-2 py-2 font-semibold", statusStyle[status])}>
            <span className="block text-lg font-black">{count(status)}</span>
            {td(`status.${status}`)}
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-12 text-center text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((idea) => {
            const status = idea.delivery?.status ?? "awaiting";
            const client = clients.find((c) => c.id === idea.clientId)?.name ?? idea.client;
            const best = idea.versions?.length ? [...idea.versions].sort((a, b) => b.completion - a.completion)[0] : null;
            return (
              <li key={idea.id} className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-tertiary">
                      {client[locale]} · {idea.format[locale]}
                    </p>
                    <h3 className="mt-1 font-bold">{idea.title[locale]}</h3>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusStyle[status])}>{td(`status.${status}`)}</span>
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-on-surface-variant">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" aria-hidden />
                    <dt>{t("sentOn")}</dt>
                    <dd dir="ltr" className="font-mono">{idea.delivery?.sentOn}</dd>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserRound className="size-3.5" aria-hidden />
                    <dt>{t("owner")}</dt>
                    <dd>{idea.owner[locale]}</dd>
                  </div>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="size-3.5" aria-hidden />
                    <dt>{t("rounds")}</dt>
                    <dd>{idea.delivery?.rounds ?? 0}</dd>
                  </div>
                </dl>

                {idea.hook[locale] && idea.hook[locale] !== "—" && (
                  <p className="mt-3 text-sm">
                    <span className="font-semibold">{t("hook")}: </span>
                    {idea.hook[locale]}
                  </p>
                )}

                {idea.videos?.length ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {idea.videos.map((video) => (
                      <li key={video.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-container-low px-3 py-2 text-xs">
                        <FileVideo className="size-4 shrink-0 text-tertiary" aria-hidden />
                        <bdi dir="ltr" className="min-w-0 flex-1 truncate font-mono font-semibold">
                          {video.name}
                        </bdi>
                        <span className="font-mono" dir="ltr">{video.duration}</span>
                        <span className="font-mono" dir="ltr">{video.aspect}</span>
                        {video.sizeMb > 0 && <span className="font-mono" dir="ltr">{video.sizeMb} MB</span>}
                        <span className="rounded-sm bg-surface-container px-1.5 font-semibold">{t("version", { version: video.version })}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
                    <Clapperboard className="size-4" aria-hidden />
                    {t("noFiles")}
                  </p>
                )}

                {best && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
                    <Eye className="size-3.5" aria-hidden />
                    {t("tested", { version: best.label, views: best.views.toLocaleString("en-US"), completion: isolate(`${best.completion}%`), engagement: isolate(`${best.engagement}%`) })}
                  </p>
                )}

                {idea.delivery?.feedback && (
                  <p className="mt-3 flex gap-2 rounded-md bg-danger-container/50 px-3 py-2 text-sm">
                    <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    <span>
                      <span className="font-semibold text-danger">{t("feedback")}: </span>
                      {idea.delivery.feedback[locale]}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
