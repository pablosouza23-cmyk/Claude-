'use strict';
// Mundo: ilha com grama, trilhas de areia, árvores toon, ruínas, vila, mar e céu com nuvens.
const W = {
  MAP_R: 150,       // raio jogável da ilha
  SEA_Y: -0.6,
  statics: [],      // colisores estáticos
  grid: new Map(),
  CELL: 8,
  areas: [],
  time: 0,
};

// ---------- relevo ----------
W.paths = [
  [[-140, 10], [-95, 18], [-60, 8], [-30, 22], [0, 12], [30, -8], [55, -40], [70, -58]],
  [[0, 12], [-12, -30], [-25, -70], [-30, -95]],
  [[70, -58], [100, -40], [128, -20]],
  [[-30, 22], [-38, 60], [-20, 100], [10, 128]],
  [[30, -8], [70, 20], [95, 60]],
  [[-30, -95], [20, -110], [70, -58]],
];
W.segs = [];
for (const p of W.paths) for (let i = 0; i < p.length - 1; i++) W.segs.push([p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]]);

W.pathDist = function (x, z) {
  let best = 1e9;
  for (const s of W.segs) {
    const dx = s[2] - s[0], dz = s[3] - s[1];
    let t = ((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = s[0] + dx * t - x, ez = s[1] + dz * t - z;
    const d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
};

W.areaDefs = [
  { name: 'RUÍNAS', x: 70, z: -58, r: 30, flat: true },
  { name: 'BAIRRO TROPICAL', x: -30, z: -98, r: 34, flat: true },
  { name: 'FLORESTA', x: -55, z: 45, r: 42 },
  { name: 'CAMPO ABERTO', x: 40, z: 40, r: 38 },
];

W.baseH = function (x, z) {
  return 1.4 + (U.fbm(x * 0.010 + 3.1, z * 0.010 - 7.3) - 0.5) * 6 + (U.noise(x * 0.05, z * 0.05) - 0.5) * 0.6;
};
for (const a of W.areaDefs) a.h = W.baseH(a.x, a.z);

W.height = function (x, z) {
  let h = W.baseH(x, z);
  for (const a of W.areaDefs) {
    if (!a.flat) continue;
    const d = Math.hypot(x - a.x, z - a.z);
    if (d < a.r + 12) h = U.lerp(h, a.h, U.smooth(a.r + 12, a.r - 4, d));
  }
  const pd = W.pathDist(x, z);
  if (pd < 6) h -= (1 - pd / 6) * 0.12;
  const r = Math.hypot(x, z);
  if (r > 132) h = U.lerp(h, -2.6, U.smooth(132, 168, r));
  return h;
};

// quanto de areia existe num ponto (0 = grama, 1 = areia)
W.sand = function (x, z) {
  const pd = W.pathDist(x, z) + (U.noise(x * 0.3, z * 0.3) - 0.5) * 1.6;
  let s = U.smooth(3.4, 2.4, pd);
  const patch = U.fbm(x * 0.035 + 11, z * 0.035 - 4);
  s = Math.max(s, U.smooth(0.66, 0.72, patch));
  const r = Math.hypot(x, z);
  s = Math.max(s, U.smooth(126, 134, r + (U.noise(x * 0.1, z * 0.1) - 0.5) * 4));
  const ru = W.areaDefs[0];
  const dr = Math.hypot(x - ru.x, z - ru.z);
  if (dr < 34) s = Math.max(s, U.smooth(0.55, 0.62, U.noise(x * 0.12 + 5, z * 0.12)) * U.smooth(34, 20, dr));
  return s;
};

// ---------- colisores ----------
W.addCollider = function (c) {
  c.br = c.type === 'c' ? c.r : Math.hypot(c.hx, c.hz);
  if (c.type === 'b') { c.cs = Math.cos(c.rot || 0); c.sn = Math.sin(c.rot || 0); }
  W.statics.push(c);
  const C = W.CELL;
  for (let ix = Math.floor((c.x - c.br) / C); ix <= Math.floor((c.x + c.br) / C); ix++)
    for (let iz = Math.floor((c.z - c.br) / C); iz <= Math.floor((c.z + c.br) / C); iz++) {
      const k = ix + ',' + iz;
      let arr = W.grid.get(k);
      if (!arr) { arr = []; W.grid.set(k, arr); }
      arr.push(c);
    }
  return c;
};

W.removeCollider = function (c) {
  const i = W.statics.indexOf(c);
  if (i >= 0) W.statics.splice(i, 1);
  for (const arr of W.grid.values()) { const j = arr.indexOf(c); if (j >= 0) arr.splice(j, 1); }
};

W.nearby = function (x, z, out) {
  out.length = 0;
  const C = W.CELL, ix = Math.floor(x / C), iz = Math.floor(z / C);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const arr = W.grid.get((ix + a) + ',' + (iz + b));
    if (arr) for (const c of arr) if (out.indexOf(c) < 0) out.push(c);
  }
  return out;
};

// paredes de gelo são registradas aqui pelo jogo
W.dynamic = [];

const _near = [];
// empurra um círculo (personagem) para fora dos obstáculos. Retorna true se colidiu.
W.collide = function (p, rad, feetY, height) {
  let hit = false;
  const list = W.nearby(p.x, p.z, _near);
  for (const d of W.dynamic) list.push(d);
  for (const c of list) {
    if (c.dead) continue;
    if (feetY + 0.4 > c.y1 || feetY + height < c.y0) continue; // dá para subir em blocos baixos
    if (c.type === 'c') {
      const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + rad;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) {
        const d = Math.sqrt(d2), k = (rr - d) / d;
        p.x += dx * k; p.z += dz * k; hit = true;
      }
    } else {
      const dx = p.x - c.x, dz = p.z - c.z;
      const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs;
      const qx = U.clamp(lx, -c.hx, c.hx), qz = U.clamp(lz, -c.hz, c.hz);
      let ex = lx - qx, ez = lz - qz;
      const d2 = ex * ex + ez * ez;
      if (d2 < rad * rad) {
        let px, pz;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), k = (rad - d) / d;
          px = ex * k; pz = ez * k;
        } else {
          const ox = c.hx - Math.abs(lx), oz = c.hz - Math.abs(lz);
          if (ox < oz) { px = (ox + rad) * Math.sign(lx || 1); pz = 0; } else { px = 0; pz = (oz + rad) * Math.sign(lz || 1); }
        }
        // volta para o mundo
        p.x += px * c.cs + pz * c.sn;
        p.z += -px * c.sn + pz * c.cs;
        hit = true;
      }
    }
  }
  return hit;
};

