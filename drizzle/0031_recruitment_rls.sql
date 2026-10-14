-- Recruitment: the new permission (recruitment.manage, Admin role by default) and RLS.
-- Candidates are private to recruiters; every member sees the open jobs and may refer someone to one of them
-- (and sees the people they referred).

-- ---------- 1. Catalog mirror (src/modules/permissions/catalog.ts gained recruitment.manage) ----------

CREATE OR REPLACE FUNCTION private.permission_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'members.invite', 'members.edit', 'members.remove', 'departments.manage', 'leaves.manage', 'hours.manage', 'recruitment.manage', 'operations.view', 'operations.create', 'notes.write', 'notes.manage', 'tasks.create', 'tasks.manage', 'automation.view', 'workflows.manage', 'runs.start', 'flows.manage', 'sales.view', 'orders.create', 'orders.approve', 'suppliers.manage', 'marketing.view', 'clients.manage', 'briefs.manage', 'ideas.manage', 'campaigns.manage', 'profitability.view', 'agents.view', 'agents.use', 'agents.manage', 'company.settings']::text[] $$;
--> statement-breakpoint
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'recruitment.manage' FROM public.roles r WHERE r.system_key = 'admin'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------- 2. Job openings ----------

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "jobs: recruiters, or members for open jobs" ON public.job_openings FOR SELECT TO authenticated
  USING (private.has_permission(company_id, 'recruitment.manage') OR (status = 'open' AND private.is_member(company_id)));
--> statement-breakpoint
CREATE POLICY "jobs: recruiters add" ON public.job_openings FOR INSERT TO authenticated
  WITH CHECK (private.has_permission(company_id, 'recruitment.manage'));
--> statement-breakpoint
CREATE POLICY "jobs: recruiters update" ON public.job_openings FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'recruitment.manage')) WITH CHECK (private.has_permission(company_id, 'recruitment.manage'));
--> statement-breakpoint
CREATE POLICY "jobs: recruiters delete" ON public.job_openings FOR DELETE TO authenticated
  USING (private.has_permission(company_id, 'recruitment.manage'));
--> statement-breakpoint

-- ---------- 3. Candidates ----------

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "candidates: recruiters, or who referred them" ON public.candidates FOR SELECT TO authenticated
  USING (private.has_permission(company_id, 'recruitment.manage') OR private.is_self(referred_by_id));
--> statement-breakpoint
-- Recruiters add anyone to a job of their company; a member only refers someone, as new, to an open job
CREATE POLICY "candidates: recruiters add, members refer" ON public.candidates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.job_openings j WHERE j.id = job_id AND j.company_id = candidates.company_id)
    AND (
      private.has_permission(company_id, 'recruitment.manage')
      OR (private.is_self(referred_by_id) AND source = 'referral' AND stage = 'applied'
          AND EXISTS (SELECT 1 FROM public.job_openings j WHERE j.id = job_id AND j.status = 'open'))
    )
  );
--> statement-breakpoint
CREATE POLICY "candidates: recruiters update" ON public.candidates FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'recruitment.manage'))
  WITH CHECK (
    private.has_permission(company_id, 'recruitment.manage')
    AND EXISTS (SELECT 1 FROM public.job_openings j WHERE j.id = job_id AND j.company_id = candidates.company_id)
  );
--> statement-breakpoint
CREATE POLICY "candidates: recruiters delete" ON public.candidates FOR DELETE TO authenticated
  USING (private.has_permission(company_id, 'recruitment.manage'));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_openings, public.candidates TO authenticated;
