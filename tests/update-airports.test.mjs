// The monthly data update: CSV parsing, codes, per-country files and the guard that refuses broken data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCsv, build, run, loadCountries, fetchCsv, checkCounts, ftToM, appCode } from '../tools/update-airports.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { COUNTRIES, countryOfCode } = loadCountries(ROOT);

const airport = (o) => ({ ident: '', type: 'small_airport', name: 'X', latitude_deg: '48.1', longitude_deg: '17.1', elevation_ft: '400',
  iso_country: 'SK', municipality: '', gps_code: '', icao_code: '', local_code: '', ...o });
// a small world: Slovak and Austrian fields, one Czech VFR field, runways and frequencies
function world({ sk = 10, at = 10 } = {}) {
  const airports = [airport({ ident: 'LKAA', iso_country: 'CZ', type: 'closed' })];
  for (let i = 0; i < sk; i++) airports.push(airport({ ident: `SK-${String(i).padStart(4, '0')}`, name: `Sk ${i}` }));
  for (let i = 0; i < at; i++) airports.push(airport({ ident: `AT-${String(i).padStart(4, '0')}`, iso_country: 'AT', name: `At ${i}` }));
  airports.push(airport({ ident: 'LZIB', icao_code: 'LZIB', type: 'large_airport', name: 'Bratislava' }));
  airports.push(airport({ ident: 'CZ-0052', name: 'Border strip' }));
  const runways = [{ airport_ident: 'LZIB', le_ident: '04', he_ident: '22', length_ft: '10000', width_ft: '148', surface: 'ASP', lighted: '1', closed: '0' },
    { airport_ident: 'LKAA', le_ident: '09', he_ident: '27', length_ft: '2000', width_ft: '', surface: 'grass', lighted: '0', closed: '0' }];
  for (let i = 0; i < Math.min(sk, 5); i++) runways.push({ airport_ident: `SK-${String(i).padStart(4, '0')}`, le_ident: '10', he_ident: '28', length_ft: '1500', width_ft: '60', surface: 'GRS', lighted: '0', closed: '0' });
  const freqs = [{ airport_ident: 'LZIB', type: 'twr', description: 'Tower', frequency_mhz: '118.3' }];
  return { airports, runways, freqs };
}
const live = { SK: COUNTRIES.SK, AT: COUNTRIES.AT, CZ: COUNTRIES.CZ };
// the hand-kept Czech list (VFR manual)
const CZ_LIST = [{ code: 'LKAA', name: 'Ručně vedená plocha', lat: 50, lon: 15, elev: '1000', town: 'Obec', slz: true, cc: 'CZ' }];
function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ml-update-'));
  copyFileSync(join(ROOT, 'countries.js'), join(dir, 'countries.js'));
  mkdirSync(join(dir, 'data', 'countries'), { recursive: true });
  writeFileSync(join(dir, 'data', 'countries', 'CZ.json'), JSON.stringify({ source: 'VFR manual', cc: 'CZ', airports: CZ_LIST, info: {} }));
  return dir;
}
// only SK, AT and CZ are live in the temporary root, whatever countries.js says later
function onlyLive(dir) {
  const src = readFileSync(join(dir, 'countries.js'), 'utf8').replace(/,live:1/g, '')
    .replace(/(CZ|SK|AT):\{([^}]*)\}/g, (m, c, b) => `${c}:{${b},live:1}`);
  writeFileSync(join(dir, 'countries.js'), src);
}
const csvFrom = (w) => async (name) => w[{ 'airports.csv': 'airports', 'runways.csv': 'runways', 'airport-frequencies.csv': 'freqs' }[name]];
const quiet = () => {};
const snapshot = (dir) => { const d = join(dir, 'data', 'countries'); return existsSync(d) ? Object.fromEntries(readdirSync(d).map(f => [f, readFileSync(join(d, f), 'utf8')])) : {}; };

