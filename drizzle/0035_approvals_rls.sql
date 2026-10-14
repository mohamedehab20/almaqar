-- Approvals: only the two people involved (and the owner) see a request. The requester creates it for
-- themselves, as pending, to someone of the same company; files must sit in the company's approvals folder.
-- Either side may update it (the service allows: the approver decides, the requester cancels).

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "approvals: the two people and the owner read" ON public.approval_requests FOR SELECT TO authenticated
  USING (private.is_self(requester_id) OR private.is_self(approver_id) OR private.has_role(company_id, ARRAY['owner']::public.member_role[]));
--> statement-breakpoint
CREATE POLICY "approvals: requester adds" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    private.is_self(requester_id)
    AND private.member_company_id(requester_id) = company_id
    AND private.member_company_id(approver_id) = company_id
    AND status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(attachments) f WHERE NOT (f ->> 'path') LIKE company_id::text || '/approvals/%')
  );
--> statement-breakpoint
CREATE POLICY "approvals: the two people update" ON public.approval_requests FOR UPDATE TO authenticated
  USING (private.is_self(requester_id) OR private.is_self(approver_id))
  WITH CHECK (
    (private.is_self(requester_id) AND status IN ('pending', 'cancelled'))
    OR (private.is_self(approver_id) AND status IN ('pending', 'approved', 'rejected'))
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
