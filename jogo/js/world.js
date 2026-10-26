'use strict';
// Mundo: ilha com vilas, porto, fazenda, farol, ruínas, lagoa, floresta, mar animado e céu.
const W = {
  LAND_R: 172,      // onde começa a praia
  PLAY_R: 196,      // limite para andar (água rasa)
  SEA_Y: -0.6,
  statics: [],
  grid: new Map(),
  CELL: 8,
  time: 0,
  houses: [],
  lootSpots: [],
  _stamp: 0,
};

// ---------- mapas ----------
// Cada mapa define as áreas (com marcadores: flat, lake, forest, hills, peak, sandy, ruins, fields, rice, runway, palms),
// as estradas, o formato da ilha (tri = quanto ela vira um triângulo) e a lista de construções (maps.js).
W.MAPS = {};
W.mapId = null;
W.shape = () => 1;
W.setMap = function (id) {
  const m = W.MAPS[id] || W.MAPS.ilha;
  W.mapId = W.MAPS[id] ? id : 'ilha';
  W.MAP = m;
  W.LAND_R = m.landR; W.PLAY_R = m.playR;
  const tri = m.tri || 0, rot = m.triRot || 0;
  W.shape = tri ? (ang) => 1 + tri * Math.cos(3 * (ang - rot)) : () => 1;
  W.areaDefs = m.areas.map(a => Object.assign({}, a));
  W.A = {};
  for (const a of W.areaDefs) W.A[a.name] = a;
  W.lakes = W.areaDefs.filter(a => a.lake);
  W.flats = W.areaDefs.filter(a => a.flat);
  W.paths = m.paths;
  W.segs = [];
  for (const p of W.paths) for (let i = 0; i < p.length - 1; i++) W.segs.push([p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]]);
  for (const a of W.areaDefs) a.h = W.baseH(a.x, a.z) + (a.lift || 0);
  for (const a of W.lakes) a.h = -2.2;
};
// distância "normalizada" até o centro: 1 = linha da praia (leva em conta o formato da ilha)
W.coastK = function (x, z) {
  return (Math.hypot(x, z) + (U.noise(x * 0.02 + 9, z * 0.02) - 0.5) * 14) / W.shape(Math.atan2(z, x));
};
// ponto aleatório em terra firme
W.randLand = function (rnd, margin) {
  for (let i = 0; i < 40; i++) {
    const an = rnd() * 6.28, r = Math.sqrt(rnd()) * (W.LAND_R * 1.2);
    const x = Math.cos(an) * r, z = Math.sin(an) * r;
    if (W.coastK(x, z) < W.LAND_R - (margin || 14) && W.height(x, z) > 0.3) return [x, z];
  }
  return [0, 0];
};

