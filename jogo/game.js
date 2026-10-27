import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ---------- Config ----------
// Personagem: tenta o modelo local primeiro, depois o soldado gratuito (MIT) do repositório do three.js.
const CHAR_URLS = ['assets/personagem.glb', 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb'];
// Armas: coloque os .glb do seu pack em assets/armas/ com estes nomes; sem o arquivo, usa a arma procedural.
const WEAPONS = {
  PT: { nome: 'Pistola Vespa', dano: 20, cad: 0.25, pente: 12, spread: 0.02, alcance: 60, auto: false, len: 0.35, cor: 0x2b2b2b, glb: 'assets/armas/pistola.glb' },
  SMG: { nome: 'SMG Faísca', dano: 14, cad: 0.07, pente: 35, spread: 0.035, alcance: 60, auto: true, len: 0.6, cor: 0x37474f, glb: 'assets/armas/smg.glb' },
  AR: { nome: 'Fuzil Trovão', dano: 21, cad: 0.11, pente: 30, spread: 0.014, alcance: 150, auto: true, len: 0.9, cor: 0x4e342e, glb: 'assets/armas/fuzil.glb' },
  SG: { nome: 'Escopeta Rugido', dano: 14, pellets: 8, cad: 0.85, pente: 6, spread: 0.09, alcance: 30, auto: false, len: 0.85, cor: 0x5d4037, glb: 'assets/armas/escopeta.glb' },
  SR: { nome: 'Rifle Falcão', dano: 92, cad: 1.3, pente: 5, spread: 0.002, alcance: 320, auto: false, zoom: true, len: 1.15, cor: 0x263238, glb: 'assets/armas/sniper.glb' },
};
const SKINS = [
  { nome: 'Recruta', cor: 0x9ccc65, acc: 0x33691e },
  { nome: 'Fênix', cor: 0xff7043, acc: 0xffc107 },
  { nome: 'Neon', cor: 0x40e0ff, acc: 0xff40c0 },
  { nome: 'Sombra', cor: 0x7e57c2, acc: 0x212121 },
];
const BOT_NAMES = ['Tigrão', 'NinjaBR', 'Faísca', 'LoboMau', 'Zeca_Pro', 'Malvadão', 'Kiko', 'Raio', 'Dona_Bala', 'Paçoca', 'Rei_Sniper', 'Jaguar', 'Trovão', 'Bolt', 'Mestre_Z', 'Cobra', 'Lua', 'Fumaça', 'Pipoca'];
const ISLAND = 260;
const TOWNS = [
  { n: 'Vila Sol', x: -120, z: -90 }, { n: 'Porto Azul', x: 140, z: -110 }, { n: 'Fábrica', x: 0, z: 20, ind: 1 },
  { n: 'Usina', x: -130, z: 120, ind: 1 }, { n: 'Mirante', x: 130, z: 130 }, { n: 'Base Militar', x: 20, z: -170, ind: 1 },
];
const PHASES = [170, 110, 65, 35, 12, 0];
const ZONE_DMG = [1, 2, 4, 6, 9, 12, 15];

let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => a + rnd() * (b - a);
const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(pointer:coarse)').matches;
if (isMobile) document.body.classList.add('mobile');

// ---------- Cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0x8fd0ff, 140, 430);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 900);
scene.add(new THREE.HemisphereLight(0xe3f4ff, 0x6b5530, 0.95));
const sun = new THREE.DirectionalLight(0xfff1d0, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 400 });
scene.add(sun, sun.target);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
const mats = {};
const M = (c) => mats[c] || (mats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.1 }));

