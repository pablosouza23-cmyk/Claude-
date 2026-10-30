'use strict';
// Efeitos: traçantes, clarão do cano, fumaça, poeira, estilhaços de gelo e números de dano.
const FX = {};

FX.init = function (scene) {
  FX.scene = scene;
  // traçantes: todos num desenho só
  FX.MAXT = 40;
  const tg = new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, 0.5);
  FX.tracerMesh = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), FX.MAXT);
  FX.tracerMesh.count = 0; FX.tracerMesh.frustumCulled = false;
  scene.add(FX.tracerMesh);
  FX.tracers = [];
  // partículas (fumaça, poeira, sangue): um desenho para todas
  FX.smokeP = new FX.Particles(scene, 320, U.smokeTex(), false, 'sprite');
  FX.dotP = new FX.Particles(scene, 160, U.softDot(), false, 'sprite');
  FX.fireP = new FX.Particles(scene, 90, U.fireTex(), true, 'sprite');
  // cubos de gelo (estilhaços)
  FX.MAXS = 320;
  const cg = U.part(new THREE.BoxGeometry(1, 1, 1), 0xffffff, null, 'radial');
  FX.shardMesh = new THREE.InstancedMesh(cg.g, U.toon({ color: 0xeaf6ff, emissive: 0x2a3a4a }), FX.MAXS);
  FX.shardOl = new THREE.InstancedMesh(cg.o || cg.g, U.outlineMat(0.045), FX.MAXS);
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
  FX.tracers.length = 0; FX.tracerMesh.count = 0;
  FX.smokeP.clear(); FX.dotP.clear(); FX.fireP.clear();
  FX.shards.length = 0;
  for (const n of FX.nums) n.el.remove();
  FX.nums.length = 0;
};

// sistema de partículas em arrays (sem objetos por partícula, sem lixo para o coletor)
const _pc = new THREE.Color();
FX.Particles = function (scene, max, map, additive, mode) {
  this.bb = new U.Billboards(max, map, { additive: additive, fog: !additive, order: additive ? 3 : 2 });
  scene.add(this.bb.mesh);
  this.max = max; this.n = 0; this.mode = mode;
  const F = () => new Float32Array(max);
  this.px = F(); this.py = F(); this.pz = F(); this.vx = F(); this.vy = F(); this.vz = F();
  this.life = F(); this.ml = F(); this.size = F(); this.grow = F(); this.a0 = F(); this.r = F(); this.g = F(); this.b = F(); this.grav = F(); this.rot = F();
};
FX.Particles.prototype.clear = function () { this.n = 0; this.bb.begin(); this.bb.end(); };
FX.Particles.prototype.add = function (x, y, z, color, size, life, vx, vy, vz, grow, alpha, grav, rot) {
  let i = this.n;
  if (i >= this.max) { i = Math.floor(Math.random() * this.max); } else this.n++;
  _pc.setHex(color);
  this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx || 0; this.vy[i] = vy || 0; this.vz[i] = vz || 0;
  this.life[i] = this.ml[i] = life; this.size[i] = size; this.grow[i] = grow || 0; this.a0[i] = alpha === undefined ? 1 : alpha;
  this.r[i] = _pc.r; this.g[i] = _pc.g; this.b[i] = _pc.b; this.grav[i] = grav || 0; this.rot[i] = rot || 0;
};
FX.Particles.prototype.update = function (dt) {
  const bb = this.bb; bb.begin();
  let w = 0;
  for (let i = 0; i < this.n; i++) {
    const l = this.life[i] - dt;
    if (l <= 0) continue;
    if (w !== i) {
      this.px[w] = this.px[i]; this.py[w] = this.py[i]; this.pz[w] = this.pz[i]; this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i]; this.vz[w] = this.vz[i];
      this.ml[w] = this.ml[i]; this.size[w] = this.size[i]; this.grow[w] = this.grow[i]; this.a0[w] = this.a0[i];
      this.r[w] = this.r[i]; this.g[w] = this.g[i]; this.b[w] = this.b[i]; this.grav[w] = this.grav[i]; this.rot[w] = this.rot[i];
    }
    this.life[w] = l;
    this.vy[w] -= this.grav[w] * dt;
    this.px[w] += this.vx[w] * dt; this.py[w] += this.vy[w] * dt; this.pz[w] += this.vz[w] * dt;
    const k = l / this.ml[w];
    let sz, a;
    if (this.mode === 'sprite') { sz = this.size[w] * (1 + this.grow[w] * (1 - k)); a = this.a0[w] * k; }
    else if (this.mode === 'glow') { sz = this.size[w] * (0.6 + 0.4 * k); a = k; }
    else { sz = this.size[w]; a = 1; }
    bb.push(this.px[w], this.py[w], this.pz[w], sz, sz, this.rot[w], this.r[w], this.g[w], this.b[w], a);
    w++;
  }
  this.n = w;
  bb.end();
};

