// Guards the page against injected code: escaping of imported text and the Content-Security-Policy.
// Reads the files, no browser.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'index.html'), 'utf8');
const html = readFileSync(join(root, 'app.js'), 'utf8');
const esc =vm.runInNewContext(`(${html.match(/function esc\(s\)\{.*\}/)[0]})`);

test('esc neutralises every character that can leave a text or attribute context', () => {
  assert.equal(esc(`<a href="x" title='y'>&`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;');
});

test('esc survives values that are not text', () => {
  assert.equal(esc(undefined), '');
  assert.equal(esc(null), '');
  assert.equal(esc(0), '0');
  assert.equal(esc(1200), '1200');
  assert.equal(esc({}), '[object Object]');
});

test('dates and country codes reach HTML escaped', () => {
  assert.ok(!/\$\{v\.date\b(?!!==)/.test(html), 'raw v.date in a template');
  assert.ok(!/\$\{a\.cc\}/.test(html), 'raw a.cc in a template');
  assert.ok(!/\?t\('dateFmt'\)\(/.test(html), 'unescaped dateFmt output');
});

test('the CSP allows no inline or foreign code', () => {
  const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const rule = name => csp.split('; ').find(r => r.startsWith(`${name} `));
  assert.equal(rule('default-src'), "default-src 'none'");
  assert.equal(rule('script-src'), "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com");
  assert.ok(rule('connect-src').split(' ').includes('https://cloudflareinsights.com'), 'the beacon reports here');
  assert.equal(rule('base-uri'), "base-uri 'none'");
  assert.ok(!/unsafe-eval/.test(csp));
  assert.ok(page.indexOf('Content-Security-Policy') < page.indexOf('<link'), 'CSP must come before any resource');
});

test('the page has no inline scripts, handlers or foreign resources', () => {
  const tags = [...page.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
  assert.ok(tags.length >= 7);
  for (const tag of tags) assert.match(tag, /^<script src="[\w./-]+">$/);
  assert.ok(![...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].some(m => m[1].trim()), 'inline script');
  assert.ok(!/<[^>]+\son[a-z]+=/.test(page), 'inline handler');
  assert.ok(!/(src|href)="https?:/.test(page), 'foreign resource');
});

test('every local file the page loads exists', () => {
  const files = [...page.matchAll(/(?:src|href)="([\w./-]+)"/g)].map(m => m[1]);
  assert.ok(files.includes('app.js'));
  for (const file of files) assert.ok(existsSync(join(root, file)), file);
  const fonts = readFileSync(join(root, 'vendor/fonts/fonts.css'), 'utf8');
  assert.equal((fonts.match(/@font-face/g) || []).length, (fonts.match(/unicode-range/g) || []).length);
  for (const [, file] of fonts.matchAll(/url\(([\w.-]+)\)/g)) assert.ok(existsSync(join(root, 'vendor/fonts', file)), file);
});

test('the Czech list lives in its country file, not in the app', () => {
  assert.ok(!/const DATA\b/.test(html));
  const cz = JSON.parse(readFileSync(join(root, 'data/countries/CZ.json'), 'utf8'));
  assert.equal(cz.airports.length, 165);
  for (const a of cz.airports) { assert.equal(a.cc, 'CZ'); assert.match(a.code, /^LK[A-Z0-9]{2,4}$/); }
  assert.match(cz.source, /VFR/);
});

test('a guest downloads nothing and the GitHub sync is gone', () => {
  assert.match(html, /if\(!account\)\{ setSync\('',syncLabel\(\)\); return; \}/);
  for (const gone of ['api.github.com', 'ghToken', 'ghUpload', 'data/landings.json', 'id="gh"']) {
    assert.ok(!html.includes(gone) && !page.includes(gone), gone);
  }
  const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(!/github/.test(csp), 'no GitHub host in the CSP');
});

test('a token left by the old GitHub sync is removed on start', () => {
  const removed = [];
  const line = html.match(/try\{ localStorage\.removeItem\('gh-token'\); \}catch\(e\)\{\}/);
  assert.ok(line, 'the removal is in app.js');
  vm.runInNewContext(line[0], { localStorage: { removeItem: k => removed.push(k) } });
  assert.deepEqual(removed, ['gh-token']);
  assert.ok(html.indexOf(line[0]) < html.indexOf('applyLang();\n'), 'before the app starts');
});

// Checked in headless Edge: without this, Leaflet takes a click on a swapped button for a map click
// and closes the card, so the report form never shows.
test('clicks in the shared section never reach the map', () => {
  assert.match(html, /const sec=window\.community\.section\([\s\S]{0,400}?sec\.addEventListener\('click',e=>e\.stopPropagation\(\)\)/);
});

test('every form field has a name', () => {
  const fields = [...`${page}\n${html}`.matchAll(/<(input|select|textarea)\b[^>]*>/g)].map(m => m[0]);
  assert.ok(fields.length >= 10);
  for (const f of fields) assert.match(f, /\s(name|id)="/, f);
  const community = readFileSync(join(root, 'community.js'), 'utf8');
  assert.equal((community.match(/el\('(input|select|textarea)'/g) || []).length, (community.match(/\.name = '/g) || []).length);
});


test('the about page has no code, both languages, the mail link and the current version', () => {
  const doc = readFileSync(join(root, 'about.html'), 'utf8');
  assert.ok(!/<script\b/.test(doc), 'no scripts');
  assert.match(doc, /http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">/);
  assert.ok(!/(src|href)="https?:/.test(doc), 'nothing from other hosts');
  assert.match(doc, /<div id="cs" lang="cs">/);
  assert.match(doc, /<div id="en" lang="en">/);
  assert.match(doc, /<a href="#cs">Česky<\/a> · <a href="#en">English<\/a>/);
  assert.equal((doc.match(/<a href="mailto:support@mylandings\.net">support@mylandings\.net<\/a>/g) || []).length, 2);
  // the version is written by hand: it must follow the service worker
  const sw = readFileSync(join(root, 'sw.js'), 'utf8').match(/const C='([^']+)'/)[1];
  assert.match(doc, new RegExp('<span id="appver">' + sw + '</span>'), 'about.html shows the current version');
  assert.match(doc, /© 2026 MyLandings/);
  assert.match(doc, /href="privacy\.html"/);
  assert.match(doc, /href="terms\.html"/);
  assert.match(doc.match(/<title>([^<]*)<\/title>/)[1], /MyLandings/);
  // linked from the menu and from the footer next to privacy and terms
  const footer = page.match(/<footer>([\s\S]*?)<div id="menu"/)[1];
  assert.match(footer, /<a href="about\.html"[^>]*>O aplikaci<\/a> · <a href="privacy\.html"/);
  assert.match(page.match(/<div id="menu"[\s\S]*?<\/footer>/)[0], /<a href="about\.html"/);
  assert.match(readFileSync(join(root, 'sw.js'), 'utf8'), /'\.\/about\.html'/);
});

test('the legal pages exist, carry no code and are linked from the app', () => {
  for (const file of ['privacy.html', 'terms.html']) {
    const doc = readFileSync(join(root, file), 'utf8');
    assert.ok(!/<script\b/.test(doc), `${file}: no scripts`);
    assert.match(doc, /http-equiv="Content-Security-Policy" content="default-src 'none';/);
    assert.ok(!/(src|href)="http:/.test(doc));
    assert.match(doc, /id="en"/, `${file}: English part`);
    assert.match(doc, /Verze \d{4}-\d{2}-\d{2}, účinná od/);
    assert.match(page, new RegExp(`href="${file}"`), `${file} linked from the app`);
  }
  const auth = readFileSync(join(root, 'auth.js'), 'utf8');
  assert.match(auth, /TERMS_VERSION = '2026-11-02'/, 'the app asks for the version the pages show');
});

test('local servers get the Turnstile test key, the site gets the real one', () => {
  const config = readFileSync(join(root, 'config.js'), 'utf8');
  const keyOn = hostname => {
    const ctx = { location: { hostname } };
    ctx.window = ctx;
    vm.runInNewContext(config, ctx);
    return ctx.MYLANDINGS_CONFIG.turnstileSiteKey;
  };
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(keyOn(host), '1x00000000000000000000AA', host);
  for (const host of ['mylandings.net', 'www.mylandings.net', 'localhost.example.com']) {
    assert.match(keyOn(host), /^0x4/, host);
  }
});

test('the analytics beacon loads on mylandings.net only and never on the admin page', () => {
  const source = readFileSync(join(root, 'analytics.js'), 'utf8');
  const loaded = (hostname, keys = [], search = '') => {
    const added = [];
    const ctx = {
      URLSearchParams,
      localStorage: Object.fromEntries(keys.map(k => [k, '{}'])),
      location: { hostname, search },
      document: {
        createElement: tag => ({ tag, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }),
        head: { append: node => added.push(node) },
      },
    };
    ctx.window = ctx;
    vm.runInNewContext(source, ctx);
    return added;
  };
  const [beacon] = loaded('mylandings.net');
  assert.equal(beacon.src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.deepEqual(JSON.parse(beacon.attrs['data-cf-beacon']), { token: 'e4c16690ec62451891e27a22d445c8d4' });
  for (const host of ['localhost', '127.0.0.1', 'www.mylandings.net', 'mylandings.net.evil.test']) {
    assert.equal(loaded(host).length, 0, host);
  }
  // guests only: a session or a sign-in return keeps the foreign script out of the page
  assert.equal(loaded('mylandings.net', ['sb-bgxzlirvbuxjjawqkkyw-auth-token']).length, 0, 'signed in');
  assert.equal(loaded('mylandings.net', ['sb-bgxzlirvbuxjjawqkkyw-auth-token-code-verifier']).length, 0, 'sign-in started');
  assert.equal(loaded('mylandings.net', [], '?code=one-time').length, 0, 'return with a code');
  assert.equal(loaded('mylandings.net', ['lang', 'visited-cz-airfields']).length, 1, 'guest data is fine');
  assert.match(page, /<script src="analytics\.js"><\/script>/);
  const admin = readFileSync(join(root, 'admin.html'), 'utf8');
  assert.ok(!/analytics|cloudflareinsights/.test(admin), 'admin page has no analytics');
  const privacy = readFileSync(join(root, 'privacy.html'), 'utf8');
  assert.equal((privacy.match(/Cloudflare Web Analytics/g) || []).length >= 2, true, 'named in Czech and English');
});

test('the brand and the legal links are in the plain HTML, for Google OAuth review', () => {
  assert.match(page.match(/<title>([^<]*)<\/title>/)[1], /MyLandings/);
  const footer = page.match(/<footer>([\s\S]*?)<div id="menu"/)[1];
  assert.match(footer, /<a href="privacy\.html"[^>]*>[^<]+<\/a>/, 'privacy link outside the menu, with text');
  assert.match(footer, /<a href="terms\.html"[^>]*>[^<]+<\/a>/, 'terms link outside the menu, with text');
  assert.match(page, /© 2026 MyLandings/);
  for (const file of ['privacy.html', 'terms.html']) {
    const doc = readFileSync(join(root, file), 'utf8');
    assert.match(doc.match(/<title>([^<]*)<\/title>/)[1], /MyLandings/, `${file} title`);
    assert.match(doc.match(/<h1>([^<]*)<\/h1>/)[1], /MyLandings/, `${file} heading`);
  }
});

test('the terms say who owns the app and what licence users give for their content', () => {
  const terms = readFileSync(join(root, 'terms.html'), 'utf8');
  assert.match(terms, /patří\s+provozovateli/);
  assert.match(terms, /nevýhradní licenci/);
  assert.match(terms, /Licence skončí smazáním obsahu nebo účtu/);
  assert.match(terms, /belong to the\s+operator/);
  assert.match(terms, /non-exclusive licence/);
  assert.match(terms, /The licence ends when you delete the content or the account/);
});

// --- country picker ---
const countriesSrc = readFileSync(join(root, 'countries.js'), 'utf8');
const C = vm.runInNewContext(countriesSrc + ';({COUNTRIES,COUNTRY_PICKS,COUNTRY_REGIONS,COUNTRY_NEIGHBOURS,countryOfCode,guessHome})');

test('country data come only from whitelisted codes', () => {
  assert.match(html, /const CCS=Object\.keys\(COUNTRIES\)\.filter\(c=>COUNTRIES\[c\]\.live\)/);
  assert.match(html, /if\(!CCS\.includes\(c\)\) return Promise\.reject\(new Error\('unknown country'\)\);\s*if\(!ccLoading\[c\]\) ccLoading\[c\]=fetch\('data\/countries\/'\+c\+'\.json'\)/);
  assert.deepEqual(html.match(/fetch\('data\/[^)]*\)/g), ["fetch('data/countries/'+c+'.json')", "fetch('data/countries/index.json')"], 'country file and index are the only data URLs');
  // a stored selection keeps only whitelisted codes, in whitelist order, with CZ first
  assert.match(html, /storedSel=CCS\.filter\(c=>x\.includes\(c\)\)/);
  assert.match(html, /const h=localStorage\.getItem\(HOMEKEY\); if\(CCS\.includes\(h\)\) home=h;/);
  for (const c of Object.keys(C.COUNTRIES)) assert.match(c, /^[A-Z]{2}$/);
  for (const list of Object.values(C.COUNTRY_PICKS)) for (const c of list || []) assert.ok(C.COUNTRIES[c], c);
  for (const c of Object.values(C.COUNTRIES)) assert.ok(C.COUNTRY_REGIONS.includes(c.r));
});

test('the country panel never writes markup from names, search text or data', () => {
  const start = html.indexOf('// --- country picker'), end = html.indexOf('function style(a)');
  const picker = html.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(picker), 'textContent only');
  assert.match(picker, /ccQ\.oninput=renderCCList/);
});

test('the country of a code comes from its prefix or the index, never from odd input', () => {
  assert.equal(C.countryOfCode('LZIB'), 'SK');
  assert.equal(C.countryOfCode('EDDM'), 'DE');
  assert.equal(C.countryOfCode('ETSI'), 'DE');
  assert.equal(C.countryOfCode('AT-0009'), 'AT');
  assert.equal(C.countryOfCode('CZ-0052', { 'CZ-0052': 'SK' }), 'SK');
  assert.equal(C.countryOfCode('ETT1'), 'DE', 'national code on an ICAO prefix');
  assert.equal(C.countryOfCode('LKCDUB'), 'CZ');
  assert.equal(C.countryOfCode('XX-0001'), '', 'not a known country');
  assert.equal(C.countryOfCode('LZIB', { LZIB: 'ZZ' }), 'SK', 'an exception must name a known country');
  assert.equal(C.countryOfCode('__proto__', {}), '');
  assert.equal(C.countryOfCode(undefined), '');
});

test('the page loads the country list before the app and the worker keeps it offline', () => {
  assert.ok(page.indexOf('<script src="countries.js">') > 0 && page.indexOf('<script src="countries.js">') < page.indexOf('<script src="app.js">'));
  assert.match(readFileSync(join(root, 'sw.js'), 'utf8'), /'\.\/countries\.js'/);
  assert.ok(!/airports-eu\.json|airport-info\.json/.test(html), 'the old combined files are no longer used');
});

test('every country has its land neighbours, both ways, and only from the list', () => {
  assert.deepEqual(Object.keys(C.COUNTRY_NEIGHBOURS).sort(), Object.keys(C.COUNTRIES).sort());
  for (const [c, list] of Object.entries(C.COUNTRY_NEIGHBOURS)) for (const n of list) {
    assert.ok(C.COUNTRIES[n], c + ' -> ' + n);
    assert.ok(C.COUNTRY_NEIGHBOURS[n].includes(c), n + ' should list ' + c);
  }
  assert.deepEqual([...C.COUNTRY_NEIGHBOURS.CZ].sort(), ['AT', 'DE', 'PL', 'SK']);
});

test('the home country comes from the browser language, never a guess for plain English', () => {
  const live = ['CZ', 'SK', 'AT', 'DE', 'PL'];
  assert.equal(C.guessHome(['cs-CZ', 'cs'], live), 'CZ');
  assert.equal(C.guessHome(['de-DE', 'de'], live), 'DE');
  assert.equal(C.guessHome(['de-AT'], live), 'AT');
  assert.equal(C.guessHome(['de-CH'], live), '', 'a Swiss German is not sent to Germany');
  assert.equal(C.guessHome(['en-US', 'en'], live), '');
  assert.equal(C.guessHome(['en-GB'], live), '', 'GB has no data yet');
  assert.equal(C.guessHome(['fr-FR', 'sk'], live), 'SK', 'the first usable language wins');
  assert.equal(C.guessHome(undefined, live), '');
  assert.equal(C.guessHome([42, null, ''], live), '');
});

test('the home country: own choice, stored selection, landings, language, else Czechia shown with a hint', () => {
  const start = html.indexOf('let home='), end = html.indexOf('let selCC=');
  const order = html.slice(start, end);
  const at = (x) => { const i = order.indexOf(x); assert.ok(i >= 0, x); return i; };
  assert.ok(at('localStorage.getItem(HOMEKEY)') < at('x[0]'));
  assert.ok(at('x[0]') < at('topLandedCountry()'));
  assert.ok(at('topLandedCountry()') < at('guessHome('));
  assert.ok(at('guessHome(') < at('homeKnown=false'));
  // a selection saved while the home country was only assumed does not count as a choice
  assert.match(order, /if\(!home&&!assumed&&CCS\.includes\(x\[0\]\)\) home=x\[0\];/);
  assert.match(html, /if\(!homeKnown\) localStorage\.setItem\(ASSUMEDKEY,'1'\);/);
  assert.match(html, /localStorage\.setItem\(HOMEKEY,c\); localStorage\.removeItem\(ASSUMEDKEY\);/);
  // only a real choice is stored
  assert.equal((html.match(/localStorage\.setItem\(HOMEKEY/g) || []).length, 1);
  assert.match(html, /function setHome\(c\)\{\s*if\(!CCS\.includes\(c\)\) return;/);
  assert.match(html, /homeHint\.hidden=homeKnown\|\|closed;/);
  assert.ok(!/geolocation/.test(html), 'no location');
});

test('the last selected country cannot be switched off', () => {
  assert.match(html, /i\.disabled=i\.checked&&selCC\.length===1;/);
  assert.match(html, /if\(!selCC\.length\) selCC=\[c\];/);
  assert.match(html, /none\.onclick=\(\)=>\{ selCC=\[home\];/);
});

// --- airfield card as a sheet on narrow screens ---
test('every card opening goes through openCard, the popup toggle is taken off', () => {
  assert.equal((html.match(/\.openPopup\(\)/g) || []).length, 1, 'only popupOn opens a popup');
  assert.equal((html.match(/\.bindPopup\(/g) || []).length, 1);
  assert.match(html, /m\.bindPopup\([^\n]*\); m\.off\('click',m\._openPopup,m\);/);
  assert.match(html, /m\.on\('click',\(\)=>openCard\(a\)\);/);
  assert.ok(!/refreshMarkerPopup/.test(html));
  assert.match(html, /bubblingMouseEvents:false/, 'a tap on a marker must not reach the map and close the sheet');
});

test('the sheet uses the layout breakpoint, the back gesture, Esc and returns the focus', () => {
  assert.match(html, /window\.matchMedia\('\(max-width: 899px\)'\)/);
  assert.match(page, /@media \(min-width:900px\)/, 'the same breakpoint as the stacked layout');
  assert.match(html, /history\.pushState\(\{card:1\},''\)/);
  assert.match(html, /window\.addEventListener\('popstate',\(\)=>\{ if\(sheetOpen\)\{ sheetPushed=false; closeSheet\(true\); \} \}\);/);
  assert.match(html, /if\(sheetPushed&&!fromHistory\)\{ sheetPushed=false; history\.back\(\); \}/, 'closing by hand takes the history entry back');
  assert.match(html, /e\.key==='Escape'&&sheetOpen&&!lb\.classList\.contains\('on'\)/);
  assert.match(html, /sheet\.querySelector\('#cstitle'\)\.focus\(\{preventScroll:true\}\)/);
  assert.match(html, /back\.focus\(\{preventScroll:true\}\)/);
});

test('the sheet markup: dialog, title, close button, map credit, safe area, hidden controls', () => {
  assert.match(page, /<div id="cardsheet" class="cardsheet" hidden role="dialog" aria-labelledby="cstitle">/);
  assert.match(page, /<h2 id="cstitle" tabindex="-1"><\/h2>/);
  assert.match(page, /<button type="button" class="csx"/);
  assert.match(page, /\.csattr\{[^}]*env\(safe-area-inset-bottom\)/);
  assert.match(page, /body\.cardopen \.ccbar,body\.cardopen \.homehint,body\.cardopen \.leaflet-control-attribution\{visibility:hidden\}/);
  assert.match(html, /sheet\.querySelector\('\.csattr'\)\.textContent=/, 'the map credit stays visible in the sheet');
  // texts in the sheet header go in as text
  assert.match(html, /sheet\.querySelector\('#cstitle'\)\.textContent=a\.name;/);
  assert.match(html, /sheet\.querySelector\('\.csmeta'\)\.textContent=cardMeta\(a\);/);
});
