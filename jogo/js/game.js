'use strict';
// Lógica principal: jogador, câmera, tiro, parede de gelo, bots, zona segura, suprimento aéreo, loot e HUD.
const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;

const G = {
  state: 'menu', time: 0, built: false,
  settings: { quality: 'media', sens: 1, name: 'Jogador', sound: true, fps: false },
  actors: [], bots: [], walls: [], loot: [],
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

const BOT_NAMES = ['Coxinha', 'Pastel', 'Quindim', 'Jabuti', 'BotoRosa', 'TatuBola', 'Brigadeiro', 'Capivara', 'Tucano', 'Pamonha', 'Acarajé'];
const WEAPONS = {
  UMP: { dmg: 32, head: 48, cd: 0.1, mag: 30 },
  AK: { dmg: 36, head: 58, cd: 0.13, mag: 30 },
  MP5: { dmg: 24, head: 36, cd: 0.085, mag: 30 },
  SCAR: { dmg: 30, head: 46, cd: 0.12, mag: 30 },
};
const BOT_WEAPONS = ['AK', 'MP5', 'UMP', 'SCAR'];
const VEST_RED = [0, 0.2, 0.3, 0.42];
const ZONE_PHASES = [
  { wait: 40, shrink: 40, r: 100, dps: 2 },
  { wait: 32, shrink: 34, r: 60, dps: 4 },
  { wait: 28, shrink: 28, r: 34, dps: 7 },
  { wait: 22, shrink: 22, r: 16, dps: 11 },
  { wait: 18, shrink: 20, r: 0, dps: 16 },
];

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
  scene.fog = new THREE.Fog(0xcfe9fb, 70, 330);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1300);
  camera.rotation.order = 'YXZ';

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
function makeActor(name, pal, isPlayer, weapon) {
  const ch = CH.make(pal, isPlayer);
  scene.add(ch.root);
  const w = WEAPONS[weapon];
  return {
    name: name, ch: ch, isPlayer: isPlayer, weapon: weapon, w: w,
    pos: new V3(), vel: new V3(), vy: 0, onGround: true, face: 0,
    hp: 200, maxHp: 200, armor: 0, alive: true,
    mag: w.mag, reserve: isPlayer ? 90 : 150, reloadT: 0, fireCd: 0, lastFire: -9,
    walls: isPlayer ? 4 : 2, wallCd: 0, kits: isPlayer ? 2 : 1, healT: 0,
    kills: 0, dmgDealt: 0, aim: 0, pitch: 0, speed: 0, lastHurt: -9, lastAttacker: null,
  };
}

function actorEye(a, out) { return out.set(a.pos.x, a.pos.y + 1.5, a.pos.z); }

