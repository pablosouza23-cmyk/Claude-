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
  FUZIL: { name: 'AK-47', short: 'AK-47', rarity: 'comum', type: 'rifle', dmg: 34, head: 54, cd: 0.11, mag: 30, res: 120, spread: 0.011, range: 160, sight: 'reddot', zoom: 1.6, icon: 'rifle', desc: 'Equilíbrio entre alcance, precisão e poder de fogo.' },
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
  CARABINA: { src: 'WP_M4', alt: 'AssaultRifle2_1', len: 0.86, grip: [0.36, 0.42], fore: [0.62, 0.62], top: [0.45, 0.9], muzzle: 0.97 },
  SMG: { src: 'SubmachineGun_3', len: 0.62, grip: [0.46, 0.54], fore: [0.85, 0.55], top: [0.6, 0.98], muzzle: 0.81 },
  PRECISAO: { src: 'WP_SNIPER', alt: 'SniperRifle_2', paint: [0x2f4a2a, [[0, 0.58, 0.62]]], len: 1.15, grip: [0.24, 0.45], fore: [0.5, 0.55], sight: [0.33, 0.95], muzzle: 0.98 },
  ESCOPETA: { src: 'WP_SHOTGUN', alt: 'Shotgun_2', paint: [0x8a4a22, [[0, 0.33, 1], [0.5, 0.72, 0.5]]], len: 1.0, grip: [0.22, 0.5], fore: [0.55, 0.55], sight: [0.6, 0.95], muzzle: 0.98 },
  METRALHADORA: { src: 'AssaultRifle2_2', len: 1.0, grip: [0.31, 0.46], fore: [0.67, 0.75], top: [0.45, 0.86], muzzle: 0.76, tint: [0.78, 0.86, 0.66], bipod: [0.9, 0.72] },
  PISTOLA: { src: 'WP_PISTOL', alt: 'Pistol_1', len: 0.2, grip: [0.18, 0.4], sight: [0.1, 0.97], muzzle: 0.98, pistol: true },
  REVOLVER: { src: 'Revolver_1', len: 0.28, grip: [0.17, 0.56], sight: [0.1, 0.97], muzzle: 0.86, pistol: true },
  FUTURISTA: { src: 'Bullpup_2', len: 0.74, grip: [0.27, 0.48], fore: [0.82, 0.61], top: [0.5, 0.98], muzzle: 0.81, tint: [0.55, 0.7, 1.15], glowLine: [0.3, 0.86, 0.74] },
  BLASTER: { src: 'Bullpup_3', len: 0.75, grip: [0.37, 0.50], fore: [0.68, 0.62], top: [0.5, 0.98], muzzle: 0.88, tint: [0.75, 0.68, 0.62], glowRings: [0.72, 0.95, 0.8] },
};
WPN.models = null; WPN.modelsLod = null;
WPN.load = async function () {
  try {
    WPN.models = await WPN.loadFile('assets/guns.bin');
    try { WPN.modelsLod = await WPN.loadFile('assets/guns_lod.bin'); } catch (e) { WPN.modelsLod = null; }
    // armas do Weapons_Pack (M4, pistola, escopeta e sniper)
    // só no PC: o celular fica com as armas leves (versão reduzida)
    try { Object.assign(WPN.models, await WPN.loadFile('assets/guns_wp.bin')); if (WPN.modelsLod) Object.assign(WPN.modelsLod, await WPN.loadFile('assets/guns_wp_lod.bin')); } catch (e) { console.warn('pacote de armas indisponível', e); }
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
  const src = lib[cfg.src] || WPN.models[cfg.src] || lib[cfg.alt] || WPN.models[cfg.alt];
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
  // pintura das referências: as partes mais claras do modelo (coronha/guarda-mão) ganham a cor nova
  // pintura das referências por região: [cor, [[início, fim, altura máx.] ao longo do cano (0 = coronha)]]
  if (cfg.paint) {
    body.computeBoundingBox();
    const c = body.attributes.color, P = body.attributes.position, b2 = body.boundingBox, pc = new THREE.Color(cfg.paint[0]);
    const Lz = b2.max.z - b2.min.z, Hy = b2.max.y - b2.min.y;
    for (let i = 0; i < c.count; i++) {
      const f = (P.getZ(i) - b2.min.z) / Lz, h = (P.getY(i) - b2.min.y) / Hy;
      if (cfg.paint[1].some(r => f >= r[0] && f <= r[1] && h <= r[2])) c.setXYZ(i, pc.r, pc.g, pc.b);
    }
  }
  U.projectUV(body, 3.2);
  const P = [body], GL = [];
  const K = 0x2c2e33, K2 = 0x45484f;
  const add = (geo, c, mm, glow) => { const pp = U.part(geo, c, mm, 'radial', 'gun'); (glow ? GL : P).push(pp.g); };
  const B = (w, h, d, c, x, y, z, rx, ry, rz, glow) => add(new THREE.BoxGeometry(w, h, d), c, U.mat4(x, y, z, rx || 0, ry || 0, rz || 0), glow);
  // mira holográfica arredondada: base com trilho, capô curvo (meio tubo) e o ponto brilhando no meio
  const holo = (z, y, frame, glowC, wide) => {
    const r = wide ? 0.036 : 0.03;
    B(r * 2 + 0.006, 0.014, 0.08, frame, 0, y, z);
    B(r * 2 - 0.012, 0.01, 0.06, K2, 0, y - 0.01, z);
    add(new THREE.CylinderGeometry(r, r, 0.062, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), frame, U.mat4(0, y + 0.012, z));
    for (const dz of [-0.031, 0.031]) add(new THREE.TorusGeometry(r, 0.0045, 6, 20, Math.PI), frame, U.mat4(0, y + 0.012, z + dz));
    B(0.016, 0.014, 0.022, K2, r - 0.004, y + 0.014, z - 0.042);
    add(new THREE.SphereGeometry(0.0035, 8, 6), glowC || 0xff2a2a, U.mat4(0, y + 0.03, z + 0.02), true);
    return y + 0.03;
  };
  // red dot de tubo: corpo redondo aberto, anéis nas pontas, lente vermelha e botão de ajuste do lado
  const tube = (z, y, frame) => {
    const r = 0.021, L = 0.075, cy = y + 0.036;
    B(0.026, 0.02, 0.05, frame, 0, y + 0.008, z);
    add(new THREE.CylinderGeometry(r, r, L, 22, 1, true).rotateX(Math.PI / 2), frame, U.mat4(0, cy, z));
    for (const dz of [-L / 2, L / 2]) add(new THREE.TorusGeometry(r + 0.002, 0.0045, 6, 22), frame, U.mat4(0, cy, z + dz));
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 12).rotateZ(Math.PI / 2), K2, U.mat4(r + 0.006, cy, z));
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 12), K2, U.mat4(0, cy + r + 0.006, z));
    add(new THREE.CircleGeometry(r - 0.002, 22), 0x3a0d10, U.mat4(0, cy, z + L / 2 - 0.004), true);
    add(new THREE.SphereGeometry(0.003, 8, 6), 0xff2a2a, U.mat4(0, cy, z + 0.01), true);
    return cy;
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
      sightY = def.sight === 'reddot' || def.sight === 'greendot' ? tube(tp.z, tp.y + 0.006, K) : holo(tp.z, tp.y + 0.006, K, gl, def.sight === 'cyan' || def.sight === 'orange'); sightZ = tp.z;
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
    U.projectUV(bp, 3.2);
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
// ---------- itens modelados no Blender (granada, mochila, kit, munição, colete, capacete, gel, caixa) ----------
// cada vértice traz a classe do material: 0 plástico, 1 metal, 2 tecido, 3 madeira, 4 brilho
WPN.props = null;
WPN.loadProps = async function () {
  try {
    const r = await fetch(CH.url('assets/props.bin'));
    if (!r.ok) throw new Error('sem itens');
    const buf = await r.arrayBuffer(), dv = new DataView(buf), hl = dv.getUint32(4, true);
    const H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)).replace(/[\0 ]+$/, '')), base = 8 + hl;
    const out = {}, col = new THREE.Color();
    for (const k in H.models) {
      const e = H.models[k];
      const p = new Float32Array(buf, base + e.pos, e.v * 3), n = new Int16Array(buf, base + e.nor, e.v * 3), c = new Uint8Array(buf, base + e.col, e.v * 4), ix = new Uint16Array(buf, base + e.idx, e.i);
      const P = new Float32Array(e.v * 3), N = new Float32Array(e.v * 3), C = new Float32Array(e.v * 3), K = new Float32Array(e.v);
      // Blender (z para cima) -> jogo (y para cima): (x, y, z) -> (x, z, -y)
      for (let i = 0; i < e.v; i++) {
        P[i * 3] = p[i * 3]; P[i * 3 + 1] = p[i * 3 + 2]; P[i * 3 + 2] = -p[i * 3 + 1];
        N[i * 3] = n[i * 3] / 32767; N[i * 3 + 1] = n[i * 3 + 2] / 32767; N[i * 3 + 2] = -n[i * 3 + 1] / 32767;
        col.setRGB(c[i * 4] / 255, c[i * 4 + 1] / 255, c[i * 4 + 2] / 255, THREE.SRGBColorSpace); C[i * 3] = col.r; C[i * 3 + 1] = col.g; C[i * 3 + 2] = col.b; K[i] = c[i * 4 + 3];
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('cls', new THREE.BufferAttribute(K, 1));
      g.setIndex(new THREE.BufferAttribute(ix, 1));
      const ng = g.toNonIndexed();
      U.projectUV(ng, 7);
      ng.computeBoundingSphere();
      out[k] = ng;
    }
    WPN.props = out;
  } catch (e) { console.warn('itens 3D indisponíveis', e); }
};
// cópia do item com escala e cor multiplicada (níveis de colete/capacete)
WPN.prop = function (name, scale, tint) {
  if (!WPN.props || !WPN.props[name]) return null;
  const key = name + '|' + scale + '|' + (tint || '');
  WPN._pc = WPN._pc || {};
  if (WPN._pc[key]) return WPN._pc[key];
  const g = WPN.props[name].clone();
  if (scale !== 1) g.scale(scale, scale, scale);
  if (tint) { const t = new THREE.Color(tint), c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * t.r, c.getY(i) * t.g, c.getZ(i) * t.b); }
  g.computeBoundingSphere();
  return (WPN._pc[key] = g);
};
WPN.propMat = function () {
  if (WPN._pm) return WPN._pm;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: TX.tex('gunMetal'), bumpMap: TX.tex('weave'), bumpScale: 0.8, roughness: 0.7, metalness: 0.3 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.weaveMap = { value: TX.tex('weave') }; sh.uniforms.woodMap = { value: TX.tex('gunWood') };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float cls; varying float vCls;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCls = cls;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D weaveMap; uniform sampler2D woodMap; varying float vCls;')
      .replace('#include <map_fragment>', [
        'float kMet = 1.0 - step(0.5, abs(vCls - 1.0)), kFab = 1.0 - step(0.5, abs(vCls - 2.0)), kWod = 1.0 - step(0.5, abs(vCls - 3.0)), kGlw = step(3.5, vCls);',
        'vec4 tMet = texture2D(map, vMapUv), tFab = texture2D(weaveMap, vMapUv * 2.5), tWod = texture2D(woodMap, vMapUv * vec2(0.5, 1.6));',
        'vec3 det = vec3(0.92) + (tMet.rgb - 0.7) * 0.25;',
        'det = mix(det, tMet.rgb * 1.6, kMet); det = mix(det, tFab.rgb * 1.15, kFab); det = mix(det, tWod.rgb * 1.15, kWod); det = mix(det, vec3(1.0), kGlw);',
        'diffuseColor.rgb *= det;',
      ].join('\n'))
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(mix(0.45, clamp(1.05 - tMet.r, 0.25, 0.7), kMet), 0.92, kFab), 0.7, kWod);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = 0.75 * kMet;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * kGlw * 0.9;');
  };
  m.customProgramCacheKey = () => 'propPBR';
  return (WPN._pm = m);
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
// O shader escolhe o material de cada parte pela cor do modelo: marrom = madeira (veios, fosca),
// escuro = metal (escovado, arranhões brilhando), claro = polímero/pintura.
// reflexo de estúdio para as armas: céu claro, chão cinza e três painéis de luz
// (o metal polido e o ouro refletem isso e ganham brilho de verdade, em vez do chão escuro da ilha)
WPN.studioEnv = function () {
  if (WPN._env !== undefined) return WPN._env;
  WPN._env = null;
  try {
    if (typeof renderer === 'undefined' || !renderer) return null;
    const es = new THREE.Scene();
    const sg = new THREE.SphereGeometry(50, 32, 16), col = [], pos = sg.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 50, c = y > 0 ? new THREE.Color(0x9aa3ad).lerp(new THREE.Color(0xf2f4f8), Math.pow(y, 0.6)) : new THREE.Color(0x6d7178).lerp(new THREE.Color(0x26282c), Math.pow(-y, 0.5));
      col.push(c.r, c.g, c.b);
    }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    for (const [x, y, z, w, h, k] of [[0, 30, 0, 40, 18, 5], [-38, 10, 20, 8, 30, 3.5], [36, 6, -24, 10, 24, 2.5]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.96), side: THREE.DoubleSide }));
      pl.position.set(x, y, z); pl.lookAt(0, 0, 0); es.add(pl);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    WPN._env = pm.fromScene(es, 0.03).texture;
    pm.dispose();
  } catch (e) { WPN._env = null; }
  return WPN._env;
};

