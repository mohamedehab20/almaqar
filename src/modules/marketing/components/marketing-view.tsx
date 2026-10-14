"use client";

import {
  AtSign,
  FileDown,
  FlaskConical,
  Handshake,
  Lightbulb,
  Megaphone,
  Plus,
  Radio,
  Send,
  Users,
  Wallet,
  Workflow,
  X,
  HandCoins,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ideas as demoIdeas, type Criterion, type DeliveryStatus, type Idea, type Stage } from "../mock";
import type { Brief } from "../briefs-mock";
import { updateBriefs, useBriefs } from "../briefs-store";
import { clients } from "../sections-mock";
import { ClientPortal, type NewBrief } from "./client-portal";
import { LabView, type Decision } from "./lab-view";
import { AccountsSection, BudgetsSection, CampaignsSection, ChannelsSection, ClientsSection } from "./sections";
import type { ProfitReport, ProfitSettings } from "@/modules/profitability/calc";
import { ProfitabilitySection } from "@/modules/profitability/components/profitability-section";

const stages: { key: Stage; icon: typeof Lightbulb }[] = [
  { key: "bank", icon: Lightbulb },
  { key: "lab", icon: FlaskConical },
  { key: "delivery", icon: Send },
];

type Section = "pipeline" | "clients" | "accounts" | "campaigns" | "budgets" | "channels" | "profitability";

const sections: { key: Section; icon: typeof Lightbulb }[] = [
  { key: "pipeline", icon: Workflow },
  { key: "clients", icon: Users },
  { key: "accounts", icon: AtSign },
  { key: "campaigns", icon: Megaphone },
  { key: "budgets", icon: Wallet },
  { key: "channels", icon: Radio },
  { key: "profitability", icon: HandCoins },
];

const deliveryStyle: Record<DeliveryStatus, string> = {
  awaiting: "bg-tertiary-fixed text-tertiary",
  approved: "bg-success-container text-success",
  changes: "bg-danger-container text-danger",
};

/**
 * `profitability`: the report computed on the server, or null when the viewer may not see it (owner and admins).
 * `profitSettings`: the owner's «إعدادات الربحية» (null for everyone else). `companyId` null = the public demo.
 */
