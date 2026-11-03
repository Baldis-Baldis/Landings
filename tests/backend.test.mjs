// Runs backend.js on the real supabase-js build with a fake fetch: nothing reaches the network.
// Usage: npm run test:backend
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORAGE_KEY = 'sb-bgxzlirvbuxjjawqkkyw-auth-token';
const jwtPart = o => Buffer.from(JSON.stringify(o)).toString('base64url');

const session = () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${jwtPart({ alg: 'none' })}.${jwtPart({ sub: USER_ID, exp })}.x`,
    refresh_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: exp,
    user: { id: USER_ID, email: 'pilot@example.test', aud: 'authenticated' },
  };
};

function load({ signedIn = false, respond = () => [200, {}] } = {}) {
  const store = new Map(signedIn ? [[STORAGE_KEY, JSON.stringify(session())]] : []);
  const calls = [];
  const ctx = {
    console, URL, URLSearchParams, Headers, Request, Response, TextEncoder, TextDecoder, AbortController,
    crypto: globalThis.crypto, atob, btoa, setTimeout, clearTimeout, setInterval, clearInterval,
    WebSocket: class {}, // realtime needs the class to exist, the app never connects
    location: new URL('https://mylandings.net/'),
    // Without document the library decides it is not in a browser and ignores localStorage.
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: k => store.delete(k),
    },
    fetch: async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      assert.equal(url.origin, 'https://bgxzlirvbuxjjawqkkyw.supabase.co');
      const isFile = init.body && typeof init.body !== 'string';
      calls.push({ url, method: init.method || 'GET', body: init.body && !isFile ? JSON.parse(init.body) : null });
      const [status, body] = respond(url, init);
      return new Response(status === 204 ? null : JSON.stringify(body), {
        status, headers: { 'Content-Type': 'application/json' },
      });
    },
  };
  ctx.window = ctx.self = ctx;
  vm.createContext(ctx);
  for (const file of ['vendor/supabase.js', 'config.js', 'backend.js']) {
    vm.runInContext(readFileSync(join(root, file), 'utf8'), ctx, { filename: file });
  }
  return { backend: ctx.window.backend, calls, store };
}

test('an email code is requested from the auth endpoint', async () => {
  const { backend, calls } = load();
  await backend.sendEmailCode('pilot@example.test');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/auth/v1/otp');
  assert.equal(calls[0].body.email, 'pilot@example.test');
});

test('an email code goes out with the production redirect and captcha when given', async () => {
  const { backend, calls } = load();
  await backend.sendEmailCode('pilot@example.test', 'captcha-token');
  assert.equal(calls[0].url.searchParams.get('redirect_to'), 'https://mylandings.net/');
  assert.equal(calls[0].body.gotrue_meta_security.captcha_token, 'captcha-token');
});

test('a server refusal of the email code reaches the caller', async () => {
  const { backend } = load({ respond: () => [429, { error_code: 'over_email_send_rate_limit', msg: 'slow down' }] });
  await assert.rejects(backend.sendEmailCode('pilot@example.test'), /slow down/);
});

test('verifying a code returns the user and keeps the session', async () => {
  const { backend, calls, store } = load({ respond: () => [200, session()] });
  const user = await backend.verifyEmailCode('pilot@example.test', '123456');
  assert.deepEqual({ ...user }, { id: USER_ID, email: 'pilot@example.test' });
  assert.equal(calls[0].url.pathname, '/auth/v1/verify');
  assert.equal(calls[0].body.token, '123456');
  assert.equal(calls[0].body.type, 'email');
  assert.ok(store.has(STORAGE_KEY));
  assert.equal((await backend.currentUser()).id, USER_ID);
});

test('nobody is signed in without a session', async () => {
  const { backend, calls } = load();
  assert.equal(await backend.currentUser(), null);
  assert.equal(await backend.getNickname(), null);
  await assert.rejects(backend.setNickname('Pilot'), /not signed in/);
  assert.equal(calls.length, 0);
});

test('a nickname write sends display_name only', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [201, []] });
  assert.equal(await backend.setNickname('  Pilot  '), 'ok');
  assert.equal(calls[0].url.pathname, '/rest/v1/profiles');
  assert.equal(calls[0].url.searchParams.get('on_conflict'), 'id');
  assert.deepEqual(calls[0].body, { display_name: 'Pilot' });
});

test('nickname answers: taken, invalid, other errors', async () => {
  const taken = load({ signedIn: true, respond: () => [409, { code: '23505', message: 'dup' }] });
  assert.equal(await taken.backend.setNickname('Pilot'), 'taken');
  const rejected = load({ signedIn: true, respond: () => [400, { code: '23514', message: 'check' }] });
  assert.equal(await rejected.backend.setNickname('Pilot'), 'invalid');
  const broken = load({ signedIn: true, respond: () => [500, { code: 'XX000', message: 'boom' }] });
  await assert.rejects(broken.backend.setNickname('Pilot'));
  const short = load({ signedIn: true });
  assert.equal(await short.backend.setNickname(' ab '), 'invalid');
  assert.equal(short.calls.length, 0);
});

test('the nickname is read for the signed-in user', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [200, [{ display_name: 'Pilot' }]] });
  assert.equal(await backend.getNickname(), 'Pilot');
  assert.equal(calls[0].url.searchParams.get('id'), `eq.${USER_ID}`);
});

const emptyChanges = () => Object.fromEntries(['strips', 'landings', 'flags', 'notes'].map(t => [t, { save: [], remove: [] }]));
const paths = calls => calls.map(c => `${c.method} ${c.url.pathname.replace('/rest/v1/', '')}`);

test('pulling reads only the user and private notes', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [200, []] });
  const data = await backend.pullAccount();
  assert.deepEqual(Object.keys(data), ['strips', 'landings', 'flags', 'notes', 'photos']);
  assert.deepEqual(paths(calls), ['GET custom_airfields', 'GET landings', 'GET airfield_flags', 'GET comments', 'GET photos']);
  assert.equal(calls[4].url.searchParams.get('uploaded_at'), 'not.is.null');
  for (const c of calls) assert.equal(c.url.searchParams.get('user_id'), `eq.${USER_ID}`);
  assert.equal(calls[3].url.searchParams.get('is_note'), 'eq.true');
});

test('pulling continues past the server page limit', async () => {
  let served = 0;
  const { backend } = load({
    signedIn: true,
    respond: url => {
      if (!url.pathname.endsWith('/landings')) return [200, []];
      const size = served === 0 ? 1000 : 3;
      served += 1;
      return [200, Array.from({ length: size }, () => ({ airfield_code: 'LKBE' }))];
    },
  });
  assert.equal((await backend.pullAccount()).landings.length, 1003);
});

test('pushing needs nothing when nothing changed', async () => {
  const { backend, calls } = load({ signedIn: true });
  await backend.pushAccount(emptyChanges());
  assert.equal(calls.length, 0);
});

test('places are upserted without id or user_id', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [201, []] });
  const changes = emptyChanges();
  const row = { airfield_code: 'LKBE', custom_airfield_id: null, landed_on: null, client_updated_at: '2026-11-01T10:00:00.000Z' };
  changes.landings.save = [{ row, known: false }];
  await backend.pushAccount(changes);
  assert.equal(calls[0].url.searchParams.get('on_conflict'), 'user_id,airfield_code,custom_airfield_id');
  assert.deepEqual(Object.keys(calls[0].body[0]).sort(), Object.keys(row).sort());
});

test('a new row is inserted, a repeated one updated only in columns the client may change', async () => {
  const note = { id: 'n1', airfield_code: 'LKBE', custom_airfield_id: null, body: 'x', client_updated_at: '2026-11-01T10:00:00.000Z' };
  const { backend, calls } = load({ signedIn: true, respond: (_url, init) => (init.method === 'POST' ? [201, []] : [204]) });
  const changes = emptyChanges();
  changes.notes.save = [{ row: note, known: false }];
  await backend.pushAccount(changes);
  assert.deepEqual(paths(calls), ['POST comments', 'PATCH comments']);
  assert.equal(calls[0].url.searchParams.get('on_conflict'), 'id');
  assert.deepEqual(calls[1].body, { body: 'x', client_updated_at: note.client_updated_at });
  assert.equal(calls[1].url.searchParams.get('id'), 'eq.n1');
});

test('an inserted row is not updated again', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [201, [{ id: 'n1' }]] });
  const changes = emptyChanges();
  changes.notes.save = [{ row: { id: 'n1', body: 'x' }, known: false }];
  await backend.pushAccount(changes);
  assert.deepEqual(paths(calls), ['POST comments']);
});

test('strips arrive first and leave last', async () => {
  const { backend, calls } = load({ signedIn: true, respond: (_url, init) => (init.method === 'POST' ? [201, [{ id: 's1' }]] : [204]) });
  const changes = emptyChanges();
  changes.strips.save = [{ row: { id: 's1', name: 'a' }, known: false }];
  changes.landings.save = [{ row: { airfield_code: null, custom_airfield_id: 's1' }, known: false }];
  changes.landings.remove = [{ airfield_code: 'LKBE', custom_airfield_id: null }];
  changes.strips.remove = [{ id: 's2' }];
  await backend.pushAccount(changes);
  assert.deepEqual(paths(calls), ['POST custom_airfields', 'POST landings', 'DELETE landings', 'DELETE custom_airfields']);
});

test('a server refusal stops the push, so the base stays and it can repeat', async () => {
  const { backend } = load({ signedIn: true, respond: () => [400, { code: 'P0001', message: 'limit reached' }] });
  const changes = emptyChanges();
  changes.landings.save = [{ row: { airfield_code: 'LKBE' }, known: false }];
  await assert.rejects(backend.pushAccount(changes), e => e.message === 'limit reached');
});

const steps = calls => calls.map(c => `${c.method} ${c.url.pathname.replace(/^\/(rest|storage)\/v1\//, '')}`);
const PHOTO_ID = '22222222-2222-4222-8222-222222222222';
const photoInput = () => ({ id: PHOTO_ID, airfield_code: 'LKBE', custom_airfield_id: null, full: new Blob(['f']), thumb: new Blob(['t']) });

test('a photo uploads row, both files, then marks itself finished', async () => {
  const { backend, calls } = load({ signedIn: true, respond: url => (url.pathname.startsWith('/storage') ? [200, { Key: 'x' }] : [201, []]) });
  await backend.uploadPhoto(photoInput());
  assert.deepEqual(steps(calls), [
    'POST photos',
    `POST object/photos/${USER_ID}/${PHOTO_ID}.jpg`,
    `POST object/photos/${USER_ID}/${PHOTO_ID}_thumb.jpg`,
    'PATCH photos',
  ]);
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['airfield_code', 'custom_airfield_id', 'id']);
  assert.deepEqual(Object.keys(calls[3].body), ['uploaded_at']);
});

test('a repeated upload accepts files that are already there', async () => {
  const { backend } = load({ signedIn: true, respond: url => (url.pathname.startsWith('/storage') ? [400, { statusCode: '409', error: 'Duplicate', message: 'exists' }] : [201, []]) });
  await backend.uploadPhoto(photoInput());
});

test('a real upload failure stops before the photo is marked finished', async () => {
  const { backend, calls } = load({ signedIn: true, respond: url => (url.pathname.startsWith('/storage') ? [400, { statusCode: '413', error: 'Payload too large', message: 'too big' }] : [201, []]) });
  await assert.rejects(backend.uploadPhoto(photoInput()));
  assert.ok(!calls.some(c => c.method === 'PATCH'));
});

test('removing a photo deletes the files first', async () => {
  const { backend, calls } = load({ signedIn: true, respond: url => (url.pathname.startsWith('/storage') ? [200, []] : [204]) });
  await backend.removePhoto(PHOTO_ID);
  assert.deepEqual(steps(calls), ['DELETE object/photos', 'DELETE photos']);
  assert.deepEqual(calls[0].body.prefixes, [`${USER_ID}/${PHOTO_ID}.jpg`, `${USER_ID}/${PHOTO_ID}_thumb.jpg`]);
});

test('photo links are signed for an hour for both files of the user', async () => {
  const { backend, calls } = load({
    signedIn: true,
    respond: (_url, init) => [200, JSON.parse(init.body).paths.map(path => ({ path, signedURL: `/object/sign/photos/${path}?token=t`, error: null }))],
  });
  const links = await backend.photoLinks([PHOTO_ID]);
  assert.equal(calls[0].body.expiresIn, 3600);
  assert.match(links[PHOTO_ID].url, /\.jpg\?token=t$/);
  assert.match(links[PHOTO_ID].thumb, /_thumb\.jpg\?token=t$/);
});

test('signing out clears the session on this device only', async () => {
  const { backend, calls, store } = load({ signedIn: true, respond: () => [204] });
  await backend.signOut();
  assert.equal(calls[0].url.pathname, '/auth/v1/logout');
  assert.equal(calls[0].url.searchParams.get('scope'), 'local');
  assert.equal(store.has(STORAGE_KEY), false);
});

const sharedServer = ({ me = false } = {}) => (url, init) => {
  const table = url.pathname.split('/').pop();
  if (url.pathname.includes('/object/sign/')) {
    return [200, JSON.parse(init.body).paths.map(path => ({ path, signedURL: `/object/sign/photos/${path}?token=t` }))];
  }
  if (table === 'profiles') return [200, [{ id: 'u2', display_name: 'Eva' }]];
  if (table === 'photos') return [200, [{ id: 'p2', user_id: 'u2', storage_path: 'u2/p2.jpg', thumb_path: 'u2/p2_thumb.jpg' }]];
  if (url.searchParams.get('is_note')) return [200, [{ id: 'c1', body: 'mine', is_public: false, moderation: 'visible', created_at: '2026-11-01' }]];
  return [200, [
    { id: 'c2', user_id: 'u2', body: '<b>hi</b>', created_at: '2026-11-01' },
    ...(me ? [{ id: 'c1', user_id: USER_ID, body: 'mine', created_at: '2026-11-01' }] : []),
  ]];
};

test('a guest reads shared content of an airfield without a session', async () => {
  const { backend, calls } = load({ respond: sharedServer() });
  const got = await backend.placeContent('LKBE');
  assert.deepEqual(JSON.parse(JSON.stringify(got.comments)), [{ id: 'c2', author: 'Eva', body: '<b>hi</b>', created_at: '2026-11-01' }]);
  assert.equal(got.photos[0].author, 'Eva');
  assert.match(got.photos[0].thumb, /u2\/p2_thumb\.jpg/);
  assert.equal(got.own.length, 0);
  const reads = calls.filter(c => /comments|photos$/.test(c.url.pathname) && !c.url.pathname.includes('sign'));
  assert.equal(reads.length, 2, 'no query for own comments');
  for (const c of reads) {
    assert.equal(c.url.searchParams.get('is_public'), 'eq.true');
    assert.equal(c.url.searchParams.get('moderation'), 'eq.visible');
    assert.equal(c.url.searchParams.get('airfield_code'), 'eq.LKBE');
  }
  assert.equal(calls.some(c => c.url.searchParams.get('select')?.includes('email')), false);
});

test('own comments come separately, without the landing note', async () => {
  const { backend, calls } = load({ signedIn: true, respond: sharedServer({ me: true }) });
  const got = await backend.placeContent('LKBE');
  assert.equal(got.comments.length, 1, 'own public comment is not listed twice');
  assert.equal(got.own[0].id, 'c1');
  const own = calls.find(c => c.url.searchParams.get('is_note'));
  assert.equal(own.url.searchParams.get('is_note'), 'eq.false');
  assert.equal(own.url.searchParams.get('user_id'), `eq.${USER_ID}`);
});

test('a new comment is private unless asked and the client sets no owner', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [201, []] });
  await backend.addComment({ airfield_code: 'LKBE', body: '  hello  ' });
  assert.deepEqual(calls[0].body, { airfield_code: 'LKBE', body: 'hello', is_public: false });
});

