"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ChartColumn,
  ChevronDown,
  CirclePlus,
  Clock,
  Filter,
  GitBranch,
  LayoutGrid,
  Play,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { members } from "@/modules/hq/mock";
import { automationStats, flows as demoFlows, templates, type AutomationFlow } from "../mock";
import { runs as demoRuns, workflowTemplates, workflows as demoWorkflows, type Workflow, type WorkflowRun, type WorkflowTemplate } from "../workflows";
import { WorkflowBuilderDialog } from "./workflow-builder-dialog";
import { WorkflowsSection } from "./workflows-section";

/** Unique id for items created in the browser (until the backend assigns ids). */
const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function AutomationView() {
  const t = useTranslations("automation");
  const locale = useLocale() as "ar" | "en";
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const [flows, setFlows] = useState<AutomationFlow[]>(demoFlows);
  const [creating, setCreating] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [view, setView] = useState<"all" | "workflows" | "flows" | "templates">("all");
  const [workflows, setWorkflows] = useState<Workflow[]>(demoWorkflows);
  const [runs, setRuns] = useState<WorkflowRun[]>(demoRuns);
  const [focusWorkflowId, setFocusWorkflowId] = useState<string>();
  const [building, setBuilding] = useState(false);

  const applyWorkflowTemplate = (template: WorkflowTemplate) => {
    const workflowKey = uniqueId("wf");
    const workflow: Workflow = {
      id: workflowKey,
      name: template.name,
      steps: template.steps.map((step, i) => ({ ...step, id: `${workflowKey}-st-${i}` })),
    };
    setWorkflows((prev) => [...prev, workflow]);
    setFocusWorkflowId(workflow.id);
    setView("workflows");
    setNotice(t("templates.workflowAdded", { name: template.name[locale] }));
  };
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const activeCount = flows.filter((flow) => flow.enabled).length;
  const toggle = (id: string) => setFlows((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  const addFlow = (flow: Omit<AutomationFlow, "id" | "runs" | "lastRun" | "enabled">) => {
    // TODO(backend): save the flow in the automation engine
    setFlows((prev) => [{ ...flow, id: `new-${Date.now()}`, runs: 0, lastRun: { ar: "لسه ما اشتغلش", en: "Not run yet" }, enabled: true }, ...prev]);
    setNotice(t("notices.created", { name: flow.name[locale] }));
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p dir="ltr" className="text-left font-mono text-xs tracking-wider text-tertiary rtl:text-right">
              AUTOMATION_ENGINE // WORKFLOWS
            </p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="size-2 rounded-full bg-primary-container" />
              {t("engine")} <span className="font-mono" dir="ltr">v4.8</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ["all", LayoutGrid, null],
                ["workflows", GitBranch, null],
                ["flows", Zap, flows.length],
                ["templates", Sparkles, templates.length + workflowTemplates.length],
              ] as const
            ).map(([key, Icon, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-sm px-4 text-sm font-semibold ghost-border transition-colors",
                  view === key ? "bg-tertiary text-on-tertiary" : "bg-surface-container-lowest hover:bg-surface-container-low",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`views.${key}`)}
                {count !== null && (
                  <span className={cn("rounded-sm px-1.5 font-mono text-xs", view === key ? "bg-white/20" : "bg-surface-container")}>{count}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAnalysisOpen((open) => !open)}
              aria-expanded={analysisOpen}
              aria-controls="automation-analysis"
              className={cn(
                "flex h-11 items-center gap-2 rounded-sm px-4 text-sm font-semibold ghost-border transition-colors",
                analysisOpen ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <ChartColumn className="size-4" aria-hidden />
              {t("analysis")}
              <ChevronDown className={cn("size-4 transition-transform", analysisOpen && "rotate-180")} aria-hidden />
            </button>
            {/* Design an approval workflow (opens the builder) */}
            <button
              type="button"
              onClick={() => setBuilding(true)}
              className="flex h-11 items-center gap-2 rounded-sm bg-surface-container-lowest px-5 text-sm font-bold text-tertiary ghost-border transition hover:bg-tertiary-fixed"
            >
              <GitBranch className="size-4" aria-hidden />
              {t("workflows.create")}
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-11 items-center gap-2 rounded-sm bg-tertiary px-5 text-sm font-bold text-on-tertiary shadow-ambient transition hover:brightness-110"
            >
              <CirclePlus className="size-4" aria-hidden />
              {t("newFlow")}
            </button>
          </div>
        </header>

        {building && (
          <WorkflowBuilderDialog
            onClose={() => setBuilding(false)}
            onCreate={(created) => {
              setWorkflows((prev) => [...prev, created]);
              // The workflows section opens on the new workflow
              setFocusWorkflowId(created.id);
              if (view !== "all") setView("workflows");
              setBuilding(false);
              setNotice(t("workflows.notices.created", { name: created.name[locale] }));
            }}
          />
        )}

        {analysisOpen && (
          <section id="automation-analysis" aria-label={t("analysis")} className="grid gap-4 md:grid-cols-3">
            <Stat icon={Bot} label={t("stats.rate")} value={`${automationStats.automationRate}%`} sub={t("stats.perWeek", { count: automationStats.perWeek.toLocaleString("en-US") })} progress={automationStats.automationRate / 100} />
            <Stat icon={Zap} label={t("stats.active")} value={`${activeCount}/${flows.length}`} sub={t("stats.activeSub")} progress={flows.length ? activeCount / flows.length : 0} />
            <Stat icon={Clock} label={t("stats.saved")} value={String(automationStats.hoursSaved)} sub={t("stats.savedSub")} />
          </section>
        )}

        {/* Approval workflows */}
        {(view === "all" || view === "workflows") && (
          <WorkflowsSection
            key={focusWorkflowId ?? "default"}
            workflows={workflows}
            runs={runs}
            setRuns={setRuns}
            initialWorkflowId={focusWorkflowId}
            onNotice={setNotice}
          />
        )}


        {(view === "all" || view === "flows") && (
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-extrabold">{t("flows.title")}</h3>
            <ul className="flex flex-col gap-3">
              {flows.map((flow) => (
                <li
                  key={flow.id}
                  className={cn("rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border transition-opacity", !flow.enabled && "opacity-60")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-md bg-tertiary-fixed text-tertiary">
                        <Zap className="size-5" aria-hidden />
                      </span>
                      <div>
                        <h4 className="font-bold">{flow.name[locale]}</h4>
                        <p className="text-xs text-muted">
                          {t("flows.runs", { count: flow.runs })} · {t("flows.lastRun")}: {flow.lastRun[locale]}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={flow.enabled}
                      aria-label={t("flows.toggle", { name: flow.name[locale] })}
                      onClick={() => toggle(flow.id)}
                      className="flex items-center gap-2 text-xs font-semibold"
                    >
                      <span className={flow.enabled ? "text-success" : "text-muted"}>{t(flow.enabled ? "flows.on" : "flows.off")}</span>
                      <span className={cn("relative h-5 w-9 rounded-full transition-colors", flow.enabled ? "bg-success" : "bg-outline-variant")}>
                        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-[inset-inline-start]", flow.enabled ? "start-[1.125rem]" : "start-0.5")} />
                      </span>
                    </button>
                  </div>

                  {/* Trigger → Condition → Action */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                    <Step icon={Play} label={t("steps.trigger")} text={flow.trigger[locale]} className="bg-primary-fixed/60 text-primary" />
                    {flow.condition && (
                      <>
                        <Arrow className="size-4 shrink-0 text-muted" aria-hidden />
                        <Step icon={Filter} label={t("steps.condition")} text={flow.condition[locale]} className="bg-surface-container text-on-surface" />
                      </>
                    )}
                    <Arrow className="size-4 shrink-0 text-muted" aria-hidden />
                    <Step icon={Zap} label={t("steps.action")} text={flow.action[locale]} className="bg-tertiary-fixed text-tertiary" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Templates */}
        {(view === "all" || view === "templates") && (
          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-lg font-extrabold">
              <Sparkles className="size-5 text-tertiary" aria-hidden />
              {t("templates.title")}
            </h3>
            {/* Workflow templates (steps + owners) */}
            <ul className="flex flex-col gap-4">
              {workflowTemplates.map((template) => (
                <li key={template.id} className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ring-1 ring-tertiary/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-sm bg-tertiary-fixed px-2 py-0.5 text-[11px] font-bold text-tertiary">
                        <GitBranch className="size-3" aria-hidden />
                        {t("templates.workflowBadge", { count: template.steps.length })}
                      </span>
                      <h4 className="mt-2 text-lg font-bold">{template.name[locale]}</h4>
                      <p className="mt-1 text-sm text-on-surface-variant">{template.description[locale]}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyWorkflowTemplate(template)}
                      className="h-10 shrink-0 rounded-sm bg-tertiary px-5 text-sm font-bold text-on-tertiary transition hover:brightness-110"
                    >
                      {t("templates.use")}
                    </button>
                  </div>
                  <ol className="mt-4 flex flex-wrap items-center gap-2">
                    {template.steps.map((step, index) => {
                      const owner = members.find((m) => m.id === step.assigneeId);
                      return (
                        <li key={index} className="flex items-center gap-2">
                          {index > 0 && <Arrow className="size-3.5 shrink-0 text-muted" aria-hidden />}
                          <span className="flex items-center gap-2 rounded-md bg-surface-container-low px-3 py-2">
                            <span className="grid size-5 place-items-center rounded-full bg-tertiary text-[10px] font-bold text-on-tertiary">{index + 1}</span>
                            <span className="text-sm font-semibold">{step.title[locale]}</span>
                            {owner && <span className="text-xs text-muted">· {owner.name[locale]}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ul>

            {/* Automation templates (trigger → action) */}
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {templates.map((template) => (
                <li key={template.id} className="flex flex-col rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
                  <h4 className="font-bold">{template.name[locale]}</h4>
                  <p className="mt-1 flex-1 text-sm text-on-surface-variant">{template.description[locale]}</p>
                  <button
                    type="button"
                    onClick={() => {
                      addFlow({ name: template.name, trigger: template.trigger, action: template.action });
                      setView((v) => (v === "templates" ? "all" : v));
                    }}
                    className="mt-4 h-10 rounded-sm bg-tertiary-fixed text-sm font-semibold text-tertiary transition hover:brightness-95"
                  >
                    {t("templates.use")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {creating && (
        <NewFlowDialog
          onClose={() => setCreating(false)}
          onCreate={(flow) => {
            addFlow(flow);
            setCreating(false);
            setView((v) => (v === "templates" ? "all" : v));
          }}
        />
      )}

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

function Stat({ icon: Icon, label, value, sub, progress }: { icon: LucideIcon; label: string; value: string; sub: string; progress?: number }) {
  return (
    <section className="rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold">{label}</h3>
        <span className="grid size-10 place-items-center rounded-md bg-primary-fixed text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-4xl font-extrabold">
        <span dir="ltr">{value}</span>
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{sub}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div className="h-full rounded-full bg-primary-container" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </section>
  );
}

function Step({ icon: Icon, label, text, className }: { icon: LucideIcon; label: string; text: string; className: string }) {
  return (
    <span className={cn("flex items-center gap-2 rounded-md px-3 py-2", className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="text-xs opacity-70">{label}:</span>
      <span className="font-semibold">{text}</span>
    </span>
  );
}

function NewFlowDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (flow: Omit<AutomationFlow, "id" | "runs" | "lastRun" | "enabled">) => void;
}) {
  const t = useTranslations("automation");
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
      <div role="dialog" aria-modal="true" aria-labelledby="new-flow-title" className="relative w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-ambient-lg sm:p-8">
        <header className="flex items-center justify-between gap-4">
          <h2 id="new-flow-title" className="text-xl font-extrabold">{t("dialog.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("dialog.close")} className="grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const text = (name: string, fallback: string) => {
              const value = String(data.get(name) ?? "").trim() || fallback;
              return { ar: value, en: value };
            };
            const condition = String(data.get("condition") ?? "").trim();
            // Frontend phase: fall back to the examples instead of blocking on empty fields
            onCreate({
              name: text("name", t("dialog.placeholders.name")),
              trigger: text("trigger", t("dialog.placeholders.trigger")),
              condition: condition ? { ar: condition, en: condition } : undefined,
              action: text("action", t("dialog.placeholders.action")),
            });
          }}
        >
          <Field label={t("dialog.name")} htmlFor="flowName">
            <Input ref={inputRef} id="flowName" name="name" placeholder={t("dialog.placeholders.name")} autoComplete="off" />
          </Field>
          <Field label={`1 · ${t("steps.trigger")}`} htmlFor="flowTrigger" hint={t("dialog.hints.trigger")}>
            <Input id="flowTrigger" name="trigger" placeholder={t("dialog.placeholders.trigger")} autoComplete="off" />
          </Field>
          <Field label={`2 · ${t("steps.condition")} (${t("dialog.optional")})`} htmlFor="flowCondition">
            <Input id="flowCondition" name="condition" placeholder={t("dialog.placeholders.condition")} autoComplete="off" />
          </Field>
          <Field label={`3 · ${t("steps.action")}`} htmlFor="flowAction">
            <Input id="flowAction" name="action" placeholder={t("dialog.placeholders.action")} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="h-11 rounded-sm bg-surface-container-low px-5 text-sm font-semibold hover:bg-surface-container">
              {t("dialog.cancel")}
            </button>
            <button type="submit" className="h-11 rounded-sm bg-tertiary px-6 text-sm font-bold text-on-tertiary transition hover:brightness-110">
              {t("dialog.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
