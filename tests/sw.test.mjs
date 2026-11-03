// Runs sw.js with a fake cache and fetch: checks what may and may not be stored.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'sw.js'), 'utf8');

function load() {
  const handlers = {}, stored = [], precached = [], fetched = [];
  const cache = { put: async req => stored.push(req.url), addAll: async list => precached.push(...list) };
  const ctx = {
    URL, Promise, setTimeout, Request,
    self: { addEventListener: (type, f) => { handlers[type] = f; }, skipWaiting() {}, location: new URL('https://mylandings.net/sw.js') },
    caches: { open: async () => cache, match: async () => undefined },
    fetch: async req => { fetched.push(req); return new Response('x'); },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { handlers, stored, precached, fetched };
}

async function get(url) {
  const { handlers, stored } = load();
  let handled = false;
  const pending = [];
  handlers.fetch({ request: { url, method: 'GET' }, respondWith(p) { handled = true; pending.push(p); } });
  await Promise.all(pending);
  await new Promise(r => setTimeout(r, 5));
  return { handled, stored };
}

test('app files are stored for offline use', async () => {
  const { stored } = await get('https://mylandings.net/backend.js');
  assert.deepEqual(stored, ['https://mylandings.net/backend.js']);
});

for (const url of [
  'https://bgxzlirvbuxjjawqkkyw.supabase.co/rest/v1/landings?select=*',
  'https://bgxzlirvbuxjjawqkkyw.supabase.co/storage/v1/object/sign/photos/a.jpg?token=x',
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  'https://mylandings.net/admin.html',
  'https://mylandings.net/admin.js',
]) {
  test(`stays out of the worker: ${new URL(url).hostname}${new URL(url).pathname}`, async () => {
    const { handled, stored } = await get(url);
    assert.equal(handled, false);
    assert.deepEqual(stored, []);
  });
}

test('own files are asked from the server even when the browser has a copy', async () => {
  const { handlers, fetched } = load();
  const pending = [];
  handlers.fetch({ request: { url: 'https://mylandings.net/app.js', method: 'GET', mode: 'no-cors' }, respondWith(p) { pending.push(p); } });
  handlers.fetch({ request: { url: 'https://mylandings.net/', method: 'GET', mode: 'navigate' }, respondWith(p) { pending.push(p); } });
  await Promise.all(pending);
  assert.deepEqual(fetched.map(r => [r.cache, r.redirect]), [['no-cache', 'follow'], ['no-cache', 'manual']]);
});

test('the page checks the worker itself on every load and shows its version', () => {
  const app = readFileSync(join(root, 'app.js'), 'utf8');
  assert.match(app, /register\('sw\.js',\{updateViaCache:'none'\}\)/);
  assert.match(app, /getElementById\('appver'\)\.textContent=APP_VERSION/);
});

test('the one-time sign-in code in a return URL is not stored', async () => {
  const { handled, stored } = await get('https://mylandings.net/?code=one-time');
  assert.equal(handled, true);
  assert.deepEqual(stored, []);
});

test('every precached file exists', async () => {
  const { handlers, precached } = load();
  const pending = [];
  handlers.install({ waitUntil(p) { pending.push(p); } });
  await Promise.all(pending);
  assert.ok(precached.includes('./auth.js'));
  assert.ok(!precached.some(f => f.includes('admin')), 'the admin page is not precached');
  assert.match(readFileSync(join(root, 'app.js'), 'utf8'), new RegExp(`APP_VERSION='${source.match(/const C='([^']+)'/)[1]}'`));
  for (const file of precached) if (file !== './') assert.ok(existsSync(join(root, file)), file);
});