// ---------- Mapa ----------
const solids = [], boxes = [], circles = [];
function flat(geo, color, y) { const m = new THREE.Mesh(geo, M(color)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m; }
flat(new THREE.PlaneGeometry(3000, 3000), 0x2a8fd8, -0.4);
flat(new THREE.CircleGeometry(ISLAND + 28, 64), 0xead79e, -0.05);
flat(new THREE.CircleGeometry(ISLAND, 64), 0x72b84a, 0);

function addBox(x, z, w, d, h, color) {
  const m = new THREE.Mesh(boxGeo, M(color));
  m.scale.set(w, h, d); m.position.set(x, h / 2, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m); solids.push(m);
  boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
  return m;
}
const overlaps = (x, z, pad) => boxes.some((b) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);
const WALLS = [0xf5e6c8, 0xffccbc, 0xb3e5fc, 0xfff59d, 0xc8e6c9, 0xd7ccc8], ROOFS = [0xc62828, 0x6d4c41, 0x1565c0, 0x2e7d32];
for (const t of TOWNS) {
  for (let i = 0; i < 8; i++) {
    const x = t.x + R(-30, 30), z = t.z + R(-30, 30), w = R(6, 10), d = R(6, 10);
    if (overlaps(x, z, Math.max(w, d) / 2 + 3)) continue;
    if (t.ind && i % 2) { addBox(x, z, 2.6, 8, 2.6, [0xd84315, 0x1565c0, 0x2e7d32][i % 3]); continue; } // contêiner
    const h = R(3.2, 5);
    addBox(x, z, w, d, h, WALLS[i % WALLS.length]);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 2.2, 4), M(ROOFS[i % ROOFS.length]));
    roof.rotation.y = Math.PI / 4; roof.scale.set(w / 1.38, 1, d / 1.38); roof.position.set(x, h + 1.1, z); roof.castShadow = true; scene.add(roof);
    const door = new THREE.Mesh(boxGeo, M(0x4e342e)); door.scale.set(1.3, 2.2, 0.1); door.position.set(x, 1.1, z + d / 2 + 0.05); scene.add(door);
    for (const s of [-1, 1]) { const win = new THREE.Mesh(boxGeo, M(0x263238)); win.scale.set(1.1, 1, 0.1); win.position.set(x + s * w / 3.2, h * 0.6, z + d / 2 + 0.05); scene.add(win); }
  }
  for (let i = 0; i < 6; i++) { const x = t.x + R(-34, 34), z = t.z + R(-34, 34); if (!overlaps(x, z, 1.5)) addBox(x, z, 1.3, 1.3, 1.2, 0xa1887f); }
}
// árvores e pedras
const nearTown = (x, z, d) => TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < d);
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), M(0x6d4c41), 240);
const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 0), M(0x3f8f2f), 240);
crowns.castShadow = trunks.castShadow = true;
const tmp = new THREE.Object3D();
let nTree = 0;
while (nTree < 240) {
  const a = R(0, Math.PI * 2), r = Math.sqrt(rnd()) * (ISLAND - 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (nearTown(x, z, 42)) continue;
  const s = R(0.8, 1.4);
  tmp.position.set(x, 1.5 * s, z); tmp.scale.setScalar(s); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); trunks.setMatrixAt(nTree, tmp.matrix);
  tmp.position.y = 4.2 * s; tmp.rotation.y = R(0, 3); tmp.updateMatrix(); crowns.setMatrixAt(nTree, tmp.matrix);
  circles.push({ x, z, r: 0.4 * s }); nTree++;
}
scene.add(trunks, crowns); solids.push(trunks, crowns);
for (let i = 0; i < 70; i++) {
  const a = R(0, 6.28), r = Math.sqrt(rnd()) * (ISLAND - 10), x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (nearTown(x, z, 40)) continue;
  const s = R(0.8, 2.2), m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M(0x8d8d8d));
  m.position.set(x, s * 0.5, z); m.rotation.set(R(0, 3), R(0, 3), 0); m.castShadow = m.receiveShadow = true;
  scene.add(m); solids.push(m); circles.push({ x, z, r: s * 0.85 });
}
const zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 160, 72, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
zoneMesh.position.y = 60; scene.add(zoneMesh);

// ---------- Assets ----------
const loader = new GLTFLoader();
let charGLTF = null;
const gunGLB = {};
const loadAny = (urls) => new Promise((res) => { const next = (i) => i >= urls.length ? res(null) : loader.load(urls[i], res, undefined, () => next(i + 1)); next(0); });
function normalizeGun(sceneObj, len) {
  const box = new THREE.Box3().setFromObject(sceneObj), size = box.getSize(new THREE.Vector3());
  if (size.x > size.z) sceneObj.rotation.y = -Math.PI / 2;
  sceneObj.scale.multiplyScalar(len / Math.max(size.x, size.y, size.z));
  const wrap = new THREE.Group(); wrap.add(sceneObj); return wrap;
}

function gunMesh(type, acc = 0xffc107) {
  const c = WEAPONS[type], g = new THREE.Group(), L = c.len;
  if (gunGLB[type]) { g.add(gunGLB[type].clone()); return g; }
  const part = (geo, color, sx, sy, sz, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, M(color)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  part(boxGeo, c.cor, 0.08, 0.12, L * 0.55, 0, 0, L * 0.1);
  part(cylGeo, 0x1a1a1a, 0.025, L * 0.45, 0.025, 0, 0.02, L * 0.55, Math.PI / 2);
  part(boxGeo, c.cor, 0.06, 0.15, 0.07, 0, -0.11, -0.02, 0.3);
  part(boxGeo, acc, 0.05, 0.17, 0.07, 0, -0.13, L * 0.2);
  part(boxGeo, acc, 0.085, 0.025, L * 0.4, 0, 0.065, L * 0.1);
  if (type !== 'PT') part(boxGeo, c.cor, 0.06, 0.11, L * 0.25, 0, -0.02, -L * 0.28);
  if (c.zoom) part(cylGeo, 0x111111, 0.035, 0.3, 0.035, 0, 0.11, L * 0.12, Math.PI / 2);
  return g;
}

function makeModel(skin) {
  const g = new THREE.Group();
  let mixer = null; const actions = {};
  if (charGLTF) {
    const m = SkeletonUtils.clone(charGLTF.scene);
    m.rotation.y = Math.PI;
    const tint = new THREE.Color(skin.cor).lerp(new THREE.Color(0xffffff), 0.3);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.color = tint; } });
    g.add(m);
    mixer = new THREE.AnimationMixer(m);
    for (const clip of charGLTF.animations) actions[clip.name] = mixer.clipAction(clip);
    actions.Idle?.play();
  } else {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.8, 4, 8), M(skin.cor)); body.position.y = 0.95; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M(0xffcc99)); head.position.y = 1.62; head.castShadow = true; g.add(head);
  }
  const pack = new THREE.Mesh(boxGeo, M(skin.acc)); pack.scale.set(0.35, 0.45, 0.18); pack.position.set(0, 1.2, -0.22); g.add(pack);
  return { g, mixer, actions };
}

