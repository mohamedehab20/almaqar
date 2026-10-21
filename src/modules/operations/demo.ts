/** Demo data for the public demo (/c/demo): the Operations room and the task board, from the sample data. */
import { currentUserId, departments, members } from "@/modules/hq/mock";
import { DEFAULT_WORK_SETTINGS } from "@/modules/hours/calc";
import { clients } from "@/modules/marketing/sections-mock";
import { categoryCounts, kpis, workflowRows } from "./mock";
import { notes } from "./notes";
import type { OperationsData, ScheduleBoard, TaskBoard } from "./service";
import { tasks } from "./tasks";

export function demoTaskBoard(): TaskBoard {
  return {
    meId: currentUserId,
    tasks,
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title })),
    operations: workflowRows.map((w) => ({ id: w.id, code: w.code, title: w.title })),
  };
}

/** The demo schedule is built in the browser from today (ScheduleSection), so items stay empty here. */
export function demoScheduleBoard(): ScheduleBoard {
  return {
    meId: currentUserId,
    timeZone: DEFAULT_WORK_SETTINGS.timeZone,
    items: [],
    members: members.map((m) => ({ id: m.id, name: m.name })),
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}

export function demoOperationsData(): OperationsData {
  return {
    meId: currentUserId,
    people: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    rows: workflowRows,
    counts: categoryCounts,
    kpis: {
      active: kpis.activeWorkflows.value,
      total: Math.round(kpis.activeWorkflows.value / kpis.activeWorkflows.progress),
      pending: kpis.pendingApprovals.value,
      oldest: kpis.pendingApprovals.oldest,
      cycleHours: kpis.cycleTime.hours,
      periodDays: 30,
      trend: kpis.activeWorkflows.trend,
      previousHours: kpis.cycleTime.previousHours,
      saved: kpis.cycleTime.saved,
    },
    notes,
    tasks: demoTaskBoard(),
    schedule: demoScheduleBoard(),
  };
}
