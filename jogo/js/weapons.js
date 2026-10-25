'use strict';
// As 10 armas da referência: atributos, raridade, mira (ADS) e modelo 3D de cada uma.
// Eixo da arma: +Z = cano, origem perto do gatilho. sight = centro da janela da mira (para mirar em 1ª pessoa).
const WPN = {};

WPN.RARITY = {
  comum: { label: 'COMUM', color: '#9aa3ad', hex: 0x9aa3ad },
  raro: { label: 'RARO', color: '#3d8bff', hex: 0x3d8bff },
  epico: { label: 'ÉPICO', color: '#b15cff', hex: 0xb15cff },
  lendario: { label: 'LENDÁRIO', color: '#ffb21e', hex: 0xffb21e },
};

// type controla animação/recuo; sight escolhe a retícula; zoom = aproximação ao mirar
WPN.DEF = {
  FUZIL: { name: 'Fuzil de Assalto', short: 'FUZIL', rarity: 'comum', type: 'rifle', dmg: 34, head: 54, cd: 0.11, mag: 30, res: 120, spread: 0.011, range: 160, sight: 'reddot', zoom: 1.6, icon: 'rifle', desc: 'Equilíbrio entre alcance, precisão e poder de fogo.' },
  SMG: { name: 'Submetralhadora', short: 'SMG', rarity: 'comum', type: 'smg', dmg: 26, head: 40, cd: 0.075, mag: 25, res: 100, spread: 0.016, range: 100, sight: 'greendot', zoom: 1.3, icon: 'smg', desc: 'Compacta, leve e letal em curta distância.' },
  PRECISAO: { name: 'Rifle de Precisão', short: 'PRECISÃO', rarity: 'raro', type: 'sniper', dmg: 95, head: 185, cd: 1.15, mag: 5, res: 30, spread: 0.002, range: 260, sight: 'scope', zoom: 4.2, icon: 'sniper', desc: 'Precisão extrema para longas distâncias.' },
  ESCOPETA: { name: 'Escopeta', short: 'ESCOPETA', rarity: 'raro', type: 'shotgun', dmg: 16, head: 22, cd: 0.85, mag: 8, res: 32, spread: 0.06, range: 38, pellets: 8, sight: 'iron', zoom: 1.2, icon: 'shotgun', desc: 'Dano massivo a curta distância.' },
  PISTOLA: { name: 'Pistola', short: 'PISTOLA', rarity: 'comum', type: 'pistol', dmg: 22, head: 35, cd: 0.18, mag: 12, res: 48, spread: 0.012, range: 85, sight: 'pistol', zoom: 1.25, icon: 'pistol', secondary: true, desc: 'Confiável, compacta e sempre útil.' },
  METRALHADORA: { name: 'Metralhadora Leve', short: 'METRALHADORA', rarity: 'epico', type: 'lmg', dmg: 30, head: 46, cd: 0.085, mag: 100, res: 200, spread: 0.02, range: 140, sight: 'cyan', zoom: 1.5, icon: 'lmg', slow: 0.85, desc: 'Alta cadência e grande capacidade de munição.' },
  FUTURISTA: { name: 'Fuzil Futurista', short: 'FUTURISTA', rarity: 'lendario', type: 'rifle', dmg: 38, head: 60, cd: 0.1, mag: 30, res: 120, spread: 0.009, range: 170, sight: 'diamond', zoom: 1.7, icon: 'future', glow: 0x39b6ff, desc: 'Tecnologia de ponta para o campo de batalha.' },
  BLASTER: { name: 'Blaster Experimental', short: 'BLASTER', rarity: 'epico', type: 'blaster', dmg: 70, head: 90, cd: 0.6, mag: 6, res: 24, spread: 0.006, range: 120, sight: 'orange', zoom: 1.4, icon: 'blaster', glow: 0xff8a1c, splash: 2.6, desc: 'Projetado com tecnologia desconhecida.' },
  REVOLVER: { name: 'Revólver', short: 'REVÓLVER', rarity: 'raro', type: 'pistol', dmg: 55, head: 95, cd: 0.5, mag: 6, res: 24, spread: 0.008, range: 110, sight: 'iron2', zoom: 1.3, icon: 'revolver', secondary: true, desc: 'Poder, precisão e estilo clássico.' },
  CARABINA: { name: 'Carabina Tática', short: 'CARABINA', rarity: 'lendario', type: 'rifle', dmg: 38, head: 62, cd: 0.095, mag: 40, res: 160, spread: 0.009, range: 170, sight: 'brackets', zoom: 1.8, icon: 'rifle', desc: 'Moderna, versátil e pronta para qualquer situação.' },
};
WPN.ORDER = ['FUZIL', 'SMG', 'PRECISAO', 'ESCOPETA', 'PISTOLA', 'METRALHADORA', 'FUTURISTA', 'BLASTER', 'REVOLVER', 'CARABINA'];
WPN.PRIMARY = WPN.ORDER.filter(k => !WPN.DEF[k].secondary);
// chance de aparecer no chão
WPN.WEIGHT = { comum: 10, raro: 5, epico: 2.2, lendario: 0.9 };

