-- Client profitability: the new permission (owner + Admin role only), and RLS for the new tables.

-- ---------- 1. Catalog mirror (src/modules/permissions/catalog.ts gained profitability.view) ----------

CREATE OR REPLACE FUNCTION private.permission_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'members.invite', 'members.edit', 'members.remove', 'departments.manage', 'operations.view', 'operations.create', 'notes.write', 'notes.manage', 'tasks.create', 'tasks.manage', 'automation.view', 'workflows.manage', 'runs.start', 'flows.manage', 'sales.view', 'orders.create', 'orders.approve', 'suppliers.manage', 'marketing.view', 'clients.manage', 'briefs.manage', 'ideas.manage', 'campaigns.manage', 'profitability.view', 'agents.view', 'agents.use', 'agents.manage', 'company.settings']::text[] $$;
--> statement-breakpoint
-- Existing Admin roles had every permission, so they get the new one too (Employee roles do not)
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'profitability.view' FROM public.roles r WHERE r.system_key = 'admin'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------- 2. RLS ----------

-- Meetings (minimal calendar): any member of the company
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "members manage meetings" ON public.meetings FOR ALL TO authenticated
  USING (private.is_member(company_id)) WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
-- Money: invoices and freelancer payments only for whoever sees profitability (owner, Admin by default)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "profitability manages invoices" ON public.invoices FOR ALL TO authenticated
  USING (private.has_permission(company_id, 'profitability.view')) WITH CHECK (private.has_permission(company_id, 'profitability.view'));
--> statement-breakpoint
ALTER TABLE public.freelancer_payments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "profitability manages freelancer payments" ON public.freelancer_payments FOR ALL TO authenticated
  USING (private.has_permission(company_id, 'profitability.view')) WITH CHECK (private.has_permission(company_id, 'profitability.view'));
--> statement-breakpoint
-- Cost settings: read with profitability.view, change by the owner only
ALTER TABLE public.profitability_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "profitability reads settings" ON public.profitability_settings FOR SELECT TO authenticated
  USING (private.has_permission(company_id, 'profitability.view'));
--> statement-breakpoint
CREATE POLICY "owner writes settings" ON public.profitability_settings FOR ALL TO authenticated
  USING (private.has_role(company_id, ARRAY['owner']::public.member_role[])) WITH CHECK (private.has_role(company_id, ARRAY['owner']::public.member_role[]));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings, public.invoices, public.freelancer_payments, public.profitability_settings TO authenticated;
