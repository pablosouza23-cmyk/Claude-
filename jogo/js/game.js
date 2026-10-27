'use strict';
// Lógica principal: avião e salto (prancha + paraquedas), jogador, câmera, armas, granada, gel (parede de gelo),
// bots, zona segura, suprimento aéreo, loot e HUD.
const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;

const G = {
  state: 'menu', time: 0, built: false,
  settings: { quality: 'media', sens: 1, adsSens: 1, name: 'Jogador', sound: true, music: true, vibra: true, vol: 0.8, fps: false, btnSize: 1, btnAlpha: 0.85, aimAssist: true, dynRes: true, qualityChosen: false, sensDot: 1, sens2x: 1, sens4x: 1, look: 'tp', fx: 'normal', hud: null, map: 'ilha', mode: 'br', csSize: 4, csGun: 'FUZIL', brTeam: 1, sfx: 'tiros', crossStyle: 'cruz', crossCol: 'branco' },
  actors: [], bots: [], walls: [], loot: [], nades: [], props: [],
};

(function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('ilhaToonSettings') || 'null');
    if (s) {
      // versões antigas tinham uma só sensibilidade de mira
      if (s.adsSens !== undefined && s.sensDot === undefined) s.sensDot = s.sens2x = s.sens4x = s.adsSens;
      Object.assign(G.settings, s);
    }
  } catch (e) { /* armazenamento indisponível */ }
})();
G.saveSettings = function () {
  try { localStorage.setItem('ilhaToonSettings', JSON.stringify(G.settings)); } catch (e) { /* ignora */ }
};

const TOTAL = 25;
const BOT_NAMES = ['Coxinha', 'Pastel', 'Quindim', 'Jabuti', 'BotoRosa', 'TatuBola', 'Tapioca', 'Maracujá', 'Sabiá', 'Tucano', 'Açaí', 'Guaraná',
  'Curupira', 'Cuscuz', 'Paçoca', 'Brigadeiro', 'Capivara', 'Pamonha', 'Acarajé', 'Caju', 'Jacaré', 'Pequi', 'Saci', 'Mandioca'];
// as 10 armas da referência (atributos e modelos em weapons.js)
const WEAPONS = WPN.DEF;
const PRIMARIES = WPN.PRIMARY;
const VEST_RED = [0, 0.2, 0.3, 0.42];
const HELM_RED = [0, 0.25, 0.35, 0.45];
const ZONE_PHASES = [
  { wait: 75, shrink: 45, r: 130, dps: 2 },
  { wait: 38, shrink: 36, r: 80, dps: 4 },
  { wait: 30, shrink: 30, r: 45, dps: 7 },
  { wait: 24, shrink: 24, r: 20, dps: 11 },
  { wait: 18, shrink: 20, r: 0, dps: 16 },
];
const GRAV = 16;

let renderer, scene, camera, sun, hemi;
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ------------------------------------------------------------------ renderização
// primeira vez: escolhe a qualidade pela placa de vídeo do aparelho
function autoQuality() {
  if (G.settings.qualityChosen) return;
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : (gl ? String(gl.getParameter(gl.RENDERER)) : '');
  } catch (e) { /* sem informação */ }
  const weak = /Mali-(T|G3|G5[12]|4)|Adreno \(TM\) [3-5]\d\d|PowerVR|SGX|Videocore|SwiftShader|llvmpipe/i.test(gpu);
  const strong = /Adreno \(TM\) (7[3-9]\d|8\d\d)|Mali-G7[1-9]|Mali-G[6-9]1\d|Immortalis|Apple|NVIDIA|GeForce|Radeon|AMD/i.test(gpu);
  G.settings.quality = weak ? 'baixa' : strong && !isTouch ? 'alta' : 'media';
  if (isTouch && (navigator.deviceMemory || 4) <= 3) G.settings.quality = 'baixa';
  G.settings.qualityChosen = true;
  G.saveSettings();
}

function qualityDPR(q) {
  const dpr = window.devicePixelRatio || 1;
  return q === 'baixa' ? Math.min(dpr, 1) * 0.9 : q === 'media' ? Math.min(dpr, isTouch ? 1.1 : 1.3) : Math.min(dpr, isTouch ? 1.5 : 2);
}
// troca a qualidade sem sair do jogo: resolução e sombras mudam na hora; texturas e grama na próxima abertura
function applyQuality() {
  const q = G.settings.quality, sh = q !== 'baixa';
  G.baseDPR = qualityDPR(q);
  renderer.setPixelRatio(G.baseDPR * (G.dprScale || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.type = q === 'alta' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.enabled !== sh || sun.castShadow !== sh) {
    renderer.shadowMap.enabled = sh; sun.castShadow = sh;
    scene.traverse(o => { const m = o.material; if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; });
  }
  const sz = q === 'alta' ? (isTouch ? 1024 : 2048) : isTouch ? 768 : 1024;
  if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}
function initRenderer() {
  autoQuality();
  // anisotropia ajustada depois que o renderer existir
  const q = G.settings.quality;
  const canvas = $('c');
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: q === 'alta', powerPreference: 'high-performance' });
  } catch (e) {
    $('errorBox').textContent = 'Seu navegador não conseguiu iniciar o WebGL. Ative a aceleração de hardware no Chrome e tente de novo.';
    $('errorBox').classList.remove('hidden');
    throw e;
  }
  // no celular a tela já é pequena: resolução um pouco menor pesa bem menos e quase não se nota
  G.baseDPR = qualityDPR(q);
  G.dprScale = 1;
  renderer.setPixelRatio(G.baseDPR);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = q !== 'baixa';
  renderer.shadowMap.type = q === 'alta' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb9d0e3, 90, 520);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 1500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  hemi = new THREE.HemisphereLight(0xdcecff, 0x5d6b3e, 0.55);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d8, 2.9);
  sun.castShadow = renderer.shadowMap.enabled;
  const sz = q === 'alta' ? (isTouch ? 1024 : 2048) : isTouch ? 768 : 1024;
  sun.shadow.mapSize.set(sz, sz);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
  sun.shadow.camera.layers.enable(1); // sombras das árvores próximas (camada 1)
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  G.sunDir = new V3(-0.55, 1, 0.42).normalize();

  TX.aniso = Math.min(q === 'baixa' ? 2 : isTouch ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  // texturas das armas e skins menores no celular (menos memória e carregamento mais rápido)
  if (isTouch || q !== 'alta') for (const k of ['gunMetal', 'gunWood', 'skinGold']) TX.SIZE[k] = q === 'baixa' ? 256 : 512;
  // sombras no celular: redesenhadas a cada 2 quadros (o sol quase não muda de um quadro para o outro)
  if (isTouch) renderer.shadowMap.autoUpdate = false;
  if (q === 'alta') for (const k of ['ground', 'plaster', 'roof', 'wood', 'stone', 'metal', 'plain']) TX.SIZE[k] = Math.min(1024, (TX.SIZE[k] || 256) * 2);
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
  const ch = CH.make(pal, isPlayer);
  // skins: o jogador usa as dele; alguns bots aparecem com skins para a ilha ficar mais viva
  let wallSkin = '';
  const vf = isPlayer && typeof ACC !== 'undefined' && ACC.p ? ACC.tier(ACC.p) : '';
  if (isPlayer && typeof ACC !== 'undefined' && ACC.p) { ch.skins = ACC.gunSkins(); wallSkin = ACC.wallSkin(); }
  else if (!isPlayer && Math.random() < 0.3) {
    const ids = Object.keys(WPN.SKINS), sk = ids[Math.floor(Math.random() * ids.length)];
    ch.skins = { [WPN.SKINS[sk].gun]: sk };
    if (Math.random() < 0.5) { const ws = Object.keys(WALL_SKINS); wallSkin = ws[Math.floor(Math.random() * ws.length)]; }
  }
  scene.add(ch.root);
  return {
    name: name, ch: ch, isPlayer: isPlayer, wallSkin: wallSkin, vf: vf,
    pos: new V3(), vel: new V3(), vy: 0, onGround: true, face: 0, phase: 'plane', hs: 20, vdown: 12, board: true,
    hp: 200, maxHp: 200, armor: 0, helmet: 0, alive: true,
    slots: [null, null, null], cur: 3, nadeHand: false,
    reloadT: 0, fireCd: 0, lastFire: -9,
    gel: isPlayer ? 2 : 1, wallCd: 0, kits: 0, nades: 0, healT: 0, crouch: false,
    kills: 0, dmgDealt: 0, aim: 0, speed: 0, lastHurt: -9, lastAttacker: null, landT: 0,
    revives: isPlayer ? 1 : 0, respawnT: 0, rsWait: 0,
  };
}

function curSlot(a) { return a.cur < 3 ? a.slots[a.cur] : null; }
function curW(a) { const s = curSlot(a); return s ? WEAPONS[s.id] : null; }
function weaponName(a) { if (a.nadeHand) return 'Granada'; const s = curSlot(a); return s ? WEAPONS[s.id].short : 'Soco'; }
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
  const entry = { id: id, mag: mag === undefined ? w.mag : mag, reserve: reserve === undefined ? w.res : reserve };
  let idx;
  if (w.secondary) idx = 2;
  else if (!a.slots[0]) idx = 0;
  else if (!a.slots[1]) idx = 1;
  else idx = a.cur < 2 ? a.cur : 0;
  const old = a.slots[idx];
  a.slots[idx] = entry;
  a.cur = idx; a.nadeHand = false; a.reloadT = 0;
  a.ch.drawT = 0.38;
  refreshGuns(a);
  return old;
}