// ---------- Personagens ----------
const chars = [];
class Char {
  constructor(name, skin, isPlayer) {
    Object.assign(this, { name, skin, isPlayer, hp: 100, armor: 0, alive: true, kills: 0, vy: 0, yaw: 0, cool: 0, reload: 0, kits: 0, shields: 1, chute: true, cur: 0 });
    const md = makeModel(skin); this.g = md.g; this.mixer = md.mixer; this.actions = md.actions; this.anim = 'Idle';
    this.pos = this.g.position;
    this.slots = [newWeapon('PT'), null];
    this.gun = new THREE.Group(); this.gun.position.set(0.3, 1.22, 0.32); this.g.add(this.gun);
    this.canopy = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: skin.acc, side: THREE.DoubleSide }));
    this.canopy.position.y = 4.4; this.g.add(this.canopy);
    this.equip(); scene.add(this.g); chars.push(this);
  }
  get w() { return this.slots[this.cur]; }
  equip() { this.gun.clear(); if (this.w) this.gun.add(gunMesh(this.w.type, this.skin.acc)); this.reload = 0; }
  setAnim(n) {
    if (!this.mixer || this.anim === n || !this.actions[n]) return;
    this.actions[this.anim]?.fadeOut(0.2); this.actions[n].reset().fadeIn(0.2).play(); this.anim = n;
  }
}
const newWeapon = (type) => ({ type, mag: WEAPONS[type].pente, res: WEAPONS[type].pente * 3 });

function moveChar(c, dx, dz, dt) {
  const p = c.pos, r = 0.4; let ground = 0;
  p.x += dx; p.z += dz;
  for (const b of boxes) {
    if (p.x + r < b.x0 || p.x - r > b.x1 || p.z + r < b.z0 || p.z - r > b.z1) continue;
    if (p.y >= b.h - 0.4) { ground = Math.max(ground, b.h); continue; }
    const e = [b.x1 - (p.x - r), (p.x + r) - b.x0, b.z1 - (p.z - r), (p.z + r) - b.z0], m = Math.min(...e);
    if (m === e[0]) p.x += m; else if (m === e[1]) p.x -= m; else if (m === e[2]) p.z += m; else p.z -= m;
  }
  for (const ci of circles) {
    const ox = p.x - ci.x, oz = p.z - ci.z, d = Math.hypot(ox, oz), min = r + ci.r;
    if (d < min && d > 1e-4) { p.x += (ox / d) * (min - d); p.z += (oz / d) * (min - d); }
  }
  const dc = Math.hypot(p.x, p.z), lim = ISLAND + 22;
  if (dc > lim) { p.x *= lim / dc; p.z *= lim / dc; }
  c.vy = c.chute ? -7 : c.vy - 25 * dt;
  p.y += c.vy * dt;
  c.onGround = p.y <= ground;
  if (c.onGround) { p.y = ground; c.vy = 0; if (c.chute) { c.chute = false; c.canopy.visible = false; } }
}

// ---------- Tiro ----------
const ray = new THREE.Raycaster();
const HITBOX = [[1.62, 0.17, true], [1.3, 0.32, false], [0.95, 0.32, false], [0.55, 0.3, false]];
function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz, b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c;
  if (disc < 0) return null; const t = -b - Math.sqrt(disc); return t > 0 ? t : null;
}
function hitScan(sh, o, d, range) {
  ray.set(o, d); ray.far = range;
  const hit = ray.intersectObjects(solids, false)[0];
  let bt = hit ? hit.distance : range, target = null, head = false;
  for (const t of chars) {
    if (t === sh || !t.alive) continue;
    for (const [h, r, isHead] of HITBOX) { const tt = raySphere(o, d, t.pos.x, t.pos.y + h, t.pos.z, r); if (tt !== null && tt < bt) { bt = tt; target = t; head = isHead; } }
  }
  return { target, head, obj: target ? null : hit?.object, point: o.clone().addScaledVector(d, bt) };
}
const v1 = new THREE.Vector3();
function muzzle(c) { return c.gun.getWorldPosition(v1).clone().addScaledVector(new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), WEAPONS[c.w.type].len * 0.8); }
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.9 });
const fx = [];
function tracer(a, b) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), tracerMat); scene.add(l); fx.push({ o: l, t: 0.06 }); }

