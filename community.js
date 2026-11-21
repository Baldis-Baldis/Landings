// "From pilots" in an airfield card: the public summary of reviews, facilities and shared photos, the reviews
// themselves and the strip that invites to rate. Other people's text goes in through textContent only, never as
// HTML. When the card opens it asks for one small summary; reviews and photos load only when the section opens.
(() => {
  const REASONS = ['spam', 'offensive', 'illegal', 'privacy', 'copyright', 'other']; // the database allows these
  // the facilities the database accepts, in the order of the form
  const FACTS = ['rest', 'wc', 'fuel', 'bus', 'bike', 'stay', 'night', 'fee'];
  const SHOWN = 3, MORE = 10, PHOTOS = 4, CACHE_MS = 60000;
  const SVG = 'http://www.w3.org/2000/svg';
  // icons drawn in the app's line style, 24 × 24; [element, attributes] pairs, never markup from outside
  const ICONS = {
    rest: [['path', { d: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 4-3 7h3v11' }]],
    wc: [['circle', { cx: 7, cy: 4.5, r: 1.6 }], ['circle', { cx: 17, cy: 4.5, r: 1.6 }],
      ['path', { d: 'M5 9h4v6H8v6H6v-6H5zM15.5 9h3l2 7h-2v5h-3v-5h-2z' }]],
    fuel: [['path', { d: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 8h6M14 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3' }]],
    bus: [['rect', { x: 4, y: 3, width: 16, height: 15, rx: 3 }], ['path', { d: 'M4 11h16M7 21v-3M17 21v-3M8 14.5h.01M16 14.5h.01' }]],
    bike: [['circle', { cx: 5.5, cy: 16, r: 3.5 }], ['circle', { cx: 18.5, cy: 16, r: 3.5 }],
      ['path', { d: 'M5.5 16l4-8h6l3 8M9.5 8l3 8h-7M14 5h3' }]],
    stay: [['path', { d: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6' }], ['circle', { cx: 7, cy: 11, r: 2 }]],
    night: [['path', { d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5zM12 17v-6h2.2a1.8 1.8 0 0 1 0 3.6H12' }]],
    fee: [['circle', { cx: 12, cy: 12, r: 8.5 }],
      ['path', { d: 'M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.4-2.6-1.2M12 6.5V8M12 16v1.5' }]],
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, onclick, className = 'commbtn') => {
    const b = el('button', className, text);
    b.type = 'button';
    b.onclick = onclick;
    return b;
  };
  function icon(key) {
    const svg = document.createElementNS(SVG, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    for (const [tag, attrs] of ICONS[key] || []) {
      const part = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) part.setAttribute(k, String(v));
      svg.append(part);
    }
    return svg;
  }
  // five stars filled to the rating, halves included; the number is for screen readers
  function stars(value, t, className = 'stars') {
    const s = el('span', className, '★★★★★');
    s.style.setProperty('--fill', `${Math.max(0, Math.min(5, value)) * 20}%`);
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', t('starsOf')(String(Math.round(value * 10) / 10)));
    return s;
  }
  const initials = name => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  };

  // summaries per airfield, so a card redrawn after a tap does not ask again; dropped after a change
  const summaries = new Map();
  const opened = new Set(); // sections left open while the card redraws
  function forget(code) { summaries.delete(code); }

  /*
   * opts: t (texts), lang() 'cs'/'en', fmtDate(iso), fmtMonth('YYYY-MM') e.g. 11/2026, signedIn(), landedOn() (the date of the own landing, '' when
   * landed without a date, null when not landed), myReview() (own review or null), onResize(), openPhoto(urls, i),
   * onRate(review or null) opens the form, onChanged() after the own review was deleted.
   */
  function section(code, opts) {
    const { t } = opts;
    const box = el('section', 'pilots');
    const details = el('details', 'pilbox');
    const head = el('summary', 'pilhead');
    const body = el('div', 'pilbody');
    const strip = el('div', 'pilbar');
    details.append(head, body);
    box.append(details, strip);
    if (opened.has(code)) details.open = true;

    const number = v => v.toLocaleString(opts.lang() === 'cs' ? 'cs-CZ' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const message = text => body.replaceChildren(el('div', 'commhint', text));
    const failure = e => t(e && e.code === 'P0001' ? 'commLimit' : 'commFail');

    // ---------- the header: name, average and count, the facilities as small icons ----------
    function drawHead(sum) {
      const title = el('span', 'piltitle', t('community'));
      const avg = el('span', 'pilavg');
      if (sum && sum.n) avg.append(el('span', 'pilstar', '★'), ` ${number(sum.avg || 0)} `, el('small', '', `(${sum.n})`));
      else if (sum) avg.append(el('small', '', t('noRatings')));
      const row = el('span', 'pilrow');
      row.append(title, avg);
      const nodes = [row];
      if (sum && sum.facts.length) {
        const mini = el('span', 'minifx');
        for (const f of sum.facts) {
          const i = el('span', 'fx', '');
          i.title = t(`fact_${f.key}`);
          i.setAttribute('role', 'img');
          i.setAttribute('aria-label', t(`fact_${f.key}`));
          i.append(icon(f.key));
          mini.append(i);
        }
        nodes.push(mini);
      }
      head.replaceChildren(...nodes);
    }

    // ---------- the strip below: what the user can do here ----------
    function drawStrip() {
      const mine = opts.myReview();
      const landed = opts.landedOn();
      const nodes = [];
      let grey = true;
      if (!opts.signedIn()) nodes.push(el('p', '', t('rateNeedAccount')));
      else if (mine) {
        const p = el('p', '', `${t('yourRating')} `);
        p.append(stars(mine.rating, t));
        nodes.push(p, button(t('editBtn'), () => opts.onRate(mine), 'btn sec'));
        grey = false;
      } else if (landed == null) nodes.push(el('p', '', t('rateNeedLanding')));
      else {
        nodes.push(el('p', '', landed ? t('rateLanded')(opts.fmtDate(landed)) : t('rateLandedNoDate')),
          button(t('rateBtn'), () => opts.onRate(null), 'btn'));
        grey = false;
      }
      strip.className = `pilbar${grey ? ' grey' : ''}`;
      strip.replaceChildren(...nodes);
    }

    // ---------- reporting: a small form in place, signed-in users and other people's content only ----------
    function reportButton(target, label = t('commReport'), className = 'commbtn') {
      const wrap = el('div', 'commreport');
      const open = button(label, () => {
        const reason = el('select');
        reason.name = 'reason';
        for (const r of REASONS) {
          const option = el('option', '', t(`reason_${r}`));
          option.value = r;
          reason.append(option);
        }
        const details = el('input');
        details.name = 'details';
        details.maxLength = 1000;
        details.placeholder = t('commReportDetails');
        const send = button(t('commReportSend'), async () => {
          send.disabled = true;
          try {
            const result = await window.backend.report({ ...target, reason: reason.value, details: details.value });
            wrap.replaceChildren(el('div', 'commhint', t(result === 'already' ? 'commAlready' : 'commReported')));
          } catch (e) {
            console.warn('report', e);
            wrap.replaceChildren(el('div', 'commhint', failure(e)));
          }
          opts.onResize();
        });
        wrap.replaceChildren(reason, details, send);
        opts.onResize();
      }, className);
      open.setAttribute('aria-label', t('commReport'));
      open.title = t('commReport');
      wrap.append(open);
      return wrap;
    }

    function thumbs(list, all, className) {
      const row = el('div', className);
      for (const p of list) {
        const img = el('img');
        img.src = p.thumb;
        img.alt = '';
        img.onclick = () => opts.openPhoto(all.map(x => x.url), all.indexOf(p));
        row.append(img);
      }
      return row;
    }

    function review(r, all) {
      const item = el('div', `rv${r.own ? ' own' : ''}`);
      const name = r.own ? t('commYou') : r.author || t('commUnknown');
      const top = el('div', 'rvh');
      const who = el('div', 'who');
      who.append(el('span', 'nick', name), ' ', stars(r.rating, t));
      // a public review shows only the month and year of the visit, never the day (the exact date stays in My log)
      const meta = el('div', 'meta', [r.visited_month ? t('landedOn')(opts.fmtMonth(r.visited_month)) : '',
        r.moderation === 'hidden' ? t('commHidden') : ''].filter(Boolean).join(' · '));
      const text = el('div');
      text.append(who, meta);
      top.append(el('span', 'ini', initials(r.own ? opts.nickname() || name : name)), text);
      if (!r.own && opts.signedIn()) top.append(reportButton({ review_id: r.id }, '⚑', 'flagbtn'));
      item.append(top);
      if (r.body) item.append(el('p', 'rvtext', r.body));
      if (r.photos.length) item.append(thumbs(r.photos, all, 'rvthumbs'));
      if (r.own) {
        const acts = el('div', 'rvacts');
        acts.append(button(t('editBtn'), () => opts.onRate(opts.myReview() || r), 'btn sec'),
          button(t('commDelete'), async () => {
            if (!confirm(t('reviewDelConfirm'))) return;
            try {
              await window.backend.deleteReview(r.id);
              forget(code);
              opts.onChanged();
            } catch (e) { console.warn('review', e); message(failure(e)); opts.onResize(); }
          }, 'btn danger'));
        item.append(acts);
      }
      return item;
    }

    // ---------- the opened section ----------
    function view(sum, { reviews, photos }) {
      const nodes = [];
      const top = el('div', 'sum');
      if (sum && sum.n) {
        const right = el('div');
        right.append(stars(sum.avg || 0, t, 'stars big'), el('small', '', t('nRatings')(sum.n)));
        top.append(el('div', 'bigavg', number(sum.avg || 0)), right);
      } else top.append(el('div', 'commhint', t('noRatings')));
      nodes.push(top);

      if (sum && sum.facts.length) {
        nodes.push(el('div', 'h4', t('factsHead')));
        const grid = el('div', 'fxgrid');
        for (const f of sum.facts) {
          const cell = el('div');
          const ring = el('span', 'ring');
          ring.append(icon(f.key));
          cell.append(ring, el('span', '', t(`fact_${f.key}`)), el('b', '', `✓ ${f.n}`));
          grid.append(cell);
        }
        nodes.push(grid);
      }

      if (photos.length) {
        nodes.push(el('div', 'h4', t('photosHead')));
        const gal = el('div', 'pilgal');
        const many = photos.length > PHOTOS;
        photos.slice(0, PHOTOS).forEach((p, i) => {
          const fig = el('figure');
          const img = el('img');
          img.src = p.thumb;
          img.alt = '';
          img.onclick = () => opts.openPhoto(photos.map(x => x.url), i);
          fig.append(img);
          if (many && i === PHOTOS - 1) {
            const more = button(`+${photos.length - PHOTOS + 1}`, () => opts.openPhoto(photos.map(x => x.url), i), 'more');
            fig.append(more);
          } else {
            fig.append(el('figcaption', '', p.own ? t('commYou') : p.author || t('commUnknown')));
            if (!p.own && opts.signedIn()) fig.append(reportButton({ photo_id: p.id }, '⚑', 'flagbtn'));
          }
          gal.append(fig);
        });
        nodes.push(gal);
      }

      // the own review always first, then the newest reviews with a text
      const own = reviews.filter(r => r.own);
      const texts = reviews.filter(r => !r.own && r.body);
      if (own.length || texts.length) {
        nodes.push(el('div', 'h4', t('reviewsHead')));
        const list = el('div', 'rvlist');
        own.forEach(r => list.append(review(r, photos)));
        let shown = 0;
        const more = button('', () => showMore(MORE), 'showmore');
        const showMore = n => {
          texts.slice(shown, shown + n).forEach(r => list.append(review(r, photos)));
          shown = Math.min(texts.length, shown + n);
          more.textContent = t('moreReviews')(Math.min(MORE, texts.length - shown));
          more.hidden = shown >= texts.length;
          opts.onResize();
        };
        nodes.push(list, more);
        showMore(SHOWN);
      }
      nodes.push(el('div', 'pilfoot', t('pilotsFoot')));
      return nodes;
    }

    async function summary() {
      const hit = summaries.get(code);
      if (hit && Date.now() - hit.at < CACHE_MS) return hit.sum;
      const sum = await window.backend.airfieldSummary(code);
      summaries.set(code, { sum, at: Date.now() });
      return sum;
    }

    let sum = null, loaded = false;
    async function openBody() {
      loaded = true;
      message(t('commLoading'));
      opts.onResize();
      try {
        const [s, data] = await Promise.all([summary(), window.backend.airfieldReviews(code)]);
        sum = s;
        drawHead(sum);
        body.replaceChildren(...view(sum, data));
      } catch (e) {
        console.warn('pilots', e);
        loaded = false;
        message(failure(e));
      }
      opts.onResize();
    }

    drawHead(summaries.get(code)?.sum || null);
    drawStrip();
    summary().then(s => { sum = s; drawHead(s); opts.onResize(); }).catch(e => console.warn('summary', e));
    details.addEventListener('toggle', () => {
      if (details.open) opened.add(code); else opened.delete(code);
      if (details.open && !loaded) openBody();
      else opts.onResize();
    });
    if (details.open) openBody();
    return box;
  }

  window.community = Object.freeze({ section, forget, icon, FACTS });
})();
