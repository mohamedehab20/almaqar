CREATE TYPE "public"."approval_kind" AS ENUM('action', 'position');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"kind" "approval_kind" DEFAULT 'action' NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"due_on" date,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_requests_not_self" CHECK ("approval_requests"."requester_id" <> "approval_requests"."approver_id")
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_members_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approver_id_members_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_requests_company_created_idx" ON "approval_requests" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "approval_requests_requester_id_idx" ON "approval_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "approval_requests_approver_id_idx" ON "approval_requests" USING btree ("approver_id");