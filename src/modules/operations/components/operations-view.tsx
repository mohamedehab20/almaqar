"use client";

import { ChartColumn, ChevronDown, ListTodo, Plus, ScrollText, StickyNote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { currentUserId, members } from "@/modules/hq/mock";
import { categoryCounts, kpis, workflowRows, type OpsCategory, type WorkflowRow } from "../mock";
import { AddOperationDialog, type NewOperation } from "./add-operation-dialog";
import { KpiCards } from "./kpi-cards";
import { notes as demoNotes, type Note } from "../notes";
import { NotesSection } from "./notes-section";
import { tasks as demoTasks, type Task } from "../tasks";
import { TasksSection } from "./tasks-section";
import { WorkflowsTable } from "./workflows-table";

const categories = Object.keys(categoryCounts) as OpsCategory[];

export function OperationsView() {
  const t = useTranslations("ops");
  const [category, setCategory] = useState<OpsCategory | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<WorkflowRow[]>(workflowRows);
  const [adding, setAdding] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>(demoNotes);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(demoTasks);
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const locale = useLocale() as "ar" | "en";

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const rows = category === "all" ? allRows : allRows.filter((row) => row.category === category);
  // Rows added in this session on top of the demo totals
  const added = allRows.length - workflowRows.length;
  const addedIn = (key: OpsCategory) => allRows.filter((row) => row.category === key).length - workflowRows.filter((row) => row.category === key).length;
  const total = kpis.activeWorkflows.value + added;

  const addOperation = ({ name, category: newCategory, nature }: NewOperation) => {
    // TODO(backend): create the workflow instance on the server
    const me = members.find((m) => m.id === currentUserId)!;
    const both = (text: string) => ({ ar: text, en: text });
    const row: WorkflowRow = {
      id: `new-${Date.now()}`,
      code: `OP-${1048 + added}`,
      category: newCategory,
      title: both(name),
      categoryLabel: both(t(`tabs.${newCategory}`)),
      owner: { name: me.name, role: me.title },
      step: { title: both(t("add.firstStep")), by: both(t("add.firstStepBy")), tone: "muted" },
      nature,
      deciders: nature === "human" ? [me.name[locale].charAt(0)] : both(t("add.noHuman")),
      status: nature === "human" ? "pending" : "processing",
    };
    setAllRows((prev) => [row, ...prev]);
    setAdding(false);
    setCategory("all");
    setNotice(t("add.added", { name }));
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 p-4 sm:p-8">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p dir="ltr" className="text-left font-mono text-xs tracking-wider text-tertiary rtl:text-right">
              {t("breadcrumb")}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setNotice(t("comingSoon"))}
              className="flex h-11 items-center gap-2 rounded-sm bg-surface-container-lowest px-4 text-sm font-semibold ghost-border hover:bg-surface-container-low"
            >
              <ScrollText className="size-4" aria-hidden />
              {t("auditLog")}
              <span className="rounded-sm bg-surface-container px-1.5 font-mono text-[10px]">LOGS</span>
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-11 items-center gap-2 rounded-sm bg-surface-container-lowest px-4 text-sm font-semibold text-tertiary ghost-border hover:bg-tertiary-fixed"
            >
              <Plus className="size-4" aria-hidden />
              {t("add.button")}
            </button>
            <button
              type="button"
              onClick={() => setAnalysisOpen((open) => !open)}
              aria-expanded={analysisOpen}
              aria-controls="ops-analysis"
              className={cn(
                "flex h-11 items-center gap-2 rounded-sm px-4 text-sm font-semibold ghost-border transition-colors",
                analysisOpen ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <ChartColumn className="size-4" aria-hidden />
              {t("analysis")}
              <ChevronDown className={cn("size-4 transition-transform", analysisOpen && "rotate-180")} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              aria-expanded={notesOpen}
              aria-controls="ops-notes"
              className={cn(
                "flex h-11 items-center gap-2 rounded-sm px-4 text-sm font-semibold ghost-border transition-colors",
                notesOpen ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <StickyNote className="size-4" aria-hidden />
              {t("notes.title")}
              <span className="rounded-sm bg-surface-container px-1.5 text-xs">{notes.length}</span>
              <ChevronDown className={cn("size-4 transition-transform", notesOpen && "rotate-180")} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setTasksOpen((open) => !open)}
              aria-expanded={tasksOpen}
              aria-controls="ops-tasks"
              className={cn(
                "flex h-11 items-center gap-2 rounded-sm px-4 text-sm font-semibold ghost-border transition-colors",
                tasksOpen ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <ListTodo className="size-4" aria-hidden />
              {t("tasks.title")}
              <span className="rounded-sm bg-surface-container px-1.5 text-xs">{openTasks}</span>
              <ChevronDown className={cn("size-4 transition-transform", tasksOpen && "rotate-180")} aria-hidden />
            </button>
          </div>
        </header>

        {analysisOpen && (
          <section id="ops-analysis" aria-label={t("analysis")}>
            <KpiCards />
          </section>
        )}

        {notesOpen && (
          <div id="ops-notes">
            <NotesSection notes={notes} setNotes={setNotes} operations={allRows} onNotice={setNotice} />
          </div>
        )}

        {tasksOpen && (
          <div id="ops-tasks">
            <TasksSection tasks={tasks} setTasks={setTasks} operations={allRows} onNotice={setNotice} />
          </div>
        )}

        {/* Category tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-lowest p-2 shadow-ambient">
          <nav className="flex flex-wrap gap-1">
            <CategoryTab active={category === "all"} onClick={() => setCategory("all")}>
              {t("tabs.all")} ({total})
            </CategoryTab>
            {categories.map((key) => (
              <CategoryTab key={key} active={category === key} onClick={() => setCategory(key)}>
                {t(`tabs.${key}`)} ({categoryCounts[key] + addedIn(key)})
              </CategoryTab>
            ))}
          </nav>
        </div>

        <WorkflowsTable rows={rows} onNotice={setNotice} />
      </div>

      {adding && <AddOperationDialog onClose={() => setAdding(false)} onAdd={addOperation} />}

      {notice && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg"
        >
          {notice}
        </p>
      )}
    </div>
  );
}

function CategoryTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-sm px-4 py-2 text-sm transition-colors",
        active ? "bg-tertiary font-bold text-on-tertiary" : "text-on-surface-variant hover:bg-surface-container-low",
      )}
    >
      {children}
    </button>
  );
}
