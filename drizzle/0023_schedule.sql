CREATE TYPE "public"."schedule_kind" AS ENUM('meeting', 'appointment', 'trip', 'interview');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('scheduled', 'done', 'cancelled');--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "kind" "schedule_kind" DEFAULT 'meeting' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "status" "schedule_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "organizer_id" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "attendee_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "contact_role" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "transport" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organizer_id_members_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetings_organizer_id_idx" ON "meetings" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "meetings_company_starts_at_idx" ON "meetings" USING btree ("company_id","starts_at");