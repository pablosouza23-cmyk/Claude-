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
};
// nomes dos personagens que dá para escolher
const SKINS = [['heroi', 'Cacheado'], ['swat', 'SWAT'], ['soldado', 'Soldado'], ['soldado2', 'Sargento'], ['bone', 'Boné'], ['camisa', 'Camiseta'], ['jeans', 'Jeans'], ['soldada', 'Soldada']];
const skinName = k => (SKINS.find(x => x[0] === k) || SKINS[0])[1];
const icon = (n, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[n] || '') + '</svg>';

// retículas de cada mira (ADS), como nas referências
const RETICLE = {
  reddot: '<circle cx="50" cy="50" r="3.2" fill="#ff2a2a"/><circle cx="50" cy="50" r="7" fill="#ff2a2a" opacity=".25"/>',
  greendot: '<circle cx="50" cy="50" r="12" fill="none" stroke="#3dff8a" stroke-width="2"/><circle cx="50" cy="50" r="2.2" fill="#3dff8a"/><path d="M50 32v8M50 60v8M32 50h8M60 50h8" stroke="#3dff8a" stroke-width="2"/>',
  cyan: '<circle cx="50" cy="50" r="14" fill="none" stroke="#39e0ff" stroke-width="2"/><circle cx="50" cy="50" r="2.4" fill="#39e0ff"/><path d="M50 36v5M50 59v5M36 50h5M59 50h5" stroke="#39e0ff" stroke-width="2"/>',
  diamond: '<path d="M50 32 68 50 50 68 32 50z" fill="none" stroke="#3aa0ff" stroke-width="2.4"/><path d="M50 43 57 50 50 57 43 50z" fill="none" stroke="#7fc8ff" stroke-width="1.6"/><circle cx="50" cy="50" r="2" fill="#bfe4ff"/>',
  orange: '<circle cx="50" cy="50" r="14" fill="none" stroke="#ff9a1c" stroke-width="2.4"/><circle cx="50" cy="50" r="2.6" fill="#ff9a1c"/><path d="M50 30v9M50 61v9M30 50h9M61 50h9" stroke="#ff9a1c" stroke-width="2"/>',
  brackets: '<path d="M34 40v-6h6M60 34h6v6M66 60v6h-6M40 66h-6v-6" fill="none" stroke="#ff2a2a" stroke-width="2.6"/><circle cx="50" cy="50" r="2.4" fill="#ff2a2a"/>',
  iron: '<path d="M50 36v8M50 56v8M36 50h8M56 50h8" stroke="#fff" stroke-width="2.4"/><circle cx="50" cy="50" r="1.6" fill="#ffd23c"/>',
  pistol: '<path d="M50 40v5M50 55v5M40 50h5M55 50h5" stroke="#fff" stroke-width="2"/><circle cx="50" cy="50" r="1.8" fill="#fff"/>',
  iron2: '<path d="M50 38v4M50 46v2M50 52v2M50 58v4M38 50h4M46 50h2M52 50h2M58 50h4" stroke="#fff" stroke-width="2"/>',
  scope: '',
};
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
  if (fpGun.userData.id === id) return;
  fpGun.userData.id = id;
  const h = fpGun.userData.holder;
  while (h.children.length) h.remove(h.children[0]);
  h.add(WPN.mesh(id, 0.006));
  const p = WPN.build(id);
  fpGun.userData.sightY = p.sightY; fpGun.userData.sightZ = p.sightZ;
  const sec = WEAPONS[id].secondary;
  fpGun.userData.hL.position.set(0.0, -0.07, sec ? 0.0 : Math.min(0.3, p.len * 0.5));
  fpGun.userData.hL.visible = !sec;
}

