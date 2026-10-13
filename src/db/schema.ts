/**
 * Database schema (Supabase Postgres), managed by Drizzle.
 * Shapes follow the frontend contracts in src/modules/<feature>/mock.ts.
 * Row Level Security, helper functions and grants live in a hand-written migration
 * (drizzle/0001_rls.sql) — every tenant table is scoped by company_id.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/** Bilingual text, same as the `Localized` type in the frontend. */
export type Localized = { ar: string; en: string };

const id = () => uuid("id").primaryKey().defaultRandom();
const companyId = () =>
  uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Enums ----------

export const memberRole = pgEnum("member_role", ["owner", "admin", "employee"]);
export const presenceStatus = pgEnum("presence_status", ["available", "busy", "meeting", "restroom", "waiting", "away", "offline"]);
export const departmentColor = pgEnum("department_color", ["blue", "violet", "amber", "emerald"]);
export const roomType = pgEnum("room_type", ["meeting", "ceo", "open"]);
export const furnitureKind = pgEnum("furniture_kind", ["desk", "meetingTable"]);
export const clientStatus = pgEnum("client_status", ["active", "onboarding", "paused"]);
export const briefStatus = pgEnum("brief_status", ["new", "received", "clarification"]);
export const runNature = pgEnum("run_nature", ["human", "automated", "autoCompleted"]);
export const runStatus = pgEnum("run_status", ["in_progress", "changes_requested", "completed", "closed"]);
export const orderType = pgEnum("order_type", ["sale", "purchase"]);
export const orderStatus = pgEnum("order_status", ["draft", "pending", "approved", "fulfilled", "cancelled"]);
export const eventSource = pgEnum("event_source", ["system", "user", "automation", "integration"]);
export const eventSeverity = pgEnum("event_severity", ["info", "warning", "critical"]);
export const socialPlatform = pgEnum("social_platform", ["Instagram", "TikTok", "Snapchat", "X", "Google Ads", "LinkedIn", "Facebook", "Email"]);
export const accountStatus = pgEnum("account_status", ["connected", "attention", "disconnected"]);
export const campaignStage = pgEnum("campaign_stage", ["planning", "running", "review", "done"]);
export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "done"]);
export const taskPriority = pgEnum("task_priority", ["low", "medium", "high"]);
export const ideaStage = pgEnum("idea_stage", ["bank", "lab", "delivery"]);
export const agentKind = pgEnum("agent_kind", ["general", "specialist"]);
export const agentStatus = pgEnum("agent_status", ["active", "busy", "paused"]);

// ---------- Company and people ----------

export const companies = pgTable("companies", {
  id: id(),
  slug: text("slug").notNull().unique(),
  /** Code employees type on the company login page */
  code: text("code").notNull().unique(),
  name: jsonb("name").$type<Localized>().notNull(),
  plan: text("plan").notNull().default("free"),
  /** Floor size in metres, e.g. { widthM: 18.5, depthM: 12.2 } */
  floor: jsonb("floor").$type<{ widthM: number; depthM: number }>(),
  createdAt: createdAt(),
});

export const departments = pgTable("departments", {
  id: id(),
  companyId: companyId(),
  name: jsonb("name").$type<Localized>().notNull(),
  color: departmentColor("color").notNull().default("blue"),
  createdAt: createdAt(),
}, (t) => [index("departments_company_id_idx").on(t.companyId)]);

