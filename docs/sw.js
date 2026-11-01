// Network-first service worker: always checks the server for fresh files (a quick 304 when unchanged)
// and falls back to the cache when offline, so the installed SVLN app never shows an old version.
const SCOPE = self.registration.scope;
const ENV = SCOPE.includes('/demo/') ? 'demo' : SCOPE.includes('/stage/') ? 'stage' : 'prod';
const PREFIX = `svln-paradise-${ENV}-`;
const CACHE = `${PREFIX}v2`;
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png',
  'js/app.js', 'js/store.js', 'js/charts.js', 'js/util.js', 'js/config.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Remove only this environment's old caches; prod, stage and demo share one origin.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !e.request.url.startsWith(SCOPE)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))),
  );
});