const _tmpC = { type: 'c', x: 0, z: 0, r: 0.34, y0: 0, y1: 0 };
// disparo instantâneo: cenário, paredes de gelo e personagens
function traceShot(o, d, maxT, shooter) {
  const env = W.raycast(o, d, maxT);
  let best = env ? env.t : maxT, res = { t: best, env: env, actor: null, head: false };
  for (const a of G.actors) {
    if (!a.alive || a === shooter) continue;
    _tmpC.x = a.pos.x; _tmpC.z = a.pos.z; _tmpC.y0 = a.pos.y + 0.05; _tmpC.y1 = a.pos.y + 1.42;
    let t = W.rayCollider(o, d, _tmpC, best);
    let head = false;
    // cabeça (esfera)
    const hx = o.x - a.pos.x, hy = o.y - (a.pos.y + 1.62), hz = o.z - a.pos.z;
    const b = hx * d.x + hy * d.y + hz * d.z, c = hx * hx + hy * hy + hz * hz - 0.04;
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

function applyShot(shooter, res, d) {
  const w = shooter.w;
  if (res.actor) {
    const dmg = res.head ? w.head : w.dmg;
    damageActor(res.actor, shooter.isPlayer ? dmg : dmg * G.botDmgScale, shooter, res.head);
    if (shooter.isPlayer) {
      FX.number(res.point, Math.round(dmg * (1 - VEST_RED[res.actor.armor])), res.head ? '#ff9a2e' : null);
      hitMarker(res.head);
    }
    FX.sprite(res.point, 0xff4040, 0.25, 0.15, null, 1, 0.8);
  } else if (res.env) {
    if (res.env.kind === 'wall') {
      damageWall(res.env.col.wall, w.dmg, res.point, d);
      if (shooter.isPlayer) { FX.number(res.point, w.dmg); hitMarker(false); }
    } else {
      FX.dust(res.point, res.env.kind === 'terrain' ? (W.sand(res.point.x, res.point.z) > 0.5 ? 0xe2cb95 : 0x8fbf5a) : 0xe8dcc0);
    }
  }
}

function damageActor(a, dmg, attacker, head) {
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
  if (a.hp <= 0) killActor(a, attacker, attacker ? attacker.weapon : 'Zona');
}

function killActor(a, killer, weapon) {
  a.hp = 0; a.alive = false;
  a.vel.set(0, 0, 0);
  if (killer && killer !== a) killer.kills++;
  const kname = killer && killer !== a ? killer.name : null;
  if (kname) killFeed(kname, a.name, weapon);
  else killFeed(a.name, null, 'Zona');
  // caixa de loot simples onde caiu
  if (!a.isPlayer) {
    spawnLoot('ammo', a.pos.x + 0.6, a.pos.z);
    if (Math.random() < 0.6) spawnLoot('kit', a.pos.x - 0.6, a.pos.z + 0.3);
    if (a.walls > 0) spawnLoot('gelo', a.pos.x, a.pos.z - 0.7);
  }
  if (a.isPlayer) {
    G.endT = 2.5;
    G.place = aliveCount() + 1;
  } else if (G.player.alive && aliveCount() === 1) {
    G.endT = 2.0; G.place = 1;
  }
}

function aliveCount() { let n = 0; for (const a of G.actors) if (a.alive) n++; return n; }

// ------------------------------------------------------------------ parede de gelo
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
  // UV: u ao longo do arco, v pela altura (para desenhar as rachaduras no ponto do tiro)
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
  // bordas levemente azuladas
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
  if (owner.walls <= 0 || owner.wallCd > 0 || !owner.alive) return false;
  owner.walls--; owner.wallCd = 0.8;
  if (!wallGeo) buildWallGeo();
  const fx = -Math.sin(towardYaw), fz = -Math.cos(towardYaw); // direção para frente
  const px = owner.pos.x + fx * 2.4, pz = owner.pos.z + fz * 2.4;
  const cx = px - fx * WALL_R, cz = pz - fz * WALL_R;
  const base = Math.min(W.height(px, pz), W.height(px + fz * 1.5, pz - fx * 1.5), W.height(px - fz * 1.5, pz + fx * 1.5));
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

  const wall = { owner: owner, grp: grp, mat: mat, tex: tex, ctx: g, cx: cx, cz: cz, base: base, phi0: phi0, hp: WALL_HP, life: WALL_LIFE, grow: 0, cols: [], dead: false, hits: 0 };
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
  // partículas de gelo subindo
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
  wall.hits++;
  // rachadura a partir do ponto do impacto
  const lx = point.x - wall.cx, lz = point.z - wall.cz;
  const phi = Math.atan2(lx, lz);
  const u = U.clamp((U.angDiff(wall.phi0 - WALL_ARC / 2, phi)) / WALL_ARC, 0, 1);
  const v = U.clamp((point.y - wall.base) / WALL_H, 0, 1);
  const g = wall.ctx, sev = 1 - wall.hp / WALL_HP;
  g.strokeStyle = 'rgba(28,36,60,0.85)';
  g.lineCap = 'round';
  const n = 2 + Math.floor(sev * 4);
  for (let i = 0; i < n; i++) drawCrack(g, u * 512, (1 - v) * 256, Math.random() * Math.PI * 2, 30 + sev * 90 + Math.random() * 30, 1.6 + sev, 2);
  // com o dano acumulado surgem rachaduras por toda a parede
  if (sev > 0.3) for (let i = 0; i < 2; i++) drawCrack(g, Math.random() * 512, Math.random() * 256, Math.random() * Math.PI * 2, 40 + sev * 70, 1.2 + sev * 0.8, 2);
  wall.tex.needsUpdate = true;
  // lascas de gelo saltando do impacto (como no vídeo)
  for (let i = 0; i < 3; i++) {
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
  if (wall.cx !== undefined && Math.hypot(wall.cx - G.player.pos.x, wall.cz - G.player.pos.z) < 45) SND.play('break', 0.8);
}

function updateWalls(dt) {
  for (let i = G.walls.length - 1; i >= 0; i--) {
    const w = G.walls[i];
    if (w.grow < 1) { w.grow = Math.min(1, w.grow + dt / 0.22); w.grp.scale.y = 0.05 + 0.95 * U.smooth(0, 1, w.grow); }
    w.life -= dt;
    if (w.life <= 0) shatterWall(w, null);
  }
}

// ------------------------------------------------------------------ loot
const LOOT = {
  colete1: { label: 'Colete Nv. 1', ring: 0x9aa7b5 },
  colete2: { label: 'Colete Nv. 2', ring: 0x3aa0ff },
  colete3: { label: 'Colete Nv. 3', ring: 0xb05cff },
  kit: { label: 'Kit Médico', ring: 0x4cd964 },
  ammo: { label: 'Munição', ring: 0xffcc33 },
  gelo: { label: 'Parede de Gelo', ring: 0x7fd6ff },
};
const lootGeos = {};
function lootMesh(type) {
  if (!lootGeos[type]) {
    const parts = [];
    if (type.indexOf('colete') === 0) {
      const col = { colete1: 0x8b9aa8, colete2: 0x2f6fb5, colete3: 0x6b3fa8 }[type];
      parts.push(U.part(new THREE.BoxGeometry(0.5, 0.6, 0.22), col, U.mat4(0, 0.3, 0), 'radial'));
      parts.push(U.part(new THREE.BoxGeometry(0.52, 0.08, 0.24), 0x222222, U.mat4(0, 0.38, 0), 'radial'));
    } else if (type === 'kit') {
      parts.push(U.part(new THREE.BoxGeometry(0.45, 0.32, 0.3), 0xf6f6f6, U.mat4(0, 0.16, 0), 'radial'));
      parts.push(U.part(new THREE.BoxGeometry(0.26, 0.08, 0.31), 0xe23b3b, U.mat4(0, 0.18, 0), 'radial'));
      parts.push(U.part(new THREE.BoxGeometry(0.08, 0.26, 0.31), 0xe23b3b, U.mat4(0, 0.18, 0), 'radial'));
    } else if (type === 'ammo') {
      parts.push(U.part(new THREE.BoxGeometry(0.42, 0.26, 0.28), 0x5d7a2e, U.mat4(0, 0.13, 0), 'radial'));
      parts.push(U.part(new THREE.BoxGeometry(0.3, 0.06, 0.29), 0xf2c94c, U.mat4(0, 0.2, 0), 'radial'));
    } else {
      parts.push(U.part(new THREE.OctahedronGeometry(0.28, 0), 0xdff4ff, U.mat4(0, 0.35, 0, 0, 0, 0, 0.8, 1.3, 0.8), 'radial'));
    }
    lootGeos[type] = U.build(parts);
  }
  const pair = lootGeos[type];
  const grp = new THREE.Group();
  const m = new THREE.Mesh(pair.g, U.toon({ vertexColors: true, emissive: 0x222222 }));
  grp.add(m);
  grp.add(new THREE.Mesh(pair.o, U.outlineMat(0.025)));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: LOOT[type].ring, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
  grp.add(ring);
  grp.userData.spin = m;
  return grp;
}

function spawnLoot(type, x, z) {
  const grp = lootMesh(type);
  const y = W.groundAt(x, z, 50);
  grp.position.set(x, y, z);
  scene.add(grp);
  G.loot.push({ type: type, grp: grp, x: x, z: z, y: y, t: Math.random() * 6 });
}

function scatterLoot() {
  const rnd = U.rng(Math.floor(Math.random() * 1e9));
  const table = ['colete1', 'colete1', 'colete2', 'kit', 'kit', 'ammo', 'ammo', 'ammo', 'gelo', 'gelo'];
  for (const a of W.areaDefs) {
    for (let i = 0; i < 7; i++) {
      const an = rnd() * 6.28, r = rnd() * a.r * 0.8;
      spawnLoot(table[Math.floor(rnd() * table.length)], a.x + Math.cos(an) * r, a.z + Math.sin(an) * r);
    }
  }
  for (let i = 0; i < 24; i++) {
    const an = rnd() * 6.28, r = Math.sqrt(rnd()) * 120;
    spawnLoot(table[Math.floor(rnd() * table.length)], Math.cos(an) * r, Math.sin(an) * r);
  }
  // perto do início, para o jogador achar logo um colete Nv. 2 (como aparece no vídeo)
  spawnLoot('colete2', G.player.pos.x + 5, G.player.pos.z - 2);
  spawnLoot('ammo', G.player.pos.x + 3, G.player.pos.z + 3);
}

function takeLoot(a, it) {
  const t = it.type;
  if (t.indexOf('colete') === 0) {
    const lvl = +t.slice(-1);
    if (lvl <= a.armor) return false;
    a.armor = lvl;
    if (a.isPlayer) toast('Colete Nv. ' + lvl + ' Equipado');
  } else if (t === 'kit') {
    if (a.kits >= 5) return false;
    a.kits++; if (a.isPlayer) toast('+1 Kit Médico');
  } else if (t === 'ammo') {
    a.reserve += 60; if (a.isPlayer) toast('+60 Munição');
  } else if (t === 'gelo') {
    if (a.walls >= 8) return false;
    a.walls++; if (a.isPlayer) toast('+1 Parede de Gelo');
  }
  if (a.isPlayer) SND.play('pick');
  return true;
}

function updateLoot(dt) {
  for (let i = G.loot.length - 1; i >= 0; i--) {
    const it = G.loot[i];
    it.t += dt;
    it.grp.userData.spin.rotation.y = it.t * 1.6;
    it.grp.userData.spin.position.y = 0.12 + Math.sin(it.t * 2.5) * 0.06;
    for (const a of G.actors) {
      if (!a.alive) continue;
      const dx = a.pos.x - it.x, dz = a.pos.z - it.z;
      if (dx * dx + dz * dz < 1.6 * 1.6 && Math.abs(a.pos.y - it.y) < 1.5 && takeLoot(a, it)) {
        scene.remove(it.grp);
        G.loot.splice(i, 1);
        break;
      }
    }
  }
}

// ------------------------------------------------------------------ zona segura
function initZone() {
  G.zone = { phase: 0, cx: 0, cz: 0, r: 175, fromX: 0, fromZ: 0, fromR: 175, toX: 0, toZ: 0, toR: 175, waiting: true, timer: 0, dps: 1 };
  nextZonePhase();
  if (!G.zoneMesh) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ float s = 0.5 + 0.5*sin(vUv.x*900.0 + uTime*2.0); float a = mix(0.42, 0.12, vUv.y) * (0.75 + 0.25*s); gl_FragColor = vec4(0.32,0.66,1.0,a); }',
    });
    G.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 90, 96, 1, true), mat);
    G.zoneMesh.position.y = 30;
    G.zoneMesh.renderOrder = 5;
    scene.add(G.zoneMesh);
  }
}

