'use strict';
// Lógica principal: avião e salto (prancha + paraquedas), jogador, câmera, armas, granada, gel (parede de gelo),
// bots, zona segura, suprimento aéreo, loot e HUD.
const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;

const G = {
  state: 'menu', time: 0, built: false,
  settings: { quality: 'media', sens: 1, name: 'Jogador', sound: true, fps: false },
  actors: [], bots: [], walls: [], loot: [], nades: [], props: [],
};

(function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('ilhaToonSettings') || 'null');
    if (s) Object.assign(G.settings, s);
  } catch (e) { /* armazenamento indisponível */ }
})();
G.saveSettings = function () {
  try { localStorage.setItem('ilhaToonSettings', JSON.stringify(G.settings)); } catch (e) { /* ignora */ }
};

const TOTAL = 25;
const BOT_NAMES = ['Coxinha', 'Pastel', 'Quindim', 'Jabuti', 'BotoRosa', 'TatuBola', 'Tapioca', 'Maracujá', 'Sabiá', 'Tucano', 'Açaí', 'Guaraná',
  'Curupira', 'Cuscuz', 'Paçoca', 'Brigadeiro', 'Capivara', 'Pamonha', 'Acarajé', 'Caju', 'Jacaré', 'Pequi', 'Saci', 'Mandioca'];
// armas vistas nos vídeos (UMP, M4A1, MP40, M1014, Woodpecker) + pistola do slot 3
const WEAPONS = {
  M4A1: { type: 'rifle', color: '#e0302b', dmg: 33, head: 52, cd: 0.11, mag: 30, spread: 0.011, range: 150, scope: 2.2 },
  UMP: { type: 'smg', color: '#f4a81b', dmg: 32, head: 46, cd: 0.1, mag: 30, spread: 0.015, range: 110, scope: 0 },
  MP40: { type: 'smg', color: '#9aa0a8', dmg: 24, head: 36, cd: 0.08, mag: 32, spread: 0.019, range: 90, scope: 0 },
  M1014: { type: 'shotgun', color: '#c08a4a', dmg: 15, head: 20, cd: 0.85, mag: 6, spread: 0.06, range: 35, pellets: 8, scope: 0 },
  Woodpecker: { type: 'marksman', color: '#8fbf5a', dmg: 62, head: 110, cd: 0.5, mag: 12, spread: 0.003, range: 200, scope: 3.6 },
  Pistola: { type: 'pistol', color: '#cfd3d8', dmg: 20, head: 32, cd: 0.2, mag: 15, spread: 0.013, range: 80, scope: 0, secondary: true },
};
const PRIMARIES = ['M4A1', 'UMP', 'MP40', 'M1014', 'Woodpecker'];
const VEST_RED = [0, 0.2, 0.3, 0.42];
const HELM_RED = [0, 0.25, 0.35, 0.45];
const ZONE_PHASES = [
  { wait: 70, shrink: 40, r: 100, dps: 2 },
  { wait: 35, shrink: 34, r: 60, dps: 4 },
  { wait: 28, shrink: 28, r: 34, dps: 7 },
  { wait: 22, shrink: 22, r: 16, dps: 11 },
  { wait: 18, shrink: 20, r: 0, dps: 16 },
];
const GRAV = 16;

let renderer, scene, camera, sun, hemi;
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ------------------------------------------------------------------ renderização
function initRenderer() {
  const q = G.settings.quality;
  const canvas = $('c');
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: q === 'alta', powerPreference: 'high-performance' });
  } catch (e) {
    $('errorBox').textContent = 'Seu navegador não conseguiu iniciar o WebGL. Ative a aceleração de hardware no Chrome e tente de novo.';
    $('errorBox').classList.remove('hidden');
    throw e;
  }
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(q === 'baixa' ? Math.min(dpr, 1) * 0.75 : q === 'media' ? Math.min(dpr, 1.3) : Math.min(dpr, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = q !== 'baixa';
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe9fb, 90, 520);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 1500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  hemi = new THREE.HemisphereLight(0xd8eeff, 0x74a344, 1.35);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
  sun.castShadow = renderer.shadowMap.enabled;
  const sz = q === 'alta' ? 2048 : 1024;
  sun.shadow.mapSize.set(sz, sz);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  G.sunDir = new V3(-0.55, 1, 0.42).normalize();

  window.addEventListener('resize', onResize);
}

function onResize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const showHint = isTouch && window.innerHeight > window.innerWidth && G.state === 'play';
  $('rotateHint').classList.toggle('hidden', !showHint);
  clearTimeout(G.hintTimer);
  if (showHint) G.hintTimer = setTimeout(() => $('rotateHint').classList.add('hidden'), 4000);
}

// ------------------------------------------------------------------ atores
function makeActor(name, pal, isPlayer) {
  const ch = CH.make(pal);
  scene.add(ch.root);
  return {
    name: name, ch: ch, isPlayer: isPlayer,
    pos: new V3(), vel: new V3(), vy: 0, onGround: true, face: 0, phase: 'plane', hs: 20, vdown: 12, board: true,
    hp: 200, maxHp: 200, armor: 0, helmet: 0, alive: true,
    slots: [null, null, null], cur: 3, nadeHand: false,
    reloadT: 0, fireCd: 0, lastFire: -9,
    gel: isPlayer ? 2 : 1, wallCd: 0, kits: 0, nades: 0, healT: 0, crouch: false,
    kills: 0, dmgDealt: 0, aim: 0, speed: 0, lastHurt: -9, lastAttacker: null, landT: 0,
  };
}

function curSlot(a) { return a.cur < 3 ? a.slots[a.cur] : null; }
function curW(a) { const s = curSlot(a); return s ? WEAPONS[s.id] : null; }
function weaponName(a) { if (a.nadeHand) return 'Granada'; const s = curSlot(a); return s ? s.id : 'Soco'; }
function hasGun(a) { return !!(a.slots[0] || a.slots[1] || a.slots[2]); }

function refreshGuns(a) {
  const s = curSlot(a);
  const inHand = a.nadeHand ? null : (s ? s.id : null);
  let back = null;
  for (let i = 0; i < 2; i++) if (a.slots[i] && i !== a.cur) back = a.slots[i].id;
  CH.setGuns(a.ch, inHand, back);
}

function giveWeapon(a, id, mag, reserve) {
  const w = WEAPONS[id];
  const entry = { id: id, mag: mag === undefined ? w.mag : mag, reserve: reserve === undefined ? w.mag * 3 : reserve };
  let idx;
  if (w.secondary) idx = 2;
  else if (!a.slots[0]) idx = 0;
  else if (!a.slots[1]) idx = 1;
  else idx = a.cur < 2 ? a.cur : 0;
  const old = a.slots[idx];
  a.slots[idx] = entry;
  a.cur = idx; a.nadeHand = false; a.reloadT = 0;
  refreshGuns(a);
  return old;
}

function selectSlot(a, i) {
  if (a.phase !== 'ground') return;
  if (i !== 3 && !a.slots[i]) { if (a.isPlayer) toast('Slot ' + (i + 1) + ' vazio'); return; }
  a.cur = i; a.nadeHand = false; a.reloadT = 0; a.fireCd = Math.max(a.fireCd, 0.25);
  refreshGuns(a);
}

function actorEye(a, out) { return out.set(a.pos.x, a.pos.y + (a.crouch ? 1.05 : 1.5), a.pos.z); }

const _tmpC = { type: 'c', x: 0, z: 0, r: 0.34, y0: 0, y1: 0 };
// disparo instantâneo: cenário, paredes de gelo e personagens
function traceShot(o, d, maxT, shooter) {
  const env = W.raycast(o, d, maxT);
  let best = env ? env.t : maxT, res = { t: best, env: env, actor: null, head: false };
  for (const a of G.actors) {
    if (!a.alive || a === shooter || a.phase === 'plane') continue;
    const top = a.crouch ? 1.0 : 1.42, hy = a.crouch ? 1.15 : 1.62;
    _tmpC.x = a.pos.x; _tmpC.z = a.pos.z; _tmpC.y0 = a.pos.y + 0.05; _tmpC.y1 = a.pos.y + top;
    let t = W.rayCollider(o, d, _tmpC, best);
    let head = false;
    const hx = o.x - a.pos.x, hyy = o.y - (a.pos.y + hy), hz = o.z - a.pos.z;
    const b = hx * d.x + hyy * d.y + hz * d.z, c = hx * hx + hyy * hyy + hz * hz - 0.04;
    const disc = b * b - c;
    if (disc > 0) {
      const th = -b - Math.sqrt(disc);
      if (th > 0 && th < best && (t < 0 || th < t)) { t = th; head = true; }
    }
    if (t >= 0 && t < best) { best = t; res = { t: t, env: null, actor: a, head: head }; }
  }
  res.t = best;
  res.point = new V3().copy(o).addScaledVector(d, best);
  return res;
}

function hitDamage(target, w, head) {
  if (!head) return w.dmg;
  return w.dmg + (w.head - w.dmg) * (1 - HELM_RED[target.helmet]);
}

// dispara a arma atual de 'a' a partir de o na direção d (já com mira)
const _sd = new V3(), _mz = new V3();
function fireGun(a, o, d, spread) {
  const s = curSlot(a), w = WEAPONS[s.id];
  s.mag--; a.fireCd = w.cd * (a.isPlayer ? 1 : 1.15); a.lastFire = G.time;
  const n = w.pellets || 1;
  const sum = new Map();
  a.ch.muzzle.getWorldPosition(_mz);
  const pd = a.pos.distanceTo(G.player.pos);
  for (let i = 0; i < n; i++) {
    const sp = spread + (n > 1 ? w.spread : 0);
    _sd.set(d.x + (Math.random() - 0.5) * sp * 2, d.y + (Math.random() - 0.5) * sp * 2, d.z + (Math.random() - 0.5) * sp * 2).normalize();
    const res = traceShot(o, _sd, w.range, a);
    if (a.isPlayer || pd < 140) FX.tracer(_mz, res.point);
    if (res.actor) {
      const dmg = hitDamage(res.actor, w, res.head) * (a.isPlayer ? 1 : G.botDmgScale);
      const prev = sum.get(res.actor) || { dmg: 0, head: false, point: res.point };
      prev.dmg += dmg; prev.head = prev.head || res.head;
      sum.set(res.actor, prev);
      FX.sprite(res.point, 0xff4040, 0.25, 0.15, null, 1, 0.8);
    } else if (res.env) {
      if (res.env.kind === 'wall') {
        damageWall(res.env.col.wall, w.dmg, res.point, _sd);
        if (a.isPlayer) { FX.number(res.point, w.dmg); hitMarker(false); }
      } else if (a.isPlayer || pd < 60) {
        FX.dust(res.point, res.env.kind === 'terrain' ? (W.sand(res.point.x, res.point.z) > 0.5 ? 0xe2cb95 : 0x8fbf5a) : 0xe8dcc0);
      }
    }
  }
  for (const [t, h] of sum) {
    if (a.isPlayer) {
      FX.number(h.point, Math.round(h.dmg * (1 - VEST_RED[t.armor])), h.head ? '#ff8a1c' : '#ff3f6e');
      hitMarker(h.head);
    }
    damageActor(t, h.dmg, a, h.head);
  }
  if (a.isPlayer || pd < 70) FX.flash(_mz);
  if (a.isPlayer) SND.play('shot'); else if (pd < 90) SND.play('shotFar', U.clamp(1 - pd / 90, 0.05, 0.6));
}

function punch(a) {
  a.fireCd = 0.45; a.lastFire = G.time; a.ch.punchT = 0.3;
  const fx = Math.sin(a.face), fz = Math.cos(a.face);
  for (const t of G.actors) {
    if (t === a || !t.alive || t.phase !== 'ground') continue;
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < 1.7 && (dx * fx + dz * fz) / (d || 1) > 0.4) {
      const p = new V3(t.pos.x, t.pos.y + 1.3, t.pos.z);
      if (a.isPlayer) { FX.number(p, Math.round(15 * (1 - VEST_RED[t.armor])), '#ff3f6e'); hitMarker(false); }
      damageActor(t, a.isPlayer ? 15 : 15 * G.botDmgScale, a, false);
      SND.play('hit', 0.8);
      break;
    }
  }
}