const _tq = new THREE.Quaternion(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3(), _tz = new THREE.Vector3(0, 0, 1);
FX.tracer = function (from, to) {
  if (FX.tracers.length >= FX.MAXT) FX.tracers.shift();
  FX.tracers.push({ x: from.x, y: from.y, z: from.z, dx: to.x - from.x, dy: to.y - from.y, dz: to.z - from.z, life: 0.05 });
};

FX.sprite = function (pos, color, size, life, vel, grow, alpha) {
  FX.smokeP.add(pos.x, pos.y, pos.z, color, size, life, vel ? vel.x : 0, vel ? vel.y : 0, vel ? vel.z : 0, grow, alpha === undefined ? 1 : alpha, 0, 0);
};

FX.flash = function (pos) {
  FX.sprite(pos, 0xffd25a, 0.55, 0.05, null, 0, 1);
};

// explosão de granada em estilo desenho: bolas amarelas/laranja + fumaça escura + lascas
// explosão: clarão, bola de fogo, fumaça grossa que sobe, poeira no chão, fagulhas e marca queimada
FX.explosion = function (pos) {
  const R = Math.random, x = pos.x, y = pos.y, z = pos.z;
  FX.flashP.add(x, y + 0.8, z, 0xfff2c8, 7, 0.09, 0, 0, 0, 0, 1, 0, R() * 3);
  for (let i = 0; i < 12; i++) FX.fireP.add(x + (R() - 0.5) * 1.4, y + 0.4 + R() * 1.2, z + (R() - 0.5) * 1.4, i < 5 ? 0xfff0b0 : 0xff8a2a, 1.6 + R() * 1.6, 0.35 + R() * 0.35, (R() - 0.5) * 5, 1.5 + R() * 3, (R() - 0.5) * 5, 1.4, 1, 0, R() * 6);
  for (let i = 0; i < 14; i++) FX.smokeP.add(x + (R() - 0.5) * 2, y + 0.6 + R() * 1.5, z + (R() - 0.5) * 2, i % 3 ? 0x3c3a36 : 0x5a564e, 1.8 + R() * 1.4, 2.6 + R() * 1.6, (R() - 0.5) * 2.4, 1.6 + R() * 2.2, (R() - 0.5) * 2.4, 1.8, 0.8, -0.3, R() * 6);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; FX.smokeP.add(x, y + 0.2, z, 0xb8a888, 1.0, 1.4, Math.cos(a) * 6, 0.4, Math.sin(a) * 6, 2.2, 0.6, 0, R() * 6); }
  for (let i = 0; i < 26; i++) FX.glow(new THREE.Vector3(x, y + 0.5, z), i % 2 ? 0xffd27a : 0xff7a2a, 0.08 + R() * 0.08, 0.6 + R() * 0.6, { x: (R() - 0.5) * 16, y: 4 + R() * 9, z: (R() - 0.5) * 16 }, 14);
  // marca queimada no chão
  if (FX.decalMesh) { if (FX.decals.length >= FX.MAXD) FX.decals.shift(); FX.decals.push({ p: new THREE.Vector3(x, y + 0.03, z), q: new THREE.Quaternion().setFromUnitVectors(_dz, new THREE.Vector3(0, 1, 0)), s: 26 + R() * 8, life: 20 }); FX.decalDirty = true; }
};
// fumacinha atrás da granada no ar
FX.trail = function (pos) { FX.smokeP.add(pos.x, pos.y, pos.z, 0xd8d4cc, 0.22, 0.6, 0, 0.3, 0, 2.2, 0.45, 0, Math.random() * 6); };
// brilho ao pegar um item (cor da raridade)
FX.pickup = function (pos, color) {
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; FX.glow(pos, color, 0.12, 0.5, { x: Math.cos(a) * 2.2, y: 1.5 + Math.random() * 2, z: Math.sin(a) * 2.2 }, 4); }
  FX.glowP.add(pos.x, pos.y + 0.3, pos.z, color, 1.6, 0.25, 0, 0, 0, 0, 1, 0, 0);
};