export function MarketingView({
  profitability = null,
  profitSettings = null,
  companyId = null,
}: {
  profitability?: ProfitReport | null;
  profitSettings?: ProfitSettings | null;
  companyId?: string | null;
}) {
  const t = useTranslations("marketing");
  const locale = useLocale() as "ar" | "en";
  const [ideas, setIdeas] = useState<Idea[]>(demoIdeas);
  const [section, setSection] = useState<Section>("pipeline");
  const [stage, setStage] = useState<Stage>("lab");
  const [selectedLabId, setSelectedLabId] = useState<string>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  // Shared with the client's own portal (visitor login)
  const briefs = useBriefs();
  const [portalOpen, setPortalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const byStage = (key: Stage) => ideas.filter((idea) => idea.stage === key);
  const update = (id: string, change: (idea: Idea) => Idea) =>
    setIdeas((prev) => prev.map((idea) => (idea.id === id ? change(idea) : idea)));

  const rate = (id: string, criterion: Criterion, value: number) =>
    update(id, (idea) => ({
      ...idea,
      ratings: { ...(idea.ratings ?? { hook: 3, clarity: 3, fit: 3, effort: 3 }), [criterion]: value },
    }));

  const decide = (id: string, decision: Decision) => {
    const title = ideas.find((idea) => idea.id === id)?.title[locale] ?? "";
    if (decision === "continue") {
      update(id, (idea) => ({
        ...idea,
        stage: "delivery",
        delivery: { status: "awaiting", sentOn: new Date().toISOString().slice(0, 10), rounds: 0 },
        // The tested versions are what the client receives
        videos:
          idea.videos ??
          idea.versions?.map((v) => ({ id: `${idea.id}-${v.id}`, name: `${idea.id}-version-${v.label.toLowerCase()}.mp4`, duration: v.duration, aspect: "9:16", sizeMb: 0, version: v.label })),
      }));
      setSelectedLabId(undefined);
    } else if (decision === "cancel") {
      update(id, (idea) => ({ ...idea, stage: "bank" }));
      setSelectedLabId(undefined);
    }
    setNotice(t(`notices.${decision}`, { title }));
  };

  const moveToLab = (id: string) => {
    update(id, (idea) => ({ ...idea, stage: "lab", ratings: idea.ratings ?? { hook: 3, clarity: 3, fit: 3, effort: 3 } }));
    setSelectedLabId(id);
    setStage("lab");
  };

  const addIdea = (title: string) => {
    // TODO(backend): save the idea
    const idea: Idea = {
      id: `new-${Date.now()}`,
      stage: "bank",
      title: { ar: title, en: title },
      client: { ar: "[اسم العميل]", en: "[Client name]" },
      format: { ar: "—", en: "—" },
      owner: { ar: "[اسم المسوّق]", en: "[Marketer name]" },
      hook: { ar: "—", en: "—" },
      message: { ar: "—", en: "—" },
    };
    setIdeas((prev) => [idea, ...prev]);
    setAdding(false);
    setSection("pipeline");
    setStage("bank");
    setNotice(t("notices.added", { title }));
  };

  const tp = useTranslations("marketing.portal");
  const newBriefs = briefs.filter((brief) => brief.status === "new").length;
  const setBriefStatus = (id: string, status: Brief["status"]) =>
    updateBriefs((prev) => prev.map((brief) => (brief.id === id ? { ...brief, status } : brief)));

  // A received brief becomes an idea in the idea bank, linked to the client
  const receiveBrief = (brief: Brief) => {
    const client = clients.find((c) => c.id === brief.clientId);
    const type = tp(`types.${brief.type}`);
    setIdeas((prev) => [
      {
        id: `brief-${brief.id}`,
        stage: "bank",
        title: brief.objective,
        client: client?.name ?? { ar: "—", en: "—" },
        format: { ar: type, en: type },
        owner: { ar: "[اسم المسوّق]", en: "[Marketer name]" },
        hook: { ar: "—", en: "—" },
        message: brief.details,
      },
      ...prev,
    ]);
    setBriefStatus(brief.id, "received");
    setNotice(tp("notices.received", { client: client?.name[locale] ?? "" }));
  };

  const clarifyBrief = (brief: Brief) => {
    setBriefStatus(brief.id, "clarification");
    setNotice(tp("notices.clarify", { client: clients.find((c) => c.id === brief.clientId)?.name[locale] ?? "" }));
  };

  const submitBrief = (brief: NewBrief) => {
    updateBriefs((prev) => [{ ...brief, id: `br-${Date.now()}`, receivedOn: new Date().toISOString().slice(0, 10), status: "new" }, ...prev]);
    setNotice(tp("notices.submitted"));
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant/40 pb-6">
          <div>
            <p className="text-xs font-semibold tracking-wider text-tertiary">
              {t("eyebrow")} · <span dir="ltr">MARKETING</span>
            </p>
            <h2 className="mt-1 text-3xl font-extrabold">{t("title")}</h2>
            <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setNotice(t("notices.export"))}
              className="flex h-11 items-center gap-2 rounded-sm bg-surface-container-lowest px-4 text-sm font-semibold ghost-border hover:bg-surface-container-low"
            >
              <FileDown className="size-4" aria-hidden />
              {t("export")}
            </button>
            <button
              type="button"
              onClick={() => setPortalOpen(true)}
              className="relative flex h-11 items-center gap-2 rounded-sm bg-surface-container-lowest px-4 text-sm font-semibold text-tertiary ghost-border hover:bg-tertiary-fixed"
            >
              <Handshake className="size-4" aria-hidden />
              {tp("button")}
              {newBriefs > 0 && (
                <span className="absolute -end-2 -top-2 grid size-5 place-items-center rounded-full bg-danger text-[11px] font-bold text-white">
                  {newBriefs}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-11 items-center gap-2 rounded-sm bg-tertiary px-5 text-sm font-bold text-on-tertiary shadow-ambient transition hover:brightness-110"
            >
              <Plus className="size-4" aria-hidden />
              {t("newIdea")}
            </button>
          </div>
        </header>

        {/* Department sections */}
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label={t("sectionsLabel")}>
          {sections.filter(({ key }) => key !== "profitability" || profitability).map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              aria-pressed={section === key}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                section === key
                  ? "bg-tertiary font-bold text-on-tertiary shadow-ambient"
                  : "bg-surface-container-lowest text-on-surface-variant ghost-border hover:text-on-surface",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`sections.${key}`)}
            </button>
          ))}
        </nav>

        {section === "clients" && <ClientsSection />}
        {section === "accounts" && <AccountsSection />}
        {section === "campaigns" && <CampaignsSection />}
        {section === "budgets" && <BudgetsSection />}
        {section === "channels" && <ChannelsSection />}
        {section === "profitability" && profitability && <ProfitabilitySection report={profitability} settings={profitSettings} companyId={companyId ?? "demo"} demo={companyId === null} />}

        {section === "pipeline" && (
          <>
            {/* Pipeline stages */}
            <nav className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-surface-container-low p-1.5 ghost-border" aria-label={t("stagesLabel")}>
              {stages.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStage(key)}
                  aria-pressed={stage === key}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors",
                    stage === key ? "bg-surface-container-lowest font-bold shadow-ambient" : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`stages.${key}`)}
                  <span className="rounded-sm bg-surface-container px-1.5 font-mono text-xs">{byStage(key).length}</span>
                </button>
              ))}
            </nav>

            {stage === "lab" && (
              <LabView
                ideas={byStage("lab")}
                selectedId={selectedLabId}
                onSelect={setSelectedLabId}
                onRate={rate}
                notes={notes}
                onNotes={(id, value) => setNotes((prev) => ({ ...prev, [id]: value }))}
                onDecide={decide}
              />
            )}

            {stage === "bank" && (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {byStage("bank").map((idea) => (
                  <li key={idea.id} className="flex flex-col rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
                    <Lightbulb className="size-5 text-tertiary" aria-hidden />
                    <h3 className="mt-3 font-bold leading-snug">{idea.title[locale]}</h3>
                    <p className="mt-1 text-sm text-muted">{idea.format[locale]}</p>
                    <button
                      type="button"
                      onClick={() => moveToLab(idea.id)}
                      className="mt-4 flex h-10 items-center justify-center gap-2 rounded-sm bg-tertiary-fixed text-sm font-semibold text-tertiary transition hover:brightness-95"
                    >
                      <FlaskConical className="size-4" aria-hidden />
                      {t("bank.toLab")}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {stage === "delivery" && (
              <ul className="flex flex-col gap-3">
                {byStage("delivery").map((idea) => {
                  const status = idea.delivery?.status ?? "awaiting";
                  return (
                    <li key={idea.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
                      <div>
                        <h3 className="font-bold">{idea.title[locale]}</h3>
                        <p className="mt-1 text-sm text-muted">
                          {idea.client[locale]} · {idea.format[locale]} · {t("delivery.sentOn")}{" "}
                          <span dir="ltr">{idea.delivery?.sentOn}</span>
                        </p>
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", deliveryStyle[status])}>
                        {t(`delivery.status.${status}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {portalOpen && (
        <ClientPortal
          briefs={briefs}
          sent={ideas.filter((idea) => idea.stage === "delivery")}
          onClose={() => setPortalOpen(false)}
          onReceive={receiveBrief}
          onClarify={clarifyBrief}
          onSubmitBrief={submitBrief}
        />
      )}

      {adding && <NewIdeaDialog onClose={() => setAdding(false)} onAdd={addIdea} />}

      {notice && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg"
        >
          {notice}
        </p>
      )}
    </div>
  );
}

function NewIdeaDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (title: string) => void }) {
  const t = useTranslations("marketing");
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="new-idea-title" className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-ambient-lg sm:p-8">
        <header className="flex items-center justify-between gap-4">
          <h2 id="new-idea-title" className="text-xl font-extrabold">
            {t("dialog.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dialog.close")}
            className="grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            // Frontend phase: use the example text instead of blocking on an empty field
            onAdd(title.trim() || t("dialog.placeholder"));
          }}
        >
          <Field label={t("dialog.name")} htmlFor="ideaTitle">
            <Input
              ref={inputRef}
              id="ideaTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("dialog.placeholder")}
              autoComplete="off"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="h-11 rounded-sm bg-surface-container-low px-5 text-sm font-semibold hover:bg-surface-container">
              {t("dialog.cancel")}
            </button>
            <button type="submit" className="h-11 rounded-sm bg-tertiary px-6 text-sm font-bold text-on-tertiary transition hover:brightness-110">
              {t("dialog.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