export const members = pgTable(
  "members",
  {
    id: id(),
    companyId: companyId(),
    /** Clerk user id (e.g. "user_2abc…") — null for an invited member who has not signed in yet */
    userId: text("user_id"),
    /** Invite address: an invited member is linked to the auth user with this email on first sign-in */
    email: text("email"),
    /** "owner" marks the company owner (all permissions). Everyone else gets permissions from roleId + overrides. */
    role: memberRole("role").notNull().default("employee"),
    /** Permission role (roles table); null = no permissions beyond what overrides grant */
    roleId: uuid("role_id").references((): AnyPgColumn => roles.id, { onDelete: "set null" }),
    name: jsonb("name").$type<Localized>().notNull(),
    title: jsonb("title").$type<Localized>(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    status: presenceStatus("status").notNull().default("offline"),
    currentTask: jsonb("current_task").$type<Localized>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("members_company_user_idx").on(t.companyId, t.userId),
    index("members_user_idx").on(t.userId),
    index("members_department_id_idx").on(t.departmentId),
    index("members_role_id_idx").on(t.roleId),
  ],
);

// ---------- Permissions (roles the owner defines, per-member overrides) ----------

export const permissionEffect = pgEnum("permission_effect", ["grant", "deny"]);

/**
 * A permission role the owner defines (e.g. "Sales manager"). system_key marks the two default roles of
 * every company ("admin", "employee"): renamable, not deletable.
 */
export const roles = pgTable(
  "roles",
  {
    id: id(),
    companyId: companyId(),
    name: jsonb("name").$type<Localized>().notNull(),
    systemKey: text("system_key"),
    createdAt: createdAt(),
  },
  (t) => [index("roles_company_id_idx").on(t.companyId), uniqueIndex("roles_company_system_key_idx").on(t.companyId, t.systemKey)],
);

/** One permission of a role. departmentIds: null = every department; otherwise only those (scoped permissions). */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    departmentIds: uuid("department_ids").array(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

/** Per-member exception on top of the role: grant or deny one permission (optionally for some departments). */
export const memberPermissionOverrides = pgTable(
  "member_permission_overrides",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    effect: permissionEffect("effect").notNull(),
    departmentIds: uuid("department_ids").array(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.permission] })],
);

// ---------- Floor plan ----------

export const rooms = pgTable("rooms", {
  id: id(),
  companyId: companyId(),
  type: roomType("type").notNull(),
  code: text("code"),
  x: numeric("x", { mode: "number" }).notNull(),
  y: numeric("y", { mode: "number" }).notNull(),
  w: numeric("w", { mode: "number" }).notNull(),
  h: numeric("h", { mode: "number" }).notNull(),
}, (t) => [index("rooms_company_id_idx").on(t.companyId)]);

export const furniture = pgTable("furniture", {
  id: id(),
  companyId: companyId(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  kind: furnitureKind("kind").notNull(),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
  x: numeric("x", { mode: "number" }).notNull(),
  y: numeric("y", { mode: "number" }).notNull(),
  w: numeric("w", { mode: "number" }).notNull(),
  h: numeric("h", { mode: "number" }).notNull(),
}, (t) => [index("furniture_company_id_idx").on(t.companyId), index("furniture_room_id_idx").on(t.roomId), index("furniture_member_id_idx").on(t.memberId)]);

export const zones = pgTable("zones", {
  id: id(),
  companyId: companyId(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  x: numeric("x", { mode: "number" }).notNull(),
  y: numeric("y", { mode: "number" }).notNull(),
  w: numeric("w", { mode: "number" }).notNull(),
  h: numeric("h", { mode: "number" }).notNull(),
}, (t) => [index("zones_company_id_idx").on(t.companyId), index("zones_room_id_idx").on(t.roomId), index("zones_department_id_idx").on(t.departmentId)]);

// ---------- Clients and briefs ----------

export const clients = pgTable("clients", {
  id: id(),
  companyId: companyId(),
  name: jsonb("name").$type<Localized>().notNull(),
  industry: jsonb("industry").$type<Localized>(),
  managerId: uuid("manager_id").references(() => members.id, { onDelete: "set null" }),
  monthlyBudget: numeric("monthly_budget", { mode: "number" }).notNull().default(0),
  status: clientStatus("status").notNull().default("onboarding"),
  /** Code a client's contact uses on the visitor login page */
  inviteCode: text("invite_code").unique(),
  /** Signed contract (PDF) in the attachments bucket: "<company_id>/contracts/…" */
  contractPath: text("contract_path"),
  /** Package in the contract: deliverables per month, and revisions allowed per deliverable */
  packageDeliverables: integer("package_deliverables"),
  packageRevisionsPerPost: integer("package_revisions_per_post"),
  createdAt: createdAt(),
}, (t) => [index("clients_company_id_idx").on(t.companyId), index("clients_manager_id_idx").on(t.managerId)]);

/** Auth users who sign in to a client's portal */
export const clientUsers = pgTable(
  "client_users",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.userId] })],
);

export const briefs = pgTable("briefs", {
  id: id(),
  companyId: companyId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  objective: jsonb("objective").$type<Localized>().notNull(),
  audience: jsonb("audience").$type<Localized>().notNull(),
  details: jsonb("details").$type<Localized>().notNull(),
  budget: numeric("budget", { mode: "number" }).notNull().default(0),
  deadline: date("deadline"),
  receivedOn: date("received_on").notNull().defaultNow(),
  /** Path in Supabase Storage */
  attachmentPath: text("attachment_path"),
  status: briefStatus("status").notNull().default("new"),
  clientReply: text("client_reply"),
  createdAt: createdAt(),
}, (t) => [index("briefs_company_id_idx").on(t.companyId), index("briefs_client_id_idx").on(t.clientId)]);

