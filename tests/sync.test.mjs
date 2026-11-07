// Runs sync.js on plain data: what gets sent, and what the app gets back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(join(root, 'sync.js'), 'utf8'), ctx);
const core = ctx.syncCore;
const plain = value => JSON.parse(JSON.stringify(value));
const ids = () => { let n = 0; return () => `id-${++n}`; };
const TS = Date.parse('2026-11-01T10:00:00.000Z');
const strip = () => ({ code: 'CABC', name: 'Louka', short: 'LK', desc: '', lat: 49.5, lon: 15.5, elev: '', town: '', custom: true, pics: [], ts: TS });

test('a new landing with a note becomes a landing row and a private note', () => {
  const rows = core.toRows({ visited: { LKBE: { date: '2026-10-01', note: 'Pozor na vitr', ts: TS } }, custom: {}, flags: {} }, null, ids());
  assert.deepEqual(plain(rows.landings.LKBE), {
    airfield_code: 'LKBE', custom_airfield_id: null, landed_on: '2026-10-01', client_updated_at: '2026-11-01T10:00:00.000Z',
  });
  assert.equal(rows.notes.LKBE.id, 'id-1');
  assert.equal(rows.notes.LKBE.body, 'Pozor na vitr');
  assert.equal('is_public' in rows.notes.LKBE, false, 'public stays the database default: false');
  assert.equal(rows.notes.LKBE.is_note, true);
});

test('a landing on a custom strip points at the strip id', () => {
  const custom = { CABC: strip() };
  const rows = core.toRows({ visited: { CABC: { date: '', note: '', ts: TS } }, custom, flags: { CABC: { want: true, ts: TS } } }, null, ids());
  assert.equal(custom.CABC.id, 'id-1');
  assert.equal(rows.landings['id-1'].custom_airfield_id, 'id-1');
  assert.equal(rows.landings['id-1'].airfield_code, null);
  assert.equal(rows.landings['id-1'].landed_on, null);
  assert.equal(rows.flags['id-1'].wants_visit, true);
});

test('records that cannot be stored stay on the device', () => {
  const rows = core.toRows({
    visited: { '<script>': { date: 'x', ts: TS }, lkbe: { date: '2026-01-01', ts: TS }, LKHK: { date: '"><img>', ts: TS } },
    custom: { CBAD: { ...strip(), code: 'CBAD', lat: 'x' } },
    flags: { CBAD: { fav: true, ts: TS } },
  }, null, ids());
  assert.deepEqual(Object.keys(rows.landings), ['LKHK']);
  assert.equal(rows.landings.LKHK.landed_on, null);
  assert.deepEqual(plain(rows.strips), {});
  assert.deepEqual(plain(rows.flags), {});
});

test('text is cut to what the database accepts', () => {
  const custom = { CABC: { ...strip(), name: 'n'.repeat(150), short: 'abcdefghij', desc: 'd'.repeat(3000), elev: 123456789 } };
  const rows = core.toRows({ visited: { LKBE: { date: '', note: 'x'.repeat(2500), ts: TS } }, custom, flags: {} }, null, ids());
  const row = Object.values(rows.strips)[0];
  assert.equal(row.name.length, 100);
  assert.equal(row.short.length, 8);
  assert.equal(row.description.length, 2000);
  assert.equal(row.elev, '12345678');
  assert.equal(rows.notes.LKBE.body.length, 2000);
});

test('nothing changed means nothing to send, even with a newer time', () => {
  const state = { visited: { LKBE: { date: '2026-10-01', note: 'x', ts: TS } }, custom: { CABC: strip() }, flags: {} };
  const newId = ids();
  const base = core.toRows(state, null, newId);
  assert.ok(core.isEmpty(core.diff(base, core.toRows(state, base, newId))));
  state.visited.LKBE.ts = TS + 1000;
  assert.ok(core.isEmpty(core.diff(base, core.toRows(state, base, newId))));
});

test('changes and removals are found against the base, keeping the note id', () => {
  const newId = ids();
  const base = core.toRows({ visited: { LKBE: { date: '2026-10-01', note: 'a', ts: TS }, LKHK: { date: '', note: 'b', ts: TS } }, custom: {}, flags: {} }, null, newId);
  const next = core.toRows({ visited: { LKBE: { date: '2026-10-02', note: 'a2', ts: TS }, LKLB: { date: '', note: '', ts: TS } }, custom: {}, flags: {} }, base, newId);
  const changes = core.diff(base, next);
  assert.deepEqual(plain(changes.landings.save.map(c => [c.row.airfield_code, c.known])), [['LKBE', true], ['LKLB', false]]);
  assert.deepEqual(plain(changes.landings.remove.map(r => r.airfield_code)), ['LKHK']);
  assert.equal(changes.notes.save[0].row.id, base.notes.LKBE.id);
  assert.equal(changes.notes.save[0].known, true);
  assert.deepEqual(plain(changes.notes.remove.map(r => r.id)), [base.notes.LKHK.id]);
});

