/* Carnet de Dépenses Chantier — service worker (hors-ligne + réception de fichiers partagés) */
const VERSION = 'cdc-v1.3.0';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== 'cdc-share') await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Fichier reçu via « Partager » d'Android (WhatsApp, Fichiers, Gmail…)
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.getAll('file').find(x => x && typeof x !== 'string');
        if (f) {
          const c = await caches.open('cdc-share');
          await c.put('./shared-file', new Response(f, { headers: { 'X-Name': encodeURIComponent(f.name || 'partage.txt') } }));
        }
      } catch (err) { }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Application : cache d'abord (fonctionne sans réseau), mise à jour via nouvelle version du SW
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = req.mode === 'navigate' ? await c.match('./index.html') : await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
    catch (err) { return (await c.match('./index.html')) || Response.error(); }
  })());
});