/** A test version in the lab (Version in src/modules/marketing/mock.ts) */
/** A client's account on a social / ads platform (Marketing → sections → accounts) */
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: id(),
    companyId: companyId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    platform: socialPlatform("platform").notNull(),
    handle: text("handle").notNull(),
    followers: integer("followers").notNull().default(0),
    status: accountStatus("status").notNull().default("connected"),
    /** Human text such as "2 hours ago", until a platform integration provides real timestamps */
    lastPost: jsonb("last_post").$type<Localized>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("social_accounts_company_id_idx").on(t.companyId),
    uniqueIndex("social_accounts_client_platform_handle_idx").on(t.clientId, t.platform, t.handle),
  ],
);

/** Per-platform results of a campaign; channel stats are computed from these. */
export type ChannelMetrics = { reach: number; results: number; conversions: number; spend: number };

/** A client's campaign (Marketing → sections → campaigns); budgets and channel stats are derived from campaigns. */
export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    companyId: companyId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** The brief it answers, if any */
    briefId: uuid("brief_id").references(() => briefs.id, { onDelete: "set null" }),
    name: jsonb("name").$type<Localized>().notNull(),
    channels: socialPlatform("channels").array().notNull().default([]),
    stage: campaignStage("stage").notNull().default("planning"),
    /** 0–1 */
    progress: numeric("progress", { mode: "number" }).notNull().default(0),
    startDate: date("start_date"),
    endDate: date("end_date"),
    spent: numeric("spent", { mode: "number" }).notNull().default(0),
    metrics: jsonb("metrics").$type<Partial<Record<(typeof socialPlatform.enumValues)[number], ChannelMetrics>>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("campaigns_company_id_idx").on(t.companyId),
    index("campaigns_client_id_idx").on(t.clientId),
    index("campaigns_brief_id_idx").on(t.briefId),
    check("campaigns_progress_range", sql`${t.progress} >= 0 and ${t.progress} <= 1`),
  ],
);

export type IdeaVersion = {
  id: string;
  label: string;
  description: Localized;
  duration: string;
  views: number;
  completion: number;
  engagement: number;
};
export type IdeaRatings = Record<"hook" | "clarity" | "fit" | "effort", number>;
export type IdeaDelivery = { status: "awaiting" | "approved" | "changes"; sentOn: string };

