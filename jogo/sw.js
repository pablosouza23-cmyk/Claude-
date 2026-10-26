// Service worker: guarda os arquivos do jogo para abrir rápido e funcionar sem internet.
// Ao publicar uma versão nova, troque o número em CACHE para os jogadores receberem a atualização.
const CACHE = 'battle-island-v18';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/game.css',
  './js/three.min.js',
  './js/peerjs.min.js',
  './js/util.js',
  './js/textures.js',
  './js/world.js',
  './js/maps.js',
  './js/weapons.js',
  './js/character.js',
  './js/effects.js',
  './js/game.js',
  './js/cs.js',
  './js/team.js',
  './js/net.js',
  './js/post.js',
  './js/account.js',
  './js/lobby.js',
  './js/friends.js',
  './js/ui.js',
  './assets/guns.bin',
  './assets/guns_lod.bin',
  './assets/props.bin',
  './assets/verified.png',
  './assets/chars/anims.bin',
  './assets/chars/bone.bin',
  './assets/chars/camisa.bin',
  './assets/chars/heroi.bin',
  './assets/chars/jeans.bin',
  './assets/chars/soldada.bin',
  './assets/chars/soldado.bin',
  './assets/chars/soldado2.bin',
  './assets/chars/swat.bin',
  './assets/chars/tex/m006_body.jpg',
  './assets/chars/tex/m006_body_n.jpg',
  './assets/chars/tex/m006_head.jpg',
  './assets/chars/tex/m006_head_n.jpg',
  './assets/chars/tex/m006_opacity.png',
  './assets/chars/tex/m007_body.jpg',
  './assets/chars/tex/m007_head.jpg',
  './assets/chars/tex/m017_body.jpg',
  './assets/chars/tex/m017_head.jpg',
  './assets/chars/tex/m017_opacity.png',
  './assets/chars/tex/m022_body.jpg',
  './assets/chars/tex/m022_head.jpg',
  './assets/chars/tex/m158_body.jpg',
  './assets/chars/tex/m158_equipment.jpg',
  './assets/chars/tex/m158_head.jpg',
  './assets/chars/tex/m158_helmet.jpg',
  './assets/chars/tex/m158_opacity.png',
  './assets/chars/tex/m158_pistol.jpg',
  './assets/chars/tex/sf003_body.jpg',
  './assets/chars/tex/sf003_equipment.jpg',
  './assets/chars/tex/sf003_head.jpg',
  './assets/chars/tex/sf003_helmet.jpg',
  './assets/chars/tex/sm002_body.jpg',
  './assets/chars/tex/sm002_combat_knife.jpg',
  './assets/chars/tex/sm002_equipment.jpg',
  './assets/chars/tex/sm002_head.jpg',
  './assets/chars/tex/sm002_helmet.jpg',
  './assets/chars/tex/sm005_body.jpg',
  './assets/chars/tex/sm005_equipment.jpg',
  './assets/chars/tex/sm005_head.jpg',
  './assets/chars/tex/sm005_helmet.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const same = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!same && !fonts) return; // servidor de salas e afins: sempre pela rede
  // usa o que está guardado e atualiza em segundo plano
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: same && url.pathname.endsWith('/') }).then(hit => {
    const net = fetch(e.request).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