function damageActor(a, dmg, attacker, head, weapon) {
  if (!a.alive) return;
  const real = dmg * (1 - VEST_RED[a.armor]);
  a.hp -= real;
  a.lastHurt = G.time;
  a.ch.flash = 0.08;
  if (attacker) { a.lastAttacker = attacker; attacker.dmgDealt += real; }
  if (a.healT > 0) a.healT = 0;
  if (a.isPlayer) {
    G.vignette = Math.min(1, G.vignette + 0.35);
    if (attacker) G.hurtDir = Math.atan2(attacker.pos.x - a.pos.x, attacker.pos.z - a.pos.z);
  }
  if (a.hp <= 0) killActor(a, attacker, weapon || (attacker ? weaponName(attacker) : 'Zona'));
}

function killActor(a, killer, weapon) {
  a.hp = 0; a.alive = false;
  a.vel.set(0, 0, 0);
  if (killer && killer !== a) { killer.kills++; killFeed(killer.name, a.name, weapon); }
  else killFeed(a.name, null, 'Zona');
  // mochila caída com o que a pessoa carregava (como no vídeo)
  if (a.phase === 'ground') dropBag(a);
  if (a.isPlayer) {
    G.endT = 2.5;
    G.place = aliveCount() + 1;
  } else if (G.player.alive && aliveCount() === 1) {
    G.endT = 2.0; G.place = 1;
  }
}

function dropBag(a) {
  const x = a.pos.x, z = a.pos.z;
  const bag = bagMesh();
  bag.position.set(x + 0.4, W.groundAt(x, z, a.pos.y + 0.5), z - 0.3);
  bag.rotation.y = Math.random() * 6;
  scene.add(bag); G.props.push(bag);
  let k = 0;
  const spot = () => { const an = k++ * 1.3; return [x + Math.cos(an) * 1.1, z + Math.sin(an) * 1.1]; };
  for (const s of a.slots) if (s) { const p = spot(); spawnLoot('w:' + s.id, p[0], p[1], { mag: s.mag, reserve: s.reserve }); }
  if (a.kits) { const p = spot(); spawnLoot('kit', p[0], p[1]); }
  if (a.nades) { const p = spot(); spawnLoot('gren', p[0], p[1]); }
  if (a.gel) { const p = spot(); spawnLoot('gel', p[0], p[1]); }
  if (!a.isPlayer && Math.random() < 0.7) { const p = spot(); spawnLoot('ammo', p[0], p[1]); }
}

let bagPair = null;
function bagMesh() {
  if (!bagPair) bagPair = U.build([
    U.part(new THREE.SphereGeometry(0.42, 12, 8), 0x2d3f78, U.mat4(0, 0.25, 0, 0, 0, 0, 1, 0.62, 0.8), 'radial'),
    U.part(new THREE.BoxGeometry(0.5, 0.08, 0.3), 0x1e2a50, U.mat4(0, 0.42, 0.05), 'radial'),
    U.part(new THREE.BoxGeometry(0.3, 0.12, 0.06), 0xff7a1a, U.mat4(0, 0.25, 0.33), 'radial'),
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(bagPair.g, U.toon({ vertexColors: true })));
  g.add(new THREE.Mesh(bagPair.o, U.outlineMat(0.03)));
  return g;
}

function aliveCount() { let n = 0; for (const a of G.actors) if (a.alive) n++; return n; }

// ------------------------------------------------------------------ gel (parede de gelo)
const WALL_R = 3.6, WALL_ARC = 1.3, WALL_H = 2.5, WALL_T = 0.36, WALL_HP = 450, WALL_LIFE = 28, WALL_SEGS = 8;
let wallGeo = null, capGeo = null;

function buildWallGeo() {
  const pts = [];
  const a = WALL_R - WALL_T / 2, b = WALL_R + WALL_T / 2, rr = WALL_T / 2;
  pts.push(new THREE.Vector2(a, -0.5), new THREE.Vector2(b, -0.5), new THREE.Vector2(b, WALL_H - rr));
  for (let i = 1; i < 6; i++) {
    const t = i / 6 * Math.PI;
    pts.push(new THREE.Vector2(WALL_R + Math.cos(t) * rr, WALL_H - rr + Math.sin(t) * rr));
  }
  pts.push(new THREE.Vector2(a, WALL_H - rr), new THREE.Vector2(a, -0.5));
  const g = new THREE.LatheGeometry(pts, 18, -WALL_ARC / 2, WALL_ARC);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const phi = Math.atan2(p.getX(i), p.getZ(i));
    uv.setXY(i, (phi + WALL_ARC / 2) / WALL_ARC, U.clamp(p.getY(i) / WALL_H, 0, 1));
  }
  wallGeo = g;
  capGeo = new THREE.CylinderGeometry(WALL_T / 2, WALL_T / 2, WALL_H + 0.5 - WALL_T / 2, 10).translate(0, (WALL_H - WALL_T / 2 - 0.5) / 2, 0);
}

function wallBaseTexture(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#eef7ff'); gr.addColorStop(1, '#cfe6fa');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,190,230,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    const x = Math.random() * w, y = Math.random() * h;
    g.moveTo(x, y); g.quadraticCurveTo(x + 30, y + 10, x + 60 + Math.random() * 60, y - 10);
    g.stroke();
  }
  const ge = g.createLinearGradient(0, 0, w, 0);
  ge.addColorStop(0, 'rgba(160,200,240,0.55)'); ge.addColorStop(0.08, 'rgba(160,200,240,0)');
  ge.addColorStop(0.92, 'rgba(160,200,240,0)'); ge.addColorStop(1, 'rgba(160,200,240,0.55)');
  g.fillStyle = ge; g.fillRect(0, 0, w, h);
}

function drawCrack(g, x, y, ang, len, width, depth) {
  g.lineWidth = width;
  g.beginPath(); g.moveTo(x, y);
  let cx = x, cy = y;
  const steps = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < steps; i++) {
    ang += (Math.random() - 0.5) * 0.9;
    cx += Math.cos(ang) * len / steps; cy += Math.sin(ang) * len / steps;
    g.lineTo(cx, cy);
    if (depth > 0 && Math.random() < 0.35) {
      g.stroke();
      drawCrack(g, cx, cy, ang + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.6), len * 0.55, Math.max(0.8, width * 0.7), depth - 1);
      g.lineWidth = width; g.beginPath(); g.moveTo(cx, cy);
    }
  }
  g.stroke();
}

function deployWall(owner, towardYaw) {
  if (owner.gel <= 0 || owner.wallCd > 0 || !owner.alive || owner.phase !== 'ground') return false;
  owner.gel--; owner.wallCd = 0.8;
  if (!wallGeo) buildWallGeo();
  const fx = -Math.sin(towardYaw), fz = -Math.cos(towardYaw);
  const px = owner.pos.x + fx * 2.4, pz = owner.pos.z + fz * 2.4;
  const cx = px - fx * WALL_R, cz = pz - fz * WALL_R;
  const base = Math.min(W.height(px, pz), W.height(px + fz * 1.5, pz - fx * 1.5), W.height(px - fz * 1.5, pz + fx * 1.5), owner.pos.y);
  const phi0 = Math.atan2(fx, fz);

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const g = canvas.getContext('2d');
  wallBaseTexture(g, 512, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = U.toon({ map: tex, color: 0xffffff, emissive: 0x4a5c70 });
  const grp = new THREE.Group();
  grp.position.set(cx, base, cz);
  grp.rotation.y = phi0;
  const m = new THREE.Mesh(wallGeo, mat);
  m.castShadow = true; m.receiveShadow = true;
  grp.add(m);
  U.addOutline(m, 0.035);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(capGeo, mat);
    cap.position.set(Math.sin(s * WALL_ARC / 2) * WALL_R, -0.5, Math.cos(s * WALL_ARC / 2) * WALL_R);
    grp.add(cap);
    U.addOutline(cap, 0.035);
  }
  grp.scale.y = 0.05;
  scene.add(grp);

  const wall = { owner: owner, grp: grp, mat: mat, tex: tex, ctx: g, cx: cx, cz: cz, base: base, phi0: phi0, hp: WALL_HP, life: WALL_LIFE, grow: 0, cols: [], dead: false };
  for (let i = 0; i < WALL_SEGS; i++) {
    const phi = phi0 - WALL_ARC / 2 + (i + 0.5) / WALL_SEGS * WALL_ARC;
    const c = {
      type: 'b', x: cx + Math.sin(phi) * WALL_R, z: cz + Math.cos(phi) * WALL_R,
      hx: WALL_ARC * WALL_R / WALL_SEGS / 2 + 0.06, hz: WALL_T / 2, rot: phi, y0: base - 0.5, y1: base + WALL_H, wall: wall,
    };
    c.cs = Math.cos(phi); c.sn = Math.sin(phi); c.br = c.hx;
    wall.cols.push(c);
    W.dynamic.push(c);
  }
  G.walls.push(wall);
  for (let i = 0; i < 10; i++) {
    const phi = phi0 + (Math.random() - 0.5) * WALL_ARC;
    FX.shard(new V3(cx + Math.sin(phi) * WALL_R, base + 0.1, cz + Math.cos(phi) * WALL_R),
      new V3((Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2), 0.12 + Math.random() * 0.12, 0.9);
  }
  if (owner.isPlayer || owner.pos.distanceTo(G.player.pos) < 40) SND.play('wall', owner.isPlayer ? 1 : 0.4);
  return true;
}

function damageWall(wall, dmg, point, dir) {
  if (wall.dead) return;
  wall.hp -= dmg;
  const lx = point.x - wall.cx, lz = point.z - wall.cz;
  const phi = Math.atan2(lx, lz);
  const u = U.clamp((U.angDiff(wall.phi0 - WALL_ARC / 2, phi)) / WALL_ARC, 0, 1);
  const v = U.clamp((point.y - wall.base) / WALL_H, 0, 1);
  const g = wall.ctx, sev = 1 - wall.hp / WALL_HP;
  g.strokeStyle = 'rgba(28,36,60,0.85)';
  g.lineCap = 'round';
  const n = 2 + Math.floor(sev * 4);
  for (let i = 0; i < n; i++) drawCrack(g, u * 512, (1 - v) * 256, Math.random() * Math.PI * 2, 30 + sev * 90 + Math.random() * 30, 1.6 + sev, 2);
  if (sev > 0.3) for (let i = 0; i < 2; i++) drawCrack(g, Math.random() * 512, Math.random() * 256, Math.random() * Math.PI * 2, 40 + sev * 70, 1.2 + sev * 0.8, 2);
  wall.tex.needsUpdate = true;
  if (dir) for (let i = 0; i < 3; i++) {
    FX.shard(point.clone().addScaledVector(dir, -0.15),
      new V3(-dir.x * 2 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, -dir.z * 2 + (Math.random() - 0.5) * 3), 0.07 + Math.random() * 0.08, 0.9);
  }
  if (point.distanceTo(G.player.pos) < 30) SND.play('crack', 0.5);
  if (wall.hp <= 0) shatterWall(wall, dir);
}

function shatterWall(wall, dir) {
  if (wall.dead) return;
  wall.dead = true;
  for (const c of wall.cols) { c.dead = true; const i = W.dynamic.indexOf(c); if (i >= 0) W.dynamic.splice(i, 1); }
  scene.remove(wall.grp);
  wall.tex.dispose(); wall.mat.dispose();
  const i = G.walls.indexOf(wall); if (i >= 0) G.walls.splice(i, 1);
  const dx = dir ? dir.x : 0, dz = dir ? dir.z : 0;
  for (let k = 0; k < 38; k++) {
    const phi = wall.phi0 + (Math.random() - 0.5) * WALL_ARC;
    const y = wall.base + Math.random() * WALL_H;
    const p = new V3(wall.cx + Math.sin(phi) * WALL_R, y, wall.cz + Math.cos(phi) * WALL_R);
    const out = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2.5);
    FX.shard(p, new V3(Math.sin(phi) * out + dx * 3 + (Math.random() - 0.5) * 2, 1 + Math.random() * 4, Math.cos(phi) * out + dz * 3 + (Math.random() - 0.5) * 2),
      0.22 + Math.random() * 0.4, 2.2 + Math.random() * 1.4);
  }
  if (Math.hypot(wall.cx - G.player.pos.x, wall.cz - G.player.pos.z) < 45) SND.play('break', 0.8);
}