function startReload(c) { const w = c.w; if (!w || c.reload > 0 || w.mag >= WEAPONS[w.type].pente || w.res <= 0) return; c.reload = WEAPONS[w.type].zoom ? 2.2 : 1.5; }
function shoot(c, dir, origin, extraSpread = 0) {
  const w = c.w; if (!w || c.cool > 0 || c.reload > 0) return;
  if (w.mag <= 0) { startReload(c); return; }
  const cfg = WEAPONS[w.type]; w.mag--; c.cool = cfg.cad;
  playShot(c, cfg);
  const spread = cfg.spread * (c.isPlayer && aiming ? 0.35 : 1) + extraSpread;
  const from = muzzle(c);
  for (let i = 0; i < (cfg.pellets || 1); i++) {
    const d = dir.clone(); d.x += (Math.random() - 0.5) * 2 * spread; d.y += (Math.random() - 0.5) * 2 * spread; d.z += (Math.random() - 0.5) * 2 * spread; d.normalize();
    const h = hitScan(c, origin, d, cfg.alcance);
    tracer(from, h.point);
    if (h.target) damage(h.target, cfg.dano * (h.head ? 1.8 : 1) * (c.isPlayer ? 1 : 0.5), c, h.head, h.point);
    else if (h.obj?.userData.wall) hitWall(h.obj.userData.wall, cfg.dano);
  }
  if (c.isPlayer && w.mag === 0) startReload(c);
}
function damage(t, amt, src, head, point) {
  if (!t.alive) return;
  if (t.armor > 0) { const a = Math.min(t.armor, amt * 0.5); t.armor -= a; amt -= a; }
  t.hp -= amt;
  if (src?.isPlayer) { hitMark(head); if (point) dmgNum(point, Math.round(amt), head); }
  if (t.isPlayer) { $('hurt').style.opacity = 0.7; setTimeout(() => ($('hurt').style.opacity = 0), 150); }
  else if (src) t.aggro = src;
  if (t.hp <= 0) kill(t, src);
}
function kill(t, src) {
  t.alive = false; t.hp = 0;
  if (t.w) spawnLoot('arma', t.pos.x, t.pos.z, t.w.type);
  if (t.kits) spawnLoot('kit', t.pos.x + 1, t.pos.z);
  t.mixer?.stopAllAction(); t.g.rotation.x = -Math.PI / 2; t.g.position.y += 0.3;
  setTimeout(() => scene.remove(t.g), 5000);
  if (src) src.kills++;
  feed(src ? `${src.name} <b>⌖ ${WEAPONS[src.w?.type || 'PT'].nome}</b> ${t.name}` : `${t.name} ficou fora da zona`, src?.isPlayer || t.isPlayer);
  const alive = chars.filter((c) => c.alive).length;
  if (t.isPlayer) endGame(false, alive + 1);
  else if (alive === 1 && player.alive) endGame(true, 1);
}

// ---------- Escudo (parede implantável) ----------
const walls = [];
function placeWall(c) {
  if (c.shields <= 0) return; c.shields--;
  const f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), x = c.pos.x + f.x * 2.2, z = c.pos.z + f.z * 2.2;
  const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.75, roughness: 0.1 }));
  m.scale.set(3.2, 2.4, 0.35); m.position.set(x, c.pos.y + 1.2, z); m.rotation.y = c.yaw; m.castShadow = true; scene.add(m);
  const right = new THREE.Vector3(-f.z, 0, f.x), cs = [-1.1, 0, 1.1].map((k) => ({ x: x + right.x * k, z: z + right.z * k, r: 0.55 }));
  const w = { m, hp: 300, cs }; m.userData.wall = w; walls.push(w); solids.push(m); circles.push(...cs);
}
function hitWall(w, d) {
  w.hp -= d; w.m.material.opacity = 0.3 + 0.45 * (w.hp / 300);
  if (w.hp > 0) return;
  scene.remove(w.m); solids.splice(solids.indexOf(w.m), 1);
  for (const c of w.cs) circles.splice(circles.indexOf(c), 1);
}

// ---------- Loot ----------
const loots = [];
const LOOT_COLOR = { arma: 0xffb300, municao: 0x8bc34a, kit: 0xff5252, colete: 0x42a5f5, escudo: 0x9fe8ff };
const ringGeo = new THREE.RingGeometry(0.5, 0.7, 20);
function spawnLoot(kind, x, z, data) {
  const g = new THREE.Group();
  const item = kind === 'arma' ? gunMesh(data) : new THREE.Mesh(boxGeo, M(LOOT_COLOR[kind]));
  if (kind !== 'arma') item.scale.setScalar(0.4);
  item.position.y = 0.6; g.add(item);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: LOOT_COLOR[kind], side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.position.set(x, 0, z); scene.add(g);
  loots.push({ kind, data, g, item, x, z });
}
function randomLootKind() { const r = Math.random(); return r < 0.45 ? 'arma' : r < 0.65 ? 'municao' : r < 0.8 ? 'kit' : r < 0.93 ? 'colete' : 'escudo'; }
const LOOT_GUNS = ['SMG', 'AR', 'AR', 'SG', 'SR', 'SMG', 'PT'];
for (const t of TOWNS) for (let i = 0; i < 14; i++) {
  const x = t.x + R(-36, 36), z = t.z + R(-36, 36); if (overlaps(x, z, 0.8)) continue;
  const k = randomLootKind(); spawnLoot(k, x, z, k === 'arma' ? LOOT_GUNS[Math.floor(rnd() * LOOT_GUNS.length)] : null);
}
for (let i = 0; i < 40; i++) {
  const a = R(0, 6.28), r = Math.sqrt(rnd()) * (ISLAND - 15), x = Math.cos(a) * r, z = Math.sin(a) * r; if (overlaps(x, z, 0.8)) continue;
  const k = randomLootKind(); spawnLoot(k, x, z, k === 'arma' ? LOOT_GUNS[Math.floor(rnd() * LOOT_GUNS.length)] : null);
}
function removeLoot(l) { scene.remove(l.g); loots.splice(loots.indexOf(l), 1); }
// Itens que não são armas: aplica direto. Retorna true se consumiu.
function takeItem(c, l) {
  if (l.kind === 'municao') { for (const w of c.slots) if (w) w.res += WEAPONS[w.type].pente * 2; }
  else if (l.kind === 'kit') c.kits++;
  else if (l.kind === 'colete') { if (c.armor >= 100) return false; c.armor = 100; }
  else if (l.kind === 'escudo') c.shields++;
  removeLoot(l); return true;
}
function takeGun(c, l) {
  const slot = c.slots[1] === null ? 1 : c.cur;
  if (c.slots[slot]) spawnLoot('arma', c.pos.x + 0.8, c.pos.z, c.slots[slot].type);
  c.slots[slot] = newWeapon(l.data); c.cur = slot; c.equip(); removeLoot(l);
}