test('sharing fails loudly when the database dropped the change', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [200, []] });
  await assert.rejects(backend.setPhotoPublic('p1', true), /not changed/);
  assert.equal(calls[0].body.is_public, true);
  assert.ok(calls[0].body.client_updated_at);
});

test('a report sends no owner and a repeat is not an error', async () => {
  let n = 0;
  const { backend, calls } = load({ signedIn: true, respond: () => (n++ ? [409, { code: '23505', message: 'dup' }] : [201, []]) });
  assert.equal(await backend.report({ comment_id: 'c2', reason: 'spam', details: '  why  ' }), 'ok');
  assert.deepEqual(calls[0].body, { comment_id: 'c2', photo_id: null, reason: 'spam', details: 'why' });
  assert.equal(await backend.report({ comment_id: 'c2', reason: 'spam' }), 'already');
});

test('a guest is no admin without asking the server', async () => {
  const { backend, calls } = load();
  assert.equal(await backend.isAdmin(), false);
  assert.equal(calls.length, 0);
});

test('reports of one item are grouped and keep the reported text', async () => {
  const respond = url => {
    const table = url.pathname.split('/').pop();
    if (table === 'reports') return [200, [
      { id: 'r1', reporter_id: 'u3', comment_id: 'c2', photo_id: null, reason: 'spam', details: null, comment_body: 'bad', created_at: '1' },
      { id: 'r2', reporter_id: 'u4', comment_id: 'c2', photo_id: null, reason: 'offensive', details: 'x', comment_body: 'bad', created_at: '2' },
    ]];
    if (table === 'comments') return [200, [{ id: 'c2', user_id: 'u2', airfield_code: 'LKBE', body: 'edited', is_public: true, moderation: 'visible' }]];
    if (table === 'profiles') return [200, [{ id: 'u2', display_name: 'Eva' }, { id: 'u3', display_name: 'Jan' }]];
    return [200, []];
  };
  const { backend, calls } = load({ signedIn: true, respond });
  const items = await backend.adminReports();
  assert.equal(items.length, 1);
  assert.equal(items[0].body, 'edited');
  assert.equal(items[0].author, 'Eva');
  assert.deepEqual(JSON.parse(JSON.stringify(items[0].reports.map(r => [r.reporter, r.reported_body]))), [['Jan', 'bad'], [null, 'bad']]);
  assert.equal(calls[0].url.searchParams.get('status'), 'eq.open');
  assert.equal(calls.some(c => c.url.searchParams.get('select')?.includes('email')), false);
});