function nextZonePhase() {
  const z = G.zone, ph = ZONE_PHASES[z.phase];
  if (!ph) { z.waiting = true; z.timer = 9999; z.final = true; return; }
  z.fromX = z.cx; z.fromZ = z.cz; z.fromR = z.r;
  const maxOff = Math.max(0, z.r - ph.r) * 0.6;
  const a = Math.random() * 6.28, d = Math.random() * maxOff;
  z.toX = U.clamp(z.cx + Math.cos(a) * d, -100, 100);
  z.toZ = U.clamp(z.cz + Math.sin(a) * d, -100, 100);
  z.toR = ph.r;
  z.waiting = true; z.timer = ph.wait; z.dps = ph.dps;
}

function updateZone(dt) {
  const z = G.zone;
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
  // dano fora da zona
  for (const a of G.actors) {
    if (!a.alive) continue;
    if (Math.hypot(a.pos.x - z.cx, a.pos.z - z.cz) > z.r) {
      a.zoneAcc = (a.zoneAcc || 0) + dt;
      if (a.zoneAcc >= 1) {
        a.zoneAcc = 0;
        const dmg = z.dps;
        a.hp -= dmg; a.lastHurt = G.time;
        if (a.isPlayer) { G.vignette = Math.min(1, G.vignette + 0.25); FX.number(new V3(a.pos.x, a.pos.y + 2, a.pos.z), dmg, '#7fc4ff'); }
        if (a.hp <= 0) killActor(a, null, 'Zona');
      }
    } else a.zoneAcc = 0;
  }
}

