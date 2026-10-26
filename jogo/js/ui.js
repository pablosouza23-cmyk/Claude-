'use strict';
// Câmera (3ª pessoa, mira em 1ª pessoa, salto), HUD, telas (carregamento, menu, lobby, inventário, mapa,
// configurações, pausa, resultado), notificações, controles de toque/teclado e laço principal.

// ------------------------------------------------------------------ ícones
const ICON = {
  heart: '<path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3.2 4 7 4c2.2 0 3.6 1.2 5 3 1.4-1.8 2.8-3 5-3 3.8 0 6.2 4.2 4.6 7.8C19.5 16.4 12 21 12 21z"/>',
  person: '<circle cx="12" cy="6.5" r="3.5"/><path d="M4.5 21c0-4.6 3.4-8 7.5-8s7.5 3.4 7.5 8z"/>',
  skull: '<path d="M12 2C6.8 2 3.5 5.6 3.5 10c0 2.7 1.2 4.6 3 5.8V19h2v-2h1.5v2h4v-2H15.5v2h2v-3.2c1.8-1.2 3-3.1 3-5.8C20.5 5.6 17.2 2 12 2zM8.6 13.2a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm6.8 0a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2z"/>',
  clock: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.3z"/>',
  gear: '<path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4L10.7 6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/>',
  map: '<path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6zm0 2.2 6 3v11.6l-6-3z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  bag: '<path d="M9 3h6v2h2.5A2.5 2.5 0 0 1 20 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5A2.5 2.5 0 0 1 6.5 5H9zm2 2h2V4.5h-2zM7 11v3h10v-3zm0 5v3h4v-3z"/>',
  exit: '<path d="M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9zM8 7l1.4 1.4L6.8 11H15v2H6.8l2.6 2.6L8 17l-5-5z"/>',
  bullet: '<path d="M10 2c1.8 1.4 3 4 3 6.5V20H7V8.5C7 6 8.2 3.4 10 2zM6 21h8v1.5H6z" transform="translate(2 0)"/>',
  aim: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 17.9V17h-2v2.9A8 8 0 0 1 4.1 13H7v-2H4.1A8 8 0 0 1 11 4.1V7h2V4.1a8 8 0 0 1 6.9 6.9H17v2h2.9a8 8 0 0 1-6.9 6.9zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
  run: '<circle cx="15.5" cy="3.8" r="2.2"/><path d="M5 21.5 8.3 15l2.4 1.8-1 4.7h2l1.4-6.3-2.4-2.2 1-3.4c1.2 1.6 3 2.7 5.3 2.9v-2c-1.7-.2-3-1.2-3.8-2.6l-1-1.6a2 2 0 0 0-2.4-.8L4 8.3V12h2V9.6l2.3-.9L6.3 14 3 20.5zM18 15h4v2h-4zm-1 3h5v2h-5zm2-6h3v2h-3z"/>',
  jump: '<circle cx="14.5" cy="3.8" r="2.2"/><path d="m9 22 1.6-6.2 2.6 2.4V22h2v-5.3l-2.5-2.5.8-3.4A7 7 0 0 0 19 13v-2a5 5 0 0 1-4.3-2.4l-1-1.6a2 2 0 0 0-2.6-.7L6 8.6V13h2V10l1.7-.8L7 22z"/>',
  crouch: '<circle cx="13" cy="4" r="2.2"/><path d="M8 21h2.2l1.3-4.2 2.5 1.6V21h2v-4l-2.6-2.3.6-2.6 1.6 1.7H19v-2h-2.5l-2.6-3.2a2 2 0 0 0-2.7-.4L7 10.4V14h2v-2.6l1.6-.9-1.2 4.4z"/>',
  reload: '<path d="M12 4a8 8 0 0 1 7.7 5.9l2.3-.8-1.3 5.4-4.3-3.4 1.5-.5A6 6 0 1 0 18 14h2.1A8 8 0 1 1 12 4z"/>',
  grenade: '<path d="M10 2h4v2h-1v1.1A7 7 0 1 1 7 8.3L5.6 6.9 7 5.5l1.4 1.4A7 7 0 0 1 11 5.1V4h-1zm2 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/><circle cx="12" cy="13" r="2.5"/>',
  medkit: '<path d="M9 3h6v3h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4zm2 3h2V5h-2zm0 5v2.5H8.5v3H11V19h3v-2.5h2.5v-3H14V11z"/>',
  gel: '<path d="M3 20V9c3-4 6-6 9-6s6 2 9 6v11h-2v-9.5C16.9 7.4 14.4 5.5 12 5.5S7.1 7.4 5 10.5V20z"/><path d="M7 20v-7.5c1.5-2 3.2-3 5-3s3.5 1 5 3V20z" opacity=".55"/>',
  helmet: '<path d="M3 15a9 9 0 0 1 18 0v1h-6v-3h-2v3H3zM2 17h20v2H2z"/>',
  vest: '<path d="M7 2l2 2.5h6L17 2l4 3v15l-5 2-1-7-3 1-3-1-1 7-5-2V5z"/>',
  close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/>',
  check: '<path d="M12 2 1 21h22zm-1.2 13.6-3.2-3.2 1.4-1.4 1.8 1.8 4.6-4.6 1.4 1.4z"/>',
  zone: '<path d="M12 2 1 21h22zm0 5.5 5.8 10.5H6.2z"/>',
  hit: '<path d="m4 2 8 7.4L20 2l2 2-7.4 8L22 20l-2 2-8-7.4L4 22l-2-2 7.4-8L2 4z"/>',
  warn: '<path d="M12 2 1 21h22zm-1 6h2v6h-2zm0 8h2v2h-2z"/>',
  info: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v2h-2zm0 4h2v6h-2z"/>',
  lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/>',
  ammo: '<path d="M5 9c.9-.9 1.5-2.6 1.5-4.5C7.4 6.4 8 8.1 8 9v11H5zm5.5 0c.9-.9 1.5-2.6 1.5-4.5.9 1.9 1.5 3.6 1.5 4.5v11h-3zm5.5 0c.9-.9 1.5-2.6 1.5-4.5C18.4 6.4 19 8.1 19 9v11h-3z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/>',
  chute: '<path d="M2 10C2 5.6 6.5 2 12 2s10 3.6 10 8zm2 1 8 8 8-8h-2l-6 6-6-6zm6 9h4v2h-4z"/>',
  board: '<path d="M3 15c4-3 14-7 18-6 .7 1.6-1.2 3.4-4 4.5C13 15 6 16.4 3 15zm2 3h14v2H5z"/>',
  users: '<circle cx="9" cy="7" r="3.5"/><path d="M2 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5z"/><circle cx="17" cy="8" r="2.8"/><path d="M17 12.5c3 0 5 2.1 5 5.5h-4.3c-.2-2.2-1-4-2.4-5.3.5-.1 1.1-.2 1.7-.2z"/>',
  enter: '<path d="M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9zM10 7l5 5-5 5-1.4-1.4 2.6-2.6H3v-2h8.2L8.6 8.4z"/>',
  copy: '<path d="M8 3h11a2 2 0 0 1 2 2v11h-2V5H8zM4 7h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1 2v10h9V9z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.7 6.8-4 1 1.7-6.8 4zm0 2.6 1-1.7 6.8 4-1 1.7z"/>',
  left: '<path d="M15.4 4 7.4 12l8 8 1.4-1.4L10.2 12l6.6-6.6z"/>',
  right: '<path d="M8.6 4 7.2 5.4 13.8 12l-6.6 6.6L8.6 20l8-8z"/>',
  crown: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5zm2 13h14v2H5z"/>',
  mail: '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.6V17h16V7.6l-8 5.2zM5.6 7 12 11.2 18.4 7z"/>',
  gift: '<path d="M9 3c1.3 0 2.4.8 3 1.8C12.6 3.8 13.7 3 15 3a2.8 2.8 0 0 1 2.4 4.2H21v4h-1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9H3v-4h3.6A2.8 2.8 0 0 1 9 3zm-.2 2a.9.9 0 0 0 0 1.9H11C10.6 5.7 9.8 5 8.8 5zm6.4 0c-1 0-1.8.7-2.2 1.9h2.2a.9.9 0 0 0 0-1.9zM6 11.2V19h5v-7.8zm7 0V19h5v-7.8z"/>',
  trash: '<path d="M9 3h6l1 1h4v2H4V4h4zM6 8h12l-1 13H7zm3 2v9h2v-9zm4 0v9h2v-9z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1.2 13.6-3.3-3.3 1.4-1.4 1.9 1.9 4.9-4.9 1.4 1.4z"/>',
  eye: '<path d="M12 5c5 0 9 4.3 10 7-1 2.7-5 7-10 7S3 14.7 2 12c1-2.7 5-7 10-7zm0 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z"/>',
  smile: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 17.5c2.3 0 4.2-1.5 5-3.5H7c.8 2 2.7 3.5 5 3.5z"/>',
};
// nomes dos personagens que dá para escolher
const SKINS = [['heroi', 'Cacheado'], ['swat', 'SWAT'], ['soldado', 'Soldado'], ['soldado2', 'Sargento'], ['bone', 'Boné'], ['camisa', 'Camiseta'], ['jeans', 'Jeans'], ['soldada', 'Soldada'], ['carrasco', 'Carrasco'], ['craque', 'Craque 10']];
const skinName = k => (SKINS.find(x => x[0] === k) || SKINS[0])[1];
// emotes (animações de captura de movimento): [clipe, nome, ícone, duração máx.]
const EMOTES = [['dance', 'Dança', '🕺', 8], ['dance2', 'Dança louca', '🤪', 8], ['dance3', 'Passinho', '🔥', 8], ['dance4', 'Balanço', '🎶', 8],
  ['wave', 'Acenar', '👋', 2.8], ['clap', 'Aplaudir', '👏', 4], ['cheer2', 'Comemorar', '🙌', 4.2], ['laugh', 'Rir', '😂', 4], ['shrug', 'E aí?', '🤷', 1.8], ['cheer3', 'Vitória', '🏆', 4.5]];
const EMOTE_KEYS = EMOTES.map(e => e[0]);
function emoteLen(k) { const e = EMOTES.find(x => x[0] === k); return e ? e[3] : 3; }
function playEmote(a, k) {
  if (!a || !a.alive || a.phase !== 'ground' || !CH.clips[k]) return;
  a.emote = k; a.emoteT = emoteLen(k); a.aimOn = false;
  if (a === G.player) SND.play('ui');
}
function openEmoteWheel() {
  const w = $('emoteWheel');
  if (!w.classList.contains('hidden')) { w.classList.add('hidden'); return; }
  const list = EMOTES.filter(e => !ACC.p || ACC.owns('emotes', e[0])).slice(0, 8);
  w.innerHTML = list.map((e, i) => { const a = i / list.length * Math.PI * 2 - Math.PI / 2; return '<button data-k="' + e[0] + '" style="left:' + (150 + Math.cos(a) * 110) + 'px;top:' + (150 + Math.sin(a) * 110) + 'px"><span>' + e[2] + '</span>' + e[1] + '</button>'; }).join('') +
    '<button class="ewClose" aria-label="Fechar">' + icon('close') + '</button>';
  w.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); if (b.dataset.k) playEmote(G.player, b.dataset.k); w.classList.add('hidden'); }));
  w.classList.remove('hidden');
}
// emote do personagem na vitrine (menu, lobby e sala)
function showEmote(k) { G.showEmote = { k: k, t: emoteLen(k) }; if (G.show) { const a = G.show.ch.acts[k]; if (a) a.time = 0; } }
function renderRoomEmotes() {
  const el = $('roomEmotes'); if (!el) return;
  el.innerHTML = EMOTES.filter(e => !ACC.p || ACC.owns('emotes', e[0])).map(e => '<button data-k="' + e[0] + '"><span>' + e[2] + '</span>' + e[1] + '</button>').join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { showEmote(b.dataset.k); SND.play('ui'); if (NET.on()) NET.lobbyEmote && NET.lobbyEmote(b.dataset.k); }));
}
const icon = (n, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[n] || '') + '</svg>';

