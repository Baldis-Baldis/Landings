// Runs review.js (the rating form) on a small fake DOM: publishing in steps that are safe to repeat, the messages
// after a failure, and the draft that keeps the filled-in form. No innerHTML anywhere (the fake refuses it).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.className = ''; this.textContent = ''; this.attrs = {}; this.value = ''; }
  set innerHTML(_) { throw new Error('innerHTML is not allowed here'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  focus() {}
  all() { return [this, ...this.children.flatMap(c => (c instanceof Node ? c.all() : []))]; }
  find(pick) { return this.all().find(pick); }
  findAll(pick) { return this.all().filter(pick); }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function load({ confirmed = true } = {}) {
  const ctx = { console, setTimeout, confirm: () => confirmed, document: { createElement: tag => new Node(tag) }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'review.js'), 'utf8'), ctx);
  return ctx.window.reviewForm;
}
const t = k => (k === 'rvfWords' ? ['w1', 'w2', 'w3', 'w4', 'w5'] : k === 'landedOn' ? d => `landed ${d}` : k);

// ---------- publishing ----------
function server({ syncFails = null, shareFails = new Set(), landed = true } = {}) {
  const log = [];
  const pics = [{ id: 'p1', pub: false }, { id: 'p2', pub: true }, { pid: 'p3' }];
  const deps = {
    sync: async () => { log.push('sync'); if (syncFails) throw syncFails; },
    landed: () => landed,
    save: async r => { log.push(['save', r.rating, r.body]); },
    pics: () => pics,
    setShared: async (id, on) => {
      log.push(['share', id, on]);
      if (shareFails.has(id)) { shareFails.delete(id); throw new Error('down'); }
      pics.find(p => p.id === id).pub = on;
    },
  };
  return { deps, log, pics };
}
const VALUES = { rating: 4, facts: ['wc'], body: 'ok', share: { p1: true, p2: true } };

test('publishing syncs first, then saves, then changes only the photos that differ', async () => {
  const form = load();
  const { deps, log } = server();
  await form.publish(VALUES, deps);
  assert.deepEqual(JSON.parse(JSON.stringify(log)), ['sync', ['save', 4, 'ok'], ['share', 'p1', true]]);
});

test('a repeated publish after a failed share saves the same review again and redoes only the failed share', async () => {
  const form = load();
  const { deps, log } = server({ shareFails: new Set(['p1']) });
  const values = { ...VALUES, share: { p1: true, p2: false } };
  await assert.rejects(form.publish(values, deps), e => e.stage === 'share');
  log.length = 0;
  await form.publish(values, deps);
  assert.deepEqual(JSON.parse(JSON.stringify(log)), ['sync', ['save', 4, 'ok'], ['share', 'p1', true]], 'p2 was already unshared');
  log.length = 0;
  await form.publish(values, deps);
  assert.deepEqual(JSON.parse(JSON.stringify(log)), ['sync', ['save', 4, 'ok']], 'a third publish changes no photo');
});

test('a failed sync stops before saving, a failed photo upload does not', async () => {
  const form = load();
  const offline = server({ syncFails: new TypeError('Failed to fetch') });
  await assert.rejects(form.publish(VALUES, offline.deps), e => e.stage === 'sync');
  assert.deepEqual(offline.log, ['sync']);
  const photo = server({ syncFails: new Error('photo upload') });
  await form.publish({ ...VALUES, share: {} }, photo.deps);
  assert.equal(photo.log.length, 2);
});

test('no landing: nothing is saved', async () => {
  const form = load();
  const { deps, log } = server({ landed: false });
  await assert.rejects(form.publish(VALUES, deps), e => e.stage === 'landing');
  assert.deepEqual(log, ['sync']);
});

test('a photo still waiting for its upload cannot be shared yet and says so', async () => {
  const form = load();
  const { deps, log } = server();
  await assert.rejects(form.publish({ ...VALUES, share: { p3: true } }, deps), e => e.stage === 'share');
  assert.equal(log.some(x => Array.isArray(x) && x[0] === 'share'), false);
});

test('messages after a failure', () => {
  const { failureText } = load();
  const err = (m, extra = {}) => Object.assign(new Error(m), extra);
  assert.equal(failureText(err('share', { stage: 'share' }), t), 'rvfSharePartial');
  assert.equal(failureText(err('x', { stage: 'landing' }), t), 'rvfNoLanding');
  assert.equal(failureText(new TypeError('Failed to fetch'), t), 'rvfOffline');
  assert.equal(failureText({ message: 'TypeError: Failed to fetch' }, t), 'rvfOffline');
  assert.equal(failureText({ code: 'P0001', message: 'a nickname is required to review' }, t), 'rvfNick');
  assert.equal(failureText({ code: 'P0001', message: 'only a pilot who landed there can review it' }, t), 'rvfNoLanding');
  assert.equal(failureText({ code: '42501', message: 'permission denied' }, t), 'rvfFail');
});

