-- rls_auto_enable() is created by Supabase for "Enable automatic RLS" and runs from an event trigger.
-- Clients have no reason to call it. Postgres does not check EXECUTE when an event trigger fires,
-- so this does not switch automatic RLS off; rls_test.sql proves that on every run.
-- The function exists only where the option was enabled when the project was created.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