// celular e qualidade baixa/média: material padrão (sem a camada extra de verniz, que dobra o custo do brilho)
WPN.lite = () => (typeof isTouch !== 'undefined' && isTouch) || (typeof G !== 'undefined' && G.settings && G.settings.quality !== 'alta' && G.settings.quality !== 'ultra');
WPN.physMat = function (o) {
  if (!WPN.lite()) return new THREE.MeshPhysicalMaterial(o);
  delete o.clearcoat; delete o.clearcoatRoughness;
  if (G.settings.quality === 'baixa') { delete o.normalMap; delete o.normalScale; }
  return new THREE.MeshStandardMaterial(o);
};

WPN.gunMat = function () {
  if (WPN._gun) return WPN._gun;
  const metal = TX.tex('gunMetal'), wood = TX.tex('gunWood');
  // metal fosfatado com microrrelevo (normal map), verniz leve e reflexo do céu; madeira com veio
  const m = WPN.physMat({ vertexColors: true, map: metal, normalMap: TX.normal('gunMetal', 2.2), normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.42, metalness: 0.6, envMap: WPN.studioEnv(), envMapIntensity: 1.25, clearcoat: 0.22, clearcoatRoughness: 0.4 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.woodMap = { value: wood };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D woodMap;')
      .replace('#include <map_fragment>', [
        'float woodK = 0.0, bright = 0.5;',
        '#ifdef USE_COLOR',
        ' woodK = smoothstep(0.035, 0.13, vColor.r - vColor.b) * step(0.07, vColor.r);',
        ' bright = max(vColor.r, max(vColor.g, vColor.b));',
        '#endif',
        'vec4 mt = texture2D(map, vMapUv);',
        'vec4 wd = texture2D(woodMap, vMapUv * vec2(0.35, 1.4));',
        // metal escuro ganha leve azulado de fosfato; desgaste claro nas marcas
        'vec3 metalCol = mt.rgb * 1.6 * vec3(0.93, 0.96, 1.02);',
        'diffuseColor.rgb *= mix(mix(metalCol, vec3(0.95 + mt.r * 0.1), smoothstep(0.35, 0.6, bright)), wd.rgb * vec3(1.18, 1.08, 1.0), woodK);',
      ].join('\n'))
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(clamp(1.1 - mt.r * 1.0, 0.18, 0.72), 0.55, smoothstep(0.35, 0.6, bright)), 0.5 - wd.r * 0.12, woodK);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * (1.0 - woodK) * (1.0 - smoothstep(0.3, 0.55, bright) * 0.8);');
  };
  m.customProgramCacheKey = () => 'gunPBR2';
  WPN._gun = m;
  return m;
};