// ------------------------------------------------------------------ suprimento aéreo
function buildAirdropMesh() {
  const grp = new THREE.Group();
  const parts = [];
  parts.push(U.part(new THREE.BoxGeometry(1.4, 1.1, 1.4), 0x3e5f8a, U.mat4(0, 0.55, 0), 'radial'));
  parts.push(U.part(new THREE.BoxGeometry(1.44, 0.18, 1.44), 0xf2a81d, U.mat4(0, 0.85, 0), 'radial'));
  parts.push(U.part(new THREE.BoxGeometry(1.44, 0.18, 1.44), 0xf2a81d, U.mat4(0, 0.25, 0), 'radial'));
  parts.push(U.part(new THREE.BoxGeometry(0.2, 1.12, 1.45), 0x2b3f5c, U.mat4(0, 0.55, 0), 'radial'));
  const pair = U.build(parts);
  const crate = new THREE.Mesh(pair.g, U.toon({ vertexColors: true }));
  crate.castShadow = true;
  grp.add(crate); grp.add(new THREE.Mesh(pair.o, U.outlineMat(0.035)));
  // paraquedas listrado
  const chute = new THREE.Group();
  const cg = new THREE.SphereGeometry(3.2, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.4);
  const cols = new Float32Array(cg.attributes.position.count * 3);
  for (let i = 0; i < cg.attributes.position.count; i++) {
    const a = Math.atan2(cg.attributes.position.getX(i), cg.attributes.position.getZ(i));
    const red = Math.floor((a + Math.PI) / (Math.PI * 2) * 8) % 2 === 0;
    cols[i * 3] = red ? 0.9 : 1; cols[i * 3 + 1] = red ? 0.2 : 1; cols[i * 3 + 2] = red ? 0.2 : 1;
  }
  cg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const canopy = new THREE.Mesh(cg, U.toon({ vertexColors: true, side: THREE.DoubleSide }));
  canopy.position.y = 4.2;
  chute.add(canopy);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x333333 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const lg = new THREE.BufferGeometry().setFromPoints([new V3(0, 1.1, 0), new V3(Math.cos(a) * 2.4, 6.2, Math.sin(a) * 2.4)]);
    chute.add(new THREE.Line(lg, lineMat));
  }
  grp.add(chute);
  grp.userData.chute = chute;
  return grp;
}

function updateAirdrop(dt) {
  const ad = G.airdrop;
  if (ad.state === 'none') {
    if (G.time > 52) {
      const z = G.zone;
      const a = Math.random() * 6.28, d = Math.random() * Math.min(z.toR, 60) * 0.6;
      let x = z.toX + Math.cos(a) * d, zz = z.toZ + Math.sin(a) * d;
      ad.x = x; ad.z = zz; ad.gy = W.groundAt(x, zz, 50); ad.y = ad.gy + 75;
      ad.mesh = buildAirdropMesh();
      ad.mesh.position.set(x, ad.y, zz);
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
      // bots próximos se interessam
      for (const b of G.bots) if (b.alive && Math.random() < 0.45) b.ai.wp = { x: ad.x, z: ad.z };
    }
    ad.mesh.position.y = ad.y;
    ad.mesh.rotation.y += dt * 0.3;
    ad.mesh.userData.chute.rotation.z = Math.sin(G.time * 1.3) * 0.06;
  } else if (ad.state === 'landed' || ad.state === 'opened') {
    const ch = ad.mesh.userData.chute;
    if (ch.visible) { ch.position.y -= dt * 3; ch.scale.multiplyScalar(1 - dt * 0.8); if (ch.scale.x < 0.2) ch.visible = false; }
    ad.smokeT += dt;
    if (ad.state === 'landed' || ad.smokeT < 12) {
      ad.puff = (ad.puff || 0) - dt;
      if (ad.puff <= 0) { ad.puff = 0.12; FX.smoke(new V3(ad.x, ad.gy + 1.3, ad.z), Math.random() < 0.5 ? 0xff3b30 : 0xe8473c); }
    }
    if (ad.state === 'landed') {
      for (const b of G.bots) if (b.alive && Math.hypot(b.pos.x - ad.x, b.pos.z - ad.z) < 2.6) { openAirdrop(b); break; }
    }
  }
}

function canOpenAirdrop() {
  const ad = G.airdrop, p = G.player;
  return ad.state === 'landed' && p.alive && Math.hypot(p.pos.x - ad.x, p.pos.z - ad.z) < 2.8;
}

function openAirdrop(a) {
  const ad = G.airdrop;
  if (ad.state !== 'landed') return;
  ad.state = 'opened'; ad.smokeT = Math.max(ad.smokeT, 6);
  a.armor = Math.max(a.armor, 3);
  a.kits = Math.min(5, a.kits + 2);
  a.walls = Math.min(8, a.walls + 3);
  a.reserve += 90;
  if (a.isPlayer) {
    toast('Colete Nv. 3 Equipado');
    setTimeout(() => toast('+2 Kit Médico  +3 Parede de Gelo  +90 Munição'), 1300);
    SND.play('pick');
  }
}

// ------------------------------------------------------------------ jogador
const input = { mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, aimToggle: false, jump: false, reload: false, wall: false, heal: false, use: false };
const keys = {};
const _f = new V3(), _r = new V3(), _o = new V3(), _d = new V3(), _m = new V3();

function camForward(out, yaw, pitch) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

function moveActor(a, wantX, wantZ, maxSpeed, dt, jump) {
  // aceleração suave
  a.vel.x = U.damp(a.vel.x, wantX * maxSpeed, 12, dt);
  a.vel.z = U.damp(a.vel.z, wantZ * maxSpeed, 12, dt);
  a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
  W.collide(a.pos, 0.34, a.pos.y, 1.7);
  const r = Math.hypot(a.pos.x, a.pos.z);
  if (r > 158) { a.pos.x *= 158 / r; a.pos.z *= 158 / r; }
  const ground = W.groundAt(a.pos.x, a.pos.z, a.pos.y);
  if (jump && a.onGround) { a.vy = 6.4; a.onGround = false; }
  a.vy -= 19 * dt;
  a.pos.y += a.vy * dt;
  if (a.pos.y <= ground) { a.pos.y = ground; a.vy = 0; a.onGround = true; }
  else if (a.onGround && a.pos.y - ground < 0.45 && a.vy <= 0) { a.pos.y = ground; a.vy = 0; }
  else a.onGround = false;
  // água rasa: não afunda abaixo do nível
  if (a.pos.y < W.SEA_Y - 0.9) { a.pos.y = W.SEA_Y - 0.9; a.vy = 0; a.onGround = true; }
  a.speed = Math.hypot(a.vel.x, a.vel.z);
}

