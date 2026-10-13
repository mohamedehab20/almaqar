-- Account self-service (task C4): members may now edit their own name and job title.
-- Role, department, company, email and user link stay owner/admin-only (user_id may still change once,
-- when an invite is claimed by the matching email).

CREATE OR REPLACE FUNCTION private.guard_member_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT private.has_role(OLD.company_id, ARRAY['owner', 'admin']::public.member_role[])
     AND (
       (NEW.company_id, NEW.role, NEW.department_id, NEW.email)
         IS DISTINCT FROM (OLD.company_id, OLD.role, OLD.department_id, OLD.email)
       -- name and title: only on your own row
       OR ((NEW.name, NEW.title) IS DISTINCT FROM (OLD.name, OLD.title) AND OLD.user_id IS DISTINCT FROM (SELECT auth.uid()))
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
