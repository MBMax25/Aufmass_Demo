const CACHE_NAME = 'aufmass-demo-shell-v8';
const ASSETS = [
  'index.html','styles.css','app.js','pdf.js',
  'vendor/pdf-lib.min.js?v=8',
  'manifest.webmanifest',
  'assets/logo.svg','assets/logo@2x.png',
  'assets/icons/icon-192-maskable.png','assets/icons/icon-512-maskable.png',
  'favicon.ico'
];
const BASE = self.registration.scope;
const APP_SHELL = ASSETS.map(p => new URL(p, BASE).toString());

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
    self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, net.clone());
      return net;
    } catch (e) {
      if (req.mode === 'navigate') return caches.match(new URL('index.html', BASE).toString());
      throw e;
    }
  })());
});
