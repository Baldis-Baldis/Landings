-- Who can do what. Two independent layers, both required:
--   GRANT decides which tables and columns a role may touch at all,
--   RLS decides which rows.
-- Writes are granted per column: user_id comes from the auth.uid() default, and moderation,
-- status and timestamps can never be set by a client.

-- ---------- start from zero ----------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.admins enable row level security;
alter table public.custom_airfields enable row level security;
alter table public.landings enable row level security;
alter table public.airfield_flags enable row level security;
alter table public.comments enable row level security;
alter table public.photos enable row level security;
alter table public.reports enable row level security;
alter table public.feedback enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;

-- ---------- admin check ----------

-- SECURITY DEFINER: public.admins has no client grants. search_path is empty so nothing can be shadowed.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- SECURITY DEFINER: the policies on comments and photos cannot read public.reports directly, because
-- the report policy reads comments and photos, and Postgres refuses that as recursion.
create function public.is_reported(p_comment_id uuid, p_photo_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and exists (
    select 1 from public.reports r
    where r.comment_id is not distinct from p_comment_id
      and r.photo_id is not distinct from p_photo_id
  )
$$;
revoke all on function public.is_reported(uuid, uuid) from public, anon;
grant execute on function public.is_reported(uuid, uuid) to authenticated;

-- ---------- grants ----------

grant usage on schema public to anon, authenticated;

grant select (id, display_name) on public.profiles to anon, authenticated;
grant insert (display_name), update (display_name) on public.profiles to authenticated;

grant select on public.user_settings to authenticated;
grant insert (terms_version, terms_accepted_at, lang),
      update (terms_version, terms_accepted_at, lang) on public.user_settings to authenticated;

grant select, delete on public.custom_airfields to authenticated;
grant insert (id, name, short, description, lat, lon, elev, town, client_updated_at),
      update (name, short, description, lat, lon, elev, town, client_updated_at)
  on public.custom_airfields to authenticated;

-- Upserted on (user_id, airfield_code, custom_airfield_id), so the client never sends id or user_id.
grant select, delete on public.landings to authenticated;
grant insert (airfield_code, custom_airfield_id, landed_on, client_updated_at),
      update (airfield_code, custom_airfield_id, landed_on, client_updated_at)
  on public.landings to authenticated;

grant select, delete on public.airfield_flags to authenticated;
grant insert (airfield_code, custom_airfield_id, is_favorite, wants_visit, client_updated_at),
      update (airfield_code, custom_airfield_id, is_favorite, wants_visit, client_updated_at)
  on public.airfield_flags to authenticated;

grant select on public.comments to anon, authenticated;
grant delete on public.comments to authenticated;
grant insert (id, airfield_code, custom_airfield_id, body, is_public, client_updated_at),
      update (body, is_public, client_updated_at) on public.comments to authenticated;

grant select on public.photos to anon, authenticated;
grant delete on public.photos to authenticated;
grant insert (id, airfield_code, custom_airfield_id, is_public, client_updated_at),
      update (is_public, uploaded_at, client_updated_at) on public.photos to authenticated;

grant select on public.reports to authenticated;
grant insert (comment_id, photo_id, reason, details) on public.reports to authenticated;

grant select on public.feedback to authenticated;
grant insert (message, app_version) on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;

-- ---------- policies: public.admins has none on purpose ----------

create policy "profiles: readable by everyone" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles: owner inserts" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: owner updates" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "user_settings: owner reads" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_settings: owner inserts" on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_settings: owner updates" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Private tables: the owner can do everything, nobody else anything, admins included.
create policy "custom_airfields: owner only" on public.custom_airfields
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "landings: owner only" on public.landings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "airfield_flags: owner only" on public.airfield_flags
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "comments: public ones readable by everyone" on public.comments
  for select to anon, authenticated using (is_public and moderation = 'visible');
create policy "comments: owner only" on public.comments
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "photos: public ones readable by everyone" on public.photos
  for select to anon, authenticated
  using (is_public and moderation = 'visible' and uploaded_at is not null);
create policy "photos: owner only" on public.photos
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A report can target only what the reporter can see, so it cannot be used to probe private ids.
create policy "reports: author inserts for visible content" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (exists (select 1 from public.comments c where c.id = comment_id)
         or exists (select 1 from public.photos p where p.id = photo_id))
  );
create policy "reports: admin reads" on public.reports
  for select to authenticated using ((select public.is_admin()));

-- Admins see other people's content only when it was reported. Storage reads follow this too.
create policy "comments: admin reads reported" on public.comments
  for select to authenticated
  using ((select public.is_admin()) and public.is_reported(comments.id, null));
create policy "photos: admin reads reported" on public.photos
  for select to authenticated
  using ((select public.is_admin()) and public.is_reported(null, photos.id));

create policy "feedback: author inserts" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "feedback: admin reads" on public.feedback
  for select to authenticated using ((select public.is_admin()));
create policy "feedback: admin updates" on public.feedback
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- admin functions ----------
-- SECURITY DEFINER, so each one checks is_admin() itself before doing anything.

create function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'profiles', (select count(*) from public.profiles),
    'landings', (select count(*) from public.landings),
    'custom_airfields', (select count(*) from public.custom_airfields),
    'comments', (select count(*) from public.comments),
    'comments_public', (select count(*) from public.comments where is_public),
    'photos', (select count(*) from public.photos),
    'photos_public', (select count(*) from public.photos where is_public),
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0)
                        from storage.objects where bucket_id = 'photos'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'feedback_new', (select count(*) from public.feedback where status = 'new')
  );
end $$;

-- Hides or restores reported content and closes its reports. Only reported content can be touched.
create function public.admin_moderate(p_comment_id uuid, p_photo_id uuid, p_moderation text, p_status text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if num_nonnulls(p_comment_id, p_photo_id) <> 1
     or p_moderation not in ('visible', 'hidden')
     or p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status, resolved_by = auth.uid(), resolved_at = now()
   where comment_id is not distinct from p_comment_id
     and photo_id is not distinct from p_photo_id
     and status = 'open';
  if not found then
    raise exception 'no open report for this content' using errcode = 'P0002';
  end if;
  update public.comments set moderation = p_moderation where id = p_comment_id;
  update public.photos set moderation = p_moderation where id = p_photo_id;
end $$;

revoke all on function public.admin_stats() from public, anon;
revoke all on function public.admin_moderate(uuid, uuid, text, text) from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_moderate(uuid, uuid, text, text) to authenticated;
