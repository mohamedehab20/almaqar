-- RLS for automated flows (task C3): any member of the company manages its flows (same rule as workflows).

ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "members manage automation_flows" ON public.automation_flows FOR ALL TO authenticated
  USING (private.is_member(company_id)) WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_flows TO authenticated;