// altura do chão (terreno ou topo de bloco) logo abaixo do personagem
W.groundAt = function (x, z, y) {
  let g = W.height(x, z);
  const list = W.nearby(x, z, _near);
  for (const c of list) {
    if (c.type !== 'b' || c.dead || !c.walkable) continue;
    if (c.y1 > y + 0.45) continue;
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs;
    if (Math.abs(lx) <= c.hx + 0.15 && Math.abs(lz) <= c.hz + 0.15 && c.y1 > g) g = c.y1;
  }
  return g;
};

// ---------- raios (tiros, câmera, linha de visão) ----------
W.rayCollider = function (o, d, c, maxT) {
  if (c.type === 'c') {
    const ox = o.x - c.x, oz = o.z - c.z;
    const a = d.x * d.x + d.z * d.z;
    if (a < 1e-9) return -1;
    const b = ox * d.x + oz * d.z, cc = ox * ox + oz * oz - c.r * c.r;
    const disc = b * b - a * cc;
    if (disc < 0) return -1;
    let t = (-b - Math.sqrt(disc)) / a;
    if (t < 0) t = cc < 0 ? 0 : -1;
    if (t < 0 || t > maxT) return -1;
    const y = o.y + d.y * t;
    if (y < c.y0 || y > c.y1) return -1;
    return t;
  }
  const dx = o.x - c.x, dz = o.z - c.z;
  const lox = dx * c.cs - dz * c.sn, loz = dx * c.sn + dz * c.cs, loy = o.y;
  const ldx = d.x * c.cs - d.z * c.sn, ldz = d.x * c.sn + d.z * c.cs, ldy = d.y;
  let tmin = 0, tmax = maxT;
  const slab = (ro, rd, lo, hi) => {
    if (Math.abs(rd) < 1e-9) return ro >= lo && ro <= hi;
    let t1 = (lo - ro) / rd, t2 = (hi - ro) / rd;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };
  if (!slab(lox, ldx, -c.hx, c.hx)) return -1;
  if (!slab(loz, ldz, -c.hz, c.hz)) return -1;
  if (!slab(loy, ldy, c.y0, c.y1)) return -1;
  return tmin;
};

W.rayTerrain = function (o, d, maxT) {
  let prevT = 0;
  const step = 1.0;
  for (let t = step; t <= maxT; t += step) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < W.height(x, z)) {
      let lo = prevT, hi = t;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) / 2;
        if (o.y + d.y * m < W.height(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m;
      }
      return hi;
    }
    prevT = t;
  }
  return -1;
};

