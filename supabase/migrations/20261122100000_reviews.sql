-- Part B: airfield reviews (one editable review per pilot and airfield), the stricter rule for sharing a photo,
-- reports of reviews and the public summary of an airfield. One transaction: either all of it or nothing.
-- Rollback: supabase/rollback/20261122100000_reviews_down.sql (it deletes the reviews).
begin;

-- ---------- reviews ----------
-- The airfield is the permanent airfield_code (data/registry.json), like landings and comments. There is no custom
-- strip column: a review is public and must never point at a private strip.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  airfield_code text not null check (airfield_code ~ '^[A-Z0-9-]{3,12}$'),
  rating smallint not null check (rating between 1 and 5),
  -- the fixed list of facilities; duplicates are refused by private.review_rules()
  facts text[] not null default '{}' check (facts <@ array['rest', 'wc', 'fuel', 'bus', 'bike', 'stay', 'night', 'fee']::text[]),
  body text check (char_length(body) <= 2000),
  visited_on date, -- the last landing there, filled in by the database
  moderation text not null default 'visible' check (moderation in ('visible', 'hidden')),
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, airfield_code)
);
create index reviews_visible_idx on public.reviews (airfield_code) where moderation = 'visible';

-- Only a pilot with a landing there, a nickname and the accepted terms reviews an airfield; the visit date comes
-- from the landings, never from the client. Runs as the user: it reads only the user's own landings.
-- Deleting the landing later keeps the review (nothing cascades).
create function private.review_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if cardinality(new.facts) <> (select count(distinct f) from unnest(new.facts) f) then
    raise exception 'a facility is listed twice' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and length(btrim(p.display_name)) > 0) then
    raise exception 'a nickname is required to review' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.user_settings s where s.user_id = new.user_id and s.terms_accepted_at is not null) then
    raise exception 'the terms must be accepted to review' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.landings l where l.user_id = new.user_id and l.airfield_code = new.airfield_code) then
    raise exception 'only a pilot who landed there can review it' using errcode = 'P0001';
  end if;
  new.visited_on := (select max(l.landed_on) from public.landings l
                     where l.user_id = new.user_id and l.airfield_code = new.airfield_code);
  return new;
end $$;

create trigger review_rules before insert or update of rating, facts, body on public.reviews
  for each row execute function private.review_rules();
create trigger keep_newest before update on public.reviews
  for each row execute function private.keep_newest();
create trigger enforce_limits before insert on public.reviews
  for each row execute function private.enforce_limits('user_id', '0', '20');

alter table public.reviews enable row level security;

-- A guest reads only what the card shows: author (user_id -> nickname, as with public photos and comments), stars,
-- facilities, text, visit date and creation date. moderation is always 'visible' for a guest (the policy) and is
-- there for the filter in airfield_summary(), which runs with the caller's rights. Never the edit times.
-- The e-mail is not in this table at all, it stays in auth.users.
grant select (id, user_id, airfield_code, rating, facts, body, visited_on, moderation, created_at) on public.reviews to anon;
grant select on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
-- never user_id, visited_on, moderation or the times; the airfield of a review does not change
grant insert (airfield_code, rating, facts, body, client_updated_at),
      update (rating, facts, body, client_updated_at) on public.reviews to authenticated;

create policy "reviews: visible ones readable by everyone" on public.reviews
  for select to anon, authenticated using (moderation = 'visible');
create policy "reviews: owner only" on public.reviews
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- the admin reads other people's reviews only when they were reported: below, after reports.review_id exists

-- ---------- sharing a photo ----------
-- Sharing shows the photo to everyone with the nickname: only with a nickname and a landing at that airfield.
-- Custom strips are already refused by a check on the table. Runs as the user (own landings, public nicknames).
create function private.photo_share_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.is_public then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and length(btrim(p.display_name)) > 0) then
    raise exception 'a nickname is required to share a photo' using errcode = 'P0001';
  end if;
  if new.airfield_code is null or not exists (
    select 1 from public.landings l where l.user_id = new.user_id and l.airfield_code = new.airfield_code
  ) then
    raise exception 'only a photo of an airfield you landed at can be shared' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger photo_share_rules before insert or update of is_public on public.photos
  for each row execute function private.photo_share_rules();

-- ---------- reports: reviews too ----------
alter table public.reports add column review_id uuid references public.reviews (id) on delete cascade;
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.reports'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%num_nonnulls%';
  execute format('alter table public.reports drop constraint %I', c);
  select conname into c from pg_constraint where conrelid = 'public.reports'::regclass and contype = 'u';
  execute format('alter table public.reports drop constraint %I', c);
end $$;
alter table public.reports add constraint reports_one_target check (num_nonnulls(comment_id, photo_id, review_id) = 1);
alter table public.reports add constraint reports_once unique nulls not distinct (reporter_id, comment_id, photo_id, review_id);
create index reports_review_id_idx on public.reports (review_id);
grant insert (review_id) on public.reports to authenticated;

