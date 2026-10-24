// Service worker: guarda os arquivos do jogo para abrir rápido e funcionar sem internet.
const CACHE = 'battle-island-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './css/game.css',
  './js/three.min.js', './js/util.js', './js/textures.js', './js/world.js', './js/weapons.js', './js/character.js', './js/effects.js', './js/game.js', './js/ui.js',
  './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    // guarda também as fontes do Google depois do primeiro acesso
    if (res && (res.ok || res.type === 'opaque') && /fonts\.(googleapis|gstatic)\.com/.test(e.request.url)) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => hit)));
});