test('moderation goes through the database function', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [204, null] });
  await backend.adminModerate({ photo_id: 'p2' }, 'hidden', 'resolved');
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/admin_moderate');
  assert.deepEqual(calls[0].body, { p_comment_id: null, p_photo_id: 'p2', p_moderation: 'hidden', p_status: 'resolved' });
});

test('accepting the terms sends only version and time', async () => {
  const { backend, calls } = load({ signedIn: true, respond: () => [201, []] });
  await backend.acceptTerms('2026-11-02');
  assert.equal(calls[0].url.pathname, '/rest/v1/user_settings');
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['terms_accepted_at', 'terms_version']);
  assert.equal(calls[0].url.searchParams.get('on_conflict'), 'user_id');
});

test('account deletion removes the files before the account', async () => {
  const respond = url => {
    if (url.pathname.includes('/storage/')) return [200, []]; // first: the storage path ends in /photos too
    if (url.pathname.endsWith('/photos')) return [200, [{ id: 'p1' }]];
    if (url.pathname.endsWith('/rpc/delete_my_account')) return [204, null];
    return [204, null];
  };
  const { backend, calls, store } = load({ signedIn: true, respond });
  await backend.deleteAccount();
  const removal = calls.findIndex(c => c.url.pathname.includes('/storage/') && c.method === 'DELETE');
  const rpc = calls.findIndex(c => c.url.pathname.endsWith('/rpc/delete_my_account'));
  assert.ok(removal >= 0 && rpc > removal, 'files go first');
  assert.deepEqual(calls[removal].body.prefixes, [`${USER_ID}/p1.jpg`, `${USER_ID}/p1_thumb.jpg`]);
  assert.equal(store.size, 0, 'the session is gone from this device');
});

test('a failed file removal stops the account deletion', async () => {
  const respond = url => {
    if (url.pathname.includes('/storage/')) return [500, { message: 'down' }];
    if (url.pathname.endsWith('/photos')) return [200, [{ id: 'p1' }]];
    return [204, null];
  };
  const { backend, calls } = load({ signedIn: true, respond });
  await assert.rejects(backend.deleteAccount());
  assert.equal(calls.some(c => c.url.pathname.endsWith('/rpc/delete_my_account')), false);
});
