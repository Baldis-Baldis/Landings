// Refreshes airfield data from OurAirports (public domain) for every live country in countries.js.
// Writes data/countries/XX.json (airfields with runways and frequencies) and data/countries/index.json
// (counts, file sizes, codes whose country the code itself does not tell). The Czech list in
// data/countries/CZ.json follows the VFR manual and is kept by hand: the script never rewrites it, it only
// refreshes the runways and frequencies of those airfields.
//
// Safety: everything is downloaded and checked before anything is written. The run fails and writes nothing
// when a download fails, a file looks empty, or a country loses more than 20 % of its airfields or info.
// A file is rewritten only when its content changed, so the monthly Action commits only real changes.
// Usage: node tools/update-airports.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const SRC = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/';
export const SOURCE = 'OurAirports (public domain), https://ourairports.com/data/';
const TYPES = new Set(['small_airport', 'medium_airport', 'large_airport']);
export const MAX_DROP = 0.2;

// RFC 4180 CSV: quoted fields may hold commas, quotes ("") and line breaks
export function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter(r => !(r.length === 1 && r[0] === ''));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function loadCountries(root) {
  const src = readFileSync(join(root, 'countries.js'), 'utf8');
  return vm.runInNewContext(src + ';({COUNTRIES,countryOfCode})');
}

// the hand-kept Czech list, taken over unchanged
export function czechList(root) {
  let f = null;
  try { f = JSON.parse(readFileSync(join(root, 'data', 'countries', 'CZ.json'), 'utf8')); } catch {}
  if (!f || !Array.isArray(f.airports) || !f.airports.length) throw new Error('data/countries/CZ.json has no Czech airfield list');
  return { airports: f.airports, source: f.source || SOURCE };
}

// same rule as the app always had: real ICAO code if there is one, otherwise the OurAirports ident
export function appCode(r, prefixes) {
  for (const c of [r.icao_code, r.gps_code, r.ident])
    if (c && /^[A-Z]{4}$/.test(c) && prefixes.includes(c.slice(0, 2))) return [c, true];
  return [r.ident, false];
}

export function surface(v) {
  const s = (v || '').trim().toLowerCase();
  const sw = (...p) => p.some(x => s.startsWith(x));
  if (!s || ['unk', 'u', 'unknown'].includes(s)) return '';
  if (sw('asp', 'asf', 'bit', 'tar', 'a') && !sw('ag')) return 'asp';
  if (sw('con', 'pem', 'beton', 'c')) return 'con';
  if (sw('gras', 'grs', 'turf', 'g', 'tr', 'rasen') && !sw('grv', 'grav', 'gre')) return 'grs';
  if (sw('grv', 'grav', 'gre', 'kies', 'štěrk')) return 'grv';
  if (sw('paved', 'hard')) return 'paved';
  return [...s].slice(0, 12).join('');
}

// Python's round(): halves go to the even neighbour
function roundEven(x) { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 ? r - 1 : r; }
export function ftToM(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(v); return Number.isFinite(n) ? roundEven(n * 0.3048) : null;
}
const round5 = x => Number(Number(x).toFixed(5));
const lt = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// builds the per-country data from the three OurAirports tables
export function build({ airports, runways, freqs }, COUNTRIES, countryOfCode, czAirports) {
  const live = Object.keys(COUNTRIES).filter(c => COUNTRIES[c].live && c !== 'CZ');
  const out = { CZ: { airports: czAirports, info: {} } };
  const czCodes = czAirports.map(a => a.code);
  live.forEach(c => { out[c] = { airports: [], info: {} }; });
  const seen = new Set(), identToCode = new Map(), codeCc = new Map(), exceptions = {};
  for (const r of airports) {
    const cc = r.iso_country;
    if (!out[cc] || cc === 'CZ' || !TYPES.has(r.type)) continue;
    const [code, icao] = appCode(r, COUNTRIES[cc].icao);
    if (seen.has(code)) continue;
    seen.add(code); identToCode.set(r.ident, code); codeCc.set(code, cc);
    out[cc].airports.push({
      code, name: r.name.replace(/\s+/g, ' ').trim(),
      lat: round5(r.latitude_deg), lon: round5(r.longitude_deg),
      elev: r.elevation_ft || '', town: r.municipality || '',
      slz: !icao && r.type === 'small_airport', cc,
    });
    if (countryOfCode(code, null) !== cc) exceptions[code] = cc;
  }
  live.forEach(c => out[c].airports.sort((a, b) => lt(a.name, b.name)));
  for (const code of czCodes) if (countryOfCode(code, null) !== 'CZ') exceptions[code] = 'CZ';
  // Czech airfields: match the VFR-manual codes to OurAirports records
  const cz = new Set(czCodes);
  for (const r of airports) {
    if (r.iso_country !== 'CZ') continue;
    for (const alias of [r.ident, r.gps_code, r.icao_code, r.local_code])
      if (cz.has(alias)) { identToCode.set(r.ident, alias); codeCc.set(alias, 'CZ'); break; }
  }
  const info = {};
  for (const r of runways) {
    const code = identToCode.get(r.airport_ident);
    if (!code || r.closed === '1') continue;
    const name = [r.le_ident, r.he_ident].filter(Boolean).join('/');
    ((info[code] ??= {}).r ??= []).push([name, ftToM(r.length_ft), ftToM(r.width_ft), surface(r.surface), r.lighted === '1' ? 1 : 0]);
  }
  for (const r of freqs) {
    const code = identToCode.get(r.airport_ident);
    if (!code || !r.frequency_mhz) continue;
    const n = Number(r.frequency_mhz); if (!Number.isFinite(n)) continue;
    const item = [r.type.trim().toUpperCase(), r.description.trim(), n.toFixed(3)];
    const list = ((info[code] ??= {}).f ??= []);
    if (!list.some(x => x[0] === item[0] && x[1] === item[1] && x[2] === item[2])) list.push(item);
  }
  for (const code of Object.keys(info).sort(lt)) {
    const v = info[code]; if (v.r) v.r.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    out[codeCc.get(code)].info[code] = v;
  }
  return { countries: out, exceptions: Object.fromEntries(Object.entries(exceptions).sort((a, b) => lt(a[0], b[0]))) };
}