WPN.cache = {};

// silhuetas para o HUD (viewBox 64x28)
WPN.ICON = {
  rifle: 'M2 11h8l2-2h22l2-2h6v2h12v2h8v3h-8l-2 2h-8l-1 3h-4l-1-3h-3l-3 10h-6l2-10h-3l-3 2v-2H8l-1 2H3z',
  smg: 'M6 10h6l2-2h18l2-2h5v2h11v3h-3v3h-6v4l-2 1-1-5h-5l-2 10h-6l2-10h-4l-3 3h-5l1-3H8z',
  sniper: 'M1 12h10l2-2h14V7h14v3h22v2H41v2H27l-2 2h-3l-2 9h-5l1-9h-5l-3 3H5l2-3H1z',
  shotgun: 'M2 12h12l2-2h46v2H44v2H30l-2 2h-6l-4 7h-6l3-7H6l-4 2z',
  pistol: 'M14 7h32v6H34l-2 2h-5l-3 10h-8l3-10h-5z',
  lmg: 'M2 11h8l2-2h26l2-2h6v2h16v3h-8v2H40l-2 3h-6v4h-8v-4h-3l-3 8h-6l2-8h-3l-3 2v-2H8l-1 2H3z',
  future: 'M2 12l6-4h28l4-3h8l2 3h12v4h-6l-2 3H40l-1 3h-5l-1-3h-3l-4 9h-6l3-9h-4l-4 3H6z',
  blaster: 'M3 10h10l3-3h28l4 3h12v6H48l-3 3H34v5h-9v-5h-3l-3 7h-6l2-7h-3l-2 2H4z',
  revolver: 'M14 8h14l3-2h16v4H31l-1 4h-5l-4 11h-7l3-11h-3l-2-2z',
};

