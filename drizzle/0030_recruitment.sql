CREATE TYPE "public"."candidate_source" AS ENUM('linkedin', 'wuzzuf', 'website', 'referral', 'facebook', 'other');--> statement-breakpoint
CREATE TYPE "public"."candidate_stage" AS ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('fullTime', 'partTime', 'internship', 'freelance');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('open', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('office', 'remote', 'hybrid');--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"source" "candidate_source" DEFAULT 'other' NOT NULL,
	"stage" "candidate_stage" DEFAULT 'applied' NOT NULL,
	"rating" integer,
	"notes" text,
	"cv_url" text,
	"referred_by_id" uuid,
	"interview_at" timestamp with time zone,
	"interview_item_id" uuid,
	"rejected_reason" text,
	"hired_member_id" uuid,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_rating_range" CHECK ("candidates"."rating" is null or "candidates"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "job_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"department_id" uuid,
	"employment_type" "employment_type" DEFAULT 'fullTime' NOT NULL,
	"work_mode" "work_mode" DEFAULT 'office' NOT NULL,
	"openings" integer DEFAULT 1 NOT NULL,
	"status" "job_status" DEFAULT 'open' NOT NULL,
	"description" text,
	"requirements" text,
	"salary_min" numeric,
	"salary_max" numeric,
	"hiring_manager_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_openings_openings_positive" CHECK ("job_openings"."openings" > 0),
	CONSTRAINT "job_openings_salary_order" CHECK ("job_openings"."salary_min" is null or "job_openings"."salary_max" is null or "job_openings"."salary_max" >= "job_openings"."salary_min")
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_job_id_job_openings_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_referred_by_id_members_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_interview_item_id_meetings_id_fk" FOREIGN KEY ("interview_item_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_hired_member_id_members_id_fk" FOREIGN KEY ("hired_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_hiring_manager_id_members_id_fk" FOREIGN KEY ("hiring_manager_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidates_company_stage_idx" ON "candidates" USING btree ("company_id","stage");--> statement-breakpoint
CREATE INDEX "candidates_job_id_idx" ON "candidates" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "candidates_referred_by_id_idx" ON "candidates" USING btree ("referred_by_id");--> statement-breakpoint
CREATE INDEX "candidates_interview_item_id_idx" ON "candidates" USING btree ("interview_item_id");--> statement-breakpoint
CREATE INDEX "candidates_hired_member_id_idx" ON "candidates" USING btree ("hired_member_id");--> statement-breakpoint
CREATE INDEX "job_openings_company_id_idx" ON "job_openings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_openings_department_id_idx" ON "job_openings" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "job_openings_hiring_manager_id_idx" ON "job_openings" USING btree ("hiring_manager_id");--> statement-breakpoint
CREATE INDEX "job_openings_created_by_id_idx" ON "job_openings" USING btree ("created_by_id");