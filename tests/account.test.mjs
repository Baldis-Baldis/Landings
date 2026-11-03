// Runs the account sync from app.js on simulated devices against a fake server in memory. No network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const syncCode = readFileSync(join(root, 'sync.js'), 'utf8');
const accountCode = app.slice(app.indexOf('// --- Account sync'), app.indexOf('let map=null; const markers={};'));
const canonCode = app.match(/function canon\(o\)\{.*\}/)[0];
const legacyPicsCode = app.match(/function legacyPics\(o\)\{.*\}/)[0];
const ALICE = { id: 'alice', email: 'a@example.test' };
const BOB = { id: 'bob', email: 'b@example.test' };
const LOCAL_KEY = 'visited-cz-airfields';
// Made-up data in the shape of the old GitHub backup. LANDINGS_FILE can point at a real export, kept outside the repo.
const REAL_DATA = JSON.parse(readFileSync(process.env.LANDINGS_FILE || join(root, 'tests/fixtures/backup-sample.json'), 'utf8').replace(/^\uFEFF/, ''));
const counts = data => ({
  landings: Object.keys(data.visited).length,
  notes: Object.values(data.visited).filter(v => v.note).length,
  flags: Object.values(data.flags).filter(f => f.fav || f.want).length,
  photos: Object.values(data.photos).flatMap(p => p.pics || []).length,
});
const stored = (server, user) => {
  const d = server.data(user);
  return { landings: d.landings.size, notes: d.notes.size, flags: d.flags.size, photos: d.photos.size };
};

class Server {
  users = {};
  offline = false;
  failPull = false;
  failUpload = false;
  linkCalls = 0;
  data(id) {
    this.users[id] ||= { strips: new Map(), landings: new Map(), flags: new Map(), notes: new Map(), photos: new Map() };
    return this.users[id];
  }
  backendFor(id) {
    const place = row => row.custom_airfield_id || row.airfield_code;
    const keyOf = { strips: r => r.id, landings: place, flags: place, notes: r => r.id };
    return {
      pushAccount: async changes => {
        if (this.offline) throw new TypeError('offline');
        const data = this.data(id);
        for (const table of ['strips', 'landings', 'flags', 'notes']) {
          for (const { row } of changes[table].save) {
            const old = data[table].get(keyOf[table](row));
            if (!old || row.client_updated_at >= old.client_updated_at) data[table].set(keyOf[table](row), JSON.parse(JSON.stringify(row)));
          }
        }
        for (const table of ['notes', 'landings', 'flags', 'strips']) {
          for (const row of changes[table].remove) {
            if (table === 'strips') assert.ok(![...data.photos.values()].some(p => p.custom_airfield_id === row.id), 'files must go before the strip');
            data[table].delete(keyOf[table](row));
          }
        }
        for (const table of ['landings', 'flags']) { // the foreign key cascade
          for (const [key, row] of data[table]) if (row.custom_airfield_id && !data.strips.has(row.custom_airfield_id)) data[table].delete(key);
        }
      },
      pullAccount: async () => {
        if (this.offline || this.failPull) throw new TypeError('offline');
        if (this.onPull) { const hook = this.onPull; this.onPull = null; hook(); }
        const data = this.data(id);
        const list = t => JSON.parse(JSON.stringify([...data[t].values()]));
        return { strips: list('strips'), landings: list('landings'), flags: list('flags'), photos: list('photos'), notes: list('notes').sort((a, b) => (a.client_updated_at < b.client_updated_at ? -1 : 1)) };
      },
      uploadPhoto: async ({ id: photoId, airfield_code, custom_airfield_id, full, thumb }) => {
        if (this.offline || this.failUpload) throw new TypeError('offline');
        assert.deepEqual([full, thumb], ['full:' + full.slice(5), 'thumb:' + thumb.slice(6)]);
        if (custom_airfield_id) assert.ok(this.data(id).strips.has(custom_airfield_id), 'the strip row must exist first');
        this.data(id).photos.set(photoId, { id: photoId, airfield_code, custom_airfield_id });
      },
      removePhoto: async photoId => {
        if (this.offline) throw new TypeError('offline');
        this.data(id).photos.delete(photoId);
      },
      photoLinks: async list => {
        this.linkCalls += 1;
        return Object.fromEntries(list.map(p => [p, { url: `full/${p}`, thumb: `thumb/${p}` }]));
      },
    };
  }
}

