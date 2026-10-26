// Service Worker: macht das Spiel offline spielbar.
// Strategie "Netzwerk zuerst": online ändert sich nichts, offline kommt alles aus dem Cache.
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE = `neonnexus-${VERSION}`;
const FILES = ['audio', 'data', 'game', 'input', 'main', 'progress', 'render', 'sprites']
  .map((f) => `js/${f}.js?v=${VERSION}`)
  .concat([`css/style.css?v=${VERSION}`, `manifest.webmanifest?v=${VERSION}`, 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', './']);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('version.json')) return; // Update-Prüfung immer übers Netz
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req)
        || (req.mode === 'navigate' ? await cache.match('./', { ignoreSearch: true }) : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