// counts in the files we have now; before the first per-country run, the old combined files
export function previousCounts(root) {
  const dir = join(root, 'data', 'countries'), prev = {};
  const read = p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
  const idx = read(join(dir, 'index.json'));
  if (idx && idx.countries) {
    for (const c of Object.keys(idx.countries)) {
      const f = read(join(dir, c + '.json'));
      prev[c] = { airports: f && Array.isArray(f.airports) ? f.airports.length : null, info: f && f.info ? Object.keys(f.info).length : null };
    }
    return prev;
  }
  const eu = read(join(root, 'data', 'airports-eu.json'));
  if (eu) for (const a of eu.airports || []) (prev[a.cc] ??= { airports: 0, info: null }).airports++;
  return prev;
}

// throws when the new data look broken: a country lost its airfields or more than MAX_DROP of them / of its info
export function checkCounts(prev, countries) {
  const problems = [];
  for (const [c, now] of Object.entries(countries)) {
    const p = prev[c]; if (!p) continue;
    const pairs = [['airfields', p.airports, now.airports && now.airports.length], ['info', p.info, Object.keys(now.info).length]];
    for (const [what, before, after] of pairs) {
      if (!before || after == null) continue;
      if (after === 0 || after < before * (1 - MAX_DROP)) problems.push(`${c}: ${what} ${before} -> ${after}`);
    }
  }
  if (problems.length) throw new Error('data look broken, nothing written: ' + problems.join('; '));
}

export async function fetchCsv(name, minRows = 1000) {
  const res = await fetch(SRC + name, { headers: { 'User-Agent': 'MyLandings data update' } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  if (rows.length < minRows) throw new Error(`${name}: suspiciously few rows (${rows.length})`);
  return rows;
}

const stable = (o) => JSON.stringify(o);

// downloads, checks and only then writes; returns a short report
export async function run({ root, getCsv = fetchCsv, today = new Date().toISOString().slice(0, 10), log = console.log } = {}) {
  const { COUNTRIES, countryOfCode } = loadCountries(root);
  const cz = czechList(root);
  const [airports, runways, freqs] = await Promise.all(['airports.csv', 'runways.csv', 'airport-frequencies.csv'].map(n => getCsv(n)));
  const { countries, exceptions } = build({ airports, runways, freqs }, COUNTRIES, countryOfCode, cz.airports);
  checkCounts(previousCounts(root), countries);

  const dir = join(root, 'data', 'countries');
  mkdirSync(dir, { recursive: true });
  const files = {}, index = { source: SOURCE, countries: {}, exceptions };
  for (const c of Object.keys(countries).sort(lt)) {
    const body = { airports: countries[c].airports, info: countries[c].info };
    const path = join(dir, c + '.json');
    let old = null; try { old = JSON.parse(readFileSync(path, 'utf8')); } catch {}
    const same = old && stable({ airports: old.airports, info: old.info }) === stable({ airports: body.airports, info: body.info });
    const text = same ? readFileSync(path, 'utf8') : JSON.stringify({ source: c === 'CZ' ? cz.source : SOURCE, generated: today, cc: c, ...body });
    files[path] = same ? null : text;
    index.countries[c] = { n: body.airports.length, info: Object.keys(body.info).length, bytes: Buffer.byteLength(text) };
  }
  const ipath = join(dir, 'index.json');
  let oldIdx = null; try { oldIdx = JSON.parse(readFileSync(ipath, 'utf8')); } catch {}
  if (oldIdx) delete oldIdx.generated;
  const idxSame = oldIdx && stable(oldIdx) === stable(index);
  if (!idxSame) files[ipath] = JSON.stringify({ generated: today, ...index });
  // write through temporary files so a crash never leaves half a file behind
  for (const [p, text] of Object.entries(files)) if (text !== null) { writeFileSync(p + '.tmp', text); renameSync(p + '.tmp', p); }
  for (const [c, v] of Object.entries(index.countries)) log(`${c}: ${v.n} airfields, info ${v.info}, ${v.bytes} B${files[join(dir, c + '.json')] ? ' (updated)' : ''}`);
  log(`exceptions: ${Object.keys(exceptions).length}${idxSame ? '' : ' (index updated)'}`);
  return { index, written: Object.keys(files).filter(p => files[p] !== null) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run({ root: join(dirname(fileURLToPath(import.meta.url)), '..') }).catch(e => { console.error(e.message); process.exit(1); });
}
