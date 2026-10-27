ALTER TYPE "public"."client_kind" ADD VALUE 'operation';--> statement-breakpoint
ALTER TYPE "public"."client_kind" ADD VALUE 'candidate';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;