// ---------- Zona ----------
const zone = { x: 0, z: 0, r: ISLAND, nx: 0, nz: 0, nr: PHASES[0], phase: 0, timer: 60, shrinking: false, t: 0, dur: 30 };
function nextZone() {
  const nr = PHASES[zone.phase] ?? 0, a = Math.random() * 6.28, off = Math.random() * Math.max(0, zone.r - nr);
  zone.nx = zone.x + Math.cos(a) * off; zone.nz = zone.z + Math.sin(a) * off; zone.nr = nr;
}
function updateZone(dt) {
  if (!zone.shrinking) { zone.timer -= dt; if (zone.timer <= 0 && zone.phase < PHASES.length) { zone.shrinking = true; zone.t = 0; zone.sx = zone.x; zone.sz = zone.z; zone.sr = zone.r; } }
  else {
    zone.t += dt; const k = Math.min(1, zone.t / zone.dur);
    zone.x = zone.sx + (zone.nx - zone.sx) * k; zone.z = zone.sz + (zone.nz - zone.sz) * k; zone.r = zone.sr + (zone.nr - zone.sr) * k;
    if (k >= 1) { zone.shrinking = false; zone.phase++; zone.timer = 35; nextZone(); }
  }
  zoneMesh.position.x = zone.x; zoneMesh.position.z = zone.z; zoneMesh.scale.set(Math.max(zone.r, 0.1), 1, Math.max(zone.r, 0.1));
  for (const c of chars) if (c.alive && Math.hypot(c.pos.x - zone.x, c.pos.z - zone.z) > zone.r) {
    c.hp -= ZONE_DMG[zone.phase] * dt;
    if (c.hp <= 0) kill(c, null);
  }
}

// ---------- Bots ----------
const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
const chest = (c) => new THREE.Vector3(c.pos.x, c.pos.y + 1.3, c.pos.z);
function los(a, b) {
  const o = chest(a), d = chest(b).sub(o), len = d.length(); d.divideScalar(len);
  ray.set(o, d); ray.far = len; return ray.intersectObjects(solids, false).length === 0;
}
function botGoal(b) {
  const out = Math.hypot(b.pos.x - zone.nx, b.pos.z - zone.nz) > zone.nr * 0.8;
  if (!out && (b.slots[1] === null || b.kits < 2)) {
    let best = null, bd = 45;
    for (const l of loots) { const d = Math.hypot(l.x - b.pos.x, l.z - b.pos.z); if (d < bd && (l.kind !== 'arma' || b.slots[1] === null)) { bd = d; best = l; } }
    if (best) { b.goal = { x: best.x, z: best.z, loot: best }; return; }
  }
  const a = Math.random() * 6.28, r = Math.random() * zone.nr * 0.7;
  b.goal = { x: zone.nx + Math.cos(a) * r, z: zone.nz + Math.sin(a) * r };
}
function updateBot(b, dt) {
  b.think -= dt;
  if (b.think <= 0) {
    b.think = 0.35 + Math.random() * 0.25;
    let best = null, bd = Math.min(90, WEAPONS[b.w.type].alcance * 0.9);
    for (const t of chars) { if (t === b || !t.alive || t.chute) continue; const d = dist(b, t); if (d < bd && los(b, t)) { bd = d; best = t; } }
    if (b.aggro?.alive && dist(b, b.aggro) < 120 && los(b, b.aggro)) best = b.aggro;
    if (best !== b.enemy) { b.enemy = best; b.react = 0.5 + Math.random() * 0.6; }
    b.strafe = Math.random() < 0.5 ? -1 : 1;
    if (!b.goal || Math.hypot(b.goal.x - b.pos.x, b.goal.z - b.pos.z) < 1.5 || (b.goal.loot && !loots.includes(b.goal.loot))) botGoal(b);
    if (b.lastX !== undefined && Math.hypot(b.pos.x - b.lastX, b.pos.z - b.lastZ) < 0.3 && !b.enemy) botGoal(b);
    b.lastX = b.pos.x; b.lastZ = b.pos.z;
  }
  let mx = 0, mz = 0, speed = b.chute ? 10 : 5.5;
  if (b.enemy && !b.chute && b.enemy.alive) {
    const e = b.enemy, dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z, d = Math.hypot(dx, dz);
    b.yaw = Math.atan2(dx, dz);
    const ideal = WEAPONS[b.w.type].alcance > 100 ? 40 : 14, fwd = d > ideal ? 1 : d < ideal * 0.6 ? -1 : 0;
    mx = (dx / d) * fwd + (-dz / d) * b.strafe * 0.8; mz = (dz / d) * fwd + (dx / d) * b.strafe * 0.8; speed = 4.5;
    b.react -= dt;
    if (b.react <= 0) {
      const o = chest(b), dir = chest(e).sub(o).normalize();
      shoot(b, dir, o, 0.025 + d * 0.0006);
    }
    if (b.w.mag === 0) startReload(b);
  } else if (b.goal) {
    const dx = b.goal.x - b.pos.x, dz = b.goal.z - b.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.5) { mx = dx / d; mz = dz / d; b.yaw = Math.atan2(dx, dz); }
    if (b.hp < 60 && b.kits > 0) { b.kits--; b.hp = Math.min(100, b.hp + 50); }
  }
  moveChar(b, mx * speed * dt, mz * speed * dt, dt);
  for (const l of loots) if (Math.hypot(l.x - b.pos.x, l.z - b.pos.z) < 1.6) {
    if (l.kind === 'arma') { if (b.slots[1] === null) takeGun(b, l); } else takeItem(b, l);
    break;
  }
}