// retículas de cada mira (ADS), como nas referências
const RETICLE = {
  reddot: '<circle cx="50" cy="50" r="6" fill="#ff2a2a" opacity=".18"/><circle cx="50" cy="50" r="3.4" fill="#ff3a2a" opacity=".55"/><circle cx="50" cy="50" r="2.1" fill="#ff6a5a"/>',
  greendot: '<circle cx="50" cy="50" r="13" fill="none" stroke="#3dff8a" stroke-width="1.6"/><circle cx="50" cy="50" r="13" fill="none" stroke="#3dff8a" stroke-width="5" opacity=".12"/><circle cx="50" cy="50" r="1.9" fill="#b8ffd4"/><path d="M50 31v7M50 62v7M31 50h7M62 50h7" stroke="#3dff8a" stroke-width="1.8" stroke-linecap="round"/>',
  cyan: '<path d="M50 36 64 58H36z" fill="none" stroke="#39e0ff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="50" cy="50" r="15" fill="none" stroke="#39e0ff" stroke-width="1.2" stroke-dasharray="4 3"/><circle cx="50" cy="50" r="1.9" fill="#c4f6ff"/>',
  diamond: '<path d="M50 32 68 50 50 68 32 50z" fill="none" stroke="#3aa0ff" stroke-width="1.8"/><path d="M50 32 68 50 50 68 32 50z" fill="none" stroke="#3aa0ff" stroke-width="5" opacity=".12"/><path d="M50 44 56 50 50 56 44 50z" fill="none" stroke="#9fd6ff" stroke-width="1.3"/><circle cx="50" cy="50" r="1.6" fill="#e0f3ff"/>',
  orange: '<path d="M50 50 38 62M50 50 62 62" stroke="#ff9a1c" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="15" fill="none" stroke="#ff9a1c" stroke-width="1.4"/><path d="M50 29v8M29 50h8M63 50h8" stroke="#ff9a1c" stroke-width="1.6" stroke-linecap="round"/><circle cx="50" cy="50" r="1.8" fill="#ffd08a"/>',
  brackets: '<path d="M35 41v-6h6M59 35h6v6M65 59v6h-6M41 65h-6v-6" fill="none" stroke="#ff2a2a" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="5" fill="#ff2a2a" opacity=".18"/><circle cx="50" cy="50" r="2" fill="#ff5a4a"/>',
  iron: '<path d="M38 56h8l4-6 4 6h8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" opacity=".9"/><circle cx="50" cy="50" r="1.5" fill="#ffd23c"/>',
  pistol: '<path d="M41 54h6v-4h6v4h6" fill="none" stroke="#fff" stroke-width="1.6" opacity=".9"/><circle cx="50" cy="50" r="1.4" fill="#7dff9a"/>',
  iron2: '<circle cx="50" cy="50" r="9" fill="none" stroke="#fff" stroke-width="1.4" opacity=".85"/><path d="M50 41v5M50 54v5M41 50h5M54 50h5" stroke="#fff" stroke-width="1.4"/><circle cx="50" cy="50" r="1.3" fill="#ffd23c"/>',
  scope: '',
};
// mira de cintura: abre andando, pulando e atirando; fica vermelha em cima de um inimigo
const CROSS_COL = { branco: '#ffffff', verde: '#3dff8a', ciano: '#39e0ff', amarelo: '#ffe14a', rosa: '#ff5ad1' };
function updateCrosshair(p, w, dt) {
  const base = !w ? 6 : { pistol: 6, smg: 9, shotgun: 16, lmg: 10, sniper: 7 }[w.type] || 7;
  const hs = Math.hypot(p.vel.x, p.vel.z);
  let sp = base + Math.min(10, hs * 1.1) + (p.onGround ? 0 : 9) - (p.crouch ? 2 : 0);
  const since = G.time - p.lastFire;
  if (since < 0.3) sp += 7 * (1 - since / 0.3);
  G.chSp = G.chSp === undefined ? sp : G.chSp + (sp - G.chSp) * Math.min(1, dt * 14);
  const v = Math.round(G.chSp * 2) / 2;
  if (H.cache.chSp !== v) { H.cache.chSp = v; H.crosshair.style.setProperty('--sp', v + 'px'); }
  const st = G.settings.crossStyle || 'cruz', col = CROSS_COL[G.settings.crossCol] || '#fff';
  if (H.cache.chSt !== st + col) {
    H.cache.chSt = st + col;
    H.crosshair.classList.remove('st-cruz', 'st-ponto', 'st-circulo'); H.crosshair.classList.add('st-' + st);
    H.crosshair.style.setProperty('--ccBase', col);
  }
}
const reticleSVG = (t) => '<svg viewBox="0 0 100 100">' + (RETICLE[t] || RETICLE.reddot) + '</svg>';

// ------------------------------------------------------------------ câmera
let fpGun = null, fpScene = null, fpCam = null;
function buildFP() {
  fpScene = new THREE.Scene();
  fpScene.add(new THREE.HemisphereLight(0xd8eeff, 0x556b3a, 1.4));
  const d = new THREE.DirectionalLight(0xfff1d6, 2.0); d.position.set(-1, 2, 1.5); fpScene.add(d);
  fpCam = new THREE.PerspectiveCamera(50, 1, 0.02, 10);
  fpScene.add(fpCam);
  fpGun = new THREE.Group();
  fpCam.add(fpGun);
  fpGun.userData.holder = new THREE.Group();
  fpGun.add(fpGun.userData.holder);
  // mãos com luva sem dedo
  const glove = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.7 }), skin = new THREE.MeshStandardMaterial({ color: 0x7a4b33, roughness: 0.6 });
  const hand = (x, y, z, rz) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), glove); m.scale.set(0.9, 0.75, 1.3); g.add(m);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.035), skin); f.position.set(0, -0.025, 0.05); g.add(f);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.4, 10), skin); arm.rotation.x = Math.PI / 2 - 0.25; arm.position.set(0, -0.06, -0.2); g.add(arm);
    g.position.set(x, y, z); g.rotation.z = rz || 0;
    return g;
  };
  fpGun.userData.hR = hand(0, -0.09, -0.08, 0.2);
  fpGun.userData.hL = hand(0, -0.05, 0.26, -0.3);
  fpGun.add(fpGun.userData.hR); fpGun.add(fpGun.userData.hL);
  fpGun.rotation.y = Math.PI;
}

function setFPWeapon(id) {
  const skin = (G.player && G.player.ch.skins && G.player.ch.skins[id]) || '';
  if (fpGun.userData.id === id && fpGun.userData.skin === skin) return;
  fpGun.userData.id = id; fpGun.userData.skin = skin;
  const h = fpGun.userData.holder;
  while (h.children.length) h.remove(h.children[0]);
  const gm = WPN.mesh(id, 0.006);
  if (skin) gm.userData.main.material = WPN.skinMat(skin);
  h.add(gm);
  const p = WPN.build(id);
  fpGun.userData.sightY = p.sightY; fpGun.userData.sightZ = p.sightZ;
  // mira de ferro (escopeta, pistolas): o olho fica rente ao ponto mais alto da arma entre o olho e a massa de mira,
  // senão o corpo da arma tapa o meio da tela
  if (!/dot|cyan|diamond|orange|brackets|scope/.test(WEAPONS[id].sight)) {
    const pos = p.g.attributes.position;
    let top = p.sightY;
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); if (z <= p.sightZ + 0.01 && z > p.sightZ - 0.7) top = Math.max(top, pos.getY(i)); }
    fpGun.userData.sightY = top + 0.006;
  }
  const sec = WEAPONS[id].secondary;
  fpGun.userData.hL.position.set(0.0, p.foreY !== undefined ? p.foreY - 0.03 : -0.07, sec ? 0.0 : (p.foreZ !== undefined ? p.foreZ : Math.min(0.3, p.len * 0.5)));
  fpGun.userData.hL.visible = !sec;
}

function updateCamera(dt) {
  const p = G.player;
  if (G.camOverride) { G.camOverride(camera, p); return; }
  if (G.state === 'menu' || G.state === 'lobby') { menuCamera(dt); return; }
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  if (!p.alive) {
    G.deathOrbit = (G.deathOrbit || 0) + dt * 0.35;
    // eliminado com o time ainda vivo: a câmera acompanha um colega
    const sp = G.mode !== 'cs' && TEAM.spectate();
    if (sp) {
      const fx = Math.sin(sp.face), fz = Math.cos(sp.face);
      _m.set(sp.pos.x - fx * 4.2, sp.pos.y + 2.4, sp.pos.z - fz * 4.2);
      camera.position.lerp(_m, Math.min(1, dt * 4));
      camera.lookAt(sp.pos.x, sp.pos.y + 1.3, sp.pos.z);
      G.ads = false;
      updateSpeedLines(dt, false);
      return;
    }
    const c = p.pos;
    camera.position.set(c.x + Math.sin(G.deathOrbit) * 5, c.y + 3.2, c.z + Math.cos(G.deathOrbit) * 5);
    camera.lookAt(c.x, c.y + 0.6, c.z);
    G.ads = false;
    updateSpeedLines(dt, false);
    return;
  }
  const portrait = camera.aspect < 1;
  let fov = portrait ? 74 : 62;
  camForward(_f, G.yaw, G.pitch);
  _r.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  const ads = isScoped(p);
  G.ads = ads;
  if (p.phase === 'plane') {
    camera.position.copy(G.drop.pos).addScaledVector(_f, -30);
    camera.position.y += 6;
    camera.rotation.set(G.pitch, G.yaw, 0);
  } else if (p.phase === 'fall' || p.phase === 'chute') {
    const dist = p.phase === 'chute' ? 7.5 : 6;
    const pivot = _o.set(p.pos.x, p.pos.y + (p.phase === 'chute' ? 2.4 : 1.3), p.pos.z);
    camera.position.copy(pivot).addScaledVector(_f, -dist);
    const gy = W.height(camera.position.x, camera.position.z) + 0.5;
    if (camera.position.y < gy) camera.position.y = gy;
    camera.rotation.set(G.pitch, G.yaw, 0);
    fov += 6;
  } else if (ads) {
    // mira: primeira pessoa pela mira da arma
    const w = curW(p);
    camera.position.set(p.pos.x, p.pos.y + (p.crouch ? 1.08 : 1.56), p.pos.z).addScaledVector(_f, 0.1);
    camera.rotation.set(G.pitch, G.yaw, 0);
    fov = fov / w.zoom;
  } else if (G.settings.look === 'fp') {
    bodycamView(p, dt);
    fov = portrait ? 92 : 84;
  } else {
    const k = p.aim;
    const inside = W.inHouse(p.pos.x, p.pos.z);
    let dist = U.lerp(portrait ? 4.3 : 3.25, portrait ? 3.2 : 2.45, k);
    let sh = U.lerp(portrait ? 0.45 : 0.7, portrait ? 0.5 : 0.78, k);
    if (inside) { dist = Math.min(dist, 2.3); sh *= 0.75; fov += 6; }
    // inspecionando: câmera chega perto da arma
    G.inspK = U.damp(G.inspK || 0, p.inspect ? 1 : 0, 5, dt);
    if (G.inspK > 0.01) { dist = U.lerp(dist, 1.45, G.inspK); sh = U.lerp(sh, 0.42, G.inspK); fov -= 8 * G.inspK; }
    const head = _m.set(p.pos.x, p.pos.y + (p.crouch ? 1.15 : 1.6) - 0.22 * (G.inspK || 0), p.pos.z);
    const hs = W.raycast(head, _r, sh + 0.25, true);
    if (hs) sh = Math.max(0, hs.t - 0.25);
    const pivot = _o.copy(head).addScaledVector(_r, sh);
    _d.copy(_f).negate();
    let want = dist;
    for (let i = 0; i < 5; i++) {
      _cv.copy(pivot);
      if (i > 0) { const a = i * Math.PI / 2 + 0.785; _cv.addScaledVector(_r, Math.cos(a) * 0.18); _cv.y += Math.sin(a) * 0.18; }
      const hit = W.raycast(_cv, _d, dist + 0.3, false);
      if (hit) want = Math.min(want, Math.max(0.25, hit.t - 0.28));
    }
    G.camDist = G.camDist === undefined ? want : want < G.camDist ? want : U.damp(G.camDist, want, 5, dt);
    camera.position.copy(pivot).addScaledVector(_d, G.camDist);
    camera.position.y += 0.18 * U.clamp(G.camDist / dist, 0, 1);
    const gy = W.height(camera.position.x, camera.position.z) + 0.35;
    if (camera.position.y < gy) camera.position.y = gy;
    camera.rotation.set(G.pitch, G.yaw, 0);
    const close = G.camDist < 0.95;
    if (p.ch._close !== close) {
      p.ch._close = close;
      CH.setOpacity(p.ch, close ? 0.35 : 1);
    }
  }
  // a cabeça do próprio boneco some só na câmera de peito
  const hideHead = G.settings.look === 'fp' && p.phase === 'ground' && p.alive && !ads;
  if (p.ch && p.ch._headHidden !== hideHead) { p.ch._headHidden = hideHead; p.ch.B.Bip01_Head.scale.setScalar(hideHead ? 0.001 : 1); for (const m of p.ch.mats) if (m.alphaTest > 0) m.visible = !hideHead; if (hideHead) CH.setOpacity(p.ch, 1); p.ch._close = false; }
  if (G.shake > 0) {
    G.shake -= dt;
    camera.rotation.x += (Math.random() - 0.5) * 0.012; camera.rotation.y += (Math.random() - 0.5) * 0.012;
  }
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = U.damp(camera.fov, fov, ads ? 22 : 14, dt); camera.updateProjectionMatrix(); }
  const high = U.clamp((camera.position.y - 30) / 150, 0, 1);
  scene.fog.near = U.lerp(90, 380, high); scene.fog.far = U.lerp(520, 1400, high);
  const fc = p.phase === 'ground' ? p.pos : camera.position;
  sun.position.copy(fc).addScaledVector(G.sunDir, 70);
  sun.target.position.copy(fc);
  updateSpeedLines(dt, p.phase === 'fall' || p.phase === 'chute');
  // arma em 1ª pessoa (cena própria, desenhada por cima)
  if (ads) {
    if (!fpScene) buildFP();
    const w = curW(p), id = curSlot(p).id;
    setFPWeapon(id);
    fpCam.fov = camera.fov; fpCam.aspect = camera.aspect; fpCam.updateProjectionMatrix();
    const kick = p.ch.recoil || 0;
    const bob = Math.sin(G.time * 9) * 0.004 * U.clamp(p.speed / 4, 0, 1);
    const eye = w.sight === 'scope' ? 0.12 : WEAPONS[id].secondary ? 0.32 : w.sight === 'iron' ? 0.3 : 0.34;
    const dk = U.smooth(0, 0.35, Math.max(0, p.ch.drawT || 0));
    fpGun.position.set(0, -fpGun.userData.sightY + bob - dk * 0.2, -eye + fpGun.userData.sightZ + kick * 0.04);
    fpGun.rotation.x = kick * 0.05 - dk * 0.8;
    fpGun.visible = w.sight !== 'scope';
  }
}

