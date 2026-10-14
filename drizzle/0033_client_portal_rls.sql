-- Client portal: existing clients came from Marketing, so they belong to it. Clients were writable by any
-- member (0005); now only clients.manage changes them (reading is unchanged). The department must be the company's.

UPDATE public.clients SET room = 'marketing' WHERE room IS NULL AND department_id IS NULL AND kind = 'client';
--> statement-breakpoint
DROP POLICY "clients: members add" ON public.clients;
--> statement-breakpoint
DROP POLICY "clients: members update" ON public.clients;
--> statement-breakpoint
DROP POLICY "clients: members delete" ON public.clients;
--> statement-breakpoint
CREATE POLICY "clients: managers add" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    private.has_permission(company_id, 'clients.manage')
    AND (department_id IS NULL OR EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.company_id = clients.company_id))
  );
--> statement-breakpoint
CREATE POLICY "clients: managers update" ON public.clients FOR UPDATE TO authenticated
  USING (private.has_permission(company_id, 'clients.manage'))
  WITH CHECK (
    private.has_permission(company_id, 'clients.manage')
    AND (department_id IS NULL OR EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.company_id = clients.company_id))
  );
--> statement-breakpoint
CREATE POLICY "clients: managers delete" ON public.clients FOR DELETE TO authenticated
  USING (private.has_permission(company_id, 'clients.manage'));