W.pathDist = function (x, z) {
  let best = 1e9;
  for (const s of W.segs) {
    const dx = s[2] - s[0], dz = s[3] - s[1];
    // descarte rápido pela caixa do segmento
    if (x < Math.min(s[0], s[2]) - 8 || x > Math.max(s[0], s[2]) + 8 || z < Math.min(s[1], s[3]) - 8 || z > Math.max(s[1], s[3]) + 8) continue;
    let t = ((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = s[0] + dx * t - x, ez = s[1] + dz * t - z;
    const d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
};

// ---------- relevo ----------
W.baseH = function (x, z) {
  let h = 1.6 + (U.fbm(x * 0.008 + 3.1, z * 0.008 - 7.3) - 0.5) * 8 + (U.noise(x * 0.05, z * 0.05) - 0.5) * 0.6;
  for (const c of W.areaDefs) {
    // colinas
    if (c.hills) h += U.smooth(55, 0, Math.hypot(x - c.x, z - c.z)) * (U.fbm(x * 0.03, z * 0.03) * c.hills);
    // montanha com encostas quebradas
    if (c.peak) { const d = Math.hypot(x - c.x, z - c.z), k = U.smooth(c.r + 75, c.r * 0.6, d); h += Math.pow(k, 1.6) * c.peak * (0.85 + U.fbm(x * 0.04 + 2, z * 0.04) * 0.3); }
  }
  return h;
};

W.height = function (x, z) {
  let h = W.baseH(x, z);
  for (const a of W.flats) {
    const d = Math.hypot(x - a.x, z - a.z);
    if (d < a.r + 14) h = U.lerp(h, a.h, U.smooth(a.r + 14, a.r - 4, d));
  }
  // sem poças de mar no meio da ilha: o chão interno não desce abaixo da água (só nos lagos)
  const k0 = W.coastK(x, z);
  if (h < 0.25 && k0 < W.LAND_R - 10) h = U.lerp(h, 0.25 - (0.25 - h) * 0.12, U.smooth(W.LAND_R - 10, W.LAND_R - 26, k0));
  for (const l of W.lakes) {
    const dl = Math.hypot(x - l.x, z - l.z);
    if (dl < l.r + 10) h = U.lerp(h, -2.2, U.smooth(l.r + 10, l.r - 6, dl + (U.noise(x * 0.15, z * 0.15) - 0.5) * 5));
  }
  const pd = W.pathDist(x, z);
  if (pd < 6) h -= (1 - pd / 6) * 0.12;
  if (k0 > W.LAND_R - 6) h = U.lerp(h, -3, U.smooth(W.LAND_R - 6, W.LAND_R + 26, k0));
  return h;
};

// quanto de areia existe num ponto (0 = grama, 1 = areia)
W.sand = function (x, z) {
  const pd = W.pathDist(x, z) + (U.noise(x * 0.3, z * 0.3) - 0.5) * 1.6;
  let s = U.smooth(3.6, 2.6, pd);
  const patch = U.fbm(x * 0.035 + 11, z * 0.035 - 4);
  s = Math.max(s, U.smooth(0.68, 0.74, patch));
  const r = W.coastK(x, z);
  s = Math.max(s, U.smooth(W.LAND_R - 12, W.LAND_R - 4, r + (U.noise(x * 0.1, z * 0.1) - 0.5) * 4));
  for (const a of W.areaDefs) {
    if (!a.sandy && !a.ruins) continue;
    const d = Math.hypot(x - a.x, z - a.z);
    if (d < a.r) s = Math.max(s, (a.ruins ? U.smooth(0.55, 0.62, U.noise(x * 0.12 + 5, z * 0.12)) : a.sandy) * U.smooth(a.r, a.r - 10, d));
  }
  for (const l of W.lakes) s = Math.max(s, U.smooth(l.r + 4, l.r - 2, Math.hypot(x - l.x, z - l.z)) * 0.8);
  return s;
};

// cor do chão num ponto (usada pelo terreno e pela grama)
const _gc = { g1: new THREE.Color(0x4f7a26), g2: new THREE.Color(0x7a943a), g3: new THREE.Color(0x355f1f), s1: new THREE.Color(0xdcc89e), s2: new THREE.Color(0xc9ae80),
  wet: new THREE.Color(0xa38c66), rock: new THREE.Color(0x7d7b72), field: new THREE.Color(0x8c9b3c), dirt: new THREE.Color(0x86684a), c: new THREE.Color(), cs: new THREE.Color(),
  rice: new THREE.Color(0x86c23c), paddy: new THREE.Color(0x5d8079), asphalt: new THREE.Color(0x3c3f42), paint: new THREE.Color(0xe8e6dc) };
W.groundColor = function (x, z, y, out) {
  const v = U.fbm(x * 0.05, z * 0.05);
  const c = out || _gc.c;
  c.copy(_gc.g1).lerp(_gc.g2, U.smooth(0.45, 0.78, v)).lerp(_gc.g3, U.smooth(0.42, 0.18, v) * 0.75);
  // manchas de terra batida
  c.lerp(_gc.dirt, U.smooth(0.62, 0.8, U.fbm(x * 0.11 + 40, z * 0.11)) * 0.55);
  for (const f of W.areaDefs) {
    // plantação em faixas (fazenda) e arrozais (verde vivo com água entre os canteiros)
    if (f.fields) {
      const df = Math.hypot(x - f.x - f.fields[0], z - f.z - f.fields[1]);
      if (df < f.fields[2]) { const stripe = Math.sin((x - f.x) * 0.9) > 0.2; c.lerp(stripe ? _gc.field : _gc.dirt, U.smooth(f.fields[2], f.fields[2] - 6, df) * 0.85); }
    }
    if (f.rice) {
      const df = Math.hypot(x - f.x, z - f.z);
      if (df < f.r) { const k = Math.sin((x - f.x) * 0.55 + Math.sin((z - f.z) * 0.08) * 2) > -0.35; c.lerp(k ? _gc.rice : _gc.paddy, U.smooth(f.r, f.r - 8, df) * 0.9); }
    }
    // pista de pouso: asfalto com faixas brancas
    if (f.runway) {
      const rw = f.runway, ca = Math.cos(rw[0]), sa = Math.sin(rw[0]);
      const rx = x - f.x - (rw[3] || 0), rz = z - f.z - (rw[4] || 0), lx = rx * ca + rz * sa, lz = -rx * sa + rz * ca;
      if (Math.abs(lx) < rw[1] && Math.abs(lz) < rw[2]) {
        const line = (Math.abs(lz) < 0.35 && (Math.floor(lx / 4) % 2 === 0)) || Math.abs(Math.abs(lz) - rw[2] + 1) < 0.3;
        c.copy(line ? _gc.paint : _gc.asphalt);
        return c;
      }
    }
  }
  // encostas íngremes viram pedra
  const sl = Math.abs(W.baseH(x + 1, z) - W.baseH(x - 1, z)) + Math.abs(W.baseH(x, z + 1) - W.baseH(x, z - 1));
  c.lerp(_gc.rock, U.smooth(1.4, 2.4, sl) * 0.8);
  _gc.cs.copy(_gc.s1).lerp(_gc.s2, U.noise(x * 0.2, z * 0.2) * 0.6);
  if (y < W.SEA_Y + 0.5) _gc.cs.copy(_gc.wet);
  c.lerp(_gc.cs, W.sand(x, z));
  return c;
};

// ---------- colisores ----------
W.addCollider = function (c) {
  c.br = c.type === 'c' ? c.r : Math.hypot(c.hx, c.hz);
  if (c.type === 'b') { c.cs = Math.cos(c.rot || 0); c.sn = Math.sin(c.rot || 0); }
  c._s = 0;
  W.statics.push(c);
  const C = W.CELL;
  for (let ix = Math.floor((c.x - c.br) / C); ix <= Math.floor((c.x + c.br) / C); ix++)
    for (let iz = Math.floor((c.z - c.br) / C); iz <= Math.floor((c.z + c.br) / C); iz++) {
      const k = ix * 4096 + iz;
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
  const st = ++W._stamp;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const arr = W.grid.get((ix + a) * 4096 + (iz + b));
    if (arr) for (const c of arr) if (c._s !== st) { c._s = st; out.push(c); }
  }
  return out;
};

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
      const ex = lx - qx, ez = lz - qz;
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
  const fl = W.floorAt(x, z);
  if (fl && g > fl.b - 0.15) g = fl.b - 0.15; // dentro de construção vale o piso, não o morro
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
  // eixo x
  if (Math.abs(ldx) < 1e-9) { if (lox < -c.hx || lox > c.hx) return -1; }
  else { let t1 = (-c.hx - lox) / ldx, t2 = (c.hx - lox) / ldx; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(ldz) < 1e-9) { if (loz < -c.hz || loz > c.hz) return -1; }
  else { let t1 = (-c.hz - loz) / ldz, t2 = (c.hz - loz) / ldz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(ldy) < 1e-9) { if (loy < c.y0 || loy > c.y1) return -1; }
  else { let t1 = (c.y0 - loy) / ldy, t2 = (c.y1 - loy) / ldy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  return tmin;
};

W.rayTerrain = function (o, d, maxT) {
  let prevT = 0;
  const step = 1.0;
  for (let t = step; t <= maxT + step; t += step) {
    const tt = Math.min(t, maxT);
    const x = o.x + d.x * tt, y = o.y + d.y * tt, z = o.z + d.z * tt;
    if (y < W.height(x, z)) {
      let lo = prevT, hi = tt;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) / 2;
        if (o.y + d.y * m < W.height(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m;
      }
      return hi;
    }
    prevT = tt;
    if (tt >= maxT) break;
  }
  return -1;
};

// Percorre as células da grade ao longo do raio (rápido mesmo com milhares de colisores)
// Retorna {t, kind:'static'|'wall'|'terrain', col}
W.raycast = function (o, d, maxT, skipTerrain) {
  let best = maxT, hit = null;
  const C = W.CELL, st = ++W._stamp;
  let ix = Math.floor(o.x / C), iz = Math.floor(o.z / C);
  const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
  const ax = Math.abs(d.x) > 1e-9, az = Math.abs(d.z) > 1e-9;
  let tMaxX = ax ? ((ix + (sx > 0 ? 1 : 0)) * C - o.x) / d.x : Infinity;
  let tMaxZ = az ? ((iz + (sz > 0 ? 1 : 0)) * C - o.z) / d.z : Infinity;
  const tdx = ax ? C / Math.abs(d.x) : Infinity, tdz = az ? C / Math.abs(d.z) : Infinity;
  let tCur = 0;
  for (let guard = 0; guard < 400; guard++) {
    const arr = W.grid.get(ix * 4096 + iz);
    if (arr) for (const c of arr) {
      if (c._s === st) continue;
      c._s = st;
      const t = W.rayCollider(o, d, c, best);
      if (t >= 0 && t < best) { best = t; hit = { t: t, kind: 'static', col: c }; }
    }
    if (tCur > best) break;
    if (tMaxX < tMaxZ) { ix += sx; tCur = tMaxX; tMaxX += tdx; } else { iz += sz; tCur = tMaxZ; tMaxZ += tdz; }
    if (tCur === Infinity || tCur > best) break;
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

// normal da superfície atingida (para faíscas e marcas de tiro)
W.hitNormal = function (hit, p, out) {
  out = out || new THREE.Vector3();
  if (!hit || hit.kind === 'terrain') {
    const e = 0.5;
    return out.set(W.height(p.x - e, p.z) - W.height(p.x + e, p.z), 2 * e, W.height(p.x, p.z - e) - W.height(p.x, p.z + e)).normalize();
  }
  const c = hit.col;
  if (c.type === 'c') {
    if (Math.abs(p.y - c.y1) < 0.05) return out.set(0, 1, 0);
    return out.set(p.x - c.x, 0, p.z - c.z).normalize();
  }
  if (Math.abs(p.y - c.y1) < 0.03) return out.set(0, 1, 0);
  if (Math.abs(p.y - c.y0) < 0.03) return out.set(0, -1, 0);
  const dx = p.x - c.x, dz = p.z - c.z;
  const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs;
  let nx = 0, nz = 0;
  if (Math.abs(lx) / c.hx > Math.abs(lz) / c.hz) nx = Math.sign(lx); else nz = Math.sign(lz);
  return out.set(nx * c.cs + nz * c.sn, 0, -nx * c.sn + nz * c.cs);
};

W.areaAt = function (x, z) {
  for (const a of W.areaDefs) if (Math.hypot(x - a.x, z - a.z) < a.r) return a.name;
  if (W.coastK(x, z) > W.LAND_R - 8) return 'PRAIA';
  return null;
};

W.isFree = function (x, z, rad, list) {
  for (const p of list) { const dx = p[0] - x, dz = p[1] - z; if (dx * dx + dz * dz < (rad + p[2]) * (rad + p[2])) return false; }
  return true;
};

// ---------- construção da cena ----------
// construção em etapas (a tela de carregamento mostra o progresso)
W.buildSteps = function (scene, quality, mapId) {
  W.scene = scene;
  W.quality = quality;
  W.setMap(mapId || W.mapId || 'ilha');
  const rnd = U.rng(1234);
  const P = [];
  // tudo que é do mapa fica em W.root (para trocar de mapa sem recarregar a página)
  if (W.root) { scene.remove(W.root); W.root.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
  W.root = new THREE.Group(); scene.add(W.root);
  const R = W.root;
  W.statics = []; W.grid = new Map(); W.dynamic = []; W.houses = []; W.lootSpots = []; W.olSets = []; W.occupied = []; W.spinners = [];
  W.grassCenter = { x: 1e9, z: 1e9 };
  const steps = [];
  if (!W.sky) steps.push(['Céu e nuvens', () => { W.buildSky(scene); W.buildClouds(scene, rnd); if (typeof renderer !== 'undefined') W.buildEnv(renderer, scene); }]);
  steps.push(['Terreno', () => W.buildTerrain(R)]);
  if (!W.seaMat) steps.push(['Mar', () => W.buildSea(scene)]); else steps.push(['Mar', () => W.updateSeaDepth()]);
  W.MAP.build.forEach((b, i) => steps.push([b[0], () => b[1](P, rnd)]));
  steps.push(['Pedras e caixas', () => { W.buildRocks(P, rnd); W.buildCrates(P, rnd); W.solidMesh(R, P, 0.04); }]);
  steps.push(['Árvores', () => { W.carveFloors(); W.buildTrees(R, rnd); }]);
  steps.push(['Grama', () => W.buildGrass(R, quality)]);
  return steps;
};
W.build = function (scene, quality) { for (const s of W.buildSteps(scene, quality)) s[1](); };

W.SUN = new THREE.Vector3(-0.55, 0.62, 0.42).normalize();
W.buildSky = function (scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x1a56ad) }, mid: { value: new THREE.Color(0x4a8bd6) }, hor: { value: new THREE.Color(0xbcd5ea) }, sun: { value: W.SUN } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sun; varying vec3 vP;',
      'void main(){ vec3 n = normalize(vP); float h = n.y;',
      ' vec3 c = mix(hor, mid, smoothstep(-0.02, 0.25, h)); c = mix(c, top, smoothstep(0.25, 0.9, h));',
      ' float s = max(dot(n, sun), 0.0);',
      ' c += vec3(1.0, 0.86, 0.62) * pow(s, 8.0) * 0.28 + vec3(1.0, 0.95, 0.85) * pow(s, 64.0) * 0.5;',
      ' c += vec3(1.0, 0.98, 0.9) * smoothstep(0.9988, 0.9994, s) * 2.0;',
      ' c = mix(c, hor * 1.02, smoothstep(0.02, -0.1, h));',
      ' gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '}'].join('\n'),
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
  W.sky = sky;
};

// textura de nuvem: várias bolas suaves sobrepostas, base mais escura
W.cloudTex = function (seed) {
  return U.canvasTex(256, 128, (g, w, h) => {
    const r = U.rng(seed);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const x = w * (0.15 + r() * 0.7), y = h * (0.45 + (r() - 0.5) * 0.35) - Math.sin((x / w) * Math.PI) * h * 0.12, rad = h * (0.14 + r() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const shade = Math.floor(232 + (y / h) * -30 + 20);
      gr.addColorStop(0, 'rgba(' + shade + ',' + shade + ',' + (shade + 6) + ',0.55)');
      gr.addColorStop(1, 'rgba(' + shade + ',' + shade + ',' + (shade + 6) + ',0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
};

// nuvens: anel no horizonte e uma camada sobre a ilha na altura do salto (todas num desenho só)
W.buildClouds = function (scene, rnd) {
  const texs = [W.cloudTex(3), W.cloudTex(9), W.cloudTex(21)];
  // junta as 3 texturas numa faixa vertical
  const atlas = U.canvasTex(256, 384, (g) => { texs.forEach((t, i) => g.drawImage(t.image, 0, (2 - i) * 128)); });
  const bb = new U.Billboards(60, atlas, { tiles: 3, fog: false, order: -5 });
  const add = (x, y, z, w, h, i) => bb.push(x, y, z, w, h, 0, 1, 1, 1, 1, i % 3);
  bb.begin();
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2, r = 520 + rnd() * 380, w = 160 + rnd() * 200;
    add(Math.cos(a) * r, 70 + rnd() * 120, Math.sin(a) * r, w, w * 0.42, i);
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + rnd() * 280, w = 55 + rnd() * 60;
    add(Math.cos(a) * r, 150 + rnd() * 55, Math.sin(a) * r, w, w * 0.45, i);
  }
  bb.end();
  scene.add(bb.mesh);
  W.clouds = bb.mesh;
};

// mapa de ambiente (reflexos do céu em metal, vidro e água) gerado a partir do próprio céu
W.buildEnv = function (renderer, scene) {
  const es = new THREE.Scene();
  es.add(W.sky.clone());
  const gnd = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x55603f, side: THREE.BackSide }));
  es.add(gnd);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(es, 0.02, 1, 2000).texture;
  pm.dispose();
};

W.buildTerrain = function (scene) {
  const SIZE = 560, SEG = 200;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, n = pos.count;
  const cols = new Float32Array(n * 3), uv = geo.attributes.uv;
  const c = new THREE.Color();
  W.tg = { S: SIZE, N: SEG, h: new Float32Array(n), sand: new Float32Array(n), col: cols };
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = W.height(x, z);
    pos.setY(i, y);
    W.groundColor(x, z, y, c);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    W.tg.h[i] = y; W.tg.sand[i] = W.sand(x, z);
    uv.setXY(i, x * TX.SCALE.ground, z * TX.SCALE.ground);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, TX.mat('ground'));
  // o chão fica um tiquinho "atrás" de pisos e praças na mesma altura (sem piscar)
  m.material.polygonOffset = true; m.material.polygonOffsetFactor = 1; m.material.polygonOffsetUnits = 3;
  m.receiveShadow = true;
  scene.add(m);
  W.terrain = m;
};

// leitura bilinear da grade do terreno (barato; usado pela grama)
W.grid2 = function (arr, x, z, stride, off) {
  const T = W.tg, fx = U.clamp((x + T.S / 2) / T.S * T.N, 0, T.N - 0.001), fz = U.clamp((z + T.S / 2) / T.S * T.N, 0, T.N - 0.001);
  const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, R = T.N + 1;
  stride = stride || 1; off = off || 0;
  const a = arr[(iz * R + ix) * stride + off], b = arr[(iz * R + ix + 1) * stride + off];
  const c = arr[((iz + 1) * R + ix) * stride + off], d = arr[((iz + 1) * R + ix + 1) * stride + off];
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
};

// mar em desenho: raso turquesa perto da areia, espuma batendo na praia e brilho das ondas
W.fillSeaDepth = function (data, N, EXT) {
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / (N - 1) - 0.5) * EXT, z = (j / (N - 1) - 0.5) * EXT;
    const depth = U.clamp((W.SEA_Y - W.height(x, z)) / 3.2, 0, 1);
    const k = (j * N + i) * 4;
    data[k] = Math.round(depth * 255); data[k + 1] = data[k + 2] = 0; data[k + 3] = 255;
  }
};
W.updateSeaDepth = function () { const t = W.seaMat.uniforms.uDepth.value; W.fillSeaDepth(t.image.data, t.image.width, W.seaMat.uniforms.uExt.value); t.needsUpdate = true; };
W.buildSea = function (scene) {
  const N = 192, EXT = 760, data = new Uint8Array(N * N * 4);
  W.fillSeaDepth(data, N, EXT);
  const dt = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  dt.magFilter = THREE.LinearFilter; dt.minFilter = THREE.LinearFilter; dt.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uDepth: { value: null }, uExt: { value: EXT },
      uDeep: { value: new THREE.Color(0x0e5a8a) }, uShallow: { value: new THREE.Color(0x3fb8b4) }, uFar: { value: new THREE.Color(0x165f96) },
      uSky: { value: new THREE.Color(0xa9cbe6) }, uSun: { value: W.SUN },
    }]),
    vertexShader: [
      '#include <fog_pars_vertex>',
      'varying vec3 vW;',
      'void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;',
      '#include <fog_vertex>',
      '}'].join('\n'),
    fragmentShader: [
      '#include <fog_pars_fragment>',
      'uniform float uTime; uniform sampler2D uDepth; uniform float uExt; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFar; uniform vec3 uSky; uniform vec3 uSun; varying vec3 vW;',
      'float wv(vec2 p){ return sin(p.x * 0.31 + uTime * 1.1) * 0.5 + sin(p.y * 0.27 - uTime * 0.9) * 0.5 + sin((p.x + p.y) * 0.53 + uTime * 1.7) * 0.25 + sin((p.x * 1.7 - p.y) * 0.9 - uTime * 2.3) * 0.12; }',
      'void main(){',
      ' vec2 uv = vW.xz / uExt + 0.5;',
      ' float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);',
      ' float d = mix(1.0, texture2D(uDepth, uv).r, inside);',
      ' float e = 0.6; float h0 = wv(vW.xz); vec3 n = normalize(vec3(h0 - wv(vW.xz + vec2(e, 0.0)), 1.6, h0 - wv(vW.xz + vec2(0.0, e))));',
      ' vec3 V = normalize(cameraPosition - vW);',
      ' float fr = pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.85 + 0.05;',
      ' vec3 c = mix(uShallow, uDeep, smoothstep(0.0, 0.85, d));',
      ' c = mix(c, uFar, smoothstep(250.0, 600.0, length(vW.xz)));',
      ' c = mix(c, uSky, fr);',
      ' vec3 R = reflect(-V, n); float sp = pow(max(dot(R, uSun), 0.0), 180.0);',
      ' c += vec3(1.0, 0.95, 0.85) * sp * 1.6;',
      ' float foamLine = smoothstep(0.1, 0.0, d);',
      ' float bands = smoothstep(0.7, 1.0, sin(d * 34.0 - uTime * 2.0)) * smoothstep(0.28, 0.04, d);',
      ' c = mix(c, vec3(0.93, 0.96, 0.96), clamp(foamLine * 0.85 + bands * 0.5, 0.0, 1.0));',
      ' gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '#include <fog_fragment>',
      '}'].join('\n'),
  });
  mat.uniforms.uDepth.value = dt;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 1, 1), mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = W.SEA_Y;
  scene.add(sea);
  W.seaMat = mat;
};