// câmera presa no peito (estilo bodycam): balança com o corpo, vê os braços e a arma
const _bcP = new THREE.Vector3(), _bcF = new THREE.Vector3();
function bodycamView(p, dt) {
  p.ch.B.Bip01_Spine2.getWorldPosition(_bcP);
  const f = p.face;
  _bcF.set(Math.sin(f), 0, Math.cos(f));
  _bcP.addScaledVector(_bcF, 0.2).y += 0.1;
  if (!G.bcPos) G.bcPos = _bcP.clone();
  G.bcPos.lerp(_bcP, 1 - Math.exp(-28 * dt));
  camera.position.copy(G.bcPos);
  const sp = U.clamp(p.speed / 6, 0, 1), t = G.time;
  G.bcBob = (G.bcBob || 0) + dt * (6 + p.speed * 1.6) * (sp > 0.05 ? 1 : 0.2);
  const roll = Math.sin(G.bcBob) * 0.022 * sp + Math.sin(t * 0.7) * 0.004;
  const bobP = Math.abs(Math.cos(G.bcBob)) * 0.02 * sp + Math.sin(t * 1.3) * 0.003;
  camera.rotation.set(G.pitch - bobP, G.yaw + Math.sin(G.bcBob * 0.5) * 0.008 * sp, roll);
}

// riscos brancos de velocidade durante a queda
let speedLines = null;
function updateSpeedLines(dt, on) {
  if (!speedLines) {
    speedLines = [];
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    const g = new THREE.BoxGeometry(0.04, 7, 0.04);
    for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(g, m); s.visible = false; s.frustumCulled = false; scene.add(s); speedLines.push(s); }
  }
  const p = G.player.pos;
  for (const s of speedLines) {
    if (!on) { s.visible = false; continue; }
    if (!s.visible || s.position.y > p.y + 14) {
      const a = Math.random() * 6.28, r = 3 + Math.random() * 14;
      s.position.set(p.x + Math.cos(a) * r, p.y - 18 - Math.random() * 10, p.z + Math.sin(a) * r);
      s.visible = true;
    }
    s.position.y += dt * (G.player.vdown || 12) * 2.2;
  }
}

// ------------------------------------------------------------------ cena do menu e do lobby
// o personagem no mirante do farol olhando a ilha; o avião passa ao fundo
function setupShowcase() {
  if (G.show) return;
  const s = makeActor(G.settings.name, LOB.preview || G.settings.avatar || CH.PLAYER_PAL, true);
  if (!LOB.stage) LOB.buildStage();
  s.pos.copy(LOB.podium);
  s.ch.root.position.copy(s.pos);
  s.ch.root.visible = true;
  s.phase = 'ground';
  giveWeapon(s, 'FUZIL');
  G.show = s;
  if (!planeObj) { planeObj = buildPlane(); scene.add(planeObj); }
}

function swapShowcase() {
  if (G.show) { scene.remove(G.show.ch.root); if (G.player === G.show) G.player = null; G.show = null; }
  setupShowcase();
  if (!G.player) G.player = G.show;
}

function menuCamera(dt) {
  const s = G.show;
  G.menuT = (G.menuT || 0) + dt;
  // de frente no pódio, de costas para a ilha (que aparece ao fundo); arrastar gira o personagem
  const out = LOB.outYaw;
  if (!LOB.drag) LOB.yaw *= Math.max(0, 1 - dt * 0.25);
  s.face = out + LOB.yaw + Math.sin(G.menuT * 0.4) * 0.08;
  s.ch.body.rotation.y = s.face;
  s.pos.copy(LOB.podium); s.ch.root.position.copy(s.pos);
  const se = G.showEmote;
  if (se && se.t > 0) se.t -= dt;
  const em = se && se.t > 0 ? se.k : null;
  CH.animate(s.ch, dt, { mode: 'ground', speed: 0, aim: 0, pitch: 0, armed: false, emote: em });
  LOB.stage.visible = true;
  LOB.animStage(dt, G.menuT);
  LOB.updateDisplay(dt, G.menuT);
  LOB.updateParty(dt, G.menuT);
  const portrait = camera.aspect < 1;
  // com o grupo no palco, a câmera recua para caber todo mundo
  const pn = LOB.party.length, far = pn ? (pn > 2 ? 2.6 : 1.6) : 0;
  G.camFar = (G.camFar || 0) + (far - (G.camFar || 0)) * Math.min(1, dt * 3);
  const fx = Math.sin(out), fz = Math.cos(out), dist = (portrait ? 6.4 : 4.6) + G.camFar * (portrait ? 1.8 : 1), sway = Math.sin(G.menuT * 0.25) * 0.25;
  camera.position.set(s.pos.x + fx * dist + fz * sway, s.pos.y + (portrait ? 1.4 : 1.2), s.pos.z + fz * dist - fx * sway);
  camera.lookAt(s.pos.x, s.pos.y + 0.98, s.pos.z);
  const fov = portrait ? 52 : 36;
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // desloca a imagem para o personagem ficar no espaço livre entre os painéis
  LOB.shiftCur += (LOB.shift - LOB.shiftCur) * Math.min(1, dt * 6);
  const w = window.innerWidth, h = window.innerHeight;
  if (Math.abs(LOB.shiftCur) > 0.002 && !portrait) camera.setViewOffset(w, h, -LOB.shiftCur * w, 0, w, h);
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  sun.position.copy(s.pos).addScaledVector(G.sunDir, 70); sun.target.position.copy(s.pos);
  scene.fog.near = 200; scene.fog.far = 1100;
  // avião sobrevoando a ilha
  const t = G.menuT * 0.12, R = 230;
  planeObj.visible = true;
  planeObj.position.set(Math.cos(t) * R, 150 + Math.sin(t * 2) * 6, Math.sin(t) * R);
  planeObj.rotation.set(0, -t, 0.18);
  for (const pr of planeObj.userData.props) pr.rotation.z += dt * 40;
}

// ------------------------------------------------------------------ HUD
const H = { cache: {} };
function setText(el, key, v) { if (H.cache[key] === v) return; H.cache[key] = v; el.textContent = v; }
function setHTML(el, key, v) { if (H.cache[key] === v) return; H.cache[key] = v; el.innerHTML = v; }
function setClass(el, key, cls, on) { if (H.cache[key] === on) return; H.cache[key] = on; el.classList.toggle(cls, on); }

function initHUD() {
  H.waitBox = $('waitBox'); H.waitT = $('waitT');
  document.querySelectorAll('[data-icon]').forEach(el => { el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); });
  ['hud', 'touch', 'hpFill', 'hpNum', 'vestBadge', 'helmBadge', 'aliveNum', 'killNum', 'compassStrip', 'compassNum', 'notifs', 'areaBanner', 'areaName',
    'killBanner', 'kbCount', 'kbName', 'minimap', 'zoneTime', 'zoneText', 'topStatus', 'prep', 'prepNum', 'bigText', 'jumpHint', 'diveStats', 'diveHint', 'altMark',
    'crosshair', 'reticle', 'scope', 'hitmark', 'hurtArrow', 'handHint', 'killfeed', 'vignette', 'lowHp', 'useBtn', 'keysHint', 'fps', 'wb0', 'wb1', 'wb2', 'wbNade', 'wbKit', 'btnGel', 'wbInsp', 'inspTag', 'vaultBtn', 'mkPin',
    'healRing', 'reloadBar'].forEach(id => { H[id] = $(id); });
  H.scopeWrap = H.scope.querySelector('.sWrap');
  H.mm = H.minimap.getContext('2d');
  // bússola: N 15 30 NE 60 75 L ...
  const PX = 3.2, names = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
  let html = '';
  for (let d = -180; d <= 540; d += 15) {
    const n = ((d % 360) + 360) % 360;
    html += '<span style="left:' + ((d + 180) * PX) + 'px"' + (names[n] !== undefined ? ' class="card"' : '') + '>' + (names[n] !== undefined ? names[n] : n) + '</span>';
  }
  H.compassStrip.innerHTML = html;
  H.PX = PX;
  H.keysHint.classList.toggle('hidden', isTouch);
  if (isTouch) H.jumpHint.textContent = 'Toque em SALTAR';
}

function hpColor(f) { return f > 0.6 ? 'g' : f > 0.3 ? 'y' : 'o'; }

function weaponCard(s, idx, active) {
  if (!s) return '<span class="n">' + (idx + 1) + '</span><span class="empty">' + (idx === 2 ? 'secundária' : 'vazio') + '</span>';
  const w = WEAPONS[s.id], r = WPN.RARITY[w.rarity];
  return '<span class="n">' + (idx + 1) + '</span>' + WPN.iconSVG(s.id) + '<span class="am"><b>' + s.mag + '</b> / ' + s.reserve + '</span><span class="nm">' + w.short + '</span><i style="background:' + r.color + '"></i>';
}

