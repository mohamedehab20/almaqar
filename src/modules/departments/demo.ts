/** Sample «إدارة الأقسام» for the public demo: the demo team, its departments with managers, every room on. */
import { departments, members } from "@/modules/hq/mock";
import { ROOMS } from "./rooms";
import type { DepartmentsData } from "./service";

const roomManagers: Record<string, string> = { hr: "m6", operations: "m2", automation: "m3", marketing: "m5", meetings: "m1" };
const departmentManagers: Record<string, string> = { "d-exec": "m1", "d-projects": "m2", "d-tech": "m3", "d-sales": "m5", "d-admin": "m6" };

export function demoDepartmentsData(): DepartmentsData {
  return {
    canRooms: true,
    canDepartments: true,
    rooms: ROOMS.map(({ key, soon }) => ({ key, soon, enabled: !soon, managerId: roomManagers[key] ?? null })),
    departments: departments.map((d) => ({
      ...d,
      active: true,
      managerId: departmentManagers[d.id] ?? null,
      memberCount: members.filter((m) => m.departmentId === d.id).length,
    })),
    members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, departmentId: m.departmentId })),
  };
}
