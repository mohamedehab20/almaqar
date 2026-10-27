-- «بوابة العملاء» becomes its own room (clients.view) and serves every kind of outside person: clients,
-- meeting visitors, people following one operation (supplier, contractor) and job candidates.

-- ---------- 1. The room's permission (catalog.ts gained clients.view; Admin and Employee get it) ----------

CREATE OR REPLACE FUNCTION private.permission_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'members.invite', 'members.edit', 'members.remove', 'departments.manage', 'leaves.manage', 'hours.manage', 'recruitment.manage', 'operations.view', 'operations.create', 'notes.write', 'notes.manage', 'tasks.create', 'tasks.manage', 'automation.view', 'workflows.manage', 'runs.start', 'flows.manage', 'sales.view', 'orders.create', 'orders.approve', 'suppliers.manage', 'marketing.view', 'clients.view', 'clients.manage', 'briefs.manage', 'ideas.manage', 'campaigns.manage', 'profitability.view', 'agents.view', 'agents.use', 'agents.manage', 'analytics.view', 'analytics.departments', 'analytics.members', 'company.settings']::text[] $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.employee_default_permissions() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'operations.view', 'operations.create', 'notes.write', 'tasks.create', 'automation.view', 'runs.start', 'sales.view', 'orders.create', 'marketing.view', 'clients.view', 'ideas.manage', 'agents.view', 'agents.use']::text[] $$;
--> statement-breakpoint
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'clients.view' FROM public.roles r WHERE r.system_key IN ('admin', 'employee')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------- 2. Portal parts for the new kinds ----------

ALTER TABLE public.clients DROP CONSTRAINT clients_portal_access_known;
--> statement-breakpoint
ALTER TABLE public.clients ADD CONSTRAINT clients_portal_access_known
  CHECK (portal_access <@ '{briefs,invoices,meetings,files,operation,application}'::text[]);
--> statement-breakpoint

-- The operation this person follows: its code, subject, status and steps (no notes, no other operations)
CREATE OR REPLACE FUNCTION private.portal_operation(clid uuid)
RETURNS TABLE (code text, subject jsonb, status text, current_step integer, steps jsonb, updated_at text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.code, r.subject, r.status::text, r.current_step,
         coalesce((SELECT jsonb_agg(jsonb_build_object('title', s -> 'title') ORDER BY n) FROM jsonb_array_elements(w.steps) WITH ORDINALITY AS e(s, n)), '[]'::jsonb),
         coalesce(r.history -> -1 ->> 'at', r.created_at::text)
  FROM public.clients c
  JOIN public.workflow_runs r ON r.id = c.run_id
  LEFT JOIN public.workflows w ON w.id = r.workflow_id
  WHERE c.id = clid AND private.client_allows(clid, 'operation')
$$;
--> statement-breakpoint

-- The candidate's application: the job, their stage and the interview time (no notes, rating or reasons)
CREATE OR REPLACE FUNCTION private.portal_application(clid uuid)
RETURNS TABLE (job_title text, stage text, interview_at timestamptz, stage_changed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT j.title, ca.stage::text, ca.interview_at, ca.stage_changed_at
  FROM public.clients c
  JOIN public.candidates ca ON ca.id = c.candidate_id
  JOIN public.job_openings j ON j.id = ca.job_id
  WHERE c.id = clid AND private.client_allows(clid, 'application')
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.portal_operation(uuid), private.portal_application(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.portal_operation(uuid), private.portal_application(uuid) TO authenticated;