function updateWalls(dt) {
  for (let i = G.walls.length - 1; i >= 0; i--) {
    const w = G.walls[i];
    if (w.grow < 1) { w.grow = Math.min(1, w.grow + dt / 0.22); w.grp.scale.y = 0.05 + 0.95 * U.smooth(0, 1, w.grow); }
    w.life -= dt;
    if (w.life <= 0) shatterWall(w, null);
  }
}

// ------------------------------------------------------------------ granadas
let nadePair = null;
function nadeMesh() {
  if (!nadePair) nadePair = U.build([
    U.part(new THREE.SphereGeometry(0.11, 10, 8), 0x3f6b2c, U.mat4(0, 0, 0, 0, 0, 0, 1, 1.15, 1), 'radial'),
    U.part(new THREE.BoxGeometry(0.06, 0.06, 0.06), 0xd0d0d0, U.mat4(0, 0.13, 0), 'radial'),
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(nadePair.g, U.toon({ vertexColors: true })));
  g.add(new THREE.Mesh(nadePair.o, U.outlineMat(0.02)));
  return g;
}

function throwNade(a, vel) {
  if (a.nades <= 0) return;
  a.nades--; a.nadeHand = false; a.fireCd = 0.6; a.lastFire = G.time; a.ch.punchT = 0.3;
  refreshGuns(a);
  const m = nadeMesh();
  const p = new V3(a.pos.x, a.pos.y + 1.6, a.pos.z);
  m.position.copy(p);
  scene.add(m);
  G.nades.push({ owner: a, m: m, p: p, v: vel.clone(), t: 2.3 });
  if (a.isPlayer) SND.play('pick', 0.6);
}

function nadeVelocity(yaw, pitch, out) {
  const p = U.clamp(pitch + 0.32, -0.6, 1.2);
  return out.set(-Math.sin(yaw) * Math.cos(p), Math.sin(p), -Math.cos(yaw) * Math.cos(p)).multiplyScalar(17);
}

const _nb = new V3();
function stepNade(p, v, dt) {
  v.y -= GRAV * dt;
  const nx = p.x + v.x * dt, ny = p.y + v.y * dt, nz = p.z + v.z * dt;
  const g = W.height(nx, nz) + 0.1;
  if (ny < g) { p.set(nx, g, nz); v.y = Math.abs(v.y) * 0.35; v.x *= 0.6; v.z *= 0.6; return true; }
  p.set(nx, ny, nz);
  _nb.copy(p);
  if (W.collide(p, 0.1, p.y - 0.1, 0.2)) {
    // bateu em parede: rebate
    const dx = p.x - _nb.x, dz = p.z - _nb.z;
    if (Math.abs(dx) > Math.abs(dz)) v.x = -v.x * 0.45; else v.z = -v.z * 0.45;
    return true;
  }
  return false;
}

function updateNades(dt) {
  for (let i = G.nades.length - 1; i >= 0; i--) {
    const n = G.nades[i];
    n.t -= dt;
    stepNade(n.p, n.v, dt);
    n.m.position.copy(n.p);
    n.m.rotation.x += dt * 8;
    if (n.t <= 0) { explode(n); scene.remove(n.m); G.nades.splice(i, 1); }
  }
}

function explode(n) {
  const p = n.p;
  FX.explosion(p);
  const pd = p.distanceTo(G.player.pos);
  if (pd < 120) SND.play('break', U.clamp(1.4 - pd / 60, 0.2, 1.2));
  if (pd < 12) G.shake = 0.35;
  const R = 6.5;
  for (const a of G.actors) {
    if (!a.alive || a.phase !== 'ground') continue;
    const tp = new V3(a.pos.x, a.pos.y + 1.0, a.pos.z);
    const d = tp.distanceTo(p);
    if (d > R) continue;
    const dir = tp.clone().sub(p).normalize();
    const hit = W.raycast(p.clone().addScaledVector(dir, 0.2), dir, Math.max(0.1, d - 0.4), true);
    if (hit) continue; // atrás de cobertura
    const dmg = 15 + 110 * (1 - d / R);
    if (n.owner.isPlayer && a !== n.owner) { FX.number(tp, Math.round(dmg * (1 - VEST_RED[a.armor])), '#ff3f6e'); hitMarker(false); }
    const k = a === n.owner ? 0.5 : (a.isPlayer && !n.owner.isPlayer ? 0.8 : 1);
    damageActor(a, dmg * k, n.owner, false, 'Granada');
  }
  for (const w of G.walls.slice()) if (Math.hypot(w.cx - p.x, w.cz - p.z) < R + WALL_R) damageWall(w, 260, p, null);
}

// pontos da trajetória (granada na mão)
let arcLine = null;
function updateArc(show) {
  if (!arcLine) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
    arcLine = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe14d, size: 0.16, transparent: true, opacity: 0.95, depthWrite: false }));
    arcLine.frustumCulled = false;
    scene.add(arcLine);
  }
  arcLine.visible = show;
  if (!show) return;
  const p = new V3(G.player.pos.x, G.player.pos.y + 1.6, G.player.pos.z), v = nadeVelocity(G.yaw, G.pitch, new V3());
  const arr = arcLine.geometry.attributes.position.array;
  let landed = false;
  for (let i = 0; i < 40; i++) {
    if (!landed) for (let k = 0; k < 3; k++) if (stepNade(p, v, 0.03)) landed = true;
    arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
  }
  arcLine.geometry.attributes.position.needsUpdate = true;
}

// ------------------------------------------------------------------ loot
const LOOT = {
  vest1: { label: 'Colete Nv. 1', ring: 0x9aa7b5 }, vest2: { label: 'Colete Nv. 2', ring: 0x3aa0ff }, vest3: { label: 'Colete Nv. 3', ring: 0xb05cff },
  helm1: { label: 'Capacete Nv. 1', ring: 0x9aa7b5 }, helm2: { label: 'Capacete Nv. 2', ring: 0x3aa0ff }, helm3: { label: 'Capacete Nv. 3', ring: 0xb05cff },
  kit: { label: 'Kit Médico', ring: 0x4cd964 }, ammo: { label: 'Munição', ring: 0xffcc33 }, gel: { label: 'Gel', ring: 0x7fd6ff }, gren: { label: 'Granada', ring: 0x8fd14f },
};
const lootGeos = {};
function lootPair(type) {
  if (lootGeos[type]) return lootGeos[type];
  const parts = [];
  if (type.indexOf('vest') === 0) {
    const col = [0, 0x8b9aa8, 0x2f6fb5, 0x6b3fa8][+type.slice(-1)];
    parts.push(U.part(new THREE.BoxGeometry(0.5, 0.6, 0.22), col, U.mat4(0, 0.3, 0), 'radial'));
    parts.push(U.part(new THREE.BoxGeometry(0.52, 0.08, 0.24), 0x222222, U.mat4(0, 0.38, 0), 'radial'));
  } else if (type.indexOf('helm') === 0) {
    const col = [0, 0x8b9aa8, 0x3d6b3a, 0x6b3fa8][+type.slice(-1)];
    parts.push(U.part(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), col, U.mat4(0, 0.12, 0), 'radial'));
    parts.push(U.part(new THREE.BoxGeometry(0.5, 0.04, 0.5), 0x2a2a2a, U.mat4(0, 0.12, 0), 'radial'));
  } else if (type === 'kit') {
    parts.push(U.part(new THREE.BoxGeometry(0.45, 0.32, 0.3), 0xf6f6f6, U.mat4(0, 0.16, 0), 'radial'));
    parts.push(U.part(new THREE.BoxGeometry(0.26, 0.08, 0.31), 0xe23b3b, U.mat4(0, 0.18, 0), 'radial'));
    parts.push(U.part(new THREE.BoxGeometry(0.08, 0.26, 0.31), 0xe23b3b, U.mat4(0, 0.18, 0), 'radial'));
  } else if (type === 'ammo') {
    parts.push(U.part(new THREE.BoxGeometry(0.42, 0.26, 0.28), 0x5d7a2e, U.mat4(0, 0.13, 0), 'radial'));
    parts.push(U.part(new THREE.BoxGeometry(0.3, 0.06, 0.29), 0xf2c94c, U.mat4(0, 0.2, 0), 'radial'));
  } else if (type === 'gren') {
    parts.push(U.part(new THREE.SphereGeometry(0.15, 10, 8), 0x3f6b2c, U.mat4(0, 0.17, 0, 0, 0, 0, 1, 1.15, 1), 'radial'));
    parts.push(U.part(new THREE.BoxGeometry(0.08, 0.08, 0.08), 0xd0d0d0, U.mat4(0, 0.36, 0), 'radial'));
  } else if (type === 'gel') {
    parts.push(U.part(new THREE.OctahedronGeometry(0.28, 0), 0xdff4ff, U.mat4(0, 0.35, 0, 0, 0, 0, 0.8, 1.3, 0.8), 'radial'));
  }
  return (lootGeos[type] = U.build(parts));
}