// Retorna {t, kind:'static'|'wall'|'terrain', col}
W.raycast = function (o, d, maxT, skipTerrain) {
  let best = maxT, hit = null;
  const hd = Math.sqrt(d.x * d.x + d.z * d.z);
  const ux = hd > 1e-6 ? d.x / hd : 0, uz = hd > 1e-6 ? d.z / hd : 0;
  for (const c of W.statics) {
    // descarte rápido pela distância horizontal do centro ao raio
    const cx = c.x - o.x, cz = c.z - o.z;
    if (hd > 1e-6) {
      const proj = cx * ux + cz * uz;
      if (proj < -c.br - 0.5 || proj > best * hd + c.br + 0.5) continue;
      const px = cx - ux * proj, pz = cz - uz * proj;
      if (px * px + pz * pz > (c.br + 0.5) * (c.br + 0.5)) continue;
    } else if (cx * cx + cz * cz > (c.br + 0.5) * (c.br + 0.5)) continue;
    const t = W.rayCollider(o, d, c, best);
    if (t >= 0 && t < best) { best = t; hit = { t: t, kind: 'static', col: c }; }
  }
  for (const c of W.dynamic) {
    if (c.dead) continue;
    const t = W.rayCollider(o, d, c, best);
    if (t >= 0 && t < best) { best = t; hit = { t: t, kind: 'wall', col: c }; }
  }
  if (!skipTerrain) {
    const t = W.rayTerrain(o, d, best);
    if (t >= 0 && t < best) { best = t; hit = { t: t, kind: 'terrain' }; }
  }
  return hit;
};

W.areaAt = function (x, z) {
  const r = Math.hypot(x, z);
  if (r > 128) return 'PRAIA';
  for (const a of W.areaDefs) if (Math.hypot(x - a.x, z - a.z) < a.r) return a.name;
  return null;
};

// ---------- construção da cena ----------
W.build = function (scene, quality) {
  W.scene = scene;
  W.quality = quality;
  const rnd = U.rng(1234);

  // céu em degradê
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2c78d8) }, mid: { value: new THREE.Color(0x77b9f0) }, hor: { value: new THREE.Color(0xd6eeff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h)); gl_FragColor = vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
  W.sky = sky;

  W.buildClouds(scene, rnd);

  // mar
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600, 1, 1), U.toon({ color: 0x35a6e0 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = W.SEA_Y;
  scene.add(sea);
  const shallow = new THREE.Mesh(new THREE.RingGeometry(140, 185, 96, 1), new THREE.MeshBasicMaterial({ color: 0x6fd3e8, transparent: true, opacity: 0.55, depthWrite: false }));
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y = W.SEA_Y + 0.02;
  scene.add(shallow);

  W.buildTerrain(scene);
  W.occupied = [];
  W.buildVillage(scene);
  W.buildTrees(scene, rnd);
  W.buildRuins(scene);
  W.buildCrates(scene, rnd);
  W.buildGrass(scene, quality);
};

W.buildClouds = function (scene, rnd) {
  const parts = [];
  for (let i = 0; i < 28; i++) {
    const a = rnd() * Math.PI * 2, r = 380 + rnd() * 300;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 70 + rnd() * 120;
    const n = 4 + Math.floor(rnd() * 5), w = 18 + rnd() * 26;
    for (let j = 0; j < n; j++) {
      const s = w * (0.35 + rnd() * 0.4);
      const ox = (j / (n - 1) - 0.5) * w * 2.2, oy = rnd() * s * 0.4;
      const p = U.part(U.blob(1, 2), 0xffffff, U.mat4(cx + ox * Math.cos(a + 1.57), cy + oy, cz + ox * Math.sin(a + 1.57), 0, 0, 0, s, s * 0.62, s));
      // base levemente rosada, como as nuvens do vídeo
      const pos = p.g.attributes.position, col = p.g.attributes.color;
      for (let k = 0; k < pos.count; k++) {
        const t = U.clamp((pos.getY(k) - cy) / (s * 0.5), 0, 1);
        col.setXYZ(k, U.lerp(0.98, 1, t), U.lerp(0.86, 1, t), U.lerp(0.92, 1, t));
      }
      parts.push(p.g);
    }
  }
  const m = new THREE.Mesh(U.merge(parts), U.toon({ vertexColors: true, emissive: 0x9aa6c0, fog: false }));
  scene.add(m);
  W.clouds = m;
};

W.buildTerrain = function (scene) {
  const SIZE = 440, SEG = 176;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, n = pos.count;
  const cols = new Float32Array(n * 3);
  const g1 = new THREE.Color(0x58ad36), g2 = new THREE.Color(0x86ca45), g3 = new THREE.Color(0x3f9a2e);
  const s1 = new THREE.Color(0xe8cd92), s2 = new THREE.Color(0xd7b676), wet = new THREE.Color(0xc9ad74);
  const c = new THREE.Color(), cs = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = W.height(x, z);
    pos.setY(i, y);
    const v = U.fbm(x * 0.06, z * 0.06);
    c.copy(g1).lerp(g2, U.smooth(0.45, 0.75, v)).lerp(g3, U.smooth(0.45, 0.2, v) * 0.7);
    cs.copy(s1).lerp(s2, U.noise(x * 0.2, z * 0.2) * 0.6);
    if (y < W.SEA_Y + 0.5) cs.copy(wet);
    c.lerp(cs, W.sand(x, z));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, U.toon({ vertexColors: true }));
  m.receiveShadow = true;
  scene.add(m);
  W.terrain = m;
};

