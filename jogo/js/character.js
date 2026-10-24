'use strict';
// Personagem toon com esqueleto (uma malha com ossos + uma casca de contorno por personagem):
// capuz vermelho, jaqueta com listras brancas, calça larga, tênis, mochila com alças, rosto.
// A animação calcula uma pose-alvo por quadro e cada osso se aproxima dela suavemente.
const CH = {};

// paletas no estilo urbano/tático da referência
CH.PLAYER_PAL = { shirt: 0x1b1c1f, pants: 0x1e1f23, rig: 0x15161a, pack: 0x1a1b1e, glove: 0x18191c, shoe: 0xf2f2f2, shoe2: 0x8f949b, skin: 0xd8a07a, hair: 0x2a1d16, hairTip: 0xb8a68a, chain: 0xd9dde2, tattoo: true, mustache: true, earring: true };

CH.BOT_PALS = [
  { shirt: 0x4b5a32, pants: 0x2b2d30, rig: 0x2e3324, pack: 0x3a4229, glove: 0x222222, shoe: 0x2a2a2a, shoe2: 0x6b6b6b, skin: 0xc68b5e, hair: 0x15100c, hairTip: 0x15100c, cap: 0x3a4229 },
  { shirt: 0xe9e9e9, pants: 0x3a4f8a, rig: 0x26282c, pack: 0x30333a, glove: 0x1d1d1d, shoe: 0xffffff, shoe2: 0xd83a3a, skin: 0xf0c29a, hair: 0x6b3d1e, hairTip: 0x8a5a2e },
  { shirt: 0x7a2a2a, pants: 0x1d1d1d, rig: 0x1b1b1b, pack: 0x222222, glove: 0x1b1b1b, shoe: 0xf2f2f2, shoe2: 0x1d1d1d, skin: 0x8a5a3c, hair: 0x111111, hairTip: 0x111111, tattoo: true },
  { shirt: 0x5c6670, pants: 0x8a7a5a, rig: 0x4a4436, pack: 0x5a5040, glove: 0x3a3428, shoe: 0xb8a27a, shoe2: 0x5a4a32, skin: 0xe8b48a, hair: 0xd9a441, hairTip: 0xf0d08a, cap: 0x2a2a2a },
  { shirt: 0x2e6fb5, pants: 0x2b2d30, rig: 0x1f2227, pack: 0x262a30, glove: 0x1c1c1c, shoe: 0xffffff, shoe2: 0x2e6fb5, skin: 0xd99a6c, hair: 0x2a1a12, hairTip: 0x4a3222, mustache: true },
  { shirt: 0x2a2b2e, pants: 0x4a4f3a, rig: 0x3a3f2c, pack: 0x4a4f3a, glove: 0x222222, shoe: 0x3a3a3a, shoe2: 0x9a9a9a, skin: 0xb57a52, hair: 0x111111, hairTip: 0x333333, cap: 0x8a2a2a },
  { shirt: 0xd9a514, pants: 0x24304d, rig: 0x1d1f24, pack: 0x2f2f2f, glove: 0x1d1d1d, shoe: 0xffffff, shoe2: 0xd9a514, skin: 0xe2ae86, hair: 0x3a2412, hairTip: 0x6a4a2a },
  { shirt: 0x15a3a3, pants: 0x1e1f23, rig: 0x15161a, pack: 0x1a1b1e, glove: 0x18191c, shoe: 0xf2f2f2, shoe2: 0x15a3a3, skin: 0x9c6644, hair: 0x111111, hairTip: 0x111111, earring: true },
];

CH.cache = {};
CH.darker = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k === undefined ? 0.55 : k); c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b); return c.getHex(); };
CH.mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
CH.OL = 0.02;
CH.SCALE = 0.95;

// ---------- armas: modelos em weapons.js ----------
CH.gunPair = function (id) { return WPN.build(id); };

// ---------- corpo ----------
// ossos: [nome, pai, posição relativa ao pai]
CH.BONES = [
  ['hips', -1, [0, 0.95, 0]],
  ['spine', 0, [0, 0.1, 0]],
  ['chest', 1, [0, 0.2, 0]],
  ['neck', 2, [0, 0.3, 0]],
  ['head', 3, [0, 0.06, 0]],
  ['shL', 2, [0.17, 0.21, 0]], ['armL', 5, [0.08, 0, 0]], ['foreL', 6, [0, -0.29, 0]], ['handL', 7, [0, -0.26, 0]],
  ['shR', 2, [-0.17, 0.21, 0]], ['armR', 9, [-0.08, 0, 0]], ['foreR', 10, [0, -0.29, 0]], ['handR', 11, [0, -0.26, 0]],
  ['thighL', 0, [0.1, -0.04, 0]], ['shinL', 13, [0, -0.44, 0]], ['footL', 14, [0, -0.42, 0]],
  ['thighR', 0, [-0.1, -0.04, 0]], ['shinR', 16, [0, -0.44, 0]], ['footR', 17, [0, -0.42, 0]],
];
CH.BI = {};
CH.BONES.forEach((b, i) => { CH.BI[b[0]] = i; });

