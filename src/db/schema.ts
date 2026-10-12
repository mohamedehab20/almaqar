/**
 * Database schema (Supabase Postgres), managed by Drizzle.
 * Shapes follow the frontend contracts in src/modules/<feature>/mock.ts.
 * Row Level Security, helper functions and grants live in a hand-written migration
 * (drizzle/0001_rls.sql) — every tenant table is scoped by company_id.
 */
import {
  boolean,
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
});

export const members = pgTable(
  "members",
  {
    id: id(),
    companyId: companyId(),
    /** auth.users.id — null for an invited member who has not signed in yet */
    userId: uuid("user_id"),
    /** Invite address: an invited member is linked to the auth user with this email on first sign-in */
    email: text("email"),
    role: memberRole("role").notNull().default("employee"),
    name: jsonb("name").$type<Localized>().notNull(),
    title: jsonb("title").$type<Localized>(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    status: presenceStatus("status").notNull().default("offline"),
    currentTask: jsonb("current_task").$type<Localized>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("members_company_user_idx").on(t.companyId, t.userId), index("members_user_idx").on(t.userId)],
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
});

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
});

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
});

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
  createdAt: createdAt(),
});

/** Auth users who sign in to a client's portal */
export const clientUsers = pgTable(
  "client_users",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
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
});

/** A test version in the lab (Version in src/modules/marketing/mock.ts) */
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
  createdAt: createdAt(),
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
});

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
});

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
});

export const suppliers = pgTable("suppliers", {
  id: id(),
  companyId: companyId(),
  name: jsonb("name").$type<Localized>().notNull(),
  category: jsonb("category").$type<Localized>(),
  createdAt: createdAt(),
});

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
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("orders_company_number_idx").on(t.companyId, t.number)],
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
    createdAt: createdAt(),
  },
  (t) => [index("events_company_created_idx").on(t.companyId, t.createdAt)],
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
});

/** Course content stays in code (src/modules/academy/mock.ts); only progress is stored. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);
