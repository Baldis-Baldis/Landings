// Runs admin.js on a small fake DOM with a fake backend. The fake has no HTML parser and any use
// of innerHTML fails the test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'admin.html'), 'utf8');

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.className = ''; this.textContent = ''; this.style = {}; }
  set innerHTML(_) { throw new Error('innerHTML is not allowed here'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  all() { return [this, ...this.children.flatMap(c => (c instanceof Node ? c.all() : []))]; }
  text() { return this.all().map(n => n.textContent).join(' '); }
}

async function load(backend) {
  const main = new Node('main');
  const calls = [];
  const spy = name => async (...args) => { calls.push([name, ...args]); };
  const ctx = {
    console, alert() {},
    document: { createElement: tag => new Node(tag), getElementById: id => (id === 'admin' ? main : null) },
    window: { open() {}, backend: {
      isAdmin: async () => true,
      adminStats: async () => ({ users: 3, users_new_7d: 1, signups_by_day: [{ day: '2026-11-01', count: 2 }], storage_bytes: 1048576 }),
      adminReports: async () => [],
      adminFeedback: async () => [],
      adminModerate: spy('moderate'), setFeedbackStatus: spy('feedback'),
      ...backend,
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'admin.js'), 'utf8'), ctx);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { main, calls };
}

const ATTACK = '<img src=x onerror=alert(1)>';

test('a non-admin gets no data calls', async () => {
  let asked = 0;
  const { main } = await load({ isAdmin: async () => false, adminStats: async () => { asked += 1; return {}; } });
  assert.equal(asked, 0);
  assert.match(main.text(), /jen pro správce/);
});

test('stats show totals and the sign-up days', async () => {
  const { main } = await load({});
  assert.match(main.text(), /3 účtů|3/);
  assert.match(main.text(), /1\.0 MB/);
  assert.equal(main.all().filter(n => n.title === '2026-11-01: 2').length, 1);
});

test('reported content stays text and both decisions reach the database function', async () => {
  const item = {
    comment_id: 'c2', photo_id: null, airfield_code: 'LKBE', author: ATTACK, body: ATTACK, url: null, thumb: 'javascript:x',
    is_public: true, moderation: 'visible',
    reports: [{ reason: 'spam', details: ATTACK, reported_body: 'before edit', reporter: 'Jan', created_at: '2026-11-02' }],
  };
  const { main, calls } = await load({ adminReports: async () => [item] });
  assert.equal(main.all().filter(n => n.tag === 'img').length, 0, 'no image from a non-https link');
  assert.ok(main.all().some(n => n.textContent === ATTACK));
  assert.ok(main.all().some(n => n.textContent === 'before edit'), 'the text at report time is shown when it changed');
  const hide = main.all().find(n => n.textContent === 'Skrýt');
  const keep = main.all().find(n => n.textContent === 'Ponechat');
  await hide.onclick();
  await keep.onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['moderate', { comment_id: 'c2', photo_id: null }, 'hidden', 'resolved'],
    ['moderate', { comment_id: 'c2', photo_id: null }, 'visible', 'dismissed'],
  ]);
});

test('feedback can be marked read and closed', async () => {
  const { main, calls } = await load({ adminFeedback: async () => [{ id: 'f1', message: ATTACK, status: 'new', author: null, created_at: '' }] });
  assert.ok(main.all().some(n => n.textContent === ATTACK));
  await main.all().find(n => n.textContent === 'Přečteno').onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['feedback', 'f1', 'read']]);
});

test('the admin page allows no inline or foreign code', () => {
  const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const rule = name => csp.split('; ').find(r => r.startsWith(`${name} `));
  assert.equal(rule('default-src'), "default-src 'none'");
  assert.equal(rule('script-src'), "script-src 'self'");
  assert.ok(!/frame-src/.test(csp), 'no frames on the admin page');
  const tags = [...page.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
  for (const tag of tags) assert.match(tag, /^<script src="[\w./-]+">$/);
  assert.ok(!/<[^>]+\son[a-z]+=/.test(page), 'inline handler');
  assert.match(page, /<meta name="robots" content="noindex">/);
});