test('clearing a note removes it and keeps the landing', () => {
  const newId = ids();
  const base = core.toRows({ visited: { LKBE: { date: '', note: 'a', ts: TS } }, custom: {}, flags: {} }, null, newId);
  const changes = core.diff(base, core.toRows({ visited: { LKBE: { date: '', note: '  ', ts: TS } }, custom: {}, flags: {} }, base, newId));
  assert.equal(changes.notes.remove.length, 1);
  assert.equal(changes.landings.remove.length, 0);
});

const server = () => ({
  strips: [{ id: 'aaaa-1', name: 'Louka', short: 'LK', description: null, lat: 49.5, lon: 15.5, elev: null, town: null, client_updated_at: '2026-11-01T10:00:00.123456+00:00' }],
  landings: [
    { airfield_code: 'LKBE', custom_airfield_id: null, landed_on: '2026-10-01', client_updated_at: '2026-11-01T10:00:00+00:00' },
    { airfield_code: null, custom_airfield_id: 'aaaa-1', landed_on: null, client_updated_at: '2026-11-01T10:00:00+00:00' },
  ],
  flags: [{ airfield_code: 'LKBE', custom_airfield_id: null, is_favorite: true, wants_visit: false, client_updated_at: '2026-11-01T10:00:00+00:00' }],
  notes: [
    { id: 'n1', airfield_code: 'LKBE', custom_airfield_id: null, body: 'older', client_updated_at: '2026-10-01T10:00:00+00:00' },
    { id: 'n2', airfield_code: 'LKBE', custom_airfield_id: null, body: 'newer', client_updated_at: '2026-11-01T10:00:00+00:00' },
  ],
});

test('server rows become the app state', () => {
  const state = core.fromRows(server(), {}, ids());
  assert.equal(state.visited.LKBE.date, '2026-10-01');
  assert.equal(state.visited.LKBE.note, 'newer');
  assert.deepEqual(plain(state.flags.LKBE), { fav: true, ts: Date.parse('2026-11-01T10:00:00+00:00') });
  const code = Object.keys(state.custom)[0];
  assert.match(code, /^C/);
  assert.equal(state.custom[code].custom, true);
  assert.equal(state.visited[code].date, '');
});

test('photo rows become pictures on airfields and strips, with their links', () => {
  const data = server();
  data.photos = [
    { id: 'p1', airfield_code: 'LKBE', custom_airfield_id: null },
    { id: 'p2', airfield_code: null, custom_airfield_id: 'aaaa-1' },
  ];
  const links = { p1: { url: 'u1', thumb: 't1' }, p2: { url: 'u2', thumb: 't2' } };
  const state = core.fromRows(data, { custom: { CABC: { ...strip(), id: 'aaaa-1' } } }, ids(), links);
  assert.deepEqual(plain(state.photos.LKBE.pics), [{ id: 'p1', url: 'u1', thumb: 't1' }]);
  assert.deepEqual(plain(state.custom.CABC.pics), [{ id: 'p2', url: 'u2', thumb: 't2' }]);
  assert.deepEqual(plain(state.photoIds), { p1: true, p2: true });
});

test('a photo deleted elsewhere goes, a waiting one stays', () => {
  const local = { photos: { LKBE: { pics: [{ id: 'gone', url: 'old' }, { url: 'data:new' }] } } };
  const state = core.fromRows({ ...server(), photos: [] }, local, ids());
  assert.deepEqual(plain(state.photos.LKBE.pics), [{ url: 'data:new' }]);
});

test('only photos with a stored place wait for upload', () => {
  const custom = { CABC: { ...strip(), id: 'aaaa-1', pics: [{ url: 'a' }, { id: 'done', url: 'b' }] }, CNEW: { ...strip(), code: 'CNEW', pics: [{ url: 'c' }] } };
  const photos = { LKBE: { pics: [{ url: 'd' }] }, bad: { pics: [{ url: 'e' }] } };
  const list = core.pendingPhotos({ custom, photos }).map(p => [p.pic.url, p.airfield_code, p.custom_airfield_id]);
  assert.deepEqual(plain(list), [['a', null, 'aaaa-1'], ['d', 'LKBE', null]]);
});

test('a known strip keeps its code and its waiting photos', () => {
  const local = { CABC: { ...strip(), id: 'aaaa-1', pics: [{ url: 'data:x' }, { id: 'gone', url: 'old' }] } };
  const state = core.fromRows(server(), { custom: local }, ids());
  assert.deepEqual(Object.keys(state.custom), ['CABC']);
  assert.equal(state.custom.CABC.pics.length, 1);
  assert.ok(state.visited.CABC);
});

