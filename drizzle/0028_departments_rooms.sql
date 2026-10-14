CREATE TABLE "company_rooms" (
	"company_id" uuid NOT NULL,
	"room" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"manager_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_rooms_company_id_room_pk" PRIMARY KEY("company_id","room")
);
--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "company_rooms" ADD CONSTRAINT "company_rooms_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_rooms" ADD CONSTRAINT "company_rooms_manager_id_members_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_rooms_manager_id_idx" ON "company_rooms" USING btree ("manager_id");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_members_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "departments_manager_id_idx" ON "departments" USING btree ("manager_id");