// ---------- Entrada ----------
const keys = {};
let yaw = 0, pitch = 0, firing = false, aiming = false, firedOnce = false, playing = false;
const joy = { x: 0, y: 0 };
addEventListener('keydown', (e) => {
  keys[e.code] = true; if (!playing) return;
  if (e.code === 'KeyR') startReload(player);
  if (e.code === 'KeyE') tryPick();
  if (e.code === 'KeyH') heal();
  if (e.code === 'KeyQ') placeWall(player);
  if (e.code === 'Digit1' || e.code === 'Digit2') { const s = +e.code.slice(5) - 1; if (player.slots[s]) { player.cur = s; player.equip(); } }
});
addEventListener('keyup', (e) => (keys[e.code] = false));
renderer.domElement.addEventListener('click', () => { if (playing && !isMobile) renderer.domElement.requestPointerLock(); });
addEventListener('mousemove', (e) => { if (document.pointerLockElement) look(e.movementX, e.movementY, 0.0024); });
addEventListener('mousedown', (e) => { if (!document.pointerLockElement) return; if (e.button === 0) firing = true; if (e.button === 2) aiming = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) { firing = false; firedOnce = false; } if (e.button === 2) aiming = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
function look(dx, dy, s) { const z = aiming ? (WEAPONS[player.w?.type]?.zoom ? 0.25 : 0.55) : 1; yaw -= dx * s * z; pitch = Math.max(-1.1, Math.min(0.9, pitch - dy * s * z)); }

// toque: joystick à esquerda, arrastar à direita para mirar
const touches = {};
addEventListener('touchstart', (e) => {
  if (!playing) return;
  for (const t of e.changedTouches) {
    const el = t.target.closest?.('.btn');
    if (el && !el.hasAttribute('data-look')) continue;
    if (t.clientX < innerWidth * 0.4 && !el) touches[t.identifier] = { kind: 'joy', ox: t.clientX, oy: t.clientY };
    else touches[t.identifier] = { kind: 'look', x: t.clientX, y: t.clientY };
  }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    const s = touches[t.identifier]; if (!s) continue;
    if (s.kind === 'joy') {
      let dx = t.clientX - s.ox, dy = t.clientY - s.oy; const l = Math.hypot(dx, dy); if (l > 55) { dx *= 55 / l; dy *= 55 / l; }
      joy.x = dx / 55; joy.y = dy / 55; $('knob').style.transform = `translate(${dx}px,${dy}px)`;
    } else { look(t.clientX - s.x, t.clientY - s.y, 0.006); s.x = t.clientX; s.y = t.clientY; }
  }
  if (playing) e.preventDefault();
}, { passive: false });
addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) { if (touches[t.identifier]?.kind === 'joy') { joy.x = joy.y = 0; $('knob').style.transform = ''; } delete touches[t.identifier]; }
});
const hold = (id, on, off) => { const el = $(id); el.addEventListener('touchstart', on, { passive: true }); el.addEventListener('touchend', off); };
hold('bFire', () => (firing = true), () => { firing = false; firedOnce = false; });
hold('bFire2', () => (firing = true), () => { firing = false; firedOnce = false; });
$('bAim').addEventListener('touchstart', () => { aiming = !aiming; $('bAim').classList.toggle('on', aiming); }, { passive: true });
$('bJump').addEventListener('touchstart', () => (keys.Space = true), { passive: true });
$('bJump').addEventListener('touchend', () => (keys.Space = false));
$('bReload').addEventListener('touchstart', () => startReload(player), { passive: true });
$('bPick').addEventListener('touchstart', () => tryPick(), { passive: true });
$('bHeal').addEventListener('touchstart', () => heal(), { passive: true });
$('bShield').addEventListener('touchstart', () => placeWall(player), { passive: true });
$('bSwap').addEventListener('touchstart', () => { const s = 1 - player.cur; if (player.slots[s]) { player.cur = s; player.equip(); } }, { passive: true });

