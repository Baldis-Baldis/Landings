// Admin page. It only shows what the database lets an admin read: totals, reported content and feedback.
// Hiding this page protects nothing, every call is checked by is_admin() on the server.
// All text from users goes in through textContent.
(() => {
  const root = document.getElementById('admin');
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const button = (text, onclick, className) => {
    const b = el('button', className, text);
    b.type = 'button';
    b.onclick = async () => {
      b.disabled = true;
      try { await onclick(); await show(); } catch (e) { console.warn('admin', e); b.disabled = false; alert('Nepodařilo se.'); }
    };
    return b;
  };
  const day = iso => String(iso || '').slice(0, 10);
  const backLink = () => {
    const a = el('a', '', 'Zpět na mapu');
    a.href = './';
    return a;
  };

  const REASONS = { spam: 'spam', offensive: 'urážlivé', illegal: 'nezákonné', privacy: 'soukromí', copyright: 'autorská práva', other: 'jiné' };
  const STATS = [
    ['users', 'účtů'], ['users_new_7d', 'nových za 7 dní'], ['users_new_30d', 'nových za 30 dní'],
    ['users_active_7d', 'aktivních za 7 dní'], ['users_active_30d', 'aktivních za 30 dní'], ['profiles', 's přezdívkou'],
    ['landings', 'přistání'], ['custom_airfields', 'vlastních ploch'], ['comments', 'komentářů'],
    ['comments_public', 'veřejných komentářů'], ['photos', 'fotek'], ['photos_public', 'veřejných fotek'],
    ['reports_open', 'otevřených hlášení'], ['feedback_new', 'nových vzkazů'],
  ];

  function stats(s) {
    const box = el('section');
    const grid = el('div', 'stats');
    for (const [key, label] of STATS) {
      const tile = el('div', 'stat');
      tile.append(el('b', '', String(s[key] ?? '–')), el('span', '', label));
      grid.append(tile);
    }
    const mb = (Number(s.storage_bytes) || 0) / 1048576;
    const storage = el('div', 'stat');
    storage.append(el('b', '', `${mb.toFixed(1)} MB`), el('span', '', 'fotky ve Storage (Free 1 GB)'));
    grid.append(storage);
    box.append(el('h2', '', 'Statistiky'), grid);
    const days = Array.isArray(s.signups_by_day) ? s.signups_by_day : [];
    const max = Math.max(1, ...days.map(d => Number(d.count) || 0));
    const chart = el('div', 'days');
    for (const d of days) {
      const bar = el('div');
      bar.style.height = `${(100 * (Number(d.count) || 0)) / max}%`;
      bar.title = `${d.day}: ${d.count}`;
      chart.append(bar);
    }
    box.append(el('div', 'meta', 'Registrace po dnech za 30 dní (dny bez registrace chybí)'), chart);
    return box;
  }

  function report(item) {
    const row = el('div', 'item');
    const what = item.comment_id ? 'Komentář' : 'Fotka';
    row.append(el('div', 'meta', `${what} · ${item.airfield_code || '?'} · autor ${item.author || 'bez přezdívky'}`
      + ` · ${item.is_public ? 'veřejné' : 'soukromé'} · ${item.moderation === 'hidden' ? 'skryté' : 'viditelné'}`));
    if (item.body !== null) row.append(el('div', 'body', item.body));
    else if (item.comment_id) row.append(el('div', 'meta', 'Obsah už neexistuje nebo ho nelze číst.'));
    if (/^https:/.test(item.thumb || '')) {
      const img = el('img');
      img.src = item.thumb;
      img.alt = '';
      if (/^https:/.test(item.url || '')) img.onclick = () => window.open(item.url, '_blank', 'noopener');
      row.append(img);
    }
    for (const r of item.reports) {
      const changed = item.comment_id && r.reported_body !== null && r.reported_body !== item.body;
      row.append(el('div', 'meta', `${day(r.created_at)} · ${REASONS[r.reason] || r.reason} · nahlásil ${r.reporter || 'bez přezdívky'}`));
      if (r.details) row.append(el('div', 'body', r.details));
      if (changed) row.append(el('div', 'meta', 'Text při nahlášení:'), el('div', 'body', r.reported_body));
    }
    const target = { comment_id: item.comment_id, photo_id: item.photo_id };
    row.append(
      button('Skrýt', () => window.backend.adminModerate(target, 'hidden', 'resolved'), 'danger'),
      button('Ponechat', () => window.backend.adminModerate(target, 'visible', 'dismissed')),
    );
    return row;
  }

  function feedbackItem(f) {
    const row = el('div', 'item');
    row.append(el('div', 'meta', `${day(f.created_at)} · ${f.author || 'bez přezdívky'} · ${f.app_version || '?'} · ${f.status}`),
      el('div', 'body', f.message));
    if (f.status === 'new') row.append(button('Přečteno', () => window.backend.setFeedbackStatus(f.id, 'read')));
    row.append(button('Uzavřít', () => window.backend.setFeedbackStatus(f.id, 'closed')));
    return row;
  }

  function list(title, items, draw, empty) {
    const box = el('section');
    box.append(el('h2', '', `${title} (${items.length})`));
    if (!items.length) box.append(el('div', 'meta', empty));
    for (const item of items) box.append(draw(item));
    return box;
  }

  async function show() {
    const [s, reports, feedback] = [
      await window.backend.adminStats(),
      await window.backend.adminReports(),
      await window.backend.adminFeedback(),
    ];
    root.replaceChildren(
      el('h1', '', 'Správa MyLandings'), backLink(), stats(s),
      list('Nahlášený obsah', reports, report, 'Žádná otevřená hlášení.'),
      list('Vzkazy', feedback, feedbackItem, 'Žádné vzkazy.'),
    );
  }

  async function start() {
    try {
      if (!(await window.backend.isAdmin())) {
        root.replaceChildren(el('p', '', 'Tato stránka je jen pro správce. Přihlaste se v aplikaci účtem správce.'), backLink());
        return;
      }
      await show();
    } catch (e) {
      console.warn('admin', e);
      root.replaceChildren(el('p', '', 'Načtení selhalo.'), backLink());
    }
  }

  start();
})();