const lootMat = U.toon({ vertexColors: true, emissive: 0x222222 });
const ringMats = {};
const ringGeo = new THREE.RingGeometry(0.45, 0.6, 24);
function lootMesh(type) {
  const grp = new THREE.Group();
  let pair, ring;
  const isW = type.indexOf('w:') === 0;
  if (isW) { pair = CH.gunPair(type.slice(2)); ring = 0xffb347; } else { pair = lootPair(type); ring = LOOT[type].ring; }
  const holder = new THREE.Group();
  holder.add(new THREE.Mesh(pair.g, lootMat)); holder.add(new THREE.Mesh(pair.o, U.outlineMat(0.025)));
  if (isW) { holder.scale.setScalar(1.5); holder.rotation.z = Math.PI / 2; }
  grp.add(holder);
  if (!ringMats[ring]) ringMats[ring] = new THREE.MeshBasicMaterial({ color: ring, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  const r = new THREE.Mesh(ringGeo, ringMats[ring]);
  r.rotation.x = -Math.PI / 2; r.position.y = 0.04;
  grp.add(r);
  grp.userData.spin = holder;
  return grp;
}

function spawnLoot(type, x, z, extra) {
  const grp = lootMesh(type);
  const y = W.groundAt(x, z, W.height(x, z) + 1.0);
  grp.position.set(x, y, z);
  scene.add(grp);
  const it = { type: type, grp: grp, x: x, z: z, y: y, t: Math.random() * 6, extra: extra || null, isWeapon: type.indexOf('w:') === 0 };
  G.loot.push(it);
  return it;
}

function scatterLoot() {
  const rnd = U.rng(Math.floor(Math.random() * 1e9));
  const table = ['w:M4A1', 'w:UMP', 'w:MP40', 'w:M1014', 'w:Woodpecker', 'w:Pistola', 'w:UMP', 'w:M4A1',
    'vest1', 'vest1', 'vest2', 'helm1', 'helm1', 'helm2', 'kit', 'kit', 'ammo', 'ammo', 'ammo', 'gel', 'gel', 'gren', 'gren'];
  const pick = () => table[Math.floor(rnd() * table.length)];
  for (const s of W.lootSpots) if (rnd() < 0.85) spawnLoot(pick(), s[0], s[1]);
  for (const a of W.areaDefs) {
    for (let i = 0; i < 12; i++) {
      const an = rnd() * 6.28, r = rnd() * a.r * 0.85;
      spawnLoot(pick(), a.x + Math.cos(an) * r, a.z + Math.sin(an) * r);
    }
  }
  for (let i = 0; i < 70; i++) {
    const an = rnd() * 6.28, r = Math.sqrt(rnd()) * 122;
    spawnLoot(i % 3 === 0 ? 'w:' + PRIMARIES[Math.floor(rnd() * 5)] : pick(), Math.cos(an) * r, Math.sin(an) * r);
  }
}

function lootLabel(it) { return it.isWeapon ? it.type.slice(2) : LOOT[it.type].label; }

// itens que não são arma entram sozinhos ao passar por cima
function takeLoot(a, it) {
  const t = it.type;
  if (it.isWeapon) {
    if (a.isPlayer) return false; // o jogador pega arma com PEGAR (E)
    const id = t.slice(2);
    if (hasGun(a) && !(WEAPONS[id].secondary && !a.slots[2])) return false;
    giveWeapon(a, id, it.extra ? it.extra.mag : undefined, it.extra ? it.extra.reserve : undefined);
    return true;
  }
  if (t.indexOf('vest') === 0) {
    const lvl = +t.slice(-1); if (lvl <= a.armor) return false;
    a.armor = lvl; if (a.isPlayer) toast('Colete Nv. ' + lvl + ' Equipado');
  } else if (t.indexOf('helm') === 0) {
    const lvl = +t.slice(-1); if (lvl <= a.helmet) return false;
    a.helmet = lvl; if (a.isPlayer) toast('Capacete Nv. ' + lvl + ' Equipado');
  } else if (t === 'kit') {
    if (a.kits >= 5) return false; a.kits++; if (a.isPlayer) toast('+1 Kit Médico');
  } else if (t === 'ammo') {
    let any = false;
    for (const s of a.slots) if (s) { s.reserve += WEAPONS[s.id].mag * 2; any = true; }
    if (!any) return false;
    if (a.isPlayer) toast('+ Munição');
  } else if (t === 'gel') {
    if (a.gel >= 8) return false; a.gel = Math.min(8, a.gel + 2); if (a.isPlayer) toast('+2 Gel');
  } else if (t === 'gren') {
    if (a.nades >= 4) return false; a.nades++; if (a.isPlayer) toast('+1 Granada');
  }
  if (a.isPlayer) SND.play('pick');
  return true;
}

function removeLoot(it) {
  scene.remove(it.grp);
  const i = G.loot.indexOf(it); if (i >= 0) G.loot.splice(i, 1);
}

function nearestWeaponLoot(a, maxD) {
  let best = null, bd = maxD;
  for (const it of G.loot) {
    if (!it.isWeapon) continue;
    const d = Math.hypot(it.x - a.pos.x, it.z - a.pos.z);
    if (d < bd && Math.abs(it.y - a.pos.y) < 1.6) { bd = d; best = it; }
  }
  return best;
}

function playerPickup() {
  const p = G.player;
  const it = nearestWeaponLoot(p, 2.2);
  if (!it) return;
  const id = it.type.slice(2);
  const old = giveWeapon(p, id, it.extra ? it.extra.mag : undefined, it.extra ? it.extra.reserve : undefined);
  removeLoot(it);
  if (old) spawnLoot('w:' + old.id, p.pos.x + Math.sin(p.face) * 0.8, p.pos.z + Math.cos(p.face) * 0.8, { mag: old.mag, reserve: old.reserve });
  toast(id + ' equipada');
  SND.play('pick');
}

function updateLoot(dt) {
  const px = G.player.pos.x, pz = G.player.pos.z;
  for (let i = G.loot.length - 1; i >= 0; i--) {
    const it = G.loot[i];
    it.t += dt;
    const dx0 = Math.abs(it.x - px), dz0 = Math.abs(it.z - pz);
    it.grp.visible = dx0 < 110 && dz0 < 110;
    if (dx0 < 50 && dz0 < 50) {
      it.grp.userData.spin.rotation.y = it.t * 1.4;
      it.grp.userData.spin.position.y = 0.12 + Math.sin(it.t * 2.5) * 0.05;
    }
    for (const a of G.actors) {
      if (!a.alive || a.phase !== 'ground') continue;
      const dx = a.pos.x - it.x, dz = a.pos.z - it.z;
      if (dx * dx + dz * dz < 1.5 * 1.5 && Math.abs(a.pos.y - it.y) < 1.5 && takeLoot(a, it)) { removeLoot(it); break; }
    }
  }
}

// ------------------------------------------------------------------ zona segura
function initZone() {
  G.zone = { phase: 0, cx: 0, cz: 0, r: 180, fromX: 0, fromZ: 0, fromR: 180, toX: 0, toZ: 0, toR: 180, waiting: true, timer: 0, dps: 1, marked: false };
  if (!G.zoneMesh) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ float s = 0.5 + 0.5*sin(vUv.x*900.0 + uTime*2.0); float a = mix(0.42, 0.08, vUv.y) * (0.75 + 0.25*s); gl_FragColor = vec4(0.32,0.66,1.0,a); }',
    });
    G.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 120, 96, 1, true), mat);
    G.zoneMesh.position.y = 45;
    G.zoneMesh.renderOrder = 5;
    scene.add(G.zoneMesh);
    // marcação da próxima zona no chão (vista de cima durante o salto)
    G.zoneRing = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 7, 96, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc2dc, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    G.zoneRing.position.y = 1;
    scene.add(G.zoneRing);
  }
  nextZonePhase();
}

function nextZonePhase() {
  const z = G.zone, ph = ZONE_PHASES[z.phase];
  if (!ph) { z.waiting = true; z.timer = 9999; z.final = true; G.zoneRing.visible = false; return; }
  z.fromX = z.cx; z.fromZ = z.cz; z.fromR = z.r;
  const maxOff = Math.max(0, Math.min(z.r, 150) - ph.r) * 0.6;
  const a = Math.random() * 6.28, d = Math.random() * maxOff;
  z.toX = U.clamp(z.cx + Math.cos(a) * d, -95, 95);
  z.toZ = U.clamp(z.cz + Math.sin(a) * d, -95, 95);
  z.toR = ph.r;
  z.waiting = true; z.timer = ph.wait; z.dps = ph.dps;
  G.zoneRing.visible = true;
  G.zoneRing.position.set(z.toX, 1, z.toZ);
  G.zoneRing.scale.set(Math.max(z.toR, 1), 1, Math.max(z.toR, 1));
  if (z.phase > 0) announce('ZONA MARCADA NO MAPA');
}

function updateZone(dt) {
  const z = G.zone;
  if (!z.marked && G.time > 7) { z.marked = true; announce('ZONA MARCADA NO MAPA'); }
  z.timer -= dt;
  if (z.waiting) {
    if (z.timer <= 0 && !z.final) { z.waiting = false; z.timer = ZONE_PHASES[z.phase].shrink; }
  } else {
    const ph = ZONE_PHASES[z.phase];
    const k = U.clamp(1 - z.timer / ph.shrink, 0, 1);
    z.cx = U.lerp(z.fromX, z.toX, k); z.cz = U.lerp(z.fromZ, z.toZ, k); z.r = U.lerp(z.fromR, z.toR, k);
    if (z.timer <= 0) { z.phase++; nextZonePhase(); }
  }
  G.zoneMesh.position.x = z.cx; G.zoneMesh.position.z = z.cz;
  G.zoneMesh.scale.set(Math.max(z.r, 0.5), 1, Math.max(z.r, 0.5));
  G.zoneMesh.material.uniforms.uTime.value = G.time;
  // a marcação rosa da próxima zona só aparece vista do alto (no salto), como no vídeo
  G.zoneRing.visible = !z.final && G.player.phase !== 'ground';
  for (const a of G.actors) {
    if (!a.alive || a.phase !== 'ground') continue;
    if (Math.hypot(a.pos.x - z.cx, a.pos.z - z.cz) > z.r) {
      a.zoneAcc = (a.zoneAcc || 0) + dt;
      if (a.zoneAcc >= 1) {
        a.zoneAcc = 0;
        a.hp -= z.dps; a.lastHurt = G.time;
        if (a.isPlayer) { G.vignette = Math.min(1, G.vignette + 0.25); FX.number(new V3(a.pos.x, a.pos.y + 2, a.pos.z), z.dps, '#7fc4ff'); }
        if (a.hp <= 0) killActor(a, null, 'Zona');
      }
    } else a.zoneAcc = 0;
  }
}

// ------------------------------------------------------------------ suprimento aéreo
function buildAirdropMesh() {
  const grp = new THREE.Group();
  const pair = U.build([
    U.part(new THREE.BoxGeometry(1.4, 1.1, 1.4), 0x3e5f8a, U.mat4(0, 0.55, 0), 'radial'),
    U.part(new THREE.BoxGeometry(1.44, 0.18, 1.44), 0xf2a81d, U.mat4(0, 0.85, 0), 'radial'),
    U.part(new THREE.BoxGeometry(1.44, 0.18, 1.44), 0xf2a81d, U.mat4(0, 0.25, 0), 'radial'),
    U.part(new THREE.BoxGeometry(0.2, 1.12, 1.45), 0x2b3f5c, U.mat4(0, 0.55, 0), 'radial'),
  ]);
  const crate = new THREE.Mesh(pair.g, U.toon({ vertexColors: true }));
  crate.castShadow = true;
  grp.add(crate); grp.add(new THREE.Mesh(pair.o, U.outlineMat(0.035)));
  const chute = new THREE.Group();
  const canopy = new THREE.Mesh(CH.chuteGeo(), U.toon({ vertexColors: true, side: THREE.DoubleSide }));
  canopy.position.y = 3.2;
  chute.add(canopy);
  grp.add(chute);
  grp.userData.chute = chute;
  return grp;
}

function updateAirdrop(dt) {
  const ad = G.airdrop;
  if (ad.state === 'none') {
    if (G.time > 85) {
      const z = G.zone;
      const a = Math.random() * 6.28, d = Math.random() * Math.min(z.toR, 60) * 0.6;
      ad.x = z.toX + Math.cos(a) * d; ad.z = z.toZ + Math.sin(a) * d;
      ad.gy = W.groundAt(ad.x, ad.z, 50); ad.y = ad.gy + 75;
      ad.mesh = buildAirdropMesh();
      ad.mesh.position.set(ad.x, ad.y, ad.z);
      scene.add(ad.mesh);
      ad.state = 'falling';
      announce('SUPRIMENTO AÉREO CAINDO! (fumaça vermelha)');
    }
    return;
  }
  if (ad.state === 'falling') {
    ad.y -= dt * 6;
    if (ad.y <= ad.gy) {
      ad.y = ad.gy; ad.state = 'landed'; ad.smokeT = 0;
      ad.col = W.addCollider({ type: 'b', x: ad.x, z: ad.z, hx: 0.7, hz: 0.7, rot: 0, y0: ad.gy, y1: ad.gy + 1.1, walkable: true });
      for (const b of G.bots) if (b.alive && b.phase === 'ground' && Math.random() < 0.4) b.ai.wp = { x: ad.x, z: ad.z };
    }
    ad.mesh.position.y = ad.y;
    ad.mesh.rotation.y += dt * 0.3;
  } else {
    const ch = ad.mesh.userData.chute;
    if (ch.visible) { ch.position.y -= dt * 3; ch.scale.multiplyScalar(1 - dt * 0.8); if (ch.scale.x < 0.2) ch.visible = false; }
    ad.smokeT += dt;
    if (ad.state === 'landed' || ad.smokeT < 12) {
      ad.puff = (ad.puff || 0) - dt;
      if (ad.puff <= 0) { ad.puff = 0.12; FX.smoke(new V3(ad.x, ad.gy + 1.3, ad.z), Math.random() < 0.5 ? 0xff3b30 : 0xe8473c); }
    }
    if (ad.state === 'landed') for (const b of G.bots) if (b.alive && Math.hypot(b.pos.x - ad.x, b.pos.z - ad.z) < 2.6) { openAirdrop(b); break; }
  }
}

function canOpenAirdrop() {
  const ad = G.airdrop, p = G.player;
  return ad.state === 'landed' && p.alive && p.phase === 'ground' && Math.hypot(p.pos.x - ad.x, p.pos.z - ad.z) < 2.8;
}

function openAirdrop(a) {
  const ad = G.airdrop;
  if (ad.state !== 'landed') return;
  ad.state = 'opened'; ad.smokeT = Math.max(ad.smokeT, 6);
  a.armor = 3; a.helmet = 3;
  a.kits = Math.min(5, a.kits + 2); a.gel = Math.min(8, a.gel + 3); a.nades = Math.min(4, a.nades + 2);
  if (a.isPlayer) {
    toast('Colete Nv. 3 e Capacete Nv. 3 Equipados');
    spawnLoot('w:Woodpecker', ad.x + 1.6, ad.z, { mag: 12, reserve: 48 });
    setTimeout(() => toast('+2 Kit  +3 Gel  +2 Granada'), 1400);
    SND.play('pick');
  } else if (!a.slots[0] || !a.slots[1]) giveWeapon(a, 'Woodpecker');
}