FX.dust = function (pos, color) {
  for (let i = 0; i < 2; i++)
    FX.smokeP.add(pos.x, pos.y, pos.z, color || 0xd9c69a, 0.4, 0.6, (Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8, 1.6, 0.85, 0, Math.random() * 6);
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
  let nt = 0;
  for (let i = FX.tracers.length - 1; i >= 0; i--) {
    const t = FX.tracers[i];
    t.life -= dt;
    if (t.life <= 0) { FX.tracers.splice(i, 1); continue; }
    _tv.set(t.dx, t.dy, t.dz);
    const len = Math.max(0.1, _tv.length());
    _tq.setFromUnitVectors(_tz, _tv.divideScalar(len));
    FX._m.compose(_ts.set(t.x, t.y, t.z), _tq, FX._s.set(1, 1, len));
    FX.tracerMesh.setMatrixAt(nt++, FX._m);
  }
  FX.tracerMesh.count = nt;
  if (nt) FX.tracerMesh.instanceMatrix.needsUpdate = true;
  FX.smokeP.update(dt); FX.dotP.update(dt); FX.fireP.update(dt);
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
    SND.loadSamples();
  } catch (e) { SND.ctx = null; }
};
// sons gravados (do Fúria Tropical): carregam em segundo plano; enquanto não chegam, vale o som sintetizado
SND.FILES = ['shot_rifle', 'shot_smg', 'shot_sniper', 'shot_shotgun', 'shot_pistol', 'explosion', 'hit', 'headshot', 'kill', 'pickup', 'heal', 'reload', 'empty', 'ui_click', 'step0', 'step1', 'step2', 'chute', 'pump', 'victory', 'defeat', 'zone', 'lobby_music', 'beep', 'beep_go', 'plane', 'engine', 'wind'];
SND.samples = {};
SND.loadSamples = function () {
  for (const n of SND.FILES) {
    fetch(typeof CH !== 'undefined' ? CH.url('assets/sfx/' + n + '.mp3') : 'assets/sfx/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null)
      .then(ab => ab && SND.ctx.decodeAudioData(ab)).then(b => { if (b) SND.samples[n] = b; }).catch(() => {});
  }
};
// toca um som gravado; devolve false se ainda não carregou
SND.voices = 0; SND.lastT = {};
SND.sample = function (n, vol, rate, loop) {
  const c = SND.ctx, b = SND.samples[n];
  if (!c || !b || !SND.on) return false;
  // no máximo 10 sons ao mesmo tempo (6 no celular) e o mesmo som não repete em menos de 45 ms: evita o som embolado e estourado
  const now = c.currentTime, max = typeof isTouch !== 'undefined' && isTouch ? 6 : 10;
  if (!loop && (SND.voices >= max || now - (SND.lastT[n] || -1) < 0.045)) return true;
  SND.lastT[n] = now;
  if (!SND.bus) { SND.bus = c.createDynamicsCompressor(); SND.bus.threshold.value = -16; SND.bus.ratio.value = 6; SND.bus.connect(c.destination); }
  const s = c.createBufferSource(), g = c.createGain();
  if (!loop) { SND.voices++; s.onended = () => { SND.voices--; }; }
  s.buffer = b; s.playbackRate.value = rate || 1; s.loop = !!loop;
  g.gain.value = (vol === undefined ? 1 : vol) * (SND.vol === undefined ? 1 : SND.vol);
  s.connect(g); g.connect(SND.bus); s.start();
  return s;
};
SND.MAP = { shot: 'shot_rifle', smg: 'shot_smg', sniper: 'shot_sniper', shotgun: 'shot_shotgun', pistol: 'shot_pistol', laser: 'shot_smg', shotFar: 'shot_rifle', boom: 'explosion',
  hit: 'hit', head: 'headshot', kill: 'kill', pick: 'pickup', heal: 'heal', reload: 'reload', click: 'empty', ui: 'ui_click', step: 'step', chute: 'chute' };
// por padrão só os tiros e as explosões fazem barulho; o resto (cliques, passos, acertos...) liga nas configurações
SND.SHOTS = { shot: 1, smg: 1, sniper: 1, shotgun: 1, pistol: 1, laser: 1, shotFar: 1, boom: 1 };
SND.play = function (type, vol) {
  const c = SND.ctx;
  if (!c || !SND.on) return;
  if (!SND.SHOTS[type] && !(typeof G !== 'undefined' && G.settings && G.settings.sfx === 'todos')) return;
  // gravação, se já carregou (tiro de longe: mais baixo e mais grave)
  const sm = SND.MAP[type];
  if (sm) {
    const n = sm === 'step' ? 'step' + Math.floor(Math.random() * 3) : sm, far = type === 'shotFar';
    if (far && typeof isTouch !== 'undefined' && isTouch && Math.random() < 0.6) return; // no celular, menos tiros de longe
    if (SND.sample(n, (vol === undefined ? 1 : vol) * (far ? 0.35 : type === 'step' ? 0.5 : 0.8), (far ? 0.8 : 1) * (0.96 + Math.random() * 0.08))) return;
  }
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
  // brilhos aditivos (faíscas) e clarões do cano, cada grupo num desenho só
  FX.glowP = new FX.Particles(scene, 200, U.softDot(), true, 'glow');
  FX.flashP = new FX.Particles(scene, 24, FX.starTex(), true, 'flash');
  // cápsulas de latão
  FX.MAXC = 80;
  const cg = U.part(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 6).rotateZ(Math.PI / 2), 0xd8b04a, null, null, 'gun');
  FX.caseMesh = new THREE.InstancedMesh(cg.g, U.toon({ vertexColors: true, emissive: 0x332200 }), FX.MAXC);
  FX.caseMesh.count = 0; FX.caseMesh.frustumCulled = false;
  scene.add(FX.caseMesh);
  FX.cases = [];
  // marcas de tiro (instanciadas; somem encolhendo)
  FX.MAXD = 60;
  FX.decalMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), FX.MAXD);
  FX.decalMesh.count = 0; FX.decalMesh.frustumCulled = false;
  scene.add(FX.decalMesh);
  FX.decals = [];
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
  FX.glowP.add(pos.x, pos.y, pos.z, color, size, life, vel ? vel.x : 0, vel ? vel.y : 0, vel ? vel.z : 0, 0, 1, grav || 0, 0);
};