// --- vegetação ---
// Cartão de folhagem: quad com as duas faces e normal "de volume" (do centro da copa para fora),
// assim a copa recebe luz como um volume e não como um monte de planos.
const _wcq = new THREE.Quaternion(), _wcv = new THREE.Vector3(), _wcn = new THREE.Vector3();
W.card = function (mat, pos, w, h, quat, tint, volC, volR, uvs, bend) {
  const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const uv = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
  const P = [], N = [], C = [], T = [];
  const vtx = [];
  for (let i = 0; i < 4; i++) {
    _wcv.set(corners[i][0], corners[i][1], bend && (i === 1 || i === 2) ? bend : 0).applyQuaternion(quat).add(pos);
    _wcn.copy(_wcv).sub(volC);
    if (volR) _wcn.divide(volR);
    _wcn.normalize(); _wcn.y = _wcn.y * 0.7 + 0.35; _wcn.normalize();
    vtx.push([_wcv.x, _wcv.y, _wcv.z, _wcn.x, _wcn.y, _wcn.z, uv[i][0], uv[i][1]]);
  }
  const tri = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2];
  for (const k of tri) {
    const v = vtx[k];
    P.push(v[0], v[1], v[2]); N.push(v[3], v[4], v[5]); T.push(v[6], v[7]); C.push(tint.r, tint.g, tint.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(T, 2));
  return { g: g, o: null, mat: mat };
};
const _tint = (r, base, spread) => { const c = new THREE.Color(base); const k = 1 + (r() - 0.5) * spread; return c.multiplyScalar(k); };

W.treeGeo = function (seed) {
  const r = U.rng(seed), parts = [];
  const lean = (r() - 0.5) * 0.18;
  parts.push(U.part(new THREE.CylinderGeometry(0.17, 0.34, 3.6, 9), 0x6e5440, U.mat4(0, 1.75, 0, 0, 0, lean), null, 'bark'));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3 + r(), L = 1.5 + r() * 0.9;
    parts.push(U.part(new THREE.CylinderGeometry(0.05, 0.12, L, 6), 0x645040,
      U.mat4(Math.cos(a) * 0.45, 3.1 + i * 0.22, Math.sin(a) * 0.45, Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85), null, 'bark'));
  }
  const C = new THREE.Vector3(0, 4.7, 0), R = new THREE.Vector3(2.7, 1.9, 2.7);
  const n = 54;
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    const k = 0.45 + Math.pow(r(), 0.5) * 0.6;
    const pos = new THREE.Vector3(Math.cos(th) * rr * R.x * k, u * R.y * k, Math.sin(th) * rr * R.z * k).add(C);
    _wcq.setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
    const sz = 1.9 + r() * 1.1;
    parts.push(W.card('foliage', pos, sz, sz, _wcq.clone(), _tint(r, 0xffffff, 0.35), C, R));
  }
  return U.buildBy(parts);
};

