-- Clerk is the identity provider: user ids are Clerk ids such as "user_2abc…" (text, not uuid).
-- The signed-in user comes from the JWT "sub" claim, which withUser() sets per transaction from Clerk
-- (and Supabase sets the same way if Clerk is later added as a third-party auth provider).
-- auth.uid() casts "sub" to uuid and would fail for Clerk ids, so every rule now uses private.uid().

-- ---------- 1. The current user, as text ----------

CREATE OR REPLACE FUNCTION private.uid() RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT nullif(coalesce((SELECT auth.jwt()) ->> 'sub', current_setting('request.jwt.claim.sub', true)), '');
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.uid() TO anon, authenticated;
--> statement-breakpoint

-- ---------- 2. Policies that read user_id must go before the type change ----------

DROP POLICY "admins or self update member" ON public.members;
--> statement-breakpoint
DROP POLICY "client users: members and self read" ON public.client_users;
--> statement-breakpoint
DROP POLICY "users manage own progress" ON public.lesson_progress;
--> statement-breakpoint

ALTER TABLE "client_users" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lesson_progress" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "user_id" SET DATA TYPE text;
--> statement-breakpoint

CREATE POLICY "admins or self update member" ON public.members FOR UPDATE TO authenticated
  USING (user_id = (SELECT private.uid()) OR private.has_role(company_id, ARRAY['owner', 'admin']::public.member_role[]))
  WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "client users: members and self read" ON public.client_users FOR SELECT TO authenticated
  USING (user_id = (SELECT private.uid()) OR private.is_member(private.client_company_id(client_id)));
--> statement-breakpoint
CREATE POLICY "users manage own progress" ON public.lesson_progress FOR ALL TO authenticated
  USING (user_id = (SELECT private.uid())) WITH CHECK (user_id = (SELECT private.uid()));
--> statement-breakpoint

-- ---------- 3. Helpers used by RLS ----------

CREATE OR REPLACE FUNCTION private.is_member(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.members m WHERE m.company_id = cid AND m.user_id = (SELECT private.uid()));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.has_role(cid uuid, roles public.member_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.company_id = cid AND m.user_id = (SELECT private.uid()) AND m.role = ANY (roles)
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.is_client_user(clid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.client_id = clid AND cu.user_id = (SELECT private.uid()));
$$;
--> statement-breakpoint

-- ---------- 4. Member guard (same rules as 0012) ----------

CREATE OR REPLACE FUNCTION private.guard_member_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT private.uid()) IS NOT NULL
     AND NOT private.has_role(OLD.company_id, ARRAY['owner', 'admin']::public.member_role[])
     AND (
       (NEW.company_id, NEW.role, NEW.department_id, NEW.email)
         IS DISTINCT FROM (OLD.company_id, OLD.role, OLD.department_id, OLD.email)
       -- name and title: only on your own row
       OR ((NEW.name, NEW.title) IS DISTINCT FROM (OLD.name, OLD.title) AND OLD.user_id IS DISTINCT FROM (SELECT private.uid()))
       -- user_id may only change when an invite is claimed (see claim_invites)
       OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT (
             OLD.user_id IS NULL
             AND NEW.user_id = (SELECT private.uid())
             AND lower(OLD.email) = lower((SELECT auth.jwt()) ->> 'email')))
     )
  THEN
    RAISE EXCEPTION 'Only owners and admins can change member details' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- ---------- 5. RPC bodies (public keeps the SECURITY INVOKER wrappers from 0005) ----------

CREATE OR REPLACE FUNCTION private.create_company(p_slug text, p_code text, p_name jsonb, p_owner_name jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid text := (SELECT private.uid());
  mail text := lower(nullif((SELECT auth.jwt()) ->> 'email', ''));
  cid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.companies (slug, code, name) VALUES (lower(trim(p_slug)), upper(trim(p_code)), p_name) RETURNING id INTO cid;
  INSERT INTO public.members (company_id, user_id, email, role, name, status)
    VALUES (cid, uid, mail, 'owner', p_owner_name, 'available');
  RETURN cid;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.claim_invites() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid text := (SELECT private.uid());
  mail text := lower(nullif((SELECT auth.jwt()) ->> 'email', ''));
  n integer;
BEGIN
  IF uid IS NULL OR mail IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.members SET user_id = uid
    WHERE user_id IS NULL AND lower(email) = mail
      AND NOT EXISTS (SELECT 1 FROM public.members m2 WHERE m2.company_id = members.company_id AND m2.user_id = uid);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.redeem_client_invite(p_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid text := (SELECT private.uid());
  clid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  SELECT c.id INTO clid FROM public.clients c WHERE c.invite_code = upper(trim(p_code)) AND c.status <> 'paused';
  IF clid IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.client_users (client_id, user_id) VALUES (clid, uid) ON CONFLICT DO NOTHING;
  RETURN clid;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.company_slug_for_code(p_code text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.slug FROM public.companies c
  WHERE c.code = upper(trim(p_code))
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.company_id = c.id AND m.user_id = (SELECT private.uid()));
$$;