test('CSV fields may hold commas, quotes and line breaks', () => {
  const rows = parseCsv('a,b,c\r\n1,"x, ""y""","line\nbreak"\n2,,\n');
  assert.deepEqual(rows, [{ a: '1', b: 'x, "y"', c: 'line\nbreak' }, { a: '2', b: '', c: '' }]);
});

test('codes follow the old rule: real ICAO code of the country, otherwise the ident', () => {
  assert.deepEqual(appCode({ icao_code: 'LZIB', gps_code: '', ident: 'LZIB' }, ['LZ']), ['LZIB', true]);
  assert.deepEqual(appCode({ icao_code: '', gps_code: 'EDXX', ident: 'SK-0001' }, ['LZ']), ['SK-0001', false]);
  assert.equal(ftToM('1000'), 305);
  assert.equal(ftToM(''), null);
});

test('data are split per country, Czech info is matched to the VFR codes, odd codes are listed', () => {
  const { countries, exceptions } = build(world(), live, countryOfCode, CZ_LIST);
  assert.equal(countries.SK.airports.length, 12);
  assert.equal(countries.AT.airports.length, 10);
  assert.equal(countries.CZ.airports, CZ_LIST, 'the Czech list is taken over as it is');
  assert.deepEqual(Object.keys(countries.CZ.info), ['LKAA']);
  assert.deepEqual(countries.SK.info.LZIB.r[0], ['04/22', 3048, 45, 'asp', 1]);
  assert.deepEqual(countries.SK.info.LZIB.f, [['TWR', 'Tower', '118.300']]);
  assert.equal(countries.SK.airports.find(a => a.code === 'LZIB').slz, false);
  assert.deepEqual(exceptions, { 'CZ-0052': 'SK' }, 'a code that names another country');
});

test('a run writes per-country files and an index, a second run changes nothing', async () => {
  const dir = tempRoot(); onlyLive(dir);
  const first = await run({ root: dir, getCsv: csvFrom(world()), today: '2026-11-07', log: quiet });
  assert.equal(first.written.length, 4);
  const idx = JSON.parse(readFileSync(join(dir, 'data', 'countries', 'index.json'), 'utf8'));
  assert.deepEqual(Object.keys(idx.countries), ['AT', 'CZ', 'SK']);
  assert.equal(idx.countries.CZ.n, 1);
  assert.equal(idx.countries.SK.bytes, readFileSync(join(dir, 'data', 'countries', 'SK.json')).length);
  const again = await run({ root: dir, getCsv: csvFrom(world()), today: '2026-12-02', log: quiet });
  assert.deepEqual(again.written, [], 'same data, no new commit');
});

test('a failed download writes nothing', async () => {
  const dir = tempRoot(); onlyLive(dir);
  await run({ root: dir, getCsv: csvFrom(world()), log: quiet });
  const before = snapshot(dir);
  await assert.rejects(run({ root: dir, getCsv: async () => { throw new Error('HTTP 503'); }, log: quiet }), /503/);
  assert.deepEqual(snapshot(dir), before);
});

test('a download with too few rows or a bad status fails', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('ident,type\nA,small_airport\n'));
  await assert.rejects(fetchCsv('airports.csv'), /suspiciously few rows \(1\)/);
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }));
  await assert.rejects(fetchCsv('airports.csv'), /HTTP 500/);
});

test('a country that loses all its airfields or more than 20 % writes nothing', async () => {
  const dir = tempRoot(); onlyLive(dir);
  await run({ root: dir, getCsv: csvFrom(world({ sk: 18, at: 10 })), log: quiet });
  const before = snapshot(dir);
  await assert.rejects(run({ root: dir, getCsv: csvFrom(world({ sk: 18, at: 0 })), log: quiet }), /AT: airfields 10 -> 0/);
  await assert.rejects(run({ root: dir, getCsv: csvFrom(world({ sk: 13, at: 10 })), log: quiet }), /SK: airfields 20 -> 15/);
  assert.deepEqual(snapshot(dir), before);
  // exactly 20 % less is still accepted
  await run({ root: dir, getCsv: csvFrom(world({ sk: 14, at: 10 })), log: quiet });
  assert.equal(JSON.parse(readFileSync(join(dir, 'data', 'countries', 'SK.json'), 'utf8')).airports.length, 16);
});

