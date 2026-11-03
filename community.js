// Shared photos and comments in an airfield card. Other people's text goes in through textContent only,
// never as HTML. Loads when opened, so a card that stays closed costs no requests.
(() => {
  const MAX_BODY = 2000;
  const REASONS = ['spam', 'offensive', 'illegal', 'privacy', 'copyright', 'other']; // the database allows these
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, onclick) => {
    const b = el('button', 'commbtn', text);
    b.type = 'button';
    b.onclick = onclick;
    return b;
  };

  function section(code, { t, signedIn, onResize, openPhoto }) {
    const box = el('details', 'comm');
    const body = el('div', 'commbody');
    box.append(el('summary', '', t('community')), body);
    const message = text => body.replaceChildren(el('div', 'commhint', text));

    const failure = e => message(t(e && e.code === 'P0001' ? 'commLimit' : 'commFail'));
    const act = work => async () => {
      try { await work(); await refresh(); } catch (e) { console.warn('community', e); failure(e); onResize(); }
    };

    // A report button that opens a small form in place. Only for signed-in users and other people's content.
    function reportButton(target) {
      const wrap = el('div', 'commreport');
      const open = button(t('commReport'), () => {
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
            wrap.replaceChildren(el('div', 'commhint', t(e && e.code === 'P0001' ? 'commLimit' : 'commFail')));
          }
          onResize();
        });
        wrap.replaceChildren(reason, details, send);
        onResize();
      });
      wrap.append(open);
      return wrap;
    }

    const authorLine = (name, when) => el('div', 'commmeta', `${name || t('commUnknown')} · ${String(when || '').slice(0, 10)}`);

    function ownComment(c) {
      const row = el('div', 'commitem');
      const state = c.moderation === 'hidden' ? t('commHidden') : t(c.is_public ? 'commPublic' : 'commPrivate');
      row.append(el('div', 'commmeta', `${t('commYou')} · ${String(c.created_at || '').slice(0, 10)} · ${state}`), el('div', 'commtext', c.body));
      row.append(
        button(t(c.is_public ? 'commMakePrivate' : 'commMakePublic'), act(async () => {
          if (c.is_public || confirm(t('publishConfirm'))) await window.backend.setCommentPublic(c.id, !c.is_public);
        })),
        button(t('commDelete'), act(async () => {
          if (confirm(t('commDeleteConfirm'))) await window.backend.removeComment(c.id);
        })),
      );
      return row;
    }

    function form() {
      const wrap = el('div', 'commform');
      const text = el('textarea', 'commnew');
      text.name = 'comment';
      text.maxLength = MAX_BODY;
      text.placeholder = t('commPlaceholder');
      const share = el('input');
      share.type = 'checkbox';
      share.name = 'share';
      const label = el('label', 'commshare');
      label.append(share, ` ${t('commShare')}`);
      wrap.append(text, label, button(t('commSend'), act(async () => {
        if (!text.value.trim()) return;
        if (share.checked && !confirm(t('publishConfirm'))) return;
        await window.backend.addComment({ airfield_code: code, body: text.value, is_public: share.checked });
      })));
      return wrap;
    }

    function view({ own, comments, photos }) {
      const nodes = [];
      const shown = photos.filter(p => /^https:/.test(p.url || ''));
      if (shown.length) {
        const gallery = el('div', 'commgal');
        for (const p of shown) {
          const item = el('figure');
          const img = el('img');
          img.src = p.thumb;
          img.alt = '';
          img.onclick = () => openPhoto(shown.map(x => x.url), shown.indexOf(p));
          item.append(img, el('figcaption', '', p.author || t('commUnknown')));
          if (signedIn()) item.append(reportButton({ photo_id: p.id }));
          gallery.append(item);
        }
        nodes.push(gallery);
      }
      for (const c of comments) {
        const row = el('div', 'commitem');
        row.append(authorLine(c.author, c.created_at), el('div', 'commtext', c.body));
        if (signedIn()) row.append(reportButton({ comment_id: c.id }));
        nodes.push(row);
      }
      if (!nodes.length && !own.length) nodes.push(el('div', 'commhint', t('commEmpty')));
      nodes.push(...own.map(ownComment));
      nodes.push(signedIn() ? form() : el('div', 'commhint', t('commSignIn')));
      return nodes;
    }

    async function refresh() {
      message(t('commLoading'));
      body.replaceChildren(...view(await window.backend.placeContent(code)));
      onResize();
    }

    let loaded = false;
    box.addEventListener('toggle', () => {
      if (box.open && !loaded) {
        loaded = true;
        act(async () => {})();
      } else onResize();
    });
    return box;
  }

  window.community = Object.freeze({ section });
})();
