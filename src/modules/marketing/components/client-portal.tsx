"use client";

import { CalendarDays, Check, Inbox, MessageCircleQuestion, Paperclip, Send, Wallet, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input, inputBaseClass } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { campaignTypes, type Brief, type BriefStatus, type CampaignType } from "../briefs-mock";
import { clients } from "../sections-mock";

const statusStyle: Record<BriefStatus, string> = {
  new: "bg-primary-fixed text-primary",
  received: "bg-success-container text-success",
  clarification: "bg-tertiary-fixed text-tertiary",
};

export type NewBrief = Omit<Brief, "id" | "receivedOn" | "status">;

type ClientPortalProps = {
  briefs: Brief[];
  onClose: () => void;
  onReceive: (brief: Brief) => void;
  onClarify: (brief: Brief) => void;
  onSubmitBrief: (brief: NewBrief) => void;
};

/**
 * The bridge between client and team: clients hand in briefs, the team picks them up
 * (a received brief becomes an idea in the production pipeline).
 */
export function ClientPortal({ briefs, onClose, onReceive, onClarify, onSubmitBrief }: ClientPortalProps) {
  const t = useTranslations("marketing.portal");
  const [tab, setTab] = useState<"inbox" | "submit">("inbox");
  const newCount = briefs.filter((b) => b.status === "new").length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-portal-title"
        className="absolute inset-y-0 end-0 flex w-full max-w-xl flex-col bg-surface shadow-ambient-lg"
      >
        <header className="flex items-start justify-between gap-4 bg-surface-container-lowest p-6">
          <div>
            <h2 id="client-portal-title" className="text-xl font-extrabold">{t("title")}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <nav className="grid grid-cols-2 gap-1 bg-surface-container-lowest px-6 pb-4" role="tablist">
          {(
            [
              ["inbox", Inbox],
              ["submit", Send],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md py-2.5 text-sm transition-colors",
                tab === key ? "bg-tertiary font-bold text-on-tertiary" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`tabs.${key}`)}
              {key === "inbox" && newCount > 0 && (
                <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{newCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "inbox" ? (
            <BriefInbox briefs={briefs} onReceive={onReceive} onClarify={onClarify} />
          ) : (
            <BriefForm
              onSubmit={(brief) => {
                onSubmitBrief(brief);
                setTab("inbox");
              }}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function BriefInbox({ briefs, onReceive, onClarify }: Pick<ClientPortalProps, "briefs" | "onReceive" | "onClarify">) {
  const t = useTranslations("marketing.portal");
  const tm = useTranslations("marketing");
  const locale = useLocale() as "ar" | "en";

  if (briefs.length === 0) return <p className="py-12 text-center text-muted">{t("inbox.empty")}</p>;

  return (
    <ul className="flex flex-col gap-4">
      {briefs.map((brief) => {
        const client = clients.find((c) => c.id === brief.clientId);
        return (
          <li key={brief.id} className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-tertiary">{t(`types.${brief.type}`)}</p>
                <h3 className="mt-1 font-bold">{client?.name[locale]}</h3>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusStyle[brief.status])}>
                {t(`status.${brief.status}`)}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold">{brief.objective[locale]}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{brief.details[locale]}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted">{t("fields.audience")}</dt>
                <dd className="mt-0.5">{brief.audience[locale]}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-muted"><Wallet className="size-3" aria-hidden />{t("fields.budget")}</dt>
                <dd className="mt-0.5"><span dir="ltr" className="font-mono">{brief.budget.toLocaleString("en-US")}</span> {tm("currency")}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-muted"><CalendarDays className="size-3" aria-hidden />{t("fields.deadline")}</dt>
                <dd className="mt-0.5 font-mono" dir="ltr">{brief.deadline}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 pt-3">
              <span className="flex items-center gap-2 text-xs text-muted">
                {t("receivedOn")} <span dir="ltr">{brief.receivedOn}</span>
                {brief.attachment && (
                  <span className="flex items-center gap-1 text-primary">
                    <Paperclip className="size-3" aria-hidden />
                    <span dir="ltr">{brief.attachment}</span>
                  </span>
                )}
              </span>
              {brief.status === "received" ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-success">
                  <Check className="size-3.5" aria-hidden />
                  {t("inPipeline")}
                </span>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onClarify(brief)}
                    disabled={brief.status === "clarification"}
                    className="flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold ghost-border hover:bg-surface-container-low disabled:opacity-50"
                  >
                    <MessageCircleQuestion className="size-3.5" aria-hidden />
                    {t("actions.clarify")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReceive(brief)}
                    className="flex h-9 items-center gap-1.5 rounded-sm bg-tertiary px-3 text-xs font-bold text-on-tertiary hover:brightness-110"
                  >
                    <Check className="size-3.5" aria-hidden />
                    {t("actions.receive")}
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BriefForm({ onSubmit }: { onSubmit: (brief: NewBrief) => void }) {
  const t = useTranslations("marketing.portal");
  const tm = useTranslations("marketing");
  const locale = useLocale() as "ar" | "en";
  const [attachment, setAttachment] = useState<string>();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const text = (name: string, fallback: string) => {
          const value = String(data.get(name) ?? "").trim() || fallback;
          return { ar: value, en: value };
        };
        // TODO(backend): store the brief and notify the account manager
        onSubmit({
          clientId: String(data.get("client")),
          type: data.get("type") as CampaignType,
          objective: text("objective", t("placeholders.objective")),
          audience: text("audience", "—"),
          details: text("details", "—"),
          budget: Number(data.get("budget")) || 0,
          deadline: String(data.get("deadline") || "—"),
          attachment,
        });
      }}
    >
      <p className="rounded-md bg-tertiary-fixed px-4 py-3 text-sm text-tertiary">{t("form.intro")}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("fields.client")} htmlFor="briefClient">
          <Select id="briefClient" name="client" defaultValue={clients[0].id}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name[locale]}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.type")} htmlFor="briefType">
          <Select id="briefType" name="type" defaultValue={campaignTypes[0]}>
            {campaignTypes.map((type) => (
              <option key={type} value={type}>{t(`types.${type}`)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("fields.objective")} htmlFor="briefObjective">
        <Input id="briefObjective" name="objective" placeholder={t("placeholders.objective")} autoComplete="off" />
      </Field>
      <Field label={t("fields.audience")} htmlFor="briefAudience">
        <Input id="briefAudience" name="audience" placeholder={t("placeholders.audience")} autoComplete="off" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={`${t("fields.budget")} (${tm("currency")})`} htmlFor="briefBudget">
          <Input id="briefBudget" name="budget" type="number" min={0} inputMode="numeric" placeholder="10000" />
        </Field>
        <Field label={t("fields.deadline")} htmlFor="briefDeadline">
          <Input id="briefDeadline" name="deadline" type="date" />
        </Field>
      </div>
      <Field label={t("fields.details")} htmlFor="briefDetails">
        <textarea
          id="briefDetails"
          name="details"
          rows={4}
          placeholder={t("placeholders.details")}
          className={cn(inputBaseClass, "h-auto resize-y py-3")}
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-outline-variant/70 bg-surface-container-low p-4 text-sm hover:bg-surface-container">
        <Paperclip className="size-5 text-muted" aria-hidden />
        <span className="flex-1">{attachment ?? t("form.attach")}</span>
        <input type="file" className="sr-only" onChange={(event) => setAttachment(event.target.files?.[0]?.name)} />
      </label>
      <button type="submit" className="flex h-12 items-center justify-center gap-2 rounded-sm bg-tertiary font-bold text-on-tertiary transition hover:brightness-110">
        <Send className="size-4" aria-hidden />
        {t("form.submit")}
      </button>
    </form>
  );
}
