// Cloudflare Web Analytics on the live site only: no cookies, page views counted in aggregate (privacy.html).
// Not on local servers and not on the admin page, which never loads this file.
// The token is public: it only names the site in Cloudflare's dashboard.
(() => {
  if (location.hostname !== 'mylandings.net') return;
  const beacon = document.createElement('script');
  beacon.defer = true; // a classic script, so the beacon finds its settings through document.currentScript
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: 'e4c16690ec62451891e27a22d445c8d4' }));
  document.head.append(beacon);
})();
