-- Fix for 20261122100000_reviews.sql: Supabase's default privileges in public gave anon and authenticated more on
-- public.reviews (TRUNCATE, TRIGGER, REFERENCES) than the migration granted. Start from nothing, then grant only
-- what the app needs. The B2 functions get the same treatment, so no default privilege is left on them either.
-- One transaction. Rollback: none of its own; 20261122100000_reviews_down.sql drops all of it.
begin;

revoke all on public.reviews from public, anon, authenticated;
-- Both client roles read only what the card shows (author, stars, facilities, text, visit date, creation date,
-- moderation for the filter and for the author's "hidden by admin"). A guest never gets an edit time; a signed-in
-- pilot gets client_updated_at only because an upsert (on conflict ... excluded.client_updated_at) must read it.
grant select (id, user_id, airfield_code, rating, facts, body, visited_on, moderation, created_at)
  on public.reviews to anon, authenticated;
grant select (client_updated_at) on public.reviews to authenticated;
-- The author deletes the own review (RLS: owner only). Never user_id, visited_on, moderation or the times;
-- the airfield of a review does not change.
grant delete on public.reviews to authenticated;
grant insert (airfield_code, rating, facts, body, client_updated_at),
      update (rating, facts, body, client_updated_at) on public.reviews to authenticated;

revoke all on function public.airfield_summary(text) from public, anon, authenticated;
grant execute on function public.airfield_summary(text) to anon, authenticated;
revoke all on function public.is_reported_review(uuid) from public, anon, authenticated;
grant execute on function public.is_reported_review(uuid) to authenticated;
revoke all on function public.admin_moderate(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_moderate(uuid, uuid, text, text, uuid) to authenticated;

commit;