function selectSlot(a, i) {
  if (a.phase !== 'ground') return;
  if (i !== 3 && !a.slots[i]) { if (a.isPlayer) toast('Slot ' + (i + 1) + ' vazio'); return; }
  a.cur = i; a.nadeHand = false; a.reloadT = 0; a.fireCd = Math.max(a.fireCd, 0.25);
  a.ch.drawT = 0.32;
  if (a.isPlayer) SND.play('reload', 0.5);
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
const _aura = new V3(), _auraV = new V3(0, 0.6, 0);
const _sd = new V3(), _mz = new V3(), _nrm = new V3(), _ej = new V3();
const SHOT_SND = { rifle: 'shot', smg: 'smg', sniper: 'sniper', shotgun: 'shotgun', pistol: 'pistol', lmg: 'shot', blaster: 'laser' };
function fireGun(a, o, d, spread) {
  const s = curSlot(a), w = WEAPONS[s.id], skFx = a.ch.skins && WPN.SKINS[a.ch.skins[s.id]] && WPN.SKINS[a.ch.skins[s.id]].fx;
  s.mag--; a.fireCd = w.cd * (a.isPlayer ? 1 : 1.15); a.lastFire = G.time;
  a.ch.recoil = Math.min(1.4, a.ch.recoil + (w.type === 'shotgun' || w.type === 'sniper' || w.type === 'blaster' ? 1.4 : 0.6));
  const n = w.pellets || 1;
  const sum = new Map();
  a.ch.muzzle.getWorldPosition(_mz);
  const pd = a.pos.distanceTo(G.player.pos);
  const near = a.isPlayer || pd < 60;
  let first = null;
  const ends = [];
  for (let i = 0; i < n; i++) {
    const sp = spread + (n > 1 ? w.spread : 0);
    _sd.set(d.x + (Math.random() - 0.5) * sp * 2, d.y + (Math.random() - 0.5) * sp * 2, d.z + (Math.random() - 0.5) * sp * 2).normalize();
    const res = traceShot(o, _sd, w.range, a);
    if (!first) first = res;
    ends.push(res.point);
    if (a.isPlayer || pd < 140) { FX.tracer(_mz, res.point); if (skFx && i === 0) FX.glow(res.point, skFx, 0.9, 0.16, null, 0); }
    if (res.actor) {
      const dmg = hitDamage(res.actor, w, res.head) * (a.isPlayer ? 1 : G.botDmgScale);
      const prev = sum.get(res.actor) || { dmg: 0, head: false, point: res.point };
      prev.dmg += dmg; prev.head = prev.head || res.head;
      sum.set(res.actor, prev);
      if (near) FX.impact(res.point, _nrm.copy(_sd).negate(), 'actor');
    } else if (res.env) {
      if (res.env.kind === 'wall') {
        damageWall(res.env.col.wall, w.dmg, res.point, _sd);
        if (a.isPlayer) { FX.number(res.point, w.dmg); hitMarker(false); }
      } else if (near) {
        const kind = res.env.kind;
        const col = kind === 'terrain' ? (W.sand(res.point.x, res.point.z) > 0.5 ? 0xe2cb95 : 0x8fbf5a) : 0xe8dcc0;
        FX.impact(res.point, W.hitNormal(res.env, res.point, _nrm), kind, col);
      }
    }
  }
  if (NET.live && (a.isPlayer || NET.isHost())) NET.onShot(a, o, ends, s.id);
  for (const [t, h] of sum) {
    if (a.isPlayer) {
      FX.number(h.point, Math.round(h.dmg * (1 - VEST_RED[t.armor])), h.head ? '#ff8a1c' : '#ff3f6e');
      hitMarker(h.head);
    }
    damageActor(t, h.dmg, a, h.head);
  }
  // blaster: explosão de energia no ponto atingido
  if (w.splash && first) {
    const p = first.point;
    FX.shock(p, 3); FX.sprite(p, 0xff8a1c, 1.6, 0.35, null, 1.2, 0.9);
    for (let i = 0; i < 8; i++) FX.glow(p, i % 2 ? 0xffb347 : 0xff6a1c, 0.2, 0.35, { x: (Math.random() - 0.5) * 6, y: Math.random() * 4, z: (Math.random() - 0.5) * 6 }, 10);
    for (const t of G.actors) {
      if (!t.alive || t === a || t.phase !== 'ground' || sum.has(t)) continue;
      const dd = t.pos.distanceTo(p);
      if (dd < w.splash) damageActor(t, 40 * (1 - dd / w.splash) * (a.isPlayer ? 1 : G.botDmgScale), a, false);
    }
  }
  if (near) {
    FX.muzzle(_mz, w.type === 'shotgun' || w.type === 'sniper' || w.type === 'lmg', skFx || w.glow || 0xffffff);
    if (w.type !== 'blaster' && w.type !== 'shotgun' || Math.random() < 0.5) {
      a.ch.eject.getWorldPosition(_ej);
      FX.casing(_ej, _nrm.set(-Math.cos(a.face), 0, Math.sin(a.face)));
    }
  }
  if (a.isPlayer) { SND.play(SHOT_SND[w.type] || 'shot'); if (navigator.vibrate && G.settings.vibra && w.type !== 'smg') try { navigator.vibrate(12); } catch (e) { /* ok */ } }
  else if (pd < 90) SND.play('shotFar', U.clamp(1 - pd / 90, 0.05, 0.6));
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
  if (G.wait) return; // sala de espera: os tiros não machucam
  if (attacker && attacker !== a && CS.ally(attacker, a)) return; // sem fogo amigo no Contra Squad
  // no multiplayer o cliente só avisa o anfitrião dos acertos que ele mesmo fez
  if (NET.isClient()) {
    if (attacker === G.player && a !== G.player) NET.send({ t: 'hit', i: G.actors.indexOf(a), d: Math.round(dmg * 10) / 10, h: head ? 1 : 0, w: weapon || weaponName(attacker) });
    return;
  }
  const real = dmg * (1 - VEST_RED[a.armor]);
  a.hp -= real;
  a.lastHurt = G.time;
  a.ch.flash = 0.08;
  if (attacker) { a.lastAttacker = attacker; attacker.dmgDealt += real; }
  if (a.healT > 0) a.healT = 0;
  if (a.isPlayer) {
    if (G.time - (G.lastHitNote || -9) > 4) { G.lastHitNote = G.time; notify('hit', 'Você foi atingido!'); }
    if (navigator.vibrate && G.settings.vibra) try { navigator.vibrate(30); } catch (e) { /* ok */ }
    G.vignette = Math.min(1, G.vignette + 0.35);
    if (attacker) G.hurtDir = Math.atan2(attacker.pos.x - a.pos.x, attacker.pos.z - a.pos.z);
  }
  NET.onDamage(a, real, attacker);
  if (a.hp <= 0) killActor(a, attacker, weapon || (attacker ? weaponName(attacker) : 'Zona'));
}

function killActor(a, killer, weapon) {
  a.hp = 0; a.alive = false;
  a.vel.set(0, 0, 0);
  if (killer && killer !== a && !killer.isPlayer && !killer.human && Math.random() < 0.45) { killer.emote = Math.random() < 0.5 ? 'cheer2' : 'laugh'; killer.emoteT = 2.2; }
  if (killer && killer !== a) { killer.kills++; killFeed(killer, a, weapon); if (killer.isPlayer) killBanner(killer.kills, a); }
  if (killer && killer === G.player && killer !== a) countWeaponKill(weapon);
  else killFeed(a, null, 'Zona');
  // mochila caída com o que a pessoa carregava (como no vídeo)
  if (G.mode === 'cs') { NET.onKill(a, killer, weapon); return; } // as rodadas cuidam do fim
  if (a.phase === 'ground') dropBag(a);
  // renascimento: jogadores (não os bots) voltam uma vez por partida no Battle Royale
  const revive = G.mode !== 'cs' && a.revives > 0 && (a.isPlayer || a.human);
  if (revive) { a.revives--; a.respawnT = RESPAWN_T; a.rsWait = RESPAWN_T + 12; }
  NET.onKill(a, killer, weapon);
  if (revive) { if (a.isPlayer) bigText('VOCÊ CAIU! VAI RENASCER'); return; }
  if (a.isPlayer) TEAM.onPlayerOut();
  TEAM.check();
}

// abates por arma do jogador deste aparelho (vai para o ranking por arma)
function countWeaponKill(weapon) {
  const p = G.player, k = String(weapon || 'Soco').toUpperCase();
  p.wk = p.wk || {};
  p.wk[k] = (p.wk[k] || 0) + 1;
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
  const pg = WPN.prop('bag', 1.15);
  if (pg) {
    // mochila caída de costas no chão
    const g = new THREE.Group(), m = new THREE.Mesh(pg, WPN.propMat());
    m.rotation.x = -Math.PI / 2 + 0.12; m.position.y = 0.12; m.castShadow = true;
    g.add(m);
    return g;
  }
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

// quem está esperando o renascimento ainda conta como vivo
function aliveCount() { let n = 0; for (const a of G.actors) if (a.alive || a.rsWait > 0) n++; return n; }

const RESPAWN_T = 6;
// contagem do renascimento do jogador deste aparelho
// (rsWait: quanto tempo os outros esperam alguém renascer; se a pessoa sair do jogo, para de contar como viva)
function updateRespawn(dt) {
  for (const a of G.actors) if (!a.alive && a.rsWait > 0) a.rsWait -= dt;
  const p = G.player;
  if (!p || p.alive || !(p.respawnT > 0)) return;
  const before = Math.ceil(p.respawnT);
  p.respawnT -= dt;
  const n = Math.ceil(p.respawnT);
  if (n !== before && n > 0 && n <= 5) bigText('RENASCENDO EM ' + n);
  if (p.respawnT <= 0) respawnActor(p);
}
// volta caindo de paraquedas num ponto seguro dentro da zona, só com uma pistola
function respawnActor(a) {
  const z = G.zone;
  const cx = z.waiting ? z.toX : z.cx, cz = z.waiting ? z.toZ : z.cz, r = Math.max(4, (z.waiting ? z.toR : z.r) * 0.6);
  let x = cx, zz = cz;
  for (let i = 0; i < 30; i++) {
    const an = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r;
    const tx = cx + Math.cos(an) * d, tz = cz + Math.sin(an) * d;
    if (W.height(tx, tz) > 0.4 && W.coastK(tx, tz) < W.LAND_R - 12) { x = tx; zz = tz; break; }
  }
  a.alive = true; a.respawnT = 0; a.rsWait = 0; a.hp = a.maxHp; a.armor = 0; a.helmet = 0;
  a.slots = [null, null, null]; a.cur = 3; a.nadeHand = false; a.reloadT = 0; a.healT = 0;
  a.kits = 1; a.gel = 2; a.nades = 0; a.emote = null; a.aimOn = false; a.crouch = false;
  giveWeapon(a, 'PISTOLA', 12, 36);
  a.pos.set(x, W.height(x, zz) + 70, zz); a.vel.set(0, 0, 0); a.vy = 0;
  a.phase = 'fall'; a.board = false; a.hs = 10; a.vdown = 14; a.onGround = false;
  a.ch.root.visible = true;
  if (a.isPlayer) { G.yaw = a.face + Math.PI; G.pitch = -0.6; G.vignette = 0; bigText('SEGUNDA CHANCE!'); notify('ok', 'Você renasceu. Abra o paraquedas e pegue armas!'); }
  NET.onRespawn(a);
}

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

// skins da parede de gel (compradas na loja; cada jogador usa a sua)
const WALL_SKINS = {
  gelo: { name: 'Gel Gelo Cristal', emis: 0x5aa8ff, ei: 0.55, rough: 0.12, metal: 0.05 },
  ouro: { name: 'Gel Ouro Real', emis: 0x3a2400, ei: 0.25, rough: 0.28, metal: 0.85 },
  neon: { name: 'Gel Neon', emis: 0xffffff, ei: 1.5, rough: 0.4, metal: 0.2, pulse: 1 },
  lava: { name: 'Gel Lava', emis: 0xffffff, ei: 1.6, rough: 0.8, metal: 0, pulse: 1 },
  arco: { name: 'Gel Arco-Íris', emis: 0xffffff, ei: 0.3, rough: 0.35, metal: 0.1 },
};
function wallBaseTexture(g, w, h, skin) {
  const R = Math.random;
  if (skin === 'gelo') {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e6f8ff'); gr.addColorStop(0.45, '#8fd2fb'); gr.addColorStop(1, '#2f86d6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // facetas de cristal: triângulos com tons diferentes e arestas claras
    const pts = [];
    for (let i = 0; i < 46; i++) pts.push([R() * w, R() * h]);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i * 7 + 3) % pts.length], c = pts[(i * 13 + 5) % pts.length];
      g.fillStyle = 'rgba(' + (R() < 0.5 ? '255,255,255,' : '20,90,180,') + (0.05 + R() * 0.12) + ')';
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, a = R() * 6.28, l = 20 + R() * 70; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(255,255,255,' + R() * 0.8 + ')'; g.fillRect(R() * w, R() * h, 1.5, 1.5); }
    return;
  }
  if (skin === 'ouro') {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.35, '#f0c24a'); gr.addColorStop(0.7, '#c98d1c'); gr.addColorStop(1, '#7a4c08');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // gravação: arabescos em fileiras e frisos em cima e embaixo
    g.lineWidth = 2.2;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
      const cx = col * 64 + 32 + (row % 2) * 32, cy = 50 + row * 70;
      g.strokeStyle = 'rgba(95,55,5,0.75)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + (k % 2 ? 14 : -14), cy + (k < 2 ? -10 : 10), 12, k * 1.57, k * 1.57 + 3.6); g.stroke(); }
      g.strokeStyle = 'rgba(255,248,200,0.8)';
      g.beginPath(); g.arc(cx, cy, 5, 0, 6.28); g.stroke();
    }
    for (const y of [8, h - 14]) { g.fillStyle = 'rgba(90,50,0,0.6)'; g.fillRect(0, y, w, 6); g.fillStyle = 'rgba(255,245,190,0.7)'; g.fillRect(0, y - 2, w, 2); }
    return;
  }
  if (skin === 'neon') {
    g.fillStyle = '#080b18'; g.fillRect(0, 0, w, h);
    const line = (x0, y0, x1, y1, c, wd) => { g.strokeStyle = c; g.lineWidth = wd; g.shadowColor = c; g.shadowBlur = 12; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    for (let x = 0; x <= w; x += 32) line(x, 0, x, h, 'rgba(38,244,255,0.85)', 2);
    for (let y = 0; y <= h; y += 32) line(0, y, w, y, 'rgba(38,244,255,0.85)', 2);
    for (let i = 0; i < 6; i++) { const y = 16 + Math.floor(R() * 7) * 32; line(0, y, w, y, 'rgba(255,60,240,0.95)', 3); }
    g.shadowBlur = 0;
    return;
  }
  if (skin === 'lava') {
    g.fillStyle = '#1b0f0a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const r = 4 + R() * 18; g.fillStyle = 'rgba(' + (R() < 0.5 ? '0,0,0,' : '70,40,30,') + (0.2 + R() * 0.3) + ')'; g.beginPath(); g.arc(R() * w, R() * h, r, 0, 6.28); g.fill(); }
    g.lineCap = 'round'; g.shadowColor = '#ff6a00'; g.shadowBlur = 14;
    for (let i = 0; i < 9; i++) { g.strokeStyle = R() < 0.5 ? '#ff7a10' : '#ffc040'; drawCrack(g, R() * w, R() * h, R() * 6.28, 90 + R() * 120, 3 + R() * 3, 3); }
    g.shadowBlur = 0;
    const gr = g.createLinearGradient(0, h * 0.75, 0, h);
    gr.addColorStop(0, 'rgba(255,90,0,0)'); gr.addColorStop(1, 'rgba(255,120,0,0.75)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    return;
  }
  if (skin === 'arco') {
    const gr = g.createLinearGradient(0, 0, w, 0);
    ['#ff4d6d', '#ffb238', '#ffe74c', '#5be37d', '#3ec7ff', '#7a6cff', '#ff5ad1', '#ff4d6d'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const gv = g.createLinearGradient(0, 0, 0, h);
    gv.addColorStop(0, 'rgba(255,255,255,0.55)'); gv.addColorStop(0.5, 'rgba(255,255,255,0.1)'); gv.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = gv; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 6;
    for (let i = 0; i < 7; i++) { const x = R() * w; g.beginPath(); g.moveTo(x, h); g.bezierCurveTo(x + 40, h * 0.6, x - 40, h * 0.3, x + 20, 0); g.stroke(); }
    return;
  }
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#eef7ff'); gr.addColorStop(1, '#cfe6fa');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,190,230,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    const x = R() * w, y = R() * h;
    g.moveTo(x, y); g.quadraticCurveTo(x + 30, y + 10, x + 60 + R() * 60, y - 10);
    g.stroke();
  }
  const ge = g.createLinearGradient(0, 0, w, 0);
  ge.addColorStop(0, 'rgba(160,200,240,0.55)'); ge.addColorStop(0.08, 'rgba(160,200,240,0)');
  ge.addColorStop(0.92, 'rgba(160,200,240,0)'); ge.addColorStop(1, 'rgba(160,200,240,0.55)');
  g.fillStyle = ge; g.fillRect(0, 0, w, h);
}
// material de uma parede (textura própria, porque as rachaduras são desenhadas nela)
function makeWallMat(skin) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const g = canvas.getContext('2d');
  const st = skin && Object.prototype.hasOwnProperty.call(WALL_SKINS, skin) ? WALL_SKINS[skin] : null;
  wallBaseTexture(g, 512, 256, st ? skin : '');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = TX.aniso || 4;
  const mat = st ? new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: st.emis, emissiveIntensity: st.ei, roughness: st.rough, metalness: st.metal, envMapIntensity: 1.2 })
    : U.toon({ map: tex, color: 0xffffff, emissive: 0x4a5c70 });
  return { mat, tex, ctx: g, st };
}
// peça de parede inteira (arco + pontas), usada na partida e na vitrine da loja
function wallMesh(mat) {
  if (!wallGeo) buildWallGeo();
  const grp = new THREE.Group();
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
  return grp;
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

function deployWall(owner, towardYaw, fromNet, dist) {
  if (owner.gel <= 0 || owner.wallCd > 0 || !owner.alive || owner.phase !== 'ground') return false;
  owner.gel--; owner.wallCd = 0.8;
  const D = U.clamp(dist || 2.4, 1.2, 6.5);
  if (NET.live && !fromNet && (owner === G.player || NET.isHost())) {
    const m = { t: 'wall', i: G.actors.indexOf(owner), x: owner.pos.x, y: owner.pos.y, z: owner.pos.z, yaw: towardYaw, d: +D.toFixed(2) };
    if (NET.isHost()) NET.bcast(m); else NET.send(m);
  }
  if (!wallGeo) buildWallGeo();
  const fx = -Math.sin(towardYaw), fz = -Math.cos(towardYaw);
  const px = owner.pos.x + fx * D, pz = owner.pos.z + fz * D;
  const cx = px - fx * WALL_R, cz = pz - fz * WALL_R;
  const base = Math.min(W.height(px, pz), W.height(px + fz * 1.5, pz - fx * 1.5), W.height(px - fz * 1.5, pz + fx * 1.5), owner.pos.y);
  const phi0 = Math.atan2(fx, fz);

  const wm = makeWallMat(owner.wallSkin), mat = wm.mat, tex = wm.tex, g = wm.ctx;
  const grp = wallMesh(mat);
  grp.position.set(cx, base, cz);
  grp.rotation.y = phi0;
  grp.scale.y = 0.05;
  scene.add(grp);

  const wall = { owner: owner, grp: grp, mat: mat, tex: tex, ctx: g, st: wm.st, cx: cx, cz: cz, base: base, phi0: phi0, hp: WALL_HP, life: WALL_LIFE, grow: 0, cols: [], dead: false };
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
    if (w.st && w.st.pulse) w.mat.emissiveIntensity = w.st.ei * (0.75 + 0.25 * Math.sin(G.time * 4 + i));
    w.life -= dt;
    if (w.life <= 0) shatterWall(w, null);
  }
}