function nearestLoot(c, maxD, pred) { let best = null; for (const l of loots) { const d = Math.hypot(l.x - c.pos.x, l.z - c.pos.z); if (d < maxD && pred(l)) { maxD = d; best = l; } } return best; }
function tryPick() { const l = nearestLoot(player, 2.4, (l) => l.kind === 'arma'); if (l) takeGun(player, l); }
function heal() { if (player.kits > 0 && player.hp < 100) { player.kits--; player.hp = Math.min(100, player.hp + 50); } }

// ---------- Som ----------
let actx = null;
function playShot(c, cfg) {
  if (!actx) return;
  const d = c.isPlayer ? 0 : dist(c, player); if (d > 90) return;
  const dur = cfg.zoom || cfg.pellets ? 0.25 : 0.09, buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3);
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = cfg.zoom ? 1200 : cfg.pellets ? 900 : 2200; g.gain.value = 0.35 * (1 - d / 90);
  src.connect(f).connect(g).connect(actx.destination); src.start();
}

// ---------- HUD ----------
const mini = $('mini').getContext('2d');
function hitMark(head) { const c = $('cross'); c.className = head ? 'head' : 'hit'; clearTimeout(hitMark.t); hitMark.t = setTimeout(() => (c.className = ''), 120); }
function dmgNum(p, n, head) {
  const v = p.clone().project(camera); if (v.z > 1) return;
  const el = document.createElement('div'); el.className = 'dmg' + (head ? ' h' : ''); el.textContent = n;
  el.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 700);
}
function feed(html, me) {
  const el = document.createElement('div'); el.innerHTML = html; if (me) el.className = 'me';
  $('feed').prepend(el); setTimeout(() => el.remove(), 5000);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
const W2M = 170 / ((ISLAND + 30) * 2), toM = (v) => 85 + v * W2M;
function drawHud() {
  const p = player;
  $('alive').textContent = chars.filter((c) => c.alive).length;
  $('kills').textContent = p.kills;
  $('hpBar').style.width = Math.max(0, p.hp) + '%';
  $('arBar').style.width = p.armor + '%';
  $('kitN').textContent = p.kits; $('shN').textContent = p.shields;
  for (let i = 0; i < 2; i++) { const s = $('s' + i); s.textContent = p.slots[i] ? WEAPONS[p.slots[i].type].nome : '—'; s.classList.toggle('on', i === p.cur); }
  $('ammo').textContent = p.w ? (p.reload > 0 ? 'Recarregando' : `${p.w.mag}/${p.w.res}`) : '';
  const m = Math.ceil(zone.timer);
  $('zoneInfo').textContent = zone.phase >= PHASES.length ? 'Zona final' : zone.shrinking ? 'Zona fechando!' : `Zona fecha em ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const l = nearestLoot(p, 2.4, (l) => l.kind === 'arma');
  $('prompt').style.display = l ? 'block' : 'none';
  if (l) $('prompt').textContent = `${isMobile ? 'E' : '[E]'} Pegar ${WEAPONS[l.data].nome}`;
  // minimapa
  mini.fillStyle = '#2a8fd8'; mini.fillRect(0, 0, 170, 170);
  mini.fillStyle = '#ead79e'; mini.beginPath(); mini.arc(85, 85, (ISLAND + 28) * W2M, 0, 7); mini.fill();
  mini.fillStyle = '#72b84a'; mini.beginPath(); mini.arc(85, 85, ISLAND * W2M, 0, 7); mini.fill();
  mini.font = 'bold 8px sans-serif'; mini.textAlign = 'center';
  for (const t of TOWNS) { mini.fillStyle = '#fff'; mini.fillText(t.n, toM(t.x), toM(t.z)); }
  mini.lineWidth = 2; mini.strokeStyle = '#fff'; mini.beginPath(); mini.arc(toM(zone.nx), toM(zone.nz), zone.nr * W2M, 0, 7); mini.stroke();
  mini.strokeStyle = '#3fa9ff'; mini.beginPath(); mini.arc(toM(zone.x), toM(zone.z), zone.r * W2M, 0, 7); mini.stroke();
  mini.save(); mini.translate(toM(p.pos.x), toM(p.pos.z)); mini.rotate(-yaw); mini.fillStyle = '#ffb300';
  mini.beginPath(); mini.moveTo(0, 6); mini.lineTo(4, -4); mini.lineTo(-4, -4); mini.fill(); mini.restore();
}

// ---------- Jogo ----------
let player = null;
function endGame(win, place) {
  playing = false; document.exitPointerLock?.();
  $('endT').textContent = win ? 'VITÓRIA!' : `#${place}`;
  $('endS').textContent = win ? `Último sobrevivente · ${player.kills} abates` : `Você foi eliminado · ${player.kills} abates`;
  setTimeout(() => $('end').classList.remove('hidden'), 1200);
}
function spawn(c) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * (ISLAND - 30); c.pos.set(Math.cos(a) * r, 70 + Math.random() * 25, Math.sin(a) * r); c.yaw = Math.random() * 6.28; }

