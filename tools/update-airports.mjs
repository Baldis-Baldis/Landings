// Refreshes airfield data from OurAirports (public domain) for every live country in countries.js.
// Writes data/countries/XX.json (airfields with runways and frequencies) and data/countries/index.json
// (counts, file sizes, codes whose country the code itself does not tell). The Czech list in
// data/countries/CZ.json follows the VFR manual and is kept by hand: the script never rewrites it, it only
// refreshes the runways and frequencies of those airfields.
//
// Every published code is a permanent ID kept in data/registry.json (see build): it never changes or disappears.
//
// Safety: everything is downloaded and checked before anything is written. The run fails and writes nothing
// when a download fails, a file looks empty, a country loses more than 20 % of its airfields (they would go
// missing at once) or info, a code would leave the registry or point at another OurAirports row.
// A file is rewritten only when its content changed, so the monthly Action commits only real changes.
// Usage: node tools/update-airports.mjs [--dry-run]
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

// --- the registry (data/registry.json): every published code is a permanent ID ---
// A code is never changed, never removed and never given to another airfield, so the users' landings, photos,
// comments and reviews (all keyed by airfield_code) never lose their airfield. OurAirports rows are found
// through the registry: first by their stable numeric id (oa_id), in Czechia by the VFR code. A new ICAO code
// or ident is only recorded. An airfield gone from the source stays with its last known data, gets missing_since
// and after CLOSE_AFTER_MONTHS the status closed; when it comes back it is active again.
export const CLOSE_AFTER_MONTHS = 3;
export const EMPTY_REGISTRY = { v: 1, generated: '', airfields: {} };
const addMonths = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10); };

// one airfield per line, so a monthly change shows as a few changed lines in git
export function stringifyRegistry(reg) {
  const lines = Object.entries(reg.airfields).map(([code, r]) => `${JSON.stringify(code)}:${JSON.stringify(r)}`);
  return `{"v":${reg.v},"generated":${JSON.stringify(reg.generated)},"airfields":{\n${lines.join(',\n')}\n}}\n`;
}