// ---------- modelos 3D (Ultimate Gun Pack da Quaternius, CC0; convertidos no Blender) ----------
// frações medidas no modelo: [de trás para frente, de baixo para cima]
// grip = mão direita no cabo, fore = mão de apoio, top = onde a mira vai montada, sight = mira já do modelo
WPN.MDL = {
  FUZIL: { src: 'AssaultRifle_2', len: 0.88, grip: [0.30, 0.57], fore: [0.67, 0.80], top: [0.45, 0.94], muzzle: 0.84 },
  CARABINA: { src: 'AssaultRifle2_1', len: 0.84, grip: [0.29, 0.53], fore: [0.64, 0.77], top: [0.42, 0.86], muzzle: 0.77, tint: [0.62, 0.62, 0.66] },
  SMG: { src: 'SubmachineGun_3', len: 0.62, grip: [0.46, 0.54], fore: [0.85, 0.55], top: [0.6, 0.98], muzzle: 0.81 },
  PRECISAO: { src: 'SniperRifle_2', len: 1.15, grip: [0.26, 0.40], fore: [0.54, 0.58], sight: [0.27, 0.91], muzzle: 0.72 },
  ESCOPETA: { src: 'Shotgun_2', len: 1.0, grip: [0.29, 0.53], fore: [0.57, 0.62], sight: [0.55, 0.92], muzzle: 0.85 },
  METRALHADORA: { src: 'AssaultRifle2_2', len: 1.0, grip: [0.31, 0.46], fore: [0.67, 0.75], top: [0.45, 0.86], muzzle: 0.76, tint: [0.78, 0.86, 0.66], bipod: [0.9, 0.72] },
  PISTOLA: { src: 'Pistol_1', len: 0.2, grip: [0.15, 0.46], sight: [0.06, 0.97], muzzle: 0.86, pistol: true },
  REVOLVER: { src: 'Revolver_1', len: 0.28, grip: [0.17, 0.56], sight: [0.1, 0.97], muzzle: 0.86, pistol: true },
  FUTURISTA: { src: 'Bullpup_2', len: 0.74, grip: [0.27, 0.48], fore: [0.82, 0.61], top: [0.5, 0.98], muzzle: 0.81, tint: [0.55, 0.7, 1.15], glowLine: [0.3, 0.86, 0.74] },
  BLASTER: { src: 'Bullpup_3', len: 0.75, grip: [0.37, 0.50], fore: [0.68, 0.62], top: [0.5, 0.98], muzzle: 0.88, tint: [0.75, 0.68, 0.62], glowRings: [0.72, 0.95, 0.8] },
};
WPN.models = null; WPN.modelsLod = null;
WPN.load = async function () {
  try {
    WPN.models = await WPN.loadFile('assets/guns.bin');
    try { WPN.modelsLod = await WPN.loadFile('assets/guns_lod.bin'); } catch (e) { WPN.modelsLod = null; }
    WPN.cache = {};
  } catch (e) { console.warn('armas 3D indisponíveis, usando modelos simples', e); }
};
WPN.loadFile = async function (path) {
  {
    const r = await fetch(CH.url(path));
    if (!r.ok) throw new Error('sem ' + path);
    const buf = await r.arrayBuffer(), dv = new DataView(buf), hl = dv.getUint32(4, true);
    const H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)).replace(/[\0 ]+$/, '')), base = 8 + hl;
    const out = {};
    for (const k in H.models) {
      const e = H.models[k];
      const p = new Float32Array(buf, base + e.pos, e.v * 3), n = new Int16Array(buf, base + e.nor, e.v * 3), c = new Uint8Array(buf, base + e.col, e.v * 3), ix = new Uint16Array(buf, base + e.idx, e.i);
      // Blender (z para cima, cano em +x) -> jogo (y para cima, cano em +z)
      const P = new Float32Array(e.v * 3), N = new Float32Array(e.v * 3), C = new Float32Array(e.v * 3);
      for (let i = 0; i < e.v; i++) {
        P[i * 3] = p[i * 3 + 1]; P[i * 3 + 1] = p[i * 3 + 2]; P[i * 3 + 2] = p[i * 3];
        N[i * 3] = n[i * 3 + 1] / 32767; N[i * 3 + 1] = n[i * 3 + 2] / 32767; N[i * 3 + 2] = n[i * 3] / 32767;
      }
      const col = new THREE.Color();
      for (let i = 0; i < e.v; i++) { col.setRGB(c[i * 3] / 255, c[i * 3 + 1] / 255, c[i * 3 + 2] / 255, THREE.SRGBColorSpace); C[i * 3] = col.r; C[i * 3 + 1] = col.g; C[i * 3 + 2] = col.b; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      g.setIndex(new THREE.BufferAttribute(ix, 1));
      g.computeBoundingBox();
      out[k] = g;
    }
    return out;
  }
};

