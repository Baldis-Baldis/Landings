// Catches template placeholders that end up as text, like "${WANT_ICON}" shown in the list on an iPhone.
// 1) scans every script for "${" inside a plain '…' or "…" string (also nested inside a template),
// 2) runs app.js with a stub DOM and Leaflet and renders a list row, the card and the legend for an airfield
//    with every mark (landed, favourite, want to visit, photo).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = ['app.js', 'auth.js', 'community.js', 'backend.js', 'sync.js', 'admin.js', 'countries.js', 'analytics.js', 'config.js', 'sw.js'];

// A small JavaScript scanner: strings, templates with nested expressions, comments and regex literals.
export function placeholdersInPlainStrings(src) {
  const found = []; let i = 0, line = 1;
  const stack = []; // open template expressions: depth of braces inside each
  let prev = ''; // last significant character, to tell a regex from a division
  const regexCanFollow = c => c === '' || '(,=:[!&|?{};+-*%<>~^'.includes(c);
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); for (let k = i; k < e; k++) if (src[k] === '\n') line++; i = e + 2; continue; }
    if (c === "'" || c === '"') {
      const start = line; let j = i + 1, text = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { text += src[j] + src[j + 1]; j += 2; continue; } if (src[j] === '\n') line++; text += src[j]; j++; }
      if (text.includes('${')) found.push({ line: start, text: text.slice(0, 80) });
      i = j + 1; prev = 'a'; continue;
    }
    if (c === '`') { i = scanTemplate(i + 1); prev = 'a'; continue; }
    if (c === '/' && regexCanFollow(prev)) {
      let j = i + 1, cls = false;
      while (j < src.length && (cls || src[j] !== '/')) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; if (src[j] === '\n') break; j++; }
      i = j + 1; while (/[a-z]/.test(src[i] || '')) i++; prev = 'a'; continue;
    }
    if (c === '{' && stack.length) stack[stack.length - 1]++;
    if (c === '}' && stack.length) { if (stack[stack.length - 1] === 0) { stack.pop(); i = scanTemplate(i + 1); prev = 'a'; continue; } stack[stack.length - 1]--; }
    if (!/\s/.test(c)) prev = /[A-Za-z0-9_$)\]]/.test(c) ? 'a' : c;
    // a keyword before a slash means a regex (return /x/)
    if (/[a-z]/.test(c)) { const m = /^(return|typeof|case|in|of|void|delete|new)\b/.exec(src.slice(i)); if (m && !/[A-Za-z0-9_$]/.test(src[i - 1] || '')) { i += m[0].length; prev = ''; continue; } }
    i++;
  }
  return found;
  function scanTemplate(j) {
    while (j < src.length) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '\n') line++;
      if (src[j] === '`') return j + 1;
      if (src[j] === '$' && src[j + 1] === '{') { stack.push(0); prev = ''; return j + 2; }
      j++;
    }
    return j;
  }
}

test('the scanner itself finds a placeholder in a quoted string inside a template', () => {
  assert.equal(placeholdersInPlainStrings("const a=`x${ok?'<b>${ICON}</b>':''}`;").length, 1);
  assert.equal(placeholdersInPlainStrings("const a=`x${ok?'<b>'+ICON+'</b>':''}${`${y}`}`;").length, 0);
  assert.equal(placeholdersInPlainStrings("const r=/\\${x}/g; // '${c}'\nconst s='plain';").length, 0);
  assert.equal(placeholdersInPlainStrings('const s="cost ${price}";').length, 1);
});

test('no script has "${" inside a plain string', () => {
  for (const file of SCRIPTS) {
    const hits = placeholdersInPlainStrings(readFileSync(join(root, file), 'utf8'));
    assert.deepEqual(hits, [], `${file}: ${JSON.stringify(hits)}`);
  }
});

