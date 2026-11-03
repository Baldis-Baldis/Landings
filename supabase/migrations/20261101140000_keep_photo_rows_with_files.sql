-- Quotas count rows in public.photos, so a row must not disappear while its files stay in Storage.
-- Covers cascades from a deleted custom strip too. Applies to client requests only: account deletion
-- runs without a JWT and removes the files separately.
create function private.keep_row_with_files() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'photos' and o.name in (old.storage_path, old.thumb_path)
  ) then
    raise exception 'delete the files first' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger keep_row_with_files before delete on public.photos
  for each row execute function private.keep_row_with_files();

revoke all on function private.keep_row_with_files() from public, anon, authenticated;