let skinIdx = 1;
SKINS.forEach((s, i) => {
  const el = document.createElement('div'); el.className = 'skin' + (i === skinIdx ? ' on' : '');
  el.innerHTML = `<i style="background:linear-gradient(135deg,#${s.cor.toString(16).padStart(6, '0')},#${s.acc.toString(16).padStart(6, '0')})"></i>${s.nome}`;
  el.onclick = () => { skinIdx = i; document.querySelectorAll('.skin').forEach((e, j) => e.classList.toggle('on', j === i)); };
  $('skins').appendChild(el);
});
$('play').onclick = () => {
  actx = new (window.AudioContext || window.webkitAudioContext)();
  player = new Char($('nick').value.trim() || 'Jogador', SKINS[skinIdx], true);
  spawn(player); yaw = player.yaw;
  BOT_NAMES.forEach((n, i) => { const b = new Char(n, SKINS[(i + 2) % SKINS.length], false); b.think = Math.random(); spawn(b); });
  $('pname').textContent = player.name;
  $('lobby').classList.add('hidden'); $('hud').classList.remove('hidden');
  nextZone(); playing = true;
  if (!isMobile) renderer.domElement.requestPointerLock();
};

(async () => {
  const [gl] = await Promise.all([loadAny(CHAR_URLS), ...Object.entries(WEAPONS).map(([k, c]) =>
    loadAny([c.glb]).then((g) => { if (g) gunGLB[k] = normalizeGun(g.scene, c.len); }))]);
  charGLTF = gl;
  $('play').disabled = false; $('play').textContent = 'JOGAR';
})();

const clock = new THREE.Clock();
const camDir = new THREE.Vector3(), camPos = new THREE.Vector3();
let hudT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const l of loots) l.item.rotation.y += dt * 1.5;
  for (let i = fx.length - 1; i >= 0; i--) if ((fx[i].t -= dt) <= 0) { scene.remove(fx[i].o); fx[i].o.geometry.dispose(); fx.splice(i, 1); }
  if (!player) { camera.position.set(Math.cos(clock.elapsedTime * 0.05) * 200, 90, Math.sin(clock.elapsedTime * 0.05) * 200); camera.lookAt(0, 0, 0); renderer.render(scene, camera); return; }

  const p = player;
  if (playing && p.alive) {
    p.yaw = yaw;
    let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x, iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - joy.y;
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    const speed = p.chute ? 14 : aiming ? 3.5 : 7;
    const fx_ = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx_;
    if (keys.Space && p.onGround) p.vy = 8;
    moveChar(p, (fx_ * iz + rx * ix) * speed * dt, (fz * iz + rz * ix) * speed * dt, dt);
    p.moving = il > 0.1;
    for (const l of loots) if (l.kind !== 'arma' && Math.hypot(l.x - p.pos.x, l.z - p.pos.z) < 1.6) { takeItem(p, l); break; }
    if (firing && p.w && !p.chute && (WEAPONS[p.w.type].auto || !firedOnce)) { shoot(p, camDir.clone(), camPos.clone().addScaledVector(camDir, aiming ? 1.6 : 3.2)); firedOnce = true; }
  }
  for (const c of chars) {
    if (!c.alive) continue;
    if (!c.isPlayer && playing) { const x = c.pos.x, z = c.pos.z; updateBot(c, dt); c.moving = Math.hypot(c.pos.x - x, c.pos.z - z) > 0.01; }
    c.cool -= dt;
    if (c.reload > 0 && (c.reload -= dt) <= 0) { const w = c.w, n = Math.min(WEAPONS[w.type].pente - w.mag, w.res); w.mag += n; w.res -= n; }
    c.g.rotation.y = c.yaw;
    c.setAnim(c.moving && !c.chute ? 'Run' : 'Idle');
    c.mixer?.update(dt);
  }
  if (playing) updateZone(dt);

  // câmera em terceira pessoa por cima do ombro
  const zoom = aiming ? (WEAPONS[p.w?.type]?.zoom ? 18 : 45) : 70;
  if (camera.fov !== zoom) { camera.fov += (zoom - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
  camDir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const back = aiming ? 1.6 : 3.2;
  camPos.set(p.pos.x - Math.cos(yaw) * 0.7, p.pos.y + 1.65, p.pos.z + Math.sin(yaw) * 0.7).addScaledVector(camDir, -back);
  camPos.y = Math.max(camPos.y, 0.3);
  camera.position.copy(camPos); camera.lookAt(camPos.clone().add(camDir));
  sun.position.set(p.pos.x + 60, 140, p.pos.z + 30); sun.target.position.copy(p.pos);
  if ((hudT -= dt) <= 0) { hudT = 0.1; drawHud(); }
  renderer.render(scene, camera);
});