// ------------------------------------------------------------------ granadas
let nadePair = null;
function nadeMesh() {
  const pg = WPN.prop('nade', 2.0);
  if (pg) { const g = new THREE.Group(); const m = new THREE.Mesh(pg, WPN.propMat()); m.position.y = -0.08; m.castShadow = true; g.add(m); return g; }
  if (!nadePair) nadePair = U.build([
    U.part(new THREE.SphereGeometry(0.11, 10, 8), 0x3f6b2c, U.mat4(0, 0, 0, 0, 0, 0, 1, 1.15, 1), 'radial'),
    U.part(new THREE.BoxGeometry(0.06, 0.06, 0.06), 0xd0d0d0, U.mat4(0, 0.13, 0), 'radial'),
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(nadePair.g, U.toon({ vertexColors: true })));
  g.add(new THREE.Mesh(nadePair.o, U.outlineMat(0.02)));
  return g;
}

function throwNade(a, vel, fromNet) {
  if (a.nades <= 0) return;
  if (NET.live && !fromNet && (a === G.player || NET.isHost())) {
    const m = { t: 'nade', i: G.actors.indexOf(a), p: [a.pos.x, a.pos.y + 1.6, a.pos.z], v: [vel.x, vel.y, vel.z] };
    if (NET.isHost()) NET.bcast(m); else NET.send(m);
  }
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
    n.tr = (n.tr || 0) - dt;
    if (n.tr <= 0 && n.v.lengthSq() > 4) { n.tr = 0.035; FX.trail(n.p); }
    n.m.position.copy(n.p);
    n.m.rotation.x += dt * 8;
    if (n.t <= 0) { explode(n); scene.remove(n.m); G.nades.splice(i, 1); }
  }
}

function explode(n) {
  const p = n.p;
  FX.explosion(p);
  const pd = p.distanceTo(G.player.pos);
  FX.shock(p, 9);
  if (pd < 140) SND.play('boom', U.clamp(1.5 - pd / 70, 0.15, 1.3));
  if (pd < 12) G.shake = 0.35;
  const R = 6.5;
  for (const a of G.actors) {
    if (NET.isClient()) break;
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
// níveis: cinza, azul, roxo
const LVL_TINT = [0, 0xffffff, 0x7fb4ff, 0xc39bff];
function lootPair(type) {
  if (lootGeos[type]) return lootGeos[type];
  if (WPN.props) {
    const lvl = +type.slice(-1);
    const pg = type.indexOf('vest') === 0 ? WPN.prop('vest', 1.1, LVL_TINT[lvl]) : type.indexOf('helm') === 0 ? WPN.prop('helm', 1.4, LVL_TINT[lvl]) :
      type === 'kit' ? WPN.prop('kit', 1.1) : type === 'ammo' ? WPN.prop('ammo', 1.2) : type === 'gel' ? WPN.prop('gel', 1.4) : type === 'gren' ? WPN.prop('nade', 2.6) : null;
    if (pg) return (lootGeos[type] = { g: pg, o: pg, prop: true });
  }
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
const ringGeo = new THREE.RingGeometry(0.45, 0.6, 24).rotateX(-Math.PI / 2);
// Loot desenhado por instâncias: um desenho por tipo de item (e um só para todos os anéis),
// atualizado a cada quadro só para o que está perto do jogador.
const LR = { types: {}, ring: null, max: 48 };
function lootIM(type) {
  let e = LR.types[type];
  if (e) return e;
  e = LR.types[type] = { list: [] };
  const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, LR.max); m.count = 0; m.frustumCulled = false; scene.add(m); e.list.push(m); return m; };
  if (type.indexOf('w:') === 0) {
    const p = WPN.build(type.slice(2), true);
    mk(p.g, WPN.gunMat());
    if (p.glow) mk(p.glow, WPN.glowMat());
  } else { const lp = lootPair(type); mk(lp.g, lp.prop ? WPN.propMat() : lootMat); }
  return e;
}
const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lq2 = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.PI / 2), _lp = new V3(), _ls = new V3(), _lc = new THREE.Color();
const _ly = new V3(0, 1, 0);
function renderLoot(px, pz) {
  if (!LR.beam) {
    // dois planos cruzados com gradiente aditivo: a "coluna de luz" das armas raras para cima
    const bg = new THREE.PlaneGeometry(0.5, 3.2).translate(0, 1.6, 0);
    const b2 = bg.clone().rotateY(Math.PI / 2);
    const beamGeo = U.merge([bg.toNonIndexed(), b2.toNonIndexed()].map(g => { g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; }));
    LR.beam = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ map: U.beamTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }), 120);
    LR.beam.frustumCulled = false; LR.beam.setColorAt(0, _lc.setHex(0xffffff)); scene.add(LR.beam);
  }
  if (!LR.ring) {
    LR.ring = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }), 260);
    LR.ring.frustumCulled = false; scene.add(LR.ring);
    LR.ring.setColorAt(0, _lc.setHex(0xffffff)); // cria a cor por instância antes do primeiro desenho
  }
  for (const k in LR.types) LR.types[k].n = 0;
  let nr = 0, nb = 0;
  const R = G.player && G.player.phase === 'ground' ? 70 : 0;
  for (const it of G.loot) {
    const dx = it.x - px, dz = it.z - pz;
    if (dx * dx + dz * dz > R * R) continue;
    const e = lootIM(it.type);
    if (e.n >= LR.max) continue;
    const near = dx * dx + dz * dz < 2500;
    const bob = near ? Math.sin(it.t * 2.5) * 0.05 : 0;
    _lq.setFromAxisAngle(_ly, near ? it.t * 1.4 : it.t);
    if (it.isWeapon) { _lq.multiply(_lq2); _ls.setScalar(1.45); } else _ls.setScalar(1);
    _lm.compose(_lp.set(it.x, it.y + 0.12 + bob, it.z), _lq, _ls);
    for (const m of e.list) m.setMatrixAt(e.n, _lm);
    e.n++;
    if (nr < 260) {
      _lm.makeTranslation(it.x, it.y + 0.04, it.z);
      LR.ring.setMatrixAt(nr, _lm);
      const rc = it.isWeapon ? WPN.RARITY[WEAPONS[it.type.slice(2)].rarity].hex : LOOT[it.type].ring;
      LR.ring.setColorAt(nr, _lc.setHex(rc));
      nr++;
      if (it.isWeapon && nb < 120) {
        const rar = WEAPONS[it.type.slice(2)].rarity;
        const pulse = 0.75 + Math.sin(it.t * 3) * 0.25;
        _lm.makeScale(1, rar === 'comum' ? 0.45 : rar === 'raro' ? 0.8 : 1.15, 1).setPosition(it.x, it.y, it.z);
        LR.beam.setMatrixAt(nb, _lm); LR.beam.setColorAt(nb, _lc.setHex(rc).multiplyScalar(pulse * (rar === 'comum' ? 0.35 : 0.8)));
        nb++;
      }
    }
  }
  for (const k in LR.types) { const e = LR.types[k]; for (const m of e.list) { m.count = e.n; if (e.n) m.instanceMatrix.needsUpdate = true; } }
  LR.ring.count = nr;
  if (nr) { LR.ring.instanceMatrix.needsUpdate = true; LR.ring.instanceColor.needsUpdate = true; }
  LR.beam.count = nb;
  if (nb) { LR.beam.instanceMatrix.needsUpdate = true; LR.beam.instanceColor.needsUpdate = true; }
}

