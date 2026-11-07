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

test('the airport update still finds the Czech list', () => {
  assert.match(html, /const DATA = (\[.*?\]);/s);
  assert.match(readFileSync(join(root, 'update_airports.py'), 'utf8'), /os\.path\.join\(ROOT, "app\.js"\)/);
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