function updateHUD(dt) {
  const p = G.player, z = G.zone;
  // vida e proteção
  const hp = Math.max(0, Math.ceil(p.hp)), frac = hp / p.maxHp;
  setText(H.hpNum, 'hp', String(hp));
  H.hpFill.style.width = (frac * 100) + '%';
  const hc = hpColor(frac);
  if (H.cache.hc !== hc) { H.cache.hc = hc; H.hpFill.className = 'hp-' + hc; }
  setHTML(H.vestBadge, 'vb', icon('vest') + (p.armor ? 'Nv.' + p.armor : '—'));
  setHTML(H.helmBadge, 'hb', icon('helmet') + (p.helmet ? 'Nv.' + p.helmet : '—'));
  setClass(H.vestBadge, 'vbo', 'on', p.armor > 0); setClass(H.helmBadge, 'hbo', 'on', p.helmet > 0);
  setText(H.aliveNum, 'al', String(aliveCount()));
  setText(H.killNum, 'kn', String(p.kills));
  setClass(H.lowHp, 'lh', 'show', frac < 0.3 && p.alive);
  // bússola
  const heading = ((-G.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const cw = H.compassStrip.parentNode.clientWidth;
  H.compassStrip.style.transform = 'translateX(' + (cw / 2 - (heading + 180) * H.PX) + 'px)';
  setText(H.compassNum, 'cn', String(Math.round(heading) % 360));
  // zona
  setText(H.zoneTime, 'ztm', z.final ? '--:--' : U.fmtTime(z.timer));
  setText(H.zoneText, 'zt', z.final ? 'Zona final' : z.waiting ? 'Zona fecha em' : 'Zona fechando');
  setClass(H.zoneTime.parentNode, 'zs', 'shrink', !z.waiting && !z.final);
  if (z.waiting && !z.final && z.timer < 60 && z.timer > 59 && G.zoneWarned !== z.phase) { G.zoneWarned = z.phase; notify('zone', 'Zona segura irá diminuir em 1 minuto!'); }
  // status do salto
  let nPlane = 0, nAir = 0;
  for (const a of G.actors) { if (a.phase === 'plane') nPlane++; else if (a.phase === 'fall' || a.phase === 'chute') nAir++; }
  setText(H.topStatus, 'ts', nPlane + nAir > 0 ? 'no avião ' + nPlane + ' · no ar ' + nAir + ' · saltaram ' + (G.actors.length - nPlane) + '/' + G.actors.length : '');
  setClass(H.topStatus, 'tsh', 'hidden', nPlane + nAir === 0);
  if (G.mode === 'cs') CS.hud(); else TEAM.hud();
  if (G.wait) setText(H.waitT, 'wt', 'O avião sai em ' + Math.max(0, Math.ceil(G.wait.t)) + 's');
  // barra de armas e itens
  for (let i = 0; i < 3; i++) {
    const s = p.slots[i], el = H['wb' + i];
    setHTML(el, 'wb' + i, weaponCard(s, i));
    setClass(el, 'wba' + i, 'active', p.cur === i && !p.nadeHand);
  }
  setHTML(H.wbNade, 'wbn', icon('grenade') + '<b>' + p.nades + '</b>');
  setHTML(H.wbKit, 'wbk', icon('medkit') + '<b>' + p.kits + '</b>');
  setHTML(H.btnGel, 'wbg', icon('gel') + '<b>' + p.gel + '</b>');
  updateMarkPin(p);
  setHTML(H.wbInsp, 'wbi', icon('eye'));
  setClass(H.wbInsp, 'wbiOn', 'on', !!p.inspect);
  // nome da arma (e da skin) enquanto inspeciona
  const ins = p.inspect && curSlot(p);
  setHTML(H.inspTag, 'insT', ins ? '<small>INSPECIONANDO</small>' + escapeHTML((p.ch.skins && WPN.SKINS[p.ch.skins[ins.id]] ? WPN.SKINS[p.ch.skins[ins.id]].name : WPN.DEF[ins.id].name).toUpperCase()) : '');
  setClass(H.inspTag, 'insS', 'show', !!ins);
  setClass(H.wbNade, 'wbna', 'active', p.nadeHand);
  H.healRing.style.transform = 'scaleX(' + (p.healT > 0 ? 1 - p.healT / 2.4 : 0) + ')';
  const cs = curSlot(p);
  H.reloadBar.style.transform = 'scaleX(' + (p.reloadT > 0 && cs ? 1 - p.reloadT / (WEAPONS[cs.id].type === 'shotgun' ? 2.6 : 1.9) : 0) + ')';
  // botão de contexto
  let use = '', useCol = '';
  if (p.phase === 'ground' && p.alive) {
    if (canOpenAirdrop()) { use = 'ABRIR SUPRIMENTO'; useCol = '#ffb21e'; }
    else { const it = nearestWeaponLoot(p, 2.2); if (it) { use = 'PEGAR ' + lootLabel(it).toUpperCase(); useCol = WPN.RARITY[WEAPONS[it.type.slice(2)].rarity].color; } }
  }
  // pular a janela
  setClass(H.vaultBtn, 'vb', 'hidden', !(G.nearWin && p.alive && !p.vault));
  if (H.cache.use !== use) {
    H.cache.use = use;
    H.useBtn.innerHTML = use ? icon('bag') + '<span>' + (isTouch ? '' : '[E] ') + use + '</span>' : '';
    H.useBtn.style.borderColor = useCol;
    H.useBtn.classList.toggle('hidden', !use);
  }
  // modo da tela
  const mode = p.phase === 'plane' && G.drop.state === 'prep' ? 'prep' : p.phase;
  if (H.cache.mode !== mode) { H.cache.mode = mode; H.touch.dataset.mode = mode; H.hud.dataset.mode = mode; }
  if (mode === 'fall' || mode === 'chute') {
    const alt = Math.max(0, Math.round(p.pos.y - W.groundAt(p.pos.x, p.pos.z, p.pos.y)));
    setText(H.diveStats, 'ds', alt + ' m  ·  desce ' + Math.round(p.vdown || 0) + ' m/s  ·  anda ' + Math.round(p.hs) + ' m/s');
    setText(H.diveHint, 'dh', mode === 'fall'
      ? (isTouch ? '↑ acelera · ↓ freia · ←/→ vira' : 'W acelera · S freia · A/D vira · T solta a prancha · ESPAÇO abre o paraquedas')
      : (isTouch ? '↑ desce mais rápido · ↓ freia · ←/→ vira' : 'W acelera (desce mais rápido) · S freia · A/D vira'));
    H.altMark.style.bottom = U.clamp(alt / 250 * 100, 0, 100) + '%';
  }
  setText(H.handHint, 'hh', p.nadeHand ? (isTouch ? 'GRANADA NA MÃO · ATIRAR LANÇA · TOQUE NA GRANADA PARA GUARDAR' : 'GRANADA NA MÃO · CLIQUE ESQ. LANÇA · [Q] GUARDA') : '');
  setClass(H.handHint, 'hhs', 'show', p.nadeHand);
  // mira
  const w = curW(p), ads = G.ads;
  setClass(H.crosshair, 'chOff', 'off', mode !== 'ground' || ads);
  setClass(H.crosshair, 'chW', 'wide', !!w && w.type === 'shotgun');
  setClass(H.crosshair, 'chT', 'tgt', !!(G.aaTarget && G.aaSee));
  updateCrosshair(p, w, dt);
  const sightType = ads && w ? w.sight : '';
  if (H.cache.sight !== sightType) {
    H.cache.sight = sightType;
    H.reticle.innerHTML = sightType && sightType !== 'scope' ? reticleSVG(sightType) : '';
    H.scope.classList.toggle('show', sightType === 'scope');
  }
  // respiração na luneta (mais firme agachado)
  if (sightType === 'scope') {
    const k = p.crouch ? 0.4 : 1, t = G.time;
    H.scopeWrap.style.transform = 'translate(' + (Math.sin(t * 0.9) * 3 * k).toFixed(1) + 'px,' + (Math.sin(t * 1.7) * 2.2 * k).toFixed(1) + 'px)';
  }
  G.vignette = Math.max(0, G.vignette - dt * 0.9);
  H.vignette.style.opacity = G.vignette.toFixed(2);
  if (G.vignette > 0.05 && G.hurtDir !== undefined) {
    const rel = G.hurtDir - (G.yaw + Math.PI);
    H.hurtArrow.style.opacity = Math.min(1, G.vignette * 2).toFixed(2);
    H.hurtArrow.style.transform = 'translate(-50%,-50%) rotate(' + (-rel) + 'rad) translateY(-120px)';
  } else H.hurtArrow.style.opacity = 0;
  if (G.settings.fps) {
    G.fpsAcc = (G.fpsAcc || 0) + dt; G.fpsN = (G.fpsN || 0) + 1;
    if (G.fpsAcc > 0.5) { H.fps.textContent = Math.round(G.fpsN / G.fpsAcc) + ' FPS'; G.fpsAcc = 0; G.fpsN = 0; }
  }
  G.mmT = (G.mmT || 0) - dt;
  if (G.mmT <= 0) { G.mmT = 0.1; drawMinimap(); }
  const bc = G.settings.fx === 'bodycam';
  setClass(H.bcOSD || (H.bcOSD = $('bcOSD')), 'bc', 'hidden', !bc);
  if (bc) { const d = new Date(); const z = n => String(n).padStart(2, '0'); setText($('bcTime'), 'bct', d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds())); }
  if (UI.screen === 'inv') renderInventory(false);
}

// ---------- mapa da ilha (pré-desenhado a partir das cores do terreno) ----------
let mapImg = null;
function islandImage() {
  if (mapImg) return mapImg;
  const S = 512, EXT = 440, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), T = W.tg;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = (i / S - 0.5) * EXT, z = (j / S - 0.5) * EXT, k = (j * S + i) * 4;
    const h = W.grid2(T.h, x, z);
    if (h < W.SEA_Y) {
      const d = U.clamp((W.SEA_Y - h) / 3, 0, 1);
      img.data[k] = 70 - d * 30; img.data[k + 1] = 190 - d * 60; img.data[k + 2] = 220 - d * 20;
    } else {
      img.data[k] = W.grid2(T.col, x, z, 3, 0) * 255; img.data[k + 1] = W.grid2(T.col, x, z, 3, 1) * 255; img.data[k + 2] = W.grid2(T.col, x, z, 3, 2) * 255;
    }
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tx = (x) => (x / EXT + 0.5) * S;
  g.fillStyle = '#e8eef4';
  for (const h of W.houses) { g.save(); g.translate(tx(h.x), tx(h.z)); g.rotate(-Math.atan2(h.s, h.c)); g.fillRect(-h.hw * S / EXT, -h.hd * S / EXT, h.hw * 2 * S / EXT, h.hd * 2 * S / EXT); g.restore(); }
  mapImg = { canvas: c, EXT: EXT, S: S };
  return mapImg;
}

function drawMapLayer(g, S, cx, cz, scale, rotate, full) {
  // scale: pixels por metro; (cx,cz) no centro da tela
  const M = islandImage(), p = G.player, z = G.zone;
  g.save();
  g.fillStyle = '#2a7fc4'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  if (rotate) g.rotate(G.yaw);
  g.translate(-cx * scale, -cz * scale);
  g.imageSmoothingEnabled = true;
  g.drawImage(M.canvas, -M.EXT / 2 * scale, -M.EXT / 2 * scale, M.EXT * scale, M.EXT * scale);
  if (G.drop && G.drop.state !== 'done') {
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.setLineDash([6, 5]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(G.drop.start.x * scale, G.drop.start.z * scale); g.lineTo((G.drop.start.x + G.drop.dir.x * 1120) * scale, (G.drop.start.z + G.drop.dir.z * 1120) * scale); g.stroke();
    g.setLineDash([]);
  }
  if (z) {
    g.strokeStyle = '#ffffff'; g.lineWidth = full ? 2 : 1.5;
    if (!z.final) { g.beginPath(); g.arc(z.toX * scale, z.toZ * scale, z.toR * scale, 0, 7); g.stroke(); }
    g.strokeStyle = '#3aa8ff'; g.lineWidth = full ? 3 : 2;
    g.beginPath(); g.arc(z.cx * scale, z.cz * scale, Math.max(1, Math.min(z.r, 260) * scale), 0, 7); g.stroke();
  }
  const ad = G.airdrop;
  if (ad && ad.state !== 'none' && ad.state !== 'opened') { g.fillStyle = '#ff3b30'; g.fillRect(ad.x * scale - 4, ad.z * scale - 4, 8, 8); }
  // inimigos que atiraram por perto (aparecem como no mapa da referência)
  g.fillStyle = '#ff2a2a';
  for (const b of G.bots) {
    if (!b.alive || b.phase !== 'ground' || CS.ally(b, p) || G.time - b.lastFire > 2.5 || b.pos.distanceTo(p.pos) > 90) continue;
    g.beginPath(); g.arc(b.pos.x * scale, b.pos.z * scale, full ? 4 : 3, 0, 7); g.fill();
  }
  // marcações: a sua (amarela) e a dos colegas (com o número deles)
  const pin = (x, z, col, txt) => {
    const k = full ? 1.4 : 1, X = x * scale, Z = z * scale;
    g.save(); g.translate(X, Z); if (rotate) g.rotate(-G.yaw);
    g.fillStyle = col; g.strokeStyle = '#2a1e00'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-7 * k, -9 * k, -6 * k, -17 * k, 0, -17 * k); g.bezierCurveTo(6 * k, -17 * k, 7 * k, -9 * k, 0, 0); g.fill(); g.stroke();
    if (txt) { g.fillStyle = '#000'; g.font = '700 ' + Math.round(8 * k) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(txt, 0, -9 * k); }
    g.restore();
  };
  if (G.marker) pin(G.marker.x, G.marker.z, '#ffd23c', '');
  for (const t of (TEAM.on() ? TEAM.tags : [])) if (t.a.mark) pin(t.a.mark.x, t.a.mark.z, '#7fe3ff', String(t.n));
  // colegas de time: bolinha amarela com o número
  if (TEAM.on()) {
    g.font = '700 ' + (full ? 11 : 9) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of TEAM.tags) {
      const a = t.a;
      if (!a.alive) continue;
      const q = a.phase === 'plane' && G.drop ? G.drop.pos : a.pos, r = full ? 7 : 5.5;
      g.fillStyle = '#ffd23c'; g.strokeStyle = '#000'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(q.x * scale, q.z * scale, r, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#000'; g.fillText(String(t.n), q.x * scale, q.z * scale + 0.5);
    }
    g.textBaseline = 'alphabetic';
  }
  if (full) {
    g.font = '600 ' + Math.round(12) + 'px Oswald, system-ui, sans-serif'; g.textAlign = 'center';
    for (const a of W.areaDefs) {
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(a.name, a.x * scale + 1, a.z * scale + 1);
      g.fillStyle = '#ffd23c'; g.fillText(a.name, a.x * scale, a.z * scale);
    }
  }
  const pp = p.phase === 'plane' ? G.drop.pos : p.pos;
  g.translate(pp.x * scale, pp.z * scale);
  g.rotate(-G.yaw);
  g.fillStyle = '#39b6ff'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
  const k = full ? 1.3 : 1;
  g.beginPath(); g.moveTo(0, -8 * k); g.lineTo(6 * k, 6 * k); g.lineTo(0, 3 * k); g.lineTo(-6 * k, 6 * k); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

// marcação na tela: alfinete em cima do ponto, com a distância (preso na borda quando fica fora da tela)
const _mk = new THREE.Vector3();
function updateMarkPin(p) {
  const el = H.mkPin, m = G.marker;
  if (!m || !p.alive) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  _mk.set(m.x, W.height(m.x, m.z) + 2.5, m.z).project(camera);
  const Wd = window.innerWidth, Ht = window.innerHeight;
  let x = (_mk.x + 1) / 2 * Wd, y = (1 - _mk.y) / 2 * Ht;
  if (_mk.z > 1) { x = Wd - x; y = Ht * 0.12; } // atrás da câmera: vai para a borda
  x = U.clamp(x, 40, Wd - 40); y = U.clamp(y, 70, Ht - 120);
  el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%,-100%)';
  setText(el.querySelector('b'), 'mkd', Math.round(Math.hypot(m.x - p.pos.x, m.z - p.pos.z)) + ' m');
}
function drawMinimap() {
  const g = H.mm, S = 160, p = G.player;
  const pp = p.phase === 'plane' ? G.drop.pos : p.pos;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
  drawMapLayer(g, S, pp.x, pp.z, p.phase === 'ground' ? 1.15 : 0.45, false, false);
  g.restore();
}

