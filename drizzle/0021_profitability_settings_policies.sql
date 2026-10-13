-- One permissive policy per action on profitability_settings (advisor: multiple_permissive_policies).
-- Reading stays with profitability.view (the owner has every permission); writing is the owner's.
DROP POLICY "owner writes settings" ON public.profitability_settings;
--> statement-breakpoint
CREATE POLICY "owner inserts settings" ON public.profitability_settings FOR INSERT TO authenticated
  WITH CHECK (private.has_role(company_id, ARRAY['owner']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "owner updates settings" ON public.profitability_settings FOR UPDATE TO authenticated
  USING (private.has_role(company_id, ARRAY['owner']::public.member_role[])) WITH CHECK (private.has_role(company_id, ARRAY['owner']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "owner deletes settings" ON public.profitability_settings FOR DELETE TO authenticated
  USING (private.has_role(company_id, ARRAY['owner']::public.member_role[]));
