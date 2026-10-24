'use strict';
// Efeitos: traçantes, clarão do cano, fumaça, poeira, estilhaços de gelo e números de dano.
const FX = {};

FX.init = function (scene) {
  FX.scene = scene;
  // traçantes
  FX.tracers = [];
  const tg = new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, 0.5);
  const tm = new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.9, depthWrite: false });
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(tg, tm);
    m.visible = false; m.frustumCulled = false;
    scene.add(m);
    FX.tracers.push({ m: m, life: 0 });
  }
  // sprites (fumaça, poeira, clarão)
  FX.sprites = [];
  for (let i = 0; i < 240; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.softDot(), transparent: true, depthWrite: false, color: 0xffffff }));
    s.visible = false;
    scene.add(s);
    FX.sprites.push({ s: s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0, a0: 1 });
  }
  // cubos de gelo (estilhaços)
  FX.MAXS = 320;
  const cg = U.part(new THREE.BoxGeometry(1, 1, 1), 0xffffff, null, 'radial');
  FX.shardMesh = new THREE.InstancedMesh(cg.g, U.toon({ color: 0xeaf6ff, emissive: 0x2a3a4a }), FX.MAXS);
  FX.shardOl = new THREE.InstancedMesh(cg.o, U.outlineMat(0.045), FX.MAXS);
  FX.shardMesh.count = 0; FX.shardOl.count = 0;
  FX.shardMesh.frustumCulled = false; FX.shardOl.frustumCulled = false;
  FX.shardMesh.castShadow = true;
  scene.add(FX.shardMesh); scene.add(FX.shardOl);
  FX.shards = [];
  FX.dmgLayer = document.getElementById('dmgLayer');
  FX.nums = [];
  FX._m = new THREE.Matrix4(); FX._q = new THREE.Quaternion(); FX._dq = new THREE.Quaternion();
  FX._v = new THREE.Vector3(); FX._s = new THREE.Vector3(); FX._e = new THREE.Euler();
};

FX.reset = function () {
  for (const t of FX.tracers) { t.life = 0; t.m.visible = false; }
  for (const s of FX.sprites) { s.life = 0; s.s.visible = false; }
  FX.shards.length = 0;
  for (const n of FX.nums) n.el.remove();
  FX.nums.length = 0;
};

FX.tracer = function (from, to) {
  const t = FX.tracers.find(t => t.life <= 0) || FX.tracers[0];
  t.m.position.copy(from);
  t.m.lookAt(to);
  t.m.scale.set(1, 1, Math.max(0.1, from.distanceTo(to)));
  t.m.visible = true;
  t.life = 0.05;
};

FX.sprite = function (pos, color, size, life, vel, grow, alpha) {
  let p = null;
  for (const s of FX.sprites) if (s.life <= 0) { p = s; break; }
  if (!p) return;
  p.s.position.copy(pos);
  p.s.material.color.setHex(color);
  p.s.material.opacity = alpha === undefined ? 1 : alpha;
  p.a0 = p.s.material.opacity;
  p.s.scale.set(size, size, 1);
  p.size = size;
  p.s.visible = true;
  p.life = p.max = life;
  p.vx = vel ? vel.x : 0; p.vy = vel ? vel.y : 0; p.vz = vel ? vel.z : 0;
  p.grow = grow || 0;
};

FX.flash = function (pos) {
  FX.sprite(pos, 0xffd25a, 0.55, 0.05, null, 0, 1);
};

// explosão de granada em estilo desenho: bolas amarelas/laranja + fumaça escura + lascas
FX.explosion = function (pos) {
  const v = (s, up) => ({ x: (Math.random() - 0.5) * s, y: up + Math.random() * s * 0.5, z: (Math.random() - 0.5) * s });
  for (let i = 0; i < 7; i++) FX.sprite(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 1.2, pos.y + 0.6 + Math.random(), pos.z + (Math.random() - 0.5) * 1.2), i < 4 ? 0xffd93a : 0xff9a1f, 2.2 + Math.random() * 1.2, 0.55, v(4, 2), 1.3, 1);
  for (let i = 0; i < 9; i++) FX.sprite(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 2, pos.y + 1, pos.z + (Math.random() - 0.5) * 2), i % 2 ? 0x3a3a3a : 0x55504a, 1.6 + Math.random(), 2.4, v(3, 2.5), 1.6, 0.85);
  for (let i = 0; i < 8; i++) FX.sprite(new THREE.Vector3(pos.x, pos.y + 0.3, pos.z), 0xd9c69a, 1.2, 1.2, v(9, 0.5), 1.2, 0.7);
  FX.sprite(new THREE.Vector3(pos.x, pos.y + 1, pos.z), 0xffffff, 5, 0.12, null, 0.5, 0.9);
};