// ---------- notificações, banners, feed ----------
const NOTE_ICON = { ok: 'check', zone: 'zone', hit: 'hit', rare: 'warn', info: 'info' };
function notify(kind, text) {
  if (!H.notifs) return;
  const el = document.createElement('div');
  el.className = 'note n-' + kind;
  el.innerHTML = icon(NOTE_ICON[kind] || 'info') + '<span>' + String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</span>';
  H.notifs.appendChild(el);
  while (H.notifs.children.length > 3) H.notifs.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 3000);
}
function toast(msg) { notify('info', msg); }
function announce(msg) { notify(/SUPRIMENTO/.test(msg) ? 'rare' : 'zone', msg.charAt(0) + msg.slice(1).toLowerCase()); }
let bigTimer = 0, areaTimer = 0, hitTimer = 0, kbTimer = 0;
function bigText(msg) {
  H.bigText.textContent = msg; H.bigText.classList.add('show');
  clearTimeout(bigTimer); bigTimer = setTimeout(() => H.bigText.classList.remove('show'), 1300);
}
function areaBanner(name) {
  H.areaName.textContent = name; H.areaBanner.classList.add('show');
  clearTimeout(areaTimer); areaTimer = setTimeout(() => H.areaBanner.classList.remove('show'), 2800);
}
function hitMarker(head) {
  H.hitmark.classList.toggle('head', !!head);
  H.hitmark.classList.add('show');
  clearTimeout(hitTimer); hitTimer = setTimeout(() => H.hitmark.classList.remove('show'), 140);
  SND.play(head ? 'head' : 'hit', 0.7);
}
// nome com o selo de verificado da pessoa (recebe o boneco ou só o nome)
const nameTag = (x) => { if (!x || typeof x !== 'object') return escapeHTML(String(x || '')); return escapeHTML(x.name) + (x.vf ? LOB.vf(x.vf) : ''); };
function killBanner(n, victim) {
  H.kbCount.textContent = n;
  H.kbName.innerHTML = nameTag(victim);
  H.killBanner.classList.remove('show'); void H.killBanner.offsetWidth; H.killBanner.classList.add('show');
  clearTimeout(kbTimer); kbTimer = setTimeout(() => H.killBanner.classList.remove('show'), 2200);
  SND.play('kill');
}
function killFeed(killer, victim, weapon) {
  const el = document.createElement('div');
  el.className = 'kf';
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  el.innerHTML = victim ? '<b>' + nameTag(killer) + '</b> ' + icon('skull') + ' <b>' + nameTag(victim) + '</b> <span>' + esc(weapon) + '</span>'
    : '<b>' + nameTag(killer) + '</b> ' + icon('zone') + ' <span>zona</span>';
  H.killfeed.appendChild(el);
  while (H.killfeed.children.length > 4) H.killfeed.firstChild.remove();
  setTimeout(() => el.remove(), 5000);
}

// ------------------------------------------------------------------ telas
const UI = { screen: null };
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id));
  UI.screen = id === 'invScr' ? 'inv' : id === 'mapScr' ? 'map' : id;
}

function goMenu() {
  if (G.state === 'play' || G.state === 'pause' || G.state === 'end') clearMatch();
  G.ads = false; G.nearWin = null; G.sprint = false;
  H.scope.classList.remove('show'); H.reticle.innerHTML = ''; H.cache.sight = '';
  if (G.gelAim) releaseGelAim(true);
  G.state = 'menu';
  H.hud.classList.add('hidden'); H.touch.classList.add('hidden');
  setupShowcase();
  G.show.ch.root.visible = true;
  if (!NET.on()) LOB.clearParty();
  LOB.preview = null; LOB.shift = -0.07;
  if (!ACC.p) { LOB.showAuth(); return; }
  showScreen('menuScr');
  LOB.renderTop(); LOB.renderNews();
  SND.music(true);
}

let lobbyT = 0, lobbyIv = 0;
function goLobby() {
  G.state = 'lobby';
  showScreen('lobbyScr');
  showEmote(Math.random() < 0.5 ? 'wave' : 'cheer2');
  lobbyT = 5;
  const cs = G.settings.mode === 'cs', n = G.settings.csSize || 4;
  $('lobbyPlayers').textContent = cs ? n + ' x ' + n : TOTAL + '/' + TOTAL;
  $('lpMap').textContent = cs ? 'ARENA' : W.MAP.name.toUpperCase();
  $('lpMode').textContent = cs ? 'CONTRA SQUAD' : TEAM.label(TEAM.size(G.settings.brTeam || 1));
  if (cs) lobbyT = 6;
  LOB.shift = 0;
  clearInterval(lobbyIv);
  const tickL = () => {
    $('lobbyTime').textContent = U.fmtTime(lobbyT);
    if (lobbyT <= 0) { clearInterval(lobbyIv); beginMatch(); }
    lobbyT--;
  };
  tickL();
  lobbyIv = setInterval(tickL, 1000);
}

function beginMatch(msg) {
  clearInterval(lobbyIv);
  // Contra Squad joga na Arena; o Battle Royale no mapa escolhido
  if (!msg) {
    const need = G.settings.mode === 'cs' ? 'arena' : (W.mapId === 'arena' ? (G.settings.map || 'ilha') : W.mapId);
    if (need !== W.mapId) { LOB.switchMap(need, () => beginMatch()); return; }
  }
  SND.init();
  SND.music(false);
  if (isTouch) {
    try {
      const el = document.documentElement;
      const r = el.requestFullscreen ? el.requestFullscreen() : null;
      if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* opcional */ } }).catch(() => {});
    } catch (e) { /* tela cheia é opcional */ }
  }
  showScreen(null);
  if (G.show) G.show.ch.root.visible = false;
  startMatch(msg && msg.seed !== undefined ? msg : null);
}

function startMatch(msg) {
  clearMatch();
  G.matchId = (G.matchId || 0) + 1;
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  if (LOB.stage) LOB.stage.visible = false;
  H.cache = {};
  G.botDmgScale = 0.55;
  G.time = 0; G.vignette = 0; G.endT = -1; G.area = null; G.deathOrbit = 0; G.mouseFire = false; G.prevFire = false; G.zoneWarned = -1; G.camDist = undefined;
  for (const k in input) if (typeof input[k] === 'boolean') input[k] = false;
  G.mode = (msg ? msg.mode : G.settings.mode) === 'cs' ? 'cs' : 'br';
  H.hud.classList.toggle('cs', G.mode === 'cs');
  G.teamSize = 1; G.teamCount = 0; TEAM.tags = []; TEAM.spec = null;
  G.sprint = false; G.nearWin = null; $('btnRun').classList.remove('on');
  G.marker = null; G.gelAim = null;
  H.hud.classList.remove('team'); $('teamBox').classList.add('hidden');
  if (LOB.clearParty) LOB.clearParty();
  if (G.mode === 'cs') {
    CS.start(msg);
    G.state = 'play';
    H.hud.classList.remove('hidden');
    H.touch.classList.toggle('hidden', !isTouch);
    H.prep.classList.add('hidden');
    H.jumpHint.classList.remove('show');
    onResize();
    warmup();
    return;
  }
  G.cs = null;
  if (G.zoneMesh) { G.zoneMesh.visible = true; G.zoneRing.visible = true; }
  if (msg) {
    NET.buildActors(msg);
    scatterLoot(U.rng(msg.seed + 7));
  } else {
    const p = makeActor(G.settings.name || 'Jogador', G.settings.avatar || CH.PLAYER_PAL, true);
    p.ch.root.visible = false;
    G.player = p; G.actors.push(p);
    spawnBots();
    scatterLoot();
    TEAM.assign([p], G.bots, G.settings.brTeam);
  }
  G.airdrop = { state: 'none' };
  initZone();
  // sala de espera antes do avião
  G.dropArgs = msg ? [msg.ang, msg.side] : [Math.random() * Math.PI * 2, Math.random() - 0.5];
  startWaiting(msg ? U.rng(msg.seed + 11) : Math.random);
  G.state = 'play';
  H.hud.classList.remove('hidden');
  H.touch.classList.toggle('hidden', !isTouch);
  H.prep.classList.add('hidden');
  H.waitBox.classList.remove('hidden');
  H.jumpHint.classList.remove('show');
  onResize();
  warmup();
}

// pré-aquece: monta os modelos de todos os itens e compila todos os shaders antes de jogar,
// para não engasgar na primeira vez que algo aparece (primeiro tiro, primeira granada...)
let warmed = false;
function warmup() {
  if (warmed) return;
  warmed = true;
  for (const id of WPN.ORDER) { lootIM('w:' + id); WPN.build(id); WPN.build(id, true); }
  for (const k in LOOT) lootIM(k);
  const hidden = [];
  scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  try { renderer.compile(scene, camera); if (fpScene) renderer.compile(fpScene, fpCam); } catch (e) { /* opcional */ }
  for (const o of hidden) o.visible = false;
}

function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  input.fire = false; G.mouseFire = false;
  if (document.exitPointerLock) document.exitPointerLock();
  showScreen('pauseScr');
}
function resumeGame() { G.state = 'play'; showScreen(null); }
// no multiplayer a partida não para: a pausa é só um menu por cima

function endMatch() {
  G.state = 'end';
  if (document.exitPointerLock) document.exitPointerLock();
  const p = G.player, win = p.alive;
  $('resTitle').textContent = win ? 'VITÓRIA' : 'DERROTA';
  $('resultCard').className = 'resCard ' + (win ? 'win' : 'lose');
  if (G.mode === 'cs' && G.cs) {
    const me = p.team, won = G.cs.winner === me;
    $('resTitle').textContent = won ? 'VITÓRIA' : 'DERROTA';
    $('resultCard').className = 'resCard ' + (won ? 'win' : 'lose');
    $('resPlace').innerHTML = G.cs.score[me] + ' <small>x</small> ' + G.cs.score[1 - me] + '<small> · CONTRA SQUAD ' + G.cs.n + 'x' + G.cs.n + '</small>';
  } else if (TEAM.on()) {
    $('resTitle').textContent = G.place === 1 ? 'VITÓRIA' : 'DERROTA';
    $('resultCard').className = 'resCard ' + (G.place === 1 ? 'win' : 'lose');
    $('resPlace').innerHTML = '#' + G.place + '<small>/' + G.teamCount + ' · ' + TEAM.label(G.teamSize) + '</small>';
  } else $('resPlace').innerHTML = '#' + G.place + '<small>/' + G.actors.length + '</small>';
  $('resKills').textContent = p.kills;
  $('resDmg').textContent = Math.round(p.dmgDealt);
  $('resTime').textContent = U.fmtTime(G.time);
  const others = NET.live && G.actors.some(a => a.human && a.alive && a !== p);
  $('rLobby').textContent = NET.on() ? 'VOLTAR PARA A SALA' : 'VOLTAR AO LOBBY';
  $('resNote').textContent = NET.isHost() && others ? 'Seus amigos ainda estão jogando. Voltar encerra a partida para todos.' : NET.isClient() && NET.live ? 'A partida continua para os outros.' : '';
  H.hud.classList.add('hidden'); H.touch.classList.add('hidden');
  LOB.matchEnd();
  showScreen('resultScr');
}