function spawnLoot(type, x, z, extra, id, yHint) {
  const y = W.groundAt(x, z, (yHint === undefined ? W.height(x, z) : yHint) + 1.0);
  const it = { id: id !== undefined ? id : NET.lootSeq++, type: type, x: x, z: z, y: y, t: Math.random() * 6, extra: extra || null, isWeapon: type.indexOf('w:') === 0 };
  G.loot.push(it);
  if (!G.scattering && id === undefined) NET.onLootAdd(it);
  return it;
}

function scatterLoot(rnd) {
  rnd = rnd || U.rng(Math.floor(Math.random() * 1e9));
  G.scattering = true;
  const table = ['W', 'W', 'W', 'W', 'W', 'W', 'W',
    'vest1', 'vest1', 'vest2', 'helm1', 'helm1', 'helm2', 'kit', 'kit', 'ammo', 'ammo', 'ammo', 'gel', 'gel', 'gren', 'gren'];
  const pick = () => { const t = table[Math.floor(rnd() * table.length)]; return t === 'W' ? 'w:' + WPN.roll(rnd) : t; };
  for (const s of W.lootSpots) if (rnd() < 0.85) spawnLoot(pick(), s[0], s[1], null, undefined, s[2]);
  for (const a of W.areaDefs) {
    for (let i = 0; i < 12; i++) {
      const an = rnd() * 6.28, r = rnd() * a.r * 0.85;
      spawnLoot(pick(), a.x + Math.cos(an) * r, a.z + Math.sin(an) * r);
    }
  }
  for (let i = 0; i < 70; i++) {
    const q = W.randLand(rnd, 14);
    spawnLoot(i % 3 === 0 ? 'w:' + WPN.roll(rnd, true) : pick(), q[0], q[1]);
  }
  G.scattering = false;
}

function lootLabel(it) { return it.isWeapon ? WEAPONS[it.type.slice(2)].name : LOOT[it.type].label; }

function lootUseful(a, it) {
  const t = it.type;
  if (it.isWeapon) return false;
  if (t.indexOf('vest') === 0) return +t.slice(-1) > a.armor;
  if (t.indexOf('helm') === 0) return +t.slice(-1) > a.helmet;
  if (t === 'kit') return a.kits < 5;
  if (t === 'ammo') return a.slots.some(x => x && x.reserve < ammoCap(x.id));
  if (t === 'gel') return a.gel < 8;
  if (t === 'gren') return a.nades < 4;
  return false;
}

// itens que não são arma entram sozinhos ao passar por cima
// mochila: limite de munição guardada por arma (2 vezes a reserva inicial)
const ammoCap = (id) => WEAPONS[id].res * 2;
function bagFull(a) {
  if (!a.isPlayer || G.time - (G.fullT || -9) < 4) return;
  G.fullT = G.time;
  notify('info', 'Mochila cheia! Abra a mochila e largue o que não quer');
}
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
    if (a.kits >= 5) { bagFull(a); return false; } a.kits++; if (a.isPlayer) toast('+1 Kit Médico');
  } else if (t === 'ammo') {
    let any = false;
    const ex = it.extra;
    if (ex && ex.n) {
      // munição largada por alguém: volta a quantidade exata, para a mesma arma (ou a que estiver na mão)
      const s = a.slots.find(x => x && x.id === ex.id) || a.slots.find(x => x);
      if (s && s.reserve < ammoCap(s.id)) { s.reserve = Math.min(ammoCap(s.id), s.reserve + ex.n); any = true; }
    } else for (const s of a.slots) if (s && s.reserve < ammoCap(s.id)) { s.reserve = Math.min(ammoCap(s.id), s.reserve + Math.max(WEAPONS[s.id].mag, Math.round(WEAPONS[s.id].res / 3))); any = true; }
    if (!any) { if (a.slots.some(x => x)) bagFull(a); return false; }
    if (a.isPlayer) toast('+ Munição');
  } else if (t === 'gel') {
    if (a.gel >= 8) { bagFull(a); return false; } const n = (it.extra && it.extra.n) || 2; a.gel = Math.min(8, a.gel + n); if (a.isPlayer) toast('+' + n + ' Gel');
  } else if (t === 'gren') {
    if (a.nades >= 4) { bagFull(a); return false; } a.nades++; if (a.isPlayer) toast('+1 Granada');
  }
  if (a.isPlayer) SND.play('pick');
  return true;
}

function lootColor(it) { return it.isWeapon ? WPN.RARITY[WEAPONS[it.type.slice(2)].rarity].hex : LOOT[it.type].ring; }
function removeLoot(it) {
  if (G.player && Math.abs(it.x - G.player.pos.x) < 30 && Math.abs(it.z - G.player.pos.z) < 30) FX.pickup(new V3(it.x, it.y + 0.3, it.z), lootColor(it));
  const i = G.loot.indexOf(it); if (i >= 0) G.loot.splice(i, 1);
  NET.onLootRemove(it);
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
  if (G.wait) { toast('Os itens valem depois do salto'); return; }
  const it = nearestWeaponLoot(p, 2.2);
  if (!it) return;
  if (NET.isClient()) { NET.requestTake(it); return; }
  const id = it.type.slice(2);
  const old = giveWeapon(p, id, it.extra ? it.extra.mag : undefined, it.extra ? it.extra.reserve : undefined);
  removeLoot(it);
  if (old) spawnLoot('w:' + old.id, p.pos.x + Math.sin(p.face) * 0.8, p.pos.z + Math.cos(p.face) * 0.8, { mag: old.mag, reserve: old.reserve });
  notify('ok', WEAPONS[id].name + ' equipada');
  SND.play('pick');
}

function updateLoot(dt) {
  const px = G.player.pos.x, pz = G.player.pos.z;
  for (const a of G.actors) if (a.dropAt && Math.hypot(a.pos.x - a.dropAt.x, a.pos.z - a.dropAt.z) > 3.5) a.dropAt = null;
  for (let i = G.loot.length - 1; i >= 0; i--) {
    const it = G.loot[i];
    it.t += dt;
    if (G.wait) continue; // na sala de espera ninguém pega os itens do mapa
    for (const a of G.actors) {
      if (!a.alive || a.phase !== 'ground' || a.remote) continue;
      if (it.byHuman && !a.isPlayer && !a.human) continue; // bots não pegam o que um jogador largou
      const dx = a.pos.x - it.x, dz = a.pos.z - it.z;
      if (dx * dx + dz * dz < 1.5 * 1.5 && Math.abs(a.pos.y - it.y) < 1.5) {
        // o que a pessoa largou só volta para a mochila depois que ela sai de perto e volta
        if (a.dropAt && Math.hypot(it.x - a.dropAt.x, it.z - a.dropAt.z) < 3) continue;
        if (NET.isClient()) { if (a === G.player && lootUseful(a, it)) NET.requestTake(it); continue; }
        if (takeLoot(a, it)) { removeLoot(it); break; }
      }
    }
  }
  renderLoot(px, pz);
}

// ------------------------------------------------------------------ zona segura
function initZone() {
  G.zone = { phase: 0, cx: 0, cz: 0, r: 240, fromX: 0, fromZ: 0, fromR: 240, toX: 0, toZ: 0, toR: 240, waiting: true, timer: 0, dps: 1, marked: false };
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
  const maxOff = Math.max(0, Math.min(z.r, 190) - ph.r) * 0.6;
  const a = Math.random() * 6.28, d = Math.random() * maxOff;
  z.toX = U.clamp(z.cx + Math.cos(a) * d, -115, 115);
  z.toZ = U.clamp(z.cz + Math.sin(a) * d, -115, 115);
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
  if (NET.isClient()) {
    // o anfitrião manda a zona; aqui só desenha
  } else if (z.waiting) {
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
    if (NET.isClient()) break;
    if (!a.alive || a.phase !== 'ground') continue;
    if (Math.hypot(a.pos.x - z.cx, a.pos.z - z.cz) > z.r) {
      a.zoneAcc = (a.zoneAcc || 0) + dt;
      if (a.zoneAcc >= 1) {
        a.zoneAcc = 0;
        a.hp -= z.dps; a.lastHurt = G.time;
        NET.onDamage(a, z.dps, null);
        if (a.isPlayer) { G.vignette = Math.min(1, G.vignette + 0.25); FX.number(new V3(a.pos.x, a.pos.y + 2, a.pos.z), z.dps, '#7fc4ff'); }
        if (a.hp <= 0) killActor(a, null, 'Zona');
      }
    } else a.zoneAcc = 0;
  }
}

