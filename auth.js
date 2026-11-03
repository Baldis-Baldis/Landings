// Sign-in and nickname dialog. Uses window.backend for everything that reaches the server.
(() => {
  if (!window.backend) return; // the app keeps working without accounts

  const S = {
    cs: {
      signIn: 'Přihlásit se', account: 'Účet', signOut: 'Odhlásit se', close: 'Zavřít',
      google: 'Pokračovat přes Google', or: 'nebo e-mailem', email: 'E-mail', sendCode: 'Poslat kód',
      codeTitle: 'Zadejte kód z e-mailu', code: 'Kód', verify: 'Přihlásit se', back: 'Jiný e-mail',
      codeSent: 'Kód jsme poslali na adresu', nickTitle: 'Zvolte si přezdívku', nick: 'Přezdívka (3 až 30 znaků)',
      nickHint: 'Uvidí ji ostatní u vašich veřejných komentářů a fotek.', save: 'Uložit', nickSaved: 'Přezdívka uložena',
      nickTaken: 'Tuto přezdívku už někdo má.', nickInvalid: 'Přezdívka musí mít 3 až 30 znaků.',
      badCode: 'Kód je neplatný nebo vypršel.', tooMany: 'Příliš mnoho pokusů, zkuste to za chvíli.',
      failed: 'Akce se nepodařila, zkontrolujte připojení.', captchaFail: 'Ochranu proti robotům se nepodařilo načíst.',
      captchaWait: 'Počkejte na dokončení ochrany proti robotům.',
      termsTitle: 'Než začnete', termsText: 'Účet je pro piloty od 16 let. Pro pokračování potvrďte obojí.',
      termsAge: 'Je mi alespoň 16 let.', termsAgree: 'Souhlasím s podmínkami použití a beru na vědomí zásady ochrany osobních údajů.',
      termsLink: 'Podmínky použití', privacyLink: 'Ochrana osobních údajů', termsAccept: 'Pokračovat',
      termsMissing: 'Potvrďte prosím obě položky.',
      exportData: 'Stáhnout moje data', deleteAccount: 'Smazat účet',
      deleteConfirm: 'Smazat účet? Smažou se přistání, poznámky, vlastní plochy, komentáře i fotky. Nejde to vrátit.',
      deleteConfirm2: 'Opravdu smazat? Data v tomto zařízení se také odstraní.',
      deleted: 'Účet je smazaný. Ze záloh zmizí nejpozději do 30 dnů.',
    },
    en: {
      signIn: 'Sign in', account: 'Account', signOut: 'Sign out', close: 'Close',
      google: 'Continue with Google', or: 'or by email', email: 'Email', sendCode: 'Send code',
      codeTitle: 'Enter the code from the email', code: 'Code', verify: 'Sign in', back: 'Different email',
      codeSent: 'We sent the code to', nickTitle: 'Choose a nickname', nick: 'Nickname (3 to 30 characters)',
      nickHint: 'Others will see it on your public comments and photos.', save: 'Save', nickSaved: 'Nickname saved',
      nickTaken: 'This nickname is already taken.', nickInvalid: 'A nickname must have 3 to 30 characters.',
      badCode: 'The code is invalid or has expired.', tooMany: 'Too many attempts, try again shortly.',
      failed: 'That did not work, check your connection.', captchaFail: 'Could not load the bot protection.',
      captchaWait: 'Wait for the bot protection to finish.',
      termsTitle: 'Before you start', termsText: 'Accounts are for pilots aged 16 or over. Please confirm both to continue.',
      termsAge: 'I am at least 16 years old.', termsAgree: 'I agree to the terms of use and have read the privacy notice.',
      termsLink: 'Terms of use', privacyLink: 'Privacy notice', termsAccept: 'Continue',
      termsMissing: 'Please confirm both items.',
      exportData: 'Download my data', deleteAccount: 'Delete account',
      deleteConfirm: 'Delete the account? Landings, notes, own strips, comments and photos will be deleted. This cannot be undone.',
      deleteConfirm2: 'Really delete? The data on this device will be removed too.',
      deleted: 'The account is deleted. It leaves the backups within 30 days.',
    },
  };
  const s = k => S[lang][k];
  const $ = id => document.getElementById(id);
  const dlg = $('authdlg'), menuItem = $('auth');
  const STEPS = { start: 'authstart', code: 'authcodeform', terms: 'authtermsform', nick: 'authnickform' };
  const TERMS_VERSION = '2026-11-02'; // a new version asks everyone again
  let step = 'start', user = null, nickname = null, askedNick = false, email = '', termsOk = false;

  function message(text, isError) {
    $('authmsg').textContent = text || '';
    $('authmsg').classList.toggle('err', !!isError);
  }
  function title() {
    if (step === 'start') return s('signIn');
    if (step === 'code') return s('codeTitle');
    if (step === 'terms') return s('termsTitle');
    return nickname ? s('account') : s('nickTitle');
  }
  function renderAuth() {
    menuItem.hidden = false;
    menuItem.textContent = user ? `${s('account')}: ${nickname || user.email}` : s('signIn');
    dlg.querySelectorAll('[data-a]').forEach(e => { e.textContent = s(e.dataset.a); });
    $('authtitle').textContent = title();
    $('authwho').textContent = user && step === 'nick' ? user.email : '';
    $('authout').hidden = !(user && (step === 'nick' || step === 'terms'));
    $('authexport').hidden = $('authdelete').hidden = !(user && termsOk && step === 'nick');
  }
  window.renderAuth = renderAuth;

  function show(next) {
    step = next;
    Object.entries(STEPS).forEach(([k, id]) => { $(id).hidden = k !== next; });
    message('');
    renderAuth();
    if (!dlg.open) dlg.showModal();
    if (next === 'start') showCaptcha();
    if (next === 'code') { $('authcode').value = ''; $('authcode').focus(); }
    if (next === 'nick') { $('authnick').value = nickname || ''; $('authnick').focus(); }
  }
  function errorText(e) {
    if (e && e.status === 429) return s('tooMany');
    return s('failed');
  }
  // Blocks double submits while a request runs.
  async function busy(form, work) {
    const buttons = form.querySelectorAll('button');
    buttons.forEach(b => { b.disabled = true; });
    try { await work(); } finally { buttons.forEach(b => { b.disabled = false; }); setCaptchaToken(captchaToken); }
  }

  // --- Turnstile: loaded only when the dialog opens, so plain visitors never contact Cloudflare ---
  let captchaLoad = null, widget = null, captchaToken = '';
  function setCaptchaToken(token) {
    captchaToken = token;
    $('authsend').disabled = !token;
  }
  function loadCaptcha() {
    captchaLoad ||= new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      tag.onload = resolve;
      tag.onerror = () => { captchaLoad = null; reject(new Error('turnstile')); };
      document.head.append(tag);
    });
    return captchaLoad;
  }
  async function showCaptcha() {
    try {
      setCaptchaToken(''); // a token works once, the widget issues a new one
      await loadCaptcha();
      if (widget !== null) { window.turnstile.reset(widget); return; }
      widget = window.turnstile.render($('authcaptcha'), {
        sitekey: window.MYLANDINGS_CONFIG.turnstileSiteKey,
        language: lang,
        size: 'flexible',
        callback: setCaptchaToken,
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => { setCaptchaToken(''); message(s('captchaFail'), true); },
      });
    } catch (e) { message(s('captchaFail'), true); }
  }
  function spendCaptcha() { // a token works once
    setCaptchaToken('');
    if (widget !== null) window.turnstile.reset(widget);
  }

  // The account is used only after the terms are accepted. Offline the check waits for the next start,
  // the database still refuses public content without them.
  async function onUser(next) {
    if ((next && next.id) === (user && user.id)) return;
    user = next; nickname = null; askedNick = false; termsOk = false;
    renderAuth();
    if (!user) { if (window.useAccount) window.useAccount(null); return; }
    const me = user.id;
    let accepted = true;
    try { accepted = (await window.backend.getTermsVersion()) === TERMS_VERSION; } catch (e) { /* offline */ }
    if ((user && user.id) !== me) return;
    if (!accepted) { show('terms'); return; }
    termsOk = true;
    await startAccount();
  }
  async function startAccount() {
    if (window.useAccount) window.useAccount(user);
    try { nickname = await window.backend.getNickname(); } catch (e) { return; } // offline: ask next time
    renderAuth();
    if (!nickname && !askedNick) { askedNick = true; show('nick'); }
  }

  menuItem.onclick = () => show(!user ? 'start' : termsOk ? 'nick' : 'terms');
  $('authtermsform').addEventListener('submit', e => {
    e.preventDefault();
    if (!$('authage').checked || !$('authterms').checked) { message(s('termsMissing'), true); return; }
    busy(e.target, async () => {
      try {
        await window.backend.acceptTerms(TERMS_VERSION);
        termsOk = true;
        dlg.close();
        await startAccount();
      } catch (err) { message(errorText(err), true); }
    });
  });
  $('authexport').onclick = async () => {
    try {
      const data = await window.backend.exportAccount();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      link.download = `mylandings-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    } catch (e) { message(errorText(e), true); }
  };
  $('authdelete').onclick = async () => {
    if (!confirm(s('deleteConfirm')) || !confirm(s('deleteConfirm2'))) return;
    const prefix = `u:${user.id}:`;
    try {
      await window.backend.deleteAccount();
      Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
      dlg.close();
      status(s('deleted'));
    } catch (e) { message(errorText(e), true); }
  };
  $('authclose').onclick = () => dlg.close();
  $('authback').onclick = () => show('start');
  $('authgoogle').onclick = async () => {
    message('');
    try { await window.backend.signInWithGoogle(); } catch (e) { message(errorText(e), true); }
  };
  $('authstart').addEventListener('submit', e => {
    e.preventDefault();
    if (!captchaToken) { message(s('captchaWait'), true); return; }
    busy(e.target, async () => {
      email = $('authemail').value.trim();
      try {
        await window.backend.sendEmailCode(email, captchaToken);
        show('code');
        message(`${s('codeSent')} ${email}`);
      } catch (err) { spendCaptcha(); message(errorText(err), true); }
    });
  });
  $('authcodeform').addEventListener('submit', e => {
    e.preventDefault();
    busy(e.target, async () => {
      try {
        await window.backend.verifyEmailCode(email, $('authcode').value.trim());
        if (step === 'code') dlg.close(); // the nickname step may have taken over meanwhile
      } catch (err) { message(err && err.status >= 400 && err.status < 429 ? s('badCode') : errorText(err), true); }
    });
  });
  $('authnickform').addEventListener('submit', e => {
    e.preventDefault();
    busy(e.target, async () => {
      try {
        const result = await window.backend.setNickname($('authnick').value);
        if (result === 'taken') { message(s('nickTaken'), true); return; }
        if (result === 'invalid') { message(s('nickInvalid'), true); return; }
        nickname = $('authnick').value.trim();
        dlg.close(); renderAuth(); status(s('nickSaved'));
      } catch (err) { message(errorText(err), true); }
    });
  });
  $('authout').onclick = async () => {
    const signOut = () => window.backend.signOut();
    try {
      // Before the terms the account was never used here, so there is nothing of it on this device.
      const leave = termsOk && window.leaveAccount ? window.leaveAccount(signOut) : signOut();
      if (await leave !== false) dlg.close();
    } catch (e) { message(errorText(e), true); }
  };

  renderAuth();
  window.backend.onAuthChange(onUser);
})();