// ---------- sala multiplayer ----------
function renderRoom() {
  if (!$('roomScr')) return;
  LOB.syncParty();
  const host = NET.isHost();
  $('roomCode').textContent = NET.code || '-----';
  const list = $('roomList');
  list.innerHTML = NET.players.map(p => '<li class="' + (p.pid === NET.pid ? 'me' : '') + '">' + icon(p.pid === 0 ? 'crown' : 'person') + '<span>' + escapeHTML(p.name) + LOB.vf(p.vf) + '</span><small>' + skinName(p.av) + '</small>' + (p.pid === 0 ? '<em>ANFITRIÃO</em>' : p.pid === NET.pid ? '<em>VOCÊ</em>' : '') + '</li>').join('') +
    (NET.players.length < 2 ? '<li><small>Ninguém entrou ainda. Mande o código.</small></li>' : '');
  $('roomBots').checked = NET.bots;
  $('roomBots').disabled = !host;
  $('roomBotsRow').classList.toggle('hidden', !host && !NET.bots);
  $('roomStart').classList.toggle('hidden', !host);
  $('roomWait').classList.toggle('hidden', host);
  $('skinName').textContent = skinName(G.settings.avatar || 'heroi');
  $('roomMapName').textContent = (W.mapId === 'arena' ? W.MAPS[G.settings.map || 'ilha'] : W.MAP).name.toUpperCase();
  $('roomMap').disabled = !host && NET.on();
  LOB.renderRoomMode();
}
function escapeHTML(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function openRoom() { G.state = 'lobby'; LOB.shift = -0.16; showScreen('roomScr'); renderRoom(); renderRoomEmotes(); showEmote('wave'); }
function cycleSkin(d) {
  const own = SKINS.filter(x => !ACC.p || ACC.owns('skins', x[0]));
  const i = Math.max(0, own.findIndex(x => x[0] === (G.settings.avatar || 'heroi')));
  const k = own[(i + d + own.length) % own.length][0];
  if (ACC.p) { ACC.p.skin = k; ACC.emit(); }
  G.settings.avatar = k; G.saveSettings();
  if (NET.on()) NET.setAvatar(k);
  swapShowcase();
  renderRoom();
}
function roomLink() { return location.origin + location.pathname + '?sala=' + NET.code; }

// ---------- inventário (itens da partida) e arsenal (as 10 armas) ----------
let invTab = 'inv';
function openInventory(tab) {
  invTab = tab || (G.state === 'play' ? 'inv' : 'arsenal');
  if (G.state !== 'play') { $('invScr').dataset.from = 'menu'; }
  else $('invScr').dataset.from = 'game';
  showScreen('invScr');
  renderInventory(true);
}
function closeInventory() {
  if (G.state === 'play') showScreen(null); else goMenu();
}

function renderInventory(force) {
  document.querySelectorAll('#invTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === invTab));
  const box = $('invBody');
  if (invTab === 'arsenal') {
    if (!force && box.dataset.tab === 'arsenal') return;
    box.dataset.tab = 'arsenal';
    const thumbs = weaponThumbs();
    box.innerHTML = '<div class="arsenal">' + WPN.ORDER.map((id, i) => {
      const w = WEAPONS[id], r = WPN.RARITY[w.rarity];
      const bar = (v) => '<i><u style="width:' + Math.round(U.clamp(v, 0.05, 1) * 100) + '%"></u></i>';
      return '<div class="acard" style="--rc:' + r.color + '"><div class="ahead"><b>' + (i + 1) + '. ' + w.name.toUpperCase() + '</b><em>' + r.label + '</em></div>' +
        '<p>' + w.desc + '</p><img alt="" src="' + thumbs[id] + '">' +
        '<div class="astats"><span>Dano</span>' + bar(w.dmg * (w.pellets || 1) / 130) + '<span>Cadência</span>' + bar(0.12 / w.cd) + '<span>Alcance</span>' + bar(w.range / 260) + '<span>Precisão</span>' + bar(1 - w.spread * 30) + '</div>' +
        '<div class="aammo">' + icon('ammo') + w.mag + ' / ' + w.res + '</div></div>';
    }).join('') + '</div>';
    return;
  }
  const p = G.state === 'play' ? G.player : null;
  const key = p ? JSON.stringify([p.slots, p.cur, p.armor, p.helmet, p.kits, p.nades, p.gel]) : 'none';
  if (!force && box.dataset.key === key) return;
  box.dataset.key = key; box.dataset.tab = 'inv';
  const thumbs = weaponThumbs();
  const slot = (s, i) => {
    if (!s) return '<div class="islot w empty"><span class="n">' + (i + 1) + '</span><span>' + (i === 2 ? 'Secundária' : 'Arma principal') + '</span></div>';
    const w = WEAPONS[s.id], r = WPN.RARITY[w.rarity];
    return '<div class="islot w' + (p.cur === i ? ' on' : '') + '" data-slot="' + i + '" style="--rc:' + r.color + '"><span class="n">' + (i + 1) + '</span><img alt="" src="' + thumbs[s.id] + '"><b>' + w.name + '</b><span class="am">' + s.mag + ' / ' + s.reserve + '</span>' +
      '<span class="invBtns"><button class="invAct" data-drop="w:' + i + '">LARGAR</button>' + (s.reserve > 0 ? '<button class="invAct" data-drop="a:' + i + '">LARGAR MUNIÇÃO</button>' : '') + '</span></div>';
  };
  // botão LARGAR nos itens que dá para jogar fora
  const item = (ic, label, n, extra, drop) => '<div class="islot it' + (n ? '' : ' dim') + '">' + icon(ic) + '<b>' + label + '</b><span class="cnt">' + (extra || n) + '</span>' + (drop && n ? '<button class="invAct" data-drop="' + drop + '">LARGAR</button>' : '') + '</div>';
  box.innerHTML = '<div class="invGrid">' +
    '<div class="invChar">' + icon('user') + '<b>' + G.settings.name + '</b></div>' +
    '<div class="invW">' + (p ? p.slots.map(slot).join('') : '<p class="hint">As armas que você pegar na partida aparecem aqui. Veja todas no ARSENAL.</p>') + '</div>' +
    '<div class="invI">' + (p ? item('helmet', 'Capacete', p.helmet, p.helmet ? 'Nv.' + p.helmet : '—') + item('vest', 'Colete', p.armor, p.armor ? 'Nv.' + p.armor : '—') +
      item('bag', 'Mochila', 1, 'Nv.1') + item('grenade', 'Granada', p.nades, null, 'gren') + item('medkit', 'Kit médico', p.kits, null, 'kit') + item('gel', 'Gel', p.gel, null, 'gel') +
      item('ammo', 'Munição', 1, p.slots.reduce((t, s) => t + (s ? s.reserve : 0), 0)) : '') +
      '<div class="islot lock">' + icon('lock') + '</div><div class="islot lock">' + icon('lock') + '</div>' +
      (p && (p.kits >= 5 || p.nades >= 4 || p.gel >= 8 || p.slots.some(x => x && x.reserve >= ammoCap(x.id))) ? '<p class="invFull">' + icon('warn') + ' Mochila cheia em algum item: largue o que não quer para pegar mais.</p>' : '') + '</div></div>';
  box.querySelectorAll('[data-slot]').forEach(el => el.addEventListener('click', () => { selectSlot(G.player, +el.dataset.slot); renderInventory(true); }));
  box.querySelectorAll('[data-drop]').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); dropItem(el.dataset.drop); renderInventory(true); }));
}

// fotos das armas para o arsenal/inventário e das skins para a loja (desenhadas uma vez num renderer pequeno)
function renderThumbs(entries) {
  const out = {};
  try {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 140;
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xdde8ff, 0x445566, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 2); sc.add(dl);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
    for (const [key, make] of entries) {
      const m = make();
      sc.add(m);
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const halfW = Math.max(sz.x, sz.z) / 2 * 1.08, halfH = Math.max(halfW * 140 / 320, sz.y / 2 * 1.1);
      const hw = Math.max(halfW, halfH * 320 / 140);
      cam.left = -hw; cam.right = hw; cam.top = hw * 140 / 320; cam.bottom = -hw * 140 / 320; cam.updateProjectionMatrix();
      cam.position.set(c.x, c.y + 0.05, c.z + 10); cam.lookAt(c.x, c.y, c.z);
      r.setClearColor(0x000000, 0);
      r.render(sc, cam);
      out[key] = cv.toDataURL('image/png');
      sc.remove(m);
    }
    r.dispose();
    if (r.forceContextLoss) r.forceContextLoss();
  } catch (e) { for (const [key] of entries) out[key] = out[key] || ''; }
  return out;
}
const gunShot = (id, skin) => () => {
  const m = WPN.mesh(id, 0.008);
  if (skin) m.userData.main.material = WPN.skinMat(skin);
  m.rotation.set(0.12, -Math.PI / 2, 0);
  return m;
};
let thumbCache = null, skinThumbCache = null;
function weaponThumbs() {
  if (!thumbCache) thumbCache = renderThumbs(WPN.ORDER.map(id => [id, gunShot(id)]));
  return thumbCache;
}
// as skins são fotografadas com o próprio renderer do jogo (com o reflexo do céu, que faz o ouro e o gelo brilharem)
function skinThumbs() {
  if (skinThumbCache) return skinThumbCache;
  skinThumbCache = {};
  const list = Object.keys(WPN.SKINS).map(id => [id, gunShot(WPN.SKINS[id].gun, id), SHOP.guns[id]]);
  for (const id in WALL_SKINS) list.push([id, () => { const w = wallMesh(makeWallMat(id).mat); w.position.z = -WALL_R; const g = new THREE.Group(); g.add(w); g.rotation.x = 0.12; return g; }, SHOP.walls[id]]);
  try {
    const sc = new THREE.Scene();
    sc.environment = scene.environment;
    sc.add(new THREE.HemisphereLight(0xe6efff, 0x3a4250, 1.2));
    const dl = new THREE.DirectionalLight(0xffffff, 2.6); dl.position.set(2, 4, 5); sc.add(dl);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.4); rim.position.set(-3, 2, -4); sc.add(rim);
    const el = renderer.domElement, Wd = el.width, Ht = el.height;
    const cam = new THREE.PerspectiveCamera(20, Wd / Ht, 0.05, 200);
    const out = document.createElement('canvas'); out.width = 320; out.height = 140;
    const g2 = out.getContext('2d');
    const view = camera.view && camera.view.enabled;
    for (const [key, make, it] of list) {
      const m = make();
      sc.add(m); m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      // enquadra a peça na faixa central (proporção do cartão)
      const sh = Math.min(Ht, Wd * 140 / 320), sw = sh * 320 / 140;
      const halfV = Math.max(sz.y / 2, Math.max(sz.x, sz.z) / 2 * 140 / 320) * 1.18 * Ht / sh;
      const dist = halfV / Math.tan(THREE.MathUtils.degToRad(10)) + sz.z / 2;
      cam.position.set(c.x + dist * 0.12, c.y + dist * 0.06, c.z + dist); cam.lookAt(c);
      sc.background = new THREE.Color(RARE[(it && it.rare) || 'raro'][2]);
      renderer.setRenderTarget(null);
      renderer.render(sc, cam);
      g2.drawImage(el, (Wd - sw) / 2, (Ht - sh) / 2, sw, sh, 0, 0, 320, 140);
      skinThumbCache[key] = out.toDataURL('image/jpeg', 0.88);
      sc.remove(m);
    }
    if (view) { /* a câmera do menu continua com o deslocamento */ }
  } catch (e) { console.warn('fotos das skins', e); }
  return skinThumbCache;
}

// ---------- mapa completo ----------
function openMap() { showScreen('mapScr'); drawFullMap(); }
function drawFullMap() {
  const cv = $('fullMap'), S = Math.min(cv.parentNode.clientWidth, cv.parentNode.clientHeight) || 360;
  cv.width = cv.height = Math.floor(S);
  const g = cv.getContext('2d');
  drawMapLayer(g, cv.width, 0, 0, cv.width / 440, false, true);
}

