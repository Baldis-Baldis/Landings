// The airfield registry: a code is a permanent ID, never changed, never removed, never given to another airfield.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { pairCodes, buildRegistry, stringifyRegistry, checkRegistry, OVERRIDES } from '../tools/build-registry.mjs';
import { loadCountries } from '../tools/update-airports.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const text = readFileSync(join(ROOT, 'data', 'registry.json'), 'utf8');
const registry = JSON.parse(text);
const frozen = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'codes-frozen.json'), 'utf8'));
const dir = join(ROOT, 'data', 'countries');
const files = Object.fromEntries(readdirSync(dir).filter(f => /^[A-Z]{2}\.json$/.test(f))
  .map(f => [f.slice(0, 2), JSON.parse(readFileSync(join(dir, f), 'utf8')).airports]));
const { COUNTRIES } = loadCountries(ROOT);

test('every code that ever was in the registry stays there for good', () => {
  assert.ok(frozen.length >= 6593);
  for (const code of frozen) assert.ok(registry.airfields[code], `${code} left the registry`);
});

test('every published airfield is in the registry, under its own country', () => {
  for (const [cc, list] of Object.entries(files)) for (const a of list) {
    const r = registry.airfields[a.code];
    assert.ok(r, `${a.code} is not in the registry`);
    assert.equal(r.cc, cc, a.code);
  }
});

test('registry records have the agreed shape, one OurAirports row at most once', () => {
  assert.equal(registry.v, 1);
  const seen = new Map();
  for (const [code, r] of Object.entries(registry.airfields)) {
    assert.match(code, /^[A-Z0-9-]{3,12}$/);
    assert.deepEqual(Object.keys(r), ['cc', 'status', 'added', 'oa_id', 'oa_ident', 'icao', 'vfr', 'missing_since'], code);
    assert.ok(COUNTRIES[r.cc], code);
    assert.ok(['active', 'closed'].includes(r.status), code);
    assert.match(r.added, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.missing_since === null || /^\d{4}-\d{2}-\d{2}$/.test(r.missing_since), code);
    if (r.oa_id !== null) {
      assert.ok(Number.isInteger(r.oa_id) && r.oa_id > 0, code);
      assert.ok(!seen.has(r.oa_id), `${code} and ${seen.get(r.oa_id)} share oa_id ${r.oa_id}`);
      seen.set(r.oa_id, code);
    } else assert.equal(r.cc, 'CZ', `${code}: only a VFR-manual strip may be without OurAirports`);
    assert.equal(r.vfr, r.cc === 'CZ' ? code : '', code);
  }
  assert.equal(checkRegistry(registry, files).length, 0);
});

test('the pairs decided by hand are in the registry as agreed', () => {
  const r = registry.airfields;
  assert.equal(r.LKNABO.oa_id, 328779);
  assert.equal(r.LKSPAK.oa_id, 321499);
  assert.equal(r.LKZAHO.oa_id, 317839);
  assert.equal(r.LKNEPL.oa_id, null, 'not in OurAirports, the VFR manual is its source');
  assert.equal(r.LKNEPL.missing_since, null);
  assert.equal(r.BISA.oa_id, 602622, 'BISA is the official code of Sauðárflugvöllur');
  assert.equal(r.BISA.icao, 'BISA');
  assert.equal(r.LEPZ.oa_id, 610895, 'LEPZ stays at Pozo-Cañada, which holds the ICAO code');
  assert.equal(r['GB-1002'].missing_since, registry.generated, 'closed in OurAirports counts as gone');
  assert.deepEqual(Object.keys(OVERRIDES).sort(), ['BISA', 'LKNABO', 'LKNEPL', 'LKSPAK', 'LKZAHO']);
});

test('the registry file has one airfield per line, so a monthly change is a few changed lines', () => {
  const lines = text.trimEnd().split('\n');
  assert.equal(lines.length, Object.keys(registry.airfields).length + 2);
  assert.equal(stringifyRegistry(registry), text.replace(/\r\n/g, '\n'));
});

test('pairing: the rule that made the code, VFR codes in Czechia, overrides, problems reported', () => {
  const row = o => ({ id: '1', ident: '', icao_code: '', gps_code: '', local_code: '', type: 'small_airport', iso_country: 'SK', name: 'X', ...o });
  const airports = [
    row({ id: '10', ident: 'LZIB', icao_code: 'LZIB' }),
    row({ id: '11', ident: 'SK-0001' }),
    row({ id: '12', ident: 'SK-0002', gps_code: 'LZXX' }),
    row({ id: '20', ident: 'CZ-0001', local_code: 'LKAAAA', iso_country: 'CZ' }),
    row({ id: '21', ident: 'GB-0001', iso_country: 'GB', type: 'closed' }),
  ];
  const fls = { SK: [{ code: 'LZIB' }, { code: 'SK-0001' }, { code: 'LZXX' }, { code: 'SK-0099' }], CZ: [{ code: 'LKAAAA' }, { code: 'LKBBBB' }], GB: [{ code: 'GB-0001' }] };
  const { pairs, problems } = pairCodes({ airports, files: fls, COUNTRIES, overrides: {} });
  const oa = c => (pairs.find(p => p.code === c).row || {}).id;
  assert.equal(oa('LZIB'), '10');
  assert.equal(oa('SK-0001'), '11');
  assert.equal(oa('LZXX'), '12', 'a code made from the GPS code');
  assert.equal(oa('LKAAAA'), '20', 'a VFR code found as local code');
  assert.equal(oa('LKBBBB'), undefined, 'a Czech strip without OurAirports is no problem');
  assert.equal(oa('GB-0001'), '21', 'found even when closed');
  assert.deepEqual(problems, ['SK-0099 (SK): no OurAirports row']);
  const reg = buildRegistry({ pairs: pairs.filter(p => p.code !== 'SK-0099'), today: '2026-11-21' });
  assert.equal(reg.airfields['GB-0001'].missing_since, '2026-11-21');
  assert.equal(reg.airfields.LKBBBB.oa_id, null);
  // an override wins, also with null
  const fixed = pairCodes({ airports, files: { SK: [{ code: 'SK-0001' }] }, COUNTRIES, overrides: { 'SK-0001': 12 } });
  assert.equal(fixed.pairs[0].row.id, '12');
});

test('the check refuses a published code missing in the registry and a shared oa_id', () => {
  const reg = { v: 1, generated: 'x', airfields: {
    AAAA: { cc: 'SK', oa_id: 1 }, BBBB: { cc: 'SK', oa_id: 1 }, CCCC: { cc: 'SK', oa_id: null },
  } };
  const problems = checkRegistry(reg, { SK: [{ code: 'AAAA' }, { code: 'BBBB' }, { code: 'CCCC' }, { code: 'DDDD' }] });
  assert.ok(problems.some(p => /DDDD: published but not in the registry/.test(p)));
  assert.ok(problems.some(p => /BBBB: oa_id 1 also at AAAA/.test(p)));
  assert.ok(problems.some(p => /CCCC: no oa_id outside Czechia/.test(p)));
});
