import type { Event, EventSeverity, EventSource, EventType, EventPayload } from "./types";

/**
 * Demo events spread over the last 24 hours. Times are relative to `now`, so the data never goes
 * stale ("today" filters keep working). Payloads reuse ids from the other demo modules
 * (sales orders, automation flows, members) so screens can cross-link them later.
 */
type Seed = [minutesAgo: number, type: EventType, source: EventSource, severity: EventSeverity, payload: EventPayload];

const seeds: Seed[] = [
  [6, "payment.failed", "integration", "critical", { orderId: "SO-1022", amount: 12000, currency: "SAR", gateway: "Moyasar", reason: "card_declined" }],
  [14, "order.created", "user", "info", { orderId: "SO-1023", clientId: "c1", amount: 9000, createdBy: "m1" }],
  [27, "automation.triggered", "automation", "info", { flowId: "f1", flowName: "تصعيد الموافقات المتأخرة", target: "PO-2041" }],
  [41, "approval.overdue", "system", "warning", { requestId: "PO-2041", waitingHours: 26, approverId: "m1" }],
  [58, "task.completed", "user", "info", { taskId: "T-311", title: "هيكل البيانات", completedBy: "m3" }],
  [95, "integration.disconnected", "integration", "critical", { integration: "X", accountId: "a6", clientId: "c5" }],
  [130, "user.login", "user", "info", { userId: "m2", device: "web" }],
  [175, "task.overdue", "system", "warning", { taskId: "T-298", title: "تصميم لوحة التحكم", assigneeId: "m4", daysLate: 2 }],
  [220, "payment.received", "integration", "info", { orderId: "SO-1020", amount: 15000, currency: "SAR" }],
  [290, "automation.failed", "automation", "critical", { flowId: "f5", flowName: "ملخص الإدارة اليومي", error: "ai_service_timeout" }],
  [360, "leave.requested", "user", "info", { employeeId: "m6", from: "2026-10-20", to: "2026-10-22" }],
  [430, "order.approved", "user", "info", { orderId: "SO-1021", approvedBy: "m1", amount: 31500 }],
  [520, "approval.requested", "system", "info", { requestId: "SO-1022", type: "sale", amount: 12000 }],
  [640, "order.cancelled", "user", "warning", { orderId: "PO-2039", reason: "supplier_out_of_stock" }],
  [780, "employee.joined", "user", "info", { employeeId: "m7", department: "d-admin" }],
  [900, "automation.triggered", "automation", "info", { flowId: "f4", flowName: "مزامنة الحضور الذكية", records: 42 }],
  [1080, "task.created", "user", "info", { taskId: "T-315", title: "حملة العميل X", assigneeId: "m2" }],
  [1260, "task.overdue", "system", "warning", { taskId: "T-287", title: "مراجعة البنود الجزائية", assigneeId: "m5", daysLate: 1 }],
  [1390, "payment.failed", "integration", "critical", { orderId: "PO-2042", amount: 29500, currency: "SAR", gateway: "bank_transfer", reason: "insufficient_funds" }],
];

export function createMockEvents(now: Date = new Date()): Event[] {
  return seeds.map(([minutesAgo, type, source, severity, payload], index) => ({
    id: `evt_${String(index + 1).padStart(3, "0")}`,
    type,
    source,
    severity,
    payload,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  }));
}