// ------------------------------------------------------------------ avião e salto
let planeObj = null;
function buildPlane() {
  const P = [];
  const B = (w, h, d, c, x, y, z, rx, ry, rz) => P.push(U.part(new THREE.BoxGeometry(w, h, d), c, U.mat4(x, y, z, rx, ry, rz), 'radial'));
  const S = (r, c, x, y, z, sx, sy, sz) => P.push(U.part(new THREE.SphereGeometry(r, 14, 10), c, U.mat4(x, y, z, 0, 0, 0, sx, sy, sz), 'radial'));
  const WHITE = 0xf5f5f2, ORANGE = 0xf28a1e, TEAL = 0x2aa7b8;
  S(1, WHITE, 0, 0, 0, 1.6, 1.6, 6.5);              // fuselagem
  S(1, ORANGE, 0, -0.6, 0.2, 1.62, 0.6, 6.4);       // faixa laranja
  S(1, TEAL, 0, -0.1, 4.6, 1.2, 1.0, 1.6);          // cabine
  B(15, 0.25, 2.2, WHITE, 0, 1.2, 0.6);              // asa alta
  B(15.1, 0.27, 0.4, ORANGE, 0, 1.2, 1.55);
  B(5, 0.18, 1.4, WHITE, 0, 0.6, -6.2);              // estabilizador
  B(0.25, 2.6, 1.8, ORANGE, 0, 1.6, -6.1);           // leme
  for (const x of [-3.6, 3.6]) {
    S(1, WHITE, x, 0.7, 1.6, 0.55, 0.55, 1.8);
    B(0.1, 0.1, 0.4, 0x333333, x, 0.7, 3.4);
  }
  for (let i = 0; i < 6; i++) S(0.25, 0x3a6fb5, 1.58, 0.35, 2.8 - i * 1.2, 0.2, 1, 1);
  B(1.0, 0.1, 2.4, 0xbfbfbf, 1.4, -1.6, -2.6, 0.6, 0, 0);  // escada
  B(0.12, 1.4, 0.12, 0x333333, -1.1, -1.4, 1.5); B(0.12, 1.4, 0.12, 0x333333, 1.1, -1.4, 1.5);
  const pair = U.build(P);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(pair.g, U.toon({ vertexColors: true })));
  g.add(new THREE.Mesh(pair.o, U.outlineMat(0.06)));
  g.userData.props = [];
  for (const x of [-3.6, 3.6]) {
    const pr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 0.08), U.toon({ color: 0x2a2a2a }));
    pr.position.set(x, 0.7, 3.6);
    g.add(pr); g.userData.props.push(pr);
  }
  return g;
}

function startDrop() {
  const ang = Math.random() * Math.PI * 2;
  const dir = new V3(Math.cos(ang), 0, Math.sin(ang));
  const side = new V3(-dir.z, 0, dir.x).multiplyScalar((Math.random() - 0.5) * 70);
  G.drop = { dir: dir, start: dir.clone().multiplyScalar(-440).add(side), speed: 42, alt: 245, t: 0, pos: new V3(), state: 'prep', end: 16.5 };
  if (!planeObj) { planeObj = buildPlane(); scene.add(planeObj); }
  planeObj.visible = true;
  planeObj.rotation.y = Math.atan2(dir.x, dir.z);
  for (const b of G.bots) b.ai.jumpAt = 5 + Math.random() * 10.5;
  G.drop.pos.copy(G.drop.start); G.drop.pos.y = G.drop.alt;
}

function jumpOut(a) {
  if (a.phase !== 'plane') return;
  const d = G.drop;
  a.phase = 'fall'; a.board = true; a.hs = 22; a.vdown = 12;
  a.pos.copy(d.pos).add(new V3(0, -3, 0)).addScaledVector(new V3(-d.dir.z, 0, d.dir.x), (Math.random() - 0.5) * 4);
  a.face = Math.atan2(d.dir.x, d.dir.z);
  a.ch.root.visible = true;
  if (a.isPlayer) { G.yaw = a.face + Math.PI; G.pitch = -0.55; H.jumpHint.classList.remove('show'); }
}

function updateDrop(dt) {
  const d = G.drop;
  d.t += dt;
  d.pos.copy(d.start).addScaledVector(d.dir, d.speed * d.t); d.pos.y = d.alt;
  planeObj.position.copy(d.pos);
  for (const p of planeObj.userData.props) p.rotation.z += dt * 40;
  if (d.state === 'prep') {
    const n = Math.ceil(4 - d.t);
    setText(H.prepNum, 'pn', n > 0 ? String(n) : '');
    if (d.t >= 4) {
      d.state = 'go';
      H.prep.classList.add('hidden');
      bigText('VAI!');
      if (G.player.phase === 'plane') H.jumpHint.classList.add('show');
    }
  } else if (d.state === 'go') {
    for (const b of G.bots) if (b.phase === 'plane' && d.t >= b.ai.jumpAt) jumpOut(b);
    if (d.t >= d.end) {
      for (const a of G.actors) if (a.phase === 'plane') jumpOut(a);
      d.state = 'done';
    }
  } else if (d.t > d.end + 20) planeObj.visible = false;
  for (const a of G.actors) if (a.phase === 'plane') a.pos.copy(d.pos);
}

// voo de prancha e de paraquedas. c: {mx, my, open, release}
function updateAir(a, dt, c) {
  if (a.phase === 'fall') {
    a.face -= c.mx * 1.5 * dt;
    let target = c.my > 0.2 ? 32 : c.my < -0.2 ? 6 : 20;
    if (!a.board) target = 14;
    a.hs = U.damp(a.hs, target, 1.8, dt);
    a.vdown = a.board ? 12 : 28;
    if (c.release && a.board) { a.board = false; if (a.isPlayer) toast('Prancha solta'); }
    const alt = a.pos.y - W.groundAt(a.pos.x, a.pos.z, a.pos.y);
    if (c.open || alt < 65) {
      a.phase = 'chute';
      if (a.isPlayer) SND.play('wall', 0.5);
    }
  } else {
    a.face -= c.mx * 1.1 * dt;
    a.hs = U.damp(a.hs, c.my < -0.2 ? 3 : 7, 2, dt);
    a.vdown = U.damp(a.vdown, c.my > 0.2 ? 12 : 6, 3, dt);
  }
  a.pos.x += Math.sin(a.face) * a.hs * dt;
  a.pos.z += Math.cos(a.face) * a.hs * dt;
  a.pos.y -= a.vdown * dt;
  const r = Math.hypot(a.pos.x, a.pos.z);
  if (r > 146) { a.pos.x *= 146 / r; a.pos.z *= 146 / r; }
  const ground = W.groundAt(a.pos.x, a.pos.z, a.pos.y);
  if (a.pos.y - ground < 3) W.collide(a.pos, 0.34, a.pos.y, 1.7);
  if (a.pos.y <= ground) {
    a.pos.y = ground; a.phase = 'ground'; a.vy = 0; a.onGround = true; a.vel.set(0, 0, 0);
    a.landT = G.time;
    if (a.isPlayer) { G.pitch = -0.08; if (!hasGun(a)) toast('Pegue uma arma!'); }
  }
  a.speed = a.hs;
  a.ch.body.rotation.y = a.face;
  a.ch.root.position.copy(a.pos);
  a.ch.board.userData.trail.visible = a.phase === 'fall';
}

// ------------------------------------------------------------------ jogador
const input = { mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, aimToggle: false, jump: false, reload: false, wall: false, heal: false, use: false, nade: false, crouch: false, chute: false, board: false, tapFire: false, slot: -1 };
const keys = {};
const _f = new V3(), _r = new V3(), _o = new V3(), _d = new V3(), _m = new V3(), _nv = new V3();

function camForward(out, yaw, pitch) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

function moveActor(a, wantX, wantZ, maxSpeed, dt, jump) {
  a.vel.x = U.damp(a.vel.x, wantX * maxSpeed, 12, dt);
  a.vel.z = U.damp(a.vel.z, wantZ * maxSpeed, 12, dt);
  a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
  W.collide(a.pos, 0.34, a.pos.y, a.crouch ? 1.1 : 1.7);
  const r = Math.hypot(a.pos.x, a.pos.z);
  if (r > 158) { a.pos.x *= 158 / r; a.pos.z *= 158 / r; }
  const ground = W.groundAt(a.pos.x, a.pos.z, a.pos.y);
  if (jump && a.onGround) { a.vy = 6.4; a.onGround = false; a.crouch = false; }
  a.vy -= 19 * dt;
  a.pos.y += a.vy * dt;
  if (a.pos.y <= ground) { a.pos.y = ground; a.vy = 0; a.onGround = true; }
  else if (a.onGround && a.pos.y - ground < 0.45 && a.vy <= 0) { a.pos.y = ground; a.vy = 0; }
  else a.onGround = false;
  if (a.pos.y < W.SEA_Y - 0.9) { a.pos.y = W.SEA_Y - 0.9; a.vy = 0; a.onGround = true; }
  a.speed = Math.hypot(a.vel.x, a.vel.z);
}

function readMove() {
  let mx = input.mx, my = input.my;
  if (keys.KeyW || keys.ArrowUp) my += 1;
  if (keys.KeyS || keys.ArrowDown) my -= 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  return { mx: mx, my: my };
}

// lê e zera uma ação (botão de toque e/ou tecla)
function consume(name, key) {
  const v = input[name] || (key && keys[key]);
  input[name] = false;
  if (key) keys[key] = false;
  return !!v;
}

function updatePlayer(dt) {
  const p = G.player;
  if (!p.alive) { CH.animate(p.ch, dt, { dead: true }); return; }
  const scoped = isScoped(p);
  const sensK = G.settings.sens * (scoped ? 0.7 / curW(p).scope : p.aim > 0.5 ? 0.6 : 1);
  G.yaw -= input.lookX * sensK; G.pitch -= input.lookY * sensK;
  input.lookX = 0; input.lookY = 0;
  const mv = readMove();

  if (p.phase === 'plane') {
    G.pitch = U.clamp(G.pitch, -1.2, 0.5);
    const want = consume('jump', 'Space') || consume('use', 'KeyE');
    if (want && G.drop.state === 'go') jumpOut(p);
    return;
  }
  if (p.phase === 'fall' || p.phase === 'chute') {
    G.pitch = U.clamp(G.pitch, -1.3, 0.4);
    const open = consume('chute') || (p.phase === 'fall' && consume('jump', 'Space'));
    const rel = consume('board', 'KeyT');
    updateAir(p, dt, { mx: mv.mx, my: mv.my, open: open, release: rel });
    // a câmera acompanha o rumo devagar
    G.yaw = U.dampAngle(G.yaw, p.face + Math.PI, 1.6, dt);
    CH.animate(p.ch, dt, { mode: p.phase, board: p.board });
    return;
  }
  G.pitch = U.clamp(G.pitch, -0.95, 0.8);
  const sy = Math.sin(G.yaw), cy = Math.cos(G.yaw);
  const wx = -sy * mv.my + cy * mv.mx, wz = -cy * mv.my - sy * mv.mx;
  if (consume('crouch', 'KeyC')) p.crouch = !p.crouch;
  let maxS = p.crouch ? 2.6 : 6.2;
  if (p.aimOn) maxS = Math.min(maxS, 3.4);
  if (p.healT > 0) maxS = 2.2;
  moveActor(p, wx, wz, maxS, dt, consume('jump', 'Space'));

  // ações
  p.wallCd -= dt;
  if (consume('wall', 'KeyG')) { if (!deployWall(p, G.yaw) && p.gel <= 0) toast('Sem Gel'); }
  if (consume('heal', 'Digit5')) startHeal(p);
  if (consume('use', 'KeyE') || consume('pick', 'KeyF')) {
    if (canOpenAirdrop()) openAirdrop(p); else playerPickup();
  }
  if (consume('reload', 'KeyR')) startReload(p);
  if (consume('aimToggle')) p.aimOn = !p.aimOn;
  if (consume('nade', 'KeyQ')) {
    if (p.nadeHand) { p.nadeHand = false; refreshGuns(p); }
    else if (p.nades > 0) { p.nadeHand = true; p.aimOn = false; p.reloadT = 0; refreshGuns(p); }
    else toast('Sem granada');
  }
  for (const [k, i] of [['Digit1', 0], ['Digit2', 1], ['Digit3', 2], ['Digit4', 3]]) if (keys[k]) { keys[k] = false; selectSlot(p, i); }
  if (input.slot >= 0) { const i = input.slot; input.slot = -1; selectSlot(p, i === p.cur ? 3 : i); }
  updateHeal(p, dt);
  updateReload(p, dt);

  // tiro / soco / granada
  p.fireCd -= dt;
  const tap = consume('tapFire');
  const firing = input.fire || G.mouseFire || tap;
  const pressed = (firing && !G.prevFire) || tap;
  G.prevFire = input.fire || G.mouseFire;
  if (p.nadeHand) {
    if (pressed && p.fireCd <= 0) throwNade(p, nadeVelocity(G.yaw, G.pitch, _nv));
  } else if (firing && p.fireCd <= 0 && p.reloadT <= 0 && p.healT <= 0) {
    const s = curSlot(p);
    if (!s) punch(p);
    else if (s.mag <= 0) startReload(p);
    else playerShoot(p);
  }
  updateArc(p.nadeHand);
  if (!curSlot(p) || p.nadeHand) p.aimOn = false;
  p.aim = U.damp(p.aim, p.aimOn ? 1 : 0, 12, dt);

  const combat = p.aimOn || G.time - p.lastFire < 0.7 || p.nadeHand;
  let target = p.face;
  if (combat) target = G.yaw + Math.PI;
  else if (p.speed > 0.5) target = Math.atan2(p.vel.x, p.vel.z);
  p.face = U.dampAngle(p.face, target, combat ? 22 : 11, dt);
  p.ch.body.rotation.y = p.face;
  p.ch.root.position.copy(p.pos);
  p.ch.root.visible = !isScoped(p);
  CH.animate(p.ch, dt, { mode: 'ground', speed: p.speed, aim: combat && curSlot(p) ? Math.max(p.aim, 0.85) : p.aim, air: !p.onGround, pitch: combat ? G.pitch : 0, crouch: p.crouch, armed: !!curSlot(p) && !p.nadeHand });

  const area = W.areaAt(p.pos.x, p.pos.z);
  if (area !== G.area) { G.area = area; if (area) areaBanner(area); }
}