W.pineGeo = function (seed) {
  const r = U.rng(seed), parts = [];
  parts.push(U.part(new THREE.CylinderGeometry(0.1, 0.26, 7.2, 8), 0x5e4535, U.mat4(0, 3.6, 0), null, 'bark'));
  const C = new THREE.Vector3(0, 3.8, 0), R = new THREE.Vector3(2.2, 3.4, 2.2);
  const layers = 8;
  for (let l = 0; l < layers; l++) {
    const t = l / (layers - 1), y = 1.7 + t * 5.4, rad = U.lerp(2.5, 0.55, t);
    const m = 7 - Math.floor(t * 3);
    for (let i = 0; i < m; i++) {
      const a = i / m * Math.PI * 2 + r() * 0.5 + l * 0.7;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const pos = new THREE.Vector3(0, y, 0).addScaledVector(dir, rad * 0.5);
      // plano do galho: comprimento ao longo de dir, largura no lado, caindo para baixo
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.3 - r() * 0.2));
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 + (r() - 0.5) * 0.5));
      parts.push(W.card('needle', pos, rad * 1.05, 1.1 + (1 - t) * 0.5, q, _tint(r, 0xffffff, 0.3), C, R));
    }
  }
  for (let i = 0; i < 2; i++) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.57).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
    parts.push(W.card('needle', new THREE.Vector3(0, 7.3, 0), 1.4, 0.7, q, new THREE.Color(0xffffff), C, R));
  }
  return U.buildBy(parts);
};