// ------------------------------------------------------------------ suprimento aéreo
function buildAirdropMesh() {
  const grp = new THREE.Group();
  const cg = WPN.prop('crate', 1);
  const pair = cg ? { g: cg, o: null } : U.build([
    U.part(new THREE.BoxGeometry(1.4, 1.1, 1.4), 0x3e5f8a, U.mat4(0, 0.55, 0), 'radial'),
    U.part(new THREE.BoxGeometry(1.44, 0.18, 1.44), 0xf2a81d, U.mat4(0, 0.85, 0), 'radial'),
    U.part(new THREE.BoxGeometry(1.44, 0.18, 1.44), 0xf2a81d, U.mat4(0, 0.25, 0), 'radial'),
    U.part(new THREE.BoxGeometry(0.2, 1.12, 1.45), 0x2b3f5c, U.mat4(0, 0.55, 0), 'radial'),
  ]);
  const crate = new THREE.Mesh(pair.g, cg ? WPN.propMat() : U.toon({ vertexColors: true }));
  crate.castShadow = true;
  grp.add(crate);
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
  if (NET.isClient()) {
    if (!ad.mesh) return;
    ad.mesh.position.y = ad.y;
    if (ad.state === 'falling') { ad.mesh.rotation.y += dt * 0.3; return; }
    const ch = ad.mesh.userData.chute;
    if (ch.visible) { ch.position.y -= dt * 3; ch.scale.multiplyScalar(1 - dt * 0.8); if (ch.scale.x < 0.2) ch.visible = false; }
    ad.smokeT = (ad.smokeT || 0) + dt;
    if (ad.state === 'landed' || ad.smokeT < 12) { ad.puff = (ad.puff || 0) - dt; if (ad.puff <= 0) { ad.puff = 0.12; FX.smoke(new V3(ad.x, ad.gy + 1.3, ad.z), Math.random() < 0.5 ? 0xff3b30 : 0xe8473c); } }
    return;
  }
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
      ad.col = W.addCollider({ type: 'b', x: ad.x, z: ad.z, hx: 0.7, hz: 0.7, rot: 0, y0: ad.gy, y1: ad.gy + 1.45, walkable: true });
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

function canOpenAirdropBy(a) {
  const ad = G.airdrop;
  return ad.state === 'landed' && a.alive && a.phase === 'ground' && Math.hypot(a.pos.x - ad.x, a.pos.z - ad.z) < 2.8;
}
function canOpenAirdrop() { return canOpenAirdropBy(G.player); }

function openAirdrop(a) {
  const ad = G.airdrop;
  if (ad.state !== 'landed') return;
  if (NET.isClient()) { NET.send({ t: 'open' }); return; }
  ad.state = 'opened'; ad.smokeT = Math.max(ad.smokeT, 6);
  openAirdropGoods(a);
  if (a.isPlayer || a.human) spawnLoot('w:CARABINA', ad.x + 1.6, ad.z), spawnLoot('w:PRECISAO', ad.x - 1.6, ad.z);
  else if (!a.slots[0] || !a.slots[1]) giveWeapon(a, 'CARABINA');
}
function openAirdropGoods(a) {
  a.armor = 3; a.helmet = 3;
  a.kits = Math.min(5, a.kits + 2); a.gel = Math.min(8, a.gel + 3); a.nades = Math.min(4, a.nades + 2);
  if (a.isPlayer) {
    toast('Colete Nv. 3 e Capacete Nv. 3 Equipados');
    setTimeout(() => toast('+2 Kit  +3 Gel  +2 Granada'), 1400);
    SND.play('pick');
  }
}

// ------------------------------------------------------------------ avião e salto
let planeObj = null;
// avião de transporte: fuselagem arredondada (torno), asa alta afinada, 4 turbo-hélices, cauda em T e rampa
function buildPlane() {
  const WHITE = 0xf2f3f0, GRAY = 0xb9bfc6, ORANGE = 0xf28a1e, NAVY = 0x22344f, GLASS = 0x1b2d42, DARK = 0x24272c;
  const P = [];
  const add = (geo, mat) => P.push(U.part(geo, 0xffffff, null, null, mat || 'plain'));
  // pinta por vértice conforme a posição (barriga cinza, faixa laranja, janelas escuras)
  const paint = (geo, fn) => {
    const pos = geo.attributes.position, n = pos.count, c = new Float32Array(n * 3), col = new THREE.Color();
    for (let i = 0; i < n; i++) { col.set(fn(pos.getX(i), pos.getY(i), pos.getZ(i))); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  };
  const partC = (geo, mat) => { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); P.push({ g: g, o: null, mat: mat || 'plain' }); };
  // fuselagem
  const prof = [[0.05, -10.6], [0.4, -10.2], [0.8, -9.2], [1.25, -7.6], [1.7, -5.6], [1.95, -3.6], [2.0, -1], [2.0, 4.2], [1.92, 5.4], [1.7, 6.4], [1.3, 7.2], [0.8, 7.75], [0.3, 8.05], [0.02, 8.12]];
  const fus = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 36).rotateX(Math.PI / 2);
  { const p = fus.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) * 1.08 + (z < -4 ? (-4 - z) * 0.2 : 0)); } }
  partC(paint(fus, (x, y, z) => {
    if (z > 5.6 && y > 0.45 && y < 1.35 && Math.abs(x) < 1.3) return GLASS;
    if (z > -6 && z < 4.6 && y > 0.55 && y < 0.95 && Math.abs(x) > 1.6 && Math.floor((z + 6) / 1.1) % 2 === 0) return GLASS;
    if (y < -0.75 + (z < -4 ? (-4 - z) * 0.2 : 0)) return GRAY;
    if (Math.abs(y - (0.15 + (z < -4 ? (-4 - z) * 0.2 : 0))) < 0.18) return ORANGE;
    if (Math.abs(y - (-0.12 + (z < -4 ? (-4 - z) * 0.2 : 0))) < 0.07) return NAVY;
    return WHITE;
  }), 'metal');
  // carenagens do trem de pouso
  for (const sx of [-1, 1]) partC(paint(new THREE.SphereGeometry(1, 20, 12).scale(0.75, 0.75, 3.4).translate(sx * 1.75, -1.25, 0.6), () => GRAY), 'metal');
  // asa alta, afinando para as pontas, com diedro
  const wing = new THREE.BoxGeometry(30, 0.42, 3.8, 30, 1, 2);
  { const p = wing.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), k = Math.abs(x) / 15; p.setZ(i, p.getZ(i) * (1 - k * 0.45) - k * 0.6); p.setY(i, p.getY(i) * (1 - k * 0.5) + k * 0.55); } }
  partC(paint(wing.translate(0, 1.9, 0.8), (x) => Math.abs(x) > 13.6 ? ORANGE : WHITE), 'metal');
  // motores: nacele, entrada de ar, hélice de 4 pás com cubo (as pás giram em grupos separados)
  const props = [];
  for (const ex of [-8.4, -4.6, 4.6, 8.4]) {
    const k = Math.abs(ex) / 15, ey = 1.9 + k * 0.55 - 0.35, ez = 0.8 - k * 0.6;
    const nac = new THREE.LatheGeometry([[0.05, -2.6], [0.45, -2.2], [0.62, -1], [0.66, 1.2], [0.55, 2.2], [0.3, 2.6]].map(p => new THREE.Vector2(p[0], p[1])), 18).rotateX(Math.PI / 2);
    partC(paint(nac.translate(ex, ey, ez + 1.2), (x, y, z) => z > ez + 2.9 ? DARK : WHITE), 'metal');
    props.push([ex, ey, ez + 3.95]);
  }
  // cauda: deriva alta enflechada e estabilizador em cima (cauda em T), rampa de carga
  const fin = new THREE.BoxGeometry(0.34, 5.2, 3.6, 1, 6, 2);
  { const p = fin.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 2.6, k = y / 5.2; p.setZ(i, p.getZ(i) * (1 - k * 0.45) - k * 1.9); } }
  partC(paint(fin.translate(0, 3.6 + 1.3, -8.4), (x, y) => y > 6.2 ? ORANGE : y > 5.9 ? NAVY : WHITE), 'metal');
  const stab = new THREE.BoxGeometry(11, 0.26, 2.4, 10, 1, 1);
  { const p = stab.attributes.position; for (let i = 0; i < p.count; i++) { const k = Math.abs(p.getX(i)) / 5.5; p.setZ(i, p.getZ(i) * (1 - k * 0.4) - k * 0.7); } }
  partC(paint(stab.translate(0, 7.25, -10.4), (x) => Math.abs(x) > 4.9 ? ORANGE : WHITE), 'metal');
  partC(paint(new THREE.BoxGeometry(2.6, 0.12, 3.6).translate(0, -0.25, -8.2), () => GRAY), 'metal');
  const pack = U.buildBy(P);
  const g = new THREE.Group();
  for (const k in pack.mats) {
    const m = new THREE.Mesh(pack.mats[k], new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.42, envMapIntensity: 1.1 }));
    m.castShadow = true; g.add(m);
  }
  g.userData.props = [];
  const bladeM = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.5, metalness: 0.4 });
  const spinM = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.35, metalness: 0.4 });
  const disc = new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  for (const [x, y, z] of props) {
    const hub = new THREE.Group(); hub.position.set(x, y, z);
    for (let i = 0; i < 4; i++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.9, 0.05).translate(0, 0.95, 0), bladeM);
      bl.rotation.z = i * Math.PI / 2; bl.rotation.y = 0.35; hub.add(bl);
    }
    hub.add(new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 14).rotateX(Math.PI / 2).translate(0, 0, 0.3), spinM));
    hub.add(new THREE.Mesh(new THREE.CircleGeometry(1.95, 28), disc));
    g.add(hub); g.userData.props.push(hub);
  }
  return g;
}