// --- geometrias da vegetação ---
W.treeGeo = function (seed) {
  const r = U.rng(seed), parts = [];
  const trunkCol = 0xc46f34, trunkDark = 0x8d4a23;
  const lean = (r() - 0.5) * 0.25;
  parts.push(U.part(new THREE.CylinderGeometry(0.2, 0.34, 3.2, 7), trunkCol, U.mat4(0, 1.6, 0, 0, 0, lean)));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + r();
    const L = 1.4 + r() * 0.6;
    parts.push(U.part(new THREE.CylinderGeometry(0.07, 0.14, L, 5), i ? trunkCol : trunkDark,
      U.mat4(Math.cos(a) * 0.45, 2.9 + i * 0.2, Math.sin(a) * 0.45, Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75)));
  }
  const greens = [0x5fb83a, 0x7fd148, 0x6ac53f, 0x94de55];
  const nb = 6 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + r() * 0.6, d = i === 0 ? 0 : 1.1 + r() * 0.9;
    const s = 1.2 + r() * 0.7;
    parts.push(U.part(U.blob(1, 1), greens[i % greens.length],
      U.mat4(Math.cos(a) * d, 3.9 + r() * 0.9 + (i === 0 ? 0.6 : 0), Math.sin(a) * d, 0, r() * 3, 0, s * 1.25, s * 0.68, s * 1.25), 'radial'));
  }
  return U.build(parts);
};

W.palmGeo = function (seed) {
  const r = U.rng(seed), parts = [];
  const bend = 0.6 + r() * 0.8;
  let x = 0, y = 0;
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t = i / segs, h = 1.05;
    const ang = bend * t * 0.35;
    parts.push(U.part(new THREE.CylinderGeometry(0.15, 0.19, h, 6), i % 2 ? 0xb98a52 : 0xa8784a, U.mat4(x, y + h / 2, 0, 0, 0, -ang)));
    x += Math.sin(ang) * h; y += Math.cos(ang) * h;
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + r() * 0.3;
    const m = new THREE.Matrix4().makeTranslation(x, y, 0)
      .multiply(new THREE.Matrix4().makeRotationY(a))
      .multiply(new THREE.Matrix4().makeRotationZ(-0.55 - r() * 0.3))
      .multiply(new THREE.Matrix4().makeTranslation(1.3, 0, 0))
      .multiply(new THREE.Matrix4().makeScale(2.6, 0.12, 0.6));
    parts.push(U.part(new THREE.BoxGeometry(1, 1, 1), i % 2 ? 0x4aa93a : 0x63c046, m, 'radial'));
  }
  parts.push(U.part(U.blob(0.35, 1), 0x6b4a2a, U.mat4(x, y - 0.1, 0), 'radial'));
  return U.build(parts);
};

W.bushGeo = function () {
  const parts = [];
  parts.push(U.part(U.blob(1, 1), 0x4ea233, U.mat4(0, 0.5, 0, 0, 0, 0, 1.0, 0.75, 1.0), 'radial'));
  parts.push(U.part(U.blob(1, 1), 0x63b93c, U.mat4(0.7, 0.4, 0.2, 0, 0, 0, 0.7, 0.55, 0.7), 'radial'));
  parts.push(U.part(U.blob(1, 1), 0x5aae37, U.mat4(-0.6, 0.35, -0.3, 0, 0, 0, 0.65, 0.5, 0.65), 'radial'));
  return U.build(parts);
};

W.instanced = function (scene, pair, mats, thick, shadow) {
  const mat = U.toon({ vertexColors: true });
  const main = new THREE.InstancedMesh(pair.g, mat, mats.length);
  const ol = new THREE.InstancedMesh(pair.o, U.outlineMat(thick), mats.length);
  for (let i = 0; i < mats.length; i++) { main.setMatrixAt(i, mats[i]); ol.setMatrixAt(i, mats[i]); }
  main.castShadow = !!shadow;
  main.receiveShadow = false;
  main.computeBoundingSphere(); ol.computeBoundingSphere();
  scene.add(main); scene.add(ol);
  return main;
};

W.isFree = function (x, z, rad, list) {
  for (const p of list) { const dx = p[0] - x, dz = p[1] - z; if (dx * dx + dz * dz < (rad + p[2]) * (rad + p[2])) return false; }
  return true;
};