W.palmGeo = function (seed) {
  const r = U.rng(seed), parts = [];
  const bend = 0.6 + r() * 0.8;
  let x = 0, y = 0;
  for (let i = 0; i < 7; i++) {
    const t = i / 7, h = 0.95, ang = bend * t * 0.35;
    parts.push(U.part(new THREE.CylinderGeometry(0.15, 0.2, h, 8), i % 2 ? 0x8a7458 : 0x7c6650, U.mat4(x, y + h / 2, 0, 0, 0, -ang), null, 'bark'));
    parts.push(U.part(new THREE.CylinderGeometry(0.205, 0.17, 0.08, 8), 0x5a4a3a, U.mat4(x, y + h, 0, 0, 0, -ang), null, 'bark'));
    x += Math.sin(ang) * h; y += Math.cos(ang) * h;
  }
  const top = new THREE.Vector3(x, y, 0);
  // folhas: tiras curvas em 4 segmentos, caindo nas pontas
  const nf = 11;
  for (let i = 0; i < nf; i++) {
    const a = i / nf * Math.PI * 2 + r() * 0.3, up = 0.55 - r() * 0.5, L = 3.1 + r() * 0.8;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    let p0 = top.clone(), pitch = up;
    const seg = 4;
    for (let k = 0; k < seg; k++) {
      const sl = L / seg;
      const d = dir.clone().multiplyScalar(Math.cos(pitch)).add(new THREE.Vector3(0, Math.sin(pitch), 0));
      const p1 = p0.clone().addScaledVector(d, sl);
      const w0 = 0.95 * Math.sin((k / seg) * Math.PI * 0.85 + 0.25), w1 = 0.95 * Math.sin(((k + 1) / seg) * Math.PI * 0.85 + 0.25);
      const P = [p0.clone().addScaledVector(side, -w0 / 2), p1.clone().addScaledVector(side, -w1 / 2), p1.clone().addScaledVector(side, w1 / 2), p0.clone().addScaledVector(side, w0 / 2)];
      const u0 = k / seg, u1 = (k + 1) / seg;
      const uv = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
      const g = new THREE.BufferGeometry(), pos = [], nor = [], col = [], tuv = [];
      const nrm = new THREE.Vector3().crossVectors(side, d).normalize(); if (nrm.y < 0) nrm.negate(); nrm.y += 0.4; nrm.normalize();
      const tc = _tint(r, 0xffffff, 0.2);
      for (const idx of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { pos.push(P[idx].x, P[idx].y, P[idx].z); nor.push(nrm.x, nrm.y, nrm.z); col.push(tc.r, tc.g, tc.b); tuv.push(uv[idx][0], uv[idx][1]); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
      parts.push({ g: g, o: null, mat: 'frond' });
      p0 = p1; pitch -= 0.32 + r() * 0.1;
    }
  }
  parts.push(U.part(U.blob(0.3, 1), 0x4a3a2a, U.mat4(x, y - 0.15, 0), 'radial', 'bark'));
  for (let i = 0; i < 4; i++) parts.push(U.part(new THREE.SphereGeometry(0.11, 8, 6), 0x5a4a22, U.mat4(x + Math.cos(i * 1.6) * 0.2, y - 0.3, Math.sin(i * 1.6) * 0.2), null, 'plain'));
  return U.buildBy(parts);
};

W.bushGeo = function () {
  const r = U.rng(77), parts = [];
  const C = new THREE.Vector3(0, 0.45, 0), R = new THREE.Vector3(1.1, 0.75, 1.1);
  for (let i = 0; i < 18; i++) {
    const u = r(), th = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    const pos = new THREE.Vector3(Math.cos(th) * rr * R.x * 0.6, u * R.y * 0.7, Math.sin(th) * rr * R.z * 0.6).add(C);
    _wcq.setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
    parts.push(W.card('foliage', pos, 1.1 + r() * 0.5, 1.1 + r() * 0.5, _wcq.clone(), _tint(r, 0xe8ffe0, 0.3), C, R));
  }
  return U.buildBy(parts);
};

W.instanced = function (scene, pack, mats, thick, shadow) {
  if (!mats.length) return;
  const pos = mats.map(m => [m.elements[12], m.elements[14]]);
  for (const k in pack.mats) {
    const main = new THREE.InstancedMesh(pack.mats[k], TX.mat(k), mats.length);
    for (let i = 0; i < mats.length; i++) main.setMatrixAt(i, mats[i]);
    main.castShadow = false;
    main.computeBoundingSphere();
    scene.add(main);
    // sombra só das árvores perto do jogador: cópia na camada 1, que só a luz do sol enxerga
    if (shadow) {
      const sm = new THREE.InstancedMesh(pack.mats[k], TX.mat(k), Math.min(mats.length, 40));
      sm.castShadow = true; sm.layers.set(1); sm.count = 0; sm.frustumCulled = false;
      scene.add(sm);
      W.olSets.push({ mesh: sm, mats: mats, pos: pos, max: sm.count = Math.min(mats.length, 40), R: 48 });
      sm.count = 0;
    }
  }
  if (!pack.o) return;
  // contorno só nas instâncias mais próximas do jogador (atualizado em W.update)
  const maxOl = Math.min(mats.length, 45);
  const ol = new THREE.InstancedMesh(pack.o, U.outlineMat(thick), maxOl);
  ol.frustumCulled = false;
  W.olSets.push({ mesh: ol, mats: mats, pos: pos, max: maxOl, R: 95 });
  scene.add(ol);
};
W.olSets = [];
W.updateOutlines = function (px, pz) {
  for (const s of W.olSets) {
    const idx = s.pos.map((p, i) => [(p[0] - px) * (p[0] - px) + (p[1] - pz) * (p[1] - pz), i]);
    idx.sort((a, b) => a[0] - b[0]);
    let n = 0;
    for (let k = 0; k < s.max; k++) {
      if (idx[k][0] > s.R * s.R) break;
      s.mesh.setMatrixAt(n++, s.mats[idx[k][1]]);
    }
    s.mesh.count = n;
    s.mesh.instanceMatrix.needsUpdate = true;
  }
};

W.keepOutAreas = function (x, z, extra) {
  for (const a of W.areaDefs) {
    if (!a.flat) continue;
    if (Math.hypot(x - a.x, z - a.z) < a.r + (extra || 0)) return true;
  }
  return false;
};

W.buildTrees = function (scene, rnd) {
  const variants = [W.treeGeo(11), W.treeGeo(29), W.treeGeo(57)], vm = [[], [], []];
  const pines = W.pineGeo(5), pm0 = [];
  const forests = W.areaDefs.filter(a => a.forest), hills = W.areaDefs.filter(a => a.hills || a.peak);
  const near = (list, x, z, extra) => list.some(a => Math.hypot(x - a.x, z - a.z) < a.r + extra);
  let placed = 0, tries = 0;
  const N = W.MAP.trees || 240;
  while (placed < N && tries < 16000) {
    tries++;
    const [x, z] = W.randLand(rnd, 10);
    const inForest = near(forests, x, z, 8);
    const nearLake = W.lakes.some(l => Math.abs(Math.hypot(x - l.x, z - l.z) - l.r - 6) < 7);
    if (!inForest && !nearLake && rnd() > 0.28) continue;
    if (W.sand(x, z) > 0.2 || W.pathDist(x, z) < 5 || W.height(x, z) < 0.2) continue;
    if (W.keepOutAreas(x, z, 5) || !W.isFree(x, z, inForest ? 3.6 : 4.5, W.occupied)) continue;
    const s = 0.85 + rnd() * 0.55, y = W.height(x, z);
    const pine = inForest ? rnd() < 0.4 : near(hills, x, z, 30) && rnd() < 0.65;
    (pine ? pm0 : vm[placed % 3]).push(U.mat4(x, y - 0.1, z, 0, rnd() * Math.PI * 2, 0, s, s, s));
    W.occupied.push([x, z, 2.6]);
    W.addCollider({ type: 'c', x: x, z: z, r: (pine ? 0.3 : 0.38) * s, y0: y - 1, y1: y + 3.4 * s });
    placed++;
  }
  variants.forEach((g, i) => W.instanced(scene, g, vm[i], 0.05, true));
  W.instanced(scene, pines, pm0, 0.05, true);

  // coqueiros na orla e nas vilas litorâneas
  const palms = [W.palmGeo(3), W.palmGeo(8)], pm = [[], []];
  const addPalm = (x, z, i, s) => {
    const y = W.height(x, z);
    if (y < W.SEA_Y + 0.3) return;
    pm[i % 2].push(U.mat4(x, y - 0.1, z, 0, rnd() * Math.PI * 2, 0, s, s, s));
    W.occupied.push([x, z, 2]);
    W.addCollider({ type: 'c', x: x, z: z, r: 0.22 * s, y0: y - 1, y1: y + 5 * s });
  };
  for (let i = 0; i < 130; i++) {
    const a = rnd() * Math.PI * 2, k = (W.LAND_R - 16 + rnd() * 18) * W.shape(a);
    const x = Math.cos(a) * k, z = Math.sin(a) * k;
    if (!W.isFree(x, z, 3, W.occupied) || W.keepOutAreas(x, z, 0)) continue;
    addPalm(x, z, i, 0.9 + rnd() * 0.45);
  }
  for (const v of W.areaDefs.filter(a => a.palms)) {
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = 5 + rnd() * (v.r - 2);
      const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
      if (!W.isFree(x, z, 1.6, W.occupied) || W.pathDist(x, z) < 3) continue;
      addPalm(x, z, i, 0.75 + rnd() * 0.3);
    }
  }
  palms.forEach((g, i) => W.instanced(scene, g, pm[i], 0.04, true));

  const bm = [];
  for (let i = 0; i < 200; i++) {
    const [x, z] = W.randLand(rnd, 8);
    if (W.sand(x, z) > 0.3 || !W.isFree(x, z, 1.5, W.occupied) || W.height(x, z) < 0) continue;
    const s = 0.6 + rnd() * 0.7;
    bm.push(U.mat4(x, W.height(x, z) - 0.15, z, 0, rnd() * 6, 0, s, s, s));
    W.occupied.push([x, z, 1]);
  }
  W.instanced(scene, W.bushGeo(), bm, 0.04, true);
};

// junta todas as construções em uma malha por textura + uma casca de contorno
W.solidMesh = function (scene, parts, thick) {
  const pack = U.buildBy(parts);
  for (const k in pack.mats) {
    const m = new THREE.Mesh(pack.mats[k], TX.mat(k));
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  if (pack.o) scene.add(new THREE.Mesh(pack.o, U.outlineMat(thick)));
};

// bloco com colisor; walkable permite subir em cima
W.box = function (parts, x, z, w, h, d, rot, color, y0, opts, mat) {
  const y = (y0 === undefined || y0 === null ? W.height(x, z) - 0.3 : y0);
  parts.push(U.part(new THREE.BoxGeometry(w, h, d), color, U.mat4(x, y + h / 2, z, 0, rot, 0), 'radial', mat || 'plain'));
  if (opts === false) return null;
  return W.addCollider(Object.assign({ type: 'b', x: x, z: z, hx: w / 2, hz: d / 2, rot: rot, y0: y, y1: y + h, walkable: true }, opts || {}));
};

// ---------- construções ----------
// casa genérica com interior: paredes com porta e janelas, piso, forro, telhado e móveis
W.HOUSE_STYLES = {
  tropical: { wall: 0xf7f5ef, band: 0xe2763a, frame: 0x2f6fd6, roof: 0xd84f2a, wallMat: 'plaster' },
  colorida: { wall: null, band: 0xffffff, frame: 0xffffff, roof: null, wallMat: 'plaster' },
  pescador: { wall: null, band: 0x6b4a2a, frame: 0xf2efe6, roof: 0x7d8a8f, wallMat: 'wood', roofMat: 'metal' },
};
const PASTEL = [0xf6d36b, 0xf2a7b8, 0x9fd3f0, 0xa9e3b8, 0xf5b77a, 0xd6c2f2];
const ROOFS = [0xd84f2a, 0xc0392b, 0x2f7d8f, 0x8b5a2b, 0xd86f2a];
const BOATWOOD = [0x4f86c6, 0x3fa36b, 0xd95f4a, 0xe3b43c];

W.house = function (parts, x, z, rot, base, idx, styleName, size) {
  const st = W.HOUSE_STYLES[styleName || 'tropical'];
  const HW = size ? size[0] : 3.4, HD = size ? size[1] : 2.8, H = 2.9, T = 0.22;
  const c = Math.cos(rot), s = Math.sin(rot);
  const wx = (lx, lz) => x + lx * c + lz * s, wz = (lx, lz) => z - lx * s + lz * c;
  const WALL = st.wall !== null ? st.wall : (styleName === 'pescador' ? BOATWOOD[idx % 4] : PASTEL[idx % PASTEL.length]);
  const ROOF = st.roof !== null ? st.roof : ROOFS[idx % ROOFS.length];
  const BAND = st.band, FRAME = st.frame, WOOD = 0x9a6233;
  const box = (lx, ly, lz, w, h, d, col, collide, walk, mat) => {
    parts.push(U.part(new THREE.BoxGeometry(w, h, d), col, U.mat4(wx(lx, lz), base + ly + h / 2, wz(lx, lz), 0, rot, 0), 'radial', mat || 'plain'));
    if (collide) W.addCollider({ type: 'b', x: wx(lx, lz), z: wz(lx, lz), hx: w / 2, hz: d / 2, rot: rot, y0: base + ly, y1: base + ly + h, walkable: !!walk });
  };
  const wallRun = (along, fixed, half, ops, out) => {
    let cur = -half;
    const seg = (a, b, y0, y1, band) => {
      const len = b - a, mid = (a + b) / 2;
      if (len <= 0.01 || y1 - y0 <= 0.01) return;
      if (along === 'x') box(mid, y0, fixed, len, y1 - y0, T, WALL, true, false, st.wallMat);
      else box(fixed, y0, mid, T, y1 - y0, len, WALL, true, false, st.wallMat);
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
      const isDoor = o[2] <= 0, fc = isDoor ? WOOD : FRAME, w = o[1], hh = o[3] - o[2];
      const fr = (p, y, fw, fh) => (along === 'x' ? box(p, y, fixed, fw, fh, T + 0.08, fc, false, false, isDoor ? 'wood' : 'plain') : box(fixed, y, p, T + 0.08, fh, fw, fc, false, false, isDoor ? 'wood' : 'plain'));
      fr(a - 0.04, o[2], 0.08, hh); fr(b + 0.04, o[2], 0.08, hh);
      fr(o[0], o[3], w + 0.16, 0.08);
      if (!isDoor) {
        fr(o[0], o[2] - 0.08, w + 0.16, 0.08);
        for (const sd of [-1, 1]) {
          const p = o[0] + sd * (w / 2 + w / 4 + 0.1);
          if (along === 'x') box(p, o[2] - 0.05, fixed + out * (T / 2 + 0.05), w / 2, hh + 0.1, 0.05, FRAME === 0xffffff ? 0x3c7fc4 : FRAME, false, false, 'wood');
          else box(fixed + out * (T / 2 + 0.05), o[2] - 0.05, p, 0.05, hh + 0.1, w / 2, FRAME === 0xffffff ? 0x3c7fc4 : FRAME, false, false, 'wood');
        }
        // floreira
        if (along === 'x') box(o[0], o[2] - 0.32, fixed + out * (T / 2 + 0.16), w * 0.9, 0.22, 0.24, 0x8a5a33, false, false, 'wood');
      } else {
        // porta aberta encostada na parede, por dentro
        if (along === 'x') box(a + 0.08, 0, fixed - out * (T / 2 + 0.5), 0.06, o[3] - 0.05, 0.9, 0x7b4a28, false, false, 'wood');
      }
      cur = b;
    }
    seg(cur, half, 0, H, true);
  };
  const dx = -HW * 0.3;
  wallRun('x', HD, HW + T / 2, [[dx, 1.3, 0, 2.2], [HW * 0.47, 1.1, 1.0, 2.0]], 1);
  wallRun('x', -HD, HW + T / 2, [[HW * 0.24 * (idx % 2 ? 1 : -1), 1.1, 1.0, 2.0]], -1);
  wallRun('z', HW, HD - T / 2, [[0.3, 1.1, 1.0, 2.0]], 1);
  wallRun('z', -HW, HD - T / 2, [[-0.3, 1.1, 1.0, 2.0]], -1);
  box(0, -0.4, 0, HW * 2, 0.5, HD * 2, 0xc8803e, true, true, 'wood');
  box(0, H, 0, HW * 2 + T, 0.1, HD * 2 + T, 0xfbfbf6, false, false, 'plaster');
  // forro e telhado bloqueiam câmera e tiros (antes a câmera atravessava o forro)
  W.addCollider({ type: 'b', x: x, z: z, hx: HW + 0.5, hz: HD + 0.5, rot: rot, y0: base + H, y1: base + H + 1.2, walkable: false, ceiling: true });
  // degrau na porta
  box(dx, -0.35, HD + 0.45, 1.6, 0.38, 0.7, 0xd9d2c4, true, true, 'stone');
  const roof = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4);
  parts.push(U.part(roof, ROOF, new THREE.Matrix4().compose(new THREE.Vector3(x, base + H + 0.1 + 0.85, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3((HW * 2 + 1.1) / Math.SQRT2, 1.7, (HD * 2 + 1.1) / Math.SQRT2)), 'radial', st.roofMat || 'roof'));
  box(HW * 0.45, H + 0.5, -HD * 0.3, 0.45, 1.1, 0.45, 0xeeeae0, false, false, 'stone');
  // móveis
  box(-HW + 0.7, 0.1, -HD + 1.15, 1.0, 0.35, 1.9, 0x9a6233, true, true, 'wood');
  box(-HW + 0.7, 0.45, -HD + 1.35, 0.95, 0.12, 1.4, [0x2f63c8, 0xd9534f, 0x3fa36b][idx % 3], false, false, 'fabric');
  box(-HW + 0.7, 0.45, -HD + 0.45, 0.75, 0.14, 0.35, 0xffffff, false, false, 'fabric');
  box(HW - 1.1, 0.1, 0.3, 0.18, 0.66, 0.18, 0x9a6233, true, false, 'wood');
  box(HW - 1.1, 0.76, 0.3, 1.1, 0.08, 0.75, 0xb57a42, false, false, 'wood');
  box(HW - 1.6, 0.1, 0.3, 0.42, 0.45, 0.42, 0x8a5a33, false, false, 'wood');
  box(0.6, 0.1, -HD + 0.38, 1.3, 1.6, 0.4, 0x7a4a26, true, false, 'wood');
  box(0.4, 0.1, 0.6, 1.8, 0.02, 1.2, [0x3f9f6a, 0xc0504d, 0x4f81bd][idx % 3], false, false, 'fabric');
  box(HW + 0.75, 0, HD + 0.5, 0.55, 0.85, 0.55, 0x2e9a4a, true, false, 'plain');
  W.lootSpots.push([wx(0.2, 0.8), wz(0.2, 0.8)], [wx(-HW + 1.6, 1.2), wz(-HW + 1.6, 1.2)]);
  W.occupied.push([x, z, Math.max(HW, HD) + 3.5]);
  W.houses.push({ x: x, z: z, c: c, s: s, hw: HW + 0.35, hd: HD + 0.35, h: base + H, b: base, fw: HW, fd: HD });
};

// piso de construção embaixo de (x, z): o terreno nunca passa por cima dele
W.floorAt = function (x, z) {
  for (const h of W.houses) {
    if (h.b === undefined) continue;
    const dx = x - h.x, dz = z - h.z;
    if (Math.abs(dx) > h.fw + h.fd || Math.abs(dz) > h.fw + h.fd) continue;
    const lx = dx * h.c - dz * h.s, lz = dx * h.s + dz * h.c;
    if (Math.abs(lx) < h.fw && Math.abs(lz) < h.fd) return h;
  }
  return null;
};
// rebaixa o terreno desenhado que ficaria acima dos pisos (casas em encosta)
W.carveFloors = function () {
  const T = W.tg, m = W.terrain;
  if (!T || !m) return;
  const pos = m.geometry.attributes.position, R = T.N + 1, step = T.S / T.N;
  let changed = false;
  for (const h of W.houses) {
    if (h.b === undefined) continue;
    const rad = Math.hypot(h.fw, h.fd) + step;
    const i0 = Math.max(0, Math.floor((h.x - rad + T.S / 2) / step)), i1 = Math.min(T.N, Math.ceil((h.x + rad + T.S / 2) / step));
    const j0 = Math.max(0, Math.floor((h.z - rad + T.S / 2) / step)), j1 = Math.min(T.N, Math.ceil((h.z + rad + T.S / 2) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * R + i, x = pos.getX(k), z = pos.getZ(k);
      const dx = x - h.x, dz = z - h.z, lx = dx * h.c - dz * h.s, lz = dx * h.s + dz * h.c;
      if (Math.abs(lx) > h.fw + 0.2 || Math.abs(lz) > h.fd + 0.2) continue;
      const lim = h.b - 0.18;
      if (pos.getY(k) > lim) { pos.setY(k, lim); T.h[k] = lim; changed = true; }
    }
  }
  if (changed) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); }
};

W.inHouse = function (x, z) {
  for (const h of W.houses) {
    const dx = x - h.x, dz = z - h.z;
    if (dx * dx + dz * dz > (h.hw + h.hd) * (h.hw + h.hd)) continue;
    const lx = dx * h.c - dz * h.s, lz = dx * h.s + dz * h.c;
    if (Math.abs(lx) < h.hw && Math.abs(lz) < h.hd) return h;
  }
  return null;
};

// casas em ruas, olhando para a rua
W.placeHouses = function (P, a, list, style, sizeFn) {
  const base = a.h - 0.05;
  list.forEach((p, i) => W.house(P, a.x + p[0], a.z + p[1], p[2], base, i + (style === 'colorida' ? 3 : 0), style, sizeFn ? sizeFn(i) : null));
};

W.buildVillages = function (P) {
  // Bairro Tropical (como no vídeo): casas brancas, telhado laranja, janelas azuis
  const B = W.A['BAIRRO TROPICAL'];
  W.placeHouses(P, B, [[-20, -18, 0], [-5, -19, 0.04], [10, -17, -0.04], [24, -14, 0.06], [-21, -1, Math.PI], [-6, -2, Math.PI], [9, 0, Math.PI + 0.05],
    [-19, 16, 0], [-4, 17, 0.03], [11, 18, -0.03], [26, 9, Math.PI / 2], [-31, 6, -Math.PI / 2], [24, 26, 0.1], [-14, 30, Math.PI]], 'tropical');
};

W.buildCentral = function (P) {
  const a = W.A['VILA CENTRAL'], base = a.h - 0.05;
  // praça com chafariz, bancos e caixa d'água; casas coloridas em volta
  W.box(P, a.x, a.z, 14, 0.12, 14, 0.785, 0xd9d2c4, base, { walkable: true }, 'stone');
  P.push(U.part(new THREE.CylinderGeometry(2.4, 2.6, 0.7, 20), 0xcfc6b4, U.mat4(a.x, base + 0.35, a.z), null, 'stone'));
  P.push(U.part(new THREE.CylinderGeometry(2.15, 2.15, 0.08, 20), 0x5fc6e8, U.mat4(a.x, base + 0.66, a.z), null, 'glass'));
  P.push(U.part(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 10), 0xe6dccb, U.mat4(a.x, base + 1.2, a.z), null, 'stone'));
  P.push(U.part(new THREE.CylinderGeometry(0.9, 0.6, 0.3, 14), 0xe6dccb, U.mat4(a.x, base + 2.1, a.z), null, 'stone'));
  W.addCollider({ type: 'c', x: a.x, z: a.z, r: 2.5, y0: base, y1: base + 0.75 });
  for (let i = 0; i < 4; i++) {
    const an = i * Math.PI / 2 + 0.785, bx = a.x + Math.cos(an) * 5, bz = a.z + Math.sin(an) * 5;
    W.box(P, bx, bz, 1.8, 0.45, 0.5, -an + Math.PI / 2, 0x9a6233, base, { walkable: true }, 'wood');
  }
  // caixa d'água
  const tx = a.x + 16, tz = a.z - 16;
  for (const [ox, oz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    P.push(U.part(new THREE.CylinderGeometry(0.14, 0.18, 9, 6), 0x9aa3a8, U.mat4(tx + ox, base + 4.5, tz + oz), null, 'metal'));
    W.addCollider({ type: 'c', x: tx + ox, z: tz + oz, r: 0.2, y0: base, y1: base + 9 });
  }
  P.push(U.part(new THREE.CylinderGeometry(2.4, 2.4, 3, 16), 0x5aa3d8, U.mat4(tx, base + 10.5, tz), null, 'metal'));
  P.push(U.part(new THREE.ConeGeometry(2.6, 1.2, 16), 0xd84f2a, U.mat4(tx, base + 12.6, tz), 'radial', 'roof'));
  W.occupied.push([tx, tz, 4], [a.x, a.z, 9]);
  W.placeHouses(P, a, [[-18, -8, Math.PI / 2], [-18, 9, Math.PI / 2], [18, 8, -Math.PI / 2], [-6, 20, Math.PI], [9, 20, Math.PI], [-8, -20, 0], [7, -21, 0]], 'colorida');
};

W.buildFishing = function (P) {
  const a = W.A['VILA PESQUEIRA'];
  W.placeHouses(P, a, [[-12, -12, -Math.PI / 2], [-12, 2, -Math.PI / 2], [-11, 15, -Math.PI / 2], [2, -16, 0], [4, 16, Math.PI]], 'pescador', () => [3.0, 2.6]);
  // píer de madeira entrando no mar
  const py = W.SEA_Y + 0.7, ang = Math.atan2(a.z, a.x);
  const dir = [Math.cos(ang), Math.sin(ang)], rot = -ang;
  for (let i = 0; i < 9; i++) {
    const d = 10 + i * 3, x = a.x + dir[0] * d, z = a.z + dir[1] * d;
    W.box(P, x, z, 3, 0.25, 3.2, rot, 0xa87a4c, py - 0.25, { walkable: true }, 'wood');
    for (const sd of [-1.4, 1.4]) {
      const px = x - dir[1] * sd, pz = z + dir[0] * sd;
      P.push(U.part(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), 0x6b4a2a, U.mat4(px, py - 1.4, pz), null, 'wood'));
    }
  }
  // barcos
  for (let i = 0; i < 4; i++) {
    const d = 16 + i * 6, sd = (i % 2 ? 1 : -1) * 4.2;
    const x = a.x + dir[0] * d - dir[1] * sd, z = a.z + dir[1] * d + dir[0] * sd;
    const r2 = rot + (i % 2 ? 0.2 : -0.15);
    P.push(U.part(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), BOATWOOD[i], U.mat4(x, W.SEA_Y + 0.55, z, 0, r2, 0, 1.4, 0.75, 3.2), 'radial', 'wood'));
    P.push(U.part(new THREE.BoxGeometry(2.3, 0.12, 5.4), 0xe8dcc4, U.mat4(x, W.SEA_Y + 0.5, z, 0, r2, 0), 'radial', 'wood'));
    W.addCollider({ type: 'b', x: x, z: z, hx: 1.3, hz: 3, rot: r2, y0: W.SEA_Y - 1, y1: W.SEA_Y + 0.9, walkable: true });
  }
  // redes e caixas de peixe
  for (let i = 0; i < 5; i++) W.box(P, a.x + 6 + i * 1.3, a.z - 6 + (i % 2) * 1.4, 1.1, 0.6, 0.8, 0.2 * i, 0x3f7fb0, a.h - 0.05, { walkable: true }, 'wood');
  W.occupied.push([a.x + dir[0] * 20, a.z + dir[1] * 20, 14]);
};

