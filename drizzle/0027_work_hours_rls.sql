-- Working hours: the new permission (hours.manage, Admin role by default) and RLS for the hours tables.
-- Everyone clocks in and out and records their own hours; hours.manage (scoped by the employee's department)
-- sees and corrects the team's hours; the company's working day needs an all-departments grant.

-- ---------- 1. Catalog mirror (src/modules/permissions/catalog.ts gained hours.manage) ----------

CREATE OR REPLACE FUNCTION private.permission_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'members.invite', 'members.edit', 'members.remove', 'departments.manage', 'leaves.manage', 'hours.manage', 'operations.view', 'operations.create', 'notes.write', 'notes.manage', 'tasks.create', 'tasks.manage', 'automation.view', 'workflows.manage', 'runs.start', 'flows.manage', 'sales.view', 'orders.create', 'orders.approve', 'suppliers.manage', 'marketing.view', 'clients.manage', 'briefs.manage', 'ideas.manage', 'campaigns.manage', 'profitability.view', 'agents.view', 'agents.use', 'agents.manage', 'company.settings']::text[] $$;
--> statement-breakpoint
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'hours.manage' FROM public.roles r WHERE r.system_key = 'admin'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------- 2. Sessions ----------

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "work sessions: own or managed read" ON public.work_sessions FOR SELECT TO authenticated
  USING (private.is_self(member_id) OR private.has_permission(company_id, 'hours.manage', private.member_department(member_id)));
--> statement-breakpoint
CREATE POLICY "work sessions: own or managed add" ON public.work_sessions FOR INSERT TO authenticated
  WITH CHECK (
    private.member_company_id(member_id) = company_id
    AND (private.is_self(member_id) OR private.has_permission(company_id, 'hours.manage', private.member_department(member_id)))
  );
--> statement-breakpoint
CREATE POLICY "work sessions: own or managed update" ON public.work_sessions FOR UPDATE TO authenticated
  USING (private.is_self(member_id) OR private.has_permission(company_id, 'hours.manage', private.member_department(member_id)))
  WITH CHECK (
    private.member_company_id(member_id) = company_id
    AND (private.is_self(member_id) OR private.has_permission(company_id, 'hours.manage', private.member_department(member_id)))
  );
--> statement-breakpoint
-- Employees remove only hours they typed in themselves; the timer's record stays
CREATE POLICY "work sessions: own manual or managed delete" ON public.work_sessions FOR DELETE TO authenticated
  USING ((private.is_self(member_id) AND source = 'manual') OR private.has_permission(company_id, 'hours.manage', private.member_department(member_id)));
--> statement-breakpoint

-- ---------- 3. Company working day ----------

ALTER TABLE public.work_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "work settings: members read" ON public.work_settings FOR SELECT TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "work settings: managers add" ON public.work_settings FOR INSERT TO authenticated
  WITH CHECK (private.has_permission(company_id, 'hours.manage'));
--> statement-breakpoint
CREATE POLICY "work settings: managers update" ON public.work_settings FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'hours.manage')) WITH CHECK (private.has_permission(company_id, 'hours.manage'));
--> statement-breakpoint

-- ---------- 4. Hours managers see approved leave (excused days) ----------

DROP POLICY "leave requests: own or managed read" ON public.leave_requests;
--> statement-breakpoint
CREATE POLICY "leave requests: own or managed read" ON public.leave_requests FOR SELECT TO authenticated
  USING (
    private.is_self(member_id)
    OR private.has_permission(company_id, 'leaves.manage', private.member_department(member_id))
    OR (status = 'approved' AND private.has_permission(company_id, 'hours.manage', private.member_department(member_id)))
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_sessions TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.work_settings TO authenticated;
