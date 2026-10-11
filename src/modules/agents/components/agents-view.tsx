"use client";

import {
  Bot,
  Calculator,
  FileSignature,
  Headset,
  Network,
  Pause,
  PenLine,
  Play,
  Plus,
  Receipt,
  Send,
  Sparkles,
  UserSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { agents as demoAgents, type Agent, type AgentKind, type AgentStatus } from "../mock";

const icons: Record<string, LucideIcon> = {
  "a-assistant": Sparkles,
  "a-coordinator": Network,
  "a-contracts": FileSignature,
  "a-quotes": Receipt,
  "a-content": PenLine,
  "a-recruiter": UserSearch,
  "a-accountant": Calculator,
  "a-support": Headset,
};

const statusStyle: Record<AgentStatus, string> = {
  active: "bg-success-container text-success",
  busy: "bg-tertiary-fixed text-tertiary",
  paused: "bg-surface-container text-on-surface-variant",
};

type Filter = AgentKind | "all";

/** "Al Jarab": the company's bag of AI agents — general agents for any task and specialists for specific ones. */
export function AgentsView() {
  const t = useTranslations("agents");
  const locale = useLocale() as "ar" | "en";
  const [agents, setAgents] = useState<Agent[]>(demoAgents);
  const [filter, setFilter] = useState<Filter>("all");
  const [assigning, setAssigning] = useState<Agent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const togglePaused = (agent: Agent) => {
    const status: AgentStatus = agent.status === "paused" ? (agent.queue > 0 ? "busy" : "active") : "paused";
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, status } : a)));
    setNotice(t(status === "paused" ? "notices.paused" : "notices.resumed", { name: agent.name[locale] }));
  };

  const assign = (agent: Agent, task: string) => {
    // TODO(backend): send the task to the agent runtime and track its progress
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, queue: a.queue + 1, status: a.status === "paused" ? "paused" : "busy" } : a)));
    setAssigning(null);
    setNotice(t("notices.assigned", { name: agent.name[locale], task: task.length > 40 ? `${task.slice(0, 40)}…` : task }));
  };

  const sections = (["general", "specialist"] as const).filter((kind) => filter === "all" || filter === kind);
  const activeCount = agents.filter((a) => a.status !== "paused").length;
  const queueCount = agents.reduce((sum, a) => sum + a.queue, 0);
  const doneCount = agents.reduce((sum, a) => sum + a.tasksDone, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p dir="ltr" className="text-left font-mono text-xs tracking-wider text-tertiary rtl:text-right">AI // AGENTS</p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotice(t("notices.newSoon"))}
            className="flex h-11 items-center gap-2 rounded-sm bg-tertiary px-5 text-sm font-bold text-on-tertiary shadow-ambient transition hover:brightness-110"
          >
            <Plus className="size-4" aria-hidden />
            {t("newAgent")}
          </button>
        </header>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label={t("metrics.active")} value={`${activeCount} / ${agents.length}`} />
          <Metric label={t("metrics.queue")} value={String(queueCount)} />
          <Metric label={t("metrics.done")} value={doneCount.toLocaleString("en-US")} />
        </div>

        <nav className="flex w-fit gap-1 rounded-md bg-surface-container-low p-1" aria-label={t("filterLabel")}>
          {(["all", "general", "specialist"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-sm px-4 py-1.5 text-sm transition-colors",
                filter === key ? "bg-surface-container-lowest font-bold text-tertiary shadow-ambient" : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {t(`filters.${key}`)}
            </button>
          ))}
        </nav>

        {sections.map((kind) => (
          <section key={kind} className="flex flex-col gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-extrabold">
                <Bot className="size-5 text-tertiary" aria-hidden />
                {t(`sections.${kind}.title`)}
              </h3>
              <p className="mt-0.5 text-sm text-on-surface-variant">{t(`sections.${kind}.desc`)}</p>
            </div>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agents
                .filter((a) => a.kind === kind)
                .map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onAssign={() => setAssigning(agent)}
                    onTogglePaused={() => togglePaused(agent)}
                  />
                ))}
            </ul>
          </section>
        ))}
      </div>

      {assigning && <AssignDialog agent={assigning} onClose={() => setAssigning(null)} onSubmit={(task) => assign(assigning, task)} />}

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm font-semibold text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p dir="ltr" className="mt-2 text-start text-3xl font-black rtl:text-right">{value}</p>
    </div>
  );
}