CH.bodyGeo = function (pal) {
  const key = 'body_' + JSON.stringify(pal);
  if (CH.cache[key]) return CH.cache[key];
  const wp = [];
  CH.BONES.forEach((b, i) => {
    const p = b[2], par = b[1] >= 0 ? wp[b[1]] : [0, 0, 0];
    wp.push([par[0] + p[0], par[1] + p[1], par[2] + p[2]]);
  });
  const parts = [], idx = [];
  const add = (bone, geo, color, m, mode) => {
    const o = wp[CH.BI[bone]];
    const mm = new THREE.Matrix4().makeTranslation(o[0], o[1], o[2]).multiply(m || new THREE.Matrix4());
    parts.push(U.part(geo, color, mm, mode, 'fabric')); idx.push(CH.BI[bone]);
  };
  const S = (r, w, h) => new THREE.SphereGeometry(r, w || 12, h || 9);
  const Cy = (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 12);
  const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const M = U.mat4;
  const BUCKLE = 0x9aa0a8, STRAP = pal.rig, SKIN = pal.skin, SKIN_D = CH.darker(pal.skin, 0.8);
  // quadril, cinto, fivela
  add('hips', S(0.19), pal.pants, M(0, 0, 0, 0, 0, 0, 1.06, 0.72, 0.82), 'radial');
  add('hips', Cy(0.2, 0.2, 0.05, 14), 0x121316, M(0, 0.075, 0, 0, 0, 0, 1.04, 1, 0.84));
  add('hips', Bx(0.06, 0.04, 0.02), BUCKLE, M(0, 0.075, 0.168), 'radial');
  // camiseta preta larga
  add('spine', Cy(0.18, 0.2, 0.24, 14), pal.shirt, M(0, 0.08, 0, 0, 0, 0, 1.14, 1, 0.82));
  add('chest', Cy(0.208, 0.185, 0.32, 14), pal.shirt, M(0, 0.12, 0, 0, 0, 0, 1.16, 1, 0.82));
  add('chest', S(0.205), pal.shirt, M(0, 0.25, 0, 0, 0, 0, 1.34, 0.52, 0.88), 'radial');
  add('chest', Cy(0.075, 0.085, 0.035, 12), CH.darker(pal.shirt, 0.8), M(0, 0.315, 0.01));
  // colete/arnês tático: alças, peitoral, fivelas, porta-carregadores
  for (const sx of [-1, 1]) {
    add('chest', Bx(0.05, 0.36, 0.03), STRAP, M(sx * 0.1, 0.12, 0.165, 0, 0, sx * -0.06), 'radial');
    add('chest', Bx(0.05, 0.03, 0.38), STRAP, M(sx * 0.11, 0.31, -0.03), 'radial');
    add('chest', Bx(0.035, 0.03, 0.012), BUCKLE, M(sx * 0.1, 0.18, 0.183), 'radial');
    add('chest', Bx(0.085, 0.1, 0.05), STRAP, M(sx * 0.17, -0.03, 0.13, 0, sx * 0.4, 0), 'radial');
  }
  add('chest', Bx(0.28, 0.035, 0.03), STRAP, M(0, 0.02, 0.17), 'radial');
  add('chest', Bx(0.04, 0.03, 0.012), BUCKLE, M(0, 0.02, 0.188), 'radial');
  // corrente prateada com pingente
  add('chest', new THREE.TorusGeometry(0.105, 0.005, 5, 20), pal.chain || 0xd9dde2, M(0, 0.27, 0.06, 1.25, 0, 0), 'radial');
  add('chest', Bx(0.012, 0.022, 0.005), pal.chain || 0xd9dde2, M(0, 0.165, 0.17), 'radial');
  // mochila tática com fileiras MOLLE, bolsos e alça
  add('chest', Bx(0.33, 0.4, 0.17), pal.pack, M(0, 0.13, -0.225), 'radial');
  add('chest', Bx(0.27, 0.16, 0.06), CH.darker(pal.pack, 1.15), M(0, 0.03, -0.33), 'radial');
  for (let r = 0; r < 4; r++) add('chest', Bx(0.3, 0.012, 0.012), 0x0b0c0e, M(0, 0.09 + r * 0.06, -0.312), 'radial');
  for (const sx of [-1, 1]) add('chest', Bx(0.05, 0.22, 0.12), CH.darker(pal.pack, 1.1), M(sx * 0.19, 0.08, -0.22), 'radial');
  add('chest', new THREE.TorusGeometry(0.04, 0.008, 5, 10, Math.PI), 0x111214, M(0, 0.34, -0.22), 'radial');
  add('chest', Bx(0.06, 0.04, 0.006), 0x8a8f96, M(0, 0.2, -0.312), 'radial');
  // pescoço e cabeça
  add('neck', Cy(0.058, 0.064, 0.1, 10), SKIN, M(0, 0.03, 0));
  add('head', S(0.125, 14, 12), SKIN, M(0, 0.1, 0.005, 0, 0, 0, 0.93, 1.07, 1), 'radial');
  add('head', S(0.06, 10, 8), SKIN, M(0, 0.02, 0.06, 0, 0, 0, 1.1, 0.7, 0.9), 'radial');
  for (const sx of [-1, 1]) {
    add('head', S(0.024, 10, 8), 0xffffff, M(sx * 0.043, 0.115, 0.108, 0, 0, 0, 1.15, 0.85, 0.5), 'radial');
    add('head', S(0.014, 8, 6), 0x3a2414, M(sx * 0.043, 0.113, 0.118, 0, 0, 0, 1, 1, 0.5), 'radial');
    add('head', Bx(0.05, 0.014, 0.014), pal.hair, M(sx * 0.046, 0.152, 0.112, 0, 0, sx * -0.12), 'radial');
    add('head', S(0.026, 8, 6), SKIN, M(sx * 0.118, 0.1, -0.005, 0, 0, 0, 0.45, 1, 0.75), 'radial');
    // degradê nas laterais
    add('head', S(0.122, 12, 8), CH.mix(SKIN, pal.hair, 0.55), M(sx * 0.012, 0.13, -0.012, 0, 0, 0, 0.96, 0.75, 1.0), 'radial');
  }
  if (pal.earring) add('head', S(0.008, 6, 5), 0xf4f6f8, M(0.12, 0.075, 0.005), 'radial');
  add('head', S(0.018, 8, 6), SKIN_D, M(0, 0.085, 0.125, 0, 0, 0, 1, 1, 1.15), 'radial');
  add('head', Bx(0.04, 0.009, 0.008), 0x7a3a30, M(0, 0.048, 0.113), 'radial');
  if (pal.mustache) {
    add('head', Bx(0.055, 0.011, 0.012), pal.hair, M(0, 0.064, 0.118), 'radial');
    add('head', Bx(0.016, 0.022, 0.012), pal.hair, M(0, 0.024, 0.112), 'radial');
  }
  if (pal.cap) {
    add('head', new THREE.SphereGeometry(0.132, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), pal.cap, M(0, 0.15, 0, 0, 0, 0, 1, 0.85, 1.05), 'radial');
    add('head', Bx(0.16, 0.012, 0.1), pal.cap, M(0, 0.155, 0.13, -0.12, 0, 0), 'radial');
  } else {
    // cabelo cacheado no topo com pontas claras
    const r = U.rng(7);
    add('head', S(0.118, 12, 8), pal.hair, M(0, 0.175, 0.0, 0, 0, 0, 1.02, 0.55, 1.02), 'radial');
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.09;
      const x = Math.cos(a) * d, z = Math.sin(a) * d * 1.1 + 0.01, y = 0.2 + (0.09 - d) * 0.45 + r() * 0.015;
      add('head', S(0.028 + r() * 0.012, 7, 5), r() < 0.35 ? pal.hairTip : pal.hair, M(x, y, z), 'radial');
    }
    for (let i = 0; i < 5; i++) add('head', S(0.026, 7, 5), i % 2 ? pal.hairTip : pal.hair, M(-0.05 + i * 0.025, 0.19, 0.095), 'radial');
  }
  for (const [sd, s] of [[1, 'L'], [-1, 'R']]) {
    // manga curta larga + braço de fora
    add('arm' + s, Cy(0.09, 0.085, 0.15), pal.shirt, M(0, -0.07, 0));
    add('arm' + s, S(0.088), pal.shirt, M(0, -0.005, 0), 'radial');
    add('arm' + s, Cy(0.062, 0.058, 0.17), SKIN, M(0, -0.21, 0));
    add('arm' + s, S(0.058), SKIN, M(0, -0.29, 0), 'radial');
    add('fore' + s, Cy(0.058, 0.05, 0.24), SKIN, M(0, -0.12, 0));
    if (pal.tattoo && s === 'R') {
      for (let i = 0; i < 7; i++) add('fore' + s, Bx(0.022 + (i % 3) * 0.008, 0.03, 0.006), 0x2b2a33, M(Math.sin(i * 2.3) * 0.04, -0.05 - i * 0.025, Math.cos(i * 2.3) * 0.045 + 0.005, 0, i * 0.9, i * 0.6), 'radial');
    }
    // luva sem dedo com protetor de junta
    add('hand' + s, Cy(0.052, 0.05, 0.05), pal.glove, M(0, 0.005, 0));
    add('hand' + s, S(0.052, 10, 8), pal.glove, M(0, -0.045, 0.005, 0, 0, 0, 0.9, 1.1, 0.78), 'radial');
    add('hand' + s, Bx(0.07, 0.03, 0.03), 0x0d0e10, M(0, -0.06, 0.03), 'radial');
    add('hand' + s, Bx(0.07, 0.03, 0.035), SKIN, M(0, -0.1, 0.012), 'radial');
    add('hand' + s, S(0.02, 8, 6), pal.glove, M(sd * 0.038, -0.03, 0.03), 'radial');
    // calça cargo larga com bolsos, joelho e barra
    add('thigh' + s, Cy(0.122, 0.108, 0.46), pal.pants, M(0, -0.22, 0));
    add('thigh' + s, Bx(0.05, 0.13, 0.11), CH.darker(pal.pants, 1.15), M(sd * 0.118, -0.24, 0.0), 'radial');
    add('thigh' + s, Bx(0.054, 0.02, 0.115), CH.darker(pal.pants, 0.8), M(sd * 0.12, -0.17, 0.0), 'radial');
    add('thigh' + s, S(0.106), pal.pants, M(0, -0.44, 0), 'radial');
    add('shin' + s, Cy(0.108, 0.115, 0.36), pal.pants, M(0, -0.18, 0));
    add('shin' + s, Cy(0.122, 0.112, 0.08), pal.pants, M(0, -0.33, 0));
    // tênis cano alto cinza e branco
    add('foot' + s, Cy(0.088, 0.094, 0.1, 12), pal.shoe, M(0, 0.03, -0.005));
    add('foot' + s, S(0.098, 12, 8), pal.shoe, M(0, -0.005, 0.055, 0, 0, 0, 1.0, 0.6, 1.6), 'radial');
    add('foot' + s, Bx(0.19, 0.045, 0.33), 0xf7f7f7, M(0, -0.055, 0.05), 'radial');
    add('foot' + s, Bx(0.2, 0.012, 0.335), 0xbfc3c8, M(0, -0.075, 0.05), 'radial');
    add('foot' + s, Bx(0.196, 0.05, 0.12), pal.shoe2, M(0, -0.005, -0.03), 'radial');
    add('foot' + s, Bx(0.196, 0.04, 0.08), pal.shoe2, M(0, -0.01, 0.17), 'radial');
    add('foot' + s, Bx(0.06, 0.012, 0.11), 0x1c1d20, M(0, 0.055, 0.1), 'radial');
    add('foot' + s, Cy(0.09, 0.09, 0.02, 12), pal.shoe2, M(0, 0.08, -0.005));
  }
  // coldre de perna (direita) com pistola
  add('thighR', Bx(0.05, 0.2, 0.11), STRAP, M(-0.125, -0.2, 0.02), 'radial');
  add('thighR', Bx(0.035, 0.08, 0.06), 0x0f1012, M(-0.15, -0.12, 0.03), 'radial');
  for (const y of [-0.13, -0.27]) add('thighR', Cy(0.126, 0.126, 0.022, 14), STRAP, M(0, y, 0));
  add('thighR', Bx(0.03, 0.12, 0.03), STRAP, M(-0.11, -0.05, 0.03), 'radial');
  const pack = U.build(parts);
  const n = pack.g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  let off = 0;
  parts.forEach((p, k) => {
    const c = p.g.attributes.position.count;
    for (let i = 0; i < c; i++) { si[(off + i) * 4] = idx[k]; sw[(off + i) * 4] = 1; }
    off += c;
  });
  for (const g of [pack.g, pack.o]) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  }
  CH.cache[key] = pack;
  return pack;
};

