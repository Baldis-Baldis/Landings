-- One private bucket: if a rule is ever wrong, the failure is "nothing shows", not "everything is public".
-- Size and type limits live on the bucket because the client's resizing can be bypassed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload only into a path of the user's own row in public.photos. No UPDATE policy: files are never replaced.
create policy "photos bucket: owner uploads for own row" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.photos p
      where p.user_id = (select auth.uid())
        and name in (p.storage_path, p.thumb_path)
    )
  );

-- Runs under RLS of public.photos, so file access always follows the rules of the row.
create policy "photos bucket: read follows the photos table" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and exists (select 1 from public.photos p where name in (p.storage_path, p.thumb_path))
  );

-- Removing a file needs SELECT too, so delete the files first and the row after them.
create policy "photos bucket: owner deletes own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
