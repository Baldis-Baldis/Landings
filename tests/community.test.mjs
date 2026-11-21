// Runs community.js ("From pilots") on a small fake DOM. Text must stay text: the fake has no HTML parser and any
// use of innerHTML fails the test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

class Node {
  constructor(tag) {
    this.tag = tag; this.children = []; this.listeners = {}; this.className = ''; this.textContent = ''; this.attrs = {};
    this.style = { props: {}, setProperty: (k, v) => { this.style.props[k] = v; } };
  }
  set innerHTML(_) { throw new Error('innerHTML is not allowed here'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  all() { return [this, ...this.children.flatMap(c => (c instanceof Node ? c.all() : []))]; }
  find(pick) { return this.all().find(pick); }
  findAll(pick) { return this.all().filter(pick); }
  text() { return this.all().filter(n => !n.hidden).flatMap(n => [n.textContent, ...n.children.filter(c => typeof c === 'string')]).join(' '); }
}
const byClass = (box, name) => box.find(n => n.className.split(' ').includes(name));
const buttons = (box, label) => box.findAll(n => n.tag === 'button' && n.textContent === label);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const SUMMARY = { n: 2, avg: 4.5, facts: [{ key: 'wc', n: 2 }, { key: 'fee', n: 1 }], photos_n: 1 };
const ATTACK = '<img src=x onerror=alert(1)>';
const review = (id, extra = {}) => ({ id, own: false, author: 'Eva', rating: 4, facts: [], body: `text ${id}`,
  visited_on: '2026-09-01', created_at: '2026-10-01', moderation: 'visible', photos: [], ...extra });

function load({ signedIn = false, landed = null, mine = null, data = { reviews: [], photos: [] }, summary = SUMMARY,
  confirmed = true, backend = {}, code = `LK${Math.random().toString(36).slice(2, 6).toUpperCase()}` } = {}) {
  const calls = [];
  const ctx = {
    console, setTimeout,
    confirm: () => confirmed,
    document: { createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag) },
    window: {
      backend: {
        airfieldSummary: async c => { calls.push(['summary', c]); return summary; },
        airfieldReviews: async c => { calls.push(['reviews', c]); return data; },
        deleteReview: async id => { calls.push(['delete', id]); },
        report: async target => { calls.push(['report', target]); return 'ok'; },
        ...backend,
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'community.js'), 'utf8'), ctx);
  const opts = {
    t: k => (/^(nRatings|starsOf|rateLanded|landedOn|moreReviews)$/.test(k) ? v => `${k}(${v})` : k),
    lang: () => 'cs', fmtDate: d => `D${d}`, signedIn: () => signedIn, nickname: () => (signedIn ? 'Me' : null),
    landedOn: () => landed, myReview: () => mine, onResize() {}, openPhoto: (...a) => calls.push(['photo', ...a]),
    onRate: r => calls.push(['rate', r && r.id]), onChanged: () => calls.push(['changed']),
  };
  const make = () => ctx.window.community.section(code, opts);
  return { box: make(), make, calls, ctx };
}
const open = async box => {
  const details = byClass(box, 'pilbox');
  details.open = true;
  details.listeners.toggle();
  await tick(); await tick();
};

test('a card asks for the summary only; reviews and photos wait until the section opens', async () => {
  const { box, calls } = load();
  await tick();
  assert.deepEqual(calls.map(c => c[0]), ['summary']);
  assert.match(box.text(), /community/);
  assert.match(byClass(box, 'pilhead').text(), /4,5/);
  assert.equal(byClass(box, 'minifx').children.length, 2, 'one icon per facility');
  assert.equal(byClass(box, 'minifx').children[0].getAttribute('aria-label'), 'fact_wc');
  await open(box);
  assert.deepEqual(calls.map(c => c[0]), ['summary', 'reviews']);
});

test('a card redrawn right after asks for no second summary', async () => {
  const { make, calls } = load();
  await tick();
  make();
  await tick();
  assert.equal(calls.filter(c => c[0] === 'summary').length, 1);
});

test('an airfield without reviews says so', async () => {
  const { box } = load({ summary: { n: 0, avg: null, facts: [], photos_n: 0 } });
  await tick();
  assert.match(byClass(box, 'pilhead').text(), /noRatings/);
});

test('the strip: guest, no landing, landed, own review', async () => {
  const strip = o => byClass(load(o).box, 'pilbar');
  assert.match(strip({}).text(), /rateNeedAccount/);
  assert.match(strip({ signedIn: true }).text(), /rateNeedLanding/);
  const landed = load({ signedIn: true, landed: '2026-10-12' });
  assert.match(byClass(landed.box, 'pilbar').text(), /rateLanded\(D2026-10-12\)/);
  buttons(landed.box, 'rateBtn')[0].onclick();
  assert.deepEqual(landed.calls.at(-1), ['rate', null]);
  assert.match(strip({ signedIn: true, landed: '' }).text(), /rateLandedNoDate/);
  const mine = load({ signedIn: true, landed: '2026-10-12', mine: { id: 'v1', rating: 4 } });
  assert.match(byClass(mine.box, 'pilbar').text(), /yourRating/);
  buttons(mine.box, 'editBtn')[0].onclick();
  assert.deepEqual(mine.calls.at(-1), ['rate', 'v1']);
});

test('foreign text stays text, the own review comes first, reviews without text are left out', async () => {
  const data = { photos: [], reviews: [
    review('v2', { author: ATTACK, body: ATTACK }),
    review('v3', { body: '' }),
    review('v1', { own: true, author: 'Me', body: '', rating: 3 }),
  ] };
  const { box } = load({ signedIn: true, landed: '2026-10-12', data });
  await open(box);
  const items = box.findAll(n => n.className.split(' ').includes('rv'));
  assert.deepEqual(items.map(n => n.className), ['rv own', 'rv']);
  assert.ok(box.text().includes(ATTACK), 'shown as text');
  assert.equal(items[0].find(n => n.className === 'nick').textContent, 'commYou');
  assert.equal(items[1].find(n => n.className === 'nick').textContent, ATTACK);
  assert.match(items[1].text(), /landedOn\(D2026-09-01\)/);
});

test('report only for signed-in users and never on the own review', async () => {
  const data = { photos: [], reviews: [review('v1', { own: true }), review('v2')] };
  const guest = load({ data });
  await open(guest.box);
  assert.equal(guest.box.findAll(n => n.className === 'flagbtn').length, 0);
  const user = load({ signedIn: true, data });
  await open(user.box);
  const [own, other] = user.box.findAll(n => n.className.split(' ').includes('rv'));
  assert.equal(own.findAll(n => n.className === 'flagbtn').length, 0);
  const flag = other.find(n => n.className === 'flagbtn');
  assert.equal(flag.getAttribute('aria-label'), 'commReport');
  flag.onclick();
  const send = other.find(n => n.tag === 'button' && n.textContent === 'commReportSend');
  await send.onclick();
  assert.equal(user.calls.find(c => c[0] === 'report')[1].review_id, 'v2');
});

test('deleting the own review asks first and then tells the app', async () => {
  const data = { photos: [], reviews: [review('v1', { own: true })] };
  const no = load({ signedIn: true, data, confirmed: false });
  await open(no.box);
  await buttons(no.box, 'commDelete')[0].onclick();
  assert.equal(no.calls.some(c => c[0] === 'delete'), false);
  const yes = load({ signedIn: true, data });
  await open(yes.box);
  await buttons(yes.box, 'commDelete')[0].onclick();
  assert.deepEqual(yes.calls.slice(-2), [['delete', 'v1'], ['changed']]);
});

test('three reviews first, then ten more per tap', async () => {
  const data = { photos: [], reviews: Array.from({ length: 15 }, (_, i) => review(`v${i}`)) };
  const { box } = load({ data });
  await open(box);
  const count = () => box.findAll(n => n.className === 'rv').length;
  const more = byClass(box, 'showmore');
  assert.equal(count(), 3);
  assert.equal(more.textContent, 'moreReviews(10)');
  more.onclick();
  assert.equal(count(), 13);
  assert.equal(more.textContent, 'moreReviews(2)');
  more.onclick();
  assert.equal(count(), 15);
  assert.equal(more.hidden, true);
});

test('photos: four thumbnails, the last one says how many more, own ones say "you"', async () => {
  const photos = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, own: i === 1, author: 'Eva', url: `https://x/${i}`, thumb: `https://x/t${i}` }));
  const { box, calls } = load({ data: { reviews: [], photos } });
  await open(box);
  const gal = byClass(box, 'pilgal');
  assert.equal(gal.children.length, 4);
  assert.equal(gal.children[1].find(n => n.tag === 'figcaption').textContent, 'commYou');
  const more = gal.children[3].find(n => n.className === 'more');
  assert.equal(more.textContent, '+3');
  gal.children[0].find(n => n.tag === 'img').onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), ['photo', photos.map(p => p.url), 0]);
});

test('facilities in the opened section show how many pilots confirmed them', async () => {
  const { box } = load();
  await open(box);
  const grid = byClass(box, 'fxgrid');
  assert.deepEqual(grid.children.map(c => c.text().replace(/\s+/g, ' ').trim()), ['fact_wc ✓ 2', 'fact_fee ✓ 1']);
  assert.match(box.text(), /pilotsFoot/);
});

test('a failure while opening says so and the next opening tries again', async () => {
  let fail = true;
  const { box, calls } = load({ backend: { airfieldReviews: async () => { calls.push(['reviews']); if (fail) throw new Error('down'); return { reviews: [], photos: [] }; } } });
  await open(box);
  assert.match(byClass(box, 'pilbody').text(), /commFail/);
  fail = false;
  const details = byClass(box, 'pilbox');
  details.open = false; details.listeners.toggle();
  await open(box);
  assert.equal(calls.filter(c => c[0] === 'reviews').length, 2);
});