CH.boardPair = function () {
  if (CH.cache.board) return CH.cache.board;
  CH.cache.board = U.build([
    U.part(new THREE.SphereGeometry(1, 18, 8), 0x39e0ff, U.mat4(0, 0, 0, 0, 0, 0, 0.3, 0.045, 1.05), 'radial'),
    U.part(new THREE.SphereGeometry(1, 18, 8), 0xff5fb8, U.mat4(0, -0.035, 0.05, 0, 0, 0, 0.26, 0.03, 0.9), 'radial'),
    U.part(new THREE.BoxGeometry(0.22, 0.012, 1.4), 0xffffff, U.mat4(0, 0.042, 0), 'radial'),
    U.part(new THREE.BoxGeometry(0.02, 0.14, 0.2), 0xffffff, U.mat4(0, -0.1, -0.7), 'radial'),
  ]);
  return CH.cache.board;
};

CH.chuteGeo = function () {
  if (CH.cache.chute) return CH.cache.chute;
  // asa curva quadriculada vermelho/branco (como o paraquedas do vídeo)
  const g = new THREE.CylinderGeometry(3.4, 3.4, 2.6, 16, 4, true, -1.15, 2.3);
  g.rotateX(-Math.PI / 2);
  const ng = g.toNonIndexed();
  const pos = ng.attributes.position, n = pos.count, cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += pos.getX(i + k); y += pos.getY(i + k); z += pos.getZ(i + k); }
    x /= 3; y /= 3; z /= 3;
    const a = Math.floor((Math.atan2(x, y) + 1.15) / 2.3 * 8), b = Math.min(3, Math.floor((z + 1.3) / 2.6 * 4));
    const red = (a + b) % 2 === 0;
    for (let k = 0; k < 3; k++) { const j = (i + k) * 3; cols[j] = red ? 0.88 : 1; cols[j + 1] = red ? 0.2 : 1; cols[j + 2] = red ? 0.18 : 1; }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  ng.computeVertexNormals();
  CH.cache.chute = ng;
  return ng;
};

