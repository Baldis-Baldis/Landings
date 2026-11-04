// Cloudflare Web Analytics on the live site only: no cookies, page views counted in aggregate (privacy.html).
// Not on local servers and not on the admin page, which never loads this file.
// The token is public: it only names the site in Cloudflare's dashboard.
// Guests only: the beacon is foreign code without SRI and must never share a page with a Supabase session.
// A sign-in in a page that already runs it reloads the page (auth.js), a sign-out counts from the next load.
(() => {
  if (location.hostname !== 'mylandings.net') return;
  let session = true; // storage that cannot be read counts as a session, so nothing loads
  try { session = Object.keys(localStorage).some(k => /^sb-.+-auth-token/.test(k)); } catch (e) { /* keep true */ }
  // A return from Google or an e-mail link carries a one-time code and becomes a session on this load.
  if (session || new URLSearchParams(location.search).has('code')) return;
  window.analyticsBeacon = true;
  const beacon = document.createElement('script');
  beacon.defer = true; // a classic script, so the beacon finds its settings through document.currentScript
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: 'e4c16690ec62451891e27a22d445c8d4' }));
  document.head.append(beacon);
})();