// One browser: its storage survives "reopening" the app with a new device() on the same Map.
function device(server, store = new Map()) {
  const ctx = {
    console, crypto: globalThis.crypto, confirmed: [], answer: true, TextEncoder,
    setTimeout, clearTimeout,
    localStorage: new Proxy({
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    }, { ownKeys: t => [...new Set([...Reflect.ownKeys(t), ...store.keys()])], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    t: k => k,
  };
  ctx.confirm = text => { ctx.confirmed.push(text); return ctx.answer; };
  ctx.window = ctx;
  ctx.window.backend = null;
  vm.createContext(ctx);
  vm.runInContext(syncCode, ctx);
  vm.runInContext(`
    const STATE_KEYS={KEY:'${LOCAL_KEY}',CKEY:'custom-airfields',PKEY:'airfield-photos',FKEY:'airfield-flags',TKEY:'sync-tombstones'};
    let {KEY,CKEY,PKEY,FKEY,TKEY}=STATE_KEYS;
    let visited={},custom={},photos={},flags={},tomb={};
    let syncAgain=false,pushTimer=null,lastSyncOk=0,account=null,accountEpoch=0,accountBase=null,accountPhotos={},photoLinks={},stateGen=0;
    async function photoFiles(src){ return {full:'full:'+src,thumb:'thumb:'+src}; }
    function schedulePush(){ stateGen++; }
    function showAccountMenu(){}
    ${canonCode}
    ${legacyPicsCode}
    function applyState(s){
      visited=s.visited; custom=s.custom; photos=s.photos||{}; flags=s.flags||{}; tomb=s.tomb||{};
      for(const [k,v] of [[KEY,visited],[CKEY,custom],[PKEY,photos],[FKEY,flags],[TKEY,tomb]]) localStorage.setItem(k,JSON.stringify(v));
    }
    function save(){ localStorage.setItem(KEY,JSON.stringify(visited)); localStorage.setItem(FKEY,JSON.stringify(flags)); localStorage.setItem(CKEY,JSON.stringify(custom)); localStorage.setItem(PKEY,JSON.stringify(photos)); stateGen++; }
    async function syncNow(){ const e=accountEpoch; if(!account) return; await syncAccount(e).catch(x=>{ globalThis.lastError=x; }); if(syncAgain){ syncAgain=false; await syncNow(); } }
    ${accountCode}
  `, ctx);
  const run = code => vm.runInContext(code, ctx);
  return {
    ctx, run, store,
    signIn(user) { ctx.window.backend = server.backendFor(user.id); ctx.window.useAccount(user); return run('syncNow()'); },
    sync: () => run('syncNow()'),
    land(code, date, note = '', ts = Date.now()) { run(`visited[${JSON.stringify(code)}]={date:${JSON.stringify(date)},note:${JSON.stringify(note)},ts:${ts}}; save();`); },
    unland(code) { run(`delete visited[${JSON.stringify(code)}]; save();`); },
    visited: () => JSON.parse(run('JSON.stringify(visited)')),
    custom: () => JSON.parse(run('JSON.stringify(custom)')),
    flags: () => JSON.parse(run('JSON.stringify(flags)')),
    photos: () => JSON.parse(run('JSON.stringify(photos)')),
    addPhoto(code, url) { run(`photos[${JSON.stringify(code)}]={pics:[...((photos[${JSON.stringify(code)}]||{}).pics||[]),{url:${JSON.stringify(url)}}]}; save();`); },
  };
}

test('a landing, note, flag and strip reach the second device', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  a.land('LKBE', '2026-10-01', 'Pozor na vitr');
  a.run(`flags.LKHK={want:true,ts:Date.now()}; custom.CABC={code:'CABC',name:'Louka',lat:49.5,lon:15.5,elev:'',town:'',custom:true,desc:'',pics:[],ts:Date.now()}; save();`);
  a.land('CABC', '2026-10-02');
  await a.sync();
  await b.signIn(ALICE);
  assert.equal(b.visited().LKBE.note, 'Pozor na vitr');
  assert.equal(b.flags().LKHK.want, true);
  const strip = Object.values(b.custom())[0];
  assert.equal(strip.name, 'Louka');
  assert.equal(b.visited()[strip.code].date, '2026-10-02');
});

test('a change made offline survives closing the app and goes out later', async () => {
  const server = new Server();
  const store = new Map();
  const a = device(server, store);
  await a.signIn(ALICE);
  server.offline = true;
  a.land('LKBE', '2026-10-01', 'offline');
  await a.sync();
  assert.equal(server.data('alice').landings.size, 0);

  const reopened = device(server, store);
  await reopened.signIn(ALICE);
  assert.equal(reopened.visited().LKBE.note, 'offline');
  server.offline = false;
  await reopened.sync();
  assert.equal(server.data('alice').landings.get('LKBE').landed_on, '2026-10-01');
});

test('a push that succeeded but was not confirmed creates no duplicate', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.land('LKBE', '2026-10-01', 'note');
  server.failPull = true;
  await a.sync();
  server.failPull = false;
  await a.sync();
  await a.sync();
  const data = server.data('alice');
  assert.equal(data.landings.size, 1);
  assert.equal(data.notes.size, 1);
});