function updateCamera(dt) {
  const p = G.player;
  if (G.camOverride) { G.camOverride(camera, p); return; }
  if (G.state === 'menu' || G.state === 'lobby') { menuCamera(dt); return; }
  if (!p.alive) {
    G.deathOrbit = (G.deathOrbit || 0) + dt * 0.35;
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
  } else {
    const k = p.aim;
    const inside = W.inHouse(p.pos.x, p.pos.z);
    let dist = U.lerp(portrait ? 4.3 : 3.25, portrait ? 3.2 : 2.45, k);
    let sh = U.lerp(portrait ? 0.45 : 0.7, portrait ? 0.5 : 0.78, k);
    if (inside) { dist = Math.min(dist, 2.3); sh *= 0.75; fov += 6; }
    const head = _m.set(p.pos.x, p.pos.y + (p.crouch ? 1.15 : 1.6), p.pos.z);
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
    fpGun.position.set(0, -fpGun.userData.sightY + bob, -eye + fpGun.userData.sightZ + kick * 0.04);
    fpGun.rotation.x = kick * 0.05;
    fpGun.visible = w.sight !== 'scope';
  }
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
  const a = W.A.FAROL;
  const sp = { x: a.x - 6, z: a.z + 9 };
  const s = makeActor(G.settings.name, G.settings.avatar || CH.PLAYER_PAL, true);
  s.pos.set(sp.x, W.groundAt(sp.x, sp.z, 80), sp.z);
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
  const lobby = G.state === 'lobby';
  // de costas olhando a ilha (menu) ou de frente (lobby)
  const look = Math.atan2(-s.pos.x, -s.pos.z);
  s.face = lobby ? look + Math.PI + 0.5 : look;
  s.ch.body.rotation.y = s.face;
  CH.animate(s.ch, dt, { mode: 'ground', speed: 0, aim: 0, pitch: 0, armed: true });
  const f = s.face, fx = Math.sin(f), fz = Math.cos(f);
  const dist = lobby ? 3.0 : 3.1, side = lobby ? 0.4 : -2.3;
  camera.position.set(s.pos.x - fx * dist * (lobby ? -1 : 1) + fz * side, s.pos.y + (lobby ? 1.5 : 2.6), s.pos.z - fz * dist * (lobby ? -1 : 1) - fx * side);
  if (lobby) camera.lookAt(s.pos.x - fz * 0.6, s.pos.y + 1.2, s.pos.z + fx * 0.6);
  else camera.lookAt(s.pos.x + fx * 30 + fz * 16, s.pos.y - 4, s.pos.z + fz * 30 - fx * 16);
  const portrait = camera.aspect < 1;
  const fov = portrait ? 72 : 55;
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
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
  document.querySelectorAll('[data-icon]').forEach(el => { el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); });
  ['hud', 'touch', 'hpFill', 'hpNum', 'vestBadge', 'helmBadge', 'aliveNum', 'killNum', 'compassStrip', 'compassNum', 'notifs', 'areaBanner', 'areaName',
    'killBanner', 'kbCount', 'kbName', 'minimap', 'zoneTime', 'zoneText', 'topStatus', 'prep', 'prepNum', 'bigText', 'jumpHint', 'diveStats', 'diveHint', 'altMark',
    'crosshair', 'reticle', 'scope', 'hitmark', 'hurtArrow', 'handHint', 'killfeed', 'vignette', 'lowHp', 'useBtn', 'keysHint', 'fps', 'wb0', 'wb1', 'wb2', 'wbNade', 'wbKit', 'wbGel',
    'healRing', 'reloadBar'].forEach(id => { H[id] = $(id); });
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
  // barra de armas e itens
  for (let i = 0; i < 3; i++) {
    const s = p.slots[i], el = H['wb' + i];
    setHTML(el, 'wb' + i, weaponCard(s, i));
    setClass(el, 'wba' + i, 'active', p.cur === i && !p.nadeHand);
  }
  setHTML(H.wbNade, 'wbn', icon('grenade') + '<b>' + p.nades + '</b>');
  setHTML(H.wbKit, 'wbk', icon('medkit') + '<b>' + p.kits + '</b>');
  setHTML(H.wbGel, 'wbg', icon('gel') + '<b>' + p.gel + '</b>');
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
  setClass(H.crosshair, 'chW', 'wide', !!w && (w.type === 'shotgun' || w.type === 'smg' || w.type === 'lmg'));
  const sightType = ads && w ? w.sight : '';
  if (H.cache.sight !== sightType) {
    H.cache.sight = sightType;
    H.reticle.innerHTML = sightType && sightType !== 'scope' ? reticleSVG(sightType) : '';
    H.scope.classList.toggle('show', sightType === 'scope');
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
    if (!b.alive || b.phase !== 'ground' || G.time - b.lastFire > 2.5 || b.pos.distanceTo(p.pos) > 90) continue;
    g.beginPath(); g.arc(b.pos.x * scale, b.pos.z * scale, full ? 4 : 3, 0, 7); g.fill();
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
function killBanner(n, victim) {
  H.kbCount.textContent = n;
  H.kbName.textContent = victim;
  H.killBanner.classList.remove('show'); void H.killBanner.offsetWidth; H.killBanner.classList.add('show');
  clearTimeout(kbTimer); kbTimer = setTimeout(() => H.killBanner.classList.remove('show'), 2200);
  SND.play('kill');
}
function killFeed(killer, victim, weapon) {
  const el = document.createElement('div');
  el.className = 'kf';
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  el.innerHTML = victim ? '<b>' + esc(killer) + '</b> ' + icon('skull') + ' <b>' + esc(victim) + '</b> <span>' + esc(weapon) + '</span>'
    : '<b>' + esc(killer) + '</b> ' + icon('zone') + ' <span>zona</span>';
  H.killfeed.appendChild(el);
  while (H.killfeed.children.length > 4) H.killfeed.firstChild.remove();
  setTimeout(() => el.remove(), 5000);
}

// ------------------------------------------------------------------ telas
const UI = { screen: null };
function showScreen(id) {
  ['menuScr', 'modeScr', 'joinScr', 'roomScr', 'lobbyScr', 'invScr', 'mapScr', 'settingsScr', 'pauseScr', 'resultScr', 'exitScr'].forEach(s => $(s).classList.toggle('hidden', s !== id));
  UI.screen = id === 'invScr' ? 'inv' : id === 'mapScr' ? 'map' : id;
}

function goMenu() {
  if (G.state === 'play' || G.state === 'pause' || G.state === 'end') clearMatch();
  G.state = 'menu';
  H.hud.classList.add('hidden'); H.touch.classList.add('hidden');
  setupShowcase();
  G.show.ch.root.visible = true;
  showScreen('menuScr');
  $('welcomeName').textContent = G.settings.name;
  SND.music(true);
}

let lobbyT = 0, lobbyIv = 0;
function goLobby() {
  G.state = 'lobby';
  showScreen('lobbyScr');
  lobbyT = 15;
  $('lobbyPlayers').textContent = TOTAL + '/' + TOTAL;
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
  H.cache = {};
  G.botDmgScale = 0.55;
  G.time = 0; G.vignette = 0; G.endT = -1; G.area = null; G.deathOrbit = 0; G.mouseFire = false; G.prevFire = false; G.zoneWarned = -1; G.camDist = undefined;
  for (const k in input) if (typeof input[k] === 'boolean') input[k] = false;
  if (msg) {
    NET.buildActors(msg);
    scatterLoot(U.rng(msg.seed + 7));
  } else {
    const p = makeActor(G.settings.name || 'Jogador', G.settings.avatar || CH.PLAYER_PAL, true);
    p.ch.root.visible = false;
    G.player = p; G.actors.push(p);
    spawnBots();
    scatterLoot();
  }
  G.airdrop = { state: 'none' };
  initZone();
  if (msg) startDrop(msg.ang, msg.side); else startDrop();
  G.yaw = Math.atan2(G.drop.dir.x, G.drop.dir.z) + Math.PI + 1.1; G.pitch = -0.25;
  G.state = 'play';
  H.hud.classList.remove('hidden');
  H.touch.classList.toggle('hidden', !isTouch);
  H.prep.classList.remove('hidden');
  H.jumpHint.classList.remove('show');
  onResize();
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
  $('resPlace').innerHTML = '#' + G.place + '<small>/' + G.actors.length + '</small>';
  $('resKills').textContent = p.kills;
  $('resDmg').textContent = Math.round(p.dmgDealt);
  $('resTime').textContent = U.fmtTime(G.time);
  const others = NET.live && G.actors.some(a => a.human && a.alive && a !== p);
  $('rLobby').textContent = NET.on() ? 'VOLTAR PARA A SALA' : 'VOLTAR AO LOBBY';
  $('resNote').textContent = NET.isHost() && others ? 'Seus amigos ainda estão jogando. Voltar encerra a partida para todos.' : NET.isClient() && NET.live ? 'A partida continua para os outros.' : '';
  H.hud.classList.add('hidden'); H.touch.classList.add('hidden');
  showScreen('resultScr');
}

// ---------- sala multiplayer ----------
function renderRoom() {
  if (!$('roomScr')) return;
  const host = NET.isHost();
  $('roomCode').textContent = NET.code || '-----';
  const list = $('roomList');
  list.innerHTML = NET.players.map(p => '<li class="' + (p.pid === NET.pid ? 'me' : '') + '">' + icon(p.pid === 0 ? 'crown' : 'person') + '<span>' + escapeHTML(p.name) + '</span><small>' + skinName(p.av) + '</small>' + (p.pid === 0 ? '<em>ANFITRIÃO</em>' : p.pid === NET.pid ? '<em>VOCÊ</em>' : '') + '</li>').join('') +
    (NET.players.length < 2 ? '<li><small>Ninguém entrou ainda. Mande o código.</small></li>' : '');
  $('roomBots').checked = NET.bots;
  $('roomBots').disabled = !host;
  $('roomBotsRow').classList.toggle('hidden', !host && !NET.bots);
  $('roomStart').classList.toggle('hidden', !host);
  $('roomWait').classList.toggle('hidden', host);
  $('skinName').textContent = skinName(G.settings.avatar || 'heroi');
}
function escapeHTML(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function openRoom() { G.state = 'lobby'; showScreen('roomScr'); renderRoom(); }
function cycleSkin(d) {
  const i = SKINS.findIndex(x => x[0] === (G.settings.avatar || 'heroi'));
  const k = SKINS[(i + d + SKINS.length) % SKINS.length][0];
  if (NET.on()) NET.setAvatar(k); else { G.settings.avatar = k; G.saveSettings(); }
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
  if (G.state === 'play') showScreen(null); else showScreen('menuScr');
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
    return '<div class="islot w' + (p.cur === i ? ' on' : '') + '" data-slot="' + i + '" style="--rc:' + r.color + '"><span class="n">' + (i + 1) + '</span><img alt="" src="' + thumbs[s.id] + '"><b>' + w.name + '</b><span class="am">' + s.mag + ' / ' + s.reserve + '</span></div>';
  };
  const item = (ic, label, n, extra) => '<div class="islot it' + (n ? '' : ' dim') + '">' + icon(ic) + '<b>' + label + '</b><span class="cnt">' + (extra || n) + '</span></div>';
  box.innerHTML = '<div class="invGrid">' +
    '<div class="invChar">' + icon('user') + '<b>' + G.settings.name + '</b></div>' +
    '<div class="invW">' + (p ? p.slots.map(slot).join('') : '<p class="hint">As armas que você pegar na partida aparecem aqui. Veja todas no ARSENAL.</p>') + '</div>' +
    '<div class="invI">' + (p ? item('helmet', 'Capacete', p.helmet, p.helmet ? 'Nv.' + p.helmet : '—') + item('vest', 'Colete', p.armor, p.armor ? 'Nv.' + p.armor : '—') +
      item('bag', 'Mochila', 1, 'Nv.1') + item('grenade', 'Granada', p.nades) + item('medkit', 'Kit médico', p.kits) + item('gel', 'Gel', p.gel) +
      item('ammo', 'Munição', 1, p.slots.reduce((t, s) => t + (s ? s.reserve : 0), 0)) : '') +
      '<div class="islot lock">' + icon('lock') + '</div><div class="islot lock">' + icon('lock') + '</div></div></div>';
  box.querySelectorAll('[data-slot]').forEach(el => el.addEventListener('click', () => { selectSlot(G.player, +el.dataset.slot); renderInventory(true); }));
}

// fotos das armas para o arsenal/inventário (desenhadas uma vez num renderer pequeno)
let thumbCache = null;
function weaponThumbs() {
  if (thumbCache) return thumbCache;
  thumbCache = {};
  try {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 140;
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xdde8ff, 0x445566, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 2); sc.add(dl);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    for (const id of WPN.ORDER) {
      const m = WPN.mesh(id, 0.008);
      m.rotation.set(0.12, -Math.PI / 2, 0);
      sc.add(m);
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const halfW = Math.max(sz.x, sz.z) / 2 * 1.08, halfH = Math.max(halfW * 140 / 320, sz.y / 2 * 1.1);
      const hw = Math.max(halfW, halfH * 320 / 140);
      cam.left = -hw; cam.right = hw; cam.top = hw * 140 / 320; cam.bottom = -hw * 140 / 320; cam.updateProjectionMatrix();
      cam.position.set(c.x, c.y + 0.05, c.z + 3); cam.lookAt(c.x, c.y, c.z);
      r.setClearColor(0x000000, 0);
      r.render(sc, cam);
      thumbCache[id] = cv.toDataURL('image/png');
      sc.remove(m);
    }
    r.dispose();
    if (r.forceContextLoss) r.forceContextLoss();
  } catch (e) { for (const id of WPN.ORDER) thumbCache[id] = ''; }
  return thumbCache;
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
    { k: 'sens', label: 'Sensibilidade da câmera', type: 'range', min: 0.3, max: 2, step: 0.05, show: v => Math.round(v * 50) },
    { k: 'adsSens', label: 'Sensibilidade da mira', type: 'range', min: 0.3, max: 2, step: 0.05, show: v => Math.round(v * 50) },
  ],
  graficos: [
    { k: 'quality', label: 'Qualidade gráfica', type: 'seg', opts: [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']], reload: true },
    { k: 'fps', label: 'Mostrar FPS', type: 'toggle' },
  ],
  controles: [
    { k: 'btnSize', label: 'Tamanho dos botões', type: 'range', min: 0.75, max: 1.35, step: 0.05, show: v => Math.round(v * 100) + '%' },
    { k: 'btnAlpha', label: 'Opacidade dos botões', type: 'range', min: 0.35, max: 1, step: 0.05, show: v => Math.round(v * 100) + '%' },
  ],
  audio: [
    { k: 'sound', label: 'Som', type: 'toggle' },
    { k: 'music', label: 'Música', type: 'toggle' },
    { k: 'vol', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, show: v => Math.round(v * 100) },
    { k: 'vibra', label: 'Vibração', type: 'toggle' },
  ],
};
let setTab = 'geral', settingsFrom = 'menu';
function openSettings(from) { settingsFrom = from; showScreen('settingsScr'); renderSettings(); }
function closeSettings() { if (settingsFrom === 'pause') showScreen('pauseScr'); else showScreen('menuScr'); }
function renderSettings() {
  document.querySelectorAll('#setTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === setTab));
  const S = G.settings;
  $('setBody').innerHTML = SETTINGS_UI[setTab].map(o => {
    let ctl = '';
    if (o.type === 'range') ctl = '<input type="range" id="set_' + o.k + '" min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" value="' + S[o.k] + '"><output>' + o.show(S[o.k]) + '</output>';
    else if (o.type === 'toggle') ctl = '<button class="tog' + (S[o.k] ? ' on' : '') + '" id="set_' + o.k + '" aria-pressed="' + !!S[o.k] + '"><i></i></button>';
    else if (o.type === 'seg') ctl = '<div class="seg" id="set_' + o.k + '">' + o.opts.map(op => '<button data-v="' + op[0] + '" class="' + (S[o.k] === op[0] ? 'on' : '') + '">' + op[1] + '</button>').join('') + '</div>';
    else ctl = '<input type="text" id="set_' + o.k + '" maxlength="14" value="' + String(S[o.k]).replace(/"/g, '') + '">';
    return '<div class="setRow"><span>' + o.label + '</span><div class="ctl">' + ctl + '</div></div>';
  }).join('') + (setTab === 'graficos' ? '<p class="hint">Se o jogo travar no celular, use Baixa.</p>' : '');
  for (const o of SETTINGS_UI[setTab]) {
    const el = $('set_' + o.k);
    if (o.type === 'range') el.addEventListener('input', () => { S[o.k] = +el.value; el.nextSibling.textContent = o.show(S[o.k]); applySettings(); G.saveSettings(); });
    else if (o.type === 'toggle') el.addEventListener('click', () => { S[o.k] = !S[o.k]; el.classList.toggle('on', S[o.k]); applySettings(); G.saveSettings(); SND.play('ui'); });
    else if (o.type === 'seg') el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (S[o.k] === b.dataset.v) return;
      S[o.k] = b.dataset.v; G.saveSettings();
      if (o.reload) location.reload();
    }));
    else el.addEventListener('change', () => { S[o.k] = el.value.trim().slice(0, 14) || 'Jogador'; G.saveSettings(); $('welcomeName').textContent = S[o.k]; });
  }
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
    if (e.code === 'Backquote' && document.exitPointerLock) document.exitPointerLock();
    if (G.state === 'play' && (e.code === 'Space' || e.code.indexOf('Arrow') === 0)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
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

  const touch = $('touch'), base = $('joyBase'), knob = $('joyKnob');
  let joyId = null, lookId = null, jx0 = 0, jy0 = 0, lx = 0, ly = 0;
  const JR = 56, LOOK = 0.0058;
  touch.addEventListener('pointerdown', (e) => {
    if (G.state !== 'play') return;
    SND.init();
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
    if (e.pointerId === joyId) { joyId = null; input.mx = 0; input.my = 0; base.classList.remove('active'); knob.style.transform = 'translate(-50%,-50%)'; }
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
  holdBtn($('useBtn'), () => { input.use = true; });
  holdBtn($('btnSaltar'), () => { input.jump = true; });
  holdBtn($('btnChute'), () => { input.chute = true; });
  holdBtn($('btnBoard'), () => { input.board = true; });
  holdBtn($('wb0'), () => { input.slot = 0; });
  holdBtn($('wb1'), () => { input.slot = 1; });
  holdBtn($('wb2'), () => { input.slot = 2; });
  holdBtn($('wbNade'), () => { input.nade = true; });
  holdBtn($('wbKit'), () => { input.heal = true; });
  holdBtn($('wbGel'), () => { input.wall = true; });
  holdBtn($('btnPause'), () => { pauseGame(); });
  holdBtn($('btnMap'), () => { openMap(); });
  holdBtn($('mmWrap'), () => { openMap(); });
}
function isTouchEvent(e) { return e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents); }

function initScreens() {
  const click = (id, fn) => $(id).addEventListener('click', () => { SND.init(); SND.play('ui'); fn(); });
  click('mPlay', () => showScreen('modeScr'));
  click('mdSolo', () => goLobby());
  click('mdCreate', () => { NET.createRoom(); openRoom(); });
  click('mdJoin', () => { showScreen('joinScr'); NET.setStatus(''); setTimeout(() => $('joinCode').focus(), 50); });
  click('mdBack', () => showScreen('menuScr'));
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
  click('mInv', () => openInventory('arsenal'));
  click('mSet', () => openSettings('menu'));
  click('mExit', () => { showScreen('exitScr'); try { window.close(); } catch (e) { /* navegador pode bloquear */ } });
  click('exitBack', () => showScreen('menuScr'));
  click('lReady', () => beginMatch());
  click('lBack', () => { clearInterval(lobbyIv); G.state = 'menu'; showScreen('menuScr'); });
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
  for (const a of G.actors) scene.remove(a.ch.root);
  for (const w of G.walls.slice()) { w.dead = true; scene.remove(w.grp); }
  G.walls.length = 0; W.dynamic.length = 0;
  for (const it of G.loot) scene.remove(it.grp);
  G.loot.length = 0;
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
  updateDrop(dt);
  updatePlayer(dt);
  for (const a of G.actors) if (a.human && a.remote) updatePuppet(a, dt);
  for (const b of G.bots) updateBot(b, dt);
  updateWalls(dt);
  updateNades(dt);
  updateLoot(dt);
  updateZone(dt);
  updateAirdrop(dt);
  if (G.endT > 0) { G.endT -= dt; if (G.endT <= 0) endMatch(); }
  NET.update(dt);
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!G.built) return;
  if (G.state === 'play' || (NET.live && G.player && G.player.ch && (G.state === 'pause' || G.state === 'end'))) tick(dt);
  const menu = G.state === 'menu' || G.state === 'lobby';
  const focus = menu ? G.show.pos : G.player.phase === 'ground' ? G.player.pos : camera.position;
  if (G.state !== 'pause') {
    W.update(dt, focus.x, focus.z, focus.y);
    FX.update(dt, camera, W);
  }
  updateCamera(G.state === 'pause' ? 0 : dt);
  if (G.state === 'play') updateHUD(dt);
  renderer.render(scene, camera);
  if (G.ads && fpScene && fpGun.visible && G.state !== 'end') {
    renderer.autoClear = false;
    renderer.clearDepth();
    fpScene.environment = scene.environment;
    renderer.render(fpScene, fpCam);
    renderer.autoClear = true;
  }
}

// ------------------------------------------------------------------ carregamento
const TIPS = ['Use o Gel para se proteger quando estiver sem cobertura.', 'Fique dentro da zona segura (parede azul).', 'Armas lendárias vêm no suprimento aéreo.',
  'Mire (botão da mira) para atirar com precisão.', 'A fumaça vermelha marca o suprimento aéreo.', 'O capacete reduz o dano na cabeça.'];
function boot() {
  initRenderer();
  initHUD();
  initInput();
  initScreens();
  applySettings();
  frame();
  window.__game = {
    G: G, W: W, FX: FX, input: input, keys: keys, startMatch: startMatch, beginMatch: beginMatch, goMenu: goMenu, deployWall: deployWall, damageActor: damageActor, openAirdrop: openAirdrop,
    tick: tick, giveWeapon: giveWeapon, jumpOut: jumpOut, throwNade: throwNade, openInventory: openInventory, openMap: openMap, openSettings: openSettings,
    camera: function () { return camera; }, renderer: function () { return renderer; },
  };
  $('loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const steps = W.buildSteps(scene, G.settings.quality);
  steps.unshift(['Personagens', () => CH.load()]);
  steps.push(['Efeitos', () => FX.init(scene)]);
  steps.push(['Personagem', () => { setupShowcase(); G.player = G.show; }]);
  let i = 0;
  const next = () => {
    if (i >= steps.length) {
      G.built = true;
      $('loadBar').style.width = '100%';
      setTimeout(() => {
        $('loadScr').classList.add('hidden'); goMenu();
        const code = new URLSearchParams(location.search).get('sala');
        if (code) { showScreen('joinScr'); $('joinCode').value = code.toUpperCase().slice(0, 5); NET.joinRoom(code); }
      }, 150);
      return;
    }
    const s = steps[i++];
    $('loadStep').textContent = s[0] + '…';
    $('loadBar').style.width = Math.round(i / steps.length * 100) + '%';
    setTimeout(() => {
      const r = s[1]();
      if (r && r.then) r.then(next, e => { $('errorBox').textContent = 'Erro ao carregar: ' + e.message; $('errorBox').classList.remove('hidden'); });
      else next();
    }, 16);
  };
  next();
}

window.addEventListener('error', (e) => {
  const b = $('errorBox');
  if (b) { b.textContent = 'Erro: ' + e.message; b.classList.remove('hidden'); }
});
boot();
