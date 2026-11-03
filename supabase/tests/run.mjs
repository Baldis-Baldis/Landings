// Runs the migrations and access-rule tests on a throwaway in-memory Postgres.
// Nothing here connects to Supabase. Usage: npm run test:db
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(path, 'utf8');
const migrations = join(here, '..', 'migrations');

const db = new PGlite();
const notices = [];
await db.exec(read(join(here, 'stubs.sql')));
for (const file of readdirSync(migrations).sort()) {
  await db.exec(read(join(migrations, file)));
  console.log('applied', file);
}
const result = await db.query('select version()');
console.log(result.rows[0].version.split(' ').slice(0, 2).join(' '));

try {
  await db.exec(read(join(here, 'rls_test.sql')));
  notices.push('tests finished');
  // rls_test.sql rolls back, so the second run sees only the other user's data
  await db.exec(read(join(here, 'existing_data.sql')));
  await db.exec(read(join(here, 'rls_test.sql')));
  console.log('passed on an empty database and next to another user');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
await db.close();
console.log(process.exitCode ? 'TESTS FAILED' : 'ALL RLS TESTS PASSED');