W.buildTrees = function (scene, rnd) {
  const keepOut = [W.areaDefs[0], W.areaDefs[1]];
  const variants = [W.treeGeo(11), W.treeGeo(29), W.treeGeo(57)];
  const vm = [[], [], []];
  let placed = 0, tries = 0;
  while (placed < 175 && tries < 9000) {
    tries++;
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 124;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const f = W.areaDefs[2];
    const inForest = Math.hypot(x - f.x, z - f.z) < f.r;
    if (!inForest && rnd() > 0.32) continue;
    if (W.sand(x, z) > 0.2 || W.pathDist(x, z) < 5) continue;
    let bad = false;
    for (const k of keepOut) if (Math.hypot(x - k.x, z - k.z) < k.r + 4) bad = true;
    if (bad || !W.isFree(x, z, 4.5, W.occupied)) continue;
    const s = 0.85 + rnd() * 0.5;
    const y = W.height(x, z);
    const v = placed % 3;
    vm[v].push(U.mat4(x, y - 0.1, z, 0, rnd() * Math.PI * 2, 0, s, s, s));
    W.occupied.push([x, z, 3]);
    W.addCollider({ type: 'c', x: x, z: z, r: 0.38 * s, y0: y - 1, y1: y + 3.4 * s });
    // copa bloqueia tiros acima do tronco
    placed++;
  }
  variants.forEach((g, i) => W.instanced(scene, g, vm[i], 0.05, true));

  // coqueiros na orla
  const palms = [W.palmGeo(3), W.palmGeo(8)];
  const pm = [[], []];
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, r = 127 + rnd() * 14;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!W.isFree(x, z, 3, W.occupied)) continue;
    const y = W.height(x, z), s = 0.9 + rnd() * 0.45;
    pm[i % 2].push(U.mat4(x, y - 0.1, z, 0, rnd() * Math.PI * 2, 0, s, s, s));
    W.occupied.push([x, z, 2]);
    W.addCollider({ type: 'c', x: x, z: z, r: 0.22 * s, y0: y - 1, y1: y + 5 * s });
  }
  palms.forEach((g, i) => W.instanced(scene, g, pm[i], 0.04, true));

  // arbustos
  const bm = [];
  for (let i = 0; i < 170; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 126;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (W.sand(x, z) > 0.3 || !W.isFree(x, z, 1.5, W.occupied)) continue;
    const s = 0.6 + rnd() * 0.7;
    bm.push(U.mat4(x, W.height(x, z) - 0.15, z, 0, rnd() * 6, 0, s, s, s));
    W.occupied.push([x, z, 1]);
  }
  W.instanced(scene, W.bushGeo(), bm, 0.04, true);
  // coqueiros entre as casas do Bairro Tropical
  const v = W.areaDefs[1], vp = [[], []];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * 30;
    const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
    if (!W.isFree(x, z, 1.5, W.occupied)) continue;
    const s = 0.75 + rnd() * 0.3, y = W.height(x, z);
    vp[i % 2].push(U.mat4(x, y - 0.1, z, 0, rnd() * 6, 0, s, s, s));
    W.occupied.push([x, z, 2]);
    W.addCollider({ type: 'c', x: x, z: z, r: 0.2 * s, y0: y - 1, y1: y + 5 * s });
  }
  palms.forEach((g, i) => W.instanced(scene, g, vp[i], 0.04, true));
};

W.solidMesh = function (scene, parts, thick) {
  const pair = U.build(parts);
  const m = new THREE.Mesh(pair.g, U.toon({ vertexColors: true }));
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  scene.add(new THREE.Mesh(pair.o, U.outlineMat(thick)));
  return m;
};

// bloco com colisor; walkable permite subir em cima
W.box = function (parts, x, z, w, h, d, rot, color, y0, opts) {
  const y = (y0 === undefined ? W.height(x, z) - 0.3 : y0);
  parts.push(U.part(new THREE.BoxGeometry(w, h, d), color, U.mat4(x, y + h / 2, z, 0, rot, 0), 'radial'));
  return W.addCollider(Object.assign({ type: 'b', x: x, z: z, hx: w / 2, hz: d / 2, rot: rot, y0: y, y1: y + h, walkable: true }, opts || {}));
};

W.buildRuins = function (scene) {
  const a = W.areaDefs[0], parts = [];
  const stone = [0xe6d7b4, 0xd9c9a3, 0xeee2c6];
  const base = a.h - 0.3;
  const R = (i) => stone[i % 3];
  // pátio quebrado: muros baixos com falhas
  const wall = (x0, z0, x1, z1, gaps, hBase) => {
    const len = Math.hypot(x1 - x0, z1 - z0), rot = -Math.atan2(z1 - z0, x1 - x0);
    const n = Math.round(len / 2.6);
    for (let i = 0; i < n; i++) {
      if (gaps.indexOf(i) >= 0) continue;
      const t = (i + 0.5) / n;
      const h = hBase * (0.55 + U.hash2(x0 + i, z0) * 0.6);
      W.box(parts, U.lerp(x0, x1, t) + a.x, U.lerp(z0, z1, t) + a.z, len / n - 0.15, h, 1.0, rot, R(i), base);
    }
  };
  wall(-16, -16, 16, -16, [2, 3, 8], 1.8);
  wall(16, -16, 16, 16, [5, 6], 1.6);
  wall(16, 16, -16, 16, [1, 7, 8], 1.8);
  wall(-16, 16, -16, -16, [3, 4, 5], 1.4);
  // blocos soltos e plataformas no centro
  const blocks = [[-6, -4, 3, 0.9, 3, 0.2], [5, 6, 4, 1.1, 2.4, -0.4], [7, -7, 2.2, 0.8, 2.2, 0.7], [-8, 8, 3.5, 0.7, 2, 0.1],
    [0, 0, 5, 0.6, 5, 0], [0, 0, 3, 1.2, 3, 0.785], [-25, 4, 3, 1, 2, 0.3], [24, -6, 2.5, 0.9, 3, -0.2], [3, -25, 3, 1.2, 2, 0.5], [-4, 26, 4, 0.8, 2.5, 0.2]];
  blocks.forEach((b, i) => W.box(parts, a.x + b[0], a.z + b[1], b[2], b[3], b[4], b[5], R(i), base));
  // pilares claros
  const pill = [[-12, -12], [12, -12], [12, 12], [-12, 12], [-20, -22], [22, 20]];
  pill.forEach((p, i) => {
    const h = i < 4 ? 4.2 : 2.6;
    const x = a.x + p[0], z = a.z + p[1];
    parts.push(U.part(new THREE.CylinderGeometry(0.55, 0.62, h, 10), 0xf4efe2, U.mat4(x, base + h / 2, z)));
    parts.push(U.part(new THREE.BoxGeometry(1.5, 0.35, 1.5), 0xe2d6bb, U.mat4(x, base + h + 0.17, z), 'radial'));
    W.addCollider({ type: 'c', x: x, z: z, r: 0.62, y0: base, y1: base + h + 0.4 });
  });
  W.solidMesh(scene, parts, 0.05);
};

