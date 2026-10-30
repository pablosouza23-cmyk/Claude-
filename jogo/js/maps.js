'use strict';
// Mapas jogáveis. Cada um define o formato da ilha, as áreas com seus marcadores, as estradas
// e as etapas de construção. "ilha" é o mapa original; "triangulo" é uma ilha em forma de
// triângulo com cidade da torre do relógio, pico com observatório, fábrica, hangar, usina,
// estaleiro, vila do moinho, arrozais e povoado (inspirado nos mapas clássicos de battle royale).
(function () {
  const BOX = new THREE.BoxGeometry(1, 1, 1);

  // referencial local (x, z, giro) para montar construções com caixas e colisores
  W.frame = function (P, x, z, rot, base) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const F = { x: x, z: z, rot: rot, base: base, c: c, s: s };
    F.wx = (lx, lz) => x + lx * c + lz * s;
    F.wz = (lx, lz) => z - lx * s + lz * c;
    // coll: 0 = só visual, 1 = sólido, 2 = sólido e dá para subir em cima
    F.box = (lx, ly, lz, w, h, d, col, mat, coll, ry) => {
      P.push(U.part(BOX, col, U.mat4(F.wx(lx, lz), base + ly + h / 2, F.wz(lx, lz), 0, rot + (ry || 0), 0, w, h, d), 'radial', mat || 'plain'));
      if (coll) return W.addCollider({ type: 'b', x: F.wx(lx, lz), z: F.wz(lx, lz), hx: w / 2, hz: d / 2, rot: rot + (ry || 0), y0: base + ly, y1: base + ly + h, walkable: coll === 2 });
      return null;
    };
    F.part = (geo, col, lx, ly, lz, mat, sx, sy, sz, ry, rx) => P.push(U.part(geo, col,
      U.mat4(F.wx(lx, lz), base + ly, F.wz(lx, lz), rx || 0, rot + (ry || 0), 0, sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz), 'radial', mat || 'plain'));
    F.post = (lx, lz, r, y0, y1) => W.addCollider({ type: 'c', x: F.wx(lx, lz), z: F.wz(lx, lz), r: r, y0: base + y0, y1: base + y1 });
    F.loot = (lx, lz, ly) => W.lootSpots.push([F.wx(lx, lz), F.wz(lx, lz), base + (ly || 0)]);
    return F;
  };
  // gira para a frente (+z local) olhar para um ponto
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

  // parede com aberturas [centro, largura, baixo, alto] ao longo de x ou z do referencial
  function wall(F, along, fixed, half, y0, H, T, ops, col, mat) {
    ops = ops.slice().sort((p, q) => p[0] - q[0]);
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.02 || yb - ya < 0.02) return;
      const m = (a + b) / 2;
      if (along === 'x') F.box(m, y0 + ya, fixed, b - a, yb - ya, T, col, mat, 1);
      else F.box(fixed, y0 + ya, m, T, yb - ya, b - a, col, mat, 1);
    };
    let cur = -half;
    for (const o of ops) {
      const a = o[0] - o[1] / 2, b = o[0] + o[1] / 2;
      seg(cur, a, 0, H); seg(a, b, 0, o[2]); seg(a, b, o[3], H);
      cur = b;
    }
    seg(cur, half, 0, H);
  }

  // ---------- prédio de vários andares com escada até o terraço ----------
  W.building = function (P, x, z, rot, base, HW, HD, floors, col, trim) {
    const F = W.frame(P, x, z, rot, base), FH = 3.2, T = 0.25, SL = 0.25;
    const n = 10, rise = FH / n, run = 0.46, IW = HW - T / 2, ID = HD - T / 2;
    const zs = ID - 0.35, zEnd = zs - n * run;
    const colX = (k) => -IW + k * 1.3;
    const slab = 0xcfc8bb, stairC = 0xb9b2a5, rail = 0x3a3f44;
    const wins = (half, door, skip) => {
      const ops = [], cnt = Math.max(1, Math.floor(half * 2 / 3.1));
      for (let i = 0; i < cnt; i++) {
        const c = -half + (i + 0.5) * (half * 2 / cnt);
        if (door !== undefined && Math.abs(c - door) < 1.5) continue;
        if (skip && skip(c)) continue;
        ops.push([c, 1.1, 1.0, 2.25]);
      }
      if (door !== undefined) ops.push([door, 1.5, 0, 2.4]);
      return ops;
    };
    F.box(0, -0.4, 0, HW * 2 + T, 0.45, HD * 2 + T, slab, 'stone', 2);
    for (let f = 0; f <= floors; f++) {
      const y0 = f * FH, top = y0 + FH;
      const roof = f === floors;
      if (!roof) {
        wall(F, 'x', HD, HW + T / 2, y0, FH, T, wins(HW, f === 0 ? HW * 0.42 : undefined), col, 'plaster');
        wall(F, 'x', -HD, HW + T / 2, y0, FH, T, wins(HW, f === 0 ? -HW * 0.42 : undefined), col, 'plaster');
        wall(F, 'z', HW, ID, y0, FH, T, wins(ID), col, 'plaster');
        wall(F, 'z', -HW, ID, y0, FH, T, wins(ID, undefined, (c) => c > zEnd - 0.8), col, 'plaster');
        // faixa entre andares
        F.box(0, top - 0.32, HD + T / 2 + 0.05, HW * 2 + T + 0.2, 0.32, 0.1, trim, 'plain');
        F.box(0, top - 0.32, -HD - T / 2 - 0.05, HW * 2 + T + 0.2, 0.32, 0.1, trim, 'plain');
        F.box(HW + T / 2 + 0.05, top - 0.32, 0, 0.1, 0.32, HD * 2 + T, trim, 'plain');
        F.box(-HW - T / 2 - 0.05, top - 0.32, 0, 0.1, 0.32, HD * 2 + T, trim, 'plain');
        // lance de escada deste andar para o próximo (colunas alternadas)
        const k = f % 2, sx = colX(k) + 0.65;
        for (let i = 0; i < n; i++) F.box(sx, y0, zs - (i + 0.5) * run, 1.3, (i + 1) * rise, run, stairC, 'stone', 2);
        // móveis/cobertura e itens
        F.box(IW * 0.45, y0, -ID * 0.45, 1.6, 0.85, 0.8, 0x9a6233, 'wood', 2);
        if (f > 0 || HW > 4.5) F.box(IW * 0.55, y0, ID * 0.35, 0.8, 1.1, 1.4, 0x7d8a8f, 'metal', 2);
        F.loot(IW * 0.2, -ID * 0.1, y0);
        F.loot(-IW * 0.15, -ID * 0.6, y0);
        // laje de cima com o vão da escada
        const hx0 = colX(k), hx1 = hx0 + 1.3;
        F.box(0, top - SL, (-ID + zEnd) / 2, IW * 2, SL, zEnd + ID, slab, 'stone', 2);
        if (hx0 > -IW + 0.02) F.box((-IW + hx0) / 2, top - SL, (zEnd + ID) / 2, hx0 + IW, SL, ID - zEnd, slab, 'stone', 2);
        F.box((hx1 + IW) / 2, top - SL, (zEnd + ID) / 2, IW - hx1, SL, ID - zEnd, slab, 'stone', 2);
        // guarda-corpo em volta do vão
        F.box(hx1, top, (zEnd + ID) / 2 + 0.3, 0.07, 1.0, ID - zEnd - 0.6, rail, 'metal', 1);
        if (hx0 > -IW + 0.02) F.box(hx0, top, (zEnd + ID) / 2 + 0.3, 0.07, 1.0, ID - zEnd - 0.6, rail, 'metal', 1);
      } else {
        // terraço com mureta
        const t = 0.22, ph = 1.05;
        F.box(0, y0, HD + T / 2 - t / 2, HW * 2 + T, ph, t, col, 'plaster', 1);
        F.box(0, y0, -HD - T / 2 + t / 2, HW * 2 + T, ph, t, col, 'plaster', 1);
        F.box(HW + T / 2 - t / 2, y0, 0, t, ph, HD * 2 + T, col, 'plaster', 1);
        F.box(-HW - T / 2 + t / 2, y0, 0, t, ph, HD * 2 + T, col, 'plaster', 1);
        F.box(0, y0 + ph, 0, HW * 2 + T + 0.12, 0.08, HD * 2 + T + 0.12, trim, 'stone');
        F.box(IW * 0.4, y0, -ID * 0.3, 1.4, 1.2, 1.4, 0x9aa3a8, 'metal', 2);
        F.loot(IW * 0.1, -ID * 0.5, y0);
      }
    }
    // forro do terraço: bloqueia a câmera vinda de cima só por dentro
    W.occupied.push([x, z, Math.max(HW, HD) + 3.5]);
    W.houses.push({ x: x, z: z, c: F.c, s: F.s, hw: HW + 0.3, hd: HD + 0.3, h: base + FH * floors, b: base, fw: HW, fd: HD });
  };

  // ---------- hangar com teto em arco ----------
  const ARCH = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  const HALF_DISC = new THREE.CircleGeometry(1, 18, 0, Math.PI);
  W.hangar = function (P, x, z, rot, base, HW, HD, H, col, roofCol) {
    const F = W.frame(P, x, z, rot, base), T = 0.3, rise = HW * 0.55;
    F.box(0, -0.4, 0, HW * 2, 0.45, HD * 2, 0x8f9296, 'stone', 2);
    F.box(-HW, 0, 0, T, H, HD * 2, col, 'metal', 1);
    F.box(HW, 0, 0, T, H, HD * 2, col, 'metal', 1);
    F.box(0, 0, -HD, HW * 2, H, T, col, 'metal', 1);
    F.box(-HW + 1.2, 0, HD, 2.4, H, T, col, 'metal', 1);
    F.box(HW - 1.2, 0, HD, 2.4, H, T, col, 'metal', 1);
    F.box(0, H - 0.6, HD, HW * 2, 0.6, T + 0.1, 0xe8b21c, 'metal');
    F.part(ARCH, roofCol, 0, H, 0, 'metal', HW + 0.25, rise, HD * 2 + 0.5);
    F.part(ARCH, 0x6d7378, 0, H - 0.05, 0, 'metal', -(HW + 0.05), rise * 0.97, HD * 2 + 0.3);
    for (const sd of [-1, 1]) {
      F.part(HALF_DISC, col, 0, H, sd * HD, 'metal', HW + 0.05, rise, 1, sd > 0 ? 0 : Math.PI);
      F.part(HALF_DISC, 0x6d7378, 0, H, sd * (HD - 0.05), 'metal', HW, rise, 1, sd > 0 ? Math.PI : 0);
    }
    W.addCollider({ type: 'b', x: x, z: z, hx: HW, hz: HD, rot: rot, y0: base + H, y1: base + H + rise, walkable: false, ceiling: true });
    // caixotes e um trator de reboque dentro
    for (let i = 0; i < 4; i++) F.box(-HW + 2 + (i % 2) * 1.4, 0, -HD + 2 + Math.floor(i / 2) * 1.4, 1.2, 1.2, 1.2, 0xa86f3c, 'wood', 2);
    F.box(HW - 3, 0, -HD + 3, 2.2, 1.4, 3.2, 0xd9a21c, 'metal', 2);
    F.loot(0, 0); F.loot(-HW * 0.5, HD * 0.4); F.loot(HW * 0.5, -HD * 0.5);
    W.occupied.push([x, z, Math.max(HW, HD) + 3]);
    W.houses.push({ x: x, z: z, c: F.c, s: F.s, hw: HW, hd: HD, h: base + H, b: base, fw: HW - 0.2, fd: HD - 0.2 });
  };

  // avião parado (cobertura no meio da pista)
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2);
  const CONE = new THREE.ConeGeometry(1, 1, 14).rotateX(Math.PI / 2);
  W.parkedPlane = function (P, x, z, rot, base) {
    const F = W.frame(P, x, z, rot, base);
    F.part(CYL, 0xeceff1, 0, 1.9, 0, 'metal', 1.3, 1.3, 13);
    F.part(CONE, 0xeceff1, 0, 1.9, 8.2, 'metal', 1.3, 1.3, 3.4);
    F.part(CONE, 0xeceff1, 0, 2.1, -8, 'metal', 1.1, 1.1, -3);
    F.box(0, 2.05, 6.6, 1.9, 0.6, 0.9, 0x22313f, 'glass');
    F.box(0, 1.5, 0.5, 15, 0.25, 2.6, 0xd8dde0, 'metal', 1);
    F.box(0, 2.4, -8.6, 0.25, 3.0, 1.8, 0xd84f2a, 'metal');
    F.box(0, 2.4, -8.6, 5.2, 0.2, 1.4, 0xd8dde0, 'metal');
    for (const sd of [-1, 1]) F.part(CYL, 0x8a9096, sd * 3.6, 1.1, 1.3, 'metal', 0.55, 0.55, 2.2);
    for (const p of [[0, 6], [-2, 0], [2, 0]]) F.box(p[0], 0, p[1], 0.2, 0.7, 0.2, 0x2f3b45, 'metal');
    W.addCollider({ type: 'b', x: x, z: z, hx: 1.3, hz: 9, rot: rot, y0: base + 0.6, y1: base + 3.2, walkable: true });
    W.occupied.push([x, z, 9]);
  };

  // torre de energia e cabos
  W.pylon = function (P, x, z, base, H) {
    const F = W.frame(P, x, z, 0, base), m = 0x8d969c;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(sx * 0.9, 0, sz * 0.9, 0.16, H, 0.16, m, 'metal');
    for (let y = 2; y < H; y += 2.6) { F.box(0, y, 0.9, 1.9, 0.12, 0.12, m, 'metal'); F.box(0, y, -0.9, 1.9, 0.12, 0.12, m, 'metal'); F.box(0.9, y, 0, 0.12, 0.12, 1.9, m, 'metal'); F.box(-0.9, y, 0, 0.12, 0.12, 1.9, m, 'metal'); }
    F.box(0, H - 0.6, 0, 7, 0.25, 0.3, m, 'metal');
    F.box(0, H - 2.6, 0, 5, 0.25, 0.3, m, 'metal');
    F.post(0, 0, 1.25, 0, H);
    W.occupied.push([x, z, 2.5]);
    return [x, base + H - 0.9, z];
  };
  const WIRE = new THREE.CylinderGeometry(0.035, 0.035, 1, 4).rotateZ(Math.PI / 2);
  W.wire = function (P, a, b, off) {
    for (const o of off) {
      const ax = a[0], az = a[2] + o, bx = b[0], bz = b[2] + o;
      const L = Math.hypot(bx - ax, bz - az);
      P.push(U.part(WIRE, 0x2a2d30, U.mat4((ax + bx) / 2, (a[1] + b[1]) / 2 - 0.6, (az + bz) / 2, 0, -Math.atan2(bz - az, bx - ax), 0, L, 1, 1), null, 'metal'));
    }
  };

  // torre de resfriamento (usina)
  const coolGeo = (() => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, r = Math.sqrt(1 + Math.pow((t - 0.72) / 0.42, 2) * 1.6); pts.push(new THREE.Vector2(r, t)); }
    return new THREE.LatheGeometry(pts, 28);
  })();
  W.coolingTower = function (P, x, z, base, rMin, H) {
    P.push(U.part(coolGeo, 0xc9c3b6, U.mat4(x, base - 0.3, z, 0, 0, 0, rMin, H, rMin), null, 'plaster'));
    P.push(U.part(coolGeo, 0x8f8a80, U.mat4(x, base - 0.3, z, 0, 0, 0, -rMin * 0.96, H * 0.995, rMin * 0.96), null, 'plaster'));
    P.push(U.part(new THREE.CylinderGeometry(rMin * 1.33, rMin * 1.35, H * 0.05, 28, 1, true), 0xb8322a, U.mat4(x, base + H * 0.9, z), null, 'plaster'));
    W.addCollider({ type: 'c', x: x, z: z, r: rMin * 2.2, y0: base - 1, y1: base + H * 0.3 });
    W.addCollider({ type: 'c', x: x, z: z, r: rMin * 1.45, y0: base + H * 0.3, y1: base + H });
    W.occupied.push([x, z, rMin * 2.6]);
  };

  // pás que giram (moinho): malha separada animada em W.update
  W.spinners = [];
  W.spinner = function (x, y, z, rot, radius) {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      parts.push(U.part(BOX, 0xf3ecdc, U.mat4(Math.cos(a) * radius / 2, Math.sin(a) * radius / 2, 0, 0, 0, a, radius, 0.14, 0.1), null, 'wood'));
      parts.push(U.part(BOX, 0xe9e1cf, U.mat4(Math.cos(a) * radius * 0.58 - Math.sin(a) * 0.55, Math.sin(a) * radius * 0.58 + Math.cos(a) * 0.55, 0.05, 0, 0, a, radius * 0.8, 1.0, 0.04), null, 'fabric'));
    }
    parts.push(U.part(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 10).rotateX(Math.PI / 2), 0x6b4a2a, null, null, 'wood'));
    const pack = U.buildBy(parts), g = new THREE.Group(), spin = new THREE.Group();
    for (const k in pack.mats) { const m = new THREE.Mesh(pack.mats[k], TX.mat(k)); m.castShadow = true; spin.add(m); }
    g.position.set(x, y, z); g.rotation.y = rot; g.add(spin);
    W.root.add(g);
    W.spinners.push({ o: spin, v: 0.7 });
  };

  // ---------- áreas do mapa Triângulo ----------
  W.buildClockTown = function (P) {
    const a = W.A['TORRE DO RELÓGIO'], base = a.h - 0.05;
    const F = W.frame(P, a.x, a.z, 0, base);
    F.box(0, -0.2, 0, 26, 0.3, 26, 0xd9d2c4, 'stone', 2);
    F.box(0, 0.1, 0, 7, 0.32, 7, 0xbfb6a6, 'stone', 2);
    const st = 0xd8cfbf, dk = 0xa89d8a;
    F.box(0, 0.42, 0, 4.6, 19.6, 4.6, st, 'stone', 1);
    for (const y of [5, 10, 15]) F.box(0, y, 0, 4.9, 0.35, 4.9, dk, 'stone');
    F.box(0, 20, 0, 5.4, 4.2, 5.4, 0xe6dfd2, 'stone', 1);
    F.box(0, 24.2, 0, 5.8, 0.4, 5.8, dk, 'stone');
    const disc = new THREE.CylinderGeometry(1, 1, 0.12, 28).rotateX(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const ry = i * Math.PI / 2, ox = Math.sin(ry) * 2.72, oz = Math.cos(ry) * 2.72;
      F.part(disc, 0x3a3226, ox, 22.1, oz, 'metal', 1.75, 1.75, 1, ry);
      F.part(disc, 0xf6f1e4, ox * 1.012, 22.1, oz * 1.012, 'plaster', 1.55, 1.55, 1, ry);
      // ponteiros (10h10)
      const hx = Math.sin(ry) * 2.82, hz = Math.cos(ry) * 2.82;
      P.push(U.part(BOX, 0x1d1d1d, new THREE.Matrix4().compose(new THREE.Vector3(a.x + hx - Math.cos(ry) * 0.3, base + 22.45, a.z + hz + Math.sin(ry) * 0.3),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0.9, 'YXZ')), new THREE.Vector3(0.12, 0.95, 0.05)), null, 'metal'));
      P.push(U.part(BOX, 0x1d1d1d, new THREE.Matrix4().compose(new THREE.Vector3(a.x + hx + Math.cos(ry) * 0.45, base + 22.55, a.z + hz - Math.sin(ry) * 0.45),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, -1.0, 'YXZ')), new THREE.Vector3(0.09, 1.25, 0.05)), null, 'metal'));
    }
    // campanário aberto e telhado
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(sx * 2.3, 24.6, sz * 2.3, 0.8, 3.2, 0.8, st, 'stone');
    F.box(0, 24.6, 0, 1.4, 1.4, 1.4, 0xb08a3c, 'metal');
    F.box(0, 27.8, 0, 6, 0.4, 6, dk, 'stone');
    F.part(new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4), 0x2f6f7a, 0, 28.2 + 2.6, 0, 'roof', 4.6, 5.2, 4.6);
    F.post(0, 0, 3.4, 20, 29);
    W.occupied.push([a.x, a.z, 9]);
    // postes e bancos
    for (let i = 0; i < 4; i++) {
      const an = i * Math.PI / 2 + 0.785, px = Math.cos(an) * 9, pz = Math.sin(an) * 9;
      F.box(px, 0, pz, 0.16, 3.4, 0.16, 0x2b2f33, 'metal');
      F.part(new THREE.SphereGeometry(0.32, 10, 8), 0xfff2c4, px, 3.6, pz, 'glass');
      F.box(Math.cos(an) * 6.5, 0, Math.sin(an) * 6.5, 1.8, 0.45, 0.5, 0x9a6233, 'wood', 2, -an + Math.PI / 2);
    }
    // prédios nos cantos da praça e casas coloridas por fora
    const blds = [[-19, -17, 3, 0xe9d8b4], [19, -17, 2, 0xb9d3e0], [-19, 17, 2, 0xf0c7a8], [19, 17, 3, 0xd7e2bf]];
    blds.forEach((b, i) => W.building(P, a.x + b[0], a.z + b[1], face(b[0], b[1], 0, 0), base, 5, 4.4, b[2], b[3], i % 2 ? 0xffffff : 0x8a5a33));
    const hs = [[-30, 0], [30, 2], [1, -30], [-2, 30]];
    hs.forEach((h, i) => W.house(P, a.x + h[0], a.z + h[1], face(h[0], h[1], 0, 0), base, i + 1, 'colorida'));
  };

  W.buildPeak = function (P) {
    const a = W.A.PICO, base = a.h - 0.05;
    const F = W.frame(P, a.x, a.z, 0.4, base);
    F.box(0, -0.3, 0, 18, 0.4, 18, 0xc9c2b4, 'stone', 2);
    // observatório: base, cúpula e fresta
    F.part(new THREE.CylinderGeometry(5.6, 5.8, 4.4, 28), 0xf1efe8, 0, 2.2, 0, 'plaster');
    F.part(new THREE.SphereGeometry(5.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xb8c0c6, 0, 4.4, 0, 'metal');
    F.part(CYL, 0x2b3036, 0, 8.6, 3.4, 'metal', 0.55, 0.55, 3.2, 0, -0.6);
    F.post(0, 0, 5.8, -0.5, 9.8);
    F.box(0, 0, 5.9, 1.6, 2.4, 0.4, 0x6b4a2a, 'wood');
    // antenas treliçadas e uma parabólica
    for (const p of [[-8, -5, 16], [7, -6, 12]]) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(p[0] + sx * 0.5, 0, p[1] + sz * 0.5, 0.1, p[2], 0.1, 0xd9dde0, 'metal');
      for (let y = 1.5; y < p[2]; y += 1.8) F.box(p[0], y, p[1], 1.1, 0.08, 1.1, 0xd84f2a, 'metal');
      F.part(new THREE.SphereGeometry(0.22, 8, 6), 0xff3b2a, p[0], p[2] + 0.2, p[1], 'glass');
      F.post(p[0], p[1], 0.8, 0, p[2]);
    }
    F.part(new THREE.SphereGeometry(2.4, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), 0xeceff1, 7, 3.2, 5, 'metal', 1, 1, 1, 0, -0.9);
    F.box(7, 0, 5, 0.5, 2.6, 0.5, 0x8d969c, 'metal', 1);
    // casinha de pesquisa e sacos de areia
    W.house(P, F.wx(-1, -10), F.wz(-1, -10), 0.4 + Math.PI, base, 4, 'tropical', [2.8, 2.4]);
    for (let i = 0; i < 6; i++) F.box(-7 + i * 1.2, 0, 7.5, 1.1, 0.7, 0.6, 0xb59f74, 'fabric', 2);
    F.loot(-3, 6); F.loot(3, -7); F.loot(8, 1);
    W.occupied.push([a.x, a.z, 14]);
  };

  W.buildFactory = function (P) {
    const a = W.A['FÁBRICA'], base = a.h - 0.05, rot = face(a.x, a.z, 0, 0);
    const F = W.frame(P, a.x, a.z, rot, base);
    F.box(0, -0.2, 0, 48, 0.25, 46, 0x8f9296, 'stone', 2);
    W.shed(P, F.wx(-11, -6), F.wz(-11, -6), rot, base, 8, 11, 7.5, 0x9aa4ab, 0x5b6268, 'metal', 'metal');
    W.shed(P, F.wx(10, -10), F.wz(10, -10), rot + Math.PI / 2, base, 6, 8, 6, 0xb8322a, 0x4d5257, 'metal', 'metal');
    // chaminés de tijolo com faixas
    for (const p of [[-3, -20], [3, -21]]) {
      F.part(new THREE.CylinderGeometry(0.9, 1.4, 22, 16), 0x9a5b45, p[0], 11, p[1], 'stone');
      F.part(new THREE.CylinderGeometry(0.95, 0.95, 1.2, 16), 0xf3f3f0, p[0], 19.5, p[1], 'plaster');
      F.part(new THREE.CylinderGeometry(0.93, 0.93, 1.2, 16), 0xd84f2a, p[0], 17.8, p[1], 'plaster');
      F.post(p[0], p[1], 1.4, 0, 22);
    }
    // tanques e canos
    const tanks = [[14, 8], [20, 8], [14, 15]];
    for (const t of tanks) {
      F.part(new THREE.CylinderGeometry(2.6, 2.6, 6.5, 20), 0xdfe3e6, t[0], 3.25, t[1], 'metal');
      F.part(new THREE.ConeGeometry(2.7, 1.1, 20), 0xc5cbd0, t[0], 7.05, t[1], 'metal');
      F.post(t[0], t[1], 2.65, 0, 7.6);
    }
    F.part(CYL, 0x8a9096, 17, 4.6, 8, 'metal', 0.35, 0.35, 6, Math.PI / 2);
    F.part(CYL, 0x8a9096, 14, 4.6, 11.5, 'metal', 0.35, 0.35, 7);
    F.part(CYL, 0x6d7378, 3, 3.2, 12, 'metal', 0.4, 0.4, 22, Math.PI / 2);
    for (let i = -2; i <= 2; i++) F.box(3 + i * 4.5, 0, 12, 0.3, 3.0, 0.3, 0x5b6268, 'metal', 1);
    // tanque deitado e paletes
    F.part(CYL, 0xe8b21c, -18, 1.9, 14, 'metal', 1.6, 1.6, 7);
    F.box(-18, 0, 14, 2.4, 0.8, 6, 0x5b6268, 'metal', 2);
    W.addCollider({ type: 'b', x: F.wx(-18, 14), z: F.wz(-18, 14), hx: 1.6, hz: 3.5, rot: rot, y0: base, y1: base + 3.5, walkable: true });
    for (let i = 0; i < 6; i++) F.box(-6 + (i % 3) * 1.6, 0, 16 + Math.floor(i / 3) * 1.6, 1.3, 0.9 + (i % 2) * 0.6, 1.3, 0xa86f3c, 'wood', 2);
    // escritório de 3 andares
    W.building(P, F.wx(-4, 20), F.wz(-4, 20), rot + Math.PI, base, 5, 4.2, 3, 0xd6d0c4, 0x2f6fd6);
    // contêineres
    const cols = [0x2e6fb5, 0x3fa36b, 0xe67e22, 0xc0392b];
    for (let i = 0; i < 4; i++) F.box(21, 0, -6 - i * 3, 6.1, 2.6, 2.45, cols[i], 'metal', 2, Math.PI / 2);
    F.box(21, 2.6, -9, 6.1, 2.6, 2.45, 0x7d3c98, 'metal', 2, Math.PI / 2);
    W.occupied.push([a.x, a.z, a.r]);
  };

  W.buildHangar = function (P) {
    const a = W.A.HANGAR, base = a.h - 0.05;
    const rw = a.runway, ox = rw[3] || 0, oz = rw[4] || 0;
    W.hangar(P, a.x - 14, a.z + 18, Math.PI, base, 9, 10, 6.5, 0xa3abb2, 0x6f8a99);
    W.hangar(P, a.x + 10, a.z + 18, Math.PI, base, 8, 9, 6, 0xb8bfc5, 0x8a6f5a);
    // torre de controle
    const tx = a.x + 28, tz = a.z + 14;
    const F = W.frame(P, tx, tz, 0, base);
    F.part(new THREE.CylinderGeometry(1.8, 2.2, 13, 16), 0xf1efe8, 0, 6.5, 0, 'plaster');
    F.part(new THREE.CylinderGeometry(3.3, 2.6, 3, 16), 0x2c4f6a, 0, 14.5, 0, 'glass');
    F.part(new THREE.CylinderGeometry(3.6, 3.6, 0.4, 16), 0xd8dde0, 0, 16.2, 0, 'metal');
    F.box(0, 16.4, 0, 0.12, 4, 0.12, 0x8d969c, 'metal');
    F.part(new THREE.SphereGeometry(0.2, 8, 6), 0xff3b2a, 0, 20.5, 0, 'glass');
    F.post(0, 0, 2.3, 0, 16.6);
    W.occupied.push([tx, tz, 5]);
    // terminal de 2 andares
    W.building(P, a.x - 34, a.z + 6, Math.PI / 2, base, 6, 4.4, 2, 0xe4e7ea, 0x2f6fd6);
    // avião na pista, cones e caixas
    W.parkedPlane(P, a.x + ox + 6, a.z + oz, Math.PI / 2, base);
    for (let i = 0; i < 8; i++) {
      const x = a.x + ox - 40 + i * 11, z = a.z + oz + (i % 2 ? 1 : -1) * (rw[2] + 1.2);
      P.push(U.part(new THREE.ConeGeometry(0.25, 0.7, 8), 0xff6a1c, U.mat4(x, W.height(x, z) + 0.3, z), null, 'plain'));
    }
    for (let i = 0; i < 5; i++) W.box(P, a.x - 6 + i * 2.2, a.z + 4, 1.4, 1.4, 1.4, 0.1 * i, 0xa86f3c, base, null, 'wood');
    W.occupied.push([a.x + ox, a.z + oz, 10]);
  };

  W.buildPowerPlant = function (P) {
    const a = W.A.USINA, base = a.h - 0.05, rot = face(a.x, a.z, 0, 0);
    const F = W.frame(P, a.x, a.z, rot, base);
    W.coolingTower(P, F.wx(-10, -12), F.wz(-10, -12), base, 3.9, 22);
    W.coolingTower(P, F.wx(10, -14), F.wz(10, -14), base, 3.4, 19);
    F.box(0, -0.2, 8, 34, 0.25, 18, 0x8f9296, 'stone', 2);
    W.building(P, F.wx(-8, 8), F.wz(-8, 8), rot, base, 6, 4.4, 2, 0xc9cfd4, 0xe8b21c);
    // transformadores cercados
    for (let i = 0; i < 4; i++) {
      const x = 6 + (i % 2) * 5, z = 5 + Math.floor(i / 2) * 5;
      F.box(x, 0, z, 2.6, 2.4, 1.8, 0x6d7378, 'metal', 2);
      for (let k = -1; k <= 1; k++) F.box(x + k * 0.8, 0.2, z + 0.95, 0.12, 2, 0.12, 0x4d5257, 'metal');
      F.part(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), 0xa45a2c, x - 0.6, 3.0, z, 'metal');
      F.part(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), 0xa45a2c, x + 0.6, 3.0, z, 'metal');
    }
    for (let i = 0; i <= 10; i++) {
      F.box(3.5 + i * 1.2, 0, 2, 0.08, 1.8, 0.08, 0x9aa3a8, 'metal');
      F.box(3.5 + i * 1.2, 0, 16, 0.08, 1.8, 0.08, 0x9aa3a8, 'metal');
    }
    F.box(9.5, 1.6, 2, 12, 0.06, 0.06, 0x9aa3a8, 'metal'); F.box(9.5, 1.6, 16, 12, 0.06, 0.06, 0x9aa3a8, 'metal');
    // linha de torres de energia rumo ao centro
    let prev = null;
    for (let i = 0; i < 4; i++) {
      const lx = 22 + i * 26, x = F.wx(4, lx), z = F.wz(4, lx);
      if (W.coastK(x, z) > W.LAND_R - 10 || W.keepOutAreas(x, z, -6) && i > 0) break;
      const top = W.pylon(P, x, z, W.height(x, z) - 0.1, 15);
      if (prev) W.wire(P, prev, top, [-3.2, 0, 3.2]);
      prev = top;
    }
    F.loot(0, 18); F.loot(14, 18); F.loot(-16, 2);
    W.occupied.push([a.x, a.z, a.r]);
  };

  W.buildShipyard = function (P, rnd) {
    const a = W.A.ESTALEIRO, base = a.h - 0.05;
    const ang = Math.atan2(a.z, a.x), rot = Math.atan2(Math.cos(ang), Math.sin(ang));
    const F = W.frame(P, a.x, a.z, rot, base);
    // contêineres
    const cols = [0xc0392b, 0x2e6fb5, 0x3fa36b, 0xe67e22, 0xe8c11c];
    let k = 0;
    for (let row = 0; row < 3; row++) for (let i = -2; i <= 2; i++) {
      if (rnd() < 0.3) continue;
      F.box(i * 7.2, 0, -8 - row * 6, 6.1, 2.6, 2.45, cols[k++ % 5], 'metal', 2);
      if (rnd() < 0.35) F.box(i * 7.2, 2.6, -8 - row * 6, 6.1, 2.6, 2.45, cols[k++ % 5], 'metal', 2);
    }
    // pórtico rolante
    for (const sx of [-9, 9]) {
      F.box(sx, 0, -2, 0.8, 15, 0.8, 0xe8b21c, 'metal', 1);
      F.box(sx, 0, 6, 0.8, 15, 0.8, 0xe8b21c, 'metal', 1);
      F.box(sx, 14, 2, 0.8, 0.8, 9, 0xe8b21c, 'metal');
    }
    F.box(0, 15, -2, 19, 1.0, 1.0, 0xe8b21c, 'metal'); F.box(0, 15, 6, 19, 1.0, 1.0, 0xe8b21c, 'metal');
    F.box(2, 13.6, 2, 2.6, 1.6, 9, 0x2f3b45, 'metal');
    // navio encalhado na rampa, com escada até o convés
    const sx = a.x + Math.cos(ang) * 22, sz = a.z + Math.sin(ang) * 22;
    const S = W.frame(P, sx, sz, Math.atan2(Math.cos(ang), Math.sin(ang)), W.SEA_Y - 1.4);
    const deck = 5.4;
    S.box(0, 0, 0, 7, deck - 0.6, 24, 0x7b2f2a, 'metal', 2);
    S.box(0, deck - 0.6, 0, 7.1, 0.6, 24.1, 0x22313f, 'metal', 2);
    S.part(new THREE.CylinderGeometry(1, 1, 1, 3), 0x7b2f2a, 0, deck / 2, 12, 'metal', 4.04, deck, 6);
    W.addCollider({ type: 'b', x: S.wx(0, 13.5), z: S.wz(0, 13.5), hx: 2, hz: 1.6, rot: S.rot, y0: S.base, y1: S.base + deck, walkable: true });
    S.box(0, deck, -7, 6, 3.4, 6, 0xf1efe8, 'plaster', 2);
    S.box(0, deck + 3.4, -7.5, 4.4, 2.2, 4, 0xf1efe8, 'plaster', 1);
    S.box(0, deck + 4.2, -5.45, 4.2, 0.7, 0.1, 0x22313f, 'glass');
    S.part(new THREE.CylinderGeometry(0.8, 0.9, 3, 12), 0xd84f2a, 0, deck + 7, -8.5, 'metal');
    S.box(-3.4, deck, 4, 0.08, 1, 14, 0x3a3f44, 'metal', 1); S.box(3.4, deck, 4, 0.08, 1, 14, 0x3a3f44, 'metal', 1);
    S.loot(0, 3, deck); S.loot(1.5, -3, deck);
    // escada na popa
    const top = S.base + deck;
    for (let i = 0; i < 18; i++) {
      const lz = -13.2 - i * 0.55, x = S.wx(-1.2, lz), z = S.wz(-1.2, lz);
      const g = W.height(x, z), h = top - (i + 1) * 0.33;
      if (h < g - 0.2) break;
      W.box(P, x, z, 1.6, h - g + 0.5, 0.56, S.rot, 0x6d7378, g - 0.5, null, 'metal');
    }
    W.occupied.push([sx, sz, 15], [a.x, a.z, a.r]);
  };

  W.buildMillVillage = function (P) {
    const a = W.A['VILA DO MOINHO'], base = a.h - 0.05;
    const mx = a.x + 4, mz = a.z + 6, rot = face(mx, mz, 0, 0);
    const F = W.frame(P, mx, mz, rot, base);
    F.part(new THREE.CylinderGeometry(1.7, 2.6, 12, 8), 0xf3efe6, 0, 6, 0, 'plaster');
    F.part(new THREE.ConeGeometry(2.1, 2.6, 8), 0x8b3a2a, 0, 13.3, 0, 'roof');
    F.box(0, 0, 2.5, 1.2, 2.2, 0.3, 0x6b4a2a, 'wood');
    F.post(0, 0, 2.6, 0, 14);
    W.spinner(F.wx(0, 2.2), base + 11.6, F.wz(0, 2.2), rot, 6.5);
    W.occupied.push([mx, mz, 6]);
    W.shed(P, a.x - 14, a.z - 6, 0.5, base, 5, 6.5, 5, 0xb8322a, 0x5b5f63, 'wood', 'metal');
    W.placeHouses(P, a, [[12, -10, -2.4], [-2, -16, -0.2], [16, 6, -1.6], [-16, 12, 1.2]], 'colorida');
    for (let i = 0; i < 6; i++) {
      const x = a.x - 4 + (i % 3) * 2.8, z = a.z + 14 + Math.floor(i / 3) * 3.2;
      P.push(U.part(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 14).rotateZ(Math.PI / 2), 0xe2c25a, U.mat4(x, base + 0.85, z, 0, i * 0.4, 0), null, 'plain'));
      W.addCollider({ type: 'c', x: x, z: z, r: 0.9, y0: base, y1: base + 1.7 });
    }
  };

  W.buildRiceFields = function (P) {
    const a = W.A.ARROZAIS, base = a.h - 0.05;
    // palafitas de madeira em volta dos canteiros
    const huts = [[-14, -8, 0.3], [12, -14, -0.8], [16, 10, 2.2], [-10, 16, 1.0], [0, -2, 0.5]];
    huts.forEach((h, i) => W.house(P, a.x + h[0], a.z + h[1], h[2], base + 0.3, i, 'pescador', [2.8, 2.4]));
    // caixa d'água de madeira e espantalhos
    const F = W.frame(P, a.x + 24, a.z - 2, 0, base);
    for (const p of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) F.box(p[0], 0, p[1], 0.25, 7, 0.25, 0x6b4a2a, 'wood', 1);
    F.part(new THREE.CylinderGeometry(2, 2, 2.6, 14), 0x8a5a33, 0, 8.3, 0, 'wood');
    F.part(new THREE.ConeGeometry(2.2, 1.2, 14), 0x6b4a2a, 0, 10.2, 0, 'roof');
    W.occupied.push([a.x + 24, a.z - 2, 3.5]);
    for (const p of [[-22, 4], [6, 22], [22, -18]]) {
      const x = a.x + p[0], z = a.z + p[1], y = W.height(x, z);
      P.push(U.part(BOX, 0x6b4a2a, U.mat4(x, y + 1, z, 0, 0, 0, 0.12, 2, 0.12), null, 'wood'));
      P.push(U.part(BOX, 0x6b4a2a, U.mat4(x, y + 1.5, z, 0, 0.6, 0, 1.4, 0.1, 0.1), null, 'wood'));
      P.push(U.part(new THREE.ConeGeometry(0.45, 0.35, 10), 0xd9b45a, U.mat4(x, y + 2.15, z), null, 'fabric'));
    }
  };

  W.buildSettlement = function (P) {
    const a = W.A.POVOADO;
    W.placeHouses(P, a, [[-14, -10, 0.2], [0, -14, 0.1], [14, -8, -0.3], [-12, 8, Math.PI + 0.2], [3, 11, Math.PI], [16, 8, Math.PI - 0.2]], 'tropical');
  };

  // ---------- definição dos mapas ----------
  W.MAPS.ilha = {
    name: 'Ilha Tropical', desc: 'Vilas, porto, fazenda, farol e ruínas', color: '#2fb3a8',
    landR: 172, playR: 196, show: 'FAROL', trees: 240,
    areas: [
      { name: 'VILA CENTRAL', x: 0, z: 0, r: 30, flat: true, palms: true },
      { name: 'BAIRRO TROPICAL', x: -45, z: -110, r: 36, flat: true, palms: true },
      { name: 'RUÍNAS', x: 95, z: -60, r: 30, flat: true, ruins: true },
      { name: 'FAZENDA', x: 75, z: 95, r: 34, flat: true, fields: [10, 8, 22] },
      { name: 'PORTO', x: -135, z: 45, r: 30, flat: true, sandy: 0.85 },
      { name: 'VILA PESQUEIRA', x: 146, z: 2, r: 24, flat: true, sandy: 0.85, palms: true },
      { name: 'FAROL', x: 22, z: -158, r: 16, flat: true, lift: 6 },
      { name: 'FLORESTA', x: -95, z: -30, r: 40, forest: true },
      { name: 'LAGOA', x: -30, z: 75, r: 20, lake: true },
      { name: 'CAMPO', x: -85, z: 122, r: 30, hills: 7 },
    ],
    paths: [
      [[0, 0], [-15, -45], [-45, -110]],
      [[0, 0], [45, -25], [95, -60]],
      [[0, 0], [35, 50], [75, 95]],
      [[0, 0], [-60, 15], [-135, 45]],
      [[0, 0], [-12, 45], [-30, 75], [-60, 100], [-85, 122]],
      [[95, -60], [125, -30], [146, 2]],
      [[95, -60], [60, -120], [22, -158]],
      [[-45, -110], [-10, -140], [22, -158]],
      [[75, 95], [120, 55], [146, 2]],
      [[-135, 45], [-115, 95], [-85, 122]],
      [[-135, 45], [-120, -20], [-95, -30], [-45, -110]],
    ],
    build: [
      ['Vilas', (P) => { W.buildVillages(P); W.buildCentral(P); W.buildFishing(P); }],
      ['Porto e fazenda', (P, rnd) => { W.buildPort(P, rnd); W.buildFarm(P); W.buildLighthouse(P); W.buildRuins(P); }],
    ],
  };

  W.MAPS.triangulo = {
    name: 'Ilha Triângulo', desc: 'Torre do relógio, pico, fábrica, hangar e usina', color: '#e2a23a',
    landR: 170, playR: 194, tri: 0.22, triRot: Math.PI / 2, show: 'TORRE DO RELÓGIO', trees: 230,
    areas: [
      { name: 'TORRE DO RELÓGIO', x: 0, z: 10, r: 32, flat: true },
      { name: 'PICO', x: -62, z: -68, r: 16, flat: true, peak: 22 },
      { name: 'FÁBRICA', x: 118, z: -62, r: 30, flat: true },
      { name: 'HANGAR', x: -20, z: 124, r: 36, flat: true, runway: [0, 56, 6.5, 0, -8] },
      { name: 'USINA', x: -128, z: -5, r: 28, flat: true, lift: 1.2 },
      { name: 'ESTALEIRO', x: 98, z: 60, r: 24, flat: true, sandy: 0.8 },
      { name: 'VILA DO MOINHO', x: 68, z: 120, r: 24, flat: true },
      { name: 'ARROZAIS', x: -100, z: -112, r: 30, flat: true, rice: true },
      { name: 'POVOADO', x: 58, z: -118, r: 24, flat: true, palms: true },
      { name: 'LAGO', x: -55, z: 48, r: 17, lake: true },
      { name: 'MATA', x: 42, z: 58, r: 30, forest: true },
      { name: 'CAMPO ALTO', x: -155, z: -72, r: 30, hills: 9 },
    ],
    paths: [
      [[0, 10], [-30, -30], [-62, -68]],
      [[0, 10], [55, -20], [118, -62]],
      [[0, 10], [-8, 70], [-20, 116]],
      [[0, 10], [-70, 5], [-128, -5]],
      [[0, 10], [50, 30], [98, 60]],
      [[0, 10], [25, -55], [58, -118]],
      [[-62, -68], [-100, -112]],
      [[-100, -112], [-20, -125], [58, -118]],
      [[58, -118], [118, -62]],
      [[118, -62], [98, 60]],
      [[98, 60], [68, 120], [-20, 116]],
      [[-20, 116], [-85, 70], [-128, -5]],
      [[-128, -5], [-150, -60], [-100, -112]],
    ],
    build: [
      ['Torre do relógio', (P) => { W.buildClockTown(P); W.buildPeak(P); }],
      ['Fábrica e hangar', (P) => { W.buildFactory(P); W.buildHangar(P); }],
      ['Usina e estaleiro', (P, rnd) => { W.buildPowerPlant(P); W.buildShipyard(P, rnd); }],
      ['Vilas', (P) => { W.buildMillVillage(P); W.buildRiceFields(P); W.buildSettlement(P); }],
    ],
  };
  // ---------- arena do Contra Squad: ilha pequena, duas bases e o centro disputado ----------
  W.buildArena = function (P, rnd) {
    const A = W.A, C = A['PRAÇA'], base = C.h - 0.05;
    // centro: prédio de 2 andares com terraço, contêineres e blocos de concreto em volta
    W.building(P, C.x, C.z + 2, 0, base, 5, 4.4, 2, 0xd9cfbf, 0x8a5a33);
    const cols = [0xc0392b, 0x2e6fb5, 0x3fa36b, 0xe67e22, 0xe8c11c];
    const F = W.frame(P, C.x, C.z, 0, base);
    for (const c of [[-13, -11, 0.2], [13, 11, 0.2], [-13, 13, -0.3], [13, -13, -0.3]]) F.box(c[0], 0, c[1], 6.1, 2.6, 2.45, cols[(c[0] > 0 ? 1 : 0) + (c[1] > 0 ? 2 : 0)], 'metal', 2, c[2]);
    F.box(-13, 2.6, -11, 6.1, 2.6, 2.45, 0x7d3c98, 'metal', 2, 0.2);
    for (const b of [[-8, -16], [8, 17], [-18, 2], [18, -2], [0, -15], [0, 16]]) F.box(b[0], 0, b[1], 2.4, 1.25, 0.8, 0xb9b2a5, 'stone', 2, b[0] ? 0 : Math.PI / 2);
    W.occupied.push([C.x, C.z, C.r]);
    // norte: mercado com casas e barracas
    const M = A.MERCADO, mb = M.h - 0.05;
    W.placeHouses(P, M, [[-12, 6, Math.PI], [0, 8, Math.PI], [12, 6, Math.PI]], 'colorida');
    const FM = W.frame(P, M.x, M.z, 0, mb), tents = [0xd84f2a, 0x2f7d8f, 0xe8c11c];
    for (let i = 0; i < 3; i++) {
      const x = -8 + i * 8;
      FM.box(x, 0, -4, 2.6, 0.9, 1.2, 0x8a5a33, 'wood', 2);
      for (const sx of [-1.2, 1.2]) FM.box(x + sx, 0, -4.5, 0.1, 2.3, 0.1, 0x6b4a2a, 'wood');
      FM.box(x, 2.25, -4.2, 3, 0.08, 2, tents[i], 'fabric');
    }
    W.occupied.push([M.x, M.z, M.r]);
    // sul: galpão aberto e caixas
    const S = A['GALPÃO'], sb = S.h - 0.05;
    W.shed(P, S.x, S.z - 2, 0, sb, 7, 6, 5, 0x9aa4ab, 0x5b6268, 'metal', 'metal');
    for (let i = 0; i < 6; i++) W.box(P, S.x - 10 + (i % 3) * 1.5 + (i > 2 ? 17 : 0), S.z + 6 + (i % 2), 1.3, 1.3, 1.3, i * 0.3, 0xa86f3c, sb, null, 'wood');
    W.occupied.push([S.x, S.z, S.r]);
    // bases: sacos de areia em meia-lua virados para o centro, bandeira do time e um barraco
    for (const [name, col, dir] of [['BASE AZUL', 0x2f7bff, 1], ['BASE VERMELHA', 0xff3b3b, -1]]) {
      const B = A[name], bb = B.h - 0.05, FB = W.frame(P, B.x, B.z, dir > 0 ? Math.PI / 2 : -Math.PI / 2, bb);
      for (let i = -3; i <= 3; i++) { if (i === 0) continue; const an = i * 0.32; FB.box(Math.sin(an) * 9, 0, Math.cos(an) * 9, 2.2, 1.15, 0.9, 0xb59f74, 'fabric', 2, an); }
      FB.box(0, 0, -6, 0.14, 7, 0.14, 0xd9dde0, 'metal');
      FB.box(0.95, 5.6, -6, 1.8, 1.1, 0.05, col, 'fabric');
      FB.box(0, -0.2, 0, 10, 0.25, 12, 0x8f9296, 'stone', 2);
      W.house(P, FB.wx(-6, -6), FB.wz(-6, -6), FB.rot + Math.PI, bb, dir > 0 ? 0 : 3, 'pescador', [2.6, 2.2]);
      W.occupied.push([B.x, B.z, B.r]);
    }
    // corredores laterais: contêineres e muros baixos entre as bases e o centro
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      W.box(P, sx * 31, sz * 15, 6.1, 2.6, 2.45, sz * 0.4, cols[(sx + 1) + (sz > 0 ? 1 : 0)], null, { walkable: true }, 'metal');
      W.box(P, sx * 40, sz * 26, 4, 1.2, 0.8, sx * 0.6, 0xb9b2a5, null, null, 'stone');
    }
  };

  W.MAPS.arena = {
    name: 'Arena', desc: 'Contra Squad: duas bases, centro com prédio, mercado e galpão', color: '#ff5a3c', cs: true,
    landR: 82, playR: 96, show: 'BASE AZUL', trees: 45, rocks: 6, crates: 18,
    areas: [
      { name: 'PRAÇA', x: 0, z: 0, r: 20, flat: true },
      { name: 'BASE AZUL', x: -56, z: 0, r: 13, flat: true },
      { name: 'BASE VERMELHA', x: 56, z: 0, r: 13, flat: true },
      { name: 'MERCADO', x: 0, z: 38, r: 14, flat: true },
      { name: 'GALPÃO', x: 0, z: -38, r: 14, flat: true },
    ],
    paths: [
      [[-56, 0], [-25, 0], [0, 0], [25, 0], [56, 0]],
      [[0, 0], [0, 38]], [[0, 0], [0, -38]],
      [[-56, 0], [-35, 28], [0, 38], [35, 28], [56, 0]],
      [[-56, 0], [-35, -28], [0, -38], [35, -28], [56, 0]],
    ],
    build: [['Arena', (P, rnd) => W.buildArena(P, rnd)]],
  };
  // ---------- Metrópole: ilha gigante com centro da torre do relógio e quatro distritos de prédios ----------
  // modelos do kit de cidade (Kenney, CC0): guardados por tipo e desenhados com instâncias (pouco custo)
  W.cityPut = function (name, x, y, z, rot, sc, coll) {
    const g = WPN.city && WPN.city[name]; if (!g) return;
    const bb = g.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(rot)).multiply(new THREE.Matrix4().makeScale(sc, sc, sc)).multiply(new THREE.Matrix4().makeTranslation(-cx, -bb.min.y, -cz));
    (W.cityList[name] = W.cityList[name] || []).push(m);
    if (coll) W.addCollider({ type: 'b', x: x, z: z, hx: (bb.max.x - bb.min.x) * sc / 2 * 0.96, hz: (bb.max.z - bb.min.z) * sc / 2 * 0.96, rot: rot, y0: y - 0.3, y1: y + (bb.max.y - bb.min.y) * sc, walkable: false });
  };
  W.flushCity = function (R) {
    const mat = W.cityMat || (W.cityMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 }));
    for (const k in W.cityList) {
      const L = W.cityList[k], im = new THREE.InstancedMesh(WPN.city[k], mat, L.length);
      L.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = !/^road|^pavement$|^grass$/.test(k); im.receiveShadow = true;
      im.computeBoundingSphere(); R.add(im);
    }
    W.cityList = {};
  };
  // distrito de cidade: grade de 9 x 9 quadras de 9 m; ruas a cada 4 quadras, quarteirões de 3 x 3 entre elas
  W.buildDowntown = function (P, name, rnd) {
    const a = W.A[name], base = a.h - 0.05, T = 9, y = base + 0.03;
    if (!WPN.city) return;
    const blds = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-small-b', 'building-garage'];
    const cols = [0xd9cfbf, 0xc9b79c, 0xb8c4cc, 0xe0d6c2], trims = [0x8a5a33, 0x5b6268, 0x3f4a57];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const x = a.x + (i - 4) * T, z = a.z + (j - 4) * T, ri = i % 4 === 0, rj = j % 4 === 0;
      if (ri && rj) { W.cityPut('road-intersection', x, y, z, 0, T); continue; }
      if (ri || rj) { W.cityPut((ri ? j : i) % 2 ? 'road-straight-lightposts' : 'road-straight', x, y, z, ri ? 0 : Math.PI / 2, T); continue; }
      // dentro do quarteirão
      const bi = i % 4, bj = j % 4, centre = bi === 2 && bj === 2;
      if (centre) {
        const k = Math.floor(i / 4) + Math.floor(j / 4) * 2;
        if (k === 0 || k === 3) W.building(P, x, z, Math.floor(rnd() * 4) * Math.PI / 2, base, 4.2, 4.2, 2 + Math.floor(rnd() * 3), cols[Math.floor(rnd() * cols.length)], trims[Math.floor(rnd() * trims.length)]);
        else { W.cityPut('pavement', x, y, z, 0, T); W.cityPut(k === 1 ? 'pavement-fountain' : 'grass-trees-tall', x, y, z, 0, T, k === 1); }
        continue;
      }
      // casas e prédios virados para a rua mais perto; às vezes um jardim
      if (rnd() < 0.18) { W.cityPut(rnd() < 0.5 ? 'grass-trees' : 'grass', x, y, z, 0, T); continue; }
      const face = bi === 1 ? -Math.PI / 2 : bi === 3 ? Math.PI / 2 : bj === 1 ? Math.PI : 0;
      W.cityPut(blds[Math.floor(rnd() * blds.length)], x, y, z, face, T * 0.98, true);
    }
    W.occupied.push([a.x, a.z, a.r]);
  };
  // cidade montada no editor Godot (godot_mapas/cenas/Cidade.tscn): cada peça vira um modelo do kit, os marcadores viram prédios de entrar
  W.buildGodotCity = function (P, rnd) {
    const a = W.A.CIDADE, M = WPN.cityMap;
    if (!a || !M || !WPN.city) return;
    const T = M.quadra || 9, base = a.h - 0.05, y = base + 0.03;
    const cols = [0xd9cfbf, 0xc9b79c, 0xb8c4cc, 0xe0d6c2], trims = [0x8a5a33, 0x5b6268, 0x3f4a57];
    for (const p of M.pecas) {
      const x = a.x + p.x * T, z = a.z + p.z * T;
      if (p.m === 'predio') { W.building(P, x, z, Math.floor(rnd() * 4) * Math.PI / 2, base, 4.2, 4.2, p.andares || 3, cols[Math.floor(rnd() * cols.length)], trims[Math.floor(rnd() * trims.length)]); continue; }
      const solid = /^building|fountain$/.test(p.m);
      W.cityPut(p.m, x, y, z, p.r || 0, T * (p.s || 1) * (solid ? 0.98 : 1), solid);
    }
    W.occupied.push([a.x, a.z, a.r]);
  };
  W.MAPS.metropole = {
    name: 'Metrópole', desc: 'Ilha gigante: cidade grande em volta da torre do relógio, fábrica, hangar e usina', color: '#7a8cff',
    landR: 250, playR: 272, show: 'TORRE DO RELÓGIO', trees: 360,
    areas: [
      { name: 'TORRE DO RELÓGIO', x: 0, z: 0, r: 32, flat: true },
      { name: 'CIDADE', x: 0, z: 0, r: 80, flat: true, paved: true },
      { name: 'PICO', x: -100, z: -175, r: 16, flat: true, peak: 26 },
      { name: 'FÁBRICA', x: 178, z: -108, r: 30, flat: true },
      { name: 'HANGAR', x: -60, z: 196, r: 36, flat: true, runway: [0, 56, 6.5, 0, -8] },
      { name: 'USINA', x: -205, z: -20, r: 28, flat: true, lift: 1.2 },
      { name: 'ESTALEIRO', x: 196, z: 70, r: 24, flat: true, sandy: 0.8 },
      { name: 'VILA DO MOINHO', x: 100, z: 182, r: 24, flat: true },
      { name: 'ARROZAIS', x: -178, z: -128, r: 30, flat: true, rice: true },
      { name: 'POVOADO', x: 70, z: -196, r: 24, flat: true, palms: true },
      { name: 'LAGO', x: -150, z: 110, r: 20, lake: true },
      { name: 'MATA', x: 150, z: -10, r: 28, forest: true },
      { name: 'BOSQUE', x: -40, z: -150, r: 26, forest: true },
      { name: 'CAMPO ALTO', x: -215, z: 70, r: 28, hills: 9 },
    ],
    paths: [
      [[0, -76], [-50, -130], [-100, -175]], [[27, -76], [40, -150], [70, -196]],
      [[76, -27], [140, -60], [178, -108]], [[76, 27], [150, 40], [196, 70]],
      [[-27, 76], [-30, 150], [-60, 196]], [[27, 76], [60, 140], [100, 182]],
      [[-76, 0], [-150, -10], [-205, -20]], [[-76, -27], [-130, -70], [-178, -128]],
      [[-205, -20], [-215, 70], [-150, 110], [-60, 196]],
      [[70, -196], [178, -108]], [[196, 70], [100, 182]], [[-178, -128], [-100, -175]],
    ],
    build: [
      ['Torre do relógio', (P) => { W.buildClockTown(P); W.buildPeak(P); }],
      ['Cidade (Godot)', (P, rnd) => W.buildGodotCity(P, rnd)],
      ['Fábrica e hangar', (P) => { W.buildFactory(P); W.buildHangar(P); }],
      ['Usina e estaleiro', (P, rnd) => { W.buildPowerPlant(P); W.buildShipyard(P, rnd); }],
      ['Vilas', (P) => { W.buildMillVillage(P); W.buildRiceFields(P); W.buildSettlement(P); W.flushCity(W.root); }],
    ],
  };
  // ---------- Megacidade: mapa inteiro desenhado no Godot (godot_mapas/cenas/Megacidade.tscn) ----------
  // cada peça do JSON: modelo da Kenney, caixa/cilindro com cor e colisão, prédio de entrar ou ponto de loot
  W.buildGodotMap = function (P, rnd, M) {
    if (!M) return;
    const BOXG = new THREE.BoxGeometry(1, 1, 1), cyl = {}, q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const cols = [0xd9cfbf, 0xc9b79c, 0xb8c4cc, 0xe0d6c2], trims = [0x8a5a33, 0x5b6268, 0x3f4a57];
    for (const p of M.pecas) {
      const h = W.height(p.x, p.z) - 0.05;
      if (p.m === 'loot') { W.lootSpots.push([p.x, p.z, h + p.y]); continue; }
      if (p.m === 'predio') { W.building(P, p.x, p.z, p.r || 0, h + p.y, p.lx || 4.2, p.lz || 4.2, p.andares || 2, cols[Math.floor(rnd() * cols.length)], trims[Math.floor(rnd() * trims.length)]); continue; }
      if (p.m === 'caixa' || p.m === 'cilindro') {
        const col = parseInt(String(p.cor || '#aaaaaa').slice(1), 16), y = h + p.y;
        if (p.q) q.set(p.q[0], p.q[1], p.q[2], p.q[3]); else q.setFromAxisAngle(UP3, p.r || 0);
        let geo;
        if (p.m === 'caixa') { geo = BOXG; sc.set(p.sx, p.sy, p.sz); }
        else { const k = p.rt + '|' + p.rb; geo = cyl[k] || (cyl[k] = new THREE.CylinderGeometry(p.rt, p.rb, 1, 18)); sc.set(1, p.h, 1); }
        P.push(U.part(geo, col, new THREE.Matrix4().compose(v.set(p.x, y, p.z), q, sc), 'radial', p.mat || 'plain'));
        if (p.solido) {
          const flatRot = Math.abs(q.x) < 0.02 && Math.abs(q.z) < 0.02;
          if (p.m === 'caixa' && flatRot) W.addCollider({ type: 'b', x: p.x, z: p.z, hx: p.sx / 2, hz: p.sz / 2, rot: p.r || 0, y0: y - p.sy / 2, y1: y + p.sy / 2, walkable: !!p.piso || p.sy < 1.4 });
          else if (p.m === 'cilindro' && flatRot) W.addCollider({ type: 'c', x: p.x, z: p.z, r: Math.max(p.rt, p.rb), y0: y - p.h / 2, y1: y + p.h / 2 });
        }
        continue;
      }
      const solid = /^building|fountain$/.test(p.m);
      W.cityPut(p.m, p.x, h + p.y + 0.03, p.z, p.r || 0, (p.s || 9) * (solid ? 0.98 : 1), solid);
    }
    for (const a of W.areaDefs) if (a.flat) W.occupied.push([a.x, a.z, a.r]);
  };
  const UP3 = new THREE.Vector3(0, 1, 0);
  W.MAPS.megacidade = {
    name: 'Megacidade', desc: 'Mapa novo feito no Godot: centro com torre do relógio, bairro, zona industrial, porto com navio e base militar', color: '#ff7a3c',
    landR: 212, playR: 234, show: 'CENTRO', trees: 300,
    areas: [
      { name: 'CENTRO', x: 0, z: 0, r: 86, flat: true, paved: true },
      { name: 'BAIRRO RESIDENCIAL', x: 0, z: -150, r: 46, flat: true, paved: true },
      { name: 'ZONA INDUSTRIAL', x: 155, z: 5, r: 58, flat: true, paved: true },
      { name: 'PORTO', x: 5, z: 160, r: 44, flat: true, sandy: 0.7, paved: true },
      { name: 'BASE MILITAR', x: -155, z: 0, r: 46, flat: true, paved: true },
      { name: 'FLORESTA', x: 110, z: -112, r: 36, forest: true },
      { name: 'LAGO', x: -112, z: 112, r: 20, lake: true },
      { name: 'MORRO', x: 118, z: 116, r: 32, hills: 10 },
      { name: 'CAMPO', x: -112, z: -112, r: 32, hills: 6 },
    ],
    paths: [
      [[0, -86], [0, -150]], [[86, 0], [155, 5]], [[0, 86], [5, 160]], [[-86, 0], [-155, 0]],
      [[0, -150], [110, -112], [155, 5]], [[155, 5], [118, 116], [5, 160]], [[5, 160], [-112, 112], [-155, 0]], [[-155, 0], [-112, -112], [0, -150]],
    ],
    build: [
      ['Megacidade (Godot)', (P, rnd) => { W.buildGodotMap(P, rnd, WPN.megaMap); W.flushCity(W.root); }],
    ],
  };
  W.MAP_LIST = ['megacidade', 'metropole', 'ilha', 'triangulo'];
})();