/** Marketing room: idea bank → test lab → delivery to the client */
export const marketingIdeas = pgTable("marketing_ideas", {
  id: id(),
  companyId: companyId(),
  stage: ideaStage("stage").notNull().default("bank"),
  title: jsonb("title").$type<Localized>().notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  /** The brief this idea came from, if any */
  briefId: uuid("brief_id").references(() => briefs.id, { onDelete: "set null" }),
  ownerId: uuid("owner_id").references(() => members.id, { onDelete: "set null" }),
  format: jsonb("format").$type<Localized>(),
  hook: jsonb("hook").$type<Localized>(),
  message: jsonb("message").$type<Localized>(),
  versions: jsonb("versions").$type<IdeaVersion[]>().notNull().default([]),
  ratings: jsonb("ratings").$type<IdeaRatings>(),
  delivery: jsonb("delivery").$type<IdeaDelivery>(),
  /** Production task of this content: a change request from the client counts as a revision on it */
  taskId: uuid("task_id").references((): AnyPgColumn => tasks.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("marketing_ideas_company_id_idx").on(t.companyId), index("marketing_ideas_client_id_idx").on(t.clientId), index("marketing_ideas_brief_id_idx").on(t.briefId), index("marketing_ideas_owner_id_idx").on(t.ownerId), index("marketing_ideas_task_id_idx").on(t.taskId)]);

// ---------- Client profitability (minimal calendar, invoices, freelancers, cost settings) ----------

/** Meetings with a client (minimal calendar) */
export const meetings = pgTable("meetings", {
  id: id(),
  companyId: companyId(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  createdAt: createdAt(),
}, (t) => [index("meetings_company_id_idx").on(t.companyId), index("meetings_client_id_idx").on(t.clientId), check("meetings_duration_positive", sql`${t.durationMinutes} > 0`)]);

/** Invoices to clients: income per month (`period` = first day of the month billed) and payment delays */
export const invoices = pgTable("invoices", {
  id: id(),
  companyId: companyId(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  period: date("period").notNull(),
  amount: numeric("amount", { mode: "number" }).notNull(),
  issuedOn: date("issued_on").notNull(),
  dueOn: date("due_on").notNull(),
  paidOn: date("paid_on"),
  createdAt: createdAt(),
}, (t) => [index("invoices_company_id_idx").on(t.companyId), index("invoices_client_id_idx").on(t.clientId), check("invoices_amount_positive", sql`${t.amount} >= 0`)]);

/** What the agency paid freelancers for a client's work */
export const freelancerPayments = pgTable("freelancer_payments", {
  id: id(),
  companyId: companyId(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  freelancer: text("freelancer").notNull(),
  amount: numeric("amount", { mode: "number" }).notNull(),
  paidOn: date("paid_on").notNull(),
  createdAt: createdAt(),
}, (t) => [index("freelancer_payments_company_id_idx").on(t.companyId), index("freelancer_payments_client_id_idx").on(t.clientId), index("freelancer_payments_task_id_idx").on(t.taskId), check("freelancer_payments_amount_positive", sql`${t.amount} >= 0`)]);

/** One row per company: standard time per task type, minutes per revision, and monthly costs for the internal hourly cost */
export const profitabilitySettings = pgTable("profitability_settings", {
  companyId: uuid("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  standardMinutes: jsonb("standard_minutes").$type<Record<string, number>>().notNull().default({}),
  revisionMinutes: integer("revision_minutes").notNull().default(30),
  monthlySalaries: numeric("monthly_salaries", { mode: "number" }).notNull().default(0),
  monthlyRent: numeric("monthly_rent", { mode: "number" }).notNull().default(0),
  monthlyTools: numeric("monthly_tools", { mode: "number" }).notNull().default(0),
  monthlyHours: numeric("monthly_hours", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Operations, automation, sales ----------

export type NoteAudience = { type: "company" } | { type: "custom"; departmentIds: string[]; memberIds: string[] };

export const notes = pgTable("notes", {
  id: id(),
  companyId: companyId(),
  authorId: uuid("author_id").references(() => members.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  operationId: text("operation_id"),
  audience: jsonb("audience").$type<NoteAudience>().notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("notes_company_id_idx").on(t.companyId), index("notes_author_id_idx").on(t.authorId)]);

/** Team tasks (Operations room → task management) */
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    companyId: companyId(),
    title: text("title").notNull(),
    assigneeId: uuid("assignee_id").references(() => members.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => members.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    priority: taskPriority("priority").notNull().default("medium"),
    status: taskStatus("status").notNull().default("todo"),
    /** Optional operation the task belongs to (workflow_runs.id) */
    operationId: uuid("operation_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    /** Client work (profitability): the client, the kind of work (TASK_TYPES), the optional timer, and revisions requested */
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    taskType: text("task_type"),
    trackedMinutes: integer("tracked_minutes"),
    revisions: integer("revisions").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("tasks_company_id_idx").on(t.companyId),
    index("tasks_assignee_id_idx").on(t.assigneeId),
    index("tasks_created_by_id_idx").on(t.createdById),
    index("tasks_operation_id_idx").on(t.operationId),
    index("tasks_client_id_idx").on(t.clientId),
    check("tasks_tracked_minutes_positive", sql`${t.trackedMinutes} is null or ${t.trackedMinutes} >= 0`),
  ],
);

export type WorkflowStep = { id: string; title: Localized; assigneeId: string };
export type WorkflowAttachment = { id: string; name: string; size: number; type: string; path: string };
export type RunHistoryEntry = {
  action: "started" | "approved" | "rejected" | "changes_requested" | "resubmitted";
  stepIndex: number;
  byId: string;
  at: string;
  note?: string;
};

export const workflows = pgTable("workflows", {
  id: id(),
  companyId: companyId(),
  name: jsonb("name").$type<Localized>().notNull(),
  steps: jsonb("steps").$type<WorkflowStep[]>().notNull().default([]),
  attachments: jsonb("attachments").$type<WorkflowAttachment[]>().notNull().default([]),
  createdAt: createdAt(),
}, (t) => [index("workflows_company_id_idx").on(t.companyId)]);

/** An operation in the Operations room: one run of an approval workflow (or a standalone task). */
export const workflowRuns = pgTable("workflow_runs", {
  id: id(),
  companyId: companyId(),
  /** OP-####, assigned by the database */
  code: text("code").notNull(),
  workflowId: uuid("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
  /** OpsCategory in src/modules/operations/mock.ts */
  category: text("category").notNull().default("operations"),
  nature: runNature("nature").notNull().default("human"),
  ownerId: uuid("owner_id").references(() => members.id, { onDelete: "set null" }),
  subject: jsonb("subject").$type<Localized>().notNull(),
  currentStep: integer("current_step").notNull().default(0),
  status: runStatus("status").notNull().default("in_progress"),
  history: jsonb("history").$type<RunHistoryEntry[]>().notNull().default([]),
  createdAt: createdAt(),
}, (t) => [index("workflow_runs_company_id_idx").on(t.companyId), index("workflow_runs_workflow_id_idx").on(t.workflowId), index("workflow_runs_owner_id_idx").on(t.ownerId)]);

/**
 * Automated flow: trigger → optional condition → action (Automation room → automated flows).
 * The texts describe the flow for people; `triggerEvent` is the machine-readable event type the
 * automation engine (future service) listens to, e.g. "order.created".
 */
export const automationFlows = pgTable(
  "automation_flows",
  {
    id: id(),
    companyId: companyId(),
    name: jsonb("name").$type<Localized>().notNull(),
    trigger: jsonb("trigger").$type<Localized>().notNull(),
    condition: jsonb("condition").$type<Localized>(),
    action: jsonb("action").$type<Localized>().notNull(),
    triggerEvent: text("trigger_event"),
    /** Template it was created from (templates live in src/modules/automation/mock.ts) */
    templateId: text("template_id"),
    enabled: boolean("enabled").notNull().default(true),
    runs: integer("runs").notNull().default(0),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("automation_flows_company_id_idx").on(t.companyId)],
);

export const suppliers = pgTable("suppliers", {
  id: id(),
  companyId: companyId(),
  name: jsonb("name").$type<Localized>().notNull(),
  category: jsonb("category").$type<Localized>(),
  createdAt: createdAt(),
}, (t) => [index("suppliers_company_id_idx").on(t.companyId)]);

export type OrderItem = { name: string; qty: number; unitPrice: number };

export const orders = pgTable(
  "orders",
  {
    id: id(),
    companyId: companyId(),
    /** SO-#### / PO-####, assigned on the server */
    number: text("number").notNull(),
    type: orderType("type").notNull(),
    /** Client id for sales, supplier id for purchases */
    partyId: uuid("party_id").notNull(),
    items: jsonb("items").$type<OrderItem[]>().notNull().default([]),
    date: date("date").notNull().defaultNow(),
    deliveryDate: date("delivery_date"),
    status: orderStatus("status").notNull().default("draft"),
    /** Member who created it (scopes orders.approve by department) */
    createdById: uuid("created_by_id").references(() => members.id, { onDelete: "set null" }),
    /** Approval workflow this order goes through when it becomes pending (optional) */
    workflowId: uuid("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
    /** The approval run started for this order; its outcome sets the order status */
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("orders_company_number_idx").on(t.companyId, t.number),
    index("orders_workflow_id_idx").on(t.workflowId),
    index("orders_created_by_id_idx").on(t.createdById),
    index("orders_run_id_idx").on(t.runId),
  ],
);

// ---------- Events, agents, academy ----------

/** Append-only activity log (no update/delete policies) */
export const events = pgTable(
  "events",
  {
    id: id(),
    companyId: companyId(),
    type: text("type").notNull(),
    source: eventSource("source").notNull(),
    severity: eventSeverity("severity").notNull().default("info"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** Member who did it (null for the system, automations and client portal users) */
    actorId: uuid("actor_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("events_company_created_idx").on(t.companyId, t.createdAt), index("events_actor_id_idx").on(t.actorId)],
);

export const agents = pgTable("agents", {
  id: id(),
  companyId: companyId(),
  kind: agentKind("kind").notNull(),
  name: jsonb("name").$type<Localized>().notNull(),
  role: jsonb("role").$type<Localized>(),
  description: jsonb("description").$type<Localized>(),
  skills: jsonb("skills").$type<Localized[]>().notNull().default([]),
  area: jsonb("area").$type<Localized>(),
  status: agentStatus("status").notNull().default("active"),
  tasksDone: integer("tasks_done").notNull().default(0),
  queue: integer("queue").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("agents_company_id_idx").on(t.companyId)]);

/** Course content stays in code (src/modules/academy/mock.ts); only progress is stored. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);
