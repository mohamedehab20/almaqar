"use client";

import { ArrowLeft, ArrowRight, Check, Paperclip, CirclePlus, CornerUpLeft, GitBranch, Pencil, Play, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState, type Dispatch, type SetStateAction } from "react";
import { Avatar } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";
import { currentUserId, memberRole, members } from "@/modules/hq/mock";
import { applyRunAction, type RunStatus, type Workflow, type WorkflowRun } from "../workflows";
import { AttachmentChip } from "./attachment-chip";
import { WorkflowBuilderDialog } from "./workflow-builder-dialog";

const statusStyle: Record<RunStatus, string> = {
  in_progress: "bg-primary-fixed text-primary",
  changes_requested: "bg-tertiary-fixed text-tertiary",
  completed: "bg-success-container text-success",
  closed: "bg-danger-container text-danger",
};

/** Approval workflows as a flowchart: each step is owned by an employee; runs move forward on approval and back on rejection. */
type WorkflowsSectionProps = {
  workflows: Workflow[];
  setWorkflows: Dispatch<SetStateAction<Workflow[]>>;
  runs: WorkflowRun[];
  setRuns: Dispatch<SetStateAction<WorkflowRun[]>>;
  /** Run to show first (e.g. when opened from a task) */
  initialRunId?: string;
  /** Workflow to show first (e.g. one just created from a template) */
  initialWorkflowId?: string;
  onNotice: (message: string) => void;
};

