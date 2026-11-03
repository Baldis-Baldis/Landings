-- The parts of Supabase the migrations rely on, for local tests only. Never run this on a real project.
create role anon nologin;
create role authenticated nologin;

-- Same shape as the function behind Supabase's "Enable automatic RLS" option.
create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path = 'pg_catalog' as $$
declare c record;
begin
  for c in select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') and object_type = 'table'
  loop
    execute format('alter table if exists %s enable row level security', c.object_identity);
  end loop;
end $$;
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  last_sign_in_at timestamptz,
  created_at timestamptz -- no default, as a plain insert on the project behaves
);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
$$;
grant usage on schema auth to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  metadata jsonb,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
