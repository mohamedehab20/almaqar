-- Client portal access (set by the company per client): briefs, invoices, meetings, files.
-- Existing meeting visitors only see their meetings. Briefs need "briefs" for portal users; invoices and
-- meetings reach portal users only through two readers that return their own client's rows (no other
-- columns, no other clients) when that part of the portal is allowed.

UPDATE public.clients SET portal_access = '{meetings}'::text[] WHERE kind = 'visitor';
--> statement-breakpoint
ALTER TABLE public.clients ADD CONSTRAINT clients_portal_access_known
  CHECK (portal_access <@ '{briefs,invoices,meetings,files}'::text[]);
--> statement-breakpoint

-- Is the caller a portal user of this client, and may they use this part of the portal?
CREATE OR REPLACE FUNCTION private.client_allows(clid uuid, feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users cu
    JOIN public.clients c ON c.id = cu.client_id
    WHERE cu.client_id = clid AND cu.user_id = (SELECT private.uid()) AND feature = ANY (c.portal_access)
  );
$$;
--> statement-breakpoint

-- ---------- Briefs: portal users need "briefs" ----------

DROP POLICY "briefs: members and the client read" ON public.briefs;
--> statement-breakpoint
DROP POLICY "briefs: members and the client add" ON public.briefs;
--> statement-breakpoint
DROP POLICY "briefs: members and the client update" ON public.briefs;
--> statement-breakpoint
CREATE POLICY "briefs: members and the client read" ON public.briefs FOR SELECT TO authenticated
  USING (private.is_member(company_id) OR private.client_allows(client_id, 'briefs'));
--> statement-breakpoint
CREATE POLICY "briefs: members and the client add" ON public.briefs FOR INSERT TO authenticated
  WITH CHECK (company_id = private.client_company_id(client_id)
              AND (private.is_member(company_id) OR private.client_allows(client_id, 'briefs')));
--> statement-breakpoint
CREATE POLICY "briefs: members and the client update" ON public.briefs FOR UPDATE TO authenticated
  USING (private.is_member(company_id) OR private.client_allows(client_id, 'briefs'))
  WITH CHECK (company_id = private.client_company_id(client_id)
              AND (private.is_member(company_id) OR private.client_allows(client_id, 'briefs')));
--> statement-breakpoint

-- ---------- Readers for the portal ----------

CREATE OR REPLACE FUNCTION private.portal_invoices(clid uuid)
RETURNS TABLE (id uuid, period date, amount numeric, issued_on date, due_on date, paid_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.id, i.period, i.amount, i.issued_on, i.due_on, i.paid_on
  FROM public.invoices i
  WHERE i.client_id = clid AND private.client_allows(clid, 'invoices')
  ORDER BY i.issued_on DESC
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.portal_meetings(clid uuid)
RETURNS TABLE (id uuid, title text, starts_at timestamptz, duration_minutes integer, location text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.id, m.title, m.starts_at, m.duration_minutes, m.location, m.status::text
  FROM public.meetings m
  WHERE m.client_id = clid AND private.client_allows(clid, 'meetings')
  ORDER BY m.starts_at DESC
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.client_allows(uuid, text), private.portal_invoices(uuid), private.portal_meetings(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.client_allows(uuid, text), private.portal_invoices(uuid), private.portal_meetings(uuid) TO authenticated;