function updatePlayer(dt) {
  const p = G.player;
  if (!p.alive) { CH.animate(p.ch, dt, { dead: true }); return; }
  const sensK = G.settings.sens * (p.aim > 0.5 ? 0.6 : 1);
  G.yaw -= input.lookX * sensK; G.pitch -= input.lookY * sensK;
  input.lookX = 0; input.lookY = 0;
  G.pitch = U.clamp(G.pitch, -0.95, 0.8);

  // movimento (teclado + joystick)
  let mx = input.mx, my = input.my;
  if (keys.KeyW || keys.ArrowUp) my += 1;
  if (keys.KeyS || keys.ArrowDown) my -= 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const sy = Math.sin(G.yaw), cy = Math.cos(G.yaw);
  const wx = -sy * my + cy * mx, wz = -cy * my - sy * mx;
  let maxS = 6.2;
  if (p.aimOn) maxS = 3.4;
  if (p.healT > 0) maxS = 2.2;
  const wantJump = input.jump || keys.Space;
  input.jump = false;
  moveActor(p, wx, wz, maxS, dt, wantJump);

  // ações
  p.wallCd -= dt;
  if (input.wall || keys.KeyQ) { input.wall = false; keys.KeyQ = false; if (!deployWall(p, G.yaw) && p.walls <= 0) toast('Sem Parede de Gelo'); }
  if (input.heal || keys.KeyH) { input.heal = false; keys.KeyH = false; startHeal(p); }
  if (input.use || keys.KeyE) { input.use = false; keys.KeyE = false; if (canOpenAirdrop()) openAirdrop(p); }
  if (input.reload || keys.KeyR) { input.reload = false; keys.KeyR = false; startReload(p); }
  if (input.aimToggle) { input.aimToggle = false; p.aimOn = !p.aimOn; }
  updateHeal(p, dt);
  updateReload(p, dt);

  // tiro
  p.fireCd -= dt;
  const firing = input.fire || G.mouseFire;
  if (firing && p.fireCd <= 0 && p.reloadT <= 0 && p.healT <= 0) {
    if (p.mag <= 0) startReload(p);
    else playerShoot(p);
  }
  p.aim = U.damp(p.aim, p.aimOn ? 1 : 0, 12, dt);

  // orientação do corpo
  const combat = p.aimOn || G.time - p.lastFire < 0.7;
  let target = p.face;
  if (combat) target = G.yaw + Math.PI;
  else if (p.speed > 0.5) target = Math.atan2(p.vel.x, p.vel.z);
  p.face = U.dampAngle(p.face, target, combat ? 22 : 11, dt);
  p.ch.body.rotation.y = p.face;
  p.ch.root.position.copy(p.pos);
  CH.animate(p.ch, dt, { speed: p.speed, aim: combat ? Math.max(p.aim, 0.85) : p.aim, air: !p.onGround, pitch: combat ? G.pitch : 0 });

  // área atual
  const area = W.areaAt(p.pos.x, p.pos.z);
  if (area !== G.area) { G.area = area; if (area) areaBanner(area); }
}

function playerShoot(p) {
  p.fireCd = p.w.cd; p.mag--; p.lastFire = G.time;
  camForward(_d, G.yaw, G.pitch);
  const spread = (p.aimOn ? 0.004 : 0.014) + (p.speed > 1 ? 0.01 : 0) + (p.onGround ? 0 : 0.03);
  _d.x += (Math.random() - 0.5) * spread * 2; _d.y += (Math.random() - 0.5) * spread * 2; _d.z += (Math.random() - 0.5) * spread * 2;
  _d.normalize();
  // começa o raio na altura do jogador para não acertar o que está atrás dele
  _o.copy(camera.position);
  const toP = _m.copy(p.pos).add(new V3(0, 1.4, 0)).sub(_o).dot(_d);
  _o.addScaledVector(_d, Math.max(0, toP));
  const res = traceShot(_o, _d, 160, p);
  p.ch.muzzle.getWorldPosition(_m);
  FX.tracer(_m, res.point);
  FX.flash(_m);
  applyShot(p, res, _d);
  // recuo
  G.pitch += 0.0045 + Math.random() * 0.003;
  G.yaw += (Math.random() - 0.5) * 0.004;
  G.shake = 0.05;
  SND.play('shot');
  if (p.mag <= 0 && p.reserve > 0) setTimeout(() => startReload(p), 150);
}

function startReload(a) {
  if (a.reloadT > 0 || a.mag >= a.w.mag || a.reserve <= 0) return;
  a.reloadT = 1.9;
  if (a.isPlayer) SND.play('reload');
}
function updateReload(a, dt) {
  if (a.reloadT <= 0) return;
  a.reloadT -= dt;
  if (a.reloadT <= 0) {
    const n = Math.min(a.w.mag - a.mag, a.reserve);
    a.mag += n; a.reserve -= n; a.reloadT = 0;
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
  const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < names.length; i++) {
    const b = makeActor(names[i], CH.BOT_PALS[i % CH.BOT_PALS.length], false, BOT_WEAPONS[i % BOT_WEAPONS.length]);
    let x, z, t = 0;
    do {
      const a = Math.random() * 6.28, r = 20 + Math.sqrt(Math.random()) * 100;
      x = Math.cos(a) * r; z = Math.sin(a) * r; t++;
    } while (t < 60 && (Math.hypot(x - G.player.pos.x, z - G.player.pos.z) < 55 || !W.isFree(x, z, 1.2, W.occupied)));
    b.pos.set(x, W.groundAt(x, z, 50), z);
    b.face = Math.random() * 6.28;
    b.armor = Math.random() < 0.5 ? 1 : 0;
    b.ai = { think: Math.random() * 0.3, target: null, react: 0, wp: null, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, stuckT: 0, last: new V3(x, 0, z), burst: 3, pause: 0, skill: 0.75 + Math.random() * 0.5 };
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
  let best = null, bd = 60;
  for (const a of G.actors) {
    if (a === b || !a.alive) continue;
    const d = a.pos.distanceTo(b.pos);
    // preferem quem atirou nelas
    const bias = a === b.lastAttacker && G.time - b.lastHurt < 4 ? 15 : 0;
    if (d - bias < bd && visible(_e1, _e2.set(a.pos.x, a.pos.y + 1.2, a.pos.z))) { best = a; bd = d - bias; }
  }
  if (best !== ai.target) { ai.target = best; ai.react = (0.45 + Math.random() * 0.5) / ai.skill; }
  // waypoint
  const z = G.zone;
  const zr = z.waiting ? z.toR : z.r;
  const zx = z.waiting ? z.toX : z.cx, zz = z.waiting ? z.toZ : z.cz;
  if (!ai.wp || Math.hypot(b.pos.x - ai.wp.x, b.pos.z - ai.wp.z) < 3 || Math.hypot(ai.wp.x - zx, ai.wp.z - zz) > zr) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * zr * 0.8;
    ai.wp = { x: U.clamp(zx + Math.cos(a) * d, -125, 125), z: U.clamp(zz + Math.sin(a) * d, -125, 125) };
  }
  // loot próximo
  if (!ai.target) for (const it of G.loot) if (Math.hypot(it.x - b.pos.x, it.z - b.pos.z) < 10) { ai.wp = { x: it.x, z: it.z }; break; }
  // cura quando seguro
  if (!ai.target && b.hp < 120 && b.kits > 0 && G.time - b.lastHurt > 3) startHeal(b);
}

