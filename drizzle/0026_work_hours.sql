CREATE TYPE "public"."work_session_source" AS ENUM('timer', 'manual');--> statement-breakpoint
CREATE TABLE "work_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"source" "work_session_source" DEFAULT 'timer' NOT NULL,
	"note" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_sessions_order" CHECK ("work_sessions"."ended_at" is null or "work_sessions"."ended_at" > "work_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "work_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"day_start" text DEFAULT '09:00' NOT NULL,
	"day_end" text DEFAULT '17:00' NOT NULL,
	"break_minutes" integer DEFAULT 60 NOT NULL,
	"grace_minutes" integer DEFAULT 15 NOT NULL,
	"time_zone" text DEFAULT 'Africa/Cairo' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_settings" ADD CONSTRAINT "work_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_sessions_company_started_idx" ON "work_sessions" USING btree ("company_id","started_at");--> statement-breakpoint
CREATE INDEX "work_sessions_member_started_idx" ON "work_sessions" USING btree ("member_id","started_at");--> statement-breakpoint
CREATE INDEX "work_sessions_created_by_id_idx" ON "work_sessions" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_sessions_one_open_idx" ON "work_sessions" USING btree ("member_id") WHERE "work_sessions"."ended_at" is null;