WPN.buildModel = function (id, lod) {
  const cfg = WPN.MDL[id], def = WPN.DEF[id];
  const lib = lod && WPN.modelsLod ? WPN.modelsLod : WPN.models;
  const src = lib[cfg.src] || WPN.models[cfg.src];
  const bb = src.boundingBox;
  const L = bb.max.z - bb.min.z, Hh = bb.max.y - bb.min.y, s = cfg.len / L;
  const at = (f) => new THREE.Vector3(0, (bb.min.y + f[1] * Hh) * s, (bb.min.z + f[0] * L) * s);
  const gripZ = cfg.pistol ? -0.03 : -0.1;
  const g0 = at(cfg.grip);
  const off = new THREE.Vector3(-(bb.min.x + bb.max.x) / 2 * s, -0.06 - g0.y, gripZ - g0.z);
  const pt = f => at(f).add(off);
  const m = new THREE.Matrix4().makeTranslation(off.x, off.y, off.z).multiply(new THREE.Matrix4().makeScale(s, s, s));
  const body = src.toNonIndexed();
  body.applyMatrix4(m);
  if (cfg.tint) {
    const c = body.attributes.color;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, Math.min(1, c.getX(i) * cfg.tint[0]), Math.min(1, c.getY(i) * cfg.tint[1]), Math.min(1, c.getZ(i) * cfg.tint[2]));
  }
  U.projectUV(body, TX.SCALE.gun);
  const P = [body], GL = [];
  const K = 0x2c2e33, K2 = 0x45484f;
  const add = (geo, c, mm, glow) => { const pp = U.part(geo, c, mm, 'radial', 'gun'); (glow ? GL : P).push(pp.g); };
  const B = (w, h, d, c, x, y, z, rx, ry, rz, glow) => add(new THREE.BoxGeometry(w, h, d), c, U.mat4(x, y, z, rx || 0, ry || 0, rz || 0), glow);
  const holo = (z, y, frame, glowC, wide) => {
    const w = wide ? 0.07 : 0.056;
    B(w, 0.012, 0.075, frame, 0, y, z);
    B(0.009, 0.06, 0.065, frame, w / 2 - 0.004, y + 0.036, z); B(0.009, 0.06, 0.065, frame, -w / 2 + 0.004, y + 0.036, z);
    B(w + 0.004, 0.011, 0.07, frame, 0, y + 0.068, z);
    B(w - 0.016, 0.018, 0.026, K2, 0, y + 0.012, z - 0.05);
    if (glowC) { B(0.004, 0.05, 0.004, glowC, w / 2 - 0.002, y + 0.036, z + 0.034, 0, 0, 0, true); B(0.004, 0.05, 0.004, glowC, -w / 2 + 0.002, y + 0.036, z + 0.034, 0, 0, 0, true); }
    return y + 0.036;
  };
  let sightY, sightZ;
  if (cfg.sight) { const sp = pt(cfg.sight); sightY = sp.y; sightZ = sp.z; }
  else {
    const tp = pt(cfg.top);
    if (def.sight === 'diamond') {
      const y = tp.y + 0.04, GLW = def.glow;
      B(0.07, 0.012, 0.07, 0x2c3d63, 0, tp.y + 0.004, tp.z);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + Math.PI / 8;
        B(0.03, 0.008, 0.02, 0x2c3d63, Math.cos(a) * 0.034, y + Math.sin(a) * 0.034, tp.z, 0, 0, a + Math.PI / 2);
        B(0.03, 0.003, 0.004, GLW, Math.cos(a) * 0.03, y + Math.sin(a) * 0.03, tp.z + 0.011, 0, 0, a + Math.PI / 2, true);
      }
      sightY = y; sightZ = tp.z;
    } else {
      const gl = def.sight === 'brackets' ? 0xff2a2a : def.sight === 'cyan' ? 0x39e0ff : def.sight === 'orange' ? def.glow : null;
      sightY = holo(tp.z, tp.y + 0.006, K, gl, def.sight === 'cyan' || def.sight === 'orange'); sightZ = tp.z;
    }
  }
  // detalhes de energia e acessórios
  if (cfg.glowLine) {
    const a = pt([cfg.glowLine[0], cfg.glowLine[2]]), b = pt([cfg.glowLine[1], cfg.glowLine[2]]);
    for (const sx of [-1, 1]) B(0.004, 0.008, b.z - a.z, def.glow, sx * (WPN.halfW(src, s) + 0.002), a.y, (a.z + b.z) / 2, 0, 0, 0, true);
  }
  if (cfg.glowRings) {
    const a = pt([cfg.glowRings[0], cfg.glowRings[2]]), b = pt([cfg.glowRings[1], cfg.glowRings[2]]);
    for (let i = 0; i < 4; i++) { const z = U.lerp(a.z, b.z, i / 3); add(new THREE.TorusGeometry(WPN.halfW(src, s) + 0.012, 0.006, 6, 18), def.glow, U.mat4(0, a.y, z), true); }
  }
  if (cfg.bipod && lib['Accessories/Bipod']) {
    const bp = lib['Accessories/Bipod'].toNonIndexed(), q = pt(cfg.bipod), k = s * 0.7;
    bp.applyMatrix4(new THREE.Matrix4().makeTranslation(q.x, q.y, q.z).multiply(new THREE.Matrix4().makeScale(k * 0.55, k, k)).multiply(new THREE.Matrix4().makeRotationX(-0.5)));
    U.projectUV(bp, TX.SCALE.gun);
    P.push(bp);
  }
  const front = pt([1, cfg.muzzle]);
  const pair = { g: U.merge(P), glow: GL.length ? U.merge(GL) : null };
  pair.o = pair.g;
  pair.len = front.z; pair.muzzleY = front.y; pair.sightY = sightY; pair.sightZ = sightZ;
  pair.gripZ = gripZ; pair.pistol = !!cfg.pistol;
  if (cfg.fore) { const f = pt(cfg.fore); pair.foreZ = f.z; pair.foreY = f.y; } else { pair.foreZ = gripZ; pair.foreY = -0.09; }
  WPN.cache[id + (lod ? '|lod' : '')] = pair;
  return pair;
};
WPN.halfW = (g, s) => (g.boundingBox.max.x - g.boundingBox.min.x) / 2 * s;