export function WorkflowsSection({ workflows, setWorkflows, runs, setRuns, initialRunId, initialWorkflowId, onNotice }: WorkflowsSectionProps) {
  const t = useTranslations("automation.workflows");
  const locale = useLocale() as "ar" | "en";
  const Forward = locale === "ar" ? ArrowLeft : ArrowRight;
  const Back = locale === "ar" ? ArrowRight : ArrowLeft;

  const initialRun = runs.find((r) => r.id === initialRunId) ?? runs[0];
  const [workflowId, setWorkflowId] = useState(initialWorkflowId ?? initialRun?.workflowId ?? workflows[0].id);
  const [runId, setRunId] = useState<string | undefined>(
    initialWorkflowId ? runs.find((r) => r.workflowId === initialWorkflowId)?.id : initialRun?.id,
  );
  const [building, setBuilding] = useState(false);
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  const workflow = workflows.find((w) => w.id === workflowId) ?? workflows[0];
  const workflowRuns = runs.filter((r) => r.workflowId === workflow.id);
  const run = workflowRuns.find((r) => r.id === runId) ?? workflowRuns[0];
  const member = (id: string) => members.find((m) => m.id === id);
  const name = (id: string) => member(id)?.name[locale] ?? "—";

  const act = (action: "approve" | "reject" | "request_changes") => {
    if (!run) return;
    const next = applyRunAction(run, workflow, action, currentUserId, note.trim() || undefined);
    setRuns((prev) => prev.map((r) => (r.id === run.id ? next : r)));
    setNote("");
    const subjectText = run.subject[locale];
    if (next.status === "completed") onNotice(t("notices.completed", { subject: subjectText }));
    else if (next.status === "closed") onNotice(t("notices.closed", { subject: subjectText }));
    else onNotice(t(`notices.${action}`, { subject: subjectText, name: name(workflow.steps[next.currentStep].assigneeId) }));
  };

  const startRun = () => {
    const text = subject.trim() || t("defaultSubject", { workflow: workflow.name[locale] });
    const requester = workflow.steps[0].assigneeId;
    const created: WorkflowRun = {
      id: `run-${Date.now()}`,
      workflowId: workflow.id,
      subject: { ar: text, en: text },
      currentStep: 0,
      status: "in_progress",
      history: [{ action: "started", stepIndex: 0, byId: requester, at: new Date().toISOString() }],
    };
    setRuns((prev) => [created, ...prev]);
    setRunId(created.id);
    setSubject("");
    onNotice(t("notices.started", { subject: text, name: name(requester) }));
  };

  const active = run && (run.status === "in_progress" || run.status === "changes_requested");
  const atFirst = run?.currentStep === 0;
  const stepState = (index: number) => {
    if (!run) return "idle";
    if (run.status === "completed" || index < run.currentStep) return "done";
    if (index === run.currentStep) return run.status === "closed" ? "closed" : run.status === "changes_requested" ? "changes" : "current";
    return "upcoming";
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold">
          <GitBranch className="size-5 text-tertiary" aria-hidden />
          {t("title")}
        </h3>
        <button
          type="button"
          onClick={() => setBuilding(true)}
          className="flex h-10 items-center gap-2 rounded-sm bg-surface-container-lowest px-4 text-sm font-semibold text-tertiary ghost-border hover:bg-tertiary-fixed"
        >
          <CirclePlus className="size-4" aria-hidden />
          {t("create")}
        </button>
      </div>

      {/* Workflow picker */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("title")}>
        {workflows.map((w) => (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={w.id === workflow.id}
            onClick={() => {
              setWorkflowId(w.id);
              setRunId(runs.find((r) => r.workflowId === w.id)?.id);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
              w.id === workflow.id ? "bg-tertiary font-bold text-on-tertiary" : "bg-surface-container-lowest ghost-border hover:bg-surface-container-low",
            )}
          >
            {w.name[locale]}
            <span className={cn("rounded-sm px-1.5 text-xs", w.id === workflow.id ? "bg-white/20" : "bg-surface-container")}>
              {t("stepsCount", { count: w.steps.length })}
            </span>
          </button>
        ))}
      </div>

      {/* Flowchart */}
      <div className="overflow-x-auto rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
        <ol className="flex min-w-max items-stretch gap-0">
          {workflow.steps.map((stepDef, index) => {
            const state = stepState(index);
            const assignee = member(stepDef.assigneeId);
            return (
              <Fragment key={stepDef.id}>
                {index > 0 && (
                  <li aria-hidden className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 px-1 text-[10px] font-semibold">
                    <span className="flex w-full items-center gap-1 text-success">
                      <span className="h-0.5 flex-1 bg-success/60" />
                      <Forward className="size-3.5" />
                    </span>
                    <span className="text-success">{t("approveArrow")}</span>
                    <span className="text-danger">{t("rejectArrow")}</span>
                    <span className="flex w-full items-center gap-1 text-danger">
                      <Back className="size-3.5" />
                      <span className="h-0 flex-1 border-t-2 border-dashed border-danger/50" />
                    </span>
                  </li>
                )}
                <li
                  className={cn(
                    "flex w-48 shrink-0 flex-col gap-3 rounded-lg p-4 transition",
                    state === "current" && "bg-primary-fixed/50 ring-2 ring-primary-container",
                    state === "changes" && "bg-tertiary-fixed ring-2 ring-tertiary/60",
                    state === "closed" && "bg-danger-container/50 ring-2 ring-danger/40",
                    state === "done" && "bg-success-container/50",
                    (state === "upcoming" || state === "idle") && "bg-surface-container-low",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-7 place-items-center rounded-full bg-surface-container-lowest font-mono text-xs font-bold">{index + 1}</span>
                    {state !== "upcoming" && state !== "idle" && (
                      <span className={cn("rounded-sm px-2 py-0.5 text-[10px] font-bold", {
                        "bg-success text-white": state === "done",
                        "bg-primary-container text-white": state === "current",
                        "bg-tertiary text-white": state === "changes",
                        "bg-danger text-white": state === "closed",
                      })}>
                        {t(`stepStates.${state}`)}
                      </span>
                    )}
                  </div>
                  <p className="font-bold leading-snug">{stepDef.title[locale]}</p>
                  {assignee && (
                    <div className="mt-auto flex items-center gap-2">
                      <Avatar name={assignee.name[locale]} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{assignee.name[locale]}</span>
                        <span className="block truncate text-[10px] text-muted" title={memberRole(assignee, locale)}>{memberRole(assignee, locale)}</span>
                      </span>
                    </div>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
        <p className="mt-4 flex items-center gap-2 text-xs text-on-surface-variant">
          <CornerUpLeft className="size-3.5 text-tertiary" aria-hidden />
          {t("changesRule", { name: name(workflow.steps[0].assigneeId) })}
        </p>
        {workflow.attachments && workflow.attachments.length > 0 && (
          <div className="mt-4 border-t border-outline-variant/30 pt-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
              <Paperclip className="size-3.5" aria-hidden />
              {t("attachments", { count: workflow.attachments.length })}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {workflow.attachments.map((attachment) => (
                <AttachmentChip key={attachment.id} attachment={attachment} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Runs on this workflow */}
        <div className="flex flex-col gap-3 rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
          <h4 className="font-bold">{t("runs.title")}</h4>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startRun();
            }}
          >
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t("runs.subjectPlaceholder")}
              aria-label={t("runs.subject")}
              className="h-10 min-w-0 flex-1 rounded-sm bg-surface-container-low px-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/20"
            />
            <button type="submit" className="flex h-10 shrink-0 items-center gap-1.5 rounded-sm bg-tertiary px-3 text-sm font-bold text-on-tertiary hover:brightness-110">
              <Play className="size-4" aria-hidden />
              {t("runs.start")}
            </button>
          </form>
          {workflowRuns.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("runs.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {workflowRuns.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-pressed={r.id === run?.id}
                    onClick={() => setRunId(r.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md p-3 text-start transition-colors",
                      r.id === run?.id ? "bg-primary-fixed/50 ring-1 ring-primary-container/40" : "bg-surface-container-low hover:bg-surface-container",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.subject[locale]}</span>
                      <span className="block text-xs text-muted">
                        {r.status === "completed" || r.status === "closed"
                          ? t(`runs.status.${r.status}`)
                          : t("runs.waitingFor", { name: name(workflow.steps[r.currentStep].assigneeId) })}
                      </span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", statusStyle[r.status])}>
                      {t(`runs.status.${r.status}`)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected run: actions + history */}
        {run && (
          <div className="flex flex-col gap-4 rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="font-bold">{run.subject[locale]}</h4>
                {active && (
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {t("runs.nowAt", { step: workflow.steps[run.currentStep].title[locale], name: name(workflow.steps[run.currentStep].assigneeId) })}
                  </p>
                )}
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusStyle[run.status])}>{t(`runs.status.${run.status}`)}</span>
            </div>

            {active && (
              <div className="flex flex-col gap-3 rounded-md bg-surface-container-low p-4">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder={t("actions.notePlaceholder")}
                  aria-label={t("actions.note")}
                  className="w-full resize-y rounded-sm bg-surface-container-lowest p-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => act("approve")} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-sm bg-tertiary px-3 text-sm font-bold text-on-tertiary hover:brightness-110">
                    <Check className="size-4" aria-hidden />
                    {run.status === "changes_requested" ? t("actions.resubmit") : atFirst ? t("actions.submit") : t("actions.approve")}
                  </button>
                  {!atFirst && (
                    <button type="button" onClick={() => act("request_changes")} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-sm bg-surface-container-lowest px-3 text-sm ghost-border hover:bg-surface-container">
                      <Pencil className="size-3.5" aria-hidden />
                      {t("actions.requestChanges")}
                    </button>
                  )}
                  <button type="button" onClick={() => act("reject")} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-sm bg-danger-container px-3 text-sm font-semibold text-danger hover:brightness-95">
                    {atFirst ? <X className="size-4" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
                    {atFirst ? t("actions.cancel") : t("actions.reject")}
                  </button>
                </div>
                {!atFirst && (
                  <p className="text-[11px] text-muted">
                    {t("actions.hint", { previous: name(workflow.steps[run.currentStep - 1].assigneeId), first: name(workflow.steps[0].assigneeId) })}
                  </p>
                )}
              </div>
            )}

            <div>
              <h5 className="text-sm font-bold">{t("history.title")}</h5>
              <ol className="mt-2 flex flex-col gap-2 border-s-2 border-outline-variant/40 ps-4">
                {[...run.history].reverse().map((entry, index) => (
                  <li key={index} className="text-xs">
                    <span className="font-semibold">{name(entry.byId)}</span>{" "}
                    <span className="text-on-surface-variant">
                      {t(`history.${entry.action}`)} — {workflow.steps[entry.stepIndex]?.title[locale]}
                    </span>
                    <span className="ms-2 font-mono text-[10px] text-muted" dir="ltr">
                      {entry.at.slice(0, 16).replace("T", " ")}
                    </span>
                    {entry.note && <p className="mt-0.5 text-muted">“{entry.note}”</p>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      {building && (
        <WorkflowBuilderDialog
          onClose={() => setBuilding(false)}
          onCreate={(created) => {
            setWorkflows((prev) => [...prev, created]);
            setWorkflowId(created.id);
            setRunId(undefined);
            setBuilding(false);
            onNotice(t("notices.created", { name: created.name[locale] }));
          }}
        />
      )}
    </section>
  );
}
