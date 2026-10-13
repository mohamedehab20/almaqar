-- One permissive policy per action (advisor: multiple_permissive_policies). Same rules as 0017:
-- members read, the owner writes, and only catalog permissions can be stored.
DROP POLICY "role permissions: owner manages" ON public.role_permissions;
--> statement-breakpoint
CREATE POLICY "role permissions: owner adds" ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (private.has_role(private.role_company_id(role_id), ARRAY['owner']::public.member_role[]) AND permission = ANY (private.permission_keys()));
--> statement-breakpoint
CREATE POLICY "role permissions: owner updates" ON public.role_permissions FOR UPDATE TO authenticated
  USING (private.has_role(private.role_company_id(role_id), ARRAY['owner']::public.member_role[]))
  WITH CHECK (private.has_role(private.role_company_id(role_id), ARRAY['owner']::public.member_role[]) AND permission = ANY (private.permission_keys()));
--> statement-breakpoint
CREATE POLICY "role permissions: owner deletes" ON public.role_permissions FOR DELETE TO authenticated
  USING (private.has_role(private.role_company_id(role_id), ARRAY['owner']::public.member_role[]));
--> statement-breakpoint
DROP POLICY "overrides: owner manages" ON public.member_permission_overrides;
--> statement-breakpoint
CREATE POLICY "overrides: owner adds" ON public.member_permission_overrides FOR INSERT TO authenticated
  WITH CHECK (private.has_role(private.member_company_id(member_id), ARRAY['owner']::public.member_role[]) AND permission = ANY (private.permission_keys()));
--> statement-breakpoint
CREATE POLICY "overrides: owner updates" ON public.member_permission_overrides FOR UPDATE TO authenticated
  USING (private.has_role(private.member_company_id(member_id), ARRAY['owner']::public.member_role[]))
  WITH CHECK (private.has_role(private.member_company_id(member_id), ARRAY['owner']::public.member_role[]) AND permission = ANY (private.permission_keys()));
--> statement-breakpoint
CREATE POLICY "overrides: owner deletes" ON public.member_permission_overrides FOR DELETE TO authenticated
  USING (private.has_role(private.member_company_id(member_id), ARRAY['owner']::public.member_role[]));