test('state from the server has nothing left to send', () => {
  const newId = ids();
  const state = core.fromRows(server(), {}, newId);
  assert.ok(core.isEmpty(core.diff(state.base, core.toRows(state, state.base, newId))));
  assert.equal(state.base.notes.LKBE.id, 'n2');
});

test('a record the server cannot hold survives a pull', () => {
  const data = server();
  const local = {
    visited: { lkbad: { date: '', note: 'keep', ts: TS }, LKOLD: { date: '', note: '', ts: TS } },
    flags: { lkbad: { fav: true, ts: TS } },
    custom: { CBAD: { ...strip(), code: 'CBAD', lat: 'x' } },
  };
  local.visited.CBAD = { date: '', note: '', ts: TS };
  const state = core.fromRows(data, local, ids());
  assert.equal(state.visited.lkbad.note, 'keep');
  assert.ok(state.flags.lkbad);
  assert.ok(state.custom.CBAD);
  assert.ok(state.visited.CBAD);
  assert.equal(state.visited.LKOLD, undefined, 'a valid record gone from the server was deleted elsewhere');
});

test('a landing on a strip deleted elsewhere goes with it', () => {
  const data = server();
  data.strips = [];
  data.landings = [];
  const local = { custom: { CABC: { ...strip(), id: 'gone' } }, visited: { CABC: { date: '', note: '', ts: TS } } };
  const state = core.fromRows(data, local, ids());
  assert.deepEqual(plain(state.custom), {});
  assert.deepEqual(plain(state.visited), {});
});

const stable = async text => `id:${text}`;
const emptyState = () => ({ visited: {}, custom: {}, flags: {}, photos: {} });

test('an import takes only known fields and trusted photo sources', async () => {
  const data = {
    visited: { LKBE: { date: '2026-01-01', note: 'n', ts: 5, evil: '<x>' }, LKHK: 'nonsense' },
    flags: { LKBE: { fav: true, ts: 5, evil: 1 }, LKHK: { other: 1 } },
    photos: { LKBE: { pics: [{ url: 'https://evil.example/a.jpg' }, { url: 'javascript:x' },
      { url: 'https://raw.githubusercontent.com/a/b.jpg', path: 'photos/b.jpg' }, { url: 'data:image/jpeg;base64,AAAA', path: 'photos/c.jpg' }] } },
  };
  const { state, added } = await core.mergeImport(data, emptyState(), stable);
  assert.deepEqual(plain(state.visited), { LKBE: { date: '2026-01-01', note: 'n', ts: 5 } });
  assert.deepEqual(plain(state.flags), { LKBE: { fav: true, ts: 5 } });
  // the old GitHub copies are gone, so only photos inside the file count
  assert.deepEqual(plain(state.photos.LKBE.pics), [{ url: 'data:image/jpeg;base64,AAAA', pid: 'id:photo:photos/c.jpg' }]);
  assert.deepEqual(plain(added), { landings: 1, flags: 1, photos: 1, strips: 0 });
});

test('an import keeps what the account already holds', async () => {
  const current = { ...emptyState(), visited: { LKBE: { date: '2026-09-09', note: 'edited', ts: 9 } } };
  const { state, added } = await core.mergeImport({ visited: { LKBE: { date: '2020-01-01', note: 'old', ts: 1 } } }, current, stable);
  assert.equal(state.visited.LKBE.note, 'edited');
  assert.equal(added.landings, 0);
});

test('an import never goes over the photo limit of a place', async () => {
  const pics = [1, 2, 3, 4].map(n => ({ url: `data:image/jpeg;base64,${n}`, path: `photos/${n}.jpg` }));
  const { state } = await core.mergeImport({ visited: {}, photos: { LKBE: { pics } } }, emptyState(), stable);
  assert.equal(state.photos.LKBE.pics.length, 3);
});

test('an imported strip with its landing and old-style photo stays together, also on repeat', async () => {
  const data = {
    visited: { C1: { date: '2026-01-01', note: '', ts: 1 } },
    custom: { C1: { code: 'C1', name: 'Louka', lat: 49, lon: 15, photo: 'data:image/jpeg;base64,x', photoPath: 'photos/x.jpg', ts: 1 } },
  };
  const first = await core.mergeImport(data, emptyState(), stable);
  assert.equal(first.state.custom.C1.id, 'id:strip:C1');
  assert.ok(first.state.visited.C1);
  assert.equal(first.state.custom.C1.pics.length, 1);
  const second = await core.mergeImport(data, first.state, stable);
  assert.deepEqual(plain(second.added), { landings: 0, flags: 0, photos: 0, strips: 0 });
  assert.equal(second.state.custom.C1.pics.length, 1);
});

test('rows for an unknown strip are ignored', () => {
  const data = server();
  data.strips = [];
  const state = core.fromRows(data, {}, ids());
  assert.deepEqual(Object.keys(state.visited), ['LKBE']);
});
