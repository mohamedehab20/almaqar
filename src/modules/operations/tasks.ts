/** Team tasks in the Operations room (demo data until the screens are wired to the backend). */

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  /** Member responsible for it */
  assigneeId: string;
  createdById: string;
  /** yyyy-mm-dd */
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** Optional operation (row id in the operations log) the task belongs to */
  operationId?: string;
  createdAt: string;
};

export const taskStatuses: TaskStatus[] = ["todo", "in_progress", "done"];
export const taskPriorities: TaskPriority[] = ["high", "medium", "low"];

/** Overdue: has a due date before today and is not done. `today` is yyyy-mm-dd (local). */
export const isOverdue = (task: Task, today: string) => task.status !== "done" && !!task.dueDate && task.dueDate < today;

export const tasks: Task[] = [
  {
    id: "t1",
    title: "تأكيد الكميات مع المورد قبل الشحن",
    assigneeId: "m2",
    createdById: "m1",
    dueDate: "2026-10-15",
    priority: "high",
    status: "in_progress",
    operationId: "w5",
    createdAt: "2026-10-11T09:00:00",
  },
  {
    id: "t2",
    title: "تجهيز شهادة الإنجاز للمقاول",
    assigneeId: "m5",
    createdById: "m1",
    dueDate: "2026-10-10",
    priority: "high",
    status: "todo",
    createdAt: "2026-10-09T14:30:00",
  },
  {
    id: "t3",
    title: "مراجعة عقد الصيانة السنوي",
    assigneeId: "m1",
    createdById: "m2",
    dueDate: "2026-10-20",
    priority: "medium",
    status: "todo",
    createdAt: "2026-10-12T11:10:00",
  },
  {
    id: "t4",
    title: "تحديث لوحة متابعة المشتريات",
    assigneeId: "m3",
    createdById: "m1",
    priority: "low",
    status: "todo",
    createdAt: "2026-10-12T16:45:00",
  },
  {
    id: "t5",
    title: "إرسال عرض السعر لمخبز الصباح",
    assigneeId: "m6",
    createdById: "m2",
    dueDate: "2026-10-08",
    priority: "medium",
    status: "done",
    createdAt: "2026-10-06T10:00:00",
  },
];