function updateBot(b, dt) {
  if (!b.alive) { CH.animate(b.ch, dt, { dead: true }); return; }
  const ai = b.ai;
  ai.think -= dt;
  if (ai.think <= 0) { ai.think = 0.3; botThink(b); }
  if (ai.target && !ai.target.alive) ai.target = null;
  b.wallCd -= dt;
  updateHeal(b, dt);
  updateReload(b, dt);

  let wx = 0, wz = 0, speed = 4.8, faceT = b.face;
  const t = ai.target;
  if (t) {
    const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 1;
    const ux = dx / dist, uz = dz / dist;
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.8 + Math.random() * 1.4; ai.strafe = -ai.strafe; }
    const fwd = dist > 26 ? 1 : dist < 9 ? -0.7 : 0;
    wx = ux * fwd + -uz * ai.strafe * 0.8; wz = uz * fwd + ux * ai.strafe * 0.8;
    speed = 3.9;
    faceT = Math.atan2(dx, dz);
    // parede de gelo defensiva
    if (b.hp < 120 && b.walls > 0 && b.wallCd <= 0 && G.time - b.lastHurt < 0.6 && Math.random() < 0.08) {
      deployWall(b, Math.atan2(-ux, -uz));
      b.wallCd = 7;
    }
    // tiro em rajadas
    ai.react -= dt;
    b.fireCd -= dt;
    if (ai.pause > 0) ai.pause -= dt;
    else if (ai.react <= 0 && b.fireCd <= 0 && b.reloadT <= 0 && b.healT <= 0 && dist < 65) {
      if (b.mag <= 0) startReload(b);
      else botShoot(b, t, dist);
    }
  } else {
    if (b.healT > 0) speed = 2;
    if (ai.wp) {
      const dx = ai.wp.x - b.pos.x, dz = ai.wp.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
      wx = dx / d; wz = dz / d;
      faceT = Math.atan2(wx, wz);
    }
    if (b.mag < b.w.mag * 0.5) startReload(b);
  }
  // fora (ou na borda) da zona: corre para dentro mesmo em combate
  const zn = G.zone, zd = Math.hypot(b.pos.x - zn.cx, b.pos.z - zn.cz);
  if (zd > zn.r - 4 && zn.r > 3) {
    wx = (zn.cx - b.pos.x) / zd; wz = (zn.cz - b.pos.z) / zd; speed = 5.4;
    if (!t) faceT = Math.atan2(wx, wz);
  }
  // detecção de travamento
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
  const near = b.pos.distanceTo(G.player.pos);
  b.ch.root.visible = near < 130;
  CH.setOutlinesVisible(b.ch, near < (G.settings.quality === 'baixa' ? 22 : 45));
  CH.setShadow(b.ch, near < 40);
  if (near < 120) CH.animate(b.ch, dt, { speed: b.speed, aim: t ? 1 : 0, air: !b.onGround, pitch: 0 });
}

function botShoot(b, t, dist) {
  const ai = b.ai;
  b.fireCd = b.w.cd * 1.15; b.mag--; b.lastFire = G.time;
  ai.burst--;
  if (ai.burst <= 0) { ai.burst = 3 + Math.floor(Math.random() * 5); ai.pause = 0.45 + Math.random() * 0.7; }
  actorEye(b, _o);
  const head = Math.random() < 0.12;
  _m.set(t.pos.x, t.pos.y + (head ? 1.62 : 1.0), t.pos.z);
  _d.copy(_m).sub(_o).normalize();
  const tSpeed = t.speed || 0;
  const err = (0.022 + dist * 0.0011 + (tSpeed > 1 ? 0.022 : 0) + (b.speed > 1 ? 0.012 : 0)) / ai.skill;
  _d.x += (Math.random() - 0.5) * err * 2; _d.y += (Math.random() - 0.5) * err * 2; _d.z += (Math.random() - 0.5) * err * 2;
  _d.normalize();
  const res = traceShot(_o, _d, 90, b);
  b.ch.muzzle.getWorldPosition(_m);
  const pd = b.pos.distanceTo(G.player.pos);
  if (pd < 140) { FX.tracer(_m, res.point); if (pd < 70) FX.flash(_m); }
  applyShot(b, res, _d);
  if (pd < 90) SND.play('shotFar', U.clamp(1 - pd / 90, 0.05, 0.6));
}