test('losing more than 20 % of runway and frequency info is refused too', () => {
  const now = { SK: { airports: new Array(10), info: { A: {}, B: {}, C: {} } } };
  assert.throws(() => checkCounts({ SK: { airports: 10, info: 4 } }, now), /SK: info 4 -> 3/);
  assert.doesNotThrow(() => checkCounts({ SK: { airports: 10, info: 3 } }, now));
  assert.doesNotThrow(() => checkCounts({}, now), 'a new country has nothing to compare with');
});

test('before the first per-country run, the old combined file is the baseline', async () => {
  const dir = tempRoot(); onlyLive(dir);
  const before = snapshot(dir);
  writeFileSync(join(dir, 'data', 'airports-eu.json'), JSON.stringify({ airports: Array.from({ length: 20 }, (_, i) => ({ code: 'AT-' + i, cc: 'AT' })) }));
  await assert.rejects(run({ root: dir, getCsv: csvFrom(world({ at: 10 })), log: quiet }), /AT: airfields 20 -> 10/);
  assert.deepEqual(snapshot(dir), before);
});

test('the Czech list is never rewritten from OurAirports, only its runways and frequencies', async () => {
  const dir = tempRoot(); onlyLive(dir);
  const w = world();
  // OurAirports knows the field under another name and place, and knows more Czech fields
  w.airports[0] = airport({ ident: 'LKAA', iso_country: 'CZ', name: 'Other name', latitude_deg: '49', longitude_deg: '14', type: 'small_airport' });
  w.airports.push(airport({ ident: 'LKZZ', iso_country: 'CZ', name: 'Not in the manual', type: 'medium_airport' }));
  await run({ root: dir, getCsv: csvFrom(w), log: quiet });
  const cz = JSON.parse(readFileSync(join(dir, 'data', 'countries', 'CZ.json'), 'utf8'));
  assert.deepEqual(cz.airports, CZ_LIST);
  assert.equal(cz.source, 'VFR manual');
  assert.deepEqual(Object.keys(cz.info), ['LKAA'], 'runways are added');
  assert.ok(!JSON.stringify(cz).includes('Not in the manual'));
});

test('without the Czech list the run stops and writes nothing', async () => {
  const dir = tempRoot(); onlyLive(dir);
  rmSync(join(dir, 'data', 'countries', 'CZ.json'));
  await assert.rejects(run({ root: dir, getCsv: csvFrom(world()), log: quiet }), /no Czech airfield list/);
  assert.deepEqual(snapshot(dir), {});
  writeFileSync(join(dir, 'data', 'countries', 'CZ.json'), JSON.stringify({ airports: [] }));
  await assert.rejects(run({ root: dir, getCsv: csvFrom(world()), log: quiet }), /no Czech airfield list/);
});

test('the published data agree with the index, and every code tells its country', () => {
  const dir = join(ROOT, 'data', 'countries');
  const idx = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  for (const [c, v] of Object.entries(idx.countries)) {
    assert.ok(COUNTRIES[c] && COUNTRIES[c].live, c + ' is a live country');
    const f = JSON.parse(readFileSync(join(dir, c + '.json'), 'utf8'));
    assert.equal(f.cc, c);
    assert.equal(readFileSync(join(dir, c + '.json')).length, v.bytes, c + ' size');
    assert.equal(f.airports.length, v.n, c + ' airfields');
    assert.equal(Object.keys(f.info).length, v.info, c + ' runway and frequency info');
    for (const a of f.airports) {
      assert.equal(a.cc, c);
      assert.match(a.code, /^[A-Z0-9-]{3,12}$/);
      assert.equal(countryOfCode(a.code, idx.exceptions), c, a.code);
    }
  }
  for (const c of Object.keys(COUNTRIES).filter(c => COUNTRIES[c].live)) assert.ok(idx.countries[c], c + ' has data');
});

