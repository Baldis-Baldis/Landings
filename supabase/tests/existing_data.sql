-- Someone else's data, as on a project in use. Local tests only: proves rls_test.sql does not depend
-- on an empty project. Never run this on a real project.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f0', 'someone@example.invalid');
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-0000000000f0', 'Someone');
insert into public.user_settings (user_id, terms_version, terms_accepted_at)
  values ('00000000-0000-4000-8000-0000000000f0', 'test', now());
insert into public.custom_airfields (id, user_id, name, lat, lon)
  values ('10000000-0000-4000-8000-0000000000f0', '00000000-0000-4000-8000-0000000000f0', 'Their strip', 49, 16);
insert into public.landings (user_id, airfield_code) values ('00000000-0000-4000-8000-0000000000f0', 'LKBE');
insert into public.airfield_flags (user_id, airfield_code, is_favorite)
  values ('00000000-0000-4000-8000-0000000000f0', 'LKBE', true);
insert into public.comments (id, user_id, airfield_code, body, is_public)
  values ('20000000-0000-4000-8000-0000000000f0', '00000000-0000-4000-8000-0000000000f0', 'LKBE', 'hello', true);
insert into public.photos (id, user_id, airfield_code, is_public, uploaded_at)
  values ('30000000-0000-4000-8000-0000000000f0', '00000000-0000-4000-8000-0000000000f0', 'LKBE', true, now());
insert into storage.objects (bucket_id, name) values
  ('photos', '00000000-0000-4000-8000-0000000000f0/30000000-0000-4000-8000-0000000000f0.jpg'),
  ('photos', '00000000-0000-4000-8000-0000000000f0/30000000-0000-4000-8000-0000000000f0_thumb.jpg');
insert into public.reports (reporter_id, comment_id, reason)
  values ('00000000-0000-4000-8000-0000000000f0', '20000000-0000-4000-8000-0000000000f0', 'other');
insert into public.feedback (user_id, message) values ('00000000-0000-4000-8000-0000000000f0', 'hi');