function isScoped(p) {
  const w = curW(p);
  return p.phase === 'ground' && p.alive && !p.nadeHand && !!w && w.scope > 0 && p.aim > 0.6;
}

function playerShoot(p) {
  const w = curW(p);
  camForward(_d, G.yaw, G.pitch);
  const scoped = isScoped(p);
  const spread = (scoped ? w.spread * 0.15 : p.aimOn ? w.spread * 0.4 : w.spread) + (p.speed > 1 ? 0.008 : 0) + (p.onGround ? 0 : 0.03) - (p.crouch ? w.spread * 0.3 : 0);
  _o.copy(camera.position);
  const toP = _m.set(p.pos.x, p.pos.y + 1.4, p.pos.z).sub(_o).dot(_d);
  _o.addScaledVector(_d, Math.max(0, toP));
  fireGun(p, _o, _d, Math.max(0.001, spread));
  const kick = w.type === 'shotgun' ? 0.03 : w.type === 'marksman' ? 0.025 : 0.0045;
  G.pitch += kick + Math.random() * 0.003;
  G.yaw += (Math.random() - 0.5) * 0.004;
  G.shake = Math.max(G.shake || 0, 0.05);
  const s = curSlot(p);
  if (s.mag <= 0 && s.reserve > 0) setTimeout(() => startReload(p), 150);
}

function startReload(a) {
  const s = curSlot(a);
  if (!s || a.reloadT > 0 || s.mag >= WEAPONS[s.id].mag || s.reserve <= 0) return;
  a.reloadT = WEAPONS[s.id].type === 'shotgun' ? 2.6 : 1.9;
  if (a.isPlayer) SND.play('reload');
}
function updateReload(a, dt) {
  if (a.reloadT <= 0) return;
  a.reloadT -= dt;
  if (a.reloadT <= 0) {
    const s = curSlot(a);
    a.reloadT = 0;
    if (!s) return;
    const n = Math.min(WEAPONS[s.id].mag - s.mag, s.reserve);
    s.mag += n; s.reserve -= n;
  }
}
function startHeal(a) {
  if (a.healT > 0 || a.kits <= 0 || a.hp >= a.maxHp) { if (a.isPlayer && a.kits <= 0) toast('Sem Kit Médico'); return; }
  a.healT = 2.4;
  if (a.isPlayer) SND.play('heal');
}
function updateHeal(a, dt) {
  if (a.healT <= 0) return;
  a.healT -= dt;
  if (a.healT <= 0) {
    a.healT = 0; a.kits--;
    a.hp = Math.min(a.maxHp, a.hp + 75);
    if (a.isPlayer) { toast('+75 HP'); FX.number(new V3(a.pos.x, a.pos.y + 2, a.pos.z), '+75', '#5dff7a'); }
  }
}

// ------------------------------------------------------------------ bots
function spawnBots() {
  G.bots = [];
  const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, TOTAL - 1);
  for (let i = 0; i < names.length; i++) {
    const b = makeActor(names[i], CH.BOT_PALS[i % CH.BOT_PALS.length], false);
    b.ch.root.visible = false;
    // destino do salto: perto de áreas nomeadas ou em qualquer ponto da ilha
    let tx, tz;
    if (Math.random() < 0.45) {
      const a = W.areaDefs[Math.floor(Math.random() * W.areaDefs.length)];
      const an = Math.random() * 6.28, r = Math.random() * a.r * 0.8;
      tx = a.x + Math.cos(an) * r; tz = a.z + Math.sin(an) * r;
    } else { const an = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 115; tx = Math.cos(an) * r; tz = Math.sin(an) * r; }
    b.ai = { think: Math.random() * 0.3, target: null, react: 0, wp: null, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, stuckT: 0, last: new V3(), burst: 3, pause: 0, skill: 0.75 + Math.random() * 0.5, land: { x: tx, z: tz }, jumpAt: 99, nadeCd: 10 + Math.random() * 20 };
    G.bots.push(b); G.actors.push(b);
  }
}

function visible(from, to) {
  _d.copy(to).sub(from);
  const dist = _d.length();
  _d.divideScalar(dist);
  return !W.raycast(from, _d, dist - 0.3);
}

const _e1 = new V3(), _e2 = new V3();
function botThink(b) {
  const ai = b.ai;
  actorEye(b, _e1);
  let best = null, bd = hasGun(b) ? 60 : 12;
  for (const a of G.actors) {
    if (a === b || !a.alive || a.phase !== 'ground') continue;
    const d = a.pos.distanceTo(b.pos);
    if (d > bd + 15) continue;
    const bias = a === b.lastAttacker && G.time - b.lastHurt < 4 ? 15 : 0;
    if (d - bias < bd && visible(_e1, _e2.set(a.pos.x, a.pos.y + 1.2, a.pos.z))) { best = a; bd = d - bias; }
  }
  if (best !== ai.target) { ai.target = best; ai.react = (0.45 + Math.random() * 0.5) / ai.skill; }
  if (!hasGun(b)) {
    // primeiro, pegar uma arma
    const it = nearestWeaponLoot(b, 70);
    if (it) ai.wp = { x: it.x, z: it.z };
    if (G.time - b.landT > 16) giveWeapon(b, PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)]);
    return;
  }
  const z = G.zone;
  const zr = z.waiting ? z.toR : z.r;
  const zx = z.waiting ? z.toX : z.cx, zz = z.waiting ? z.toZ : z.cz;
  if (!ai.wp || Math.hypot(b.pos.x - ai.wp.x, b.pos.z - ai.wp.z) < 3 || Math.hypot(ai.wp.x - zx, ai.wp.z - zz) > zr) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * zr * 0.8;
    ai.wp = { x: U.clamp(zx + Math.cos(a) * d, -125, 125), z: U.clamp(zz + Math.sin(a) * d, -125, 125) };
  }
  if (!ai.target) for (const it of G.loot) if (!it.isWeapon && Math.hypot(it.x - b.pos.x, it.z - b.pos.z) < 10) { ai.wp = { x: it.x, z: it.z }; break; }
  if (!ai.target && b.hp < 120 && b.kits > 0 && G.time - b.lastHurt > 3) startHeal(b);
  // granada contra alvo a média distância
  if (ai.target && b.nades > 0 && G.time > ai.nadeCd) {
    const d = ai.target.pos.distanceTo(b.pos);
    if (d > 9 && d < 26 && Math.random() < 0.25) {
      ai.nadeCd = G.time + 12 + Math.random() * 15;
      const dx = ai.target.pos.x - b.pos.x, dz = ai.target.pos.z - b.pos.z;
      const v = Math.sqrt(GRAV * d / Math.sin(1.4)) * (0.9 + Math.random() * 0.2);
      throwNade(b, new V3(dx / d * Math.cos(0.7) * v, Math.sin(0.7) * v, dz / d * Math.cos(0.7) * v));
    }
  }
}

function botAirControl(b, dt) {
  const t = b.ai.land;
  const dx = t.x - b.pos.x, dz = t.z - b.pos.z, d = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const turn = U.clamp(U.angDiff(b.face, want) * 2, -1, 1);
  updateAir(b, dt, { mx: -turn, my: d > 60 ? 1 : d < 20 ? -1 : 0, open: d < 35 && b.phase === 'fall', release: false });
}

function updateBot(b, dt) {
  if (b.phase === 'plane') return;
  const near = b.pos.distanceTo(G.player.pos);
  if (!b.alive) { if (near < 120) CH.animate(b.ch, dt, { dead: true }); return; }
  b.ch.root.visible = near < (b.phase === 'ground' ? 130 : 260);
  CH.setOutlinesVisible(b.ch, near < (G.settings.quality === 'baixa' ? 22 : 45));
  CH.setShadow(b.ch, near < 40);
  if (b.phase === 'fall' || b.phase === 'chute') {
    botAirControl(b, dt);
    if (b.ch.root.visible) CH.animate(b.ch, dt, { mode: b.phase, board: b.board });
    return;
  }
  const ai = b.ai;
  ai.think -= dt;
  if (ai.think <= 0) { ai.think = 0.3; botThink(b); }
  if (ai.target && !ai.target.alive) ai.target = null;
  b.wallCd -= dt;
  updateHeal(b, dt);
  updateReload(b, dt);

  let wx = 0, wz = 0, speed = 4.8, faceT = b.face;
  const t = ai.target, armed = hasGun(b);
  if (armed && !curSlot(b)) { b.cur = b.slots[0] ? 0 : b.slots[1] ? 1 : 2; refreshGuns(b); }
  if (t) {
    const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 1;
    const ux = dx / dist, uz = dz / dist;
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.8 + Math.random() * 1.4; ai.strafe = -ai.strafe; }
    const w = curW(b);
    const ideal = !armed ? 1.2 : w && w.type === 'shotgun' ? 8 : w && w.type === 'marksman' ? 35 : 18;
    const fwd = dist > ideal + 8 ? 1 : dist < ideal - 6 ? -0.7 : 0;
    wx = ux * fwd + -uz * ai.strafe * (armed ? 0.8 : 0); wz = uz * fwd + ux * ai.strafe * (armed ? 0.8 : 0);
    speed = armed ? 3.9 : 5.2;
    faceT = Math.atan2(dx, dz);
    if (b.hp < 120 && b.gel > 0 && b.wallCd <= 0 && G.time - b.lastHurt < 0.6 && Math.random() < 0.08) {
      deployWall(b, Math.atan2(-ux, -uz));
      b.wallCd = 7;
    }
    ai.react -= dt;
    b.fireCd -= dt;
    if (ai.pause > 0) ai.pause -= dt;
    else if (ai.react <= 0 && b.fireCd <= 0 && b.reloadT <= 0 && b.healT <= 0) {
      if (!armed) { if (dist < 1.6) punch(b); }
      else if (dist < curW(b).range * 0.7) {
        if (curSlot(b).mag <= 0) startReload(b);
        else botShoot(b, t, dist);
      }
    }
  } else {
    if (b.healT > 0) speed = 2;
    if (ai.wp) {
      const dx = ai.wp.x - b.pos.x, dz = ai.wp.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
      wx = dx / d; wz = dz / d;
      faceT = Math.atan2(wx, wz);
    }
    const s = curSlot(b);
    if (s && s.mag < WEAPONS[s.id].mag * 0.5) startReload(b);
  }
  const zn = G.zone, zd = Math.hypot(b.pos.x - zn.cx, b.pos.z - zn.cz);
  if (zd > zn.r - 4 && zn.r > 3) {
    wx = (zn.cx - b.pos.x) / zd; wz = (zn.cz - b.pos.z) / zd; speed = 5.4;
    if (!t) faceT = Math.atan2(wx, wz);
  }
  ai.stuckT += dt;
  if (ai.stuckT > 2) {
    if (Math.hypot(b.pos.x - ai.last.x, b.pos.z - ai.last.z) < 1.2 && (wx || wz)) { ai.wp = null; ai.strafe = -ai.strafe; ai.jump = true; }
    ai.last.copy(b.pos); ai.stuckT = 0;
  }
  moveActor(b, wx, wz, speed, dt, ai.jump);
  ai.jump = false;
  b.face = U.dampAngle(b.face, faceT, 10, dt);
  b.ch.body.rotation.y = b.face;
  b.ch.root.position.copy(b.pos);
  if (near < 120) CH.animate(b.ch, dt, { mode: 'ground', speed: b.speed, aim: t && armed ? 1 : 0, air: !b.onGround, pitch: 0, armed: !!curSlot(b) });
}