test('phase 2 keeps every airfield code that existed before it, country by country', () => {
  const before = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/codes-before-phase2.json'), 'utf8'));
  for (const [c, codes] of Object.entries(before)) {
    const now = JSON.parse(readFileSync(join(ROOT, 'data', 'countries', c + '.json'), 'utf8')).airports.map(a => a.code);
    for (const code of codes) assert.ok(now.includes(code), `${c}: ${code} is gone`);
  }
});

test('all 44 countries and territories with data are live, the three without airfields are not', () => {
  const live = Object.keys(COUNTRIES).filter(c => COUNTRIES[c].live);
  assert.equal(live.length, 44);
  for (const c of ['LI', 'MC', 'AD']) assert.ok(!COUNTRIES[c].live, c + ' has heliports only');
  const idx = JSON.parse(readFileSync(join(ROOT, 'data', 'countries', 'index.json'), 'utf8'));
  assert.deepEqual(Object.keys(idx.countries).sort(), live.sort());
  for (const c of live) assert.ok(idx.countries[c].n > 0, c + ' has airfields');
  // the old combined files are gone
  assert.ok(!existsSync(join(ROOT, 'data', 'airports-eu.json')) && !existsSync(join(ROOT, 'data', 'airport-info.json')));
});

test('territories have their own name and data, never the codes of the country that owns their prefix', () => {
  const idx = JSON.parse(readFileSync(join(ROOT, 'data', 'countries', 'index.json'), 'utf8'));
  const keys = Object.keys(COUNTRIES);
  for (const [t, owner, prefix] of [['JE', 'GB', 'EG'], ['GG', 'GB', 'EG'], ['IM', 'GB', 'EG'], ['FO', 'DK', 'EK']]) {
    assert.deepEqual([...COUNTRIES[t].icao], [prefix]);
    assert.ok(keys.indexOf(owner) < keys.indexOf(t), `${owner} is listed before ${t}`);
  }
  assert.deepEqual([...COUNTRIES.GI.icao], ['LX']);
  assert.equal(COUNTRIES.IM.cs, 'Ostrov Man');
  assert.equal(COUNTRIES.FO.en, 'Faroe Islands');
  // their airfields are told apart by the index, the owner keeps its prefix
  const exc = { EGJA: 'GG', EGJB: 'GG', EGJJ: 'JE', EGNS: 'IM', EKVG: 'FO' };
  for (const [code, c] of Object.entries(exc)) {
    assert.equal(idx.exceptions[code], c);
    assert.equal(countryOfCode(code, idx.exceptions), c);
  }
  assert.equal(countryOfCode('EGLL', idx.exceptions), 'GB');
  assert.equal(countryOfCode('EKCH', idx.exceptions), 'DK');
  assert.equal(countryOfCode('LXGB', idx.exceptions), 'GI');
  assert.equal(countryOfCode('IM-0001', idx.exceptions), 'IM');
  // the thirteen exceptions from before stay as they were
  const before = { 'CZ-0052': 'SK', 'DE-0354': 'AT', FEA: 'GB', 'GB-1054': 'IE', LIKD: 'SM', 'LT-0012': 'LV', LYBR: 'ME', LYNK: 'ME', LYPG: 'ME', LYPO: 'ME', LYTV: 'ME', SU01: 'IT', VB02: 'IT' };
  assert.deepEqual(idx.exceptions, { ...before, ...exc });
});

test('the guard covers every live country: a new country losing all airfields is refused', () => {
  const live = Object.keys(COUNTRIES).filter(c => COUNTRIES[c].live);
  const prev = Object.fromEntries(live.map(c => [c, { airports: 10, info: 5 }]));
  for (const c of live) {
    const now = { [c]: { airports: [], info: {} } };
    assert.throws(() => checkCounts(prev, now), new RegExp(c + ': airfields 10 -> 0'));
  }
});