// lod = versão leve (loot no chão, armas dos outros personagens)
WPN.build = function (id, lod) {
  const key = id + (lod ? '|lod' : '');
  if (WPN.cache[key]) return WPN.cache[key];
  if (WPN.models && WPN.MDL[id] && WPN.models[WPN.MDL[id].src]) return WPN.buildModel(id, lod);
  const P = [], GL = [];
  const K = 0x34363c, K2 = 0x4a4e56, STEEL = 0x707780, BRASS = 0xc9a24a;
  const push = (geo, c, m, glow, mode) => (glow ? GL : P).push(U.part(geo, c, m, mode || 'radial', 'gun'));
  const B = (w, h, d, c, x, y, z, rx, ry, rz, glow) => push(new THREE.BoxGeometry(w, h, d), c, U.mat4(x, y, z, rx || 0, ry || 0, rz || 0), glow);
  const C = (r, l, c, x, y, z, seg, glow) => push(new THREE.CylinderGeometry(r, r, l, seg || 10).rotateX(Math.PI / 2), c, U.mat4(x, y, z), glow, null);
  const Cv = (r, l, c, x, y, z, rx, seg) => push(new THREE.CylinderGeometry(r, r, l, seg || 8), c, U.mat4(x, y, z, rx || 0), false, null);
  const rail = (z0, len, y) => { B(0.03, 0.012, len, K, 0, y, z0); for (let i = 0; i < Math.floor(len / 0.03); i++) B(0.036, 0.008, 0.012, K2, 0, y + 0.01, z0 - len / 2 + 0.015 + i * 0.03); };
  let gripZ = -0.1, foreZ = 0.27, pistol = false;
  const grip = (z, c) => { gripZ = z; B(0.038, 0.12, 0.05, c || K, 0, -0.095, z, -0.35); B(0.01, 0.028, 0.07, K, 0, -0.06, z + 0.07); B(0.006, 0.025, 0.006, K2, 0, -0.045, z + 0.065); };
  const curvedMag = (z, c, base) => {
    B(0.045, 0.09, 0.068, c, 0, -0.1, z, 0.1); B(0.045, 0.09, 0.068, c, 0, -0.18, z + 0.018, 0.25); B(0.045, 0.08, 0.068, c, 0, -0.25, z + 0.045, 0.4);
    B(0.05, 0.02, 0.075, base || c, 0, -0.29, z + 0.065, 0.42);
    for (let i = 0; i < 3; i++) B(0.047, 0.006, 0.07, K2, 0, -0.12 - i * 0.06, z + 0.01 + i * 0.016, 0.15 + i * 0.12);
  };
  // mira holográfica: base, laterais, teto e bateria; janela no centro (y + 0.036)
  const holo = (z, y, frame, glowC, wide) => {
    const w = wide ? 0.07 : 0.056;
    B(w, 0.012, 0.075, frame, 0, y, z);
    B(0.009, 0.06, 0.065, frame, w / 2 - 0.004, y + 0.036, z); B(0.009, 0.06, 0.065, frame, -w / 2 + 0.004, y + 0.036, z);
    B(w + 0.004, 0.011, 0.07, frame, 0, y + 0.068, z);
    B(w - 0.016, 0.018, 0.026, K2, 0, y + 0.012, z - 0.05);
    B(0.012, 0.012, 0.012, K2, w / 2 + 0.004, y + 0.03, z - 0.02);
    if (glowC) { B(0.004, 0.05, 0.004, glowC, w / 2 - 0.002, y + 0.036, z + 0.034, 0, 0, 0, true); B(0.004, 0.05, 0.004, glowC, -w / 2 + 0.002, y + 0.036, z + 0.034, 0, 0, 0, true); }
    return y + 0.036;
  };
  let len = 0.5, sightY = 0.11, sightZ = 0.05;
  const def = WPN.DEF[id];
  if (id === 'FUZIL' || id === 'CARABINA') {
    const TAN = id === 'FUZIL' ? 0xb79b6c : 0x2a2c31, ACC = id === 'FUZIL' ? 0x6b6a45 : 0xd8262b;
    B(0.058, 0.07, 0.26, K, 0, 0.035, 0); B(0.054, 0.06, 0.18, K, 0, -0.025, -0.02);
    B(0.05, 0.06, 0.07, K, 0, -0.07, 0.06); curvedMag(0.075, K, id === 'CARABINA' ? ACC : K);
    grip(-0.1, TAN);
    B(0.066, 0.066, 0.3, K, 0, 0.03, 0.28);
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) B(0.004, 0.022, 0.03, id === 'CARABINA' ? ACC : 0x111214, sx * 0.034, 0.03, 0.17 + i * 0.05);
    B(0.068, 0.02, 0.12, ACC, 0, 0.0, 0.24);
    rail(0.15, 0.54, 0.072);
    C(0.012, 0.18, K, 0, 0.03, 0.51); C(0.02, 0.06, id === 'FUZIL' ? 0xb08a3a : ACC, 0, 0.03, 0.6, 8);
    C(0.017, 0.18, K, 0, 0.02, -0.2); B(0.05, 0.1, 0.17, TAN, 0, -0.005, -0.33); B(0.054, 0.125, 0.03, K, 0, -0.01, -0.425); B(0.044, 0.03, 0.12, TAN, 0, 0.06, -0.32);
    B(0.03, 0.065, 0.04, K, 0, -0.03, 0.34, 0.45);
    C(0.009, 0.03, K2, 0.032, 0.05, -0.02, 6); B(0.004, 0.02, 0.06, K2, 0.03, 0.035, 0.03);
    sightY = holo(0.04, 0.078, K, id === 'CARABINA' ? 0xff2a2a : null);
    len = 0.63;
  } else if (id === 'SMG') {
    const BRZ = 0x8a5a3a;
    B(0.06, 0.08, 0.3, K, 0, 0.02, 0.05); B(0.062, 0.02, 0.22, BRZ, 0, 0.04, 0.06);
    for (let i = 0; i < 4; i++) B(0.064, 0.012, 0.025, K2, 0, 0.0, 0.14 + i * 0.04);
    rail(0.04, 0.26, 0.068);
    C(0.012, 0.1, K, 0, 0.02, 0.25); C(0.02, 0.05, K, 0, 0.02, 0.32, 8);
    B(0.04, 0.17, 0.06, K, 0, -0.12, 0.04, 0.08); grip(-0.09, K);
    Cv(0.017, 0.09, K, 0, -0.06, 0.2); B(0.012, 0.012, 0.18, K2, 0.018, 0.01, -0.18); B(0.012, 0.012, 0.18, K2, -0.018, 0.01, -0.18); B(0.05, 0.1, 0.02, K, 0, -0.02, -0.28);
    sightY = holo(0.05, 0.075, K, null);
    len = 0.35;
  } else if (id === 'PRECISAO') {
    const GR = 0x56653d;
    B(0.07, 0.1, 0.5, GR, 0, -0.02, -0.02); B(0.06, 0.16, 0.08, GR, 0, -0.03, -0.38); B(0.065, 0.04, 0.16, GR, 0, 0.045, -0.3); B(0.062, 0.17, 0.025, K, 0, -0.03, -0.425);
    grip(-0.12, GR);
    C(0.024, 0.24, K, 0, 0.05, 0.03); Cv(0.008, 0.06, STEEL, 0.045, 0.05, -0.04, 0, 6); B(0.015, 0.015, 0.015, STEEL, 0.075, 0.05, -0.04);
    C(0.015, 0.56, K, 0, 0.05, 0.42); C(0.024, 0.07, K, 0, 0.05, 0.72, 8);
    B(0.04, 0.09, 0.06, K, 0, -0.09, 0.05);
    // luneta
    C(0.021, 0.34, K, 0, 0.135, 0.05, 14); C(0.035, 0.08, K, 0, 0.135, 0.25, 16); C(0.031, 0.07, K, 0, 0.135, -0.13, 16);
    Cv(0.013, 0.035, K2, 0, 0.165, 0.05); B(0.035, 0.026, 0.026, K2, 0.03, 0.135, 0.05, 0, 0, Math.PI / 2);
    B(0.03, 0.05, 0.02, K, 0, 0.1, -0.02); B(0.03, 0.05, 0.02, K, 0, 0.1, 0.13);
    for (const sx of [-1, 1]) B(0.009, 0.22, 0.009, K, sx * 0.03, -0.13, 0.42, 0, 0, sx * 0.28);
    sightY = 0.135; sightZ = -0.13; len = 0.76;
  } else if (id === 'ESCOPETA') {
    B(0.055, 0.08, 0.24, K, 0, 0.02, 0);
    for (let i = 0; i < 5; i++) C(0.011, 0.05, 0xc62828, 0.034, 0.025 - (i % 2) * 0.002, -0.06 + i * 0.026, 8);
    C(0.017, 0.52, K, 0, 0.05, 0.4); C(0.016, 0.44, K2, 0, 0.005, 0.36);
    B(0.058, 0.052, 0.17, K, 0, 0.005, 0.32); for (let i = 0; i < 6; i++) B(0.062, 0.006, 0.01, K2, 0, 0.005, 0.25 + i * 0.025);
    grip(-0.1, K); B(0.05, 0.11, 0.28, K, 0, -0.035, -0.27); B(0.054, 0.13, 0.03, K2, 0, -0.04, -0.41);
    B(0.01, 0.012, 0.01, 0xffd23c, 0, 0.077, 0.64); B(0.03, 0.022, 0.012, K, 0, 0.075, -0.05); B(0.008, 0.01, 0.014, K, 0, 0.09, -0.05);
    sightY = 0.085; sightZ = -0.05; len = 0.66;
  } else if (id === 'PISTOLA') {
    B(0.036, 0.04, 0.2, K, 0, 0.035, 0.04); for (let i = 0; i < 6; i++) B(0.038, 0.03, 0.005, K2, 0, 0.035, -0.04 + i * 0.01);
    B(0.032, 0.026, 0.16, K2, 0, 0.005, 0.05); B(0.036, 0.11, 0.05, K, 0, -0.055, -0.03, 0, 0, 0); B(0.038, 0.09, 0.04, 0x151618, 0, -0.06, -0.03, -0.2);
    B(0.008, 0.03, 0.045, K, 0, -0.02, 0.04); C(0.011, 0.02, K2, 0, 0.035, 0.145);
    B(0.006, 0.012, 0.01, K, 0, 0.062, 0.13); B(0.024, 0.012, 0.012, K, 0, 0.062, -0.05); B(0.012, 0.02, 0.012, K2, 0, 0.055, -0.07);
    sightY = 0.068; sightZ = -0.05; len = 0.16; gripZ = -0.03; pistol = true;
  } else if (id === 'METRALHADORA') {
    const BOX = 0x5a6b3a, WOOD = 0x8a4f2a;
    B(0.08, 0.1, 0.32, K, 0, 0.02, 0); C(0.032, 0.36, K2, 0, 0.04, 0.33, 12);
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) B(0.006, 0.016, 0.03, 0x111214, sx * 0.032, 0.04, 0.2 + i * 0.05);
    C(0.016, 0.2, K, 0, 0.04, 0.6); C(0.024, 0.05, K, 0, 0.04, 0.71, 8);
    B(0.12, 0.12, 0.13, BOX, 0, -0.1, 0.02); B(0.124, 0.02, 0.134, 0x48552d, 0, -0.06, 0.02); B(0.03, 0.03, 0.015, K2, 0.065, -0.1, 0.02);
    for (let i = 0; i < 4; i++) B(0.02, 0.015, 0.03, BRASS, 0.05, -0.03 + i * 0.012, 0.02 + i * 0.015, 0.3);
    grip(-0.11, K); B(0.055, 0.11, 0.22, WOOD, 0, -0.01, -0.26); B(0.058, 0.13, 0.03, K, 0, -0.01, -0.38);
    B(0.02, 0.03, 0.12, K, 0, 0.1, 0.1);
    for (const sx of [-1, 1]) B(0.009, 0.24, 0.009, K, sx * 0.035, -0.14, 0.5, 0, 0, sx * 0.3);
    sightY = holo(-0.05, 0.072, K, 0x39e0ff, true);
    sightZ = -0.05; len = 0.74;
  } else if (id === 'FUTURISTA') {
    const D1 = 0x1d2a44, D2 = 0x2c3d63, GLW = def.glow;
    B(0.07, 0.1, 0.36, D1, 0, 0.02, 0.03); B(0.06, 0.034, 0.36, D2, 0, 0.085, 0.06, 0.05);
    B(0.074, 0.012, 0.3, GLW, 0, 0.03, 0.05, 0, 0, 0, true); B(0.05, 0.012, 0.2, GLW, 0, 0.1, 0.12, 0.05, 0, 0, true);
    C(0.024, 0.12, D2, 0, 0.03, 0.27, 8); C(0.032, 0.03, GLW, 0, 0.03, 0.33, 12, true); C(0.02, 0.03, D1, 0, 0.03, 0.355, 8);
    B(0.045, 0.13, 0.06, D1, 0, -0.1, 0.05, 0.12); B(0.047, 0.008, 0.06, GLW, 0, -0.14, 0.055, 0.12, 0, 0, true);
    grip(-0.09, D1); B(0.04, 0.1, 0.18, D1, 0, -0.01, -0.25); B(0.042, 0.012, 0.18, GLW, 0, 0.04, -0.25, 0, 0, 0, true); B(0.046, 0.13, 0.03, D2, 0, -0.02, -0.34);
    // mira octogonal
    const y = 0.11;
    B(0.07, 0.012, 0.07, D2, 0, y - 0.036, 0.0);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + Math.PI / 8;
      B(0.03, 0.008, 0.02, D2, Math.cos(a) * 0.034, y + Math.sin(a) * 0.034, 0.0, 0, 0, a + Math.PI / 2);
      B(0.03, 0.003, 0.004, GLW, Math.cos(a) * 0.03, y + Math.sin(a) * 0.03, 0.011, 0, 0, a + Math.PI / 2, true);
    }
    sightY = y; sightZ = 0.0; len = 0.37;
  } else if (id === 'BLASTER') {
    const D1 = 0x2b2b30, GLW = def.glow;
    C(0.05, 0.36, D1, 0, 0.02, 0.08, 12);
    for (let i = 0; i < 4; i++) C(0.054, 0.018, GLW, 0, 0.02, -0.02 + i * 0.07, 14, true);
    B(0.03, 0.012, 0.28, GLW, 0, 0.074, 0.08, 0, 0, 0, true);
    C(0.04, 0.06, D1, 0, 0.02, 0.29, 12); C(0.03, 0.02, 0x5fe8ff, 0, 0.02, 0.325, 12, true);
    B(0.1, 0.1, 0.1, 0x5a6b3a, 0, -0.09, 0.0); B(0.104, 0.02, 0.104, 0x48552d, 0, -0.05, 0.0);
    grip(-0.1, D1); B(0.05, 0.11, 0.2, D1, 0, -0.01, -0.24); B(0.052, 0.012, 0.2, GLW, 0, 0.042, -0.24, 0, 0, 0, true);
    sightY = holo(0.05, 0.08, D1, GLW, true); len = 0.34;
  } else if (id === 'REVOLVER') {
    const WD = 0x8a4f2a;
    C(0.012, 0.17, STEEL, 0, 0.04, 0.13); B(0.02, 0.028, 0.17, STEEL, 0, 0.048, 0.13); B(0.008, 0.012, 0.17, 0x5d636a, 0, 0.066, 0.13);
    C(0.027, 0.055, STEEL, 0, 0.03, 0.015, 12); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; C(0.006, 0.057, 0x3a3e44, Math.cos(a) * 0.017, 0.03 + Math.sin(a) * 0.017, 0.015, 6); }
    B(0.026, 0.055, 0.07, STEEL, 0, 0.03, -0.03); B(0.032, 0.1, 0.045, WD, 0, -0.045, -0.065, -0.35);
    B(0.008, 0.03, 0.04, STEEL, 0, -0.012, 0.005); B(0.008, 0.02, 0.015, STEEL, 0, 0.068, -0.055, 0.5);
    B(0.006, 0.014, 0.012, STEEL, 0, 0.075, 0.2); B(0.02, 0.01, 0.01, STEEL, 0, 0.068, -0.04);
    sightY = 0.074; sightZ = -0.04; len = 0.22; gripZ = -0.06; pistol = true;
  }
  const pair = U.build(P);
  pair.glow = GL.length ? U.merge(GL.map(p => p.g)) : null;
  pair.len = len; pair.sightY = sightY; pair.sightZ = sightZ;
  pair.gripZ = gripZ; pair.pistol = pistol;
  pair.foreZ = { SMG: 0.17, PRECISAO: 0.24, ESCOPETA: 0.28, METRALHADORA: 0.26, FUTURISTA: 0.18, BLASTER: 0.16 }[id] || 0.22;
  WPN.cache[id] = pair;
  return pair;
};