function botShoot(b, t, dist) {
  const ai = b.ai;
  ai.burst--;
  const w = curW(b);
  if (ai.burst <= 0) { ai.burst = w.type === 'shotgun' || w.type === 'marksman' ? 1 : 3 + Math.floor(Math.random() * 5); ai.pause = 0.45 + Math.random() * 0.7; }
  actorEye(b, _o);
  const head = Math.random() < 0.12;
  _m.set(t.pos.x, t.pos.y + (head ? (t.crouch ? 1.15 : 1.62) : (t.crouch ? 0.7 : 1.0)), t.pos.z);
  _d.copy(_m).sub(_o).normalize();
  const tSpeed = t.speed || 0;
  const err = (0.022 + dist * 0.0011 + (tSpeed > 1 ? 0.022 : 0) + (b.speed > 1 ? 0.012 : 0) + (t.crouch ? 0.01 : 0)) / ai.skill;
  fireGun(b, _o, _d, err);
}

// ------------------------------------------------------------------ câmera
let fpGun = null;
function updateCamera(dt) {
  const p = G.player;
  if (!p.alive) {
    G.deathOrbit = (G.deathOrbit || 0) + dt * 0.35;
    const c = p.pos;
    camera.position.set(c.x + Math.sin(G.deathOrbit) * 5, c.y + 3.2, c.z + Math.cos(G.deathOrbit) * 5);
    camera.lookAt(c.x, c.y + 0.6, c.z);
    if (fpGun) fpGun.visible = false;
    updateSpeedLines(dt, false);
    return;
  }
  const portrait = camera.aspect < 1;
  let fov = portrait ? 74 : 62;
  camForward(_f, G.yaw, G.pitch);
  _r.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  const scoped = isScoped(p);
  if (fpGun) fpGun.visible = false;
  if (p.phase === 'plane') {
    // câmera orbitando o avião
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
  } else if (scoped) {
    // luneta: primeira pessoa com a arma na frente (como no vídeo)
    const w = curW(p);
    camera.position.set(p.pos.x, p.pos.y + (p.crouch ? 1.1 : 1.58), p.pos.z).addScaledVector(_f, 0.15);
    camera.rotation.set(G.pitch, G.yaw, 0);
    fov = fov / w.scope;
    if (!fpGun) {
      fpGun = new THREE.Group();
      fpGun.userData.m = new THREE.Mesh(new THREE.BufferGeometry(), U.toon({ vertexColors: true }));
      fpGun.userData.o = new THREE.Mesh(new THREE.BufferGeometry(), U.outlineMat(0.012));
      fpGun.add(fpGun.userData.m); fpGun.add(fpGun.userData.o);
      fpGun.rotation.y = Math.PI;
      camera.add(fpGun);
    }
    const id = curSlot(p).id;
    if (fpGun.userData.id !== id) {
      const pr = CH.gunPair(id);
      fpGun.userData.m.geometry = pr.g; fpGun.userData.o.geometry = pr.o; fpGun.userData.id = id;
    }
    fpGun.position.set(0.03, -0.26, -0.5 + ((G.time - p.lastFire) < 0.08 ? 0.04 : 0));
    fpGun.visible = true;
  } else {
    const k = p.aim;
    const dist = U.lerp(portrait ? 4.3 : 3.25, portrait ? 3.2 : 2.45, k), sh = U.lerp(portrait ? 0.45 : 0.7, portrait ? 0.5 : 0.78, k);
    const pivot = _o.set(p.pos.x, p.pos.y + (p.crouch ? 1.15 : 1.6), p.pos.z).addScaledVector(_r, sh);
    _d.copy(_f).negate();
    const hit = W.raycast(pivot, _d, dist + 0.3, false);
    const dd = hit ? Math.max(0.35, hit.t - 0.3) : dist;
    camera.position.copy(pivot).addScaledVector(_d, dd);
    camera.position.y += 0.18;
    const gy = W.height(camera.position.x, camera.position.z) + 0.35;
    if (camera.position.y < gy) camera.position.y = gy;
    camera.rotation.set(G.pitch, G.yaw, 0);
    fov = U.lerp(fov, portrait ? 62 : 50, k);
  }
  if (G.shake > 0) {
    G.shake -= dt;
    camera.rotation.x += (Math.random() - 0.5) * 0.012; camera.rotation.y += (Math.random() - 0.5) * 0.012;
  }
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = scoped ? fov : U.damp(camera.fov, fov, 14, dt); camera.updateProjectionMatrix(); }
  const high = U.clamp((camera.position.y - 30) / 150, 0, 1);
  scene.fog.near = U.lerp(90, 380, high); scene.fog.far = U.lerp(520, 1400, high);
  const fc = p.phase === 'ground' ? p.pos : camera.position;
  sun.position.copy(fc).addScaledVector(G.sunDir, 70);
  sun.target.position.copy(fc);
  updateSpeedLines(dt, p.phase === 'fall' || p.phase === 'chute');
}

// riscos brancos de velocidade durante a queda (como no vídeo)
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

// ------------------------------------------------------------------ HUD
const H = {};
const GUN_ICON = {
  rifle: 'M2 10h30l3-3h9v3h14v4h-6l-1 3h-6l-1-3h-5l-2 9h-6l2-9H18l-4 5H8l2-5H4l-2-2z',
  smg: 'M6 9h30l3-3h7v3h10v4H45v3h-5l-2 9h-6l2-9H20l-3 5h-6l2-5H7l-1-3z',
  shotgun: 'M2 11h40l2-2h16v4H44l-2 2H22l-4 6h-7l3-6H5l-3-2z',
  marksman: 'M2 11h46v-2h12v4H48l-2 2H24l-3 6h-7l3-6H6l-4-2zM22 5h14v3H22z',
  pistol: 'M14 7h30v6H32l-2 2h-4l-3 10h-8l3-10h-4z',
};
function gunIcon(id) {
  const w = WEAPONS[id];
  return '<svg viewBox="0 0 64 28" aria-hidden="true"><path d="' + GUN_ICON[w.type] + '" fill="' + w.color + '" stroke="#1a1a1a" stroke-width="1.2"/></svg>';
}

function initHUD() {
  ['hud', 'topStatus', 'zoneText', 'announce', 'areaBanner', 'areaName', 'hitmark', 'killfeed', 'toast', 'dirLbl', 'pickHint', 'invLine',
    'hpFill', 'hpText', 'slotVest', 'slotHelm', 'vestLvl', 'helmLvl', 'vignette', 'btnUse', 'fps', 'crosshair', 'minimap', 'hurtArrow', 'scope',
    'diveStats', 'diveHint', 'altMark', 'handHint', 'bigText', 'keysHint', 'kitBadge', 'gelBadge', 'nadeBadge', 'touch', 'healBar',
    'prep', 'prepNum', 'jumpHint'].forEach(id => { H[id] = $(id); });
  H.slots = [0, 1, 2].map(i => $('wslot' + i));
  H.mm = H.minimap.getContext('2d');
  H.cache = {};
  H.keysHint.classList.toggle('hidden', isTouch);
  if (isTouch) H.jumpHint.textContent = 'Toque em SALTAR';
}

function setText(el, key, v) {
  if (H.cache[key] === v) return;
  H.cache[key] = v;
  el.textContent = v;
}
function setHTML(el, key, v) {
  if (H.cache[key] === v) return;
  H.cache[key] = v;
  el.innerHTML = v;
}
function setClass(el, key, cls, on) {
  if (H.cache[key] === on) return;
  H.cache[key] = on;
  el.classList.toggle(cls, on);
}

const DIRS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
function updateHUD(dt) {
  const p = G.player, z = G.zone;
  // linha de status no topo
  let nPlane = 0, nAir = 0;
  for (const a of G.actors) { if (a.phase === 'plane') nPlane++; else if (a.phase === 'fall' || a.phase === 'chute') nAir++; }
  const st = nPlane + nAir > 0
    ? 'no avião ' + nPlane + ' · no ar ' + nAir + ' · saltaram ' + (G.actors.length - nPlane) + '/' + G.actors.length
    : 'vivos ' + aliveCount() + ' · abates ' + p.kills;
  setText(H.topStatus, 'ts', st);
  const zt = z.final ? 'Zona final' : z.waiting ? 'A zona segura irá diminuir em ' + U.fmtTime(z.timer) : 'A zona segura está diminuindo ' + U.fmtTime(z.timer);
  setText(H.zoneText, 'zt', zt);
  const heading = ((-G.yaw * 180 / Math.PI) % 360 + 360) % 360;
  setHTML(H.dirLbl, 'dir', DIRS[Math.round(heading / 45) % 8] + '<small>' + (Math.round(heading) % 360) + '°</small>');

  // slots de arma (1, 2 = principais, 3 = pistola)
  for (let i = 0; i < 3; i++) {
    const s = p.slots[i], el = H.slots[i];
    setHTML(el, 'sl' + i, '<span class="n">' + (i + 1) + '</span>' + (s
      ? '<span class="nm">' + s.id + '</span>' + gunIcon(s.id) + '<span class="am">' + s.mag + '<small> / ' + s.reserve + '</small></span>'
      : '<span class="empty">vazio</span>'));
    setClass(el, 'sla' + i, 'active', p.cur === i && !p.nadeHand);
  }
  setText(H.pickHint, 'ph', p.phase === 'ground' && !hasGun(p) ? 'pegue uma arma' : p.reloadT > 0 ? 'recarregando…' : !curSlot(p) && p.phase === 'ground' ? 'soco (4)' : '');
  setText(H.invLine, 'inv', 'Kit ' + p.kits + '  ·  Gel ' + p.gel + '  ·  Granada ' + p.nades);
  setText(H.kitBadge, 'kb', String(p.kits)); setText(H.gelBadge, 'gb', String(p.gel)); setText(H.nadeBadge, 'nb', String(p.nades));

  // vida: verde → amarelo → laranja, como nos vídeos
  const hp = Math.max(0, Math.ceil(p.hp)), frac = hp / p.maxHp;
  setText(H.hpText, 'hp', hp + ' / ' + p.maxHp);
  H.hpFill.style.width = (frac * 100) + '%';
  const hc = frac > 0.6 ? 'g' : frac > 0.3 ? 'y' : 'o';
  if (H.cache.hc !== hc) { H.cache.hc = hc; H.hpFill.className = 'hp-' + hc; }
  setText(H.vestLvl, 'vl', p.armor ? 'Nv.' + p.armor : 'COLETE');
  setText(H.helmLvl, 'hl', p.helmet ? 'Nv.' + p.helmet : 'CAPACETE');
  setClass(H.slotVest, 'sv', 'on', p.armor > 0);
  setClass(H.slotHelm, 'sh', 'on', p.helmet > 0);
  H.healBar.style.transform = 'scaleX(' + (p.healT > 0 ? 1 - p.healT / 2.4 : 0) + ')';

  // botão de contexto: PEGAR arma / ABRIR suprimento
  let use = '';
  if (p.phase === 'ground' && p.alive) {
    if (canOpenAirdrop()) use = 'ABRIR SUPRIMENTO';
    else { const it = nearestWeaponLoot(p, 2.2); if (it) use = (isTouch ? 'PEGAR ' : '[E] PEGAR ') + lootLabel(it); }
  }
  if (H.cache.use !== use) { H.cache.use = use; H.btnUse.textContent = use; H.btnUse.classList.toggle('hidden', !use); }

  // modo da tela (avião / prancha / paraquedas / chão)
  const mode = p.phase === 'plane' && G.drop.state === 'prep' ? 'prep' : p.phase;
  if (H.cache.mode !== mode) { H.cache.mode = mode; H.touch.dataset.mode = mode; H.hud.dataset.mode = mode; }

  if (mode === 'fall' || mode === 'chute') {
    const alt = Math.max(0, Math.round(p.pos.y - W.groundAt(p.pos.x, p.pos.z, p.pos.y)));
    setText(H.diveStats, 'ds', alt + ' m  ·  desce ' + Math.round(p.vdown || 0) + ' m/s  ·  anda ' + Math.round(p.hs) + ' m/s');
    setText(H.diveHint, 'dh', mode === 'fall'
      ? (isTouch ? 'joystick ↑ acelera · ↓ freia · ←/→ vira · PARAQUEDAS abre' : 'W acelera · S freia · A/D vira · T solta a prancha · ESPAÇO abre o paraquedas')
      : (isTouch ? 'joystick ↑ desce mais rápido · ↓ freia · ←/→ vira' : 'W acelera (desce mais rápido) · S freia · A/D vira'));
    H.altMark.style.bottom = U.clamp(alt / 250 * 100, 0, 100) + '%';
  }
  setText(H.handHint, 'hh', p.nadeHand ? (isTouch ? 'GRANADA NA MÃO  ·  ✹ LANÇA  ·  ● GUARDA' : 'GRANADA NA MÃO  ·  CLIQUE ESQ. LANÇA  ·  [Q] GUARDA') : '');
  setClass(H.handHint, 'hhs', 'show', p.nadeHand);

  const scoped = isScoped(p);
  setClass(H.scope, 'sc', 'show', scoped);
  setClass(H.crosshair, 'ch', 'aiming', p.aim > 0.5 && !scoped);
  setClass(H.crosshair, 'ch2', 'off', mode !== 'ground' || scoped);
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
}

