CREATE TABLE "automation_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"trigger" jsonb NOT NULL,
	"condition" jsonb,
	"action" jsonb NOT NULL,
	"trigger_event" text,
	"template_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_flows" ADD CONSTRAINT "automation_flows_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_flows_company_id_idx" ON "automation_flows" USING btree ("company_id");