// builds the per-country data from the three OurAirports tables, through the registry
export function build({ airports, runways, freqs }, COUNTRIES, countryOfCode, czAirports,
  { registry = EMPTY_REGISTRY, prevFiles = {}, today = new Date().toISOString().slice(0, 10) } = {}) {
  const live = Object.keys(COUNTRIES).filter(c => COUNTRIES[c].live && c !== 'CZ');
  const out = { CZ: { airports: czAirports, info: {} } };
  const czCodes = czAirports.map(a => a.code);
  live.forEach(c => { out[c] = { airports: [], info: {} }; });
  const reg = structuredClone(registry.airfields || {});
  const report = { added: [], collisions: [], changed: [], missing: [], closed: [], back: [], held: [] };
  const byOa = new Map(), byId = new Map(airports.map(r => [Number(r.id), r]));
  for (const [code, r] of Object.entries(reg)) if (r.oa_id !== null) byOa.set(r.oa_id, code);
  const seen = new Set(), identToCode = new Map(), codeCc = new Map(), exceptions = {};
  const entry = (r, code, cc) => {
    const icao = r.icao_code || '';
    return {
      code, name: r.name.replace(/\s+/g, ' ').trim(),
      lat: round5(r.latitude_deg), lon: round5(r.longitude_deg),
      elev: r.elevation_ft || '', town: r.municipality || '',
      slz: !appCode(r, COUNTRIES[cc].icao)[1] && r.type === 'small_airport', cc,
      ...(icao && icao !== code ? { icao } : {}),
    };
  };
  const present = (code, rec, r, cc) => {
    if (rec.missing_since || rec.status !== 'active') { report.back.push(code); rec.missing_since = null; rec.status = 'active'; }
    const was = `${rec.oa_ident}|${rec.icao}|${rec.cc}`;
    rec.oa_ident = r.ident; rec.icao = r.icao_code || ''; rec.cc = cc;
    if (`${rec.oa_ident}|${rec.icao}|${rec.cc}` !== was) report.changed.push(`${code}: ${was} -> ${rec.oa_ident}|${rec.icao}|${rec.cc}`);
    seen.add(code); identToCode.set(r.ident, code); codeCc.set(code, cc);
    out[cc].airports.push(entry(r, code, cc));
  };
  // 1. rows the registry knows by oa_id keep their code, whatever their ICAO code or ident is now
  const pending = [];
  for (const r of airports) {
    const cc = r.iso_country;
    if (!out[cc] || cc === 'CZ' || !TYPES.has(r.type)) continue;
    const code = byOa.get(Number(r.id));
    if (code && reg[code].cc !== 'CZ') present(code, reg[code], r, cc); else pending.push(r);
  }
  // 2. rows the registry does not know
  for (const r of pending) {
    const cc = r.iso_country, icao = r.icao_code || '';
    const sameAs = ([c, x]) => x.cc === cc && !seen.has(c) && ((icao && (c === icao || x.icao === icao)) || c === r.ident || x.oa_ident === r.ident);
    // an airfield of ours not in this run (its row gone or no longer an airfield) with the same ICAO code or ident:
    // pairing it would change its oa_id, which only a person may decide, so the row waits and ours keeps its data
    const gone = Object.entries(reg).find(e => e[1].oa_id !== null && sameAs(e));
    if (gone) { report.held.push(`${cc} oa ${r.id} ${r.ident} "${r.name}" looks like ${gone[0]} (its OurAirports row ${gone[1].oa_id} is gone)`); continue; }
    // an airfield of ours that never had an OurAirports row: the ICAO code or ident links it for good
    const unlinked = Object.entries(reg).find(e => e[1].oa_id === null && e[1].cc !== 'CZ' && sameAs(e));
    if (unlinked) { unlinked[1].oa_id = Number(r.id); byOa.set(Number(r.id), unlinked[0]); present(unlinked[0], unlinked[1], r, cc); continue; }
    // a new airfield: the code of today's rule, unless the registry has it already
    let [code] = appCode(r, COUNTRIES[cc].icao);
    if (reg[code] || seen.has(code)) {
      const taken = code; code = `${cc}-X${r.id}`;
      report.collisions.push(`${taken} is taken, oa ${r.id} "${r.name}" (${cc}) gets ${code}`);
      if (reg[code]) { report.held.push(`${code} exists already, oa ${r.id} left out`); continue; }
    }
    reg[code] = { cc, status: 'active', added: today, oa_id: Number(r.id), oa_ident: r.ident, icao, vfr: '', missing_since: null };
    byOa.set(Number(r.id), code); report.added.push(code);
    present(code, reg[code], r, cc);
  }
  // 3. Czech airfields follow the VFR manual (CZ.json): their state never depends on OurAirports
  const cz = new Set(czCodes);
  const czRows = airports.filter(r => r.iso_country === 'CZ');
  for (const a of czAirports) {
    const r = reg[a.code];
    const row = r && r.oa_id !== null ? byId.get(r.oa_id)
      : czRows.find(x => TYPES.has(x.type) && [x.ident, x.gps_code, x.icao_code, x.local_code].includes(a.code));
    if (!r) { reg[a.code] = { cc: 'CZ', status: 'active', added: today, oa_id: row ? Number(row.id) : null, oa_ident: row ? row.ident : '', icao: row ? row.icao_code || '' : '', vfr: a.code, missing_since: null }; report.added.push(a.code); }
    const rec = reg[a.code];
    const status = a.closed ? 'closed' : 'active';
    if (rec.status !== status || rec.missing_since) { (status === 'active' ? report.back : report.closed).push(a.code); rec.status = status; rec.missing_since = null; }
    if (row) { rec.oa_ident = row.ident; rec.icao = row.icao_code || ''; identToCode.set(row.ident, a.code); }
    seen.add(a.code); codeCc.set(a.code, 'CZ');
  }
  for (const r of czRows) for (const alias of [r.ident, r.gps_code, r.icao_code, r.local_code])
    if (cz.has(alias) && !identToCode.has(r.ident)) { identToCode.set(r.ident, alias); break; }
  // 4. airfields gone from the source keep their last known data, runways and frequencies included
  const keptInfo = {};
  for (const [code, rec] of Object.entries(reg)) {
    if (seen.has(code)) continue;
    if (rec.cc === 'CZ') throw new Error(`data/countries/CZ.json lost ${code}: keep every VFR code, mark a strip closed instead of deleting it`);
    const prev = prevFiles[rec.cc] && prevFiles[rec.cc].airports.find(a => a.code === code);
    if (!prev || !out[rec.cc]) throw new Error(`${code} is in the registry but neither in OurAirports nor in data/countries/${rec.cc}.json`);
    if (!rec.missing_since) { rec.missing_since = today; report.missing.push(code); }
    if (rec.status === 'active' && addMonths(rec.missing_since, CLOSE_AFTER_MONTHS) <= today) { rec.status = 'closed'; report.closed.push(code); }
    // a closed airfield carries the day it went missing, the card says "closed, gone from the source since M/YYYY"
    const { closed, ...kept } = prev;
    out[rec.cc].airports.push(rec.status === 'closed' ? { ...kept, closed: rec.missing_since } : kept);
    if (prevFiles[rec.cc].info && prevFiles[rec.cc].info[code]) keptInfo[code] = prevFiles[rec.cc].info[code];
    seen.add(code); codeCc.set(code, rec.cc);
  }
  live.forEach(c => out[c].airports.sort((a, b) => lt(a.name, b.name)));
  for (const c of Object.keys(out)) for (const a of out[c].airports) if (countryOfCode(a.code, null) !== c) exceptions[a.code] = c;
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
  for (const [code, v] of Object.entries(keptInfo)) if (!info[code]) info[code] = v;
  for (const code of Object.keys(info).sort(lt)) {
    const v = info[code]; if (v.r) v.r.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    if (codeCc.has(code)) out[codeCc.get(code)].info[code] = v;
  }
  const airfields = Object.fromEntries(Object.entries(reg).sort((a, b) => lt(a[0], b[0])));
  const same = JSON.stringify(airfields) === JSON.stringify(registry.airfields || {});
  return {
    countries: out, exceptions: Object.fromEntries(Object.entries(exceptions).sort((a, b) => lt(a[0], b[0]))),
    registry: { v: 1, generated: same && registry.generated ? registry.generated : today, airfields }, report,
  };
}

