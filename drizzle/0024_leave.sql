CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('annual', 'casual', 'sick', 'unpaid');--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"company_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"type" "leave_type" NOT NULL,
	"allowance" numeric,
	CONSTRAINT "leave_balances_member_id_year_type_pk" PRIMARY KEY("member_id","year","type"),
	CONSTRAINT "leave_balances_allowance_positive" CHECK ("leave_balances"."allowance" is null or "leave_balances"."allowance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "leave_type" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"days" integer NOT NULL,
	"reason" text,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_dates" CHECK ("leave_requests"."ends_on" >= "leave_requests"."starts_on"),
	CONSTRAINT "leave_requests_days_positive" CHECK ("leave_requests"."days" > 0)
);
--> statement-breakpoint
CREATE TABLE "leave_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"allowances" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weekend_days" integer[] DEFAULT '{5,6}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_id_members_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leave_balances_company_id_idx" ON "leave_balances" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "leave_requests_company_starts_on_idx" ON "leave_requests" USING btree ("company_id","starts_on");--> statement-breakpoint
CREATE INDEX "leave_requests_member_id_idx" ON "leave_requests" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "leave_requests_decided_by_id_idx" ON "leave_requests" USING btree ("decided_by_id");