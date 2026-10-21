"use client";

import { CalendarClock, ChartColumn, ChevronDown, ListTodo, Plus, ScrollText, StickyNote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { startOperation } from "../actions";
import type { OpsCategory, WorkflowRow } from "../mock";
import { OPS_CATEGORIES } from "../rows";
import type { OperationsData } from "../service";
import { AddOperationDialog, type NewOperation } from "./add-operation-dialog";
import { KpiCards } from "./kpi-cards";
import { NotesSection } from "./notes-section";
import { TasksSection } from "./tasks-section";
import { ScheduleSection } from "./schedule-section";
import { WorkflowsTable } from "./workflows-table";

/**
 * Operations room: the operations log by category, the Analysis figures, notes, tasks and the schedule.
 * `companyId` null = the public demo (changes stay in the browser); a real company saves through the actions.
 */
export function OperationsView({ data, companyId }: { data: OperationsData; companyId: string | null }) {
  const t = useTranslations("ops");
  const tErr = useTranslations("auth.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<OpsCategory | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [source, setSource] = useState(data);
  const [allRows, setAllRows] = useState<WorkflowRow[]>(data.rows);
  if (data !== source) {
    setSource(data);
    setAllRows(data.rows);
  }
  const [adding, setAdding] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const openTasks = data.tasks.tasks.filter((task) => task.status !== "done").length;
  const operations = allRows.map((r) => ({ id: r.id, code: r.code, title: r.title }));
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const toggleSchedule = () => setScheduleOpen((open) => !open);
  const locale = useLocale() as "ar" | "en";

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const rows = category === "all" ? allRows : allRows.filter((row) => row.category === category);
  // Per category: the saved count, plus rows added in this session (the demo keeps them in the browser)
  const countOf = (key: OpsCategory) => (data.counts[key] ?? 0) + allRows.filter((r) => r.category === key).length - data.rows.filter((r) => r.category === key).length;
  const total = OPS_CATEGORIES.reduce((sum, key) => sum + countOf(key), 0);

  const addOperation = ({ name, category: newCategory, nature }: NewOperation) => {
    const done = () => {
      setAdding(false);
      setCategory("all");
      setNotice(t("add.added", { name }));
    };
    if (companyId) {
      startTransition(async () => {
        const res = await startOperation({ companyId, subject: { ar: name, en: name }, category: newCategory, nature });
        if (!res.ok) return setNotice(res.error === "forbidden" ? t("add.forbidden") : tErr(res.error));
        done();
        router.refresh();
      });
      return;
    }
    const me = data.people.find((m) => m.id === data.meId);
    const both = (text: string) => ({ ar: text, en: text });
    const row: WorkflowRow = {
      id: `new-${Date.now()}`,
      code: `OP-${1048 + allRows.length - data.rows.length}`,
      category: newCategory,
      title: both(name),
      categoryLabel: both(t(`tabs.${newCategory}`)),
      owner: { name: me?.name ?? both("—"), role: me?.title ?? both("") },
      step: { title: both(t("add.firstStep")), by: both(t("add.firstStepBy")), tone: "muted" },
      nature,
      deciders: nature === "human" ? [(me?.name[locale] ?? "—").charAt(0)] : both(t("add.noHuman")),
      status: nature === "human" ? "pending" : "processing",
    };
    setAllRows((prev) => [row, ...prev]);
    done();
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
              <span className="rounded-sm bg-surface-container px-1.5 text-xs">{data.notes.length}</span>
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
            <button
              type="button"
              onClick={toggleSchedule}
              aria-expanded={scheduleOpen}
              aria-controls="ops-schedule"
              className={cn(
                "flex h-11 items-center gap-2 rounded-sm px-4 text-sm font-semibold ghost-border transition-colors",
                scheduleOpen ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <CalendarClock className="size-4" aria-hidden />
              {t("schedule.title")}
              <ChevronDown className={cn("size-4 transition-transform", scheduleOpen && "rotate-180")} aria-hidden />
            </button>
          </div>
        </header>

        {analysisOpen && (
          <section id="ops-analysis" aria-label={t("analysis")}>
            <KpiCards kpis={data.kpis} />
          </section>
        )}

        {notesOpen && (
          <div id="ops-notes">
            <NotesSection notes={data.notes} meId={data.meId} people={data.people} departments={data.departments} operations={operations} companyId={companyId} onNotice={setNotice} />
          </div>
        )}

        {tasksOpen && (
          <div id="ops-tasks">
            <TasksSection board={data.tasks} companyId={companyId} onNotice={setNotice} />
          </div>
        )}

        {scheduleOpen && (
          <div id="ops-schedule">
            <ScheduleSection board={data.schedule} companyId={companyId} onNotice={setNotice} />
          </div>
        )}

        {/* Category tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-lowest p-2 shadow-ambient">
          <nav className="flex flex-wrap gap-1">
            <CategoryTab active={category === "all"} onClick={() => setCategory("all")}>
              {t("tabs.all")} ({total})
            </CategoryTab>
            {OPS_CATEGORIES.map((key) => (
              <CategoryTab key={key} active={category === key} onClick={() => setCategory(key)}>
                {t(`tabs.${key}`)} ({countOf(key)})
              </CategoryTab>
            ))}
          </nav>
        </div>

        <WorkflowsTable rows={rows} onNotice={setNotice} />
      </div>

      {adding && <AddOperationDialog onClose={() => setAdding(false)} onAdd={(op) => !pending && addOperation(op)} />}

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