W.buildPort = function (P, rnd) {
  const a = W.A.PORTO, base = a.h - 0.05;
  const cols = [0xc0392b, 0x2e6fb5, 0x3fa36b, 0xe67e22, 0xe8c11c, 0x7d3c98];
  // contêineres em fileiras (cobertura boa para trocação)
  let k = 0;
  for (let row = -2; row <= 2; row++) for (let i = -3; i <= 3; i++) {
    if (rnd() < 0.25) continue;
    const x = a.x + i * 7.4, z = a.z + row * 6.2, rot = (rnd() - 0.5) * 0.06;
    const col = cols[k++ % cols.length];
    W.box(P, x, z, 6.1, 2.6, 2.45, rot, col, base, { walkable: true }, 'metal');
    if (rnd() < 0.4) W.box(P, x + (rnd() - 0.5) * 0.4, z, 6.1, 2.6, 2.45, rot + (rnd() - 0.5) * 0.1, cols[k++ % cols.length], base + 2.6, { walkable: true }, 'metal');
  }
  // guindaste
  const cx = a.x - 10, cz = a.z - 24;
  for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    P.push(U.part(new THREE.BoxGeometry(0.5, 16, 0.5), 0xe8b21c, U.mat4(cx + ox, base + 8, cz + oz), 'radial', 'metal'));
    W.addCollider({ type: 'b', x: cx + ox, z: cz + oz, hx: 0.25, hz: 0.25, rot: 0, y0: base, y1: base + 16 });
  }
  P.push(U.part(new THREE.BoxGeometry(7, 1.2, 7), 0xe8b21c, U.mat4(cx, base + 16.5, cz), 'radial', 'metal'));
  P.push(U.part(new THREE.BoxGeometry(26, 1, 1.4), 0xe8b21c, U.mat4(cx - 6, base + 17.5, cz), 'radial', 'metal'));
  P.push(U.part(new THREE.BoxGeometry(2.4, 2, 2.4), 0x2f3b45, U.mat4(cx + 2, base + 18.2, cz), 'radial', 'metal'));
  W.occupied.push([a.x, a.z, a.r - 2]);
};