// ------------------------------------------------------------------ câmera
function updateCamera(dt) {
  const p = G.player;
  const k = p.aim;
  if (!p.alive) {
    G.deathOrbit = (G.deathOrbit || 0) + dt * 0.35;
    const c = p.pos;
    camera.position.set(c.x + Math.sin(G.deathOrbit) * 5, c.y + 3.2, c.z + Math.cos(G.deathOrbit) * 5);
    camera.lookAt(c.x, c.y + 0.6, c.z);
    return;
  }
  // em retrato a tela é estreita: câmera mais afastada e campo de visão maior
  const portrait = camera.aspect < 1;
  const dist = U.lerp(portrait ? 4.3 : 3.25, portrait ? 3.2 : 2.45, k), sh = U.lerp(portrait ? 0.45 : 0.7, portrait ? 0.5 : 0.78, k);
  camForward(_f, G.yaw, G.pitch);
  _r.set(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  const pivot = _o.set(p.pos.x, p.pos.y + 1.6, p.pos.z).addScaledVector(_r, sh);
  // colisão da câmera com obstáculos
  _d.copy(_f).negate();
  const hit = W.raycast(pivot, _d, dist + 0.3, false);
  const dd = hit ? Math.max(0.35, hit.t - 0.3) : dist;
  camera.position.copy(pivot).addScaledVector(_d, dd);
  camera.position.y += 0.18;
  const gy = W.height(camera.position.x, camera.position.z) + 0.35;
  if (camera.position.y < gy) camera.position.y = gy;
  let shake = 0;
  if (G.shake > 0) { G.shake -= dt; shake = 0.006; }
  camera.rotation.set(G.pitch + (Math.random() - 0.5) * shake, G.yaw + (Math.random() - 0.5) * shake, 0);
  const fov = U.lerp(portrait ? 74 : 62, portrait ? 62 : 50, k);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = U.damp(camera.fov, fov, 14, dt); camera.updateProjectionMatrix(); }
  // sombra acompanha o jogador
  sun.position.copy(p.pos).addScaledVector(G.sunDir, 70);
  sun.target.position.copy(p.pos);
}

// ------------------------------------------------------------------ HUD
const H = {};
function initHUD() {
  ['hud', 'compassStrip', 'compassNum', 'zoneText', 'announce', 'areaBanner', 'areaName', 'ammo', 'reserve', 'reloadTxt', 'alive', 'hitmark', 'killfeed', 'toast',
    'hpFill', 'hpText', 'armorTag', 'kitCount', 'wallCount', 'kitProg', 'vignette', 'btnUse', 'fps', 'crosshair', 'minimap', 'hurtArrow', 'wallBtnCount'].forEach(id => H[id] = $(id));
  // bússola
  const PX = 4;
  const names = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
  let html = '';
  for (let d = -180; d <= 540; d += 15) {
    const n = ((d % 360) + 360) % 360;
    const label = names[n] !== undefined ? '<b>' + names[n] + '</b>' : '<i>' + n + '</i>';
    html += '<span style="left:' + ((d + 180) * PX) + 'px">' + label + '</span>';
  }
  H.compassStrip.innerHTML = html;
  H.PX = PX;
  H.mm = H.minimap.getContext('2d');
  H.cache = {};
}

function setText(el, key, v) {
  if (H.cache[key] === v) return;
  H.cache[key] = v;
  el.textContent = v;
}

function updateHUD(dt) {
  const p = G.player, z = G.zone;
  const heading = ((-G.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const cw = H.compassStrip.parentNode.clientWidth;
  H.compassStrip.style.transform = 'translateX(' + (cw / 2 - (heading + 180) * H.PX) + 'px)';
  setText(H.compassNum, 'cn', String(Math.round(heading) % 360));

  const zt = z.final ? 'Zona final' : z.waiting ? 'A zona segura vai diminuir em  ' + U.fmtTime(z.timer) : 'A zona segura está diminuindo  ' + U.fmtTime(z.timer);
  setText(H.zoneText, 'zt', zt);
  setText(H.ammo, 'am', String(p.mag));
  setText(H.reserve, 'rs', '/ ' + p.reserve);
  setText(H.reloadTxt, 'rl', p.reloadT > 0 ? 'Recarregando…' : p.mag === 0 ? 'Sem munição' : '');
  setText(H.alive, 'al', 'Vivos ' + aliveCount() + '  ·  Abates ' + p.kills);
  const hp = Math.max(0, Math.ceil(p.hp));
  setText(H.hpText, 'hp', hp + ' / ' + p.maxHp);
  H.hpFill.style.width = (hp / p.maxHp * 100) + '%';
  setText(H.armorTag, 'ar', p.armor ? 'Colete Nv. ' + p.armor : 'Sem colete');
  setText(H.kitCount, 'kc', String(p.kits));
  setText(H.wallCount, 'wc', String(p.walls));
  setText(H.wallBtnCount, 'wbc', String(p.walls));
  H.kitProg.style.transform = 'scaleX(' + (p.healT > 0 ? 1 - p.healT / 2.4 : 0) + ')';
  const canUse = canOpenAirdrop();
  if (H.cache.use !== canUse) { H.cache.use = canUse; H.btnUse.classList.toggle('hidden', !canUse); }
  G.vignette = Math.max(0, G.vignette - dt * 0.9);
  H.vignette.style.opacity = G.vignette.toFixed(2);
  H.crosshair.classList.toggle('aiming', p.aim > 0.5);
  // indicador de direção do dano
  if (G.vignette > 0.05 && G.hurtDir !== undefined) {
    const rel = G.hurtDir - (G.yaw + Math.PI);
    H.hurtArrow.style.opacity = Math.min(1, G.vignette * 2).toFixed(2);
    H.hurtArrow.style.transform = 'translate(-50%,-50%) rotate(' + (-rel) + 'rad) translateY(-120px)';
  } else H.hurtArrow.style.opacity = 0;
  // fps
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
  g.strokeStyle = '#ffffff'; g.lineWidth = 1;
  if (!z.final) { g.beginPath(); g.arc(tx(z.toX), tz(z.toZ), z.toR * sc, 0, 7); g.stroke(); }
  g.strokeStyle = '#3aa8ff'; g.lineWidth = 2;
  g.beginPath(); g.arc(tx(z.cx), tz(z.cz), Math.max(1, z.r * sc), 0, 7); g.stroke();
  const ad = G.airdrop;
  if (ad.state !== 'none' && ad.state !== 'opened') { g.fillStyle = '#ff3b30'; g.fillRect(tx(ad.x) - 3, tz(ad.z) - 3, 6, 6); }
  // jogador
  g.save(); g.translate(tx(p.pos.x), tz(p.pos.z)); g.rotate(-G.yaw);
  g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
  g.restore();
}

let toastTimer = 0, annTimer = 0, areaTimer = 0, hitTimer = 0;
function toast(msg) {
  H.toast.textContent = msg; H.toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => H.toast.classList.remove('show'), 2200);
}
function announce(msg) {
  H.announce.textContent = msg; H.announce.classList.add('show');
  clearTimeout(annTimer); annTimer = setTimeout(() => H.announce.classList.remove('show'), 5000);
}
function areaBanner(name) {
  H.areaName.textContent = name; H.areaBanner.classList.add('show');
  clearTimeout(areaTimer); areaTimer = setTimeout(() => H.areaBanner.classList.remove('show'), 2800);
}
function hitMarker(head) {
  H.hitmark.classList.toggle('head', !!head);
  H.hitmark.classList.add('show');
  clearTimeout(hitTimer); hitTimer = setTimeout(() => H.hitmark.classList.remove('show'), 120);
  SND.play('hit', 0.6);
}
function killFeed(killer, victim, weapon) {
  const el = document.createElement('div');
  el.className = 'kf';
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  el.innerHTML = victim ? esc(killer) + ' <em>ABATE</em> ' + esc(victim) + ' <span>(' + esc(weapon) + ')</span>'
    : esc(killer) + ' <em>foi eliminado</em> <span>(Zona)</span>';
  H.killfeed.appendChild(el);
  while (H.killfeed.children.length > 2) H.killfeed.firstChild.remove();
  setTimeout(() => el.remove(), 4000);
}

// ------------------------------------------------------------------ controles
function initInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape' && G.state === 'play') pauseGame();
    if (e.code === 'KeyF' && G.state === 'play') input.aimToggle = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  const canvas = $('c');
  canvas.addEventListener('mousedown', (e) => {
    if (G.state !== 'play' || isTouchEvent(e)) return;
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock && canvas.requestPointerLock(); return; }
    if (e.button === 0) G.mouseFire = true;
    if (e.button === 2) input.aimToggle = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) G.mouseFire = false; });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { input.lookX += e.movementX * 0.0024; input.lookY += e.movementY * 0.0024; }
  });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) G.mouseFire = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- toque ----
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
    touch.setPointerCapture && touch.setPointerCapture(e.pointerId);
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

  // botões: segurar para atirar e arrastar o botão de tiro também gira a câmera
  const holdBtn = (id, onDown, onUp, dragLook) => {
    const el = $(id);
    let pid = null, px = 0, py = 0;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      SND.init();
      pid = e.pointerId; px = e.clientX; py = e.clientY;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
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
  holdBtn('btnFire', () => { input.fire = true; }, () => { input.fire = false; }, true);
  holdBtn('btnFireL', () => { input.fire = true; }, () => { input.fire = false; }, true);
  holdBtn('btnAim', () => { input.aimToggle = true; });
  holdBtn('btnJump', () => { input.jump = true; });
  holdBtn('btnReload', () => { input.reload = true; });
  holdBtn('btnWall', () => { input.wall = true; });
  holdBtn('slotWall', () => { input.wall = true; });
  holdBtn('slotKit', () => { input.heal = true; });
  holdBtn('btnUse', () => { input.use = true; });
}
function isTouchEvent(e) { return e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents); }