// ---------- the form ----------
function make({ review = null, nickname = 'Me', draft = null, publish = async () => {}, confirmed = true } = {}) {
  const form = load({ confirmed });
  const calls = [];
  let stored = draft;
  const ctx = {
    t, name: 'Liberec', code: 'LKLB', landedOn: '12. 10. 2026', review,
    nickname: () => nickname, askNickname: () => calls.push('nick'),
    pics: () => [{ id: 'p1', pub: false, thumb: 'https://x/1' }, { id: 'p2', pub: true, thumb: 'https://x/2' }],
    maxPics: 3, icon: () => new Node('svg'),
    addPhotos: async () => ['p9'],
    draft: () => stored, saveDraft: v => { stored = JSON.parse(JSON.stringify(v)); }, clearDraft: () => { stored = null; calls.push('clear'); },
    publish: async v => { calls.push(['publish', JSON.parse(JSON.stringify(v))]); return publish(v); },
    remove: async () => calls.push('remove'),
    close: changed => calls.push(['close', changed]), onResize() {},
  };
  const node = form.build(ctx);
  const btn = label => node.find(n => n.tag === 'button' && n.textContent === label);
  return { node, calls, btn, draft: () => stored, stars: node.findAll(n => n.attrs.role === 'radio') };
}

test('publishing needs stars and a nickname; without a nickname the form offers to set one', () => {
  const none = make();
  assert.equal(none.btn('rvfPublish').disabled, true);
  none.stars[3].onclick();
  assert.equal(none.btn('rvfPublish').disabled, false);
  assert.equal(none.stars[3].getAttribute('aria-checked'), 'true');
  assert.equal(none.node.find(n => n.className === 'word').textContent, 'w4');
  const noNick = make({ nickname: null });
  noNick.stars[0].onclick();
  assert.equal(noNick.btn('rvfPublish').disabled, true);
  assert.equal(noNick.node.find(n => n.className === 'rvfnick').hidden, false);
  noNick.btn('rvfNickBtn').onclick();
  assert.deepEqual(noNick.calls, ['nick']);
});

test('every change is kept as a draft and a new form starts from it', () => {
  const first = make();
  first.stars[4].onclick();
  first.node.find(n => n.className === 'tile' && n.children[1].textContent === 'fact_fee').onclick();
  const text = first.node.find(n => n.tag === 'textarea');
  text.value = '<b>hi</b>';
  text.oninput();
  assert.deepEqual(first.draft(), { rating: 5, facts: ['fee'], body: '<b>hi</b>', share: {} });
  const again = make({ draft: first.draft() });
  assert.equal(again.node.find(n => n.tag === 'textarea').value, '<b>hi</b>', 'stays text in a field');
  assert.equal(again.stars[4].getAttribute('aria-checked'), 'true');
});

test('the share ticks start from the photos\' state and are remembered', () => {
  const f = make();
  const boxes = f.node.findAll(n => n.tag === 'input' && n.name === 'share');
  assert.deepEqual(boxes.map(b => b.checked), [false, true]);
  boxes[0].checked = true;
  boxes[0].onchange();
  assert.deepEqual(f.draft().share, { p1: true });
});

test('a failed publish keeps the form and the draft and says why; a good one clears the draft and closes', async () => {
  const bad = make({ publish: async () => { throw new TypeError('Failed to fetch'); } });
  bad.stars[2].onclick();
  await bad.btn('rvfPublish').onclick();
  await tick();
  const error = bad.node.find(n => n.className === 'err');
  assert.equal(error.hidden, false);
  assert.equal(error.textContent, 'rvfOffline');
  assert.equal(bad.calls.some(c => c === 'clear' || c[0] === 'close'), false);
  assert.equal(bad.draft().rating, 3);
  const good = make();
  good.stars[2].onclick();
  await good.btn('rvfPublish').onclick();
  await tick();
  assert.deepEqual(good.calls.slice(-2), ['clear', ['close', true]]);
});

test('cancel clears the draft; editing offers delete, which asks first', async () => {
  const c = make();
  c.btn('rvfCancel').onclick();
  assert.deepEqual(c.calls, ['clear', ['close', false]]);
  const review = { id: 'v1', rating: 2, facts: ['wc'], body: 'old' };
  const no = make({ review, confirmed: false });
  assert.ok(no.btn('rvfSave'));
  no.btn('rvfDelete').onclick();
  await tick();
  assert.deepEqual(no.calls, []);
  const yes = make({ review });
  assert.equal(yes.node.find(n => n.tag === 'textarea').value, 'old');
  yes.btn('rvfDelete').onclick();
  await tick(); await tick();
  assert.deepEqual(yes.calls, ['remove', 'clear', ['close', true]]);
});

test('a photo added in the form is meant for sharing', async () => {
  const f = make();
  const file = f.node.find(n => n.tag === 'input' && n.name === 'review-photo');
  file.files = [{}];
  await file.onchange();
  assert.equal(f.draft().share.p9, true);
});