// galpão/celeiro com telhado de duas águas e portão aberto
W.shed = function (P, x, z, rot, base, HW, HD, H, wallCol, roofCol, wallMat, roofMat) {
  const c = Math.cos(rot), s = Math.sin(rot), T = 0.3;
  const wx = (lx, lz) => x + lx * c + lz * s, wz = (lx, lz) => z - lx * s + lz * c;
  const box = (lx, ly, lz, w, h, d, col, collide, mat) => {
    P.push(U.part(new THREE.BoxGeometry(w, h, d), col, U.mat4(wx(lx, lz), base + ly + h / 2, wz(lx, lz), 0, rot, 0), 'radial', mat));
    if (collide) W.addCollider({ type: 'b', x: wx(lx, lz), z: wz(lx, lz), hx: w / 2, hz: d / 2, rot: rot, y0: base + ly, y1: base + ly + h, walkable: false });
  };
  const door = HW * 0.45;
  box(-HW + (HW - door) / 2, 0, HD, HW - door, H, T, wallCol, true, wallMat);
  box(HW - (HW - door) / 2, 0, HD, HW - door, H, T, wallCol, true, wallMat);
  box(0, H * 0.72, HD, door * 2, H * 0.28, T, wallCol, true, wallMat);
  box(0, 0, -HD, HW * 2, H, T, wallCol, true, wallMat);
  box(-HW, 0, 0, T, H, HD * 2, wallCol, true, wallMat);
  box(HW, 0, 0, T, H, HD * 2, wallCol, true, wallMat);
  box(0, -0.4, 0, HW * 2, 0.45, HD * 2, 0x8a6a48, false, 'wood');
  W.addCollider({ type: 'b', x: x, z: z, hx: HW + 0.4, hz: HD + 0.4, rot: rot, y0: base + H, y1: base + H + 1.0, walkable: false, ceiling: true });
  // empena e telhado
  const ang = 0.55, half = (HW + 0.6) / Math.cos(ang);
  for (const sd of [-1, 1]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(wx(sd * (HW + 0.6) / 2, 0), base + H + Math.tan(ang) * (HW + 0.6) / 2, wz(sd * (HW + 0.6) / 2, 0)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, -sd * ang, 'YXZ')), new THREE.Vector3(half, 0.2, HD * 2 + 1));
    P.push(U.part(new THREE.BoxGeometry(1, 1, 1), roofCol, m, 'radial', roofMat));
  }
  const tri = new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  for (const sd of [-1, 1]) {
    P.push(U.part(tri, wallCol, new THREE.Matrix4().compose(new THREE.Vector3(wx(0, sd * HD), base + H + 0.01, wz(0, sd * HD)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(Math.tan(ang) * HW * 1.33, HW * 1.15, T)), 'radial', wallMat));
  }
  W.occupied.push([x, z, Math.max(HW, HD) + 3]);
  W.lootSpots.push([wx(0, 0), wz(0, 0)], [wx(HW * 0.5, -HD * 0.5), wz(HW * 0.5, -HD * 0.5)]);
};

W.buildFarm = function (P) {
  const a = W.A.FAZENDA, base = a.h - 0.05;
  W.shed(P, a.x - 14, a.z - 12, 0.3, base, 6, 8, 5.5, 0xb8322a, 0x5b5f63, 'wood', 'metal');
  // silos
  for (const [ox, oz] of [[-2, -26], [4, -27]]) {
    const x = a.x + ox, z = a.z + oz;
    P.push(U.part(new THREE.CylinderGeometry(2.4, 2.4, 11, 18), 0xd9dde0, U.mat4(x, base + 5.5, z), null, 'metal'));
    P.push(U.part(new THREE.SphereGeometry(2.4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xb0b7bd, U.mat4(x, base + 11, z), 'radial', 'metal'));
    W.addCollider({ type: 'c', x: x, z: z, r: 2.4, y0: base, y1: base + 13 });
    W.occupied.push([x, z, 4]);
  }
  // fardos de feno
  for (let i = 0; i < 9; i++) {
    const x = a.x + 6 + (i % 3) * 2.8, z = a.z - 10 + Math.floor(i / 3) * 3.2;
    P.push(U.part(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 14).rotateZ(Math.PI / 2), 0xe2c25a, U.mat4(x, base + 0.85, z, 0, i * 0.4, 0), null, 'plain'));
    W.addCollider({ type: 'c', x: x, z: z, r: 0.9, y0: base, y1: base + 1.7 });
  }
  // cerca
  const fr = 24;
  for (let i = 0; i < 40; i++) {
    const an = i / 40 * Math.PI * 2;
    if (i % 10 === 2) continue;
    const x = a.x + 10 + Math.cos(an) * fr, z = a.z + 8 + Math.sin(an) * fr;
    P.push(U.part(new THREE.BoxGeometry(0.14, 1.1, 0.14), 0x8a5a33, U.mat4(x, W.height(x, z) + 0.45, z), 'radial', 'wood'));
    P.push(U.part(new THREE.BoxGeometry(0.08, 0.12, fr * 2 * Math.PI / 40), 0x9a6a43, U.mat4(x, W.height(x, z) + 0.8, z, 0, -an, 0), 'radial', 'wood'));
  }
  W.house(P, a.x + 20, a.z - 20, -0.4, base, 2, 'colorida');
  W.occupied.push([a.x + 10, a.z + 8, 20]);
};

W.buildLighthouse = function (P) {
  const a = W.A.FAROL, base = a.h - 0.05;
  const x = a.x, z = a.z;
  for (let i = 0; i < 6; i++) {
    const r0 = 2.6 - i * 0.22, r1 = 2.6 - (i + 1) * 0.22;
    P.push(U.part(new THREE.CylinderGeometry(r1, r0, 3, 18), i % 2 ? 0xd93a2f : 0xf6f4ef, U.mat4(x, base + 1.5 + i * 3, z), null, 'plaster'));
  }
  P.push(U.part(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 18), 0x2f3b45, U.mat4(x, base + 18.15, z), null, 'metal'));
  P.push(U.part(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 12), 0xfff3a8, U.mat4(x, base + 19.2, z), null, 'glass'));
  P.push(U.part(new THREE.ConeGeometry(1.5, 1.4, 12), 0xd93a2f, U.mat4(x, base + 20.8, z), 'radial', 'roof'));
  W.addCollider({ type: 'c', x: x, z: z, r: 2.6, y0: base, y1: base + 21 });
  W.house(P, x + 7, z + 6, Math.PI * 0.85, base, 1, 'tropical', [2.6, 2.2]);
  W.occupied.push([x, z, 6]);
};

