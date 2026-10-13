-- RLS for tasks: any member of the company manages its tasks (owner/admin rules for deleting live in the service).

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "members manage tasks" ON public.tasks FOR ALL TO authenticated
  USING (private.is_member(company_id)) WITH CHECK (private.is_member(company_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;
