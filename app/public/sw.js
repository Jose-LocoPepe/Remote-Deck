// Service worker mínimo: guarda la interfaz para que abra rápido.
// Red primero (siempre la versión más nueva); caché solo si no hay conexión.
// Los datos en vivo (/events) y los controles (/control) nunca se cachean.
const CACHE = 'remotedeck-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'css/base.css', 'css/deck.css', 'css/mixer.css', 'css/layouts.css',
  'js/main.js', 'js/state.js', 'js/control.js', 'js/format.js', 'js/layouts.js', 'js/storage.js',
  'js/components/deck.js', 'js/components/mixer.js', 'js/components/topbar.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.endsWith('/events')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