test('the older of two offline edits loses', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  await b.signIn(ALICE);
  const now = Date.now();
  b.land('LKBE', '2026-02-02', '', now);
  await b.sync();
  a.land('LKBE', '2026-01-01', '', now - 60000);
  await a.sync();
  assert.equal(server.data('alice').landings.get('LKBE').landed_on, '2026-02-02');
  assert.equal(a.visited().LKBE.date, '2026-02-02');
});

test('a deletion reaches the other device, also with the note', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  a.land('LKBE', '2026-10-01', 'note');
  await a.sync();
  await b.signIn(ALICE);
  a.unland('LKBE');
  await a.sync();
  await b.sync();
  assert.equal(b.visited().LKBE, undefined);
  assert.equal(server.data('alice').notes.size, 0);
});

test('an edit during a sync is sent, not overwritten', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.land('LKBE', '2026-10-01');
  server.onPull = () => a.land('LKHK', '2026-10-05');
  await a.sync();
  assert.equal(a.visited().LKHK.date, '2026-10-05');
  assert.ok(server.data('alice').landings.has('LKHK'));
});

test('deleting a strip removes its landing on the other device', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  a.run(`custom.CABC={code:'CABC',name:'Louka',lat:49.5,lon:15.5,custom:true,pics:[],ts:Date.now()}; save();`);
  a.land('CABC', '2026-10-02');
  await a.sync();
  await b.signIn(ALICE);
  a.run(`delete custom.CABC; delete visited.CABC; save();`);
  await a.sync();
  await b.sync();
  assert.deepEqual(b.custom(), {});
  assert.deepEqual(b.visited(), {});
});

test('two accounts in one browser never see each other, and guest data stays', async () => {
  const server = new Server();
  const a = device(server);
  a.store.set(LOCAL_KEY, JSON.stringify({ LKOLD: { date: '2020-01-01', note: 'legacy', ts: 1 } }));
  await a.signIn(ALICE);
  assert.deepEqual(a.visited(), {});
  a.land('LKBE', '2026-10-01');
  await a.sync();
  a.ctx.window.backend = server.backendFor('bob');
  a.ctx.window.useAccount(BOB);
  await a.sync();
  assert.deepEqual(a.visited(), {});
  assert.equal(server.data('bob').landings.size, 0);
  a.ctx.window.useAccount(null);
  assert.equal(a.visited().LKOLD.note, 'legacy', 'the old data must come back untouched');
  assert.equal(server.data('alice').landings.size, 1);
});

