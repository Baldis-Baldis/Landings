-- A landing note is a private comment owned by the sync. Comments written for sharing must not replace it.
alter table public.comments add column is_note boolean not null default false;
alter table public.comments add constraint comments_note_stays_private check (not (is_note and is_public));
update public.comments set is_note = true where not is_public;

grant insert (is_note) on public.comments to authenticated;

-- The daily limit counts inserts only, so making old comments public has to pass here too.
-- Hidden comments still count: moderation must not free up room for more.
create function private.limit_public_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total int;
  here int;
begin
  if not new.is_public then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('public comments' || new.user_id::text, 0));
  select count(*), count(*) filter (where c.airfield_code = new.airfield_code)
    into total, here
    from public.comments c
   where c.user_id = new.user_id and c.is_public and c.id <> new.id;
  if total >= 300 or here >= 5 then
    raise exception 'limit reached: public comments' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger limit_public_comments before insert or update of is_public on public.comments
  for each row execute function private.limit_public_comments();

revoke all on function private.limit_public_comments() from public, anon, authenticated;