// Bairro Tropical: casas brancas com telhado de cerâmica, janelas azuis com venezianas e interior visitável
W.houses = [];
W.lootSpots = [];
W.buildVillage = function (scene) {
  const a = W.areaDefs[1], parts = [];
  const base = a.h - 0.05;
  const spots = [[-17, -15, 0], [-2, -16, 0.04], [13, -14, -0.04], [-18, 1, Math.PI], [-3, 0, Math.PI], [12, 2, Math.PI + 0.05],
    [-16, 16, 0], [-1, 17, 0.03], [14, 17, -0.03], [27, -3, Math.PI / 2], [-29, 3, -Math.PI / 2]];
  spots.forEach((p, i) => W.house(parts, a.x + p[0], a.z + p[1], p[2], base, i));
  W.solidMesh(scene, parts, 0.035);
};

W.house = function (parts, x, z, rot, base, idx) {
  const HW = 3.4, HD = 2.8, H = 2.9, T = 0.22;
  const c = Math.cos(rot), s = Math.sin(rot);
  const wx = (lx, lz) => x + lx * c + lz * s, wz = (lx, lz) => z - lx * s + lz * c;
  const WALL = 0xf7f5ef, BAND = 0xe2763a, BLUE = 0x2f6fd6, WOOD = 0x9a6233;
  const box = (lx, ly, lz, w, h, d, col, collide, walk) => {
    parts.push(U.part(new THREE.BoxGeometry(w, h, d), col, U.mat4(wx(lx, lz), base + ly + h / 2, wz(lx, lz), 0, rot, 0), 'radial'));
    if (collide) W.addCollider({ type: 'b', x: wx(lx, lz), z: wz(lx, lz), hx: w / 2, hz: d / 2, rot: rot, y0: base + ly, y1: base + ly + h, walkable: !!walk });
  };
  // parede com aberturas [centro, largura, y0, y1]; along = 'x' (frente/fundos) ou 'z' (laterais)
  const wallRun = (along, fixed, half, ops, out) => {
    let cur = -half;
    const seg = (a, b, y0, y1, band) => {
      const len = b - a, mid = (a + b) / 2;
      if (len <= 0.01 || y1 - y0 <= 0.01) return;
      if (along === 'x') box(mid, y0, fixed, len, y1 - y0, T, WALL, true);
      else box(fixed, y0, mid, T, y1 - y0, len, WALL, true);
      if (band) {
        if (along === 'x') box(mid, 0, fixed, len, 0.32, T + 0.05, BAND, false);
        else box(fixed, 0, mid, T + 0.05, 0.32, len, BAND, false);
      }
    };
    ops.sort((p, q) => p[0] - q[0]);
    for (const o of ops) {
      const a = o[0] - o[1] / 2, b = o[0] + o[1] / 2;
      seg(cur, a, 0, H, true);
      if (o[2] > 0) seg(a, b, 0, o[2], true);
      seg(a, b, o[3], H, false);
      // moldura azul e venezianas abertas (janelas) ou batente de madeira (porta)
      const isDoor = o[2] <= 0, fc = isDoor ? WOOD : BLUE, w = o[1], hh = o[3] - o[2];
      const fr = (p, q, y, fw, fh) => (along === 'x' ? box(p, y, fixed, fw, fh, T + 0.08, fc, false) : box(fixed, y, p, T + 0.08, fh, fw, fc, false));
      fr(a - 0.04, 0, o[2], 0.08, hh); fr(b + 0.04, 0, o[2], 0.08, hh);
      fr(o[0], 0, o[3], w + 0.16, 0.08);
      if (!isDoor) {
        fr(o[0], 0, o[2] - 0.08, w + 0.16, 0.08);
        for (const sd of [-1, 1]) {
          const p = o[0] + sd * (w / 2 + w / 4 + 0.1);
          if (along === 'x') box(p, o[2] - 0.05, fixed + out * (T / 2 + 0.05), w / 2, hh + 0.1, 0.05, BLUE, false);
          else box(fixed + out * (T / 2 + 0.05), o[2] - 0.05, p, 0.05, hh + 0.1, w / 2, BLUE, false);
        }
      }
      cur = b;
    }
    seg(cur, half, 0, H, true);
  };
  wallRun('x', HD, HW + T / 2, [[-1.0, 1.3, 0, 2.2], [1.6, 1.1, 1.0, 2.0]], 1);
  wallRun('x', -HD, HW + T / 2, [[0.8 * (idx % 2 ? 1 : -1), 1.1, 1.0, 2.0]], -1);
  wallRun('z', HW, HD - T / 2, [[0.3, 1.1, 1.0, 2.0]], 1);
  wallRun('z', -HW, HD - T / 2, [[-0.3, 1.1, 1.0, 2.0]], -1);
  // piso, forro, telhado de quatro águas e chaminé
  box(0, -0.4, 0, HW * 2, 0.5, HD * 2, 0xd4823a, true, true);
  box(0, H, 0, HW * 2 + T, 0.1, HD * 2 + T, 0xffffff, false);
  const roof = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4);
  parts.push(U.part(roof, 0xd84f2a, new THREE.Matrix4().compose(new THREE.Vector3(x, base + H + 0.1 + 0.8, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3((HW * 2 + 1) / Math.SQRT2, 1.6, (HD * 2 + 1) / Math.SQRT2)), 'radial'));
  box(HW * 0.45, H + 0.5, -HD * 0.3, 0.45, 1.0, 0.45, 0xf2efe6, false);
  // móveis
  box(-HW + 0.7, 0.1, -HD + 1.15, 1.0, 0.35, 1.9, WOOD, true, true);
  box(-HW + 0.7, 0.45, -HD + 1.35, 0.95, 0.1, 1.4, 0x2f63c8, false);
  box(-HW + 0.7, 0.45, -HD + 0.45, 0.75, 0.12, 0.35, 0xffffff, false);
  box(HW - 1.1, 0.1, 0.3, 0.18, 0.66, 0.18, WOOD, true);
  box(HW - 1.1, 0.76, 0.3, 1.1, 0.08, 0.75, 0xb57a42, false);
  box(0.6, 0.1, -HD + 0.38, 1.3, 1.5, 0.4, 0x7a4a26, true);
  box(0.4, 0.1, 0.6, 1.6, 0.02, 1.1, 0x3f9f6a, false);
  // lixeira verde do lado de fora
  box(HW + 0.75, 0, HD + 0.5, 0.55, 0.85, 0.55, 0x2e9a4a, true);
  W.lootSpots.push([wx(0.2, 0.8), wz(0.2, 0.8)], [wx(-1.8, 1.6), wz(-1.8, 1.6)]);
  W.occupied.push([x, z, 6.5]);
  W.houses.push({ x: x, z: z, c: c, s: s, hw: HW + 0.35, hd: HD + 0.35 });
};

