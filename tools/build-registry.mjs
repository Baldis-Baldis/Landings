#!/usr/bin/env node
// One-off: builds data/registry.json, one record per airfield code we publish today, paired with OurAirports.
// From now on a code is a permanent ID: it never changes and is never given to another airfield.
// Pairing: abroad the rule that made the code (ICAO, GPS code or ident within the country, first row wins);
// in Czechia the VFR-manual code against ident, GPS, ICAO and local code; a few pairs are fixed by hand (OVERRIDES).
// Without --write it only prints the check. Standard library only.
import { readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCsv, loadCountries, appCode } from './update-airports.mjs';

const TYPES = new Set(['small_airport', 'medium_airport', 'large_airport']);

// Decided with the owner on 21 Nov 2026 (dry run of the pairing):
// - three Czech strips are in OurAirports under a CZ-xxxx ident only, 0–31 m away, same name;
// - LKNEPL is not in OurAirports at all, the VFR manual is its only source;
// - BISA is the official ICAO code of Sauðárflugvöllur; Sandá had it only as an old ident (nobody has data on BISA).
export const OVERRIDES = { LKNABO: 328779, LKSPAK: 321499, LKZAHO: 317839, LKNEPL: null, BISA: 602622 };

// codes -> OurAirports row, as the published files have them today
export function pairCodes({ airports, files, COUNTRIES, overrides = OVERRIDES }) {
  const byId = new Map(airports.map(r => [Number(r.id), r]));
  const byRule = new Map();
  for (const r of airports) {
    const cc = r.iso_country;
    if (!COUNTRIES[cc] || !COUNTRIES[cc].live || cc === 'CZ' || !TYPES.has(r.type)) continue;
    const [code] = appCode(r, COUNTRIES[cc].icao);
    if (!byRule.has(code)) byRule.set(code, r);
  }
  const czRows = airports.filter(r => r.iso_country === 'CZ');
  const anyBy = new Map();
  for (const r of airports) for (const k of [r.ident, r.icao_code, r.gps_code]) if (k && !anyBy.has(k)) anyBy.set(k, r);
  const out = [], problems = [];
  for (const [cc, list] of Object.entries(files)) for (const a of list) {
    let r;
    if (Object.prototype.hasOwnProperty.call(overrides, a.code)) {
      const id = overrides[a.code];
      r = id === null ? null : byId.get(id);
      if (id !== null && !r) problems.push(`${a.code}: override oa_id ${id} not in OurAirports`);
    } else if (cc === 'CZ') {
      r = czRows.find(x => TYPES.has(x.type) && [x.ident, x.gps_code, x.icao_code, x.local_code].includes(a.code))
        || czRows.find(x => [x.ident, x.gps_code, x.icao_code, x.local_code].includes(a.code)) || null;
    } else {
      r = byRule.get(a.code) || anyBy.get(a.code) || null;
    }
    if (r === undefined) r = null;
    if (!r && !(cc === 'CZ')) problems.push(`${a.code} (${cc}): no OurAirports row`);
    out.push({ code: a.code, cc, row: r });
  }
  return { pairs: out, problems };
}

export function buildRegistry({ pairs, today }) {
  const airfields = {};
  for (const { code, cc, row } of [...pairs].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))) {
    const gone = row && !TYPES.has(row.type); // closed or no longer an airfield in OurAirports: treated as gone
    airfields[code] = {
      cc, status: 'active', added: today,
      oa_id: row ? Number(row.id) : null, oa_ident: row ? row.ident : '', icao: row ? row.icao_code || '' : '',
      vfr: cc === 'CZ' ? code : '', missing_since: gone ? today : null,
    };
  }
  return { v: 1, generated: today, airfields };
}

// one airfield per line, so a monthly change shows as a few changed lines in git
export function stringifyRegistry(reg) {
  const lines = Object.entries(reg.airfields).map(([code, r]) => `${JSON.stringify(code)}:${JSON.stringify(r)}`);
  return `{"v":${reg.v},"generated":${JSON.stringify(reg.generated)},"airfields":{\n${lines.join(',\n')}\n}}\n`;
}

// what must hold before the file is written
export function checkRegistry(reg, files) {
  const problems = [], codes = Object.keys(reg.airfields), seen = new Map();
  const published = Object.values(files).flat().map(a => a.code);
  for (const c of published) if (!reg.airfields[c]) problems.push(`${c}: published but not in the registry`);
  if (codes.length !== new Set(published).size) problems.push(`registry has ${codes.length} codes, files ${published.length}`);
  for (const [c, r] of Object.entries(reg.airfields)) {
    if (!/^[A-Z0-9-]{3,12}$/.test(c)) problems.push(`${c}: not a valid code`);
    if (r.oa_id !== null) { if (seen.has(r.oa_id)) problems.push(`${c}: oa_id ${r.oa_id} also at ${seen.get(r.oa_id)}`); seen.set(r.oa_id, c); }
    if (r.oa_id === null && r.cc !== 'CZ') problems.push(`${c}: no oa_id outside Czechia`);
  }
  return problems;
}

function readFiles(root) {
  const dir = join(root, 'data', 'countries'), files = {};
  for (const f of readdirSync(dir).filter(f => /^[A-Z]{2}\.json$/.test(f))) files[f.slice(0, 2)] = JSON.parse(readFileSync(join(dir, f), 'utf8')).airports;
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const today = new Date().toISOString().slice(0, 10);
  const { COUNTRIES } = loadCountries(root);
  const files = readFiles(root);
  const airports = await fetchCsv('airports.csv');
  const { pairs, problems } = pairCodes({ airports, files, COUNTRIES });
  const reg = buildRegistry({ pairs, today });
  problems.push(...checkRegistry(reg, files));
  const a = Object.values(reg.airfields);
  console.log(`codes ${a.length}, with oa_id ${a.filter(r => r.oa_id !== null).length}, without ${a.filter(r => r.oa_id === null).map(r => r.cc).join(',') || 0}, missing in source ${Object.entries(reg.airfields).filter(([, r]) => r.missing_since).map(([c]) => c).join(', ') || 'none'}`);
  for (const c of Object.keys(OVERRIDES)) console.log(`  ${c}: oa_id ${reg.airfields[c] && reg.airfields[c].oa_id} ${reg.airfields[c] && reg.airfields[c].oa_ident}`);
  if (problems.length) { console.error('problems:\n  ' + problems.join('\n  ')); process.exit(1); }
  if (process.argv.includes('--write')) {
    const p = join(root, 'data', 'registry.json');
    writeFileSync(p + '.tmp', stringifyRegistry(reg)); renameSync(p + '.tmp', p);
    console.log('written data/registry.json');
  } else console.log('dry run, nothing written (add --write)');
}
