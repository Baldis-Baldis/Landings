// Proves every rollback script in supabase/rollback/ brings the schema back to the state before its migration:
// tables, columns, constraints, indexes, policies, functions, triggers and grants must match exactly.
// In-memory Postgres only, nothing connects to Supabase. Part of npm run test:db.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
// Git on Windows may check files out with CRLF; function bodies are compared with LF.
const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const migDir = join(here, '..', 'migrations'), rbDir = join(here, '..', 'rollback');
const migrations = readdirSync(migDir).sort();

const SNAPSHOT = [
  `select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
     where table_schema in ('public', 'private') order by 1, 2`,
  `select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint
     where connamespace in ('public'::regnamespace, 'private'::regnamespace) order by 1, 2`,
  `select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by 1, 2`,
  `select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies
     where schemaname in ('public', 'storage') order by 1, 2`,
  `select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef, p.proconfig::text, p.prosrc,
          array(select a::text from unnest(coalesce(p.proacl, '{}')) a order by 1)::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') order by 1, 2, 3`,
  `select tgrelid::regclass::text, tgname, pg_get_triggerdef(oid) from pg_trigger where not tgisinternal order by 1, 2`,
  `select grantee, table_name, privilege_type from information_schema.table_privileges
     where table_schema = 'public' order by 1, 2, 3`,
  `select grantee, table_name, column_name, privilege_type from information_schema.column_privileges
     where table_schema = 'public' order by 1, 2, 3, 4`,
];

async function snapshot(files, rollback) {
  const db = new PGlite();
  try {
    await db.exec(read(join(here, 'stubs.sql')));
    for (const f of files) await db.exec(read(join(migDir, f)));
    if (rollback) await db.exec(read(join(rbDir, rollback)));
    const out = [];
    for (const q of SNAPSHOT) out.push(JSON.stringify((await db.query(q)).rows));
    return out;
  } finally {
    await db.close();
  }
}

let failed = 0;
const rollbacks = existsSync(rbDir) ? readdirSync(rbDir).filter(f => f.endsWith('_down.sql')).sort() : [];
for (const rb of rollbacks) {
  const target = rb.replace('_down.sql', '.sql');
  const i = migrations.indexOf(target);
  if (i < 0) { console.log(`ROLLBACK ${rb}: no migration ${target}`); failed++; continue; }
  const before = await snapshot(migrations.slice(0, i));
  // Later fix-up migrations without a rollback of their own (e.g. grants) must be undone by this one too.
  let j = i + 1;
  while (j < migrations.length && !rollbacks.includes(migrations[j].replace('.sql', '_down.sql'))) j++;
  for (const end of j > i + 1 ? [i + 1, j] : [i + 1]) {
    const after = await snapshot(migrations.slice(0, end), rb);
    const what = end === i + 1 ? target : `${target} … ${migrations[end - 1]}`;
    const diff = before.map((b, k) => (b === after[k] ? null : k)).filter(k => k !== null);
    if (diff.length) {
      failed++;
      console.log(`ROLLBACK ${rb} after ${what}: schema differs in part(s) ${diff.join(', ')}`);
      for (const k of diff) {
        const b = new Set(JSON.parse(before[k]).map(r => JSON.stringify(r))), a = new Set(JSON.parse(after[k]).map(r => JSON.stringify(r)));
        for (const r of b) if (!a.has(r)) console.log('  missing after rollback:', r.slice(0, 300));
        for (const r of a) if (!b.has(r)) console.log('  extra after rollback:  ', r.slice(0, 300));
      }
    } else console.log(`ROLLBACK ${rb} after ${what}: schema back to the state before ${target}`);
  }
}
console.log(failed ? 'ROLLBACK CHECK FAILED' : `ALL ROLLBACKS CHECKED (${rollbacks.length})`);
process.exitCode = failed ? 1 : 0;
