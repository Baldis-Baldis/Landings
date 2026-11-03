// Runs auth.js on a small fake DOM with a fake backend and Turnstile: nothing reaches the network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'auth.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const tick = () => new Promise(r => setTimeout(r, 5));
const USER = { id: 'u1', email: 'pilot@example.test' };

class El {
  constructor(id) {
    Object.assign(this, { id, textContent: '', hidden: false, value: '', dataset: {}, disabled: false, open: false, listeners: {} });
    this.classList = { toggle() {} };
  }
  addEventListener(type, f) { this.listeners[type] = f; }
  querySelectorAll() { return []; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  submit() { this.listeners.submit({ preventDefault() {}, target: this }); return tick(); }
}

function load(overrides = {}) {
  const els = new Map();
  const $ = id => { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); };
  const calls = [];
  let emit;
  const backend = {
    onAuthChange(f) { emit = f; },
    getNickname: async () => null,
    sendEmailCode: async (email, token) => { calls.push(['send', email, token]); },
    verifyEmailCode: async (email, code) => { calls.push(['verify', email, code]); return USER; },
    setNickname: async n => { calls.push(['nick', n]); return 'ok'; },
    signOut: async () => { calls.push(['out']); },
    signInWithGoogle: async () => { calls.push(['google']); },
    ...overrides,
  };
  const ctx = {
    setTimeout, status() {}, lang: 'cs', backend,
    MYLANDINGS_CONFIG: { turnstileSiteKey: 'site-key' },
    turnstile: { render: (_el, o) => { setTimeout(() => o.callback('token-1')); return 1; }, reset() { calls.push(['reset']); } },
    document: {
      getElementById: $,
      createElement: () => ({}),
      head: { append(tag) { calls.push(['script', tag.src]); setTimeout(() => tag.onload()); } },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: 'auth.js' });
  return { $, calls, emit: user => { emit(user); return tick(); } };
}

test('every id used by auth.js exists in index.html', () => {
  const ids = [...source.matchAll(/\$\('([a-z]+)'\)/g)].map(m => m[1]);
  ids.push(...[...source.matchAll(/: '(auth[a-z]+)'/g)].map(m => m[1]));
  assert.ok(ids.length > 10);
  for (const id of new Set(ids)) assert.ok(html.includes(`id="${id}"`), id);
});

test('without the backend the app stays usable', () => {
  const ctx = { document: { getElementById() { throw new Error('touched the page'); } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
});

test('Turnstile loads only when the dialog opens', async () => {
  const { $, calls } = load();
  await tick();
  assert.equal(calls.length, 0);
  $('auth').onclick();
  await tick();
  assert.ok(calls.some(c => c[0] === 'script' && c[1].startsWith('https://challenges.cloudflare.com/')));
});

test('the code cannot be requested before Turnstile finishes', async () => {
  const { $, calls } = load();
  $('auth').onclick();
  $('authemail').value = USER.email;
  await $('authstart').submit();
  assert.ok(!calls.some(c => c[0] === 'send'));
  assert.ok($('authmsg').textContent);
});

test('the send button waits for Turnstile', async () => {
  const { $ } = load();
  $('auth').onclick();
  assert.equal($('authsend').disabled, true);
  await tick(); await tick();
  assert.equal($('authsend').disabled, false);
  $('authemail').value = USER.email;
  await $('authstart').submit();
  $('authback').onclick();
  assert.equal($('authsend').disabled, true);
});

test('going back does not reuse a spent Turnstile token', async () => {
  const { $, calls } = load();
  $('auth').onclick();
  await tick(); await tick();
  $('authemail').value = USER.email;
  await $('authstart').submit();
  $('authback').onclick();
  await tick();
  await $('authstart').submit();
  assert.equal(calls.filter(c => c[0] === 'send').length, 1);
});

test('email sign-in with a wrong and a right code, then the nickname', async () => {
  const backend = {
    verifyEmailCode: async (_e, code) => {
      if (code === '000000') throw Object.assign(new Error('bad'), { status: 403 });
      return USER;
    },
  };
  const { $, calls, emit } = load(backend);
  $('auth').onclick();
  await tick(); await tick();
  $('authemail').value = ` ${USER.email} `;
  await $('authstart').submit();
  assert.deepEqual([...calls.find(c => c[0] === 'send')], ['send', USER.email, 'token-1']);
  assert.equal($('authcodeform').hidden, false);
  assert.match($('authmsg').textContent, /pilot@example\.test/);

  $('authcode').value = '000000';
  await $('authcodeform').submit();
  assert.equal($('authmsg').textContent, 'Kód je neplatný nebo vypršel.');
  assert.equal($('authdlg').open, true);

  $('authcode').value = '123456';
  await $('authcodeform').submit();
  assert.equal($('authdlg').open, false);

  await emit(USER);
  assert.equal($('authnickform').hidden, false);
  assert.equal($('authdlg').open, true);
  assert.equal($('auth').textContent, `Účet: ${USER.email}`);

  $('authnick').value = ' Pilot ';
  await $('authnickform').submit();
  assert.equal($('authdlg').open, false);
  assert.equal($('auth').textContent, 'Účet: Pilot');
});

test('a taken nickname keeps the dialog open', async () => {
  const { $, emit } = load({ setNickname: async () => 'taken' });
  await emit(USER);
  $('authnick').value = 'Pilot';
  await $('authnickform').submit();
  assert.equal($('authdlg').open, true);
  assert.equal($('authmsg').textContent, 'Tuto přezdívku už někdo má.');
});

test('an existing nickname does not open the dialog', async () => {
  const { $, emit } = load({ getNickname: async () => 'Pilot' });
  await emit(USER);
  assert.equal($('authdlg').open, false);
  assert.equal($('auth').textContent, 'Účet: Pilot');
});

test('a failed nickname read does not nag and a token refresh does not repeat the question', async () => {
  let reads = 0;
  const { $, emit } = load({ getNickname: async () => { reads++; throw new Error('offline'); } });
  await emit(USER);
  await emit(USER);
  assert.equal(reads, 1);
  assert.equal($('authdlg').open, false);
});

test('a failed sign-out stays signed in and says so', async () => {
  const { $, emit } = load({ getNickname: async () => 'Pilot', signOut: async () => { throw new Error('offline'); } });
  await emit(USER);
  $('auth').onclick();
  await $('authout').onclick();
  assert.equal($('authdlg').open, true);
  assert.equal($('auth').textContent, 'Účet: Pilot');
  assert.ok($('authmsg').textContent);
});