FX.dust = function (pos, color) {
  for (let i = 0; i < 2; i++)
    FX.sprite(pos, color || 0xd9c69a, 0.35, 0.5, { x: (Math.random() - 0.5) * 0.8, y: 0.6 + Math.random() * 0.5, z: (Math.random() - 0.5) * 0.8 }, 1.4, 0.8);
};

FX.smoke = function (pos, color) {
  FX.sprite(pos, color, 1.6 + Math.random(), 4.5, { x: (Math.random() - 0.5) * 0.6, y: 3 + Math.random() * 1.5, z: (Math.random() - 0.5) * 0.6 }, 1.1, 0.75);
};

FX.shard = function (pos, vel, size, life) {
  if (FX.shards.length >= FX.MAXS) FX.shards.shift();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
  FX.shards.push({ p: pos.clone(), v: vel.clone(), q: q, w: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9), s: size, life: life, max: life });
};

FX.number = function (pos, text, color) {
  const el = document.createElement('div');
  el.className = 'dmg';
  el.textContent = text;
  if (color) el.style.color = color;
  FX.dmgLayer.appendChild(el);
  // empilha levemente como no vídeo
  const p = pos.clone();
  p.x += (Math.random() - 0.5) * 0.5; p.y += Math.random() * 0.4; p.z += (Math.random() - 0.5) * 0.5;
  FX.nums.push({ el: el, p: p, life: 0.9 });
  if (FX.nums.length > 40) { FX.nums[0].el.remove(); FX.nums.shift(); }
};

FX.update = function (dt, camera, W) {
  for (const t of FX.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; }
  for (const p of FX.sprites) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    const k = 1 - p.life / p.max;
    const sc = p.size * (1 + p.grow * k);
    p.s.scale.set(sc, sc, 1);
    p.s.material.opacity = p.a0 * (1 - k);
  }
  // estilhaços com gravidade e quique no chão
  let n = 0;
  const m = FX._m, q = FX._dq, s = FX._s;
  for (let i = FX.shards.length - 1; i >= 0; i--) {
    const c = FX.shards[i];
    c.life -= dt;
    if (c.life <= 0) { FX.shards.splice(i, 1); continue; }
    c.v.y -= 16 * dt;
    c.p.addScaledVector(c.v, dt);
    const gy = W.height(c.p.x, c.p.z) + c.s * 0.5;
    if (c.p.y < gy) {
      c.p.y = gy;
      if (c.v.y < 0) c.v.y *= -0.28;
      c.v.x *= 0.6; c.v.z *= 0.6; c.w.multiplyScalar(0.6);
    }
    FX._e.set(c.w.x * dt, c.w.y * dt, c.w.z * dt);
    q.setFromEuler(FX._e);
    c.q.multiply(q);
    const fade = U.clamp(c.life / 0.5, 0, 1);
    s.setScalar(c.s * fade);
    m.compose(c.p, c.q, s);
    FX.shardMesh.setMatrixAt(n, m);
    FX.shardOl.setMatrixAt(n, m);
    n++;
  }
  FX.shardMesh.count = n; FX.shardOl.count = n;
  FX.shardMesh.instanceMatrix.needsUpdate = true;
  FX.shardOl.instanceMatrix.needsUpdate = true;

  // números de dano projetados na tela
  const w = window.innerWidth, h = window.innerHeight, v = FX._v;
  for (let i = FX.nums.length - 1; i >= 0; i--) {
    const d = FX.nums[i];
    d.life -= dt;
    if (d.life <= 0) { d.el.remove(); FX.nums.splice(i, 1); continue; }
    d.p.y += dt * 0.9;
    v.copy(d.p).project(camera);
    if (v.z > 1) { d.el.style.display = 'none'; continue; }
    d.el.style.display = '';
    d.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-50%) scale(' + (0.8 + Math.min(d.life, 0.2) * 2) + ')';
    d.el.style.opacity = U.clamp(d.life / 0.35, 0, 1);
  }
};

