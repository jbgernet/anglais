// Service worker : l'app s'ouvre même sans connexion (dernière version connue).
// Réseau d'abord, pour toujours avoir le dernier contenu ; cache si hors connexion.
const CACHE = 'anglais-v1';
const SHELL = [
  './', 'index.html', 'css/app.css?v=1', 'js/main.js?v=1',
  'js/util.js', 'js/data.js', 'js/store.js', 'js/sync.js', 'js/speech.js',
  'js/itemview.js', 'js/exercises.js', 'js/speak.js', 'js/views.js',
  'data/lessons/index.json', 'data/fluency.json', 'data/legacy-ids.json',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: false })
      .then((r) => r || caches.match(e.request, { ignoreSearch: true }))
      .then((r) => r || caches.match('./')))
  );
});