// clarão do cano (estrela aditiva girada ao acaso)
FX.muzzle = function (pos, big, color) {
  const s = (big ? 0.9 : 0.55) * (0.8 + Math.random() * 0.4);
  FX.flashP.add(pos.x, pos.y, pos.z, color || 0xffffff, s, 0.05, 0, 0, 0, 0, 1, 0, Math.random() * Math.PI);
  FX.glow(pos, color || 0xffb347, s * 1.6, 0.07, null, 0);
};

FX.casing = function (pos, right) {
  if (FX.cases.length >= FX.MAXC) FX.cases.shift();
  FX.cases.push({ p: pos.clone(), v: new THREE.Vector3(right.x * (1.5 + Math.random()), 2 + Math.random() * 1.2, right.z * (1.5 + Math.random())),
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, 0)), w: new THREE.Vector3(Math.random() * 20, Math.random() * 20, 0), life: 2.2, bounced: 0 });
};

const _dz = new THREE.Vector3(0, 0, 1);
FX.decal = function (pos, normal) {
  if (FX.decals.length >= FX.MAXD) FX.decals.shift();
  const p = pos.clone().addScaledVector(normal, 0.012);
  const q = new THREE.Quaternion().setFromUnitVectors(_dz, normal);
  FX.decals.push({ p: p, q: q, s: 0.7 + Math.random() * 0.6, life: 14 });
  FX.decalDirty = true;
};

