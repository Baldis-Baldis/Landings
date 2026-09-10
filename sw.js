const C='landings-v3';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./manifest.json','./icon.svg'])));});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=e.request.url;
  if(e.request.method!=='GET'||u.includes('tile.openstreetmap.org')) return;
  // network first: always try fresh copy, fall back to cache when offline
  e.respondWith(fetch(e.request).then(res=>{
    if(res.ok){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl));}
    return res;
  }).catch(()=>caches.match(e.request)));
});
