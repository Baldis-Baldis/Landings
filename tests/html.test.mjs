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
  assert.equal(rule('script-src'), "script-src 'self' https://challenges.cloudflare.com");
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

test('a guest downloads nothing and an account never uses GitHub', () => {
  assert.match(html, /if\(!account&&!ghToken\(\)\)\{ setSync\('',syncLabel\(\)\); return; \}/);
  assert.match(html, /function ghToken\(\)\{ return account\?''/);
  assert.ok(html.indexOf('if(!account&&!ghToken()){ setSync') < html.indexOf('await ghGetState()'));
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

test('only photo paths can reach the GitHub delete call', () => {
  const guard = new RegExp(html.match(/!\/(\^photos.*?\$)\/\.test\(a\.photoPath/)[1]);
  assert.ok(guard.test('photos/kunovice-mvmbfr12.jpg'));
  for (const path of ['index.html', 'photos/../index.html', 'photos/a.jpg?x', 'data/landings.json', '.github/workflows/x.yml', 'photos/a/b.jpg']) {
    assert.equal(guard.test(path), false, path);
  }
});

test('the legal pages exist, carry no code and are linked from the app', () => {
  for (const file of ['privacy.html', 'terms.html']) {
    const doc = readFileSync(join(root, file), 'utf8');
    assert.ok(!/<script\b/.test(doc), `${file}: no scripts`);
    assert.match(doc, /http-equiv="Content-Security-Policy" content="default-src 'none';/);
    assert.ok(!/(src|href)="http:/.test(doc));
    assert.match(doc, /id="en"/, `${file}: English part`);
    assert.match(doc, /Verze 2026-11-02/);
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