// material das armas: cores por vértice + textura de desgaste, com brilho metálico
WPN.gunMat = function () {
  if (!WPN._gun) WPN._gun = new THREE.MeshStandardMaterial({ vertexColors: true, map: TX.tex('gun'), roughness: 0.48, metalness: 0.3, envMapIntensity: 0.9 });
  return WPN._gun;
};

WPN.glowMat = function () {
  if (!WPN._gm) WPN._gm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  return WPN._gm;
};

// malha completa (corpo + contorno + brilho) pronta para pôr na cena
WPN.mesh = function (id, olThick) {
  const p = WPN.build(id);
  const g = new THREE.Group();
  const m = new THREE.Mesh(p.g, WPN.gunMat()); m.castShadow = true;
  g.add(m);
  g.add(new THREE.Mesh(p.o, U.outlineMat(olThick || 0.012)));
  if (p.glow) g.add(new THREE.Mesh(p.glow, WPN.glowMat()));
  g.userData.main = m;
  return g;
};

WPN.iconSVG = function (id, color) {
  const d = WPN.DEF[id];
  return '<svg viewBox="0 0 64 28" aria-hidden="true"><path d="' + WPN.ICON[d.icon] + '" fill="' + (color || '#e9edf2') + '" stroke="#0b0d10" stroke-width="1"/></svg>';
};

// sorteia uma arma pelo peso de raridade
WPN.roll = function (rnd, primaryOnly) {
  const list = primaryOnly ? WPN.PRIMARY : WPN.ORDER;
  let tot = 0;
  for (const k of list) tot += WPN.WEIGHT[WPN.DEF[k].rarity];
  let r = (rnd || Math.random)() * tot;
  for (const k of list) { r -= WPN.WEIGHT[WPN.DEF[k].rarity]; if (r <= 0) return k; }
  return list[0];
};
