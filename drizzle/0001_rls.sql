-- Row Level Security for every table in public.
-- Rule: a signed-in user sees and changes only the rows of companies they are a member of.
-- Client portal users see only their own client's row and briefs.
-- Helper functions live in the "private" schema so they are not exposed through the Supabase API.

CREATE SCHEMA IF NOT EXISTS private;
--> statement-breakpoint
GRANT USAGE ON SCHEMA private TO authenticated;
--> statement-breakpoint

-- ---------- Helpers (SECURITY DEFINER: they read members/clients without recursing into RLS) ----------

CREATE OR REPLACE FUNCTION private.is_member(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.company_id = cid AND m.user_id = (SELECT auth.uid())
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.has_role(cid uuid, roles public.member_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.company_id = cid AND m.user_id = (SELECT auth.uid()) AND m.role = ANY (roles)
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.is_client_user(clid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.client_id = clid AND cu.user_id = (SELECT auth.uid())
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.client_company_id(clid uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.company_id FROM public.clients c WHERE c.id = clid;
$$;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
--> statement-breakpoint

-- ---------- Enable RLS everywhere ----------

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ---------- Plain tenant tables: any member of the company has full access ----------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departments', 'rooms', 'furniture', 'zones', 'notes', 'workflows', 'workflow_runs', 'suppliers', 'orders', 'agents', 'marketing_ideas'] LOOP
    EXECUTE format(
      'CREATE POLICY "members manage %1$s" ON public.%1$I FOR ALL TO authenticated
         USING (private.is_member(company_id)) WITH CHECK (private.is_member(company_id))', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ---------- companies: created only through create_company() ----------

CREATE POLICY "members read their company" ON public.companies FOR SELECT TO authenticated
  USING (private.is_member(id));
--> statement-breakpoint
CREATE POLICY "admins update their company" ON public.companies FOR UPDATE TO authenticated
  USING (private.has_role(id, ARRAY['owner', 'admin']::public.member_role[]))
  WITH CHECK (private.has_role(id, ARRAY['owner', 'admin']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "owner deletes the company" ON public.companies FOR DELETE TO authenticated
  USING (private.has_role(id, ARRAY['owner']::public.member_role[]));
--> statement-breakpoint

-- ---------- members: admins manage; everyone may update their own presence ----------

CREATE POLICY "members read colleagues" ON public.members FOR SELECT TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "admins add members" ON public.members FOR INSERT TO authenticated
  WITH CHECK (private.has_role(company_id, ARRAY['owner', 'admin']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "admins or self update member" ON public.members FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.has_role(company_id, ARRAY['owner', 'admin']::public.member_role[]))
  WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "admins remove members" ON public.members FOR DELETE TO authenticated
  USING (private.has_role(company_id, ARRAY['owner', 'admin']::public.member_role[]));
--> statement-breakpoint

-- A non-admin updating their own row may change only presence fields.
CREATE OR REPLACE FUNCTION private.guard_member_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT private.has_role(OLD.company_id, ARRAY['owner', 'admin']::public.member_role[])
     AND (
       (NEW.company_id, NEW.role, NEW.department_id, NEW.name, NEW.title, NEW.email)
         IS DISTINCT FROM (OLD.company_id, OLD.role, OLD.department_id, OLD.name, OLD.title, OLD.email)
       -- user_id may only change when an invite is claimed (see claim_invites)
       OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT (
             OLD.user_id IS NULL
             AND NEW.user_id = (SELECT auth.uid())
             AND lower(OLD.email) = lower((SELECT auth.jwt()) ->> 'email')))
     )
  THEN
    RAISE EXCEPTION 'Only owners and admins can change member details' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guard_member_update BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION private.guard_member_update();
--> statement-breakpoint

-- ---------- clients and their portal users ----------

CREATE POLICY "members manage clients" ON public.clients FOR ALL TO authenticated
  USING (private.is_member(company_id)) WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "client users read their client" ON public.clients FOR SELECT TO authenticated
  USING (private.is_client_user(id));
--> statement-breakpoint
CREATE POLICY "members read client users" ON public.client_users FOR SELECT TO authenticated
  USING (private.is_member(private.client_company_id(client_id)) OR user_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "admins manage client users" ON public.client_users FOR ALL TO authenticated
  USING (private.has_role(private.client_company_id(client_id), ARRAY['owner', 'admin']::public.member_role[]))
  WITH CHECK (private.has_role(private.client_company_id(client_id), ARRAY['owner', 'admin']::public.member_role[]));
--> statement-breakpoint

-- ---------- briefs: the company works on them, the client sends and answers them ----------

CREATE POLICY "members manage briefs" ON public.briefs FOR ALL TO authenticated
  USING (private.is_member(company_id)) WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "client users read their briefs" ON public.briefs FOR SELECT TO authenticated
  USING (private.is_client_user(client_id));
--> statement-breakpoint
CREATE POLICY "client users send briefs" ON public.briefs FOR INSERT TO authenticated
  WITH CHECK (private.is_client_user(client_id) AND company_id = private.client_company_id(client_id));
--> statement-breakpoint
CREATE POLICY "client users update their briefs" ON public.briefs FOR UPDATE TO authenticated
  USING (private.is_client_user(client_id))
  WITH CHECK (private.is_client_user(client_id) AND company_id = private.client_company_id(client_id));
--> statement-breakpoint

-- ---------- events: append-only ----------

CREATE POLICY "members read events" ON public.events FOR SELECT TO authenticated
  USING (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "members add events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (private.is_member(company_id));
--> statement-breakpoint

-- ---------- lesson_progress: each user owns their rows ----------

CREATE POLICY "users manage own progress" ON public.lesson_progress FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
--> statement-breakpoint

-- ---------- Signup: create a company and make the caller its owner, atomically ----------

CREATE OR REPLACE FUNCTION public.create_company(p_slug text, p_code text, p_name jsonb, p_owner_name jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  cid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.companies (slug, code, name) VALUES (lower(trim(p_slug)), upper(trim(p_code)), p_name) RETURNING id INTO cid;
  INSERT INTO public.members (company_id, user_id, role, name, status)
    VALUES (cid, uid, 'owner', p_owner_name, 'available');
  RETURN cid;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_company(text, text, jsonb, jsonb) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_company(text, text, jsonb, jsonb) TO authenticated;