// --- render with a stub DOM ---
function boot() {
  const html = [];
  const any = () => new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : any()),
    apply: () => any(), construct: () => any(), set: () => true,
  });
  const element = tag => {
    const own = { tagName: String(tag).toUpperCase(), children: [], style: { setProperty() {}, removeProperty() {} }, dataset: {}, hidden: false, value: '', textContent: '', className: '',
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); }, prepend() {}, remove() {},
      querySelector: () => element('div'), querySelectorAll: () => [], getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      contains: () => true, closest: () => null, focus() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {}, removeEventListener() {} };
    let inner = '';
    Object.defineProperty(own, 'innerHTML', { get: () => inner, set: v => { inner = String(v); html.push(inner); } });
    return new Proxy(own, { get: (t, k) => (k in t ? t[k] : any()), set: (t, k, v) => { t[k] = v; return true; } });
  };
  const byId = {};
  const store = new Map([['lang', 'cs']]);
  const ctx = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, URLSearchParams, Blob: function () {}, Date, JSON, Math,
    navigator: { language: 'cs', languages: ['cs'] },
    location: { hostname: 'localhost', protocol: 'file:', search: '', pathname: '/', hash: '' },
    history: { pushState() {}, back() {}, state: null },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, length: 0 },
    fetch: () => new Promise(() => {}), getComputedStyle: () => ({ getPropertyValue: () => '' }), innerHeight: 800, innerWidth: 375,
    addEventListener() {}, confirm: () => true, L: any(),
    document: { documentElement: element('html'), body: element('body'), activeElement: null,
      getElementById: id => (byId[id] ||= element('div')), createElement: element, createDocumentFragment: () => element('fragment'),
      querySelector: () => element('div'), querySelectorAll: () => [], addEventListener() {} },
    community: { section: () => element('section') },
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'countries.js'), 'utf8'), ctx);
  vm.runInContext(readFileSync(join(root, 'app.js'), 'utf8'), ctx);
  return { ctx, html, run: code => vm.runInContext(code, ctx) };
}

test('a list row and the card with every mark show icons, never a raw "${"', () => {
  const { html, run } = boot();
  const cz = JSON.parse(readFileSync(join(root, 'data/countries/CZ.json'), 'utf8')).airports;
  run(`ccData.CZ=${JSON.stringify(cz.slice(0, 3))}; selCC=['CZ'];
    const a=ccData.CZ[0];
    visited[a.code]={date:'2026-09-10',note:'Poznámka'};
    flags[a.code]={fav:true,want:true};
    photos[a.code]={pics:[{url:'data:image/jpeg;base64,AA==',thumb:'data:image/jpeg;base64,AA=='}]};
    render(); globalThis.__card=popup(a); globalThis.__code=a.code;`);
  const out = html.join('\n');
  const row = html.find(h => h.includes('name="visited"') && h.includes('ic want'));
  assert.ok(row, 'the row of the marked airfield was rendered');
  assert.ok(row.includes('class="wantic"'), 'the want icon is an svg');
  assert.ok(row.includes('ic fav'), 'the favourite star');
  const card = html.find(h => h.includes('class="flag want'));
  assert.ok(card && card.includes('class="wantic"'), 'the card button has the icon');
  assert.ok(card.includes('class="gal"'), 'the photo is in the card');
  assert.ok(!out.includes('${'), 'raw placeholder in the output: ' + (out.match(/.{30}\$\{.{20}/) || [''])[0]);
});

test('the legend in the page has the pins, never a raw "${"', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  const legend = page.match(/<div class="legend">[\s\S]*?<\/div>/)[0];
  assert.ok(legend.includes('url(#pinWant)') && legend.includes('url(#pinG)') && legend.includes('url(#pinGold)'));
  assert.ok(!page.includes('${'), 'raw placeholder in index.html');
  for (const f of ['about.html', 'privacy.html', 'terms.html', 'admin.html']) assert.ok(!readFileSync(join(root, f), 'utf8').includes('${'), f);
});