// ---------- configurações ----------
const SETTINGS_UI = {
  geral: [
    { k: 'name', label: 'Nome', type: 'text' },
  ],
  sensibilidade: [
    { k: 'sens', label: 'Geral (câmera)', type: 'range', min: 0.1, max: 3, step: 0.05, show: v => Math.round(v * 100) + '%' },
    { k: 'sensDot', label: 'Mira 1x (ponto vermelho / holográfica)', type: 'range', min: 0.1, max: 3, step: 0.05, show: v => Math.round(v * 100) + '%' },
    { k: 'sens2x', label: 'Mira 2x (fuzis)', type: 'range', min: 0.1, max: 3, step: 0.05, show: v => Math.round(v * 100) + '%' },
    { k: 'sens4x', label: 'Luneta 4x (precisão)', type: 'range', min: 0.1, max: 3, step: 0.05, show: v => Math.round(v * 100) + '%' },
  ],
  graficos: [
    { k: 'quality', label: 'Qualidade gráfica', type: 'seg', opts: [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']], reload: true },
    { k: 'fx', label: 'Estilo da imagem', type: 'seg', opts: [['normal', 'Normal'], ['bodycam', 'Bodycam']] },
    { k: 'dynRes', label: 'Resolução automática (evita travar)', type: 'toggle' },
    { k: 'fps', label: 'Mostrar FPS', type: 'toggle' },
  ],
  controles: [
    { k: 'look', label: 'Câmera', type: 'seg', opts: [['tp', '3ª pessoa'], ['fp', '1ª pessoa (bodycam)']] },
    { k: 'hudEdit', label: 'Layout dos botões (HUD)', type: 'action', text: 'EDITAR HUD', run: () => openHudEditor() },
    { k: 'aimAssist', label: 'Assistência de mira', type: 'toggle' },
    { k: 'crossStyle', label: 'Mira', type: 'seg', opts: [['cruz', 'Cruz'], ['ponto', 'Ponto'], ['circulo', 'Círculo']] },
    { k: 'crossCol', label: 'Cor da mira', type: 'seg', opts: [['branco', 'Branca'], ['verde', 'Verde'], ['ciano', 'Ciano'], ['amarelo', 'Amarela'], ['rosa', 'Rosa']] },
    { k: 'btnSize', label: 'Tamanho dos botões', type: 'range', min: 0.75, max: 1.35, step: 0.05, show: v => Math.round(v * 100) + '%' },
    { k: 'btnAlpha', label: 'Opacidade dos botões', type: 'range', min: 0.35, max: 1, step: 0.05, show: v => Math.round(v * 100) + '%' },
  ],
  audio: [
    { k: 'sound', label: 'Som', type: 'toggle' },
    { k: 'music', label: 'Música', type: 'toggle' },
    { k: 'vol', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, show: v => Math.round(v * 100) },
    { k: 'vibra', label: 'Vibração', type: 'toggle' },
    { k: 'sfx', label: 'Efeitos sonoros', type: 'seg', opts: [['tiros', 'Só tiros'], ['todos', 'Todos']] },
  ],
};
let setTab = 'geral', settingsFrom = 'menu';
function openSettings(from) { settingsFrom = from; showScreen('settingsScr'); renderSettings(); }
function closeSettings() { if (settingsFrom === 'pause') showScreen('pauseScr'); else goMenu(); }
function renderSettings() {
  document.querySelectorAll('#setTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === setTab));
  const S = G.settings;
  $('setBody').innerHTML = SETTINGS_UI[setTab].map(o => {
    let ctl = '';
    if (o.type === 'range') ctl = '<input type="range" id="set_' + o.k + '" min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" value="' + S[o.k] + '"><output>' + o.show(S[o.k]) + '</output>';
    else if (o.type === 'toggle') ctl = '<button class="tog' + (S[o.k] ? ' on' : '') + '" id="set_' + o.k + '" aria-pressed="' + !!S[o.k] + '"><i></i></button>';
    else if (o.type === 'action') ctl = '<button class="chip hot" id="set_' + o.k + '">' + o.text + '</button>';
    else if (o.type === 'seg') ctl = '<div class="seg" id="set_' + o.k + '">' + o.opts.map(op => '<button data-v="' + op[0] + '" class="' + (S[o.k] === op[0] ? 'on' : '') + '">' + op[1] + '</button>').join('') + '</div>';
    else ctl = '<input type="text" id="set_' + o.k + '" maxlength="14" value="' + String(S[o.k]).replace(/"/g, '') + '">';
    return '<div class="setRow"><span>' + o.label + '</span><div class="ctl">' + ctl + '</div></div>';
  }).join('') + (setTab === 'graficos' ? '<p class="hint">Se o jogo travar no celular, use Baixa.</p>' : '');
  for (const o of SETTINGS_UI[setTab]) {
    const el = $('set_' + o.k);
    if (o.type === 'action') el.addEventListener('click', () => { SND.play('ui'); o.run(); });
    else if (o.type === 'range') el.addEventListener('input', () => { S[o.k] = +el.value; el.nextSibling.textContent = o.show(S[o.k]); applySettings(); G.saveSettings(); });
    else if (o.type === 'toggle') el.addEventListener('click', () => { S[o.k] = !S[o.k]; el.classList.toggle('on', S[o.k]); applySettings(); G.saveSettings(); SND.play('ui'); });
    else if (o.type === 'seg') el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (S[o.k] === b.dataset.v) return;
      S[o.k] = b.dataset.v; G.saveSettings();
      if (o.reload) location.reload();
      else { applySettings(); renderSettings(); }
    }));
    else {
      el.addEventListener('keydown', e => e.stopPropagation());
      el.addEventListener('change', () => { S[o.k] = el.value.trim().slice(0, 14) || 'Jogador'; G.saveSettings(); LOB.setName(S[o.k]); });
    }
  }
}
// ---------- editor de HUD: arrastar e redimensionar os botões; salva em G.settings.hud ----------
const HUD_EDIT = ['btnFire', 'btnFireL', 'btnAim', 'btnJump', 'btnCrouch', 'btnReload', 'btnInv', 'btnEmote', 'btnRun', 'btnGel', 'ffCount', 'joyBase', 'weaponBar', 'hudTR', 'hudTL'];
let heWork = null, heSel = null, heFrom = null;
function applyHudLayout() {
  const L = G.settings.hud || {};
  for (const id of HUD_EDIT) {
    const el = $(id); if (!el) continue;
    const c = L[id];
    if (!c) { el.classList.remove('hpos'); el.style.left = el.style.top = ''; el.style.removeProperty('--hs'); continue; }
    el.classList.add('hpos');
    el.style.left = (c.x * window.innerWidth) + 'px'; el.style.top = (c.y * window.innerHeight) + 'px';
    el.style.setProperty('--hs', c.s || 1);
  }
}
function openHudEditor() {
  heFrom = { screen: UI.screen, hud: H.hud.classList.contains('hidden'), touch: H.touch.classList.contains('hidden'), mode: H.touch.dataset.mode };
  showScreen(null);
  heWork = JSON.parse(JSON.stringify(G.settings.hud || {}));
  H.hud.classList.remove('hidden'); H.touch.classList.remove('hidden'); H.touch.dataset.mode = 'ground'; H.hud.dataset.mode = 'ground';
  document.body.classList.add('hud-editing');
  $('hudEdit').classList.remove('hidden');
  for (const id of HUD_EDIT) $(id).classList.add('hedit');
  heSelect(null);
}
function closeHudEditor(save) {
  if (save) { G.settings.hud = heWork; G.saveSettings(); }
  document.body.classList.remove('hud-editing');
  $('hudEdit').classList.add('hidden');
  for (const id of HUD_EDIT) $(id).classList.remove('hedit', 'sel');
  applyHudLayout();
  H.touch.dataset.mode = heFrom.mode || 'ground';
  H.hud.classList.toggle('hidden', heFrom.hud); H.touch.classList.toggle('hidden', heFrom.touch);
  showScreen(heFrom.screen === 'settingsScr' || !heFrom.screen ? 'settingsScr' : heFrom.screen);
}
function heSelect(id) {
  heSel = id;
  for (const k of HUD_EDIT) $(k).classList.toggle('sel', k === id);
  const v = id && heWork[id] ? heWork[id].s || 1 : 1;
  $('heSize').value = v; $('heSizeV').textContent = Math.round(v * 100) + '%';
  $('heSize').disabled = !id;
}
function heEnsure(id) {
  if (heWork[id]) return heWork[id];
  const r = $(id).getBoundingClientRect();
  return (heWork[id] = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight, s: 1 });
}
function initHudEditor() {
  for (const id of HUD_EDIT) {
    const el = $(id);
    let pid = null;
    el.addEventListener('pointerdown', (e) => {
      if (!document.body.classList.contains('hud-editing')) return;
      e.stopPropagation(); e.preventDefault();
      pid = e.pointerId; try { el.setPointerCapture(pid); } catch (er) { /* ok */ }
      heEnsure(id); heSelect(id);
    }, true);
    el.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId || !document.body.classList.contains('hud-editing')) return;
      e.stopPropagation();
      const c = heWork[id];
      c.x = U.clamp(e.clientX / window.innerWidth, 0.03, 0.97); c.y = U.clamp(e.clientY / window.innerHeight, 0.05, 0.97);
      const keep = G.settings.hud; G.settings.hud = heWork; applyHudLayout(); G.settings.hud = keep;
    }, true);
    const up = (e) => { if (pid === e.pointerId) pid = null; };
    el.addEventListener('pointerup', up, true); el.addEventListener('pointercancel', up, true);
  }
  $('heSize').addEventListener('input', () => {
    if (!heSel) return;
    heEnsure(heSel).s = +$('heSize').value; $('heSizeV').textContent = Math.round(+$('heSize').value * 100) + '%';
    const keep = G.settings.hud; G.settings.hud = heWork; applyHudLayout(); G.settings.hud = keep;
  });
  $('heReset').addEventListener('click', () => { heWork = {}; const keep = G.settings.hud; G.settings.hud = heWork; applyHudLayout(); G.settings.hud = keep; heSelect(null); SND.play('ui'); });
  $('heCancel').addEventListener('click', () => { SND.play('ui'); closeHudEditor(false); });
  $('heSave').addEventListener('click', () => { SND.play('ui'); closeHudEditor(true); notify('ok', 'Layout do HUD salvo'); });
  window.addEventListener('resize', applyHudLayout);
}

function applySettings() {
  const S = G.settings;
  SND.on = S.sound; SND.vol = S.vol;
  SND.music(S.music && (G.state === 'menu' || G.state === 'lobby'));
  $('fps').classList.toggle('hidden', !S.fps);
  document.documentElement.style.setProperty('--btn', S.btnSize);
  document.documentElement.style.setProperty('--btnA', S.btnAlpha);
}

// música ambiente simples do menu (acordes suaves)
SND.music = function (on) {
  on = on && G.settings.music && G.settings.sound;
  if (!on) { if (SND.musicIv) { clearInterval(SND.musicIv); SND.musicIv = 0; } return; }
  if (SND.musicIv || !SND.ctx) return;
  const chords = [[220, 277, 330], [196, 247, 294], [174.6, 220, 262], [196, 247, 330]];
  let i = 0;
  const playChord = () => {
    const c = SND.ctx; if (!c) return;
    const t = c.currentTime;
    for (const f of chords[i++ % chords.length]) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025 * (SND.vol || 1), t + 0.6); g.gain.linearRampToValueAtTime(0, t + 2.3);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 2.4);
    }
  };
  playChord();
  SND.musicIv = setInterval(playChord, 2400);
};

// ------------------------------------------------------------------ controles
function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (e.code === 'Escape') { if (G.state === 'play' && UI.screen) { showScreen(null); } else if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); }
    if (e.code === 'Tab' && G.state === 'play') { e.preventDefault(); UI.screen === 'inv' ? closeInventory() : openInventory('inv'); }
    if (e.code === 'KeyM' && G.state === 'play') { UI.screen === 'map' ? showScreen(null) : openMap(); }
    if (e.code === 'KeyB' && G.state === 'play') openEmoteWheel();
    if (e.code === 'KeyI' && G.state === 'play') input.inspect = true;
    if (e.code === 'KeyG' && G.state === 'play' && !e.repeat) startGelAim(0, 0);
    if (e.code === 'Backquote' && document.exitPointerLock) document.exitPointerLock();
    if (G.state === 'play' && (e.code === 'Space' || e.code.indexOf('Arrow') === 0)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyG') releaseGelAim(false); });
  const canvas = $('c');
  canvas.addEventListener('mousedown', (e) => {
    if (G.state !== 'play' || isTouchEvent(e)) return;
    SND.init();
    if (document.pointerLockElement !== canvas) {
      try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* opcional */ }
      return;
    }
    if (e.button === 0) { G.mouseFire = true; input.tapFire = true; }
    if (e.button === 2) input.aimToggle = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) G.mouseFire = false; });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { input.lookX += e.movementX * 0.0024; input.lookY += e.movementY * 0.0024; }
  });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) G.mouseFire = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  // roda do mouse: troca para a próxima arma (ou a anterior) entre as que você tem
  let wheelT = 0;
  window.addEventListener('wheel', (e) => {
    if (G.state !== 'play' || UI.screen || !G.player || !G.player.alive || G.player.phase !== 'ground') return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelT < 140 || Math.abs(e.deltaY) < 1) return;
    wheelT = now;
    const p = G.player, own = [0, 1, 2].filter(i => p.slots[i]);
    if (!own.length) return;
    const k = own.indexOf(p.cur), dir = e.deltaY > 0 ? 1 : -1;
    const next = own[k < 0 ? (dir > 0 ? 0 : own.length - 1) : (k + dir + own.length) % own.length];
    if (next !== p.cur || p.nadeHand) { if (p.nadeHand) { p.nadeHand = false; } selectSlot(p, next); }
  }, { passive: false });

  const touch = $('touch'), base = $('joyBase'), knob = $('joyKnob');
  let joyId = null, lookId = null, jx0 = 0, jy0 = 0, lx = 0, ly = 0;
  const JR = 56, LOOK = 0.0058;
  touch.addEventListener('pointerdown', (e) => {
    if (G.state !== 'play') return;
    SND.init();
    if (document.body.classList.contains('hud-editing')) return;
    if (e.clientX < window.innerWidth * 0.42 && joyId === null) {
      joyId = e.pointerId; jx0 = e.clientX; jy0 = e.clientY;
      base.style.left = jx0 + 'px'; base.style.top = jy0 + 'px';
      base.classList.add('active'); knob.style.transform = 'translate(-50%,-50%)';
    } else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    try { touch.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
  });
  touch.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) {
      let dx = e.clientX - jx0, dy = e.clientY - jy0;
      const d = Math.hypot(dx, dy);
      if (d > JR) { dx *= JR / d; dy *= JR / d; }
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      input.mx = dx / JR; input.my = -dy / JR;
    } else if (e.pointerId === lookId) {
      input.lookX += (e.clientX - lx) * LOOK; input.lookY += (e.clientY - ly) * LOOK;
      lx = e.clientX; ly = e.clientY;
    }
  });
  const end = (e) => {
    if (e.pointerId === joyId) { joyId = null; input.mx = 0; input.my = 0; base.classList.remove('active'); knob.style.transform = 'translate(-50%,-50%)'; applyHudLayout(); }
    if (e.pointerId === lookId) lookId = null;
  };
  touch.addEventListener('pointerup', end);
  touch.addEventListener('pointercancel', end);

  const holdBtn = (el, onDown, onUp, dragLook) => {
    let pid = null, px = 0, py = 0;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      SND.init();
      pid = e.pointerId; px = e.clientX; py = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      el.classList.add('down');
      onDown();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid || !dragLook) return;
      e.stopPropagation();
      input.lookX += (e.clientX - px) * LOOK; input.lookY += (e.clientY - py) * LOOK;
      px = e.clientX; py = e.clientY;
    });
    const up = (e) => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('down'); if (onUp) onUp(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  holdBtn($('btnFire'), () => { input.fire = true; input.tapFire = true; }, () => { input.fire = false; }, true);
  holdBtn($('btnFireL'), () => { input.fire = true; input.tapFire = true; }, () => { input.fire = false; }, true);
  holdBtn($('btnAim'), () => { input.aimToggle = true; });
  holdBtn($('btnJump'), () => { input.jump = true; });
  holdBtn($('btnCrouch'), () => { input.crouch = true; });
  holdBtn($('btnReload'), () => { input.reload = true; });
  holdBtn($('btnInv'), () => { UI.screen === 'inv' ? closeInventory() : openInventory('inv'); });
  holdBtn($('btnEmote'), () => { openEmoteWheel(); });
  holdBtn($('useBtn'), () => { input.use = true; });
  holdBtn($('vaultBtn'), () => { input.vault = true; });
  holdBtn($('btnRun'), () => { G.sprint = !G.sprint; $('btnRun').classList.toggle('on', G.sprint); });
  holdBtn($('btnSaltar'), () => { input.jump = true; });
  holdBtn($('btnChute'), () => { input.chute = true; });
  holdBtn($('btnBoard'), () => { input.board = true; });
  holdBtn($('wb0'), () => { input.slot = 0; });
  holdBtn($('wb1'), () => { input.slot = 1; });
  holdBtn($('wb2'), () => { input.slot = 2; });
  holdBtn($('wbNade'), () => { input.nade = true; });
  holdBtn($('wbKit'), () => { input.heal = true; });
  holdBtn($('wbInsp'), () => { input.inspect = true; });
  holdBtn($('btnPause'), () => { pauseGame(); });
  holdBtn($('btnMap'), () => { openMap(); });
  holdBtn($('mmWrap'), () => { openMap(); });
  // gel: segurar, arrastar para escolher o lugar e soltar
  const gb = $('btnGel');
  gb.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { gb.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } startGelAim(e.clientX, e.clientY); });
  gb.addEventListener('pointermove', (e) => { if (G.gelAim) { e.preventDefault(); moveGelAim(e.clientX, e.clientY); } });
  gb.addEventListener('pointerup', (e) => { e.preventDefault(); releaseGelAim(false); });
  gb.addEventListener('pointercancel', () => releaseGelAim(true));
  // marcar um ponto no mapa (toque de novo em cima para tirar)
  $('fullMap').addEventListener('pointerdown', (e) => {
    if (G.state !== 'play' && G.state !== 'pause') return;
    const cv = $('fullMap'), r = cv.getBoundingClientRect(), S = cv.width, sc = S / 440;
    const px = (e.clientX - r.left) * S / r.width, py = (e.clientY - r.top) * S / r.height;
    const x = (px - S / 2) / sc, z = (py - S / 2) / sc;
    G.marker = G.marker && Math.hypot(G.marker.x - x, G.marker.z - z) < 14 ? null : { x: x, z: z };
    NET.sendMark(G.marker);
    drawFullMap();
  });
}
function isTouchEvent(e) { return e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents); }

