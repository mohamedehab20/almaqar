-- Smoke test for a real Supabase database (task A3 in development-almaqar/08-backend-tasks.md).
-- Run it with the MCP execute_sql tool or the SQL editor. It acts as several fake users through the same
-- role + JWT-claims mechanism PostgREST and withUser() use, checks the RLS rules, and then ALWAYS aborts with
-- an exception, so nothing it created is kept. Success: the error message starts with "SMOKE OK".

CREATE FUNCTION pg_temp.act_as(uid text, email text DEFAULT '') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

DO $$
DECLARE
  -- Clerk-style user ids (text)
  a text := 'user_smoke_a_' || left(md5(random()::text), 10); b text := 'user_smoke_b_' || left(md5(random()::text), 10);
  e text := 'user_smoke_e_' || left(md5(random()::text), 10); v text := 'user_smoke_v_' || left(md5(random()::text), 10);
  c1 uuid; c2 uuid; cl uuid; n int; txt text; failed boolean;
  log text[] := '{}';
BEGIN
  -- Two companies, each owned by its creator
  PERFORM pg_temp.act_as(a); c1 := public.create_company('smoke-a-' || right(a, 8), 'SMA' || right(a, 5), '{"ar":"A","en":"A"}', '{"ar":"Owner A","en":"Owner A"}');
  PERFORM pg_temp.act_as(b); c2 := public.create_company('smoke-b-' || right(b, 8), 'SMB' || right(b, 5), '{"ar":"B","en":"B"}', '{"ar":"Owner B","en":"Owner B"}');
  log := array_append(log, 'create_company x2');

  PERFORM pg_temp.act_as(a);
  SELECT count(*) INTO n FROM public.companies WHERE id IN (c1, c2);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner A sees % of the two companies', n; END IF;
  log := array_append(log, 'company isolation');

  failed := false;
  BEGIN INSERT INTO public.departments (company_id, name) VALUES (c2, '{"ar":"x","en":"x"}'); EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: A wrote into B''s company'; END IF;
  log := array_append(log, 'cross-company write blocked');

  -- Employee: may change own presence, not own role
  INSERT INTO public.members (company_id, user_id, name) VALUES (c1, e, '{"ar":"E","en":"E"}');
  PERFORM pg_temp.act_as(e);
  UPDATE public.members SET status = 'busy' WHERE user_id = e;
  failed := false;
  BEGIN UPDATE public.members SET role = 'admin' WHERE user_id = e; EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: employee promoted themself'; END IF;
  log := array_append(log, 'member guard');

  -- Permissions: a new company gets the Admin and Employee roles; only the owner manages them
  PERFORM pg_temp.act_as(a);
  SELECT count(*) INTO n FROM public.roles WHERE company_id = c1 AND system_key IN ('admin', 'employee');
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: new company has % default roles', n; END IF;
  IF NOT private.has_permission(c1, 'company.settings') THEN RAISE EXCEPTION 'FAIL: the owner lacks a permission'; END IF;
  PERFORM pg_temp.act_as(e);
  IF private.has_permission(c1, 'hr.view') THEN RAISE EXCEPTION 'FAIL: a member without a role has a permission'; END IF;
  failed := false;
  BEGIN INSERT INTO public.roles (company_id, name) VALUES (c1, '{"ar":"x","en":"x"}'); EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: an employee created a role'; END IF;
  log := array_append(log, 'permissions');

  -- Numbering
  INSERT INTO public.orders (company_id, type, party_id, number) VALUES (c1, 'sale', gen_random_uuid(), '') RETURNING number INTO txt;
  IF txt <> 'SO-1001' THEN RAISE EXCEPTION 'FAIL: first order number is %', txt; END IF;
  INSERT INTO public.workflow_runs (company_id, subject, code) VALUES (c1, '{"ar":"op","en":"op"}', '') RETURNING code INTO txt;
  IF txt <> 'OP-1001' THEN RAISE EXCEPTION 'FAIL: first operation code is %', txt; END IF;
  log := array_append(log, 'SO/OP numbering');

  -- Client portal: invite code → access to that client only; brief logs an event
  PERFORM pg_temp.act_as(a);
  INSERT INTO public.clients (company_id, name, invite_code) VALUES (c1, '{"ar":"C","en":"C"}', upper('SMK' || right(v, 6))) RETURNING id INTO cl;
  PERFORM pg_temp.act_as(v);
  PERFORM public.redeem_client_invite('SMK' || right(v, 6));
  SELECT count(*) INTO n FROM public.clients;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: portal user sees % clients', n; END IF;
  INSERT INTO public.briefs (company_id, client_id, type, objective, audience, details) VALUES (c1, cl, 'paidAds', '{"ar":"o","en":"o"}', '{"ar":"o","en":"o"}', '{"ar":"o","en":"o"}');
  SELECT count(*) INTO n FROM public.departments;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: portal user sees departments'; END IF;
  PERFORM pg_temp.act_as(a);
  SELECT count(*) INTO n FROM public.events WHERE company_id = c1 AND type = 'brief.received';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: brief.received events = %', n; END IF;
  log := array_append(log, 'client portal + brief event');

  -- Events are append-only
  UPDATE public.events SET severity = 'critical' WHERE company_id = c1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: events were editable'; END IF;
  log := array_append(log, 'events append-only');

  -- Storage policies: own company folder yes, other company's folder no
  INSERT INTO storage.objects (bucket_id, name) VALUES ('attachments', c1 || '/workflows/smoke.txt');
  failed := false;
  BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('attachments', c2 || '/workflows/smoke.txt'); EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: wrote a file into another company''s folder'; END IF;
  log := array_append(log, 'storage policies');

  -- Anonymous visitor
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: anon sees companies'; END IF;
  failed := false;
  BEGIN PERFORM public.create_company('x', 'x', '{}', '{}'); EXCEPTION WHEN others THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'FAIL: anon created a company'; END IF;
  log := array_append(log, 'anon locked out');

  RAISE EXCEPTION 'SMOKE OK (rolled back): %', array_to_string(log, ', ');
END $$;
