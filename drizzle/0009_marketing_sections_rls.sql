-- RLS for the marketing sections (task C2). Members manage their company's rows; a client portal user
-- can read (not change) the accounts and campaigns of their own client. The client must belong to the
-- row's company, so a row can never point at another company's client.

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['social_accounts', 'campaigns'] LOOP
    EXECUTE format(
      'CREATE POLICY "%1$s: members and the client read" ON public.%1$I FOR SELECT TO authenticated
         USING (private.is_member(company_id) OR private.is_client_user(client_id))', t);
    EXECUTE format(
      'CREATE POLICY "%1$s: members add" ON public.%1$I FOR INSERT TO authenticated
         WITH CHECK (private.is_member(company_id) AND company_id = private.client_company_id(client_id))', t);
    EXECUTE format(
      'CREATE POLICY "%1$s: members update" ON public.%1$I FOR UPDATE TO authenticated
         USING (private.is_member(company_id))
         WITH CHECK (private.is_member(company_id) AND company_id = private.client_company_id(client_id))', t);
    EXECUTE format(
      'CREATE POLICY "%1$s: members delete" ON public.%1$I FOR DELETE TO authenticated
         USING (private.is_member(company_id))', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Supabase grants new public tables to the API roles automatically; PGlite tests rely on this too.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts, public.campaigns TO authenticated;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
  END IF;
END $$;