function initScreens() {
  const click = (id, fn) => $(id).addEventListener('click', () => { SND.init(); SND.play('ui'); fn(); });
  click('mPlay', () => { showScreen('modeScr'); LOB.renderMode(); });
  click('mdSolo', () => goLobby());
  click('mdCreate', () => { NET.createRoom(); openRoom(); });
  click('mdJoin', () => { showScreen('joinScr'); NET.setStatus(''); setTimeout(() => $('joinCode').focus(), 50); });
  click('mdBack', () => goMenu());
  click('joinGo', () => { NET.joinRoom($('joinCode').value); });
  $('joinCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') NET.joinRoom($('joinCode').value); });
  $('joinCode').addEventListener('input', () => { $('joinCode').value = $('joinCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  click('joinBack', () => { NET.leave(); showScreen('modeScr'); });
  click('roomStart', () => NET.hostStart());
  click('roomLeave', () => { NET.leave(); G.state = 'menu'; showScreen('modeScr'); });
  click('skinPrev', () => cycleSkin(-1));
  click('skinNext', () => cycleSkin(1));
  $('roomBots').addEventListener('change', () => NET.setBots($('roomBots').checked));
  click('roomCopy', () => {
    const t = NET.code;
    try { navigator.clipboard.writeText(t).then(() => notify('ok', 'Código copiado: ' + t), () => notify('info', 'Código: ' + t)); } catch (e) { notify('info', 'Código: ' + t); }
  });
  click('roomShareBtn', () => {
    const data = { title: 'Battle Island', text: 'Bora jogar Battle Island! Código da sala: ' + NET.code, url: roomLink() };
    if (navigator.share) navigator.share(data).catch(() => {});
    else { try { navigator.clipboard.writeText(data.text + ' ' + data.url); notify('ok', 'Convite copiado'); } catch (e) { notify('info', data.text); } }
  });
  click('exitBack', () => goMenu());
  click('roomMap', () => LOB.openMaps());
  click('lReady', () => beginMatch());
  click('lBack', () => { clearInterval(lobbyIv); G.state = 'menu'; goMenu(); });
  click('invClose', () => closeInventory());
  document.querySelectorAll('#invTabs button').forEach(b => b.addEventListener('click', () => { invTab = b.dataset.tab; renderInventory(true); SND.play('ui'); }));
  click('mapClose', () => showScreen(null));
  click('setClose', () => closeSettings());
  document.querySelectorAll('#setTabs button').forEach(b => b.addEventListener('click', () => { setTab = b.dataset.tab; renderSettings(); SND.play('ui'); }));
  click('pResume', () => resumeGame());
  click('pSet', () => openSettings('pause'));
  click('pLobby', () => { if (NET.isHost()) NET.hostEnd(); else if (NET.isClient()) NET.backToRoom(); else goMenu(); });
  click('pExit', () => { NET.leave(); goMenu(); showScreen('exitScr'); });
  click('rLobby', () => { if (NET.isHost()) NET.hostEnd(); else if (NET.isClient()) NET.backToRoom(); else goMenu(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !NET.live) pauseGame(); });
}

// ------------------------------------------------------------------ partida
function clearMatch() {
  G.wait = null;
  if (H.waitBox) H.waitBox.classList.add('hidden');
  if ($('csBuy')) $('csBuy').classList.add('hidden');
  if ($('csTags')) $('csTags').innerHTML = '';
  CS.tags = [];
  for (const a of G.actors) scene.remove(a.ch.root);
  for (const w of G.walls.slice()) { w.dead = true; scene.remove(w.grp); }
  G.walls.length = 0; W.dynamic.length = 0;
  G.loot.length = 0;
  renderLoot(0, 0);
  for (const n of G.nades) scene.remove(n.m);
  G.nades.length = 0;
  for (const p of G.props) scene.remove(p);
  G.props.length = 0;
  if (G.airdrop && G.airdrop.mesh) scene.remove(G.airdrop.mesh);
  if (G.airdrop && G.airdrop.col) W.removeCollider(G.airdrop.col);
  G.airdrop = { state: 'none' };
  G.actors = []; G.bots = [];
  FX.reset();
  if (H.killfeed) H.killfeed.innerHTML = '';
  if (arcLine) arcLine.visible = false;
  G.player = G.show || null;
}

// ------------------------------------------------------------------ laço principal
function tick(dt) {
  G.time += dt;
  updateFrustum();
  if (G.mode !== 'cs') updateDrop(dt);
  updatePlayer(dt);
  updateRespawn(dt);
  for (const a of G.actors) if (a.human && a.remote) updatePuppet(a, dt);
  for (const b of G.bots) updateBot(b, dt);
  updateWalls(dt);
  updateNades(dt);
  updateLoot(dt);
  if (G.mode === 'cs') CS.update(dt);
  else if (G.wait) updateWaiting(dt);
  else { updateZone(dt); updateAirdrop(dt); TEAM.check(); }
  if (G.endT > 0) { G.endT -= dt; if (G.endT <= 0) endMatch(); }
  NET.update(dt);
}

const clock = new THREE.Clock();
// resolução dinâmica: se o FPS cai, a imagem fica um pouco menor; quando sobra fôlego, volta
const PERF = { t: 0, n: 0, last: 0, fps: 60, sh: 0, slow: 0 };
function adaptQuality(raw) {
  PERF.t += raw; PERF.n++;
  if (PERF.t < 2) return;
  PERF.fps = PERF.n / PERF.t; PERF.t = 0; PERF.n = 0;
  if (G.state !== 'play') return;
  let s = G.dprScale || 1;
  if (!G.settings.dynRes) s = 1.25; // força voltar ao normal abaixo
  if (PERF.fps < 40 && s > 0.55) s = Math.max(0.55, s - 0.12);
  else if (PERF.fps > 56 && s < 1) s = Math.min(1, s + 0.06);
  if (s > 1) s = 1;
  if (s !== G.dprScale) { G.dprScale = s; renderer.setPixelRatio(G.baseDPR * s); renderer.setSize(window.innerWidth, window.innerHeight, false); }
  // mesmo na menor resolução continua travando: na próxima vez o jogo abre em qualidade baixa
  PERF.slow = s <= 0.55 && PERF.fps < 28 ? PERF.slow + 1 : 0;
  if (PERF.slow >= 4 && G.settings.quality !== 'baixa' && G.settings.dynRes) {
    G.settings.quality = 'baixa'; G.saveSettings(); PERF.slow = 0;
    notify('info', 'O celular estava travando: a qualidade foi para BAIXA (vale ao abrir o jogo de novo)');
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  // no máximo 60 quadros por segundo (telas de 90/120 Hz gastam bateria à toa)
  if (now && PERF.last && now - PERF.last < 15.5) return;
  PERF.last = now || 0;
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  WPN.timeU.value = (performance.now() / 1000) % 600;
  if (!G.built) return;
  adaptQuality(raw);
  if (G.state === 'play' || (NET.live && G.player && G.player.ch && (G.state === 'pause' || G.state === 'end'))) tick(dt);
  const menu = G.state === 'menu' || G.state === 'lobby';
  const focus = menu ? G.show.pos : G.player.phase === 'ground' ? G.player.pos : camera.position;
  if (G.state !== 'pause') {
    W.update(dt, focus.x, focus.z, focus.y);
    FX.update(dt, camera, W);
  }
  updateCamera(G.state === 'pause' ? 0 : dt);
  if (G.state === 'play') updateHUD(dt);
  const bodycam = G.settings.fx === 'bodycam';
  if (bodycam) POST.begin(renderer);
  if (isTouch && renderer.shadowMap.enabled) { PERF.sh = (PERF.sh + 1) % 2; if (!PERF.sh) renderer.shadowMap.needsUpdate = true; }
  renderer.render(scene, camera);
  // a arma da mira (1ª pessoa) só aparece dentro da partida
  if (G.ads && fpScene && fpGun.visible && (G.state === 'play' || G.state === 'pause')) {
    renderer.autoClear = false;
    renderer.clearDepth();
    fpScene.environment = scene.environment;
    renderer.render(fpScene, fpCam);
    renderer.autoClear = true;
  }
  if (bodycam) POST.end(renderer, performance.now() / 1000);
}

// ------------------------------------------------------------------ carregamento
const TIPS = ['Use o Gel para se proteger quando estiver sem cobertura.', 'Fique dentro da zona segura (parede azul).', 'Armas lendárias vêm no suprimento aéreo.',
  'Mire (botão da mira) para atirar com precisão.', 'A fumaça vermelha marca o suprimento aéreo.', 'O capacete reduz o dano na cabeça.'];
function boot() {
  initRenderer();
  initHUD();
  initInput();
  initScreens();
  initHudEditor();
  applyHudLayout();
  applySettings();
  frame();
  window.__game = {
    G: G, W: W, FX: FX, input: input, keys: keys, startMatch: startMatch, beginMatch: beginMatch, goMenu: goMenu, deployWall: deployWall, damageActor: damageActor, openAirdrop: openAirdrop,
    tick: tick, giveWeapon: giveWeapon, jumpOut: jumpOut, throwNade: throwNade, openInventory: openInventory, openMap: openMap, openSettings: openSettings,
    camera: function () { return camera; }, renderer: function () { return renderer; }, scene: function () { return scene; },
  };
  LOB.init();
  const steps = W.buildSteps(scene, G.settings.quality, G.settings.map);
  steps.unshift(['Personagens', () => CH.load()], ['Armas', () => WPN.load()], ['Itens', () => WPN.loadProps()]);
  steps.push(['Efeitos', () => FX.init(scene)]);
  steps.push(['Lobby', () => { LOB.buildStage(); setupShowcase(); G.player = G.show; }]);
  LOB.runSteps(steps, () => {
    G.built = true;
    G.state = 'menu';
    const code = new URLSearchParams(location.search).get('sala');
    // espera o banco de dados on-line (só existe aberto pelo link do claude.ai) antes de entrar na conta
    $('loadStep').textContent = 'Conectando sua conta…';
    $('loadScr').classList.remove('hidden', 'out');
    Promise.all([CLOUD.init().catch(() => false), SRV.init().catch(() => false)]).then(async () => {
      // com o servidor do jogo, a conta vem dele; se a sessão não vale mais, entra com a cópia do aparelho
      // (conta importada por código ou convidado) e o progresso sobe quando entrar com usuário e senha
      const inside = SRV.on ? (await SRV.restore()) || ACC.restore() : ACC.restore();
      $('loadScr').classList.add('out'); setTimeout(() => $('loadScr').classList.add('hidden'), 400);
      if (!inside) { LOB.pendingRoom = code; LOB.showAuth(); return; }
      LOB.enter();
      if (code) LOB.joinLink(code);
    });
  });
}

window.addEventListener('error', (e) => {
  const b = $('errorBox');
  if (b) { b.textContent = 'Erro: ' + e.message; b.classList.remove('hidden'); }
});
boot();
