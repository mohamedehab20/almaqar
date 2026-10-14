CREATE TYPE "public"."client_kind" AS ENUM('client', 'visitor');--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "kind" "client_kind" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "room" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_department_id_idx" ON "clients" USING btree ("department_id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_one_owner" CHECK ("clients"."room" is null or "clients"."department_id" is null);