// impacto conforme a superfície
FX.impact = function (pos, normal, kind, color) {
  if (kind === 'actor') {
    for (let i = 0; i < 5; i++) FX.glow(pos, i % 2 ? 0xff5a3a : 0xffc04a, 0.12 + Math.random() * 0.1, 0.25, { x: (Math.random() - 0.5) * 3 + normal.x * 2, y: Math.random() * 2.5, z: (Math.random() - 0.5) * 3 + normal.z * 2 }, 9);
    FX.dotP.add(pos.x, pos.y, pos.z, 0x9a1a14, 0.32, 0.22, normal.x * 0.6, 0.2, normal.z * 0.6, 1.6, 0.9, 0, 0);
    FX.smokeP.add(pos.x, pos.y, pos.z, 0x7a1a14, 0.4, 0.35, normal.x * 1.2, 0.4, normal.z * 1.2, 1.8, 0.55, 0, Math.random() * 6);
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
  FX.glowP.update(dt);
  FX.flashP.update(dt);
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
  let nd = 0, fading = false;
  for (let i = FX.decals.length - 1; i >= 0; i--) { const d = FX.decals[i]; d.life -= dt; if (d.life <= 0) { FX.decals.splice(i, 1); FX.decalDirty = true; } else if (d.life < 2) fading = true; }
  if (FX.decalDirty || fading) {
    for (const d of FX.decals) { FX._m.compose(d.p, d.q, s.setScalar(d.s * Math.min(1, d.life / 2))); FX.decalMesh.setMatrixAt(nd++, FX._m); }
    FX.decalMesh.count = nd; FX.decalMesh.instanceMatrix.needsUpdate = true; FX.decalDirty = false;
  }
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
  if (FX.decals) { FX.decals.length = 0; FX.decalMesh.count = 0; }
  if (FX.glowP) { FX.glowP.clear(); FX.flashP.clear(); }
};

// ---------- música do Passinho do Jamal (funk original, sintetizado; 128 BPM) ----------
// toca em loop enquanto o emote estiver rolando; agenda os sons um pouco à frente do relógio do áudio
SND.funk = { on: false, next: 0, step: 0, timer: null, out: null };
SND.musicOn = function (want) {
  const F = SND.funk, c = SND.ctx;
  if (!c || !SND.on) want = false;
  if (want === F.on) return;
  F.on = want;
  if (want) {
    if (c.state === 'suspended') c.resume();
    F.out = c.createGain(); F.out.gain.value = 0.55 * (SND.vol === undefined ? 1 : SND.vol); F.out.connect(c.destination);
    // música escolhida pelo jogador (fica só no aparelho dele); sem ela, o funk sintetizado
    if (SND.custom) return SND.playCustom();
    F.next = c.currentTime + 0.05; F.step = 0;
    F.timer = setInterval(SND.funkTick, 40);
    if (SND.customRaw && !SND.decoding) { SND.decoding = true; c.decodeAudioData(SND.customRaw.slice(0)).then(b => { SND.custom = b; if (F.on && !F.src) { clearInterval(F.timer); F.timer = null; SND.playCustom(); } }).catch(() => { SND.customRaw = null; }); }
  } else {
    clearInterval(F.timer); F.timer = null;
    if (F.src) { try { F.src.stop(); } catch (e) { /* já parou */ } F.src = null; }
    if (F.out) { const o = F.out; o.gain.setTargetAtTime(0, c.currentTime, 0.05); setTimeout(() => o.disconnect(), 400); F.out = null; }
  }
};
SND.funkTick = function () {
  const F = SND.funk, c = SND.ctx, out = F.out;
  if (!F.on || !out) return;
  const st = 60 / 128 / 4;
  const env = (g, t, v, d) => { g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d); };
  const tone = (t, f0, f1, d, v, type) => { const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); env(g, t, v, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02); };
  const noise = (t, d, f, v, type) => { const s = c.createBufferSource(); s.buffer = SND.noise; const fl = c.createBiquadFilter(); fl.type = type || 'highpass'; fl.frequency.value = f; const g = c.createGain(); env(g, t, v, d); s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + d + 0.02); };
  // batida de funk (tamborzão): bumbo, caixa, atabaque e chimbal; baixo 808 e um riff de sintetizador
  const KICK = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0], SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], TOM = [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0];
  const BASS = [55, 0, 0, 55, 0, 0, 65.4, 0, 0, 0, 49, 0, 49, 0, 0, 0], LEAD = [440, 0, 523, 0, 587, 0, 523, 440, 0, 0, 392, 0, 440, 0, 0, 0];
  while (F.next < c.currentTime + 0.15) {
    const t = F.next, i = F.step % 16, bar = Math.floor(F.step / 16) % 4;
    if (KICK[i]) tone(t, 140, 45, 0.28, 0.9);
    if (SNARE[i]) { noise(t, 0.16, 1500, 0.5, 'bandpass'); tone(t, 200, 150, 0.08, 0.25, 'triangle'); }
    if (TOM[i]) tone(t, 260, 180, 0.12, 0.35, 'triangle');
    if (i % 2 === 0) noise(t, 0.04, 7000, 0.12);
    if (BASS[i]) tone(t, BASS[i] * 2, BASS[i], 0.32, 0.5, 'sine');
    if (bar % 2 === 1 && LEAD[i]) { tone(t, LEAD[i], LEAD[i], st * 1.6, 0.07, 'square'); tone(t, LEAD[i] * 2, LEAD[i] * 2, st * 1.2, 0.03, 'sawtooth'); }
    F.next += st; F.step++;
  }
};