CH.make = function (pal) {
  const pack = CH.bodyGeo(pal);
  const mat = U.toon({ vertexColors: true, map: TX.tex('fabric') });
  const olm = U.outlineMat(CH.OL);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(CH.SCALE);
  body.rotation.order = 'YXZ';
  root.add(body);
  // ossos
  const bones = CH.BONES.map(b => { const bn = new THREE.Bone(); bn.name = b[0]; bn.position.set(b[2][0], b[2][1], b[2][2]); return bn; });
  CH.BONES.forEach((b, i) => { if (b[1] >= 0) bones[b[1]].add(bones[i]); });
  const skel = new THREE.Skeleton(bones);
  const mesh = new THREE.SkinnedMesh(pack.g, mat);
  mesh.add(bones[0]);
  mesh.bind(skel);
  mesh.castShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.6);
  const ol = new THREE.SkinnedMesh(pack.o, olm);
  ol.bind(skel, mesh.bindMatrix);
  ol.boundingSphere = mesh.boundingSphere;
  ol.userData.isOutline = true;
  body.add(mesh); body.add(ol);
  const B = {};
  bones.forEach(bn => { B[bn.name] = bn; });

  // arma na mão (presa ao peito) e arma guardada nas costas
  const gmat = TX.mat('gun');
  const gun = new THREE.Group(); B.chest.add(gun);
  const gunMesh = new THREE.Mesh(new THREE.BufferGeometry(), gmat); gunMesh.castShadow = true; gun.add(gunMesh);
  const gunOl = new THREE.Mesh(new THREE.BufferGeometry(), U.outlineMat(0.012)); gunOl.userData.isOutline = true; gun.add(gunOl);
  const gunGlow = new THREE.Mesh(new THREE.BufferGeometry(), WPN.glowMat()); gun.add(gunGlow);
  const muzzle = new THREE.Object3D(); gun.add(muzzle);
  const eject = new THREE.Object3D(); eject.position.set(0.05, 0.04, 0.02); gun.add(eject);
  const stow = new THREE.Group(); stow.position.set(0, 0.12, -0.33); stow.rotation.set(0, Math.PI / 2, 0.85); B.chest.add(stow);
  const stowMesh = new THREE.Mesh(new THREE.BufferGeometry(), gmat); stow.add(stowMesh);
  const stowOl = new THREE.Mesh(new THREE.BufferGeometry(), U.outlineMat(0.012)); stowOl.userData.isOutline = true; stow.add(stowOl);
  const stowGlow = new THREE.Mesh(new THREE.BufferGeometry(), WPN.glowMat()); stow.add(stowGlow);

  // prancha e paraquedas
  const board = new THREE.Group();
  const bp = CH.boardPair();
  board.add(new THREE.Mesh(bp.g, U.toon({ vertexColors: true, emissive: 0x113344 })));
  board.add(new THREE.Mesh(bp.o, U.outlineMat(0.03)));
  const trail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.6, depthWrite: false }));
  trail.scale.z = 30; trail.position.set(0, 0, -15.5);
  board.add(trail);
  board.userData.trail = trail;
  board.position.y = -0.02; board.visible = false;
  root.add(board);
  const chute = new THREE.Group();
  const canopy = new THREE.Mesh(CH.chuteGeo(), U.toon({ vertexColors: true, side: THREE.DoubleSide }));
  canopy.position.y = 2.2;
  chute.add(canopy);
  const lp = [];
  for (const x of [-2.9, -1.2, 1.2, 2.9]) for (const z of [-1.1, 1.1]) {
    const ang = x / 3.4;
    lp.push(0, 1.45, 0, Math.sin(ang) * 3.25, 2.2 + Math.cos(ang) * 3.25 - 0.1, z);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  chute.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x333333 })));
  chute.visible = false;
  root.add(chute);

  const ch = {
    root: root, body: body, B: B, mesh: mesh, gun: gun, gunMesh: gunMesh, gunOl: gunOl, gunGlow: gunGlow, muzzle: muzzle, eject: eject,
    stow: stow, stowMesh: stowMesh, stowOl: stowOl, stowGlow: stowGlow, board: board, chute: chute, mat: mat,
    outlines: [ol, gunOl, stowOl], meshes: [mesh, gunMesh],
    phase: Math.random() * 6, deadT: -1, flash: 0, punchT: 0, landT: 0, recoil: 0, gunId: null, stowId: null,
    tg: {}, prevFace: 0, turn: 0, breath: Math.random() * 6,
  };
  for (const b of CH.BONES) ch.tg[b[0]] = [0, 0, 0];
  return ch;
};