function drawMinimap() {
  const g = H.mm, S = 120, sc = S / 340, p = G.player, z = G.zone;
  const tx = (x) => S / 2 + x * sc, tz = (zz) => S / 2 + zz * sc;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#2f8fd0'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#e6cd8e'; g.beginPath(); g.arc(S / 2, S / 2, 150 * sc, 0, 7); g.fill();
  g.fillStyle = '#5fae3a'; g.beginPath(); g.arc(S / 2, S / 2, 132 * sc, 0, 7); g.fill();
  g.fillStyle = '#d84f2a';
  for (const h of W.houses) g.fillRect(tx(h.x) - 1.5, tz(h.z) - 1.5, 3, 3);
  if (G.drop && G.drop.state !== 'done') {
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(tx(G.drop.start.x), tz(G.drop.start.z)); g.lineTo(tx(G.drop.start.x + G.drop.dir.x * 880), tz(G.drop.start.z + G.drop.dir.z * 880)); g.stroke();
    g.setLineDash([]);
  }
  g.strokeStyle = '#ffc2dc'; g.lineWidth = 1;
  if (!z.final) { g.beginPath(); g.arc(tx(z.toX), tz(z.toZ), z.toR * sc, 0, 7); g.stroke(); }
  g.strokeStyle = '#3aa8ff'; g.lineWidth = 2;
  g.beginPath(); g.arc(tx(z.cx), tz(z.cz), Math.max(1, Math.min(z.r, 200) * sc), 0, 7); g.stroke();
  const ad = G.airdrop;
  if (ad.state !== 'none' && ad.state !== 'opened') { g.fillStyle = '#ff3b30'; g.fillRect(tx(ad.x) - 3, tz(ad.z) - 3, 6, 6); }
  const pp = p.phase === 'plane' ? G.drop.pos : p.pos;
  g.save(); g.translate(tx(pp.x), tz(pp.z)); g.rotate(-G.yaw);
  g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
  g.restore();
}

let toastTimer = 0, annTimer = 0, areaTimer = 0, hitTimer = 0, bigTimer = 0;
function toast(msg) {
  H.toast.textContent = msg; H.toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => H.toast.classList.remove('show'), 2200);
}
function announce(msg) {
  H.announce.textContent = msg; H.announce.classList.add('show');
  clearTimeout(annTimer); annTimer = setTimeout(() => H.announce.classList.remove('show'), 4500);
}
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
  SND.play('hit', 0.6);
}
function killFeed(killer, victim, weapon) {
  const el = document.createElement('div');
  el.className = 'kf';
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  el.innerHTML = victim ? esc(killer) + ' <em>ABATE</em> ' + esc(victim) + ' <span>(' + esc(weapon) + ')</span>'
    : esc(killer) + ' <em>foi eliminado</em> <span>(Zona)</span>';
  H.killfeed.appendChild(el);
  while (H.killfeed.children.length > 3) H.killfeed.firstChild.remove();
  setTimeout(() => el.remove(), 4500);
}

// ------------------------------------------------------------------ controles
function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (e.code === 'Escape' && G.state === 'play') pauseGame();
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

  // botões: o de tiro, arrastado, também gira a câmera
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
  holdBtn($('btnGel'), () => { input.wall = true; });
  holdBtn($('btnNade'), () => { input.nade = true; });
  holdBtn($('btnKit'), () => { input.heal = true; });
  holdBtn($('btnUse'), () => { input.use = true; });
  holdBtn($('btnSaltar'), () => { input.jump = true; });
  holdBtn($('btnChute'), () => { input.chute = true; });
  holdBtn($('btnBoard'), () => { input.board = true; });
  [0, 1, 2].forEach(i => holdBtn($('wslot' + i), () => { input.slot = i; }));
}
function isTouchEvent(e) { return e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents); }

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
  G.actors = []; G.bots = [];
  FX.reset();
  H.killfeed.innerHTML = '';
  if (arcLine) arcLine.visible = false;
}

function startMatch() {
  if (!G.built) {
    W.build(scene, G.settings.quality);
    FX.init(scene);
    G.built = true;
  }
  clearMatch();
  H.cache = {};
  G.botDmgScale = 0.55;
  G.time = 0; G.vignette = 0; G.endT = -1; G.area = null; G.deathOrbit = 0; G.mouseFire = false; G.prevFire = false;
  for (const k in input) if (typeof input[k] === 'boolean') input[k] = false;
  const p = makeActor(G.settings.name || 'Jogador', CH.PLAYER_PAL, true);
  p.ch.root.visible = false;
  G.player = p; G.actors.push(p);
  spawnBots();
  scatterLoot();
  G.airdrop = { state: 'none' };
  initZone();
  startDrop();
  G.yaw = Math.atan2(G.drop.dir.x, G.drop.dir.z) + Math.PI + 1.1; G.pitch = -0.25;
  G.state = 'play';
  H.hud.classList.remove('hidden');
  H.touch.classList.toggle('hidden', !isTouch);
  H.prep.classList.remove('hidden');
  H.jumpHint.classList.remove('show');
  ['menu', 'pauseScr', 'endScr'].forEach(id => $(id).classList.add('hidden'));
  onResize();
}

function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  input.fire = false; G.mouseFire = false;
  if (document.exitPointerLock) document.exitPointerLock();
  $('pauseScr').classList.remove('hidden');
}
function resumeGame() { G.state = 'play'; $('pauseScr').classList.add('hidden'); }

function endMatch() {
  G.state = 'end';
  if (document.exitPointerLock) document.exitPointerLock();
  const p = G.player, win = p.alive;
  $('endTitle').textContent = win ? 'VITÓRIA!' : 'VOCÊ FOI ABATIDO';
  $('endTitle').className = win ? 'win' : 'lose';
  $('endSub').textContent = '#' + G.place + ' de ' + G.actors.length;
  $('endStats').innerHTML = '<div><b>' + p.kills + '</b><span>Abates</span></div><div><b>' + Math.round(p.dmgDealt) + '</b><span>Dano</span></div><div><b>' + U.fmtTime(G.time) + '</b><span>Tempo</span></div>';
  $('endScr').classList.remove('hidden');
}

function toMenu() {
  G.state = 'menu';
  ['pauseScr', 'endScr', 'hud'].forEach(id => $(id).classList.add('hidden'));
  $('touch').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

// ------------------------------------------------------------------ laço principal
function tick(dt) {
  G.time += dt;
  updateDrop(dt);
  updatePlayer(dt);
  for (const b of G.bots) updateBot(b, dt);
  updateWalls(dt);
  updateNades(dt);
  updateLoot(dt);
  updateZone(dt);
  updateAirdrop(dt);
  if (G.endT > 0) { G.endT -= dt; if (G.endT <= 0) endMatch(); }
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === 'play') tick(dt);
  if (G.built && G.player) {
    if (G.state !== 'pause') {
      const fp = G.player.phase === 'ground' ? G.player.pos : camera.position;
      W.update(dt, fp.x, fp.z);
      FX.update(dt, camera, W);
    }
    updateCamera(G.state === 'pause' ? 0 : dt);
    if (G.state === 'play') updateHUD(dt);
  }
  if (G.built) renderer.render(scene, camera);
}

function initMenu() {
  const q = $('qualSel'), s = $('sensRange'), n = $('nameInput'), snd = $('soundChk'), fps = $('fpsChk');
  q.value = G.settings.quality; s.value = G.settings.sens; n.value = G.settings.name; snd.checked = G.settings.sound; fps.checked = G.settings.fps;
  q.addEventListener('change', () => {
    G.settings.quality = q.value; G.saveSettings();
    if (G.built) location.reload();
  });
  s.addEventListener('input', () => { G.settings.sens = +s.value; G.saveSettings(); });
  n.addEventListener('change', () => { G.settings.name = n.value.trim().slice(0, 14) || 'Jogador'; G.saveSettings(); });
  snd.addEventListener('change', () => { G.settings.sound = snd.checked; SND.on = snd.checked; G.saveSettings(); });
  fps.addEventListener('change', () => { G.settings.fps = fps.checked; $('fps').classList.toggle('hidden', !fps.checked); G.saveSettings(); });
  SND.on = G.settings.sound;
  $('fps').classList.toggle('hidden', !G.settings.fps);
  const go = () => {
    SND.init();
    if (isTouch) {
      const el = document.documentElement;
      try {
        const r = el.requestFullscreen ? el.requestFullscreen() : null;
        if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* opcional */ } }).catch(() => {});
      } catch (e) { /* tela cheia é opcional */ }
    }
    $('loading').classList.remove('hidden');
    setTimeout(() => {
      startMatch();
      $('loading').classList.add('hidden');
    }, 30);
  };
  $('playBtn').addEventListener('click', go);
  $('againBtn').addEventListener('click', go);
  $('menuBtn').addEventListener('click', toMenu);
  $('btnPause').addEventListener('click', pauseGame);
  $('btnPause').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('resumeBtn').addEventListener('click', resumeGame);
  $('restartBtn').addEventListener('click', go);
  $('quitBtn').addEventListener('click', toMenu);
  $('helpBtn').addEventListener('click', () => $('helpBox').classList.toggle('hidden'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
}

function boot() {
  initRenderer();
  initHUD();
  initInput();
  initMenu();
  frame();
  window.__game = {
    G: G, W: W, FX: FX, input: input, keys: keys, startMatch: startMatch, deployWall: deployWall, damageActor: damageActor, openAirdrop: openAirdrop,
    tick: tick, giveWeapon: giveWeapon, jumpOut: jumpOut, throwNade: throwNade, camera: function () { return camera; }, renderer: function () { return renderer; },
  };
}

window.addEventListener('error', (e) => {
  const b = $('errorBox');
  if (b) { b.textContent = 'Erro: ' + e.message; b.classList.remove('hidden'); }
});
boot();
