import type { EventSeverity, EventSource, EventType } from "./types";

type Localized = { ar: string; en: string };

export type EventTypeConfig = {
  type: EventType;
  label: Localized;
  /** Severity a new event of this type gets unless the producer says otherwise */
  defaultSeverity: EventSeverity;
};

/**
 * Every event type the system knows about. Used for display labels and as the options of the
 * "event type" dropdown when creating an automation rule. Keep it grouped by domain.
 */
export const EVENT_TYPES = [
  // Orders
  { type: "order.created", label: { ar: "طلب جديد", en: "Order created" }, defaultSeverity: "info" },
  { type: "order.approved", label: { ar: "اعتماد طلب", en: "Order approved" }, defaultSeverity: "info" },
  { type: "order.cancelled", label: { ar: "إلغاء طلب", en: "Order cancelled" }, defaultSeverity: "warning" },
  // Payments
  { type: "payment.received", label: { ar: "استلام دفعة", en: "Payment received" }, defaultSeverity: "info" },
  { type: "payment.failed", label: { ar: "فشل الدفع", en: "Payment failed" }, defaultSeverity: "critical" },
  // Tasks
  { type: "task.created", label: { ar: "مهمة جديدة", en: "Task created" }, defaultSeverity: "info" },
  { type: "task.completed", label: { ar: "إنجاز مهمة", en: "Task completed" }, defaultSeverity: "info" },
  { type: "task.overdue", label: { ar: "تأخر مهمة", en: "Task overdue" }, defaultSeverity: "warning" },
  // Approvals
  { type: "approval.requested", label: { ar: "طلب موافقة", en: "Approval requested" }, defaultSeverity: "info" },
  { type: "approval.overdue", label: { ar: "تأخر موافقة", en: "Approval overdue" }, defaultSeverity: "warning" },
  // People
  { type: "leave.requested", label: { ar: "طلب إجازة", en: "Leave requested" }, defaultSeverity: "info" },
  { type: "leave.approved", label: { ar: "اعتماد إجازة", en: "Leave approved" }, defaultSeverity: "info" },
  { type: "leave.rejected", label: { ar: "رفض إجازة", en: "Leave rejected" }, defaultSeverity: "info" },
  { type: "leave.cancelled", label: { ar: "إلغاء إجازة", en: "Leave cancelled" }, defaultSeverity: "info" },
  { type: "candidate.added", label: { ar: "مرشح جديد", en: "Candidate added" }, defaultSeverity: "info" },
  { type: "candidate.hired", label: { ar: "تعيين مرشح", en: "Candidate hired" }, defaultSeverity: "info" },
  { type: "employee.joined", label: { ar: "انضمام موظف", en: "Employee joined" }, defaultSeverity: "info" },
  // Automation
  { type: "automation.triggered", label: { ar: "تشغيل أتمتة", en: "Automation triggered" }, defaultSeverity: "info" },
  { type: "automation.failed", label: { ar: "فشل أتمتة", en: "Automation failed" }, defaultSeverity: "critical" },
  // Integrations & access
  { type: "integration.disconnected", label: { ar: "انقطاع تكامل", en: "Integration disconnected" }, defaultSeverity: "critical" },
  { type: "user.login", label: { ar: "تسجيل دخول", en: "User logged in" }, defaultSeverity: "info" },
] as const satisfies readonly EventTypeConfig[];

/** Union of the known event types, e.g. "payment.failed" */
export type KnownEventType = (typeof EVENT_TYPES)[number]["type"];

export type SeverityConfig = {
  label: Localized;
  /** Badge background + text (Tailwind classes from the design tokens) */
  badgeClass: string;
  /** Small status dot */
  dotClass: string;
  /** Raw color for charts or anything outside Tailwind */
  color: string;
};

export const SEVERITY_CONFIG: Record<EventSeverity, SeverityConfig> = {
  info: {
    label: { ar: "معلومة", en: "Info" },
    badgeClass: "bg-primary-fixed text-primary",
    dotClass: "bg-primary-container",
    color: "#2563eb",
  },
  warning: {
    label: { ar: "تحذير", en: "Warning" },
    badgeClass: "bg-amber-100 text-amber-800",
    dotClass: "bg-amber-500",
    color: "#f59e0b",
  },
  critical: {
    label: { ar: "حرج", en: "Critical" },
    badgeClass: "bg-danger-container text-danger",
    dotClass: "bg-danger",
    color: "#ba1a1a",
  },
};

/** Severities from least to most severe (for sorting or "at least warning" filters) */
export const SEVERITY_ORDER: readonly EventSeverity[] = ["info", "warning", "critical"];

export const SOURCE_LABELS: Record<EventSource, Localized> = {
  system: { ar: "النظام", en: "System" },
  user: { ar: "مستخدم", en: "User" },
  automation: { ar: "أتمتة", en: "Automation" },
  integration: { ar: "تكامل خارجي", en: "Integration" },
};