W.inHouse = function (x, z) {
  for (const h of W.houses) {
    const dx = x - h.x, dz = z - h.z;
    if (dx * dx + dz * dz > 30) continue;
    const lx = dx * h.c - dz * h.s, lz = dx * h.s + dz * h.c;
    if (Math.abs(lx) < h.hw && Math.abs(lz) < h.hd) return true;
  }
  return false;
};

W.buildCrates = function (scene, rnd) {
  const parts = [];
  let n = 0, tries = 0;
  while (n < 34 && tries < 2000) {
    tries++;
    const a = rnd() * Math.PI * 2, r = 15 + Math.sqrt(rnd()) * 108;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!W.isFree(x, z, 2.5, W.occupied)) continue;
    const s = 1.1 + rnd() * 0.4;
    const rot = rnd() * 3;
    W.box(parts, x, z, s, s, s, rot, n % 2 ? 0xb47c45 : 0xa86f3c, W.height(x, z) - 0.05);
    parts.push(U.part(new THREE.BoxGeometry(s * 1.02, 0.14, s * 1.02), 0x7d4f28, U.mat4(x, W.height(x, z) + s * 0.5, z, 0, rot, 0)));
    W.occupied.push([x, z, 1.5]);
    n++;
  }
  W.solidMesh(scene, parts, 0.04);
};

