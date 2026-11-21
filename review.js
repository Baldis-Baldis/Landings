// The "Rate the airfield" form, shown in place of the card (one panel at a time). Text the user types stays in
// form fields; nothing from outside goes in as HTML. The filled-in form is kept on this device as a draft until it
// is published or cancelled, so going offline or a failed sync never loses it.
(() => {
  const FACTS = ['rest', 'wc', 'fuel', 'bus', 'bike', 'stay', 'night', 'fee'];
  const MAX_BODY = 2000;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, onclick, className) => {
    const b = el('button', className, text);
    b.type = 'button';
    b.onclick = onclick;
    return b;
  };
  const stage = (e, name) => { try { e.stage = name; } catch (x) { /* frozen */ } return e; };

  /*
   * Publishing in three steps, each safe to repeat after a failure:
   * 1. sync, so the landing (and photos waiting on this device) are on the server; the database wants the landing.
   *    A failed photo upload does not stop the review, the photo just cannot be shared yet.
   * 2. save the review: insert, or update the existing one, never a second review.
   * 3. switch sharing of the photos the form asks to change; only those that differ, so a repeat redoes only
   *    what failed.
   * deps: sync(), landed(), save({rating, facts, body}), pics() (the log's photos), setShared(id, on).
   */
  async function publish(values, deps) {
    try { await deps.sync(); } catch (e) {
      if (!/^photo/.test(String(e && e.message))) throw stage(e, 'sync');
    }
    if (!deps.landed()) throw stage(new Error('no landing'), 'landing');
    await deps.save({ rating: values.rating, facts: values.facts, body: values.body });
    let failed = 0;
    for (const p of deps.pics()) {
      const key = p.id || p.pid;
      if (!key || !Object.prototype.hasOwnProperty.call(values.share || {}, key)) continue;
      const want = !!values.share[key];
      if (!!p.pub === want) continue;
      if (!p.id) { failed++; continue; } // not uploaded yet
      try { await deps.setShared(p.id, want); } catch (e) { console.warn('share', e); failed++; }
    }
    if (failed) throw stage(new Error('share'), 'share');
  }

  // what the user reads after a failure; the form always stays filled in
  function failureText(e, t) {
    if (e && e.stage === 'share') return t('rvfSharePartial');
    if (e && e.stage === 'landing') return t('rvfNoLanding');
    const m = String((e && (e.message || e.msg)) || e || '');
    if ((e && e.name === 'TypeError') || /fetch|network|offline/i.test(m) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return t('rvfOffline');
    if (/nickname/i.test(m)) return t('rvfNick');
    if (/landed there/i.test(m)) return t('rvfNoLanding');
    return t('rvfFail');
  }

  /*
   * ctx: t, name, code, landedOn (date or ''), review (the own one or null), nickname(), askNickname(),
   * pics() photos of the log ({id|pid, pub, thumb|url}), maxPics, addPhotos(files) -> keys of the new photos,
   * draft() / saveDraft(values) / clearDraft(), publish(values), remove(), close(), onResize(), icon(key).
   */
  function build(ctx) {
    const { t } = ctx;
    const editing = !!ctx.review;
    const start = ctx.draft() || (editing
      ? { rating: ctx.review.rating, facts: ctx.review.facts || [], body: ctx.review.body || '', share: {} }
      : { rating: 0, facts: [], body: '', share: {} });
    const v = {
      rating: Number(start.rating) || 0,
      facts: new Set((start.facts || []).filter(f => FACTS.includes(f))),
      body: String(start.body || '').slice(0, MAX_BODY),
      share: { ...(start.share || {}) },
    };
    const values = () => ({ rating: v.rating, facts: FACTS.filter(f => v.facts.has(f)), body: v.body, share: { ...v.share } });
    const keep = () => { ctx.saveDraft(values()); update(); };

    const form = el('div', 'reviewform');
    form.append(el('h3', '', t(editing ? 'rvfEdit' : 'rvfNew')));
    form.append(el('div', 'm', [ctx.name, ctx.code, ctx.landedOn ? t('landedOn')(ctx.landedOn) : ''].filter(Boolean).join(' · ')));

    const nick = el('div', 'rvfnick');
    nick.append(el('p', '', t('rvfNick')), button(t('rvfNickBtn'), () => ctx.askNickname(), 'btn sec'));
    form.append(nick);

    // the stars: a radio group, 44 px each, arrows move the choice
    form.append(el('div', 'q', t('rvfHow')));
    const starRow = el('div', 'bigstars');
    starRow.setAttribute('role', 'radiogroup');
    starRow.setAttribute('aria-label', t('rvfHow'));
    const word = el('div', 'word');
    const starBtns = [1, 2, 3, 4, 5].map(n => {
      const b = button('★', () => { v.rating = n; keep(); }, 'star');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', `${n} – ${t('rvfWords')[n - 1]}`);
      b.onkeydown = e => {
        const next = { ArrowRight: n + 1, ArrowUp: n + 1, ArrowLeft: n - 1, ArrowDown: n - 1 }[e.key];
        if (next >= 1 && next <= 5) { e.preventDefault(); v.rating = next; keep(); starBtns[next - 1].focus(); }
      };
      starRow.append(b);
      return b;
    });
    form.append(starRow, word);

    // facilities: toggles
    form.append(el('div', 'q', t('rvfWhat')));
    const tiles = el('div', 'tiles');
    const tileBtns = FACTS.map(f => {
      const b = button('', () => { if (v.facts.has(f)) v.facts.delete(f); else v.facts.add(f); keep(); }, 'tile');
      b.append(ctx.icon(f), el('span', '', t(`fact_${f}`)));
      tiles.append(b);
      return [f, b];
    });
    form.append(tiles, el('div', 'small', t('rvfWhatHint')), el('div', 'small', t('rvfWhatNote')));

    form.append(el('div', 'q', t('rvfComment')));
    const text = el('textarea', 'rvfbody');
    text.name = 'review-body';
    text.maxLength = MAX_BODY;
    text.placeholder = t('rvfCommentPh');
    text.value = v.body;
    const count = el('div', 'cnt');
    text.oninput = () => { v.body = text.value.slice(0, MAX_BODY); keep(); };
    form.append(text, count);

    // photos of the log, with "share" ticks in the same state as the labels on the card
    form.append(el('div', 'q', t('rvfPhotos')));
    const photos = el('div', 'fp');
    form.append(photos);
    function drawPhotos() {
      const list = ctx.pics();
      const nodes = list.map((p, i) => {
        const key = p.id || p.pid;
        const item = el('label', 'fpitem');
        const img = el('img');
        img.src = p.thumb || p.url;
        img.alt = '';
        const box = el('input');
        box.type = 'checkbox';
        box.name = 'share';
        box.value = String(i);
        box.checked = key && Object.prototype.hasOwnProperty.call(v.share, key) ? !!v.share[key] : !!p.pub;
        box.disabled = !key;
        box.onchange = () => { v.share[key] = box.checked; item.className = `fpitem${box.checked ? ' shared' : ''}`; keep(); };
        const line = el('span', '');
        line.append(box, ` ${p.id ? t('rvfShare') : t('picUploading')}`);
        item.append(img, line);
        if (box.checked) item.className = 'fpitem shared';
        return item;
      });
      if (list.length < ctx.maxPics) {
        const add = el('label', 'addphoto', t('rvfUpload'));
        const file = el('input');
        file.type = 'file';
        file.name = 'review-photo';
        file.accept = 'image/*';
        file.multiple = true;
        file.onchange = async () => {
          const keys = await ctx.addPhotos([...file.files]);
          for (const k of keys) v.share[k] = true; // a photo added here is meant for the pilots
          keep(); drawPhotos(); ctx.onResize();
        };
        add.append(file);
        nodes.push(add);
      } else nodes.push(el('div', 'photolimit', t('photoLimit')));
      photos.replaceChildren(...nodes);
    }
    drawPhotos();

    form.append(el('div', 'warn', t('rvfWarn')));
    const error = el('div', 'err');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    form.append(error);

    const send = button(t(editing ? 'rvfSave' : 'rvfPublish'), () => run(async () => {
      await ctx.publish(values());
      ctx.clearDraft();
      ctx.close(true);
    }), 'btn');
    const cancel = button(t('rvfCancel'), () => { ctx.clearDraft(); ctx.close(false); }, 'btn sec');
    const acts = el('div', 'acts2');
    acts.append(send, cancel);
    if (editing) {
      acts.append(button(t('rvfDelete'), () => {
        if (!confirm(t('reviewDelConfirm'))) return;
        run(async () => { await ctx.remove(); ctx.clearDraft(); ctx.close(true); });
      }, 'btn danger'));
    }
    form.append(acts);

    let busy = false;
    async function run(work) {
      if (busy) return;
      busy = true; error.hidden = true; update();
      const label = send.textContent;
      send.textContent = t('rvfBusy');
      try { await work(); } catch (e) {
        console.warn('review', e);
        error.textContent = failureText(e, t);
        error.hidden = false;
      }
      send.textContent = label;
      busy = false; update(); ctx.onResize();
    }

    function update() {
      const hasNick = !!ctx.nickname();
      nick.hidden = hasNick;
      starBtns.forEach((b, i) => {
        b.className = `star${i < v.rating ? ' on' : ''}`;
        b.setAttribute('aria-checked', String(i + 1 === v.rating));
        b.tabIndex = (v.rating ? i + 1 === v.rating : i === 0) ? 0 : -1;
      });
      word.textContent = v.rating ? t('rvfWords')[v.rating - 1] : '';
      for (const [f, b] of tileBtns) {
        b.className = `tile${v.facts.has(f) ? ' on' : ''}`;
        b.setAttribute('aria-pressed', String(v.facts.has(f)));
      }
      count.textContent = `${[...v.body].length} / ${MAX_BODY}`;
      send.disabled = busy || !v.rating || !hasNick;
    }
    update();
    return form;
  }

  window.reviewForm = Object.freeze({ build, publish, failureText });
})();
