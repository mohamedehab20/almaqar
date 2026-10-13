-- Owner-defined permissions: logic, default roles, and the RLS rules that used to say "owner or admin".
-- The permission catalog lives in src/modules/permissions/catalog.ts; private.permission_keys() mirrors it
-- (a test fails if they drift).

-- ---------- 1. Catalog mirror + default roles ----------

CREATE OR REPLACE FUNCTION private.permission_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'members.invite', 'members.edit', 'members.remove', 'departments.manage', 'operations.view', 'operations.create', 'notes.write', 'notes.manage', 'tasks.create', 'tasks.manage', 'automation.view', 'workflows.manage', 'runs.start', 'flows.manage', 'sales.view', 'orders.create', 'orders.approve', 'suppliers.manage', 'marketing.view', 'clients.manage', 'briefs.manage', 'ideas.manage', 'campaigns.manage', 'agents.view', 'agents.use', 'agents.manage', 'company.settings']::text[] $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.employee_default_permissions() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'operations.view', 'operations.create', 'notes.write', 'tasks.create', 'automation.view', 'runs.start', 'sales.view', 'orders.create', 'marketing.view', 'ideas.manage', 'agents.view', 'agents.use']::text[] $$;
--> statement-breakpoint

-- Creates the two system roles of a company (Admin = everything, Employee = the defaults) and returns them.
CREATE OR REPLACE FUNCTION private.seed_default_roles(cid uuid, OUT admin_role uuid, OUT employee_role uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.roles (company_id, name, system_key) VALUES (cid, '{"ar":"مدير","en":"Admin"}', 'admin') RETURNING id INTO admin_role;
  INSERT INTO public.roles (company_id, name, system_key) VALUES (cid, '{"ar":"موظف","en":"Employee"}', 'employee') RETURNING id INTO employee_role;
  INSERT INTO public.role_permissions (role_id, permission) SELECT admin_role, unnest(private.permission_keys());
  INSERT INTO public.role_permissions (role_id, permission) SELECT employee_role, unnest(private.employee_default_permissions());
END;
$$;
--> statement-breakpoint

-- ---------- 2. The check ----------
-- Owner → yes. A "deny" override that covers the department → no. A "grant" override that covers it → yes.
-- The role has it for that department → yes. Otherwise no. department_ids NULL means every department;
-- a scoped grant never matches a NULL department (the action is not about a specific department).

CREATE OR REPLACE FUNCTION private.has_permission(cid uuid, perm text, dept uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me public.members%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.members m WHERE m.company_id = cid AND m.user_id = (SELECT private.uid());
  IF me.id IS NULL THEN RETURN false; END IF;
  IF me.role = 'owner' THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.member_permission_overrides o
             WHERE o.member_id = me.id AND o.permission = perm AND o.effect = 'deny'
               AND (o.department_ids IS NULL OR dept = ANY (o.department_ids))) THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.member_permission_overrides o
             WHERE o.member_id = me.id AND o.permission = perm AND o.effect = 'grant'
               AND (o.department_ids IS NULL OR dept = ANY (o.department_ids))) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.role_permissions rp
                 WHERE rp.role_id = me.role_id AND rp.permission = perm
                   AND (rp.department_ids IS NULL OR dept = ANY (rp.department_ids)));
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.has_permission(uuid, text, uuid), private.seed_default_roles(uuid), private.permission_keys(), private.employee_default_permissions() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text, uuid), private.permission_keys(), private.employee_default_permissions() TO authenticated;
--> statement-breakpoint

-- ---------- 3. Existing companies: default roles, members keep what they had ----------

DO $$
DECLARE c record; r record;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    SELECT * INTO r FROM private.seed_default_roles(c.id);
    UPDATE public.members SET role_id = r.admin_role WHERE company_id = c.id AND role = 'admin';
    UPDATE public.members SET role_id = r.employee_role WHERE company_id = c.id AND role = 'employee';
  END LOOP;
END $$;
--> statement-breakpoint

-- ---------- 4. New companies get the default roles too ----------

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
  PERFORM private.seed_default_roles(cid);
  RETURN cid;
END;
$$;
--> statement-breakpoint

-- ---------- 5. RLS on the new tables: members read, only the owner changes ----------

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.member_permission_overrides ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles, public.role_permissions, public.member_permission_overrides TO authenticated;
--> statement-breakpoint
CREATE POLICY "roles: members read" ON public.roles FOR SELECT TO authenticated USING (private.is_member(company_id));
--> statement-breakpoint
CREATE POLICY "roles: owner adds" ON public.roles FOR INSERT TO authenticated
  WITH CHECK (private.has_role(company_id, ARRAY['owner']::public.member_role[]) AND system_key IS NULL);
