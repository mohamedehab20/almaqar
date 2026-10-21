/** The Automation room for the public demo (/c/demo): sample workflows, runs, flows and figures. */
import { currentUserId, members } from "@/modules/hq/mock";
import { automationStats, flows } from "./mock";
import type { AutomationData } from "./service";
import { runs, workflows } from "./workflows";

export function demoAutomationData(): AutomationData {
  return {
    meId: currentUserId,
    people: members.map((m) => ({ id: m.id, name: m.name, title: m.title })),
    workflows,
    runs,
    flows,
    stats: automationStats,
  };
}
