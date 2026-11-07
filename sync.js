// Translates between the app's state and database rows. No network and no page access here.
// The base is the last state the server confirmed: comparing with it finds what is still to send,
// so pending changes survive closing the app and sending them twice is harmless.
(() => {
  const CODE = /^[A-Z0-9-]{3,12}$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const iso = ts => new Date(ts || Date.now()).toISOString();
  const text = (value, max) => (value === undefined || value === null || value === '' ? null : String(value).slice(0, max));
  const placeKey = row => row.custom_airfield_id || row.airfield_code;
  const emptyRows = () => ({ strips: {}, landings: {}, flags: {}, notes: {} });

  function stripRow(a) {
    return {
      id: a.id,
      name: String(a.name || '').slice(0, 100) || a.code,
      short: text(a.short, 8),
      description: text(a.desc, 2000),
      lat: a.lat,
      lon: a.lon,
      elev: text(a.elev, 8),
      town: text(a.town, 100),
      client_updated_at: iso(a.ts),
    };
  }

  // Rows that cannot be stored stay on the device, one bad record must not block the rest.
  function toRows({ visited, custom, flags }, base, newId) {
    const rows = emptyRows();
    const known = base || emptyRows();
    for (const a of Object.values(custom)) {
      if (!a.id) a.id = newId();
      if (Number.isFinite(a.lat) && Number.isFinite(a.lon)) rows.strips[a.id] = stripRow(a);
    }
    const place = code => {
      const strip = custom[code];
      if (strip) return rows.strips[strip.id] ? { airfield_code: null, custom_airfield_id: strip.id } : null;
      return CODE.test(code) ? { airfield_code: code, custom_airfield_id: null } : null;
    };
    for (const [code, v] of Object.entries(visited)) {
      const at = place(code);
      if (!at) continue;
      const key = placeKey(at);
      const client_updated_at = iso(v.ts);
      rows.landings[key] = { ...at, landed_on: DATE.test(v.date || '') ? v.date : null, client_updated_at };
      const body = String(v.note || '').slice(0, 2000);
      if (body.trim()) rows.notes[key] = { id: known.notes[key]?.id || newId(), ...at, body, is_note: true, client_updated_at };
    }
    for (const [code, f] of Object.entries(flags)) {
      const at = place(code);
      if (!at || !(f.fav || f.want)) continue;
      rows.flags[placeKey(at)] = { ...at, is_favorite: !!f.fav, wants_visit: !!f.want, client_updated_at: iso(f.ts) };
    }
    return rows;
  }

  // The time is left out on purpose: re-saving the same values is not a change.
  const same = (a, b) => {
    const strip = ({ client_updated_at, ...rest }) => JSON.stringify(rest);
    return strip(a) === strip(b);
  };

  function diff(base, next) {
    const known = base || emptyRows();
    const changes = {};
    for (const table of Object.keys(next)) {
      const save = Object.entries(next[table])
        .filter(([key, row]) => !known[table][key] || !same(known[table][key], row))
        .map(([key, row]) => ({ row, known: !!known[table][key] }));
      const remove = Object.entries(known[table]).filter(([key]) => !next[table][key]).map(([, row]) => row);
      changes[table] = { save, remove };
    }
    return changes;
  }

  const isEmpty = changes => Object.values(changes).every(c => !c.save.length && !c.remove.length);

  // A photo without an id still waits on this device for its upload.
  const waiting = holder => (holder?.pics || []).filter(p => !p.id);

  // Everything of this kind that has a file on this device or the server, for finding removed photos.
  function photoIds({ custom, photos }) {
    const ids = {};
    for (const holder of [...Object.values(custom), ...Object.values(photos)]) {
      for (const p of holder.pics || []) if (p.id) ids[p.id] = true;
    }
    return ids;
  }

  // Photos waiting for an upload, with the place their row will point at. Places unknown to the server wait.
  function pendingPhotos({ custom, photos }) {
    const list = [];
    for (const a of Object.values(custom)) {
      if (a.id) for (const pic of waiting(a)) list.push({ pic, airfield_code: null, custom_airfield_id: a.id });
    }
    for (const [code, holder] of Object.entries(photos)) {
      if (custom[code] || !CODE.test(code)) continue;
      for (const pic of waiting(holder)) list.push({ pic, airfield_code: code, custom_airfield_id: null });
    }
    return list;
  }

  // Builds the state from what the server holds, keeping photos that wait for their upload.
  function fromRows(server, local, newId, links = {}) {
    const localCustom = local.custom || {};
    const custom = {};
    const codeOf = {};
    const byId = Object.fromEntries(Object.values(localCustom).filter(a => a.id).map(a => [a.id, a]));
    for (const row of server.strips) {
      const local = byId[row.id];
      const code = local ? local.code : `C${row.id.replace(/-/g, '').toUpperCase()}`;
      codeOf[row.id] = code;
      custom[code] = {
        code, id: row.id, name: row.name, short: row.short || '', desc: row.description || '',
        lat: row.lat, lon: row.lon, elev: row.elev || '', town: row.town || '', custom: true,
        pics: [], ts: Date.parse(row.client_updated_at),
      };
    }
    const code = row => (row.custom_airfield_id ? codeOf[row.custom_airfield_id] : row.airfield_code);
    const notes = {};
    for (const row of server.notes) { // sorted oldest first, the newest note of a place wins
      notes[placeKey(row)] = row;
    }
    const visited = {};
    for (const row of server.landings) {
      const at = code(row);
      if (at) visited[at] = { date: row.landed_on || '', note: notes[placeKey(row)]?.body || '', ts: Date.parse(row.client_updated_at) };
    }
    const flags = {};
    for (const row of server.flags) {
      const at = code(row);
      if (!at) continue;
      flags[at] = { ...(row.is_favorite ? { fav: true } : {}), ...(row.wants_visit ? { want: true } : {}), ts: Date.parse(row.client_updated_at) };
    }
    // What toRows left out never reached the server, so it must not vanish from the device either.
    for (const a of Object.values(localCustom)) {
      if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) custom[a.code] = { ...a, pics: [] };
    }
    const neverSent = code => custom[code] ? !codeOf[custom[code].id] : !localCustom[code] && !CODE.test(code);
    for (const [from, to] of [[local.visited, visited], [local.flags, flags]]) {
      for (const [code, value] of Object.entries(from || {})) if (neverSent(code)) to[code] = value;
    }
    const photos = {};
    const holderOf = at => custom[at] || (photos[at] ||= { pics: [] });
    for (const row of server.photos || []) {
      const at = code(row);
      if (at) holderOf(at).pics.push({ id: row.id, ...links[row.id], ...(row.is_public ? { pub: true } : {}) });
    }
    for (const a of Object.values(custom)) if (localCustom[a.code]) a.pics.push(...waiting(localCustom[a.code]));
    for (const [at, holder] of Object.entries(local.photos || {})) {
      if (waiting(holder).length && !localCustom[at]) holderOf(at).pics.push(...waiting(holder));
    }
    const state = { visited, custom, flags, photos };
    return { ...state, photoIds: photoIds({ custom, photos }), base: toRows(state, { ...emptyRows(), notes }, newId) };
  }

  const MAX_PHOTOS = 3;
  // Only photos inside the file: the old GitHub copies are gone, and a link that never loads would wait forever.
  const PHOTO_SOURCE = /^data:image\//;
  const sourcePics = o => (o?.pics || (o?.photo ? [{ url: o.photo, path: o.photoPath }] : []));

  // Adds a backup file to an account. Repeating it changes nothing: what the account already holds wins,
  // and ids come from the source. Only known fields are taken, the file is not trusted.
  async function mergeImport(data, current, stableId) {
    const state = JSON.parse(JSON.stringify(current));
    const added = { landings: 0, flags: 0, photos: 0, strips: 0 };
    const now = Date.now();
    const source = data.visited || data.custom ? data.visited || {} : data;
    const target = {};
    for (const [code, a] of Object.entries(data.custom || {})) {
      const id = await stableId(`strip:${code}`);
      const known = Object.values(state.custom).find(c => c.id === id);
      if (known) { target[code] = known.code; continue; }
      const at = state.custom[code] ? `C${id.replace(/-/g, '').toUpperCase()}` : code;
      state.custom[at] = {
        code: at, id, name: String(a.name || at), short: String(a.short || ''), desc: String(a.desc || ''),
        lat: Number(a.lat), lon: Number(a.lon), elev: String(a.elev || ''), town: String(a.town || ''),
        custom: true, pics: [], ts: a.ts || now,
      };
      target[code] = at;
      added.strips += 1;
    }
    const place = code => target[code] || code;
    for (const [code, v] of Object.entries(source)) {
      if (state.visited[place(code)] || !v || typeof v !== 'object') continue;
      state.visited[place(code)] = { date: String(v.date || ''), note: String(v.note || ''), ts: v.ts || now };
      added.landings += 1;
    }
    for (const [code, f] of Object.entries(data.flags || {})) {
      if (state.flags[place(code)] || !(f?.fav || f?.want)) continue;
      state.flags[place(code)] = { ...(f.fav ? { fav: true } : {}), ...(f.want ? { want: true } : {}), ts: f.ts || now };
      added.flags += 1;
    }
    for (const [code, holder] of [...Object.entries(data.photos || {}), ...Object.entries(data.custom || {})]) {
      const at = place(code);
      for (const p of sourcePics(holder)) {
        if (!PHOTO_SOURCE.test(String(p.url))) continue;
        const pid = await stableId(`photo:${p.path || p.url}`);
        const into = state.custom[at] || (state.photos[at] ||= { pics: [] });
        into.pics ||= [];
        if (into.pics.some(x => (x.id || x.pid) === pid) || into.pics.length >= MAX_PHOTOS) continue;
        into.pics.push({ url: p.url, pid });
        added.photos += 1;
      }
    }
    return { state, added };
  }

  window.syncCore = Object.freeze({ toRows, diff, isEmpty, fromRows, photoIds, pendingPhotos, mergeImport });
})();
