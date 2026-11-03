-- Access-rule tests. Everything runs in one transaction and is rolled back, so it leaves no data behind.
-- It can also run on the real project (SQL editor): checks count only the test users' rows, or expect
-- zero rows that a user must never see. The first failed check aborts the run.
begin;

set local storage.allow_delete_query = 'true';

create function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.guest() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create function pg_temp.sys() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- the statement must raise an error
create function pg_temp.fails(what text, q text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'FAIL (should be refused): %', what;
end $$;

-- the statement must affect or return exactly n rows
create function pg_temp.rows(what text, q text, n int) returns void language plpgsql as $$
declare c int;
begin
  execute 'with x as (' || q || ') select count(*) from x' into c;
  if c <> n then
    raise exception 'FAIL %: expected % rows, got %', what, n, c;
  end if;
end $$;

create function pg_temp.ok(what text, cond boolean) returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL %', what;
  end if;
end $$;

do $test$
declare
  alice uuid := '00000000-0000-4000-8000-00000000000a';
  bob   uuid := '00000000-0000-4000-8000-00000000000b';
  admin uuid := '00000000-0000-4000-8000-00000000000c';
  strip uuid := '10000000-0000-4000-8000-000000000001';
  strip_p uuid := '30000000-0000-4000-8000-0000000000ff';
  priv_c uuid := '20000000-0000-4000-8000-000000000001';
  bob_p uuid := '30000000-0000-4000-8000-0000000000b1';
  note_c uuid :='20000000-0000-4000-8000-0000000000a1';
  late_c uuid := '20000000-0000-4000-8000-0000000000a2';
  pub_c  uuid := '20000000-0000-4000-8000-000000000002';
  priv_p uuid := '30000000-0000-4000-8000-000000000001';
  pub_p  uuid := '30000000-0000-4000-8000-000000000002';
  stats jsonb;
  before jsonb;
  everyone uuid[] := array[alice, bob, admin];
begin
  perform pg_temp.sys();
  -- created_at is set here: on the project a plain insert into auth.users leaves it empty.
  insert into auth.users (id, email, created_at) values
    (alice, 'alice@example.invalid', now()), (bob, 'bob@example.invalid', now()), (admin, 'admin@example.invalid', now());
  insert into public.admins (user_id) values (admin);
  perform pg_temp.login(admin);
  before := public.admin_stats();
  perform pg_temp.sys();

  -- ---------- structure: nothing may be open by accident ----------
  perform pg_temp.ok('RLS on every public table', not exists (
    select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity));
  perform pg_temp.ok('anon may only read', not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'));
  perform pg_temp.ok('anon has no column write', not exists (
    select 1 from information_schema.column_privileges
    where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'));
  perform pg_temp.ok('anon reads only public tables', not exists (
    select 1 from information_schema.table_privileges
    where grantee = 'anon' and table_schema = 'public'
      and table_name not in ('comments', 'photos')));
  perform pg_temp.ok('profiles: anon sees no private column', not exists (
    select 1 from information_schema.column_privileges
    where grantee in ('anon', 'authenticated') and table_schema = 'public' and table_name = 'profiles'
      and privilege_type = 'SELECT' and column_name not in ('id', 'display_name')));
  perform pg_temp.ok('no client grant on admins', not exists (
    select 1 from information_schema.table_privileges
    where grantee in ('anon', 'authenticated', 'PUBLIC') and table_schema = 'public' and table_name = 'admins'));
  perform pg_temp.ok('anon cannot run any public function', not exists (
    select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where s.nspname = 'public' and d.objid is null and has_function_privilege('anon', p.oid, 'execute')));
  perform pg_temp.ok('authenticated runs only the app functions', not exists (
    select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where s.nspname = 'public' and d.objid is null and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname not in ('is_admin', 'is_reported', 'admin_stats', 'admin_moderate', 'delete_my_account')));
  create table public.rls_auto_probe (id int);
  perform pg_temp.ok('automatic RLS still switches on', (
    select relrowsecurity from pg_class where oid = 'public.rls_auto_probe'::regclass));
  drop table public.rls_auto_probe;
  perform pg_temp.ok('definer functions pin search_path', not exists (
    select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname in ('public', 'private') and p.prosecdef
      and not coalesce(p.proconfig::text like '%search_path=%', false)));
  perform pg_temp.ok('bucket is private', (select not public from storage.buckets where id = 'photos'));

  -- ---------- alice's data ----------
  perform pg_temp.login(alice);
  insert into public.profiles (display_name) values ('Alice');
  insert into public.user_settings (lang, terms_version, terms_accepted_at) values ('cs', 'test', now());
  insert into public.custom_airfields (id, name, lat, lon) values (strip, 'Secret strip', 50, 15);
  insert into public.landings (airfield_code, landed_on) values ('LKBE', '2026-09-10');
  insert into public.landings (custom_airfield_id) values (strip);
  insert into public.airfield_flags (airfield_code, is_favorite) values ('LKLB', true);
  insert into public.comments (id, airfield_code, body) values (priv_c, 'LKBE', 'private note');
  insert into public.comments (id, airfield_code, body, is_public) values (pub_c, 'LKBE', 'public note', true);
  insert into public.photos (id, airfield_code) values (priv_p, 'LKBE');
  insert into public.photos (id, airfield_code, is_public) values (pub_p, 'LKBE', true);
  perform pg_temp.ok('default owner comes from the login',
    (select user_id from public.comments where id = priv_c) = alice);
  perform pg_temp.ok('owner sees own landings', (select count(*) from public.landings) = 2);

  -- files: the row must exist first
  insert into storage.objects (bucket_id, name) values ('photos', alice || '/' || priv_p || '.jpg');
  insert into storage.objects (bucket_id, name) values ('photos', alice || '/' || pub_p || '.jpg');
  insert into storage.objects (bucket_id, name) values ('photos', alice || '/' || pub_p || '_thumb.jpg');
  perform pg_temp.fails('upload without a row', format(
    $$insert into storage.objects (bucket_id, name) values ('photos', '%s/%s.jpg')$$, alice, gen_random_uuid()));
  perform pg_temp.fails('upload outside the bucket', format(
    $$insert into storage.objects (bucket_id, name) values ('other', '%s/%s.jpg')$$, alice, priv_p));

  -- ---------- a photo that is public but not uploaded is not shown yet ----------
  perform pg_temp.guest();
  perform pg_temp.ok('unfinished upload is hidden', (select count(*) from public.photos where user_id = alice) = 0);
  perform pg_temp.login(alice);
  update public.photos set uploaded_at = now() where id in (priv_p, pub_p);

  -- ---------- bob must not reach alice's private data ----------
  perform pg_temp.login(bob);
  perform pg_temp.ok('bob: no landings', (select count(*) from public.landings) = 0);
  perform pg_temp.ok('bob: no flags', (select count(*) from public.airfield_flags) = 0);
  perform pg_temp.ok('bob: no strips', (select count(*) from public.custom_airfields) = 0);
  perform pg_temp.ok('bob: no settings', (select count(*) from public.user_settings) = 0);
  perform pg_temp.ok('bob: only public comment', (select count(*) from public.comments where user_id = alice) = 1
    and exists (select 1 from public.comments where id = pub_c));
  perform pg_temp.ok('bob: only public photo', (select count(*) from public.photos where user_id = alice) = 1
    and exists (select 1 from public.photos where id = pub_p));
  perform pg_temp.ok('bob: only public files', (select count(*) from storage.objects where name like alice || '/%') = 2);
  perform pg_temp.rows('bob cannot change a landing', 'update public.landings set landed_on = null returning 1', 0);
  perform pg_temp.rows('bob cannot delete a landing', 'delete from public.landings returning 1', 0);
  perform pg_temp.rows('bob cannot edit a public comment',
    format($$update public.comments set body = 'x' where id = %L returning 1$$, pub_c), 0);
  perform pg_temp.rows('bob cannot delete a public comment',
    format('delete from public.comments where id = %L returning 1', pub_c), 0);
  perform pg_temp.rows('bob cannot rename alice',
    $$update public.profiles set display_name = 'Evil' where display_name = 'Alice' returning 1$$, 0);
  perform pg_temp.rows('bob cannot delete alice''s file',
    'delete from storage.objects returning 1', 0);
  perform pg_temp.fails('bob cannot use alice''s strip', format(
    'insert into public.landings (custom_airfield_id) values (%L)', strip));
  perform pg_temp.fails('bob cannot upload into alice''s path', format(
    $$insert into storage.objects (bucket_id, name) values ('photos', '%s/%s.jpg')$$, alice, gen_random_uuid()));
  perform pg_temp.rows('nobody can replace a file',
    $$update storage.objects set name = name || 'x' returning 1$$, 0);

  -- ---------- forged fields ----------
  perform pg_temp.fails('forged user_id on insert', format(
    $$insert into public.landings (user_id, airfield_code) values (%L, 'LKHK')$$, alice));
  perform pg_temp.fails('forged moderation', $$insert into public.comments (airfield_code, body, moderation)
    values ('LKHK', 'x', 'visible')$$);
  perform pg_temp.fails('forged created_at', $$insert into public.comments (airfield_code, body, created_at)
    values ('LKHK', 'x', now() - interval '9 days')$$);
  perform pg_temp.fails('forged reporter', format(
    $$insert into public.reports (reporter_id, comment_id, reason) values (%L, %L, 'spam')$$, alice, pub_c));
  perform pg_temp.fails('admins not readable', 'select * from public.admins');
  perform pg_temp.fails('admins not writable', format('insert into public.admins (user_id) values (%L)', bob));
  perform pg_temp.fails('private schema closed', $$select private.set_updated_at()$$);

  -- ---------- publishing rules ----------
  perform pg_temp.fails('public without a nickname', $$insert into public.comments (airfield_code, body, is_public)
    values ('LKHK', 'x', true)$$);
  perform pg_temp.login(alice);
  perform pg_temp.fails('public comment on a private strip', format(
    $$insert into public.comments (custom_airfield_id, body, is_public) values (%L, 'x', true)$$, strip));
  perform pg_temp.fails('moderation not editable', format(
    $$update public.comments set moderation = 'visible' where id = %L$$, pub_c));
  perform pg_temp.fails('author cannot be changed', format(
    'update public.comments set user_id = %L where id = %L', bob, pub_c));
  perform pg_temp.fails('nickname too short', $$update public.profiles set display_name = 'x'$$);
  perform pg_temp.fails('bad airfield code', $$insert into public.landings (airfield_code) values ('<script>')$$);
  perform pg_temp.fails('no airfield', 'insert into public.landings (landed_on) values (now())');
  perform pg_temp.fails('both airfields', format(
    $$insert into public.landings (airfield_code, custom_airfield_id) values ('LKHK', %L)$$, strip));
  perform pg_temp.fails('duplicate landing', $$insert into public.landings (airfield_code) values ('LKBE')$$);

  -- ---------- the statements behind backend.js ----------
  insert into public.landings (airfield_code, custom_airfield_id, landed_on, client_updated_at)
    values ('LKBE', null, '2026-09-11', now())
    on conflict (user_id, airfield_code, custom_airfield_id) do update set
      airfield_code = excluded.airfield_code, custom_airfield_id = excluded.custom_airfield_id,
      landed_on = excluded.landed_on, client_updated_at = excluded.client_updated_at;
  insert into public.landings (airfield_code, custom_airfield_id, landed_on, client_updated_at)
    values (null, strip, '2026-09-12', now())
    on conflict (user_id, airfield_code, custom_airfield_id) do update set
      airfield_code = excluded.airfield_code, custom_airfield_id = excluded.custom_airfield_id,
      landed_on = excluded.landed_on, client_updated_at = excluded.client_updated_at;
  perform pg_temp.ok('upsert changes the row, adds none', (select count(*) from public.landings) = 2
    and (select landed_on from public.landings where airfield_code = 'LKBE') = '2026-09-11'
    and (select landed_on from public.landings where custom_airfield_id = strip) = '2026-09-12');
  insert into public.airfield_flags (airfield_code, custom_airfield_id, is_favorite, wants_visit, client_updated_at)
    values ('LKLB', null, false, true, now())
    on conflict (user_id, airfield_code, custom_airfield_id) do update set
      airfield_code = excluded.airfield_code, custom_airfield_id = excluded.custom_airfield_id,
      is_favorite = excluded.is_favorite, wants_visit = excluded.wants_visit,
      client_updated_at = excluded.client_updated_at;
  perform pg_temp.ok('flag upsert changes the row', (select wants_visit from public.airfield_flags where airfield_code = 'LKLB'));
  insert into public.comments (id, airfield_code, custom_airfield_id, body, client_updated_at)
    values (priv_c, 'LKHK', null, 'overwritten?', now()) on conflict (id) do nothing;
  perform pg_temp.ok('repeated insert leaves the row alone',
    (select body from public.comments where id = priv_c) = 'private note');
  perform pg_temp.rows('note update', format(
    $$update public.comments set body = 'private note', client_updated_at = now() where id = %L returning 1$$, priv_c), 1);
  insert into public.custom_airfields (id, name, lat, lon, client_updated_at)
    values (strip, 'x', 1, 1, now()) on conflict (id) do nothing;
  perform pg_temp.ok('repeated strip insert leaves the row alone',
    (select name from public.custom_airfields where id = strip) = 'Secret strip');
  perform pg_temp.fails('an upsert may not rewrite a comment place', format(
    $$insert into public.comments (id, airfield_code, body) values (%L, 'LKHK', 'x')
      on conflict (id) do update set airfield_code = excluded.airfield_code$$, priv_c));

  -- ---------- offline conflict: the older change loses ----------
  update public.landings set landed_on = '2026-10-01', client_updated_at = now() + interval '2 minutes'
    where airfield_code = 'LKBE';
  update public.landings set landed_on = '2020-01-01', client_updated_at = now() + interval '1 minute'
    where airfield_code = 'LKBE';
  perform pg_temp.ok('older offline change ignored',
    (select landed_on from public.landings where airfield_code = 'LKBE') = '2026-10-01');

  -- ---------- guest ----------
  perform pg_temp.guest();
  perform pg_temp.ok('guest: public comment', (select count(*) from public.comments where user_id = alice) = 1);
  perform pg_temp.ok('guest: public photo', (select count(*) from public.photos where user_id = alice) = 1);
  perform pg_temp.ok('guest: only public files', (select count(*) from storage.objects where name like alice || '/%') = 2);
  perform pg_temp.ok('guest: private file not reachable by its exact path', not exists (
    select 1 from storage.objects where name = alice || '/' || priv_p || '.jpg'));
  perform pg_temp.login(alice);
  update public.photos set is_public = false, client_updated_at = now() + interval '1 minute' where id = pub_p;
  perform pg_temp.guest();
  perform pg_temp.ok('guest: file goes when its photo turns private', not exists (
    select 1 from storage.objects where name like alice || '/%'));
  perform pg_temp.login(alice);
  update public.photos set is_public = true, client_updated_at = now() + interval '2 minutes' where id = pub_p;
  perform pg_temp.guest();
  perform pg_temp.ok('guest: nickname', (select count(*) from public.profiles where id = any(everyone)) = 1);
  perform pg_temp.fails('guest: landings closed', 'select * from public.landings');
  perform pg_temp.fails('guest: flags closed', 'select * from public.airfield_flags');
  perform pg_temp.fails('guest: strips closed', 'select * from public.custom_airfields');
  perform pg_temp.fails('guest: settings closed', 'select * from public.user_settings');
  perform pg_temp.fails('guest: reports closed', 'select * from public.reports');
  perform pg_temp.fails('guest: feedback closed', 'select * from public.feedback');
  perform pg_temp.fails('guest: no comment', $$insert into public.comments (airfield_code, body) values ('LKHK', 'x')$$);
  perform pg_temp.fails('guest: no feedback', $$insert into public.feedback (message) values ('x')$$);
  perform pg_temp.fails('guest: no upload', format(
    $$insert into storage.objects (bucket_id, name) values ('photos', '%s/%s.jpg')$$, alice, pub_p));
  perform pg_temp.fails('guest: no stats', 'select public.admin_stats()');
  perform pg_temp.fails('guest: no is_admin', 'select public.is_admin()');

  -- ---------- reports and feedback ----------
  perform pg_temp.login(bob);
  perform pg_temp.fails('cannot report what you cannot see', format(
    $$insert into public.reports (comment_id, reason) values (%L, 'spam')$$, priv_c));
  perform pg_temp.fails('cannot report a private photo', format(
    $$insert into public.reports (photo_id, reason) values (%L, 'spam')$$, priv_p));
  insert into public.reports (comment_id, reason) values (pub_c, 'offensive');
  insert into public.reports (photo_id, reason) values (pub_p, 'offensive');
  perform pg_temp.fails('report only once', format(
    $$insert into public.reports (comment_id, reason) values (%L, 'spam')$$, pub_c));
  perform pg_temp.ok('reporter cannot read reports', (select count(*) from public.reports) = 0);
  perform pg_temp.fails('status not editable', $$update public.reports set status = 'dismissed'$$);
  insert into public.feedback (message, app_version) values ('nice app', '1');
  perform pg_temp.ok('author cannot read feedback', (select count(*) from public.feedback) = 0);
  perform pg_temp.fails('bob: no stats', 'select public.admin_stats()');
  perform pg_temp.fails('bob: no moderation', format(
    $$select public.admin_moderate(%L, null, 'hidden', 'resolved')$$, pub_c));
  perform pg_temp.ok('bob is no admin', not public.is_admin());
  perform pg_temp.fails('report snapshot cannot be forged', format(
    $$insert into public.reports (photo_id, reason, comment_body) values (%L, 'spam', 'x')$$, pub_p));
  perform pg_temp.login(alice);
  update public.comments set body = 'harmless now', client_updated_at = now() + interval '30 minutes' where id = pub_c;

  -- ---------- admin: aggregates and reported content, no private data ----------
  perform pg_temp.login(admin);
  perform pg_temp.fails('nickname taken, case ignored',
    $$insert into public.profiles (display_name) values ('ALICE')$$);
  stats := public.admin_stats();
  perform pg_temp.ok('stats count', (stats ->> 'landings')::int = (before ->> 'landings')::int + 2
    and (stats ->> 'reports_open')::int = (before ->> 'reports_open')::int + 2
    and (stats ->> 'users')::int >= 3);
  perform pg_temp.ok('stats count the new test users', (stats ->> 'users_new_30d')::int >= 3);
  perform pg_temp.ok('stats show activity', (stats ->> 'users_active_7d') is not null);
  perform pg_temp.ok('stats list sign-ups by day', jsonb_typeof(stats -> 'signups_by_day') = 'array');
  perform pg_temp.ok('stats hold no e-mail', not (stats::text ~* 'email|@'));
  perform pg_temp.ok('report keeps the reported text', (select comment_body from public.reports
    where comment_id = pub_c and reporter_id = bob) = 'public note');
  perform pg_temp.ok('admin sees reports', (select count(*) from public.reports where reporter_id = bob) = 2);
  perform pg_temp.ok('admin sees feedback', (select count(*) from public.feedback where user_id = bob) = 1);
  perform pg_temp.ok('admin: no landings', (select count(*) from public.landings) = 0);
  perform pg_temp.ok('admin: no strips', (select count(*) from public.custom_airfields) = 0);
  perform pg_temp.ok('admin: no private comment',
    not exists (select 1 from public.comments where id = priv_c));
  perform pg_temp.ok('admin: no private photo',
    not exists (select 1 from public.photos where id = priv_p));
  update public.feedback set status = 'read';
  perform pg_temp.fails('admin needs a report to moderate', format(
    $$select public.admin_moderate(%L, null, 'hidden', 'resolved')$$, priv_c));
  perform public.admin_moderate(pub_c, null, 'hidden', 'resolved');
  perform public.admin_moderate(null, pub_p, 'hidden', 'resolved');
  perform pg_temp.ok('reports closed',
    (public.admin_stats() ->> 'reports_open')::int = (before ->> 'reports_open')::int);
  perform pg_temp.ok('admin still sees reported comment', exists (select 1 from public.comments where id = pub_c));
  perform pg_temp.ok('admin still sees reported file',
    (select count(*) from storage.objects where name like alice || '/%') = 2);

  perform pg_temp.guest();
  perform pg_temp.ok('hidden comment gone', (select count(*) from public.comments where user_id = alice) = 0);
  perform pg_temp.ok('hidden photo gone', (select count(*) from public.photos where user_id = alice) = 0);
  perform pg_temp.ok('hidden files gone', (select count(*) from storage.objects where name like alice || '/%') = 0);
  perform pg_temp.login(alice);
  perform pg_temp.ok('author keeps own hidden comment', exists (select 1 from public.comments where id = pub_c));
  update public.comments set is_public = false, client_updated_at = now() + interval '1 hour' where id = pub_c;
  update public.comments set is_public = true, client_updated_at = now() + interval '2 hours' where id = pub_c;
  perform pg_temp.ok('hiding survives re-publishing',
    (select moderation from public.comments where id = pub_c) = 'hidden');

  -- ---------- limits ----------
  insert into public.photos (airfield_code) values ('LKHD'), ('LKHD'), ('LKHD');
  perform pg_temp.fails('4th photo on an airfield', $$insert into public.photos (airfield_code) values ('LKHD')$$);
  perform pg_temp.fails('oversized comment', format(
    $$insert into public.comments (airfield_code, body) values ('LKHK', %L)$$, repeat('x', 2001)));
  update public.user_settings set terms_accepted_at = null;
  perform pg_temp.fails('public without accepted terms', $$insert into public.comments (airfield_code, body, is_public)
    values ('LKTB', 'c', true)$$);
  perform pg_temp.fails('going public without accepted terms', format(
    'update public.comments set is_public = true where id = %L', priv_c));
  update public.user_settings set terms_accepted_at = now();
  perform pg_temp.fails('public landing note', $$insert into public.comments (airfield_code, body, is_note, is_public)
    values ('LKPR', 'n', true, true)$$);
  insert into public.comments (id, airfield_code, body, is_note) values (note_c, 'LKPR', 'note', true);
  perform pg_temp.fails('landing note cannot go public', format(
    'update public.comments set is_public = true where id = %L', note_c));
  perform pg_temp.fails('is_note cannot change later', format(
    'update public.comments set is_note = false where id = %L', note_c));
  for i in 1..5 loop
    insert into public.comments (airfield_code, body, is_public) values ('LKPR', 'c', true);
  end loop;
  perform pg_temp.fails('6th public comment on an airfield', $$insert into public.comments (airfield_code, body, is_public)
    values ('LKPR', 'c', true)$$);
  insert into public.comments (id, airfield_code, body) values (late_c, 'LKPR', 'later');
  perform pg_temp.fails('limit also applies when going public', format(
    'update public.comments set is_public = true where id = %L', late_c));
  perform pg_temp.rows('another airfield has its own limit', format(
    $$insert into public.comments (airfield_code, body, is_public) values ('LKPM', 'c', true) returning 1$$), 1);
  perform pg_temp.login(bob);
  for i in 1..5 loop
    if i > 1 then insert into public.feedback (message) values ('m'); end if;
  end loop;
  perform pg_temp.fails('6th feedback in a day', $$insert into public.feedback (message) values ('m')$$);
  for i in 1..50 loop
    insert into public.comments (airfield_code, body) values ('LKHK', 'c');
  end loop;
  perform pg_temp.fails('51st comment in a day', $$insert into public.comments (airfield_code, body) values ('LKHK', 'c')$$);

  -- ---------- retention of resolved reports ----------
  perform pg_temp.sys();
  update public.reports set resolved_at = now() - interval '13 months' where comment_id = pub_c and reporter_id = bob;
  insert into public.feedback (user_id, message, status, created_at) values
    (admin, 'old closed', 'closed', now() - interval '13 months'), (admin, 'old open', 'new', now() - interval '13 months'); -- bob is at his daily limit
  perform private.purge_resolved_reports();
  perform pg_temp.ok('closed feedback goes after 12 months',
    not exists (select 1 from public.feedback where user_id = admin and message = 'old closed'));
  perform pg_temp.ok('unanswered feedback stays',
    exists (select 1 from public.feedback where user_id = admin and message = 'old open'));
  perform pg_temp.ok('resolved report goes after 12 months',
    not exists (select 1 from public.reports where comment_id = pub_c and reporter_id = bob));
  perform pg_temp.ok('a younger resolved report stays',
    exists (select 1 from public.reports where photo_id = pub_p and reporter_id = bob));
  perform pg_temp.login(bob);
  perform pg_temp.fails('nobody runs the purge from the app', 'select private.purge_resolved_reports()');

  -- ---------- storage delete and account deletion ----------
  perform pg_temp.login(alice);
  perform pg_temp.rows('owner deletes own file',
    format($$delete from storage.objects where name = '%s/%s.jpg' returning 1$$, alice, priv_p), 1);
  perform pg_temp.rows('row without files can go',
    format($$delete from public.photos where id = %L returning 1$$, priv_p), 1);
  perform pg_temp.fails('row cannot leave its files behind', format(
    $$delete from public.photos where id = %L$$, pub_p));
  insert into public.photos (id, custom_airfield_id) values (strip_p, strip);
  insert into storage.objects (bucket_id, name) values ('photos', alice || '/' || strip_p || '_thumb.jpg');
  perform pg_temp.fails('deleting a strip cannot leave files behind', format(
    $$delete from public.custom_airfields where id = %L$$, strip));
  perform pg_temp.rows('files of the strip photo go first',
    format($$delete from storage.objects where name = '%s/%s_thumb.jpg' returning 1$$, alice, strip_p), 1);
  perform pg_temp.rows('then the strip can go',
    format($$delete from public.custom_airfields where id = %L returning 1$$, strip), 1);

  perform pg_temp.guest();
  perform pg_temp.fails('guest cannot delete an account', 'select public.delete_my_account()');
  perform pg_temp.login(alice);
  perform pg_temp.fails('account deletion waits for the files', 'select public.delete_my_account()');
  perform pg_temp.rows('owner removes the remaining files', format(
    $$delete from storage.objects where name like '%s/%%' returning 1$$, alice), 2);
  perform pg_temp.sys();
  insert into storage.objects (bucket_id, name) values ('photos', alice || '/orphan.jpg');
  perform pg_temp.login(alice);
  perform pg_temp.fails('a file without a row also stops the deletion', 'select public.delete_my_account()');
  perform pg_temp.sys();
  delete from storage.objects where name = alice || '/orphan.jpg';
  perform pg_temp.login(alice);
  perform public.delete_my_account();
  perform pg_temp.sys();
  perform pg_temp.ok('deletion removes the account', not exists (select 1 from auth.users where id = alice));
  perform pg_temp.ok('bob keeps his account', exists (select 1 from auth.users where id = bob));
  perform pg_temp.ok('account deletion removes the data', not exists (
    select 1 from public.landings where user_id = alice
    union all select 1 from public.comments where user_id = alice
    union all select 1 from public.photos where user_id = alice
    union all select 1 from public.custom_airfields where user_id = alice
    union all select 1 from public.profiles where id = alice));

  -- Deletion without a JWT (dashboard, SQL) must not depend on files: they are removed separately.
  perform pg_temp.login(bob);
  insert into public.photos (id, airfield_code) values (bob_p, 'LKHD');
  insert into storage.objects (bucket_id, name) values ('photos', bob || '/' || bob_p || '.jpg');
  perform pg_temp.sys();
  delete from auth.users where id = bob;
  perform pg_temp.ok('deletion without a JWT removes rows despite files',
    not exists (select 1 from public.photos where id = bob_p));

  raise notice 'ALL RLS TESTS PASSED';
end $test$;

rollback;
