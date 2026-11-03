// Runs community.js on a small fake DOM. Text must stay text: the fake has no HTML parser and any
// use of innerHTML fails the test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.className = ''; this.textContent = ''; }
  set innerHTML(_) { throw new Error('innerHTML is not allowed here'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  all() { return [this, ...this.children.flatMap(c => (c instanceof Node ? c.all() : []))]; }
  find(pick) { return this.all().find(pick); }
  text() { return this.all().flatMap(n => [n.textContent, ...n.children.filter(c => typeof c === 'string')]).join(' '); }
}

function load({ content, signedIn = false, confirmed = true, backend = {} }) {
  const calls = [];
  const spy = name => async (...args) => { calls.push([name, ...args]); };
  const ctx = {
    console,
    confirm: () => confirmed,
    document: { createElement: tag => new Node(tag) },
    window: {
      backend: {
        placeContent: async () => content,
        addComment: spy('add'), removeComment: spy('remove'), setCommentPublic: spy('share'), ...backend,
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'community.js'), 'utf8'), ctx);
  const box = ctx.window.community.section('LKBE', { t: k => k, signedIn: () => signedIn, onResize() {}, openPhoto() {} });
  return { box, calls };
}

const open = async box => {
  box.open = true;
  box.listeners.toggle();
  await new Promise(resolve => setTimeout(resolve, 0));
};

const EMPTY = { own: [], comments: [], photos: [] };
const ATTACK = '<img src=x onerror=alert(1)>';

test('nothing is requested until the section opens', async () => {
  let reads = 0;
  const { box } = load({ content: EMPTY, backend: { placeContent: async () => { reads += 1; return EMPTY; } } });
  assert.equal(reads, 0);
  await open(box);
  assert.equal(reads, 1);
});

test('foreign text stays text and shows the nickname', async () => {
  const content = { ...EMPTY, comments: [{ id: 'c', author: ATTACK, body: ATTACK, created_at: '2026-11-01T10:00:00Z' }] };
  const { box } = load({ content });
  await open(box);
  assert.ok(box.find(n => n.className === 'commtext').textContent === ATTACK);
  assert.ok(box.find(n => n.className === 'commmeta').textContent.startsWith(ATTACK));
  assert.equal(box.find(n => n.tag === 'img'), undefined, 'no element was created from the text');
});

test('a guest can read but gets no form', async () => {
  const { box } = load({ content: EMPTY });
  await open(box);
  assert.equal(box.find(n => n.tag === 'textarea'), undefined);
  assert.match(box.text(), /commSignIn/);
});

test('only https photo links reach an image', async () => {
  const content = { ...EMPTY, photos: [
    { id: 'a', author: 'Eva', url: 'javascript:alert(1)', thumb: 'javascript:alert(1)' },
    { id: 'b', author: 'Eva', url: 'https://x.test/f.jpg', thumb: 'https://x.test/t.jpg' },
  ] };
  const { box } = load({ content });
  await open(box);
  const images = box.all().filter(n => n.tag === 'img');
  assert.equal(images.length, 1);
  assert.equal(images[0].src, 'https://x.test/t.jpg');
});

const form = box => ({
  text: box.find(n => n.tag === 'textarea'),
  share: box.find(n => n.tag === 'input'),
  send: box.find(n => n.className === 'commbtn' && n.textContent === 'commSend'),
});

test('a comment is private unless the box is ticked', async () => {
  const { box, calls } = load({ content: EMPTY, signedIn: true });
  await open(box);
  const f = form(box);
  f.text.value = 'hi';
  await f.send.onclick();
  assert.equal(calls[0][0], 'add');
  assert.ok(!calls[0][1].is_public); // the backend turns it into a strict false, see its test
});

test('publishing needs a confirmation', async () => {
  const { box, calls } = load({ content: EMPTY, signedIn: true, confirmed: false });
  await open(box);
  const f = form(box);
  f.text.value = 'hi';
  f.share.checked = true;
  await f.send.onclick();
  assert.equal(calls.length, 0);
});

test('a limit from the database gets its own message', async () => {
  const refusal = Object.assign(new Error('limit'), { code: 'P0001' });
  const { box } = load({ content: EMPTY, signedIn: true, backend: { addComment: async () => { throw refusal; } } });
  await open(box);
  const f = form(box);
  f.text.value = 'hi';
  await f.send.onclick();
  assert.match(box.text(), /commLimit/);
});

test('signed-in users can report other people\'s content, guests cannot', async () => {
  const content = { ...EMPTY, comments: [{ id: 'c2', author: 'Eva', body: 'x', created_at: '' }],
    photos: [{ id: 'p2', author: 'Eva', url: 'https://x.test/f.jpg', thumb: 'https://x.test/t.jpg' }] };
  const guest = load({ content });
  await open(guest.box);
  assert.equal(guest.box.find(n => n.textContent === 'commReport'), undefined);

  const sent = [];
  const { box } = load({ content, signedIn: true, backend: { report: async r => { sent.push(r); return 'already'; } } });
  await open(box);
  const buttons = box.all().filter(n => n.textContent === 'commReport');
  assert.equal(buttons.length, 2, 'one for the photo, one for the comment');
  buttons[1].onclick();
  const select = box.find(n => n.tag === 'select');
  assert.deepEqual(select.children.map(o => o.value), ['spam', 'offensive', 'illegal', 'privacy', 'copyright', 'other']);
  select.value = 'offensive';
  await box.find(n => n.textContent === 'commReportSend').onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{ comment_id: 'c2', reason: 'offensive' }]); // the fake input has no value
  assert.match(box.text(), /commAlready/);
});