function AgentCard({ agent, onAssign, onTogglePaused }: { agent: Agent; onAssign: () => void; onTogglePaused: () => void }) {
  const t = useTranslations("agents");
  const locale = useLocale() as "ar" | "en";
  const Icon = icons[agent.id] ?? Bot;
  const paused = agent.status === "paused";

  return (
    <li className={cn("flex flex-col gap-4 rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border", paused && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-md",
            agent.kind === "general" ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed text-primary",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-extrabold">{agent.name[locale]}</h4>
          <p className="text-xs text-muted">{agent.area ? `${agent.role[locale]} · ${agent.area[locale]}` : agent.role[locale]}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", statusStyle[agent.status])}>{t(`status.${agent.status}`)}</span>
      </div>

      <p className="text-sm leading-6 text-on-surface-variant">{agent.description[locale]}</p>

      <ul className="flex flex-wrap gap-1.5" aria-label={t("skills")}>
        {agent.skills.map((skill) => (
          <li key={skill.en} className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs">
            {skill[locale]}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-2 border-t border-outline-variant/30 pt-4">
        <p className="flex-1 text-xs text-muted">
          {t("stats", { done: agent.tasksDone, queue: agent.queue })}
        </p>
        <button
          type="button"
          onClick={onTogglePaused}
          aria-label={t(paused ? "resume" : "pause", { name: agent.name[locale] })}
          title={t(paused ? "resume" : "pause", { name: agent.name[locale] })}
          className="grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
        >
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onAssign}
          className="flex h-9 items-center gap-1.5 rounded-sm bg-primary px-4 text-sm font-bold text-on-primary hover:brightness-110"
        >
          <Send className="size-3.5 rtl:-scale-x-100" aria-hidden />
          {t("assign")}
        </button>
      </div>
    </li>
  );
}

function AssignDialog({ agent, onClose, onSubmit }: { agent: Agent; onClose: () => void; onSubmit: (task: string) => void }) {
  const t = useTranslations("agents");
  const locale = useLocale() as "ar" | "en";
  const [task, setTask] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        noValidate
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const body = task.trim();
          if (!body) {
            setError(true);
            return;
          }
          onSubmit(body);
        }}
        className="flex w-full max-w-lg flex-col gap-4 rounded-lg bg-surface-container-lowest p-6 shadow-ambient-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="assign-title" className="text-lg font-extrabold">{t("dialog.title", { name: agent.name[locale] })}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t(agent.kind === "general" ? "dialog.hintGeneral" : "dialog.hintSpecialist")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("dialog.close")} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-container">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {agent.status === "paused" && <p className="rounded-sm bg-tertiary-fixed px-3 py-2 text-xs text-tertiary">{t("dialog.pausedWarning")}</p>}
        <textarea
          autoFocus
          value={task}
          onChange={(event) => {
            setTask(event.target.value);
            setError(false);
          }}
          rows={5}
          aria-label={t("dialog.task")}
          aria-invalid={error}
          placeholder={t(agent.kind === "general" ? "dialog.placeholderGeneral" : "dialog.placeholderSpecialist")}
          className={cn(
            "w-full resize-y rounded-sm bg-surface-container-low p-3 text-sm outline-none placeholder:text-muted focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20",
            error && "ring-2 ring-danger/40",
          )}
        />
        {error && <p className="-mt-2 text-xs text-danger">{t("dialog.empty")}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-sm px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
            {t("dialog.cancel")}
          </button>
          <button type="submit" className="flex h-10 items-center gap-2 rounded-sm bg-primary px-5 text-sm font-bold text-on-primary hover:brightness-110">
            <Send className="size-4 rtl:-scale-x-100" aria-hidden />
            {t("dialog.send")}
          </button>
        </div>
      </form>
    </div>
  );
}
