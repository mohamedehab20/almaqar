ALTER TABLE "events" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_actor_id_idx" ON "events" USING btree ("actor_id");