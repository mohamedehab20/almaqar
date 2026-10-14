-- Leave: the new permission (leaves.manage, Admin role by default) and RLS for the leave tables.
-- Every member requests and cancels their own leave; leaves.manage (scoped by the employee's department)
-- approves, rejects and sets balances; the company policy needs an all-departments grant.

-- ---------- 1. Catalog mirror (src/modules/permissions/catalog.ts gained leaves.manage) ----------

CREATE OR REPLACE FUNCTION private.permission_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'members.invite', 'members.edit', 'members.remove', 'departments.manage', 'leaves.manage', 'operations.view', 'operations.create', 'notes.write', 'notes.manage', 'tasks.create', 'tasks.manage', 'automation.view', 'workflows.manage', 'runs.start', 'flows.manage', 'sales.view', 'orders.create', 'orders.approve', 'suppliers.manage', 'marketing.view', 'clients.manage', 'briefs.manage', 'ideas.manage', 'campaigns.manage', 'profitability.view', 'agents.view', 'agents.use', 'agents.manage', 'company.settings']::text[] $$;
--> statement-breakpoint
-- Existing Admin roles had every permission, so they get the new one too (Employee roles do not)
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'leaves.manage' FROM public.roles r WHERE r.system_key = 'admin'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------- 2. Helpers ----------

-- Is this member row the signed-in user?
CREATE OR REPLACE FUNCTION private.is_self(mid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.members m WHERE m.id = mid AND m.user_id = (SELECT private.uid()));
$$;
--> statement-breakpoint
-- The department of a member (scoped permission checks)
CREATE OR REPLACE FUNCTION private.member_department(mid uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT m.department_id FROM public.members m WHERE m.id = mid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.is_self(uuid), private.member_department(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.is_self(uuid), private.member_department(uuid) TO authenticated;
--> statement-breakpoint

-- ---------- 3. Requests ----------

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "leave requests: own or managed read" ON public.leave_requests FOR SELECT TO authenticated
  USING (private.is_self(member_id) OR private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)));
--> statement-breakpoint
-- Only for yourself, in your own company, and always as a new (pending) request
CREATE POLICY "leave requests: own add" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    private.is_self(member_id) AND private.member_company_id(member_id) = company_id
    AND status = 'pending' AND decided_by_id IS NULL
  );
--> statement-breakpoint
-- The employee may only cancel; a manager decides (the service checks the allowed transitions)
CREATE POLICY "leave requests: own cancel or managed decide" ON public.leave_requests FOR UPDATE TO authenticated
  USING (private.is_self(member_id) OR private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)))
  WITH CHECK (
    private.member_company_id(member_id) = company_id
    AND ((private.is_self(member_id) AND status = 'cancelled')
         OR private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)))
  );
--> statement-breakpoint

-- ---------- 4. Per-employee allowances ----------

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "leave balances: own or managed read" ON public.leave_balances FOR SELECT TO authenticated
  USING (private.is_self(member_id) OR private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)));
--> statement-breakpoint
CREATE POLICY "leave balances: managed add" ON public.leave_balances FOR INSERT TO authenticated
  WITH CHECK (private.member_company_id(member_id) = company_id AND private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)));
--> statement-breakpoint
CREATE POLICY "leave balances: managed update" ON public.leave_balances FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)))
  WITH CHECK (private.member_company_id(member_id) = company_id AND private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)));
--> statement-breakpoint
CREATE POLICY "leave balances: managed delete" ON public.leave_balances FOR DELETE TO authenticated
  USING (private.has_permission(company_id, 'leaves.manage', private.member_department(member_id)));
--> statement-breakpoint

-- ---------- 5. Company policy ----------

ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "leave settings: members read" ON public.leave_settings FOR SELECT TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "leave settings: managers add" ON public.leave_settings FOR INSERT TO authenticated
  WITH CHECK (private.has_permission(company_id, 'leaves.manage'));
--> statement-breakpoint
CREATE POLICY "leave settings: managers update" ON public.leave_settings FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'leaves.manage')) WITH CHECK (private.has_permission(company_id, 'leaves.manage'));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.leave_requests, public.leave_settings TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
