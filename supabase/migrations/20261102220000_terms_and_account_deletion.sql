-- Public content shows the author to everyone, so it needs the accepted terms (they include the age of 16).
create function private.require_terms() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_public and not exists (
    select 1 from public.user_settings s where s.user_id = new.user_id and s.terms_accepted_at is not null
  ) then
    raise exception 'the terms must be accepted to publish' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger require_terms before insert or update of is_public on public.comments
  for each row execute function private.require_terms();
create trigger require_terms before insert or update of is_public on public.photos
  for each row execute function private.require_terms();

-- Deletes the signed-in account and, through the cascades, all its rows. No secret key involved:
-- the client removes its own files first (the storage rules allow that), and a file left behind stops this,
-- because a row-less file could never be found and removed again.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from storage.objects o
             where o.bucket_id = 'photos' and (storage.foldername(o.name))[1] = me::text) then
    raise exception 'delete the files first' using errcode = 'P0001';
  end if;
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Resolved reports keep a copy of the reported text: they go 12 months after the decision.
-- Closed feedback goes 12 months after it was written (the table has no closing time).
-- Scheduled daily with pg_cron on the project, the extension is not part of the migrations:
-- select cron.schedule('purge-old-reports', '30 3 * * *', $$select private.purge_resolved_reports()$$);
create function private.purge_resolved_reports() returns integer
language sql security definer set search_path = '' as $$
  with reports as (
    delete from public.reports
    where status <> 'open' and resolved_at < now() - interval '12 months'
    returning 1
  ), feedback as (
    delete from public.feedback
    where status = 'closed' and created_at < now() - interval '12 months'
    returning 1
  )
  select ((select count(*) from reports) + (select count(*) from feedback))::integer
$$;

revoke all on function private.require_terms() from public, anon, authenticated;
revoke all on function private.purge_resolved_reports() from public, anon, authenticated;
