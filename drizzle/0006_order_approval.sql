ALTER TABLE "orders" ADD COLUMN "workflow_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_workflow_id_idx" ON "orders" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "orders_run_id_idx" ON "orders" USING btree ("run_id");