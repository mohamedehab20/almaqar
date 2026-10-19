-- Analytics room (development-almaqar/10-analytics-srs.md): three permissions, and readers for the rows that
-- RLS keeps private (working sessions, leave, approvals). The readers return only members whose department
-- the caller may analyse (analytics.departments), so a scoped manager never receives other departments' rows.

-- ---------- 1. Catalog mirror (src/modules/permissions/catalog.ts gained the analytics area) ----------

CREATE OR REPLACE FUNCTION private.permission_keys() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT ARRAY['hr.view', 'members.invite', 'members.edit', 'members.remove', 'departments.manage', 'leaves.manage', 'hours.manage', 'recruitment.manage', 'operations.view', 'operations.create', 'notes.write', 'notes.manage', 'tasks.create', 'tasks.manage', 'automation.view', 'workflows.manage', 'runs.start', 'flows.manage', 'sales.view', 'orders.create', 'orders.approve', 'suppliers.manage', 'marketing.view', 'clients.manage', 'briefs.manage', 'ideas.manage', 'campaigns.manage', 'profitability.view', 'agents.view', 'agents.use', 'agents.manage', 'analytics.view', 'analytics.departments', 'analytics.members', 'company.settings']::text[] $$;
--> statement-breakpoint
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, k.permission FROM public.roles r
CROSS JOIN (VALUES ('analytics.view'), ('analytics.departments'), ('analytics.members')) AS k(permission)
WHERE r.system_key = 'admin'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ---------- 2. Scoped readers (SECURITY DEFINER: they read past RLS, then filter by the caller's scope) ----------

-- Minutes worked per member between two instants (sessions cut to the window; a running session counts until now).
CREATE OR REPLACE FUNCTION private.analytics_minutes(cid uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (member_id uuid, minutes integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.member_id,
         (sum(extract(epoch FROM (least(coalesce(s.ended_at, now()), p_to) - greatest(s.started_at, p_from)))) / 60)::integer
  FROM public.work_sessions s
  JOIN public.members m ON m.id = s.member_id
  WHERE s.company_id = cid
    AND s.started_at < p_to AND coalesce(s.ended_at, now()) > p_from
    AND private.has_permission(cid, 'analytics.view')
    AND private.has_permission(cid, 'analytics.departments', m.department_id)
  GROUP BY s.member_id
$$;
--> statement-breakpoint

-- Approved leave that touches the period.
CREATE OR REPLACE FUNCTION private.analytics_leave(cid uuid, p_from date, p_to date)
RETURNS TABLE (member_id uuid, starts_on date, ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.member_id, l.starts_on, l.ends_on
  FROM public.leave_requests l
  JOIN public.members m ON m.id = l.member_id
  WHERE l.company_id = cid AND l.status = 'approved'
    AND l.starts_on <= p_to AND l.ends_on >= p_from
    AND private.has_permission(cid, 'analytics.view')
    AND private.has_permission(cid, 'analytics.departments', m.department_id)
$$;
--> statement-breakpoint

-- Approval requests still waiting, counted at the approver (no titles or details: only who and since when).
CREATE OR REPLACE FUNCTION private.analytics_waiting_approvals(cid uuid)
RETURNS TABLE (approver_id uuid, created_at timestamptz, due_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.approver_id, a.created_at, a.due_on
  FROM public.approval_requests a
  JOIN public.members m ON m.id = a.approver_id
  WHERE a.company_id = cid AND a.status = 'pending'
    AND private.has_permission(cid, 'analytics.view')
    AND private.has_permission(cid, 'analytics.departments', m.department_id)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.analytics_minutes(uuid, timestamptz, timestamptz), private.analytics_leave(uuid, date, date), private.analytics_waiting_approvals(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.analytics_minutes(uuid, timestamptz, timestamptz), private.analytics_leave(uuid, date, date), private.analytics_waiting_approvals(uuid) TO authenticated;
