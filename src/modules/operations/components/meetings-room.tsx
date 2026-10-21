"use client";

import { CalendarClock, ListTodo, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { ApprovalsSection } from "@/modules/approvals/components/approvals-section";
import type { ApprovalsData } from "@/modules/approvals/service";
import type { ScheduleBoard, TaskBoard } from "../service";
import { ScheduleSection } from "./schedule-section";
import { TasksSection } from "./tasks-section";

export type MeetingsTab = "schedule" | "tasks" | "approvals";

const subscribe = () => () => {};

/**
 * «غرفة الاجتماعات»: the company schedule (meetings, appointments, trips outside, interviews) next to
 * task management (demo data, built in the browser so dates follow the viewer's clock), and «الاعتماد»
 * (approval requests between colleagues, saved for a real company; `companyId` null = the public demo).
 */
export function MeetingsRoom({ initialTab = "schedule", approvals, tasks, schedule, companyId }: { initialTab?: MeetingsTab; approvals: ApprovalsData; tasks: TaskBoard; schedule: ScheduleBoard; companyId: string | null }) {
  const t = useTranslations("meetings");
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [tab, setTab] = useState<MeetingsTab>(initialTab);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-8">
        <header>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
          <p className="mt-1 text-on-surface-variant">{t("subtitle")}</p>
        </header>

        <div role="tablist" aria-label={t("title")} className="flex w-fit flex-wrap gap-2">
          {(
            [
              ["tasks", ListTodo],
              ["schedule", CalendarClock],
              ["approvals", Stamp],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex h-11 items-center gap-2 rounded-sm px-5 text-sm font-semibold ghost-border transition-colors",
                tab === key ? "bg-primary-fixed text-primary" : "bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>

        {tab === "approvals" ? (
          <ApprovalsSection data={approvals} companyId={companyId} onNotice={setNotice} />
        ) : mounted ? (
          <RoomContent tab={tab} tasks={tasks} schedule={schedule} companyId={companyId} onNotice={setNotice} />
        ) : (
          <div className="h-64 animate-pulse rounded-lg bg-surface-container-low" aria-busy="true" />
        )}
      </div>

      {notice && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-md bg-inverse-surface px-5 py-3 text-center text-sm text-inverse-on-surface shadow-ambient-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

/** Mounted only in the browser: the demo schedule is built from the viewer's own date. */
function RoomContent({ tab, tasks, schedule, companyId, onNotice }: { tab: "schedule" | "tasks"; tasks: TaskBoard; schedule: ScheduleBoard; companyId: string | null; onNotice: (message: string) => void }) {
  return tab === "schedule" ? (
    <ScheduleSection board={schedule} companyId={companyId} onNotice={onNotice} />
  ) : (
    <TasksSection board={tasks} companyId={companyId} onNotice={onNotice} />
  );
}
