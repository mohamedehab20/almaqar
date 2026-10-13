CREATE TABLE "freelancer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"task_id" uuid,
	"freelancer" text NOT NULL,
	"amount" numeric NOT NULL,
	"paid_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freelancer_payments_amount_positive" CHECK ("freelancer_payments"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period" date NOT NULL,
	"amount" numeric NOT NULL,
	"issued_on" date NOT NULL,
	"due_on" date NOT NULL,
	"paid_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_amount_positive" CHECK ("invoices"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_duration_positive" CHECK ("meetings"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "profitability_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"standard_minutes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision_minutes" integer DEFAULT 30 NOT NULL,
	"monthly_salaries" numeric DEFAULT 0 NOT NULL,
	"monthly_rent" numeric DEFAULT 0 NOT NULL,
	"monthly_tools" numeric DEFAULT 0 NOT NULL,
	"monthly_hours" numeric DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "package_deliverables" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "package_revisions_per_post" integer;--> statement-breakpoint
ALTER TABLE "marketing_ideas" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "task_type" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "tracked_minutes" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "revisions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "freelancer_payments" ADD CONSTRAINT "freelancer_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_payments" ADD CONSTRAINT "freelancer_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_payments" ADD CONSTRAINT "freelancer_payments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability_settings" ADD CONSTRAINT "profitability_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freelancer_payments_company_id_idx" ON "freelancer_payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "freelancer_payments_client_id_idx" ON "freelancer_payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "freelancer_payments_task_id_idx" ON "freelancer_payments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "invoices_company_id_idx" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "invoices_client_id_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "meetings_company_id_idx" ON "meetings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "meetings_client_id_idx" ON "meetings" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "marketing_ideas" ADD CONSTRAINT "marketing_ideas_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_ideas_task_id_idx" ON "marketing_ideas" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_client_id_idx" ON "tasks" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tracked_minutes_positive" CHECK ("tasks"."tracked_minutes" is null or "tasks"."tracked_minutes" >= 0);