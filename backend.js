// The only module that talks to the server, so the backend can be swapped.
// Load after vendor/supabase.js and config.js. The rest of the app uses window.backend only.
(() => {
  const { supabaseUrl, publishableKey } = window.MYLANDINGS_CONFIG;
  const client = window.supabase.createClient(supabaseUrl, publishableKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const redirectTo = () => `${location.origin}/`;
  const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
  };
  const toUser = session => (session ? { id: session.user.id, email: session.user.email } : null);

  async function currentUser() {
    return toUser(unwrap(await client.auth.getSession()).session);
  }

  const BUCKET = 'photos';
  const LINK_SECONDS = 3600;
  const photoFiles = (userId, id, full, thumb) => [[`${userId}/${id}.jpg`, full], [`${userId}/${id}_thumb.jpg`, thumb]];

  const PAGE = 1000; // the server's limit for one response
  async function readAll(build) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const page = unwrap(await build().range(from, from + PAGE - 1));
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }
  const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) },
    (_, i) => items.slice(i * size, (i + 1) * size));
  const PLACE = 'user_id,airfield_code,custom_airfield_id';

  async function upsertPlaces(table, changes) {
    for (const part of chunks(changes.map(c => c.row), 500)) {
      unwrap(await client.from(table).upsert(part, { onConflict: PLACE }));
    }
  }

  // The client may not rewrite the id or the place of these rows, so an upsert is not an option:
  // a new row is inserted, and whatever already exists (a repeated send) is updated.
  async function saveById(table, changes, editable) {
    const inserted = new Set();
    for (const part of chunks(changes.filter(c => !c.known).map(c => c.row), 500)) {
      const rows = unwrap(await client.from(table).upsert(part, { onConflict: 'id', ignoreDuplicates: true }).select('id'));
      rows.forEach(r => inserted.add(r.id));
    }
    for (const { row } of changes.filter(c => !inserted.has(c.row.id))) {
      const fields = Object.fromEntries(editable.map(k => [k, row[k]]));
      unwrap(await client.from(table).update(fields).eq('id', row.id));
    }
  }

  async function removeByPlace(table, rows) {
    for (const [column, values] of [
      ['airfield_code', rows.filter(r => r.airfield_code).map(r => r.airfield_code)],
      ['custom_airfield_id', rows.filter(r => r.custom_airfield_id).map(r => r.custom_airfield_id)],
    ]) {
      for (const part of chunks(values, 100)) unwrap(await client.from(table).delete().in(column, part));
    }
  }

  async function removeById(table, rows) {
    for (const part of chunks(rows.map(r => r.id), 100)) unwrap(await client.from(table).delete().in('id', part));
  }

  // Shared content is sent straight away: it must not turn public from a queue later on.
  // A device with a late clock is dropped by the database without an error, hence the returned row.
  async function setShared(table, id, is_public) {
    const rows = unwrap(await client.from(table)
      .update({ is_public, client_updated_at: new Date().toISOString() }).eq('id', id).select('id'));
    if (!rows.length) throw new Error('not changed');
  }

  const SHOWN = 30; // what one airfield card shows, newest first
  const shared = (table, columns, code) => client.from(table).select(columns)
    .eq('airfield_code', code).eq('is_public', true).eq('moderation', 'visible')
    .order('created_at', { ascending: false }).limit(SHOWN);

  async function nicknames(ids) {
    if (!ids.length) return {};
    const rows = unwrap(await client.from('profiles').select('id,display_name').in('id', [...new Set(ids)]));
    return Object.fromEntries(rows.map(r => [r.id, r.display_name]));
  }

  async function signedPhotos(rows) {
    if (!rows.length) return {};
    const paths = rows.flatMap(r => [r.storage_path, r.thumb_path]);
    const signed = unwrap(await client.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS));
    return Object.fromEntries(signed.map(s => [s.path, s.signedUrl]));
  }

  window.backend = Object.freeze({
    currentUser,

    // Calls back with the user or null on every change; returns a function that stops listening.
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        // Must not await Supabase inside this callback, it would deadlock the auth lock.
        setTimeout(() => callback(toUser(session)), 0);
      });
      return () => data.subscription.unsubscribe();
    },

    // Leaves the page, the session arrives through onAuthChange after the return.
    async signInWithGoogle() {
      unwrap(await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } }));
    },

    async sendEmailCode(email, captchaToken) {
      unwrap(await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo(), ...(captchaToken ? { captchaToken } : {}) },
      }));
    },

    async verifyEmailCode(email, code) {
      return toUser(unwrap(await client.auth.verifyOtp({ email, token: code, type: 'email' })).session);
    },

    // Ends this device's session only; a global sign-out would end the other devices too.
    async signOut() {
      unwrap(await client.auth.signOut({ scope: 'local' }));
    },

    // Everything of the signed-in user that the app syncs. Notes are the user's private comments.
    async pullAccount() {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      const mine = (table, columns) => () => client.from(table).select(columns).eq('user_id', user.id);
      const [strips, landings, flags, notes, photos] = [
        await readAll(() => mine('custom_airfields', 'id,name,short,description,lat,lon,elev,town,client_updated_at')().order('id')),
        await readAll(() => mine('landings', 'airfield_code,custom_airfield_id,landed_on,client_updated_at')().order('id')),
        await readAll(() => mine('airfield_flags', 'airfield_code,custom_airfield_id,is_favorite,wants_visit,client_updated_at')().order('id')),
        await readAll(() => mine('comments', 'id,airfield_code,custom_airfield_id,body,client_updated_at')()
          .eq('is_note', true).order('client_updated_at').order('id')),
        await readAll(() => mine('photos', 'id,airfield_code,custom_airfield_id,is_public')()
          .not('uploaded_at', 'is', null).order('created_at').order('id')),
      ];
      return { strips, landings, flags, notes, photos };
    },

    // The row comes first because the storage rules require it, uploaded_at last because it shows the photo.
    // Everything here may repeat after a failed attempt.
    async uploadPhoto({ id, airfield_code, custom_airfield_id, full, thumb }) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      unwrap(await client.from('photos').upsert({ id, airfield_code, custom_airfield_id }, { onConflict: 'id', ignoreDuplicates: true }));
      for (const [path, file] of photoFiles(user.id, id, full, thumb)) {
        const { error } = await client.storage.from(BUCKET).upload(path, file, { contentType: 'image/jpeg', upsert: false });
        if (error && String(error.statusCode) !== '409') throw error;
      }
      unwrap(await client.from('photos').update({ uploaded_at: new Date().toISOString() }).eq('id', id));
    },

    // Files first: the database keeps a row until its files are gone.
    async removePhoto(id) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      unwrap(await client.storage.from(BUCKET).remove(photoFiles(user.id, id).map(([path]) => path)));
      unwrap(await client.from('photos').delete().eq('id', id));
    },

    // Addresses for showing private files, valid for an hour.
    async photoLinks(ids) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      const links = {};
      for (const part of chunks(ids, 50)) {
        const paths = part.flatMap(id => photoFiles(user.id, id).map(([path]) => path));
        const signed = unwrap(await client.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS));
        const urlOf = Object.fromEntries(signed.map(s => [s.path, s.signedUrl]));
        for (const id of part) {
          const [[fullPath], [thumbPath]] = photoFiles(user.id, id);
          links[id] = { url: urlOf[fullPath], thumb: urlOf[thumbPath] };
        }
      }
      return links;
    },

    // Strips go first and leave last, because the other rows point at them.
    async pushAccount({ strips, landings, flags, notes }) {
      await saveById('custom_airfields', strips.save,
        ['name', 'short', 'description', 'lat', 'lon', 'elev', 'town', 'client_updated_at']);
      await upsertPlaces('landings', landings.save);
      await upsertPlaces('airfield_flags', flags.save);
      await saveById('comments', notes.save, ['body', 'client_updated_at']);
      await removeById('comments', notes.remove);
      await removeByPlace('landings', landings.remove);
      await removeByPlace('airfield_flags', flags.remove);
      await removeById('custom_airfields', strips.remove);
    },

    // What others shared at an airfield, readable by guests too, and the user's own comments there.
    // Only the nickname identifies the author, the e-mail is not in any table the client reads.
    async placeContent(code) {
      const user = await currentUser();
      const [publicComments, publicPhotos, own] = [
        unwrap(await shared('comments', 'id,user_id,body,created_at', code)),
        unwrap(await shared('photos', 'id,user_id,storage_path,thumb_path', code).not('uploaded_at', 'is', null)),
        user ? unwrap(await client.from('comments').select('id,body,is_public,moderation,created_at')
          .eq('user_id', user.id).eq('airfield_code', code).eq('is_note', false)
          .order('created_at', { ascending: false }).limit(SHOWN)) : [],
      ];
      const others = rows => rows.filter(r => r.user_id !== user?.id);
      const comments = others(publicComments);
      const photos = others(publicPhotos);
      const names = await nicknames([...comments, ...photos].map(r => r.user_id));
      const links = await signedPhotos(photos);
      return {
        own,
        comments: comments.map(r => ({ id: r.id, author: names[r.user_id] || null, body: r.body, created_at: r.created_at })),
        photos: photos.map(r => ({ id: r.id, author: names[r.user_id] || null, url: links[r.storage_path], thumb: links[r.thumb_path] })),
      };
    },

    async addComment({ airfield_code, body, is_public }) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      unwrap(await client.from('comments').insert({ airfield_code, body: body.trim().slice(0, 2000), is_public: !!is_public }));
    },

    removeComment(id) { return removeById('comments', [{ id }]); },
    setCommentPublic(id, isPublic) { return setShared('comments', id, !!isPublic); },
    setPhotoPublic(id, isPublic) { return setShared('photos', id, !!isPublic); },

    // Returns 'ok' or 'already' (each user reports a thing once); other failures throw.
    async report({ comment_id = null, photo_id = null, reason, details = '' }) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      const { error } = await client.from('reports')
        .insert({ comment_id, photo_id, reason, details: details.trim().slice(0, 1000) || null });
      if (!error) return 'ok';
      if (error.code === '23505') return 'already';
      throw error;
    },

    async sendFeedback(message, app_version) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      unwrap(await client.from('feedback').insert({ message: message.trim().slice(0, 2000), app_version }));
    },

    // Only decides what the admin page shows. The protection is in the database, every admin call checks it.
    async isAdmin() {
      if (!(await currentUser())) return false;
      return unwrap(await client.rpc('is_admin')) === true;
    },

    async adminStats() { return unwrap(await client.rpc('admin_stats')); },

    // Open reports grouped by what they point at, with the content as the database lets the admin see it.
    async adminReports() {
      const reports = unwrap(await client.from('reports')
        .select('id,reporter_id,comment_id,photo_id,reason,details,comment_body,created_at')
        .eq('status', 'open').order('created_at').limit(200));
      const ids = key => [...new Set(reports.map(r => r[key]).filter(Boolean))];
      const comments = ids('comment_id').length ? unwrap(await client.from('comments')
        .select('id,user_id,airfield_code,body,is_public,moderation').in('id', ids('comment_id'))) : [];
      const photos = ids('photo_id').length ? unwrap(await client.from('photos')
        .select('id,user_id,airfield_code,storage_path,thumb_path,is_public,moderation').in('id', ids('photo_id'))) : [];
      const names = await nicknames([...reports.map(r => r.reporter_id), ...comments.map(r => r.user_id), ...photos.map(r => r.user_id)]);
      const links = await signedPhotos(photos);
      const items = new Map();
      for (const r of reports) {
        const key = r.comment_id ? `c:${r.comment_id}` : `p:${r.photo_id}`;
        if (!items.has(key)) {
          const c = r.comment_id && comments.find(x => x.id === r.comment_id);
          const p = r.photo_id && photos.find(x => x.id === r.photo_id);
          const row = c || p || {};
          items.set(key, {
            comment_id: r.comment_id, photo_id: r.photo_id, airfield_code: row.airfield_code || null,
            author: names[row.user_id] || null, body: c ? c.body : null,
            url: p ? links[p.storage_path] : null, thumb: p ? links[p.thumb_path] : null,
            is_public: !!row.is_public, moderation: row.moderation || null, reports: [],
          });
        }
        items.get(key).reports.push({
          reason: r.reason, details: r.details, reported_body: r.comment_body,
          reporter: names[r.reporter_id] || null, created_at: r.created_at,
        });
      }
      return [...items.values()];
    },

    // moderation 'hidden' or 'visible', status 'resolved' or 'dismissed'; closes every open report of the item.
    async adminModerate({ comment_id = null, photo_id = null }, moderation, status) {
      unwrap(await client.rpc('admin_moderate',
        { p_comment_id: comment_id, p_photo_id: photo_id, p_moderation: moderation, p_status: status }));
    },

    async adminFeedback() {
      const rows = unwrap(await client.from('feedback').select('id,user_id,message,app_version,status,created_at')
        .neq('status', 'closed').order('created_at', { ascending: false }).limit(200));
      const names = await nicknames(rows.map(r => r.user_id).filter(Boolean));
      return rows.map(({ user_id, ...r }) => ({ ...r, author: names[user_id] || null }));
    },

    async setFeedbackStatus(id, status) {
      const rows = unwrap(await client.from('feedback').update({ status }).eq('id', id).select('id'));
      if (!rows.length) throw new Error('not changed');
    },

    // The accepted version of the terms, or null when the user has not accepted any yet.
    async getTermsVersion() {
      const user = await currentUser();
      if (!user) return null;
      const row = unwrap(await client.from('user_settings').select('terms_version,terms_accepted_at')
        .eq('user_id', user.id).maybeSingle());
      return row && row.terms_accepted_at ? row.terms_version : null;
    },

    async acceptTerms(terms_version) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      // user_id comes from the column default auth.uid(), as with the nickname.
      unwrap(await client.from('user_settings')
        .upsert({ terms_version, terms_accepted_at: new Date().toISOString() }, { onConflict: 'user_id' }));
    },

    // Everything the account can read about itself. Photo links are valid for an hour.
    async exportAccount() {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      const mine = (table, columns, owner = 'user_id') => readAll(() => client.from(table).select(columns).eq(owner, user.id).order('id'));
      const photos = await readAll(() => client.from('photos').select('*').eq('user_id', user.id).order('id'));
      const links = await signedPhotos(photos.filter(p => p.uploaded_at));
      return {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email },
        profile: (await mine('profiles', 'id,display_name', 'id'))[0] || null,
        settings: unwrap(await client.from('user_settings').select('*').eq('user_id', user.id).maybeSingle()),
        custom_airfields: await mine('custom_airfields', '*'),
        landings: await mine('landings', '*'),
        airfield_flags: await mine('airfield_flags', '*'),
        comments: await mine('comments', '*'),
        photos: photos.map(p => ({ ...p, url: links[p.storage_path] || null, thumb_url: links[p.thumb_path] || null })),
      };
    },

    // Files first, then the account: the database refuses while files remain. Ends with a local sign-out.
    async deleteAccount() {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      const rows = await readAll(() => client.from('photos').select('id').eq('user_id', user.id).order('id'));
      for (const part of chunks(rows.flatMap(r => photoFiles(user.id, r.id).map(([path]) => path)), 100)) {
        unwrap(await client.storage.from(BUCKET).remove(part));
      }
      unwrap(await client.rpc('delete_my_account'));
      await client.auth.signOut({ scope: 'local' });
    },

    async getNickname() {
      const user = await currentUser();
      if (!user) return null;
      const row = unwrap(await client.from('profiles').select('display_name').eq('id', user.id).maybeSingle());
      return row ? row.display_name : null;
    },

    // Returns 'ok', 'taken' or 'invalid'; other failures throw. Trims because the database rejects outer spaces.
    async setNickname(nickname) {
      const user = await currentUser();
      if (!user) throw new Error('not signed in');
      const display_name = nickname.trim();
      if ([...display_name].length < 3 || [...display_name].length > 30) return 'invalid';
      // The client may write display_name only, id comes from the column default auth.uid().
      const { error } = await client.from('profiles').upsert({ display_name }, { onConflict: 'id' });
      if (!error) return 'ok';
      if (error.code === '23505') return 'taken';
      if (error.code === '23514') return 'invalid';
      throw error;
    },
  });
})();