const _emptyGeo = new THREE.BufferGeometry();
CH.setGuns = function (ch, inHand, onBack) {
  if (ch.gunId !== inHand) {
    ch.gunId = inHand;
    if (inHand) {
      const p = WPN.build(inHand);
      ch.gunMesh.geometry = p.g; ch.gunOl.geometry = p.o; ch.gunGlow.geometry = p.glow || _emptyGeo;
      ch.muzzle.position.set(0, 0.03, p.len + 0.02);
    }
    ch.gun.visible = !!inHand;
  }
  if (ch.stowId !== onBack) {
    ch.stowId = onBack;
    if (onBack) { const p = WPN.build(onBack); ch.stowMesh.geometry = p.g; ch.stowOl.geometry = p.o; ch.stowGlow.geometry = p.glow || _emptyGeo; }
    ch.stow.visible = !!onBack;
  }
};

const _T = (ch, n, x, y, z) => { const t = ch.tg[n]; t[0] = x; t[1] = y; t[2] = z; };

// s: {mode:'ground'|'fall'|'chute', speed, vx, vz, aim, air, pitch, crouch, armed, dead, board}
CH.animate = function (ch, dt, s) {
  const B = ch.B;
  if (ch.flash > 0) {
    ch.flash -= dt;
    ch.mat.emissive.setHex(ch.flash > 0 ? 0x772222 : 0x000000);
  }
  let k = 16; // velocidade de mistura entre poses
  let hipsY = 0.95, bodyX = 0, bodyY = 0;
  for (const b of CH.BONES) _T(ch, b[0], 0, 0, 0);
  if (s.dead) {
    if (ch.deadT < 0) ch.deadT = 0;
    ch.deadT += dt;
    const d = U.smooth(0, 0.5, ch.deadT);
    bodyX = -d * 1.52; bodyY = d * 0.16;
    _T(ch, 'thighL', -0.5 * d, 0, 0.15 * d); _T(ch, 'thighR', -0.1 * d, 0, -0.2 * d); _T(ch, 'shinL', 0.6 * d, 0, 0);
    _T(ch, 'armL', -2.5 * d, 0, 0.5 * d); _T(ch, 'armR', -2.2 * d, 0, -0.6 * d); _T(ch, 'neck', 0.3 * d, 0.4 * d, 0);
    ch.board.visible = false; ch.chute.visible = false; ch.gun.visible = false;
    k = 10;
  } else {
    ch.deadT = -1;
    ch.breath += dt * 2.2;
    const br = Math.sin(ch.breath);
    if (s.mode === 'fall') {
      ch.board.visible = s.board !== false; ch.chute.visible = false; ch.gun.visible = false;
      ch.phase += dt * 3;
      const w = Math.sin(ch.phase) * 0.05;
      hipsY = 0.84;
      _T(ch, 'thighL', -0.35, 0, 0.14); _T(ch, 'thighR', 0.25, 0, -0.14); _T(ch, 'shinL', 0.65, 0, 0); _T(ch, 'shinR', 0.4, 0, 0);
      _T(ch, 'footL', -0.3, 0, 0); _T(ch, 'footR', -0.4, 0, 0);
      _T(ch, 'spine', 0.15, 0, w); _T(ch, 'chest', 0.1, 0, 0); _T(ch, 'neck', -0.25, 0, 0);
      _T(ch, 'armL', 0, 0, 1.4 + w); _T(ch, 'armR', 0, 0, -1.4 + w); _T(ch, 'foreL', 0, 0, 0.15); _T(ch, 'foreR', 0, 0, -0.15);
    } else if (s.mode === 'chute') {
      ch.board.visible = false; ch.chute.visible = true; ch.gun.visible = false;
      ch.phase += dt * 2;
      const sw = Math.sin(ch.phase) * 0.12;
      _T(ch, 'thighL', -0.25 + sw, 0, 0.05); _T(ch, 'thighR', 0.05 - sw, 0, -0.05); _T(ch, 'shinL', 0.35, 0, 0); _T(ch, 'shinR', 0.2, 0, 0);
      _T(ch, 'armL', -2.8, 0, 0.32); _T(ch, 'armR', -2.8, 0, -0.32); _T(ch, 'foreL', -0.35, 0, 0); _T(ch, 'foreR', -0.35, 0, 0);
      _T(ch, 'neck', 0.15, 0, 0);
    } else {
      ch.board.visible = false; ch.chute.visible = false;
      ch.gun.visible = !!ch.gunId && s.armed !== false;
      // velocidade no referencial do corpo: frente/lado (permite andar de lado e de costas)
      const f = ch.body.rotation.y;
      const sf = Math.sin(f), cf = Math.cos(f);
      const spd = s.speed || 0;
      const vf = spd > 0.05 ? ((s.vx || 0) * sf + (s.vz || 0) * cf) / spd : 1;
      const vs = spd > 0.05 ? ((s.vx || 0) * cf - (s.vz || 0) * sf) / spd : 0;
      const run = U.clamp(spd / 6, 0, 1.15);
      ch.phase += dt * (5 + spd * 1.45) * (run > 0.04 ? 1 : 0);
      const p = ch.phase, sw = Math.sin(p), cw = Math.cos(p);
      const A = run, dirF = vf >= -0.3 ? 1 : -1;
      // pernas
      let thL = -sw * 0.85 * A * vf, thR = sw * 0.85 * A * vf;
      let tzL = sw * 0.35 * A * vs, tzR = -sw * 0.35 * A * vs;
      let knL = 0.06 + Math.max(0, cw * dirF) * 1.25 * A, knR = 0.06 + Math.max(0, -cw * dirF) * 1.25 * A;
      let ftL = -knL * 0.35 + Math.max(0, -sw) * 0.3 * A, ftR = -knR * 0.35 + Math.max(0, sw) * 0.3 * A;
      hipsY = 0.95 - 0.04 * A + Math.abs(Math.cos(p)) * 0.06 * A + br * 0.004;
      // virar parado: pezinhos mexendo
      const df = U.angDiff(ch.prevFace, f);
      ch.prevFace = f;
      ch.turn = U.damp(ch.turn, U.clamp(df / Math.max(dt, 0.001) * 0.15, -1, 1), 8, dt);
      if (A < 0.1 && Math.abs(ch.turn) > 0.12) { const t = Math.sin(G_time() * 14) * 0.3 * Math.abs(ch.turn); thL += t; thR -= t; knL += Math.abs(t); }
      if (s.crouch) { thL = -1.15 - sw * 0.3 * A; thR = -0.55 + sw * 0.3 * A; knL = 1.55; knR = 1.7; ftL = -0.4; ftR = 0.4; hipsY = 0.6 + Math.abs(Math.cos(p)) * 0.03 * A; }
      if (s.air) { thL = -0.75; thR = 0.2; knL = 1.25; knR = 0.55; ftL = 0.3; ftR = 0.1; }
      // amortecimento do pouso
      if (ch.landT > 0) { ch.landT -= dt; const l = Math.sin(U.clamp(ch.landT / 0.25, 0, 1) * Math.PI) * 0.6; hipsY -= l * 0.18; thL -= l; thR -= l; knL += l * 1.6; knR += l * 1.6; }
      _T(ch, 'thighL', thL, 0, tzL); _T(ch, 'thighR', thR, 0, tzR);
      _T(ch, 'shinL', knL, 0, 0); _T(ch, 'shinR', knR, 0, 0);
      _T(ch, 'footL', ftL, 0, 0); _T(ch, 'footR', ftR, 0, 0);
      // tronco: inclina na corrida, torção, respiração
      const aim = s.aim || 0, pitch = s.pitch || 0;
      const lean = 0.2 * A * (1 - aim * 0.7) * Math.max(0, vf) + (s.crouch ? 0.3 : 0);
      _T(ch, 'hips', 0, sw * 0.14 * A, 0);
      _T(ch, 'spine', lean * 0.5 - pitch * 0.2 + br * 0.015, -sw * 0.12 * A, -vs * 0.08 * A);
      _T(ch, 'chest', lean * 0.5 - pitch * (0.45 + aim * 0.3), -sw * 0.1 * A, 0);
      _T(ch, 'neck', -lean * 0.6 - pitch * 0.25, 0, 0);
      _T(ch, 'head', 0, Math.sin(ch.breath * 0.23) * 0.08 * (1 - A) * (1 - aim), 0);
      if (s.armed === false) {
        // desarmado: braços balançam alternados com as pernas
        _T(ch, 'armR', sw * 0.9 * A * vf - 0.05, 0, -0.1); _T(ch, 'foreR', -0.25 - 0.9 * A, 0, 0);
        _T(ch, 'armL', -sw * 0.9 * A * vf - 0.05, 0, 0.1); _T(ch, 'foreL', -0.25 - 0.9 * A, 0, 0);
        _T(ch, 'shR', 0, 0, br * 0.02); _T(ch, 'shL', 0, 0, -br * 0.02);
      } else {
        const up = aim, bob = sw * 0.06 * A * (1 - aim);
        _T(ch, 'armR', U.lerp(-0.8, -1.38, up) + bob, 0.25, -0.15);
        _T(ch, 'foreR', U.lerp(-0.95, -0.35, up), 0, 0);
        _T(ch, 'armL', U.lerp(-0.98, -1.42, up) - bob, -0.2, -0.55);
        _T(ch, 'foreL', U.lerp(-0.9, -0.45, up), 0, 0);
        _T(ch, 'handR', 0, 0, 0); _T(ch, 'handL', 0, 0, 0);
      }
      if (ch.punchT > 0) {
        ch.punchT -= dt;
        const pk = Math.sin(U.clamp(1 - ch.punchT / 0.3, 0, 1) * Math.PI);
        _T(ch, 'armR', -1.55 * pk - 0.2, 0, -0.1); _T(ch, 'foreR', -0.15 * (1 - pk), 0, 0); _T(ch, 'chest', 0, 0.35 * pk, 0);
      }
      // recuo da arma
      const rc = ch.recoil; ch.recoil = Math.max(0, ch.recoil - dt * 9);
      ch.gun.position.set(-0.11, U.lerp(0.0, 0.15, aim), U.lerp(0.3, 0.36, aim) - rc * 0.06);
      ch.gun.rotation.set(U.lerp(0.18, 0, aim) - rc * 0.12, 0, 0);
      if (rc > 0) { _T(ch, 'chest', ch.tg.chest[0] - rc * 0.05, ch.tg.chest[1], 0); }
      k = 18;
    }
  }
  // mistura suave para a pose-alvo
  const a = 1 - Math.exp(-k * dt);
  for (const b of CH.BONES) {
    const bn = B[b[0]], t = ch.tg[b[0]];
    bn.rotation.x += (t[0] - bn.rotation.x) * a;
    bn.rotation.y += (t[1] - bn.rotation.y) * a;
    bn.rotation.z += (t[2] - bn.rotation.z) * a;
  }
  B.hips.position.y += (hipsY - B.hips.position.y) * Math.min(1, a * 1.4);
  ch.body.rotation.x += (bodyX - ch.body.rotation.x) * a;
  ch.body.position.y += (bodyY - ch.body.position.y) * a;
};

// relógio para pequenos detalhes de animação
const G_time = () => performance.now() / 1000;

CH.setOutlinesVisible = function (ch, v) {
  if (ch._olv === v) return;
  ch._olv = v;
  for (const o of ch.outlines) o.visible = v;
};

CH.setShadow = function (ch, v) {
  if (ch._shv === v) return;
  ch._shv = v;
  for (const m of ch.meshes) m.castShadow = v;
};
