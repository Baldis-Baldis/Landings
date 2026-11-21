-- Undoes supabase/migrations/20261122100000_reviews.sql and brings the schema back to the state before it.
-- DELETES ALL REVIEWS and the reports of reviews. Photos stay as they are (shared photos stay shared).
-- Only for a failed migration or test; run it in the SQL editor in one go. One transaction: all or nothing.
begin;

drop function public.airfield_summary(text);

-- admin functions as they were
drop function public.admin_moderate(uuid, uuid, text, text, uuid);
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
revoke all on function public.admin_moderate(uuid, uuid, text, text) from public, anon;
grant execute on function public.admin_moderate(uuid, uuid, text, text) to authenticated;

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
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0)
                        from storage.objects where bucket_id = 'photos'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'feedback_new', (select count(*) from public.feedback where status = 'new')
  );
end $$;

create or replace function private.snapshot_reported() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.comment_body := (select c.body from public.comments c where c.id = new.comment_id);
  return new;
end $$;

-- reports as they were
drop policy "reports: author inserts for visible content" on public.reports;
create policy "reports: author inserts for visible content" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (exists (select 1 from public.comments c where c.id = comment_id)
         or exists (select 1 from public.photos p where p.id = photo_id))
  );
delete from public.reports where review_id is not null;
alter table public.reports drop constraint reports_once;
alter table public.reports drop constraint reports_one_target;
drop index public.reports_review_id_idx;
alter table public.reports drop column review_id;
alter table public.reports add check (num_nonnulls(comment_id, photo_id) = 1);
alter table public.reports add unique nulls not distinct (reporter_id, comment_id, photo_id);

-- photos: the sharing rule goes, the rules from before (nickname, terms) stay
drop trigger photo_share_rules on public.photos;
drop function private.photo_share_rules();

-- reviews with their policies, grants and triggers
drop table public.reviews;
drop function public.is_reported_review(uuid);
drop function private.review_rules();

commit;