// --- grama instanciada que acompanha o jogador (fixa no mundo, sem "deslizar") ---
W.buildGrass = function (scene, quality) {
  const counts = { baixa: 2600, media: 5200, alta: 9000 };
  W.grassN = counts[quality] || 5200;
  W.grassSize = quality === 'baixa' ? 44 : 60;
  const blade = new THREE.BufferGeometry();
  const v = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI + 0.3, c = Math.cos(a) * 0.1, s = Math.sin(a) * 0.1;
    const lx = Math.cos(a + 1.2) * 0.12, lz = Math.sin(a + 1.2) * 0.12;
    v.push(-c, 0, -s, c, 0, s, lx, 0.34 + i * 0.05, lz);
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  blade.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uBase: { value: new THREE.Color(0x3f8f2a) }, uTip: { value: new THREE.Color(0xa8e05c) } },
    vertexShader: [
      'uniform float uTime; varying float vH; varying float vR;',
      'void main(){',
      ' vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0);',
      ' float h = position.y; vH = h / 0.5;',
      ' vR = fract(sin(dot(wp.xz, vec2(12.9898,78.233))) * 43758.5453);',
      ' float w = sin(uTime*2.2 + wp.x*0.35 + wp.z*0.25) * 0.5 + sin(uTime*3.7 + wp.x*0.9) * 0.25;',
      ' wp.x += w * 0.16 * vH; wp.z += w * 0.08 * vH;',
      ' gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'].join('\n'),
    fragmentShader: [
      'uniform vec3 uBase; uniform vec3 uTip; varying float vH; varying float vR;',
      'void main(){ vec3 c = mix(uBase, uTip, smoothstep(0.0, 1.0, vH)); c *= 0.88 + vR*0.22; gl_FragColor = vec4(c,1.0); }'].join('\n'),
  });
  W.grass = new THREE.InstancedMesh(blade, mat, W.grassN);
  W.grass.frustumCulled = false;
  scene.add(W.grass);
  W.grassMat = mat;

  // flores brancas e rosas
  const fl = [];
  fl.push(U.part(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 3), 0x4a9a30, U.mat4(0, 0.17, 0)).g);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    fl.push(U.part(new THREE.SphereGeometry(0.045, 5, 3), 0xffffff, U.mat4(Math.cos(a) * 0.05, 0.36, Math.sin(a) * 0.05, 0, 0, 0, 1, 0.4, 1)).g);
  }
  fl.push(U.part(new THREE.SphereGeometry(0.03, 5, 3), 0xffd23c, U.mat4(0, 0.37, 0)).g);
  W.flowerN = Math.floor(W.grassN / 14);
  W.flowers = new THREE.InstancedMesh(U.merge(fl), U.toon({ vertexColors: true }), W.flowerN);
  W.flowers.frustumCulled = false;
  scene.add(W.flowers);
  W.grassCenter = { x: 1e9, z: 1e9 };
};

W.placeGrass = function (cx, cz) {
  const S = W.grassSize, N = W.grassN, side = Math.ceil(Math.sqrt(N)), sp = S / side;
  const ox = Math.floor((cx - S / 2) / sp), oz = Math.floor((cz - S / 2) / sp);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let k = 0, f = 0;
  const fcol = [new THREE.Color(0xffffff), new THREE.Color(0xff9fc8), new THREE.Color(0xfff07a)];
  for (let i = 0; i < side && k < N; i++) for (let j = 0; j < side && k < N; j++) {
    const gx = ox + i, gz = oz + j;
    const x = (gx + U.hash2(gx, gz)) * sp, z = (gz + U.hash2(gz + 7, gx - 3)) * sp;
    const sa = W.sand(x, z), y = W.height(x, z);
    let sc = (0.8 + U.hash2(gx * 3, gz) * 0.6) * (1 - U.smooth(0.15, 0.55, sa));
    if (y < W.SEA_Y + 0.2 || W.inHouse(x, z)) sc = 0;
    e.set(0, U.hash2(gx, gz * 5) * 6.28, 0); q.setFromEuler(e);
    p.set(x, y - 0.03, z); s.set(sc, sc * (0.75 + U.hash2(gz, gx) * 0.6), sc);
    m.compose(p, q, s);
    W.grass.setMatrixAt(k++, m);
    if (f < W.flowerN && U.hash2(gx * 13, gz * 7) < 0.075 && sc > 0.3) {
      m.compose(p, q, s.set(1, 0.8 + U.hash2(gx, gz) * 0.6, 1));
      W.flowers.setMatrixAt(f, m);
      W.flowers.setColorAt(f, fcol[Math.floor(U.hash2(gx + 1, gz) * 3)]);
      f++;
    }
  }
  W.grass.count = k;
  W.flowers.count = f;
  W.grass.instanceMatrix.needsUpdate = true;
  W.flowers.instanceMatrix.needsUpdate = true;
  if (W.flowers.instanceColor) W.flowers.instanceColor.needsUpdate = true;
};

W.update = function (dt, px, pz) {
  W.time += dt;
  if (W.grassMat) W.grassMat.uniforms.uTime.value = W.time;
  if (Math.hypot(px - W.grassCenter.x, pz - W.grassCenter.z) > W.grassSize * 0.14) {
    W.grassCenter.x = px; W.grassCenter.z = pz;
    W.placeGrass(px, pz);
  }
  if (W.clouds) W.clouds.rotation.y += dt * 0.002;
};
