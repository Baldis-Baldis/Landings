-- The author can edit a comment after it was reported, so the report keeps the text as it was.
-- Photos need no copy: files are never replaced, a changed photo is a new row.
alter table public.reports add column comment_body text;

create function private.snapshot_reported() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.comment_body := (select c.body from public.comments c where c.id = new.comment_id);
  return new;
end $$;

create trigger snapshot_reported before insert on public.reports
  for each row execute function private.snapshot_reported();

revoke all on function private.snapshot_reported() from public, anon, authenticated;

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
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0)
                        from storage.objects where bucket_id = 'photos'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'feedback_new', (select count(*) from public.feedback where status = 'new')
  );
end $$;