function startDrop(ang, sideK) {
  if (ang === undefined) ang = Math.random() * Math.PI * 2;
  if (sideK === undefined) sideK = Math.random() - 0.5;
  const dir = new V3(Math.cos(ang), 0, Math.sin(ang));
  const side = new V3(-dir.z, 0, dir.x).multiplyScalar(sideK * 70);
  G.drop = { dir: dir, start: dir.clone().multiplyScalar(-560).add(side), speed: 42, alt: 245, t: 0, pos: new V3(), state: 'prep', end: 19 };
  if (!planeObj) { planeObj = buildPlane(); scene.add(planeObj); }
  planeObj.visible = true;
  planeObj.rotation.y = Math.atan2(dir.x, dir.z);
  for (const b of G.bots) b.ai.jumpAt = 5 + Math.random() * 13;
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

// ---------- sala de espera (antes do avião, como no Free Fire) ----------
// Todo mundo aparece numa área do mapa com uma arma para treinar; os tiros não machucam.
// Quando o tempo acaba, as armas somem e todos vão para o avião.
const WAIT_T = 20;
function startWaiting(rnd) {
  const a = W.A[W.MAP.show] || W.areaDefs[0];
  G.wait = { t: WAIT_T, x: a.x, z: a.z, r: Math.max(10, Math.min(a.r * 0.75, 22)) };
  G.drop = { state: 'wait', pos: new V3(), dir: new V3(1, 0, 0), start: new V3(), t: 0 };
  if (planeObj) planeObj.visible = false;
  for (const ac of G.actors) if (!(ac.remote && ac.human) && !(NET.isClient() && !ac.human)) placeWaiting(ac, rnd);
  G.yaw = Math.atan2(G.player.pos.x - G.wait.x, G.player.pos.z - G.wait.z); G.pitch = -0.1;
}
function placeWaiting(ac, rnd) {
  const w = G.wait;
  let x = w.x, z = w.z;
  for (let i = 0; i < 12; i++) {
    const an = rnd() * 6.28, d = 2 + Math.sqrt(rnd()) * w.r;
    x = w.x + Math.cos(an) * d; z = w.z + Math.sin(an) * d;
    if (!W.inHouse(x, z) && W.height(x, z) > 0.2) break;
  }
  ac.pos.set(x, W.groundAt(x, z, 80), z); ac.vel.set(0, 0, 0); ac.vy = 0; ac.onGround = true;
  ac.phase = 'ground'; ac.ch.root.visible = true; ac.ch.root.position.copy(ac.pos);
  ac.face = rnd() * 6.28;
  giveWeapon(ac, 'PISTOLA');
  giveWeapon(ac, PRIMARIES[Math.floor(rnd() * PRIMARIES.length)]);
  selectSlot(ac, 0);
  if (ac.ai) { ac.ai.target = null; ac.ai.wp = null; }
}
function updateWaiting(dt) {
  const w = G.wait;
  w.t -= dt;
  if (w.t > 0) return;
  // fim da espera: limpa tudo e começa o voo
  G.wait = null;
  for (const ac of G.actors) {
    if (ac.remote && ac.human) continue;
    if (NET.isClient() && !ac.human) continue;
    ac.slots = [null, null, null]; ac.cur = 3; ac.nadeHand = false; ac.reloadT = 0; ac.healT = 0;
    ac.hp = ac.maxHp; ac.armor = 0; ac.helmet = 0; ac.nades = 0; ac.kits = 0; ac.gel = ac.isPlayer ? 2 : 1; ac.emote = null;
    ac.kills = 0; ac.dmgDealt = 0; ac.aimOn = false; ac.crouch = false;
    ac.phase = 'plane'; ac.ch.root.visible = false;
    refreshGuns(ac);
    if (ac.ai) { ac.ai.target = null; ac.ai.wp = null; }
  }
  for (const wl of G.walls.slice()) { wl.dead = true; scene.remove(wl.grp); }
  G.walls.length = 0; W.dynamic.length = 0;
  for (const n of G.nades) scene.remove(n.m);
  G.nades.length = 0;
  startDrop(G.dropArgs[0], G.dropArgs[1]);
  TEAM.prepDrop();
  G.yaw = Math.atan2(G.drop.dir.x, G.drop.dir.z) + Math.PI + 1.1; G.pitch = -0.25;
  H.prep.classList.remove('hidden');
  H.waitBox.classList.add('hidden');
  bigText('PARA O AVIÃO!');
}

function updateDrop(dt) {
  const d = G.drop;
  if (G.wait || d.state === 'wait') return;
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
    // bots aliados de um humano pulam logo depois dele; os outros, na hora sorteada
    if (!NET.isClient()) for (const b of G.bots) if (b.phase === 'plane') { const f = TEAM.followJump(b); if (f === true || (f === false && d.t >= b.ai.jumpAt)) jumpOut(b); }
    if (d.t >= d.end) {
      for (const a of G.actors) if (a.phase === 'plane' && !a.remote) jumpOut(a);
      d.state = 'done';
    }
  } else if (d.t > d.end + 20) planeObj.visible = false;
  for (const a of G.actors) if (a.phase === 'plane' && !(a.remote && a.net)) a.pos.copy(d.pos);
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
  const r = Math.hypot(a.pos.x, a.pos.z), lim = (W.LAND_R - 8) * W.shape(Math.atan2(a.pos.z, a.pos.x));
  if (r > lim) { a.pos.x *= lim / r; a.pos.z *= lim / r; }
  const ground = W.groundAt(a.pos.x, a.pos.z, a.pos.y);
  if (a.pos.y - ground < 3) W.collide(a.pos, 0.34, a.pos.y, 1.7);
  if (a.pos.y <= ground) {
    a.pos.y = ground; a.phase = 'ground'; a.vy = 0; a.onGround = true; a.vel.set(0, 0, 0);
    a.landT = G.time; a.ch.landT = 0.3;
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
const _f = new V3(), _r = new V3(), _o = new V3(), _d = new V3(), _m = new V3(), _nv = new V3(), _cv = new V3();

function camForward(out, yaw, pitch) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

function moveActor(a, wantX, wantZ, maxSpeed, dt, jump) {
  // arranca rápido e freia mais rápido ainda: resposta imediata no controle
  const k = wantX || wantZ ? 17 : 24;
  a.vel.x = U.damp(a.vel.x, wantX * maxSpeed, k, dt);
  a.vel.z = U.damp(a.vel.z, wantZ * maxSpeed, k, dt);
  a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
  W.collide(a.pos, 0.34, a.pos.y, a.crouch ? 1.1 : 1.7);
  const r = Math.hypot(a.pos.x, a.pos.z), lim = W.PLAY_R * W.shape(Math.atan2(a.pos.z, a.pos.x));
  if (r > lim) { a.pos.x *= lim / r; a.pos.z *= lim / r; }
  const ground = W.groundAt(a.pos.x, a.pos.z, a.pos.y);
  if (jump && a.onGround) { a.vy = 6.4; a.onGround = false; a.crouch = false; }
  a.vy -= 19 * dt;
  a.pos.y += a.vy * dt;
  if (a.pos.y <= ground) { if (!a.onGround && a.vy < -4.5) a.ch.landT = 0.25; a.pos.y = ground; a.vy = 0; a.onGround = true; }
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

// Assistência de mira: perto de um inimigo a mira fica mais "pesada" (fricção) e, atirando ou
// mirando, puxa de leve para o peito dele. Devolve o fator de sensibilidade.
const _aa = new V3(), _af = new V3();
function aimAssist(p, dt) {
  const w = curW(p);
  if (!G.settings.aimAssist || !w || p.nadeHand || p.phase !== 'ground') { G.aaTarget = null; return 1; }
  camForward(_af, G.yaw, G.pitch);
  const eye = camera.position;
  let best = null, bestS = 1;
  for (const a of G.actors) {
    if (a === p || !a.alive || a.phase !== 'ground' || CS.ally(a, p)) continue;
    _aa.set(a.pos.x - eye.x, a.pos.y + (a.crouch ? 0.8 : 1.15) - eye.y, a.pos.z - eye.z);
    const dist = _aa.length();
    if (dist < 1.2 || dist > w.range) continue;
    const ang = Math.acos(U.clamp(_aa.dot(_af) / dist, -1, 1));
    const tol = Math.atan(0.55 / dist) + 0.04;
    const sc = ang / tol;
    if (sc < bestS) { best = a; bestS = sc; }
  }
  if (best && best !== G.aaTarget) { G.aaTarget = best; G.aaVis = -1; }
  if (!best) { G.aaTarget = null; return 1; }
  // linha de visão (checada poucas vezes por segundo)
  if (G.time > G.aaVis) { G.aaVis = G.time + 0.2; actorEye(p, _aa); G.aaSee = visible(eye, _af.set(best.pos.x, best.pos.y + 1.1, best.pos.z)); }
  if (!G.aaSee) return 1;
  const firing = input.fire || G.mouseFire; // puxa só atirando; mirando, só a fricção
  if (firing) {
    const dx = best.pos.x - eye.x, dz = best.pos.z - eye.z, dy = best.pos.y + (best.crouch ? 0.8 : 1.15) - eye.y;
    const yawT = Math.atan2(-dx, -dz), pitchT = Math.atan2(dy, Math.hypot(dx, dz));
    const k = (isTouch ? 4.5 : 1.8) * (1 - bestS * 0.5) * dt;
    G.yaw += U.angDiff(G.yaw, yawT) * Math.min(1, k);
    G.pitch += (pitchT - G.pitch) * Math.min(1, k * 0.7);
  }
  return isTouch ? 0.55 + bestS * 0.3 : 0.8;
}

// ---------- gel com mira (como no Free Fire) ----------
// segura o botão (ou G): aparece a parede transparente; arrastando gira em volta e afasta/aproxima; soltando, o gel sai
let gelGhost = null;
function gelSpot(p, off, dist) {
  const yaw = G.yaw + off, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const px = p.pos.x + fx * dist, pz = p.pos.z + fz * dist;
  const base = Math.min(W.height(px, pz), W.height(px + fz * 1.5, pz - fx * 1.5), W.height(px - fz * 1.5, pz + fx * 1.5), p.pos.y);
  return { x: px - fx * WALL_R, z: pz - fz * WALL_R, base: base, phi: Math.atan2(fx, fz) };
}
function startGelAim(sx, sy) {
  const p = G.player;
  if (!p || !p.alive || p.phase !== 'ground' || G.state !== 'play' || G.gelAim) return;
  if (p.gel <= 0) { toast('Sem Gel'); return; }
  G.gelAim = { off: 0, dist: 2.4, sx: sx || 0, sy: sy || 0 };
  const b = $('btnGel'); if (b) b.classList.add('aiming');
  $('gelHint').classList.remove('hidden');
}
function moveGelAim(x, y) {
  const a = G.gelAim; if (!a) return;
  a.off = U.clamp((x - a.sx) * 0.007, -1.5, 1.5);
  a.dist = U.clamp(2.4 + (a.sy - y) * 0.016, 1.4, 6);
}
function releaseGelAim(cancel) {
  const a = G.gelAim;
  G.gelAim = null;
  const b = $('btnGel'); if (b) b.classList.remove('aiming');
  $('gelHint').classList.add('hidden');
  if (gelGhost) gelGhost.visible = false;
  if (!a || cancel || !G.player) return;
  if (!deployWall(G.player, G.yaw + a.off, false, a.dist) && G.player.gel <= 0) toast('Sem Gel');
}
function updateGelAim(p) {
  if (!G.gelAim) { if (gelGhost) gelGhost.visible = false; return; }
  if (!p.alive || p.phase !== 'ground') { releaseGelAim(true); return; }
  if (!gelGhost) {
    gelGhost = wallMesh(new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.38, depthWrite: false }));
    scene.add(gelGhost);
  }
  const s = gelSpot(p, G.gelAim.off, G.gelAim.dist);
  gelGhost.position.set(s.x, s.base, s.z); gelGhost.rotation.y = s.phi;
  gelGhost.children[0].material.color.setHex(p.wallCd > 0 ? 0xff8a7a : 0x8fd6ff);
  gelGhost.visible = true;
}

// ---------- mochila: largar o que não quer ----------
function dropLoot(p, type, extra) {
  const k = 0.9 + Math.random() * 0.5, an = p.face + (Math.random() - 0.5) * 1.2;
  const x = p.pos.x + Math.sin(an) * k, z = p.pos.z + Math.cos(an) * k;
  if (NET.isClient()) NET.send({ t: 'drop', ty: type, ex: extra || null, x: +x.toFixed(2), z: +z.toFixed(2), y: +p.pos.y.toFixed(2) });
  else spawnLoot(type, x, z, extra || null, undefined, p.pos.y).byHuman = true;
}
function dropItem(what) {
  const p = G.player;
  if (!p || !p.alive || p.phase !== 'ground' || G.wait) { toast('Só dá para largar itens no chão, depois do salto'); return; }
  if (what.indexOf('w:') === 0) {
    const i = +what.slice(2), s = p.slots[i]; if (!s) return;
    p.slots[i] = null;
    if (p.cur === i) { p.cur = p.slots[0] ? 0 : p.slots[1] ? 1 : p.slots[2] ? 2 : 3; p.reloadT = 0; }
    refreshGuns(p);
    dropLoot(p, 'w:' + s.id, { mag: s.mag, reserve: s.reserve });
    toast(WEAPONS[s.id].name + ' largada');
  } else if (what.indexOf('a:') === 0) {
    const s = p.slots[+what.slice(2)]; if (!s || s.reserve <= 0) return;
    const n = s.reserve; s.reserve = 0;
    dropLoot(p, 'ammo', { n: n, id: s.id });
    toast(n + ' balas largadas');
  } else if (what === 'kit' && p.kits > 0) { p.kits--; dropLoot(p, 'kit'); toast('Kit médico largado'); }
  else if (what === 'gren' && p.nades > 0) { p.nades--; if (!p.nades && p.nadeHand) { p.nadeHand = false; refreshGuns(p); } dropLoot(p, 'gren'); toast('Granada largada'); }
  else if (what === 'gel' && p.gel > 0) { const n = Math.min(2, p.gel); p.gel -= n; dropLoot(p, 'gel', { n: n }); toast(n + ' Gel largado'); }
  // pegar de volta só depois de se afastar (senão o item volta na hora)
  p.dropAt = { x: p.pos.x, z: p.pos.z };
}

// ---------- pular a janela ----------
// janela por perto, de frente para ela e com o chão abaixo do peitoril
function nearWindow(p) {
  if (!W.windows || !W.windows.length) return null;
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
  let best = null, bd = 1e9;
  for (const w of W.windows) {
    const dx = p.pos.x - w.x, dz = p.pos.z - w.z;
    if (dx * dx + dz * dz > 4) continue;
    const along = dx * w.nx + dz * w.nz, lat = dx * w.nz - dz * w.nx;
    if (Math.abs(along) > 1.35 || Math.abs(along) < 0.12 || Math.abs(lat) > w.w / 2 - 0.12) continue;
    const feet = w.y - p.pos.y;
    if (feet < 0.35 || feet > 1.5) continue;
    const side = Math.sign(along); // 1 = do lado de fora
    if (fx * -w.nx * side + fz * -w.nz * side < 0.35) continue; // olhando para a janela
    if (Math.abs(along) < bd) { bd = Math.abs(along); best = { w: w, side: side }; }
  }
  return best;
}
function startVault(p, nw) {
  const w = nw.w, s = nw.side;
  const tx = w.x - w.nx * s * 0.95, tz = w.z - w.nz * s * 0.95;
  const ty = W.groundAt(tx, tz, w.y + 0.6);
  p.vault = { t: 0, fx: p.pos.x, fy: p.pos.y, fz: p.pos.z, tx: tx, ty: ty, tz: tz, sill: w.y, face: Math.atan2(-w.nx * s, -w.nz * s) };
  p.aimOn = false; p.inspect = false; p.emote = null; p.reloadT = 0;
  G.nearWin = null;
}
function updateVault(p, dt) {
  const v = p.vault;
  v.t = Math.min(1, v.t + dt / 0.72);
  const k = v.t, h = U.smooth(0, 1, k);
  // sobe até o peitoril, apoia e passa por cima, descendo do outro lado
  const top = v.sill + 0.42;
  const y = k < 0.45 ? U.lerp(v.fy, top, Math.sin(k / 0.45 * Math.PI / 2)) : U.lerp(top, v.ty, Math.pow((k - 0.45) / 0.55, 1.6));
  p.pos.set(U.lerp(v.fx, v.tx, h), y, U.lerp(v.fz, v.tz, h));
  p.vel.set(0, 0, 0); p.vy = 0; p.onGround = false; p.speed = 3;
  p.face = U.dampAngle(p.face, v.face, 18, dt);
  p.ch.body.rotation.y = p.face; p.ch.root.position.copy(p.pos); p.ch.root.visible = true;
  CH.animate(p.ch, dt, { mode: 'ground', speed: 2.5, vx: Math.sin(p.face) * 2.5, vz: Math.cos(p.face) * 2.5, aim: 0, air: true, pitch: 0, crouch: false, armed: false });
  // corpo inclinado para a frente na passada (depois do animate, que zera a inclinação)
  p.ch.body.rotation.x = Math.sin(k * Math.PI) * 0.5;
  if (k >= 1) { p.vault = null; p.pos.y = v.ty; p.onGround = true; p.ch.landT = 0.22; p.ch.body.rotation.x = 0; }
}

// inspecionar a arma (tecla I ou o botão do olho): o personagem gira a arma na frente da câmera
const INSPECT_T = 3.2;
function startInspect(p) {
  const s = curSlot(p);
  if (!s || p.nadeHand || p.reloadT > 0 || p.healT > 0 || p.phase !== 'ground' || G.ads) return;
  p.inspect = true; p.inspT = 0; p.inspId = s.id; p.aimOn = false; p.emote = null;
  SND.play('ui', 0.5);
}

function updatePlayer(dt) {
  const p = G.player;
  if (!p.alive) { CH.animate(p.ch, dt, { dead: true }); return; }
  const ads = isScoped(p);
  const sensK = G.settings.sens * (ads ? scopeSens(curW(p)) * 1.2 / curW(p).zoom : 1) * aimAssist(p, dt);
  if (Math.abs(input.lookX) > 1e-4) G.lookT = G.time;
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
    // girou a câmera: o personagem vira para onde você está olhando (sem a câmera e o corpo brigarem)
    if (G.time - (G.lookT || -9) < 1.2) p.face = U.dampAngle(p.face, G.yaw + Math.PI, 2.2, dt);
    updateAir(p, dt, { mx: mv.mx, my: mv.my, open: open, release: rel });
    // sem mexer na câmera, ela acompanha o rumo devagar
    if (G.time - (G.lookT || -9) >= 1.2) G.yaw = U.dampAngle(G.yaw, p.face + Math.PI, 1.6, dt);
    CH.animate(p.ch, dt, { mode: p.phase, board: p.board });
    return;
  }
  G.pitch = U.clamp(G.pitch, -0.95, 0.8);
  if (CS.frozen()) {
    // escolha da arma: dá para olhar em volta, mas não andar nem atirar
    p.vel.set(0, 0, 0); p.speed = 0;
    p.face = U.dampAngle(p.face, G.yaw + Math.PI, 12, dt);
    p.ch.body.rotation.y = p.face; p.ch.root.position.copy(p.pos); p.ch.root.visible = true;
    CH.animate(p.ch, dt, { mode: 'ground', speed: 0, aim: 0, pitch: 0, armed: !!curSlot(p), gunAt: fpGunAt(p) });
    return;
  }
  // pulando a janela: o movimento é da animação
  if (p.vault) { updateVault(p, dt); return; }
  // correr: Shift segurado ou o botão CORRER (que também mantém o personagem correndo sem segurar o controle)
  const holdRun = keys.ShiftLeft || keys.ShiftRight;
  if (G.sprint && (p.aimOn || p.crouch || mv.my < -0.3)) { G.sprint = false; const rb = $('btnRun'); if (rb) rb.classList.remove('on'); }
  if (G.sprint && Math.hypot(mv.mx, mv.my) < 0.2) mv.my = 1;
  const sprinting = (G.sprint || holdRun) && mv.my > 0.4 && !p.aimOn && !p.crouch && p.healT <= 0 && G.time - p.lastFire > 0.4 && !p.nadeHand;
  const sy = Math.sin(G.yaw), cy = Math.cos(G.yaw);
  const wx = -sy * mv.my + cy * mv.mx, wz = -cy * mv.my - sy * mv.mx;
  if (consume('crouch', 'KeyC')) p.crouch = !p.crouch;
  let maxS = (p.crouch ? 2.6 : 6.2) * (curW(p) && curW(p).slow ? curW(p).slow : 1) * (sprinting ? 1.38 : 1);
  if (p.aimOn) maxS = Math.min(maxS, 3.2);
  if (p.healT > 0) maxS = 2.2;
  // perto de uma janela, pular (Espaço ou o botão PULAR JANELA) passa por ela
  G.nearWin = p.onGround && !p.inspect ? nearWindow(p) : null;
  const jumpNow = consume('jump', 'Space'), vaultNow = consume('vault');
  if (G.nearWin && (vaultNow || jumpNow)) { startVault(p, G.nearWin); updateVault(p, dt); return; }
  moveActor(p, wx, wz, maxS, dt, jumpNow);

  // ações
  p.wallCd -= dt;
  updateGelAim(p);
  if (consume('heal', 'Digit5')) startHeal(p);
  if (consume('use', 'KeyE') || consume('pick', 'KeyF')) {
    if (canOpenAirdrop()) openAirdrop(p); else playerPickup();
  }
  if (consume('reload', 'KeyR')) startReload(p);
  if (consume('inspect', 'KeyI')) { if (p.inspect) p.inspect = false; else startInspect(p); }
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
  // skin com energia: faíscas azuis em volta da arma
  const skS = curSlot(p), skA = skS && p.ch.skins && WPN.SKINS[p.ch.skins[skS.id]];
  if (skA && skA.fx && !p.emote && Math.random() < 0.35) { p.ch.muzzle.getWorldPosition(_aura); _aura.x += (Math.random() - 0.5) * 0.5; _aura.y += (Math.random() - 0.5) * 0.25; _aura.z += (Math.random() - 0.5) * 0.5; FX.glow(_aura, skA.fx, 0.12 + Math.random() * 0.1, 0.45, _auraV, 0); }

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

  // inspecionar: cancela ao atirar, mirar, recarregar, trocar de arma ou correr
  if (p.inspect) {
    p.inspT += dt / INSPECT_T;
    const s = curSlot(p);
    if (p.inspT >= 1 || firing || p.aimOn || p.reloadT > 0 || p.healT > 0 || p.nadeHand || !s || s.id !== p.inspId || p.speed > 4.5 || !p.onGround) p.inspect = false;
  }
  if (p.emote) { p.emoteT -= dt; if (p.emoteT <= 0 || p.speed > 0.6 || firing || !p.onGround || p.aimOn) p.emote = null; }
  const combat = p.aimOn || G.time - p.lastFire < 0.7 || p.nadeHand;
  let target = p.face;
  if (combat || G.settings.look === 'fp') target = G.yaw + Math.PI;
  else if (p.speed > 0.5) target = Math.atan2(p.vel.x, p.vel.z);
  p.face = U.dampAngle(p.face, target, combat ? 26 : 16, dt);
  p.ch.body.rotation.y = p.face;
  p.ch.root.position.copy(p.pos);
  p.ch.root.visible = !isScoped(p);
  CH.animate(p.ch, dt, { mode: 'ground', speed: p.speed, vx: p.vel.x, vz: p.vel.z, aim: combat && curSlot(p) ? Math.max(p.aim, 0.85) : p.aim, air: !p.onGround, pitch: combat || G.settings.look === 'fp' ? G.pitch : 0, crouch: p.crouch, armed: !!curSlot(p) && !p.nadeHand && !p.emote, reload: reloadK(p), emote: p.emote, gunAt: fpGunAt(p), inspect: p.inspect ? p.inspT : 0 });

  // passos: poeirinha e som
  if (p.onGround && p.speed > 2.2) {
    p.stepT = (p.stepT || 0) - dt * p.speed;
    if (p.stepT <= 0) { p.stepT = 2.1; FX.footDust(p.pos, W.sand(p.pos.x, p.pos.z) > 0.5 ? 0xe2cb95 : 0xb9c98a); SND.play('step', 0.5); }
  }
  const area = W.areaAt(p.pos.x, p.pos.z);
  if (area !== G.area) { G.area = area; if (area) areaBanner(area); }
}