--> statement-breakpoint
CREATE POLICY "roles: owner updates" ON public.roles FOR UPDATE TO authenticated
  USING (private.has_role(company_id, ARRAY['owner']::public.member_role[]))
  WITH CHECK (private.has_role(company_id, ARRAY['owner']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "roles: owner deletes custom roles" ON public.roles FOR DELETE TO authenticated
  USING (private.has_role(company_id, ARRAY['owner']::public.member_role[]) AND system_key IS NULL);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION private.role_company_id(rid uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT r.company_id FROM public.roles r WHERE r.id = rid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.member_company_id(mid uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT m.company_id FROM public.members m WHERE m.id = mid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.role_company_id(uuid), private.member_company_id(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.role_company_id(uuid), private.member_company_id(uuid) TO authenticated;
--> statement-breakpoint

CREATE POLICY "role permissions: members read" ON public.role_permissions FOR SELECT TO authenticated
  USING (private.is_member(private.role_company_id(role_id)));
--> statement-breakpoint
CREATE POLICY "role permissions: owner manages" ON public.role_permissions FOR ALL TO authenticated
  USING (private.has_role(private.role_company_id(role_id), ARRAY['owner']::public.member_role[]))
  WITH CHECK (private.has_role(private.role_company_id(role_id), ARRAY['owner']::public.member_role[])
              AND permission = ANY (private.permission_keys()));
--> statement-breakpoint
CREATE POLICY "overrides: members read" ON public.member_permission_overrides FOR SELECT TO authenticated
  USING (private.is_member(private.member_company_id(member_id)));
--> statement-breakpoint
CREATE POLICY "overrides: owner manages" ON public.member_permission_overrides FOR ALL TO authenticated
  USING (private.has_role(private.member_company_id(member_id), ARRAY['owner']::public.member_role[]))
  WITH CHECK (private.has_role(private.member_company_id(member_id), ARRAY['owner']::public.member_role[])
              AND permission = ANY (private.permission_keys()));
--> statement-breakpoint

-- ---------- 6. Rules that used to mean "owner or admin" now follow the permissions ----------

DROP POLICY "admins update their company" ON public.companies;
--> statement-breakpoint
CREATE POLICY "company settings permission updates the company" ON public.companies FOR UPDATE TO authenticated
  USING (private.has_permission(id, 'company.settings')) WITH CHECK (private.has_permission(id, 'company.settings'));
--> statement-breakpoint
DROP POLICY "admins add members" ON public.members;
--> statement-breakpoint
CREATE POLICY "invite permission adds members" ON public.members FOR INSERT TO authenticated
  WITH CHECK (role <> 'owner' AND private.has_permission(company_id, 'members.invite', department_id));
--> statement-breakpoint
DROP POLICY "admins or self update member" ON public.members;
--> statement-breakpoint
CREATE POLICY "self or edit permission updates a member" ON public.members FOR UPDATE TO authenticated
  USING (user_id = (SELECT private.uid()) OR private.has_permission(company_id, 'members.edit', department_id))
  WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
DROP POLICY "admins remove members" ON public.members;
--> statement-breakpoint
CREATE POLICY "remove permission deletes a member" ON public.members FOR DELETE TO authenticated
  USING (role <> 'owner' AND private.has_permission(company_id, 'members.remove', department_id));
--> statement-breakpoint
DROP POLICY "client users: admins add" ON public.client_users;
--> statement-breakpoint
DROP POLICY "client users: admins update" ON public.client_users;
--> statement-breakpoint
DROP POLICY "client users: admins remove" ON public.client_users;
--> statement-breakpoint
CREATE POLICY "client users: clients permission adds" ON public.client_users FOR INSERT TO authenticated
  WITH CHECK (private.has_permission(private.client_company_id(client_id), 'clients.manage'));
--> statement-breakpoint
CREATE POLICY "client users: clients permission updates" ON public.client_users FOR UPDATE TO authenticated
  USING (private.has_permission(private.client_company_id(client_id), 'clients.manage'))
  WITH CHECK (private.has_permission(private.client_company_id(client_id), 'clients.manage'));
--> statement-breakpoint
CREATE POLICY "client users: clients permission removes" ON public.client_users FOR DELETE TO authenticated
  USING (private.has_permission(private.client_company_id(client_id), 'clients.manage'));
--> statement-breakpoint

-- Member guard: role / role_id only by the owner; the owner's own record only by the owner; other details
-- need members.edit for the member's department (and for the new one when moving departments).
CREATE OR REPLACE FUNCTION private.guard_member_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid text := (SELECT private.uid());
  is_owner boolean;
  can_edit boolean;
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  is_owner := private.has_role(OLD.company_id, ARRAY['owner']::public.member_role[]);
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'A member cannot move to another company' USING ERRCODE = '42501';
  END IF;
  IF (NEW.role, NEW.role_id) IS DISTINCT FROM (OLD.role, OLD.role_id) AND NOT is_owner THEN
    RAISE EXCEPTION 'Only the owner can change roles' USING ERRCODE = '42501';
  END IF;
  can_edit := is_owner OR (
    OLD.role <> 'owner'
    AND private.has_permission(OLD.company_id, 'members.edit', OLD.department_id)
    AND (NEW.department_id IS NOT DISTINCT FROM OLD.department_id OR private.has_permission(OLD.company_id, 'members.edit', NEW.department_id))
  );
  IF NOT can_edit AND (
       (NEW.department_id, NEW.email) IS DISTINCT FROM (OLD.department_id, OLD.email)
       OR ((NEW.name, NEW.title) IS DISTINCT FROM (OLD.name, OLD.title) AND OLD.user_id IS DISTINCT FROM uid)
       OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT (
             OLD.user_id IS NULL AND NEW.user_id = uid
             AND lower(OLD.email) = lower((SELECT auth.jwt()) ->> 'email')))
     ) THEN
    RAISE EXCEPTION 'Only owners and admins can change member details' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
