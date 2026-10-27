'use strict';
/* The phone app's offline copy: every page file is served from the cache
   straight away and refreshed in the background, so the app opens without
   internet and picks up new versions on the next launch. The planner data
   itself goes to the friends server, never through here. */
const CACHE = 'lp-shell';
// everything index.html loads is saved on install, so the first offline open works
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const c = await caches.open(CACHE), html = await (await fetch('index.html', { cache: 'no-store' })).text();
    const files = [...html.matchAll(/(?:src|href)="([^":#]+)"/g)].map(m => m[1]);
    await c.addAll(['./', ...new Set(files)]);
  })());
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => { })); return hit; }
    return net;
  }));
});
