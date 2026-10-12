-- Document numbers (SO-/PO-/OP-), file storage for attachments, and realtime publication.

-- ---------- Document numbers: assigned by the database, per company and series ----------

CREATE TABLE IF NOT EXISTS private.counters (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  series text NOT NULL,
  last integer NOT NULL,
  PRIMARY KEY (company_id, series)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.next_number(p_company uuid, p_series text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  INSERT INTO private.counters AS c (company_id, series, last)
    VALUES (p_company, p_series, 1001)
    ON CONFLICT (company_id, series) DO UPDATE SET last = c.last + 1
    RETURNING last INTO n;
  RETURN p_series || '-' || n;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.assign_order_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.number := private.next_number(NEW.company_id, CASE NEW.type WHEN 'sale' THEN 'SO' ELSE 'PO' END);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assign_order_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.assign_order_number();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.assign_run_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.code := private.next_number(NEW.company_id, 'OP');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assign_run_code BEFORE INSERT ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION private.assign_run_code();
--> statement-breakpoint
-- Numbers never change after insert
CREATE OR REPLACE FUNCTION private.keep_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN NEW.number := OLD.number; ELSE NEW.code := OLD.code; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER keep_order_number BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION private.keep_number();
--> statement-breakpoint
CREATE TRIGGER keep_run_code BEFORE UPDATE ON public.workflow_runs FOR EACH ROW EXECUTE FUNCTION private.keep_number();
--> statement-breakpoint

-- ---------- Storage: one private bucket, files under "<company_id>/..." ----------
-- Brief attachments from client portal users go under "<company_id>/briefs/<client_id>/...".

CREATE OR REPLACE FUNCTION private.try_uuid(v text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN v::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.try_uuid(text) TO authenticated;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
      VALUES ('attachments', 'attachments', false, 10485760)
      ON CONFLICT (id) DO NOTHING;

    CREATE POLICY "members manage company files" ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'attachments' AND private.is_member(private.try_uuid((storage.foldername(name))[1])))
      WITH CHECK (bucket_id = 'attachments' AND private.is_member(private.try_uuid((storage.foldername(name))[1])));

    CREATE POLICY "client users manage their brief files" ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'attachments'
        AND (storage.foldername(name))[2] = 'briefs'
        AND private.is_client_user(private.try_uuid((storage.foldername(name))[3]))
        AND private.client_company_id(private.try_uuid((storage.foldername(name))[3])) = private.try_uuid((storage.foldername(name))[1])
      )
      WITH CHECK (
        bucket_id = 'attachments'
        AND (storage.foldername(name))[2] = 'briefs'
        AND private.is_client_user(private.try_uuid((storage.foldername(name))[3]))
        AND private.client_company_id(private.try_uuid((storage.foldername(name))[3])) = private.try_uuid((storage.foldername(name))[1])
      );
  END IF;
END $$;
--> statement-breakpoint

-- ---------- Realtime: tables the UI subscribes to (RLS still applies to subscribers) ----------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE
      public.members, public.briefs, public.notes, public.events, public.workflow_runs, public.orders, public.marketing_ideas;
  END IF;
END $$;
--> statement-breakpoint

-- ---------- Events written by the database (actors who cannot write events themselves) ----------

-- A client portal user sending a brief is not a company member, so the event is logged here.
CREATE OR REPLACE FUNCTION private.log_brief_received() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.events (company_id, type, source, severity, payload)
    VALUES (NEW.company_id, 'brief.received', 'user', 'info',
            jsonb_build_object('briefId', NEW.id, 'clientId', NEW.client_id, 'type', NEW.type));
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER log_brief_received AFTER INSERT ON public.briefs
  FOR EACH ROW EXECUTE FUNCTION private.log_brief_received();
