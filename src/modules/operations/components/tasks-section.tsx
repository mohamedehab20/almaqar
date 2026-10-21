"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, ListTodo, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/action";
import { createTask, deleteTask, updateTask } from "../actions";
import type { TaskBoard } from "../service";
import { isOverdue, taskPriorities, taskStatuses, type Task, type TaskPriority, type TaskStatus } from "../tasks";

type TasksSectionProps = {
  board: TaskBoard;
  /** null: the public demo (changes stay in the browser) */
  companyId: string | null;
  onNotice: (message: string) => void;
};

const priorityStyle: Record<TaskPriority, string> = {
  high: "bg-danger-container text-danger",
  medium: "bg-tertiary-fixed text-tertiary",
  low: "bg-surface-container text-on-surface-variant",
};

const columnStyle: Record<TaskStatus, string> = {
  todo: "border-t-outline-variant",
  in_progress: "border-t-primary",
  done: "border-t-success",
};

const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Team tasks: add, assign, move through to do → in progress → done, with overdue and priority at a glance.
 * A real company saves every change (createTask / updateTask / deleteTask); the demo keeps them in the browser.
 */
export function TasksSection({ board, companyId, onNotice }: TasksSectionProps) {
  const t = useTranslations("ops.tasks");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Forward = locale === "ar" ? ArrowLeft : ArrowRight;
  const Backward = locale === "ar" ? ArrowRight : ArrowLeft;
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState(board);
  const [tasks, setTasks] = useState<Task[]>(board.tasks);
  if (board !== source) {
    setSource(board);
    setTasks(board.tasks);
  }
  const { meId, members, operations } = board;
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(meId);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [operationId, setOperationId] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name[locale] ?? "—";
  const visible = tasks.filter((task) => !onlyMine || task.assigneeId === meId);
  const column = (status: TaskStatus) =>
    visible
      .filter((task) => task.status === status)
      .sort(
        (a, b) =>
          Number(isOverdue(b, today)) - Number(isOverdue(a, today)) ||
          priorityRank[a.priority] - priorityRank[b.priority] ||
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
      );

  /** Shows the change at once; a real company then saves it, and puts it back if the server says no. */
  function save(change: (prev: Task[]) => Task[], remote: () => Promise<ActionResult<unknown>>, success: string) {
    const before = tasks;
    setTasks(change);
    if (!companyId) return onNotice(success);
    startTransition(async () => {
      const result = await remote();
      if (!result.ok) {
        setTasks(before);
        return onNotice(result.error === "forbidden" ? t("notices.forbidden") : tErr(result.error));
      }
      onNotice(success);
      router.refresh();
    });
  }

  const addTask = () => {
    const body = title.trim();
    if (!body) return onNotice(t("notices.empty"));
    const task: Task = {
      id: `t-${Date.now()}`,
      title: body,
      assigneeId,
      createdById: meId,
      dueDate: dueDate || undefined,
      priority,
      status: "todo",
      operationId: operationId || undefined,
      createdAt: new Date().toISOString(),
    };
    save(
      (prev) => [task, ...prev],
      () => createTask({ companyId: companyId!, title: body, assigneeId, dueDate: dueDate || null, priority, operationId: operationId || null }),
      t("notices.added"),
    );
    setTitle("");
    setDueDate("");
    setPriority("medium");
    setOperationId("");
  };

  const move = (task: Task, status: TaskStatus) =>
    save(
      (prev) => prev.map((x) => (x.id === task.id ? { ...x, status } : x)),
      () => updateTask({ taskId: task.id, status }),
      status === "done" ? t("notices.done") : t("notices.moved"),
    );

  const remove = (task: Task) =>
    save(
      (prev) => prev.filter((x) => x.id !== task.id),
      () => deleteTask({ taskId: task.id }),
      t("notices.deleted"),
    );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold">
          <ListTodo className="size-5 text-primary" aria-hidden />
          {t("title")}
        </h3>
        <div className="flex gap-1 rounded-md bg-surface-container-low p-1" role="radiogroup" aria-label={t("title")}>
          {([false, true] as const).map((mine) => (
            <button
              key={String(mine)}
              type="button"
              role="radio"
              aria-checked={onlyMine === mine}
              onClick={() => setOnlyMine(mine)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-sm transition-colors",
                onlyMine === mine ? "bg-surface-container-lowest font-bold text-primary shadow-ambient" : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {mine ? t("mine") : t("all")}
            </button>
          ))}
        </div>
      </div>

      {/* New task */}
      <form
        className="grid gap-3 rounded-lg bg-surface-container-lowest p-4 shadow-ambient ghost-border md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] xl:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          addTask();
        }}
      >
        <label className="flex flex-col gap-1.5 text-xs font-semibold md:col-span-2 xl:col-span-1">
          {t("add")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("placeholder")}
            maxLength={200}
            className="h-11 rounded-md bg-surface-container-low px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold">
          {t("assignee")}
          <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="h-11 text-sm">
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name[locale]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold">
          {t("due")}
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-11 rounded-md bg-surface-container-low px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold">
          {t("priority")}
          <Select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className="h-11 text-sm">
            {taskPriorities.map((p) => (
              <option key={p} value={p}>
                {t(`priorities.${p}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold">
          {t("linkTo")}
          <Select value={operationId} onChange={(event) => setOperationId(event.target.value)} className="h-11 text-sm">
            <option value="">{t("noLink")}</option>
            {operations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.title[locale]}
              </option>
            ))}
          </Select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-on-primary hover:brightness-110"
        >
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </button>
      </form>

      {/* Board */}
      <div className="grid gap-4 lg:grid-cols-3">
        {taskStatuses.map((status) => {
          const items = column(status);
          return (
            <div key={status} className={cn("flex flex-col gap-3 rounded-lg border-t-4 bg-surface-container-low p-3", columnStyle[status])}>
              <h4 className="flex items-center justify-between px-1 text-sm font-bold">
                {t(`statuses.${status}`)}
                <span className="rounded-sm bg-surface-container-lowest px-2 text-xs">{items.length}</span>
              </h4>
              {items.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">{t("empty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((task) => {
                    const overdue = isOverdue(task, today);
                    const operation = operations.find((o) => o.id === task.operationId);
                    return (
                      <li
                        key={task.id}
                        className={cn(
                          "flex flex-col gap-2 rounded-md bg-surface-container-lowest p-3 shadow-ambient",
                          overdue && "ring-1 ring-danger/40",
                          task.status === "done" && "opacity-70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm font-semibold leading-6", task.status === "done" && "line-through")}>{task.title}</p>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", priorityStyle[task.priority])}>
                            {t(`priorities.${task.priority}`)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span className={cn("flex items-center gap-1", overdue && "font-bold text-danger")}>
                            {overdue ? <AlertTriangle className="size-3.5" aria-hidden /> : <CalendarDays className="size-3.5" aria-hidden />}
                            {task.dueDate ? (
                              <>
                                {overdue && `${t("overdue")} · `}
                                {t("dueLabel")}{" "}
                                <bdi dir="ltr" className="font-mono">
                                  {task.dueDate}
                                </bdi>
                              </>
                            ) : (
                              t("noDue")
                            )}
                          </span>
                          {operation && (
                            <span dir="ltr" className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-[11px] text-primary">
                              {operation.code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 border-t border-outline-variant/30 pt-2">
                          <Avatar name={memberName(task.assigneeId)} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{memberName(task.assigneeId)}</span>
                          {task.status === "todo" && (
                            <MoveButton onClick={() => move(task, "in_progress")} label={t("move.start")}>
                              <Forward className="size-4" aria-hidden />
                            </MoveButton>
                          )}
                          {task.status === "in_progress" && (
                            <>
                              <MoveButton onClick={() => move(task, "todo")} label={t("move.back")}>
                                <Backward className="size-4" aria-hidden />
                              </MoveButton>
                              <MoveButton onClick={() => move(task, "done")} label={t("move.finish")} tone="success">
                                <Check className="size-4" aria-hidden />
                              </MoveButton>
                            </>
                          )}
                          {task.status === "done" && (
                            <MoveButton onClick={() => move(task, "in_progress")} label={t("move.reopen")}>
                              <RotateCcw className="size-4" aria-hidden />
                            </MoveButton>
                          )}
                          <MoveButton onClick={() => remove(task)} label={t("delete")} tone="danger">
                            <Trash2 className="size-4" aria-hidden />
                          </MoveButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MoveButton({ onClick, label, tone, children }: { onClick: () => void; label: string; tone?: "success" | "danger"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-full text-muted transition-colors",
        tone === "success" ? "hover:bg-success-container hover:text-success" : tone === "danger" ? "hover:bg-danger-container hover:text-danger" : "hover:bg-surface-container hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