SND.playCustom = function () {
  const F = SND.funk, c = SND.ctx;
  F.src = c.createBufferSource(); F.src.buffer = SND.custom; F.src.loop = true; F.src.connect(F.out); F.src.start();
  F.out.gain.value = 0.9 * (SND.vol === undefined ? 1 : SND.vol);
};
// guarda o arquivo no IndexedDB do aparelho
SND.db = function (fn) {
  try { const r = indexedDB.open('battleIslandFiles', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => fn(r.result.transaction('f', 'readwrite').objectStore('f')); } catch (e) { /* sem armazenamento */ }
};
// 1º: arquivo escolhido no aparelho; 2º: assets/musica-jamal.mp3, se o dono do jogo colocar esse arquivo (licenciado) na pasta
SND.db((st) => { const q = st.get('jamal'); q.onsuccess = () => { if (q.result) SND.customRaw = q.result; else SND.bundled(); }; q.onerror = () => SND.bundled(); });
SND.bundled = function () {
  if (SND.customRaw) return;
  try { fetch(typeof CH !== 'undefined' && CH.url ? CH.url('assets/musica-jamal.mp3') : 'assets/musica-jamal.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => { if (ab && ab.byteLength > 1000 && !SND.customRaw) SND.customRaw = ab; }).catch(() => {}); } catch (e) { /* sem arquivo */ }
};
SND.pickJamal = function () {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*,video/mp4';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const ab = await f.arrayBuffer();
    SND.customRaw = ab; SND.custom = null; SND.decoding = false;
    SND.db((st) => st.put(ab, 'jamal'));
    notify('info', 'Música do Passinho do Jamal salva neste aparelho!');
  };
  inp.click();
};