test('a backup arrives complete, with dates and notes', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.ctx.backup = JSON.parse(JSON.stringify(REAL_DATA));
  await a.run('importToAccount(backup)');
  await a.sync();
  assert.equal(a.run('globalThis.lastError'), undefined);
  assert.deepEqual(stored(server, 'alice'), counts(REAL_DATA));
  for (const [code, v] of Object.entries(REAL_DATA.visited)) {
    assert.equal(server.data('alice').landings.get(code).landed_on, v.date || null, code); // no date is NULL
    assert.equal(a.visited()[code].date, v.date);
    assert.equal(a.visited()[code].note, v.note || '');
  }
});

test('repeating the import creates nothing, on any device, and keeps later edits', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  a.ctx.backup = JSON.parse(JSON.stringify(REAL_DATA));
  await a.run('importToAccount(backup)');
  await a.sync();
  const [code] = Object.keys(REAL_DATA.visited);
  a.land(code, '2026-10-30', 'edited after the import');
  await a.sync();
  const ids = [...server.data('alice').photos.keys()].sort();
  const added = await a.run('importToAccount(backup)');
  assert.deepEqual({ ...added }, { landings: 0, flags: 0, photos: 0, strips: 0 });
  await a.sync();
  await b.signIn(ALICE);
  b.ctx.backup = JSON.parse(JSON.stringify(REAL_DATA));
  await b.run('importToAccount(backup)');
  await b.sync();
  assert.deepEqual(stored(server, 'alice'), { ...counts(REAL_DATA), notes: counts(REAL_DATA).notes + (REAL_DATA.visited[code].note ? 0 : 1) });
  assert.deepEqual([...server.data('alice').photos.keys()].sort(), ids);
  assert.equal(server.data('alice').landings.get(code).landed_on, '2026-10-30');
});

test('two accounts importing one file get separate photo ids', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  await b.signIn(BOB);
  for (const d of [a, b]) {
    d.ctx.backup = JSON.parse(JSON.stringify(REAL_DATA));
    await d.run('importToAccount(backup)');
    await d.sync();
  }
  const mine = new Set(server.data('alice').photos.keys());
  assert.ok(mine.size > 0);
  assert.ok(![...server.data('bob').photos.keys()].some(id => mine.has(id)));
});

test('importing touches neither the old local data nor the backup', async () => {
  const server = new Server();
  const a = device(server);
  const legacy = JSON.stringify({ LKOLD: { date: '', note: '', ts: 1 } });
  a.store.set(LOCAL_KEY, legacy);
  await a.signIn(ALICE);
  const before = JSON.stringify(REAL_DATA);
  a.ctx.backup = JSON.parse(before);
  await a.run('importToAccount(backup)');
  await a.sync();
  assert.equal(a.store.get(LOCAL_KEY), legacy);
  assert.equal(JSON.stringify(a.ctx.backup), before);
});

test('signing out removes only that account from the device', async () => {
  const server = new Server();
  const a = device(server);
  a.store.set(LOCAL_KEY, JSON.stringify({ LKOLD: { date: '', note: '', ts: 1 } }));
  await a.signIn(ALICE);
  a.land('LKBE', '2026-10-01');
  await a.sync();
  let signedOut = false;
  assert.equal(await a.ctx.window.leaveAccount(async () => { signedOut = true; }), true);
  assert.equal(signedOut, true);
  assert.equal(a.ctx.confirmed.length, 0);
  assert.deepEqual([...a.store.keys()].filter(k => k.startsWith('u:alice:')), []);
  assert.ok(a.store.has(LOCAL_KEY));
  assert.ok(server.data('alice').landings.has('LKBE'));
});

test('signing out asks first when changes are unsent, and cancelling keeps them', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  server.offline = true;
  a.land('LKBE', '2026-10-01');
  a.ctx.answer = false;
  let signedOut = false;
  assert.equal(await a.ctx.window.leaveAccount(async () => { signedOut = true; }), false);
  assert.deepEqual(a.ctx.confirmed, ['leaveUnsent']);
  assert.equal(signedOut, false);
  assert.ok(a.visited().LKBE);
});