// Throws when the registry would break its promise: a code that disappears or points at another OurAirports row,
// or a country where more than MAX_DROP of its airfields went missing at once (a broken download looks like that,
// now that missing airfields stay in the files).
export function checkRegistry(before, after, report, prevFiles) {
  const problems = [];
  for (const [code, r] of Object.entries(before.airfields || {})) {
    const now = after.airfields[code];
    if (!now) problems.push(`${code} would leave the registry`);
    else if (r.oa_id !== null && now.oa_id !== r.oa_id) problems.push(`${code}: oa_id ${r.oa_id} -> ${now.oa_id}`);
  }
  const lost = {};
  for (const code of report.missing) { const cc = after.airfields[code].cc; lost[cc] = (lost[cc] || 0) + 1; }
  for (const [cc, n] of Object.entries(lost)) {
    const base = ((prevFiles[cc] && prevFiles[cc].airports) || []).filter(a => !(before.airfields[a.code] || {}).missing_since).length;
    if (base && n > base * MAX_DROP) problems.push(`${cc}: airfields ${base} -> ${base - n}`);
  }
  if (problems.length) throw new Error('registry check failed, nothing written: ' + problems.join('; '));
}

// the search index over every country: code, name and town (no positions, no custom strips), by country, plus the
// ICAO code when it differs from ours and a mark for a closed airfield.
// The app downloads it on the first search and finds airfields of countries that are not shown.
export function searchIndex(countries) {
  const c = {};
  for (const cc of Object.keys(countries).sort(lt)) c[cc] = countries[cc].airports.map(a => {
    const row = [a.code, a.name, a.town || ''];
    if (a.icao || a.closed) row.push(a.icao || '');
    if (a.closed) row.push(1);
    return row;
  });
  return { v: 1, c };
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

// the registry must exist: without it every code could be handed out again
export function readRegistry(root) {
  let reg = null;
  try { reg = JSON.parse(readFileSync(join(root, 'data', 'registry.json'), 'utf8')); } catch {}
  if (!reg || reg.v !== 1 || !reg.airfields || typeof reg.airfields !== 'object') throw new Error('data/registry.json is missing or broken');
  return reg;
}

function readPrevFiles(root, COUNTRIES) {
  const files = {};
  for (const c of Object.keys(COUNTRIES)) {
    try { files[c] = JSON.parse(readFileSync(join(root, 'data', 'countries', c + '.json'), 'utf8')); } catch {}
  }
  return files;
}

// a short monthly overview for the log (and the summary of the GitHub run)
export function summary(report) {
  const part = (title, list) => list.length ? [`${title}: ${list.length}`, ...list.slice(0, 50).map(x => '  ' + x), ...(list.length > 50 ? [`  … ${list.length - 50} more`] : [])] : [];
  const lines = [
    `registry: ${report.added.length} new, ${report.changed.length} changed, ${report.missing.length} newly missing, ${report.closed.length} closed, ${report.back.length} back, ${report.collisions.length} collisions, ${report.held.length} waiting for a decision`,
    ...part('new', report.added), ...part('collisions', report.collisions), ...part('changed (ident|ICAO|country)', report.changed),
    ...part('newly missing', report.missing), ...part('closed', report.closed), ...part('back', report.back), ...part('waiting for a decision', report.held),
  ];
  return lines.join('\n');
}

// downloads, checks and only then writes; returns a short report. dryRun checks everything and writes nothing.
export async function run({ root, getCsv = fetchCsv, today = new Date().toISOString().slice(0, 10), log = console.log, dryRun = false } = {}) {
  const { COUNTRIES, countryOfCode } = loadCountries(root);
  const cz = czechList(root);
  const before = readRegistry(root);
  const prevFiles = readPrevFiles(root, COUNTRIES);
  const [airports, runways, freqs] = await Promise.all(['airports.csv', 'runways.csv', 'airport-frequencies.csv'].map(n => getCsv(n)));
  const { countries, exceptions, registry, report } = build({ airports, runways, freqs }, COUNTRIES, countryOfCode, cz.airports, { registry: before, prevFiles, today });
  checkCounts(previousCounts(root), countries);
  checkRegistry(before, registry, report, prevFiles);

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
  // the search index comes from the same checked data, so it is written only when they pass, and only on a change
  const spath = join(dir, 'search.json'), search = JSON.stringify(searchIndex(countries));
  let oldSearch = null; try { oldSearch = readFileSync(spath, 'utf8'); } catch {}
  if (oldSearch !== search) files[spath] = search;
  const rpath = join(root, 'data', 'registry.json'), regText = stringifyRegistry(registry);
  if (registry.generated !== before.generated || JSON.stringify(registry.airfields) !== JSON.stringify(before.airfields)) files[rpath] = regText;
  // write through temporary files so a crash never leaves half a file behind
  if (!dryRun) for (const [p, text] of Object.entries(files)) if (text !== null) { writeFileSync(p + '.tmp', text); renameSync(p + '.tmp', p); }
  for (const [c, v] of Object.entries(index.countries)) log(`${c}: ${v.n} airfields, info ${v.info}, ${v.bytes} B${files[join(dir, c + '.json')] ? ' (updated)' : ''}`);
  log(`exceptions: ${Object.keys(exceptions).length}${idxSame ? '' : ' (index updated)'}`);
  log(`search: ${Buffer.byteLength(search)} B${files[spath] ? ' (updated)' : ''}`);
  const overview = summary(report);
  log(overview);
  if (!dryRun && process.env.GITHUB_STEP_SUMMARY) { try { writeFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + overview + '\n```\n', { flag: 'a' }); } catch {} }
  if (dryRun) log('dry run: nothing written');
  return { index, report, registry, countries, written: dryRun ? [] : Object.keys(files).filter(p => files[p] !== null), wouldWrite: Object.keys(files).filter(p => files[p] !== null) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run({ root: join(dirname(fileURLToPath(import.meta.url)), '..'), dryRun: process.argv.includes('--dry-run') }).catch(e => { console.error(e.message); process.exit(1); });
}