// ---------- som sintetizado (WebAudio) ----------
const SND = { ctx: null, on: true };
SND.init = function () {
  if (SND.ctx || !SND.on) return;
  try {
    SND.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = SND.ctx.sampleRate * 0.5;
    SND.noise = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate);
    const d = SND.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { SND.ctx = null; }
};
SND.play = function (type, vol) {
  const c = SND.ctx;
  if (!c || !SND.on) return;
  try {
    const t = c.currentTime;
    vol = (vol === undefined ? 1 : vol) * (SND.vol === undefined ? 1 : SND.vol);
    const out = c.createGain(); out.connect(c.destination);
    const noise = (dur, freq, q, gain, type2) => {
      const src = c.createBufferSource(); src.buffer = SND.noise;
      const f = c.createBiquadFilter(); f.type = type2 || 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7;
      const g = c.createGain(); g.gain.setValueAtTime(gain * vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 0.02);
    };
    const tone = (f0, f1, dur, gain, wave) => {
      const o = c.createOscillator(); o.type = wave || 'sine';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(gain * vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    };
    switch (type) {
      case 'shot': noise(0.12, 2600, 0.8, 0.32); tone(160, 50, 0.1, 0.35, 'triangle'); break;
      case 'smg': noise(0.08, 3200, 0.8, 0.26); tone(190, 70, 0.07, 0.25, 'triangle'); break;
      case 'sniper': noise(0.5, 1500, 0.6, 0.45); tone(110, 30, 0.35, 0.55, 'triangle'); break;
      case 'shotgun': noise(0.35, 1200, 0.6, 0.5); tone(90, 35, 0.25, 0.5, 'triangle'); break;
      case 'pistol': noise(0.1, 3000, 0.9, 0.28); tone(220, 80, 0.07, 0.22, 'triangle'); break;
      case 'laser': tone(1400, 180, 0.22, 0.18, 'sawtooth'); noise(0.15, 5000, 1, 0.12, 'highpass'); break;
      case 'shotFar': noise(0.14, 900, 0.7, 0.3); break;
      case 'break': noise(0.45, 5000, 0.7, 0.32); tone(80, 30, 0.3, 0.3, 'triangle'); break;
      case 'boom': noise(0.9, 700, 0.5, 0.6); tone(70, 25, 0.7, 0.6, 'triangle'); break;
      case 'crack': noise(0.06, 6000, 1, 0.3, 'highpass'); break;
      case 'shell': tone(4200, 3600, 0.05, 0.05, 'triangle'); break;
      case 'step': noise(0.05, 500, 1.2, 0.06); break;
      case 'hit': tone(1600, 1500, 0.05, 0.08, 'square'); break;
      case 'head': tone(2200, 2000, 0.08, 0.1, 'square'); break;
      case 'kill': tone(880, 880, 0.12, 0.12, 'square'); setTimeout(() => SND.play('kill2', vol), 90); break;
      case 'kill2': tone(1320, 1320, 0.16, 0.12, 'square'); break;
      case 'pick': tone(660, 990, 0.12, 0.09); break;
      case 'wall': tone(240, 900, 0.15, 0.09); break;
      case 'heal': tone(520, 780, 0.15, 0.08); break;
      case 'reload': noise(0.05, 2500, 2, 0.15, 'bandpass'); setTimeout(() => SND.play('click', vol), 650); break;
      case 'click': noise(0.04, 3500, 3, 0.18, 'bandpass'); break;
      case 'ui': tone(700, 900, 0.06, 0.06); break;
      default: tone(440, 660, 0.12, 0.08);
    }
  } catch (e) { /* som é opcional */ }
};

// ---------- efeitos extras: clarão aditivo, faíscas, cápsulas, marcas de tiro, onda de choque ----------
FX.starTex = function () {
  if (FX._star) return FX._star;
  FX._star = U.canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.18, 'rgba(255,220,120,0.95)'); gr.addColorStop(0.45, 'rgba(255,140,30,0.35)'); gr.addColorStop(1, 'rgba(255,80,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,230,160,0.9)';
    for (let i = 0; i < 6; i++) {
      g.save(); g.translate(64, 64); g.rotate(i / 6 * Math.PI * 2);
      g.beginPath(); g.moveTo(0, -5); g.lineTo(62, 0); g.lineTo(0, 5); g.closePath(); g.fill(); g.restore();
    }
  });
  return FX._star;
};