// posição da arma na câmera de peito: baixa e à direita, apontando para o centro da tela
const _ga = { p: new V3(), q: new THREE.Quaternion() }, _gaE = new THREE.Euler(0, 0, 0, 'YXZ'), _gaV = new V3();
function fpGunAt(p) {
  if (G.settings.look !== 'fp' || !G.bcPos || !curSlot(p)) return null;
  const w = curW(p), pistol = w && w.secondary;
  _gaE.set(G.pitch, G.yaw + Math.PI, 0);
  _ga.q.setFromEuler(_gaE);
  // eixos da arma: +Z para onde a câmera olha
  _ga.p.copy(G.bcPos).add(_gaV.set(pistol ? -0.1 : -0.15, pistol ? -0.13 : -0.17, pistol ? 0.42 : 0.38).applyQuaternion(_ga.q));
  // pequeno balanço ao andar
  const sp = U.clamp(p.speed / 6, 0, 1);
  _ga.p.y += Math.sin((G.bcBob || 0) * 2) * 0.012 * sp;
  return _ga;
}

// sensibilidade de cada tipo de mira (como nos jogos de celular): 1x, 2x e luneta
function scopeKind(w) { return w.zoom >= 3 ? '4x' : w.zoom >= 1.55 ? '2x' : 'dot'; }
function scopeSens(w) { const k = scopeKind(w), S = G.settings; return k === '4x' ? S.sens4x : k === '2x' ? S.sens2x : S.sensDot; }