-- SECURITY DEFINER for the same reason as is_reported(): the review policy cannot read public.reports directly,
-- because the report policy reads reviews, and Postgres refuses that as recursion. It answers only true or false
-- and true only to an admin: nothing of the content, nothing for anyone else.
create function public.is_reported_review(p_review_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and exists (select 1 from public.reports r where r.review_id = p_review_id)
$$;
revoke all on function public.is_reported_review(uuid) from public, anon;
grant execute on function public.is_reported_review(uuid) to authenticated;

create policy "reviews: admin reads reported" on public.reviews
  for select to authenticated using ((select public.is_admin()) and public.is_reported_review(reviews.id));

-- Only what everyone sees can be reported, and never one's own: a shared photo or a visible review.
drop policy "reports: author inserts for visible content" on public.reports;
create policy "reports: author inserts for visible content" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (exists (select 1 from public.comments c where c.id = comment_id)
         or exists (select 1 from public.photos p where p.id = photo_id
                    and p.is_public and p.moderation = 'visible' and p.user_id <> (select auth.uid()))
         or exists (select 1 from public.reviews r where r.id = review_id
                    and r.moderation = 'visible' and r.user_id <> (select auth.uid())))
  );

-- The author can edit a review after it was reported, so the report keeps its text as it was.
create or replace function private.snapshot_reported() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.comment_body := coalesce((select c.body from public.comments c where c.id = new.comment_id),
                               (select r.body from public.reviews r where r.id = new.review_id));
  return new;
end $$;

-- Hides or restores reported content and closes its reports. Only reported content can be touched.
-- p_review_id comes last with a default, so the admin page of the previous version keeps working.
drop function public.admin_moderate(uuid, uuid, text, text);
create function public.admin_moderate(p_comment_id uuid, p_photo_id uuid, p_moderation text, p_status text,
                                      p_review_id uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if num_nonnulls(p_comment_id, p_photo_id, p_review_id) <> 1
     or p_moderation not in ('visible', 'hidden')
     or p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status, resolved_by = auth.uid(), resolved_at = now()
   where comment_id is not distinct from p_comment_id
     and photo_id is not distinct from p_photo_id
     and review_id is not distinct from p_review_id
     and status = 'open';
  if not found then
    raise exception 'no open report for this content' using errcode = 'P0002';
  end if;
  update public.comments set moderation = p_moderation where id = p_comment_id;
  update public.photos set moderation = p_moderation where id = p_photo_id;
  update public.reviews set moderation = p_moderation where id = p_review_id;
end $$;
revoke all on function public.admin_moderate(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.admin_moderate(uuid, uuid, text, text, uuid) to authenticated;

-- Still only totals: sign-ups and activity, never a single user.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_new_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'users_active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'users_active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day), '[]'::jsonb)
      from (
        select (created_at at time zone 'UTC')::date as day, count(*) as n
        from auth.users where created_at > now() - interval '30 days' group by 1
      ) d
    ),
    'profiles', (select count(*) from public.profiles),
    'landings', (select count(*) from public.landings),
    'custom_airfields', (select count(*) from public.custom_airfields),
    'comments', (select count(*) from public.comments where not is_note),
    'comments_public', (select count(*) from public.comments where is_public),
    'photos', (select count(*) from public.photos),
    'photos_public', (select count(*) from public.photos where is_public),
    'reviews', (select count(*) from public.reviews),
    'reviews_hidden', (select count(*) from public.reviews where moderation = 'hidden'),
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0)
                        from storage.objects where bucket_id = 'photos'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'feedback_new', (select count(*) from public.feedback where status = 'new')
  );
end $$;

-- ---------- the public summary of an airfield ----------
-- One small call when a card opens. SECURITY INVOKER: it reads what the caller may read, and counts only visible
-- reviews and shared photos, the caller's own included, so everyone gets the same numbers.
-- Facilities count only visits of the last 24 months; a review without a landing date counts from its creation.
create function public.airfield_summary(p_code text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'n', (select count(*) from public.reviews r where r.airfield_code = p_code and r.moderation = 'visible'),
    'avg', (select round(avg(r.rating), 2) from public.reviews r where r.airfield_code = p_code and r.moderation = 'visible'),
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object('key', f.k, 'n', f.n) order by f.n desc, f.k)
      from (
        select x as k, count(*) as n
        from public.reviews r, unnest(r.facts) as x
        where r.airfield_code = p_code and r.moderation = 'visible'
          and coalesce(r.visited_on, r.created_at::date) >= (current_date - interval '24 months')::date
        group by x
      ) f), '[]'::jsonb),
    'photos_n', (select count(*) from public.photos p
                 where p.airfield_code = p_code and p.is_public and p.moderation = 'visible' and p.uploaded_at is not null),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'user_id', q.user_id, 'storage_path', q.storage_path,
                                          'thumb_path', q.thumb_path) order by q.uploaded_at desc)
      from (
        select p.id, p.user_id, p.storage_path, p.thumb_path, p.uploaded_at from public.photos p
        where p.airfield_code = p_code and p.is_public and p.moderation = 'visible' and p.uploaded_at is not null
        order by p.uploaded_at desc limit 4
      ) q), '[]'::jsonb)
  )
$$;
revoke all on function public.airfield_summary(text) from public;
grant execute on function public.airfield_summary(text) to anon, authenticated;

revoke all on function private.review_rules() from public, anon, authenticated;
revoke all on function private.photo_share_rules() from public, anon, authenticated;

commit;
