-- Departments page: rooms on/off with a manager (company.settings), and company departments with a manager and
-- an active flag (departments.manage). Departments were writable by any member (0001); now only by managers.

-- ---------- 1. Company rooms ----------

ALTER TABLE public.company_rooms ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "company rooms: members read" ON public.company_rooms FOR SELECT TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "company rooms: settings add" ON public.company_rooms FOR INSERT TO authenticated
  WITH CHECK (
    private.has_permission(company_id, 'company.settings')
    AND (manager_id IS NULL OR private.member_company_id(manager_id) = company_id)
  );
--> statement-breakpoint
CREATE POLICY "company rooms: settings update" ON public.company_rooms FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'company.settings'))
  WITH CHECK (
    private.has_permission(company_id, 'company.settings')
    AND (manager_id IS NULL OR private.member_company_id(manager_id) = company_id)
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.company_rooms TO authenticated;
--> statement-breakpoint

-- ---------- 2. Departments: read by members, changed with departments.manage ----------

DROP POLICY "members manage departments" ON public.departments;
--> statement-breakpoint
CREATE POLICY "departments: members read" ON public.departments FOR SELECT TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "departments: managers add" ON public.departments FOR INSERT TO authenticated
  WITH CHECK (
    private.has_permission(company_id, 'departments.manage')
    AND (manager_id IS NULL OR private.member_company_id(manager_id) = company_id)
  );
--> statement-breakpoint
CREATE POLICY "departments: managers update" ON public.departments FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'departments.manage'))
  WITH CHECK (
    private.has_permission(company_id, 'departments.manage')
    AND (manager_id IS NULL OR private.member_company_id(manager_id) = company_id)
  );
--> statement-breakpoint
CREATE POLICY "departments: managers delete" ON public.departments FOR DELETE TO authenticated
  USING (private.has_permission(company_id, 'departments.manage'));
