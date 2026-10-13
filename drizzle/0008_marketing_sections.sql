CREATE TYPE "public"."account_status" AS ENUM('connected', 'attention', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."campaign_stage" AS ENUM('planning', 'running', 'review', 'done');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('Instagram', 'TikTok', 'Snapchat', 'X', 'Google Ads', 'LinkedIn', 'Facebook', 'Email');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"brief_id" uuid,
	"name" jsonb NOT NULL,
	"channels" "social_platform"[] DEFAULT '{}' NOT NULL,
	"stage" "campaign_stage" DEFAULT 'planning' NOT NULL,
	"progress" numeric DEFAULT 0 NOT NULL,
	"start_date" date,
	"end_date" date,
	"spent" numeric DEFAULT 0 NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_progress_range" CHECK ("campaigns"."progress" >= 0 and "campaigns"."progress" <= 1)
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"handle" text NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"status" "account_status" DEFAULT 'connected' NOT NULL,
	"last_post" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_company_id_idx" ON "campaigns" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "campaigns_client_id_idx" ON "campaigns" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "campaigns_brief_id_idx" ON "campaigns" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX "social_accounts_company_id_idx" ON "social_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_client_platform_handle_idx" ON "social_accounts" USING btree ("client_id","platform","handle");