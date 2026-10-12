-- Fixes for the Supabase advisors (task A2 in development-almaqar/08-backend-tasks.md).

-- ---------- 1. Fixed search_path on the two helpers that lacked it ----------

ALTER FUNCTION private.keep_number() SET search_path = '';
--> statement-breakpoint
ALTER FUNCTION private.try_uuid(text) SET search_path = '';
--> statement-breakpoint

-- ---------- 2. No SECURITY DEFINER functions in the exposed schema ----------
-- The privileged bodies move to "private" (not reachable through the API). "public" keeps thin
-- SECURITY INVOKER wrappers with the same names and arguments, so app code and RPC calls are unchanged.
-- A wrapper can only reach the private function if the caller has EXECUTE on it, granted below.

ALTER FUNCTION public.create_company(text, text, jsonb, jsonb) SET SCHEMA private;
--> statement-breakpoint
ALTER FUNCTION public.claim_invites() SET SCHEMA private;
--> statement-breakpoint
ALTER FUNCTION public.invite_exists(text) SET SCHEMA private;
--> statement-breakpoint
ALTER FUNCTION public.redeem_client_invite(text) SET SCHEMA private;
--> statement-breakpoint
ALTER FUNCTION public.company_slug_for_code(text) SET SCHEMA private;
--> statement-breakpoint

-- Nothing in "private" is callable by default; grant exactly what is needed.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA private TO anon, authenticated;
--> statement-breakpoint
-- Used inside RLS and storage policies (evaluated as the signed-in user)
GRANT EXECUTE ON FUNCTION
  private.is_member(uuid), private.has_role(uuid, public.member_role[]), private.is_client_user(uuid),
  private.client_company_id(uuid), private.try_uuid(text)
  TO authenticated;
--> statement-breakpoint
-- Reached through the public wrappers
GRANT EXECUTE ON FUNCTION
  private.create_company(text, text, jsonb, jsonb), private.claim_invites(), private.redeem_client_invite(text),
  private.company_slug_for_code(text), private.invite_exists(text)
  TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.invite_exists(text) TO anon;
--> statement-breakpoint

CREATE FUNCTION public.create_company(p_slug text, p_code text, p_name jsonb, p_owner_name jsonb) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.create_company(p_slug, p_code, p_name, p_owner_name) $$;
--> statement-breakpoint
CREATE FUNCTION public.claim_invites() RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.claim_invites() $$;
--> statement-breakpoint
CREATE FUNCTION public.invite_exists(p_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT private.invite_exists(p_code) $$;
--> statement-breakpoint
CREATE FUNCTION public.redeem_client_invite(p_code text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.redeem_client_invite(p_code) $$;
--> statement-breakpoint
CREATE FUNCTION public.company_slug_for_code(p_code text) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT private.company_slug_for_code(p_code) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION
  public.create_company(text, text, jsonb, jsonb), public.claim_invites(), public.invite_exists(text),
  public.redeem_client_invite(text), public.company_slug_for_code(text)
  FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  public.create_company(text, text, jsonb, jsonb), public.claim_invites(), public.invite_exists(text),
  public.redeem_client_invite(text), public.company_slug_for_code(text)
  TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.invite_exists(text) TO anon;
--> statement-breakpoint

-- ---------- 3. One permissive policy per table, role and action ----------
-- Same access as before, merged so Postgres evaluates one policy instead of two.
-- Briefs are also tightened: a brief's company must be its client's company for everyone, not only for portal users.

DROP POLICY "members manage briefs" ON public.briefs;
--> statement-breakpoint
DROP POLICY "client users read their briefs" ON public.briefs;
--> statement-breakpoint
DROP POLICY "client users send briefs" ON public.briefs;
--> statement-breakpoint
DROP POLICY "client users update their briefs" ON public.briefs;
--> statement-breakpoint
CREATE POLICY "briefs: members and the client read" ON public.briefs FOR SELECT TO authenticated
  USING (private.is_member(company_id) OR private.is_client_user(client_id));
--> statement-breakpoint
CREATE POLICY "briefs: members and the client add" ON public.briefs FOR INSERT TO authenticated
  WITH CHECK (company_id = private.client_company_id(client_id)
              AND (private.is_member(company_id) OR private.is_client_user(client_id)));
--> statement-breakpoint
CREATE POLICY "briefs: members and the client update" ON public.briefs FOR UPDATE TO authenticated
  USING (private.is_member(company_id) OR private.is_client_user(client_id))
  WITH CHECK (company_id = private.client_company_id(client_id)
              AND (private.is_member(company_id) OR private.is_client_user(client_id)));
--> statement-breakpoint
CREATE POLICY "briefs: members delete" ON public.briefs FOR DELETE TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint

DROP POLICY "members manage clients" ON public.clients;
--> statement-breakpoint
DROP POLICY "client users read their client" ON public.clients;
--> statement-breakpoint
CREATE POLICY "clients: members and the client read" ON public.clients FOR SELECT TO authenticated
  USING (private.is_member(company_id) OR private.is_client_user(id));
--> statement-breakpoint
CREATE POLICY "clients: members add" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "clients: members update" ON public.clients FOR UPDATE TO authenticated
  USING (private.is_member(company_id)) WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "clients: members delete" ON public.clients FOR DELETE TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint

DROP POLICY "members read client users" ON public.client_users;
--> statement-breakpoint
DROP POLICY "admins manage client users" ON public.client_users;
--> statement-breakpoint
CREATE POLICY "client users: members and self read" ON public.client_users FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_member(private.client_company_id(client_id)));
--> statement-breakpoint
CREATE POLICY "client users: admins add" ON public.client_users FOR INSERT TO authenticated
  WITH CHECK (private.has_role(private.client_company_id(client_id), ARRAY['owner', 'admin']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "client users: admins update" ON public.client_users FOR UPDATE TO authenticated
  USING (private.has_role(private.client_company_id(client_id), ARRAY['owner', 'admin']::public.member_role[]))
  WITH CHECK (private.has_role(private.client_company_id(client_id), ARRAY['owner', 'admin']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "client users: admins remove" ON public.client_users FOR DELETE TO authenticated
  USING (private.has_role(private.client_company_id(client_id), ARRAY['owner', 'admin']::public.member_role[]));