const _fxInit = FX.init;
FX.init = function (scene) {
  _fxInit(scene);
  // sprites aditivos (clarão e faíscas)
  FX.glows = [];
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }));
    s.visible = false; scene.add(s);
    FX.glows.push({ s: s, life: 0, max: 1, v: new THREE.Vector3(), g: 0, size: 1 });
  }
  FX.flashes = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.starTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false; scene.add(s);
    FX.flashes.push({ s: s, life: 0 });
  }
  // cápsulas de latão
  FX.MAXC = 80;
  const cg = U.part(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 6).rotateZ(Math.PI / 2), 0xd8b04a, null, null, 'gun');
  FX.caseMesh = new THREE.InstancedMesh(cg.g, U.toon({ vertexColors: true, emissive: 0x332200 }), FX.MAXC);
  FX.caseMesh.count = 0; FX.caseMesh.frustumCulled = false;
  scene.add(FX.caseMesh);
  FX.cases = [];
  // marcas de tiro
  FX.decals = [];
  const dg = new THREE.CircleGeometry(0.05, 8);
  const dm = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(dg, dm.clone()); m.visible = false; scene.add(m);
    FX.decals.push({ m: m, life: 0 });
  }
  FX.decalIdx = 0;
  // anéis de onda de choque
  FX.rings = [];
  const rg = new THREE.RingGeometry(0.8, 1, 32);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m);
    FX.rings.push({ m: m, life: 0 });
  }
};

FX.glow = function (pos, color, size, life, vel, grav) {
  let p = null;
  for (const s of FX.glows) if (s.life <= 0) { p = s; break; }
  if (!p) return;
  p.s.position.copy(pos); p.s.material.color.setHex(color); p.s.material.opacity = 1;
  p.size = size; p.s.scale.set(size, size, 1); p.s.visible = true;
  p.life = p.max = life; p.v.set(vel ? vel.x : 0, vel ? vel.y : 0, vel ? vel.z : 0); p.g = grav || 0;
};

// clarão do cano (estrela aditiva girada ao acaso)
FX.muzzle = function (pos, big, color) {
  const f = FX.flashes.find(f => f.life <= 0) || FX.flashes[0];
  f.s.position.copy(pos);
  const s = (big ? 0.9 : 0.55) * (0.8 + Math.random() * 0.4);
  f.s.scale.set(s, s, 1);
  f.s.material.rotation = Math.random() * Math.PI;
  f.s.material.color.setHex(color || 0xffffff);
  f.s.visible = true; f.life = 0.05;
  FX.glow(pos, color || 0xffb347, s * 1.6, 0.07, null, 0);
};

FX.casing = function (pos, right) {
  if (FX.cases.length >= FX.MAXC) FX.cases.shift();
  FX.cases.push({ p: pos.clone(), v: new THREE.Vector3(right.x * (1.5 + Math.random()), 2 + Math.random() * 1.2, right.z * (1.5 + Math.random())),
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, 0)), w: new THREE.Vector3(Math.random() * 20, Math.random() * 20, 0), life: 2.2, bounced: 0 });
};

FX.decal = function (pos, normal) {
  const d = FX.decals[FX.decalIdx++ % FX.decals.length];
  d.m.position.copy(pos).addScaledVector(normal, 0.012);
  d.m.lookAt(pos.x + normal.x, pos.y + normal.y, pos.z + normal.z);
  d.m.scale.setScalar(0.7 + Math.random() * 0.6);
  d.m.material.opacity = 0.85;
  d.m.visible = true; d.life = 14;
};

