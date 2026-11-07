const C='landings-v31';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./app.js','./manifest.json','./icon.svg','./vendor/leaflet/leaflet.js','./vendor/leaflet/leaflet.css','./vendor/markercluster/leaflet.markercluster.js','./vendor/markercluster/MarkerCluster.css','./vendor/fonts/fonts.css','./vendor/supabase.js','./config.js','./sync.js','./backend.js','./community.js','./auth.js'])));});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=e.request.url;
  // personal data and signed photo URLs from Supabase must never land in the cache
  // the admin page is useless offline, so it never lands in the cache either
  if(e.request.method!=='GET'||/\/admin\.(html|js)$/.test(new URL(u).pathname)||u.includes('tile.openstreetmap.org')||u.includes('api.github.com')||u.includes('githubusercontent.com')||u.includes('.supabase.co')||u.includes('challenges.cloudflare.com')||u.includes('cloudflareinsights.com')) return;
  // network first: always try fresh copy, fall back to cache when offline. 'no-cache' asks the server even when
  // the browser holds a copy (GitHub Pages allows 10 min), so a new version never mixes with the old one.
  // A navigation must not get a followed redirect back, hence 'manual' there.
  const fresh=new URL(u).origin===self.location.origin?new Request(u,{cache:'no-cache',redirect:e.request.mode==='navigate'?'manual':'follow'}):e.request;
  e.respondWith(fetch(fresh).then(res=>{
    // the sign-in return carries a one-time code in the URL
    if(res.ok&&!new URL(u).searchParams.has('code')){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl));}
    return res;
  }).catch(()=>caches.match(e.request)));
});
