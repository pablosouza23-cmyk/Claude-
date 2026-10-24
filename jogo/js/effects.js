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
  for (let i = 0; i < 140; i++) {
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
    const g = c.createGain();
    g.connect(c.destination);
    vol = (vol === undefined ? 1 : vol);
    if (type === 'shot' || type === 'shotFar' || type === 'break' || type === 'crack') {
      const src = c.createBufferSource();
      src.buffer = SND.noise;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      const dur = type === 'break' ? 0.45 : type === 'crack' ? 0.06 : 0.11;
      f.frequency.value = type === 'shotFar' ? 900 : type === 'break' ? 5000 : type === 'crack' ? 6000 : 2400;
      src.connect(f); f.connect(g);
      g.gain.setValueAtTime(0.32 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.start(t); src.stop(t + dur);
    } else {
      const o = c.createOscillator();
      o.type = type === 'hit' ? 'square' : 'sine';
      const f0 = { hit: 1400, pick: 660, wall: 240, heal: 520, reload: 320 }[type] || 440;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(type === 'wall' ? 900 : f0 * 1.5, t + 0.12);
      o.connect(g);
      g.gain.setValueAtTime(0.08 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    }
  } catch (e) { /* som é opcional */ }
};