test('a photo goes up and appears on the second device', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  a.addPhoto('LKBE', 'data:one');
  await a.sync();
  const id = [...server.data('alice').photos.keys()][0];
  assert.deepEqual(a.photos().LKBE.pics, [{ id, url: `full/${id}`, thumb: `thumb/${id}` }]);
  await b.signIn(ALICE);
  assert.equal(b.photos().LKBE.pics[0].thumb, `thumb/${id}`);
});

test('a photo taken offline waits, survives reopening and goes up once', async () => {
  const server = new Server();
  const store = new Map();
  const a = device(server, store);
  await a.signIn(ALICE);
  server.offline = true;
  a.addPhoto('LKBE', 'data:one');
  await a.sync();
  const reopened = device(server, store);
  await reopened.signIn(ALICE);
  assert.equal(reopened.photos().LKBE.pics[0].url, 'data:one');
  server.offline = false;
  await reopened.sync();
  await reopened.sync();
  assert.equal(server.data('alice').photos.size, 1);
  assert.ok(reopened.photos().LKBE.pics[0].id);
});

test('a failed photo does not stop the rest and keeps waiting under one id', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.land('LKBE', '2026-10-01');
  a.addPhoto('LKBE', 'data:one');
  server.failUpload = true;
  await a.sync();
  assert.ok(server.data('alice').landings.has('LKBE'), 'the landing still went out');
  assert.equal(a.run('globalThis.lastError && globalThis.lastError.message'), 'photo upload');
  const first = a.photos().LKBE.pics[0].pid;
  assert.ok(first);
  server.failUpload = false;
  await a.sync();
  assert.deepEqual([...server.data('alice').photos.keys()], [first]);
});

test('a photo removed on one device disappears from the other', async () => {
  const server = new Server();
  const a = device(server), b = device(server);
  await a.signIn(ALICE);
  a.addPhoto('LKBE', 'data:one');
  await a.sync();
  await b.signIn(ALICE);
  a.run('delete photos.LKBE; save();');
  await a.sync();
  assert.equal(server.data('alice').photos.size, 0);
  await b.sync();
  assert.equal(b.photos().LKBE, undefined);
});

test('a new strip exists before its photo, and leaves after it', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.run(`custom.CABC={code:'CABC',name:'Louka',lat:49.5,lon:15.5,custom:true,pics:[{url:'data:one'}],ts:Date.now()}; save();`);
  await a.sync();
  assert.equal(server.data('alice').photos.size, 1);
  a.run('delete custom.CABC; save();');
  await a.sync();
  assert.equal(a.run('globalThis.lastError'), undefined);
  assert.equal(server.data('alice').strips.size, 0);
  assert.equal(server.data('alice').photos.size, 0);
});

test('links are reused while they stay valid', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.addPhoto('LKBE', 'data:one');
  await a.sync();
  const calls = server.linkCalls;
  await a.sync();
  await a.sync();
  assert.equal(server.linkCalls, calls);
});

test('uploaded photos do not stop a sign-out', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.addPhoto('LKBE', 'data:one');
  await a.sync();
  assert.equal(await a.ctx.window.leaveAccount(async () => {}), true);
  assert.equal(a.ctx.confirmed.length, 0);
});

test('signing out asks first when a photo still waits for upload', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  server.offline = true;
  a.run(`photos.LKBE={pics:[{url:'data:x'}]}; save();`);
  a.ctx.answer = false;
  assert.equal(await a.ctx.window.leaveAccount(async () => {}), false);
  assert.deepEqual(a.ctx.confirmed, ['leavePhotos']);
});

test('a failed sign-out keeps the account data', async () => {
  const server = new Server();
  const a = device(server);
  await a.signIn(ALICE);
  a.land('LKBE', '2026-10-01');
  await a.sync();
  await assert.rejects(a.ctx.window.leaveAccount(async () => { throw new Error('offline'); }));
  assert.ok([...a.store.keys()].some(k => k.startsWith('u:alice:')));
});