// ------------------------------------------------------------------ partida
function clearMatch() {
  for (const a of G.actors) scene.remove(a.ch.root);
  for (const w of G.walls.slice()) { w.dead = true; scene.remove(w.grp); }
  G.walls.length = 0; W.dynamic.length = 0;
  for (const it of G.loot) scene.remove(it.grp);
  G.loot.length = 0;
  if (G.airdrop && G.airdrop.mesh) scene.remove(G.airdrop.mesh);
  if (G.airdrop && G.airdrop.col) W.removeCollider(G.airdrop.col);
  G.actors = []; G.bots = [];
  FX.reset();
  $('killfeed').innerHTML = '';
}

function startMatch() {
  if (!G.built) {
    W.build(scene, G.settings.quality);
    FX.init(scene);
    G.built = true;
  }
  clearMatch();
  G.botDmgScale = 0.55;
  G.time = 0; G.vignette = 0; G.endT = -1; G.area = null; G.deathOrbit = 0; G.mouseFire = false;
  const p = makeActor(G.settings.name || 'Jogador', CH.PLAYER_PAL, true, 'UMP');
  p.pos.set(-46, 0, 15);
  p.pos.y = W.groundAt(p.pos.x, p.pos.z, 50);
  G.player = p; G.actors.push(p);
  G.yaw = -Math.PI / 2 + 0.25; G.pitch = -0.08; p.face = G.yaw + Math.PI;
  spawnBots();
  scatterLoot();
  G.airdrop = { state: 'none' };
  initZone();
  G.state = 'play';
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  ['menu', 'pauseScr', 'endScr'].forEach(id => $(id).classList.add('hidden'));
  onResize();
  setTimeout(() => announce('A partida começou! ' + G.actors.length + ' jogadores na ilha'), 300);
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
  updatePlayer(dt);
  for (const b of G.bots) updateBot(b, dt);
  updateWalls(dt);
  updateLoot(dt);
  updateZone(dt);
  updateAirdrop(dt);
  if (G.endT > 0) { G.endT -= dt; if (G.endT <= 0) endMatch(); }
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === 'play') tick(dt);
  if (G.built && G.player) {
    if (G.state !== 'pause') {
      W.update(dt, G.player.pos.x, G.player.pos.z);
      FX.update(dt, camera, W);
    }
    updateCamera(G.state === 'pause' ? 0 : dt);
    if (G.state === 'play') updateHUD(dt);
  } else {
    // fundo do menu: câmera girando lentamente sobre a ilha
    if (G.built) { /* nada */ }
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
  window.__game = { G: G, W: W, FX: FX, input: input, keys: keys, startMatch: startMatch, deployWall: deployWall, damageActor: damageActor, openAirdrop: openAirdrop, tick: tick, camera: function () { return camera; }, renderer: function () { return renderer; } };
}

window.addEventListener('error', (e) => {
  const b = $('errorBox');
  if (b) { b.textContent = 'Erro: ' + e.message; b.classList.remove('hidden'); }
});
boot();