// impacto conforme a superfície
FX.impact = function (pos, normal, kind, color) {
  if (kind === 'actor') {
    for (let i = 0; i < 5; i++) FX.glow(pos, i % 2 ? 0xff5a3a : 0xffc04a, 0.12 + Math.random() * 0.1, 0.25, { x: (Math.random() - 0.5) * 3 + normal.x * 2, y: Math.random() * 2.5, z: (Math.random() - 0.5) * 3 + normal.z * 2 }, 9);
    FX.sprite(pos, 0xff3a2a, 0.35, 0.18, null, 1.5, 0.85);
    return;
  }
  for (let i = 0; i < (kind === 'terrain' ? 2 : 6); i++)
    FX.glow(pos, 0xffd27a, 0.06 + Math.random() * 0.05, 0.25 + Math.random() * 0.15, { x: normal.x * 2.5 + (Math.random() - 0.5) * 3, y: normal.y * 2.5 + Math.random() * 2.5, z: normal.z * 2.5 + (Math.random() - 0.5) * 3 }, 12);
  FX.dust(pos, color);
  if (kind === 'static') FX.decal(pos, normal);
};

FX.footDust = function (pos, color) {
  FX.sprite(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.2, pos.y + 0.05, pos.z + (Math.random() - 0.5) * 0.2), color || 0xd9c69a, 0.28, 0.55, { x: (Math.random() - 0.5) * 0.4, y: 0.35, z: (Math.random() - 0.5) * 0.4 }, 1.8, 0.55);
};

FX.shock = function (pos, size) {
  const r = FX.rings.find(r => r.life <= 0) || FX.rings[0];
  r.m.position.set(pos.x, pos.y + 0.15, pos.z);
  r.size = size || 7; r.life = 0.45; r.m.visible = true;
};

const _fxUpd = FX.update;
FX.update = function (dt, camera, W) {
  _fxUpd(dt, camera, W);
  for (const p of FX.glows) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    p.v.y -= p.g * dt;
    p.s.position.addScaledVector(p.v, dt);
    const k = p.life / p.max;
    p.s.material.opacity = k;
    const s = p.size * (0.6 + 0.4 * k);
    p.s.scale.set(s, s, 1);
  }
  for (const f of FX.flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; }
  let n = 0;
  const m = FX._m, s = FX._s;
  for (let i = FX.cases.length - 1; i >= 0; i--) {
    const c = FX.cases[i];
    c.life -= dt;
    if (c.life <= 0) { FX.cases.splice(i, 1); continue; }
    c.v.y -= 14 * dt;
    c.p.addScaledVector(c.v, dt);
    const gy = W.height(c.p.x, c.p.z) + 0.01;
    if (c.p.y < gy) {
      c.p.y = gy; c.v.y = Math.abs(c.v.y) * 0.3; c.v.x *= 0.5; c.v.z *= 0.5; c.w.multiplyScalar(0.5);
      if (!c.bounced++ && Math.random() < 0.4 && typeof SND !== 'undefined') SND.play('shell', 0.25);
    }
    FX._e.set(c.w.x * dt, c.w.y * dt, 0);
    FX._dq.setFromEuler(FX._e); c.q.multiply(FX._dq);
    s.setScalar(1);
    m.compose(c.p, c.q, s);
    FX.caseMesh.setMatrixAt(n++, m);
  }
  FX.caseMesh.count = n; FX.caseMesh.instanceMatrix.needsUpdate = true;
  for (const d of FX.decals) if (d.life > 0) { d.life -= dt; if (d.life < 2) d.m.material.opacity = 0.85 * d.life / 2; if (d.life <= 0) d.m.visible = false; }
  for (const r of FX.rings) {
    if (r.life <= 0) continue;
    r.life -= dt;
    const k = 1 - r.life / 0.45;
    r.m.scale.setScalar(0.5 + k * r.size);
    r.m.material.opacity = 0.8 * (1 - k);
    if (r.life <= 0) r.m.visible = false;
  }
};

const _fxReset = FX.reset;
FX.reset = function () {
  _fxReset();
  if (FX.cases) FX.cases.length = 0;
  if (FX.decals) for (const d of FX.decals) { d.life = 0; d.m.visible = false; }
};