// mirando (ADS): visão em primeira pessoa pela mira da arma
function isScoped(p) {
  return p.phase === 'ground' && p.alive && !p.nadeHand && !!curW(p) && p.aim > 0.6 && p.reloadT <= 0;
}

function playerShoot(p) {
  const w = curW(p);
  camForward(_d, G.yaw, G.pitch);
  const scoped = isScoped(p);
  const spread = (scoped ? w.spread * (w.pellets ? 0.7 : 0.15) : w.spread) + (p.speed > 1 ? 0.008 : 0) + (p.onGround ? 0 : 0.03) - (p.crouch ? w.spread * 0.3 : 0);
  _o.copy(camera.position);
  const toP = _m.set(p.pos.x, p.pos.y + 1.4, p.pos.z).sub(_o).dot(_d);
  _o.addScaledVector(_d, Math.max(0, toP));
  fireGun(p, _o, _d, Math.max(0.001, spread));
  const kick = w.type === 'shotgun' ? 0.03 : w.type === 'sniper' ? 0.035 : w.type === 'blaster' ? 0.025 : w.type === 'pistol' ? 0.012 : 0.0045;
  G.pitch += kick + Math.random() * 0.003;
  G.yaw += (Math.random() - 0.5) * 0.004;
  G.shake = Math.max(G.shake || 0, 0.05);
  const s = curSlot(p);
  if (s.mag <= 0 && s.reserve > 0) setTimeout(() => startReload(p), 150);
}

function startReload(a) {
  const s = curSlot(a);
  if (!s || a.reloadT > 0 || s.mag >= WEAPONS[s.id].mag || s.reserve <= 0) return;
  a.reloadT = a.reloadMax = WEAPONS[s.id].type === 'shotgun' ? 2.6 : 1.9;
  if (a.isPlayer) SND.play('reload');
}
function reloadK(a) { return a.reloadT > 0 ? 1 - a.reloadT / (a.reloadMax || 1.9) : 0; }
// personagem dentro do que a câmera enxerga (atualizado uma vez por quadro)
G.frustum = new THREE.Frustum();
const _fs = new THREE.Sphere(new V3(), 1.6), _pm = new THREE.Matrix4();
function updateFrustum() { camera.updateMatrixWorld(); G.frustum.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
function inView(p) { _fs.center.set(p.x, p.y + 0.9, p.z); return G.frustum.intersectsSphere(_fs); }
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
    if (a === G.player && NET.isClient()) NET.send({ t: 'heal' });
    if (a.isPlayer) { notify('ok', 'Vida recuperada: +75'); FX.number(new V3(a.pos.x, a.pos.y + 2, a.pos.z), '+75', '#5dff7a'); }
  }
}

// ------------------------------------------------------------------ bots
function spawnBots(count, rnd) {
  G.bots = [];
  rnd = rnd || Math.random;
  if (count === undefined) count = TOTAL - 1;
  const names = BOT_NAMES.slice().map(n => [rnd(), n]).sort((x, y) => x[0] - y[0]).map(x => x[1]).slice(0, count);
  const off = Math.floor(rnd() * CH.BOT_PALS.length);
  for (let i = 0; i < names.length; i++) {
    const b = makeActor(names[i], CH.BOT_PALS[(i + off) % CH.BOT_PALS.length], false);
    b.ch.root.visible = false;
    // destino do salto: perto de áreas nomeadas ou em qualquer ponto da ilha
    let tx, tz;
    if (rnd() < 0.45) {
      const a = W.areaDefs[Math.floor(rnd() * W.areaDefs.length)];
      const an = rnd() * 6.28, r = rnd() * a.r * 0.8;
      tx = a.x + Math.cos(an) * r; tz = a.z + Math.sin(an) * r;
    } else { const q = W.randLand(rnd, 22); tx = q[0]; tz = q[1]; }
    b.ai = { think: rnd() * 0.3, target: null, react: 0, wp: null, strafe: rnd() < 0.5 ? 1 : -1, strafeT: 0, stuckT: 0, last: new V3(), burst: 3, pause: 0, skill: 0.75 + rnd() * 0.5, land: { x: tx, z: tz }, jumpAt: 99, nadeCd: 10 + rnd() * 20 };
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
  const thr = TEAM.threat(b); // quem está atirando no líder do time
  for (const a of G.actors) {
    if (a === b || !a.alive || a.phase !== 'ground' || CS.ally(a, b)) continue;
    const d = a.pos.distanceTo(b.pos);
    if (d > bd + 25) continue;
    const bias = a === b.lastAttacker && G.time - b.lastHurt < 4 ? 15 : a === thr ? 22 : 0;
    if (d - bias < bd && visible(_e1, _e2.set(a.pos.x, a.pos.y + 1.2, a.pos.z))) { best = a; bd = d - bias; }
  }
  if (best !== ai.target) { ai.target = best; ai.react = (0.45 + Math.random() * 0.5) / ai.skill; }
  if (!hasGun(b)) {
    // primeiro, pegar uma arma
    // longe do líder do time: pega só armas por perto e vai na direção dele
    const fl = TEAM.on() ? TEAM.groundWp(b) : null;
    const it = nearestWeaponLoot(b, fl ? 25 : 70);
    if (it) ai.wp = { x: it.x, z: it.z }; else if (fl) ai.wp = fl;
    if (G.time - b.landT > 16) giveWeapon(b, WPN.roll(null, true));
    return;
  }
  const z = G.zone;
  const zr = z.waiting ? z.toR : z.r;
  let fw = null;
  const zx = z.waiting ? z.toX : z.cx, zz = z.waiting ? z.toZ : z.cz;
  if (G.wait) {
    // sala de espera: anda e treina dentro da área
    const w = G.wait;
    if (!ai.wp || Math.hypot(b.pos.x - ai.wp.x, b.pos.z - ai.wp.z) < 3) { const an = Math.random() * 6.28, d = Math.random() * w.r; ai.wp = { x: w.x + Math.cos(an) * d, z: w.z + Math.sin(an) * d }; }
  } else if (G.mode === 'cs') {
    // avança para o lado do inimigo por caminhos variados
    if (!ai.wp || Math.hypot(b.pos.x - ai.wp.x, b.pos.z - ai.wp.z) < 3) {
      const e = CS.BASE[1 - b.team], k = 0.2 + Math.random() * 0.8;
      ai.wp = { x: e[0] * k + (Math.random() - 0.5) * 20, z: e[1] + (Math.random() - 0.5) * 70 * (1 - k * 0.6) };
    }
  } else if (TEAM.on() && (fw = TEAM.groundWp(b))) {
    // anda junto com o líder do time
    ai.wp = fw;
  } else if (!ai.wp || Math.hypot(b.pos.x - ai.wp.x, b.pos.z - ai.wp.z) < 3 || Math.hypot(ai.wp.x - zx, ai.wp.z - zz) > zr) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * zr * 0.8;
    ai.wp = { x: U.clamp(zx + Math.cos(a) * d, -W.LAND_R + 20, W.LAND_R - 20), z: U.clamp(zz + Math.sin(a) * d, -W.LAND_R + 20, W.LAND_R - 20) };
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
  const f = TEAM.airTarget(b), t = f || b.ai.land;
  const dx = t.x - b.pos.x, dz = t.z - b.pos.z, d = Math.hypot(dx, dz);
  // perto do ponto: segue o rumo do líder (ou mantém o seu) em vez de ficar virando para lá e para cá em volta do ponto
  const want = f && d < 18 ? f.lead.face : d < 10 ? b.face : Math.atan2(dx, dz);
  const turn = U.clamp(U.angDiff(b.face, want) * (d < 18 ? 0.8 : 1.5), -1, 1);
  // seguindo o líder: mesma velocidade de queda que ele, e acelera se ficou para trás
  const my = f ? (d > 25 ? 1 : f.lead.phase === 'fall' && f.lead.hs > 26 ? 1 : 0) : d > 60 ? 1 : d < 20 ? -1 : 0;
  updateAir(b, dt, { mx: -turn, my: my, open: b.phase === 'fall' && (f ? f.open : d < 35), release: false });
}

function updateBot(b, dt) {
  if (b.remote) { updatePuppet(b, dt); return; }
  if (b.phase === 'plane') return;
  const near = b.pos.distanceTo(G.player.pos);
  if (!b.alive) { if (near < 120) CH.animate(b.ch, dt, { dead: true }); return; }
  b.ch.root.visible = near < (b.phase === 'ground' ? 130 : 260);
  CH.setShadow(b.ch, near < 22 && G.settings.quality !== 'baixa');
  CH.setLod(b.ch, near, inView(b.pos));
  if (b.phase === 'fall' || b.phase === 'chute') {
    botAirControl(b, dt);
    if (b.ch.root.visible) CH.animate(b.ch, dt, { mode: b.phase, board: b.board });
    return;
  }
  if (CS.frozen()) {
    b.ch.body.rotation.y = b.face; b.ch.root.position.copy(b.pos);
    if (near < 120) CH.animate(b.ch, dt, { mode: 'ground', speed: 0, aim: 0, pitch: 0, armed: !!curSlot(b) });
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
  if (b.emote) { b.emoteT -= dt; if (b.emoteT <= 0 || t || G.time - b.lastHurt < 0.5) b.emote = null; }
  if (armed && !curSlot(b)) { b.cur = b.slots[0] ? 0 : b.slots[1] ? 1 : 2; refreshGuns(b); }
  if (t) {
    const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 1;
    const ux = dx / dist, uz = dz / dist;
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafeT = 0.8 + Math.random() * 1.4; ai.strafe = -ai.strafe; }
    const w = curW(b);
    const ideal = !armed ? 1.2 : w && w.type === 'shotgun' ? 8 : w && w.type === 'sniper' ? 40 : 18;
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
  if (b.emote) { wx = 0; wz = 0; }
  moveActor(b, wx, wz, speed, dt, ai.jump);
  ai.jump = false;
  b.face = U.dampAngle(b.face, faceT, 10, dt);
  b.ch.body.rotation.y = b.face;
  b.ch.root.position.copy(b.pos);
  // bots longe animam menos vezes por segundo (o celular gasta muito com personagem animado)
  const far = G.settings.quality === 'baixa' ? 80 : 120;
  b.animAcc = (b.animAcc || 0) + dt;
  if (near < far && b.animAcc >= (near < 30 ? 0 : near < 60 ? 0.05 : 0.1)) CH.animate(b.ch, Math.min(b.animAcc, 0.15), { mode: 'ground', speed: b.speed, vx: b.vel.x, vz: b.vel.z, aim: t && armed ? 1 : 0, air: !b.onGround, pitch: 0, armed: !!curSlot(b) && !b.emote, reload: reloadK(b), emote: b.emote });
  if (b.animAcc >= (near < 30 ? 0 : near < 60 ? 0.05 : 0.1)) b.animAcc = 0;
}

function botShoot(b, t, dist) {
  const ai = b.ai;
  ai.burst--;
  const w = curW(b);
  if (ai.burst <= 0) { ai.burst = w.type === 'shotgun' || w.type === 'sniper' || w.type === 'blaster' ? 1 : 3 + Math.floor(Math.random() * 5); ai.pause = 0.45 + Math.random() * 0.7; }
  actorEye(b, _o);
  const head = Math.random() < 0.12;
  _m.set(t.pos.x, t.pos.y + (head ? (t.crouch ? 1.15 : 1.62) : (t.crouch ? 0.7 : 1.0)), t.pos.z);
  _d.copy(_m).sub(_o).normalize();
  const tSpeed = t.speed || 0;
  const err = (0.022 + dist * 0.0011 + (tSpeed > 1 ? 0.022 : 0) + (b.speed > 1 ? 0.012 : 0) + (t.crouch ? 0.01 : 0)) / ai.skill;
  fireGun(b, _o, _d, err);
}


