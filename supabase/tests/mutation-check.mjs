// Proves the tests catch mistakes: each mutation weakens one rule in memory and must make them fail.
// Files on disk are not changed. Usage: npm run test:db:mutations
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
// Git on Windows may check files out with CRLF; the mutations are written with LF.
const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const dir = join(here, '..', 'migrations');
const files = readdirSync(dir).sort().map(f => read(join(dir, f)));

const MUTATIONS = [
  ['landings readable by all users', `"landings: owner only" on public.landings\n  for all to authenticated\n  using (user_id = (select auth.uid()))`, `"landings: owner only" on public.landings\n  for all to authenticated\n  using (true)`],
  ['RLS off on flags', 'alter table public.airfield_flags enable row level security;', 'alter table public.airfield_flags disable row level security;'],
  ['rls_auto_enable left open', 'revoke all on function public.rls_auto_enable() from public, anon, authenticated;', 'null;'],
  ['automatic RLS switched off', 'revoke all on function public.rls_auto_enable() from public, anon, authenticated;', 'revoke all on function public.rls_auto_enable() from public, anon, authenticated; alter event trigger ensure_rls disable;'],
  ['moderation writable', 'update (body, is_public, client_updated_at) on public.comments', 'update (body, is_public, moderation, client_updated_at) on public.comments'],
  // A forged user_id is stopped by the column grant and by RLS; only losing both may let it through.
  ['user_id forgeable', 'grant insert (airfield_code, custom_airfield_id, landed_on, client_updated_at)', `grant insert (user_id, airfield_code, custom_airfield_id, landed_on, client_updated_at)`, `"landings: owner only" on public.landings\n  for all to authenticated\n  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`, `"landings: owner only" on public.landings\n  for all to authenticated\n  using (user_id = (select auth.uid())) with check (true)`],
  ['hidden comments stay public', `using (is_public and moderation = 'visible');`, 'using (is_public);'],
  ['private photos public', `using (is_public and moderation = 'visible' and uploaded_at is not null)`, 'using (true)'],
  ['anon reads landings', 'grant select, delete on public.landings to authenticated;', 'grant select, delete on public.landings to authenticated; grant select on public.landings to anon;'],
  // The latest definition counts: a later migration replaces the function.
  ['stats open to everyone', `create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then`, `create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if false then`],
  ['files readable without a row rule', `bucket_id = 'photos'\n    and exists (select 1 from public.photos p where name in (p.storage_path, p.thumb_path))`, `bucket_id = 'photos'`],
  ['upload into any path', `where p.user_id = (select auth.uid())\n        and name in (p.storage_path, p.thumb_path)`, 'where true'],
  ['report probes private ids', `reporter_id = (select auth.uid())\n    and (exists (select 1 from public.comments c where c.id = comment_id)\n         or exists (select 1 from public.photos p where p.id = photo_id))`, 'reporter_id = (select auth.uid())'],
  ['photo row leaves its files behind', `if auth.uid() is not null and exists (`, 'if false and exists ('],
  ['account deletion blocked by files', `if auth.uid() is not null and exists (`, 'if exists ('],
  ['public item on private strip', `check (custom_airfield_id is null or not is_public), -- a public item would reveal a private strip`, ''],
  ['landing note can go public', 'alter table public.comments add constraint comments_note_stays_private check (not (is_note and is_public));', ''],
  ['no limit on public comments per airfield', 'if total >= 300 or here >= 5 then', 'if total >= 300 then'],
  ['report loses the reported text', 'new.comment_body := (select c.body from public.comments c where c.id = new.comment_id);', 'null;'],
  ['publishing without terms', 'create trigger require_terms before insert or update of is_public on public.comments', 'create trigger require_terms before insert on public.photos'],
  ['account deletion leaves files behind', `if exists (select 1 from storage.objects o
             where o.bucket_id = 'photos' and (storage.foldername(o.name))[1] = me::text) then`, 'if false then'],
  ['account deletion open to guests', 'revoke all on function public.delete_my_account() from public, anon;', 'grant execute on function public.delete_my_account() to anon;'],
  ['closed feedback kept forever', "where status = 'closed' and created_at < now() - interval '12 months'", 'where false'],
  ['reports kept forever', "where status <> 'open' and resolved_at < now() - interval '12 months'", 'where false'],
  ['going public skips the limit', 'before insert or update of is_public on public.comments\n  for each row execute function private.limit_public_comments()', 'before insert on public.comments\n  for each row execute function private.limit_public_comments()'],
];

async function run(sql) {
  const db = new PGlite();
  try {
    await db.exec(read(join(here, 'stubs.sql')));
    for (const m of sql) await db.exec(m);
    await db.exec(read(join(here, 'rls_test.sql')));
    return null;
  } catch (e) {
    return e.message;
  } finally {
    await db.close();
  }
}

let missed = 0;
for (const [name, ...swaps] of MUTATIONS) {
  let sql = files, stale = false;
  for (let i = 0; i < swaps.length; i += 2) {
    const [from, to] = [swaps[i], swaps[i + 1]];
    if (!sql.some(f => f.includes(from))) stale = true;
    sql = sql.map(f => f.replace(from, () => to)); // a function, because "to" contains $$
  }
  if (stale) { console.log('STALE  ', name); missed++; continue; }
  const failure = await run(sql);
  console.log(failure ? 'CAUGHT ' : 'MISSED ', name, failure ? `(${failure.slice(0, 60)})` : '');
  if (!failure) missed++;
}
console.log(missed ? `${missed} NOT CAUGHT` : 'ALL MUTATIONS CAUGHT');
process.exitCode = missed ? 1 : 0;