W.buildRuins = function (P) {
  const a = W.A['RUÍNAS'];
  const stone = [0xe6d7b4, 0xd9c9a3, 0xeee2c6];
  const base = a.h - 0.3;
  const R = (i) => stone[i % 3];
  const wall = (x0, z0, x1, z1, gaps, hBase) => {
    const len = Math.hypot(x1 - x0, z1 - z0), rot = -Math.atan2(z1 - z0, x1 - x0);
    const n = Math.round(len / 2.6);
    for (let i = 0; i < n; i++) {
      if (gaps.indexOf(i) >= 0) continue;
      const t = (i + 0.5) / n;
      const h = hBase * (0.55 + U.hash2(x0 + i, z0) * 0.6);
      W.box(P, U.lerp(x0, x1, t) + a.x, U.lerp(z0, z1, t) + a.z, len / n - 0.15, h, 1.0, rot, R(i), base, null, 'stone');
    }
  };
  wall(-16, -16, 16, -16, [2, 3, 8], 1.8);
  wall(16, -16, 16, 16, [5, 6], 1.6);
  wall(16, 16, -16, 16, [1, 7, 8], 1.8);
  wall(-16, 16, -16, -16, [3, 4, 5], 1.4);
  const blocks = [[-6, -4, 3, 0.9, 3, 0.2], [5, 6, 4, 1.1, 2.4, -0.4], [7, -7, 2.2, 0.8, 2.2, 0.7], [-8, 8, 3.5, 0.7, 2, 0.1],
    [0, 0, 5, 0.6, 5, 0], [0, 0, 3, 1.2, 3, 0.785], [-25, 4, 3, 1, 2, 0.3], [24, -6, 2.5, 0.9, 3, -0.2], [3, -25, 3, 1.2, 2, 0.5], [-4, 26, 4, 0.8, 2.5, 0.2]];
  blocks.forEach((b, i) => W.box(P, a.x + b[0], a.z + b[1], b[2], b[3], b[4], b[5], R(i), base, null, 'stone'));
  const pill = [[-12, -12], [12, -12], [12, 12], [-12, 12], [-20, -22], [22, 20]];
  pill.forEach((p, i) => {
    const h = i < 4 ? 4.2 : 2.6;
    const x = a.x + p[0], z = a.z + p[1];
    P.push(U.part(new THREE.CylinderGeometry(0.55, 0.62, h, 12), 0xf4efe2, U.mat4(x, base + h / 2, z), null, 'stone'));
    P.push(U.part(new THREE.BoxGeometry(1.5, 0.35, 1.5), 0xe2d6bb, U.mat4(x, base + h + 0.17, z), 'radial', 'stone'));
    W.addCollider({ type: 'c', x: x, z: z, r: 0.62, y0: base, y1: base + h + 0.4 });
  });
  W.occupied.push([a.x, a.z, a.r]);
};

W.buildRocks = function (P, rnd) {
  let n = 0, tries = 0;
  while (n < (W.MAP.rocks === undefined ? 60 : W.MAP.rocks) && tries < 3000) {
    tries++;
    const [x, z] = W.randLand(rnd, 4);
    if (W.keepOutAreas(x, z, 2) || W.pathDist(x, z) < 4 || !W.isFree(x, z, 3, W.occupied)) continue;
    const s = 0.8 + rnd() * 1.8, y = W.height(x, z);
    P.push(U.part(new THREE.IcosahedronGeometry(1, 0), 0x9a9b90, U.mat4(x, y + s * 0.3, z, rnd(), rnd() * 6, rnd(), s * 1.3, s * 0.8, s), 'radial', 'stone'));
    W.addCollider({ type: 'c', x: x, z: z, r: s * 1.05, y0: y - 1, y1: y + s * 1.05 });
    W.occupied.push([x, z, s + 1.5]);
    n++;
  }
};

W.buildCrates = function (P, rnd) {
  let n = 0, tries = 0;
  while (n < (W.MAP.crates === undefined ? 50 : W.MAP.crates) && tries < 3000) {
    tries++;
    const [x, z] = W.randLand(rnd, 22);
    if (!W.isFree(x, z, 2.5, W.occupied) || W.height(x, z) < 0.2) continue;
    const s = 1.1 + rnd() * 0.4, rot = rnd() * 3;
    W.box(P, x, z, s, s, s, rot, n % 2 ? 0xb47c45 : 0xa86f3c, W.height(x, z) - 0.05, null, 'wood');
    P.push(U.part(new THREE.BoxGeometry(s * 1.02, 0.14, s * 1.02), 0x7d4f28, U.mat4(x, W.height(x, z) + s * 0.5, z, 0, rot, 0), 'radial', 'wood'));
    W.occupied.push([x, z, 1.5]);
    n++;
  }
};

// --- grama instanciada que acompanha o jogador (fixa no mundo, sem "deslizar") ---
W.buildGrass = function (scene, quality) {
  const counts = { baixa: 3200, media: 7000, alta: 12000 };
  W.grassN = counts[quality] || 7000;
  W.grassSize = quality === 'baixa' ? 44 : quality === 'alta' ? 70 : 60;
  const blade = new THREE.BufferGeometry();
  const v = [];
  // tufo de 5 folhas curvas (2 triângulos cada)
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.4, ca = Math.cos(a), sa = Math.sin(a);
    const w = 0.055, h = 0.34 + (i % 3) * 0.07, lean = 0.12;
    const px = -sa * w, pz = ca * w;
    const tx = ca * lean, tz = sa * lean;
    v.push(-px, 0, -pz, px, 0, pz, px * 0.4 + tx * 0.6, h * 0.6, pz * 0.4 + tz * 0.6);
    v.push(-px, 0, -pz, px * 0.4 + tx * 0.6, h * 0.6, pz * 0.4 + tz * 0.6, -px * 0.4 + tx * 0.6, h * 0.6, -pz * 0.4 + tz * 0.6);
    v.push(-px * 0.4 + tx * 0.6, h * 0.6, -pz * 0.4 + tz * 0.6, px * 0.4 + tx * 0.6, h * 0.6, pz * 0.4 + tz * 0.6, tx, h, tz);
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  blade.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() } },
    vertexShader: [
      'uniform float uTime; uniform vec3 uPlayer; varying float vH; varying float vR; varying vec3 vC;',
      'void main(){',
      ' vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0);',
      ' float h = position.y; vH = h / 0.48;',
      ' vR = fract(sin(dot(wp.xz, vec2(12.9898,78.233))) * 43758.5453);',
      ' vC = vec3(0.45, 0.72, 0.3);',
      ' #ifdef USE_INSTANCING_COLOR',
      ' vC = instanceColor;',
      ' #endif',
      ' float w = sin(uTime*2.2 + wp.x*0.35 + wp.z*0.25) * 0.5 + sin(uTime*3.7 + wp.x*0.9) * 0.25;',
      ' wp.x += w * 0.14 * vH; wp.z += w * 0.07 * vH;',
      // a grama se abre quando o personagem passa
      ' vec2 dp = wp.xz - uPlayer.xz; float dl = length(dp);',
      ' wp.xz += normalize(dp + 0.0001) * max(0.0, 0.9 - dl) * 0.55 * vH;',
      ' gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'].join('\n'),
    fragmentShader: [
      'varying float vH; varying float vR; varying vec3 vC;',
      'void main(){ vec3 base = vC * 0.5; vec3 tip = vC * 1.08 + vec3(0.01, 0.02, 0.0);',
      ' vec3 c = mix(base, tip, smoothstep(0.0, 1.0, vH)); c *= (0.85 + vR * 0.3) * 1.05; gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '}'].join('\n'),
  });
  W.grass = new THREE.InstancedMesh(blade, mat, W.grassN);
  W.grass.frustumCulled = false;
  W.grass.setColorAt(0, new THREE.Color(1, 1, 1));
  scene.add(W.grass);
  W.grassMat = mat;

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
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  let k = 0, f = 0;
  const fcol = [new THREE.Color(0xffffff), new THREE.Color(0xff9fc8), new THREE.Color(0xfff07a)];
  for (let i = 0; i < side && k < N; i++) for (let j = 0; j < side && k < N; j++) {
    const gx = ox + i, gz = oz + j;
    const x = (gx + U.hash2(gx, gz)) * sp, z = (gz + U.hash2(gz + 7, gx - 3)) * sp;
    const T = W.tg, sa = W.grid2(T.sand, x, z), y = W.grid2(T.h, x, z);
    let sc = (0.8 + U.hash2(gx * 3, gz) * 0.65) * (1 - U.smooth(0.15, 0.5, sa));
    if (sc > 0 && (y < W.SEA_Y + 0.2 || W.inHouse(x, z))) sc = 0;
    e.set(0, U.hash2(gx, gz * 5) * 6.28, 0); q.setFromEuler(e);
    p.set(x, y - 0.03, z); s.set(sc, sc * (0.75 + U.hash2(gz, gx) * 0.7), sc);
    m.compose(p, q, s);
    W.grass.setMatrixAt(k, m);
    col.setRGB(W.grid2(T.col, x, z, 3, 0), W.grid2(T.col, x, z, 3, 1), W.grid2(T.col, x, z, 3, 2));
    W.grass.setColorAt(k, col);
    k++;
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
  if (W.grass.instanceColor) W.grass.instanceColor.needsUpdate = true;
  W.flowers.instanceMatrix.needsUpdate = true;
  if (W.flowers.instanceColor) W.flowers.instanceColor.needsUpdate = true;
};

W.update = function (dt, px, pz, py) {
  W.time += dt;
  if (W.grassMat) { W.grassMat.uniforms.uTime.value = W.time; W.grassMat.uniforms.uPlayer.value.set(px, py || 0, pz); }
  if (W.seaMat) W.seaMat.uniforms.uTime.value = W.time;
  if (Math.hypot(px - W.grassCenter.x, pz - W.grassCenter.z) > W.grassSize * 0.14) {
    W.grassCenter.x = px; W.grassCenter.z = pz;
    W.placeGrass(px, pz);
    W.updateOutlines(px, pz);
  }
  if (W.clouds) W.clouds.rotation.y += dt * 0.002;
  if (W.spinners) for (const s of W.spinners) s.o.rotation.z += dt * s.v;
};