// ---------- skins de arma ----------
// cada estilo pinta as partes de metal, de madeira e as claras com cores próprias e um desenho por cima
// (pat: textura em cinza, branco = detalhe; col: textura colorida usada direto)
WPN.STYLES = {
  gold: { pat: 'skinGold', scale: 0.55, base: 0xffd85a, acc: 0x8a5a10, wood: 0x141210, wacc: 0xffd24a, brightC: 0xfff0b0, metal: 0.78, rough: 0.26, racc: 0.5, wmetal: 0.4, wrough: 0.22, coat: 0.7, nrm: 3, emis: 0xc88a18, emisK: 0, glowBase: 0.2, env: 2 },
  ice: { pat: 'skinIce', scale: 0.8, base: 0x9fdcff, acc: 0xffffff, wood: 0x5fb7ef, wacc: 0xe8fbff, brightC: 0xdff6ff, metal: 0.15, rough: 0.06, racc: 0.3, wmetal: 0.1, wrough: 0.1, coat: 1, emis: 0x2b9cff, emisK: 0.55, glowBase: 0.08 },
  dragon: { pat: 'skinScales', scale: 1.1, base: 0x1c0f0b, acc: 0xff4a12, wood: 0x2a0806, wacc: 0xff7a1a, brightC: 0xffb066, metal: 0.65, rough: 0.38, racc: 0.3, wmetal: 0.4, wrough: 0.35, coat: 0.5, emis: 0xff3a0a, emisK: 2.2, pulse: 1 },
  neon: { pat: 'skinCircuit', scale: 0.9, base: 0x0b0e18, acc: 0x26f4ff, wood: 0x150a22, wacc: 0xff3cf0, brightC: 0xb8f7ff, metal: 0.55, rough: 0.3, racc: 0.2, wmetal: 0.4, wrough: 0.3, coat: 0.7, emis: 0x26f4ff, emisK: 2.4, wemis: 0xff3cf0, pulse: 1 },
  glacial: { pat: 'skinScales', scale: 1.3, base: 0xe4f6ff, acc: 0x27b4ff, wood: 0x0b2350, wacc: 0x58d8ff, brightC: 0xffffff, metal: 0.72, rough: 0.16, racc: 0.22, wmetal: 0.5, wrough: 0.2, coat: 1, emis: 0x2ab8ff, emisK: 3.6, wemis: 0x7fe6ff, glowBase: 0.22, pulse: 1 },
  camo: { col: 'skinCamo', scale: 0.7, metal: 0.1, rough: 0.78, coat: 0, keepMetal: true },
  carbon: { col: 'skinCarbon', scale: 2.2, metal: 0.25, rough: 0.28, coat: 1, keepMetal: true },
};
// skins à venda (gun = arma em que a skin vai)
WPN.SKINS = {
  ak_ouro: { gun: 'FUZIL', name: 'AK-47 Dourada', style: 'gold' },
  ak_gelo: { gun: 'FUZIL', name: 'AK-47 Gelo Ártico', style: 'ice' },
  ak_dragao: { gun: 'FUZIL', name: 'AK-47 Dragão de Fogo', style: 'dragon' },
  ak_glacial: { gun: 'FUZIL', name: 'AK-47 Fúria Glacial', style: 'glacial', fx: 0x46c8ff },
  m4_neon: { gun: 'CARABINA', name: 'Carabina Neon', style: 'neon' },
  awm_camo: { gun: 'PRECISAO', name: 'Precisão Camuflada', style: 'camo' },
  esc_carbono: { gun: 'ESCOPETA', name: 'Escopeta Carbono', style: 'carbon' },
  smg_gelo: { gun: 'SMG', name: 'SMG Gelo Ártico', style: 'ice' },
  des_ouro: { gun: 'PISTOLA', name: 'Pistola Dourada', style: 'gold' },
};
WPN.skinMat = function (skinId) {
  const sk = WPN.SKINS[skinId];
  if (!sk) return WPN.gunMat();
  WPN._skin = WPN._skin || {};
  if (WPN._skin[sk.style]) return WPN._skin[sk.style];
  const st = WPN.STYLES[sk.style], C = (h) => new THREE.Color(h === undefined ? 0xffffff : h);
  const tex = TX.tex(st.pat || st.col);
  const m = WPN.physMat({ vertexColors: true, map: tex, normalMap: TX.normal(st.pat || st.col, st.nrm || 1.6), normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: st.rough, metalness: st.metal, clearcoat: st.coat || 0, clearcoatRoughness: 0.18, envMap: WPN.studioEnv(), envMapIntensity: st.env || 1.15 });
  const U2 = { uBase: { value: C(st.base) }, uAcc: { value: C(st.acc) }, uWood: { value: C(st.wood) }, uWacc: { value: C(st.wacc) }, uBright: { value: C(st.brightC) },
    uEmis: { value: C(st.emis || 0) }, uWemis: { value: C(st.wemis || st.emis || 0) }, uEmisK: { value: st.emisK || 0 }, uGlow: { value: st.glowBase || 0 },
    uRacc: { value: st.racc === undefined ? st.rough : st.racc }, uWmetal: { value: st.wmetal === undefined ? st.metal : st.wmetal }, uWrough: { value: st.wrough === undefined ? st.rough : st.wrough },
    uScale: { value: st.scale || 1 }, uTime: WPN.timeU };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U2);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uBase, uAcc, uWood, uWacc, uBright, uEmis, uWemis; uniform float uEmisK, uGlow, uRacc, uWmetal, uWrough, uScale, uTime;\nfloat skPat = 0.0, skWood = 0.0, skBright = 0.0;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>')
      .replace('#include <map_fragment>', [
        '#ifdef USE_COLOR',
        ' skWood = smoothstep(0.035, 0.13, vColor.r - vColor.b) * step(0.07, vColor.r);',
        ' skBright = smoothstep(0.35, 0.6, max(vColor.r, max(vColor.g, vColor.b)));',
        '#endif',
        'vec4 skT = texture2D(map, vMapUv * uScale);',
        st.col ? 'skPat = 0.0; vec3 skCol = mix(skT.rgb * 1.15, vec3(0.75), skBright * 0.6);'
          : 'skPat = skT.r; vec3 skCol = mix(mix(uBase, uAcc, skPat), mix(uWood, uWacc, skPat), skWood); skCol = mix(skCol, uBright, skBright * (1.0 - skWood));',
        'diffuseColor.rgb = skCol;',
      ].join('\n'))
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(roughness, uRacc, skPat), uWrough, skWood);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(metalness, uWmetal, skWood);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat skPulse = ' + (st.pulse ? '0.65 + 0.35 * sin(uTime * 3.0 + vMapUv.x * 4.0)' : '1.0') + ';\ntotalEmissiveRadiance += (mix(uEmis, uWemis, skWood) * skPat * uEmisK * skPulse) + uEmis * uGlow;');
  };
  m.customProgramCacheKey = () => 'gunSkin_' + sk.style;
  WPN._skin[sk.style] = m;
  return m;
};
WPN.timeU = { value: 0 };

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
