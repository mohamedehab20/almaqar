-- Functions the auth flows call through the API (RPC).

-- Links invited members (members.email, user_id still null) to the signed-in user.
-- Called after every sign-in; returns how many memberships were claimed.
CREATE OR REPLACE FUNCTION public.claim_invites() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
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

-- Visitor login, step 1: is this invite code valid? (before the visitor has a session)
CREATE OR REPLACE FUNCTION public.invite_exists(p_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients c WHERE c.invite_code = upper(trim(p_code)) AND c.status <> 'paused');
$$;
--> statement-breakpoint

-- Visitor login, step 2 (after the OTP is verified): give the signed-in user access to that client's portal.
CREATE OR REPLACE FUNCTION public.redeem_client_invite(p_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
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

-- Company login: which company does this code open? Only answers for members of it.
CREATE OR REPLACE FUNCTION public.company_slug_for_code(p_code text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.slug FROM public.companies c
  WHERE c.code = upper(trim(p_code))
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.company_id = c.id AND m.user_id = (SELECT auth.uid()));
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.claim_invites() FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.redeem_client_invite(text) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.company_slug_for_code(text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.claim_invites() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.redeem_client_invite(text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.company_slug_for_code(text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.invite_exists(text) TO anon, authenticated;
