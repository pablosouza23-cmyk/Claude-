'use strict';
// Personagem toon: capuz vermelho, jaqueta com listras brancas, calça larga azul-marinho,
// tênis brancos, mochila, arma nas mãos e outra presa nas costas.
// Cada osso é UMA malha mesclada (cores por vértice) + UMA casca de contorno, para aguentar 25 jogadores no celular.
const CH = {};

CH.PLAYER_PAL = { hood: 0xd81f26, jacket: 0xd5232b, stripe: 0xffffff, pants: 0x1c2550, shoe: 0xf4f4f4, skin: 0xe0a77c, pack: 0x3b4a3a, packTrim: 0x34d17a };

CH.BOT_PALS = [
  { hood: 0x2f6fd6, jacket: 0x2a5fb8, stripe: 0xffffff, pants: 0x2b2b2b, shoe: 0xffffff, skin: 0xc68b5e, pack: 0x5a4632, packTrim: 0xf2c94c },
  { hood: 0x2e8b3e, jacket: 0x3d9b45, stripe: 0x111111, pants: 0x6b5233, shoe: 0x222222, skin: 0xf0c29a, pack: 0x333333, packTrim: 0xff7a1a },
  { hood: 0x7d3cc4, jacket: 0x8b4fd3, stripe: 0xffe14d, pants: 0x1b1b1b, shoe: 0xfff3c4, skin: 0x8a5a3c, pack: 0x2d3a5a, packTrim: 0xffe14d },
  { hood: 0xf2f2f2, jacket: 0xefefef, stripe: 0x111111, pants: 0x3a4f8a, shoe: 0x111111, skin: 0xe8b48a, pack: 0x7a2a2a, packTrim: 0xffffff },
  { hood: 0xff8a1c, jacket: 0xf07a12, stripe: 0x1a1a1a, pants: 0x2f3b2f, shoe: 0xffffff, skin: 0xd99a6c, pack: 0x1f1f1f, packTrim: 0xff8a1c },
  { hood: 0x111111, jacket: 0x1f1f1f, stripe: 0xff2e63, pants: 0x4a4a4a, shoe: 0xff2e63, skin: 0xb57a52, pack: 0x404040, packTrim: 0xff2e63 },
  { hood: 0xe8c11c, jacket: 0xd9a514, stripe: 0x1d1d1d, pants: 0x24304d, shoe: 0xffffff, skin: 0xe2ae86, pack: 0x2f2f2f, packTrim: 0x39e0ff },
  { hood: 0x15a3a3, jacket: 0x138f8f, stripe: 0xffffff, pants: 0x3b2a1f, shoe: 0xf2f2f2, skin: 0x9c6644, pack: 0x553a22, packTrim: 0xffd23c },
];

CH.cache = {};
CH.OL = 0.022;

// ---------- armas (geometria compartilhada por tipo) ----------
CH.GUN_LEN = { UMP: 0.38, M4A1: 0.48, MP40: 0.42, M1014: 0.52, Woodpecker: 0.62, Pistola: 0.16 };
CH.gunPair = function (id) {
  const k = 'gun_' + id;
  if (CH.cache[k]) return CH.cache[k];
  const P = [], B = (w, h, d, c, x, y, z, rx) => P.push(U.part(new THREE.BoxGeometry(w, h, d), c, U.mat4(x, y, z, rx || 0), 'radial'));
  const C = (r, l, c, x, y, z) => P.push(U.part(new THREE.CylinderGeometry(r, r, l, 7).rotateX(Math.PI / 2), c, U.mat4(x, y, z)));
  const black = 0x1d1d1d;
  if (id === 'UMP') {
    B(0.085, 0.13, 0.42, 0xf4b21b, 0, 0, 0); B(0.06, 0.2, 0.08, black, 0, -0.14, 0.06, 0.25);
    B(0.06, 0.12, 0.2, 0xf4b21b, 0, -0.02, -0.28); C(0.022, 0.16, black, 0, 0.02, 0.29); B(0.04, 0.05, 0.1, black, 0, 0.09, 0.02);
  } else if (id === 'M4A1') {
    B(0.08, 0.12, 0.5, 0xd92b2b, 0, 0, 0); B(0.055, 0.2, 0.08, black, 0, -0.14, 0.08, 0.35);
    B(0.06, 0.13, 0.22, 0xb81f1f, 0, -0.03, -0.33); C(0.02, 0.22, black, 0, 0.02, 0.35);
    C(0.035, 0.18, black, 0, 0.11, 0.0); B(0.05, 0.08, 0.06, 0xb81f1f, 0, -0.08, -0.08);
  } else if (id === 'MP40') {
    B(0.07, 0.1, 0.44, 0x3d3d3d, 0, 0, 0); B(0.045, 0.28, 0.05, black, 0, -0.18, 0.08);
    B(0.04, 0.05, 0.24, 0x8a6a2a, 0, -0.02, -0.3); C(0.02, 0.14, black, 0, 0.01, 0.29);
  } else if (id === 'M1014') {
    B(0.08, 0.11, 0.34, 0x4a4a4a, 0, 0, 0.02); C(0.03, 0.42, 0x2a2a2a, 0, 0.03, 0.34); C(0.025, 0.36, 0x6b4a2a, 0, -0.03, 0.3);
    B(0.07, 0.15, 0.3, 0x7a5230, 0, -0.04, -0.3);
  } else if (id === 'Woodpecker') {
    B(0.07, 0.1, 0.6, 0x5f7048, 0, 0, 0.02); C(0.022, 0.32, black, 0, 0.02, 0.45); C(0.04, 0.26, black, 0, 0.11, 0.02);
    B(0.06, 0.15, 0.28, 0x6b4a2a, 0, -0.04, -0.38); B(0.05, 0.12, 0.07, black, 0, -0.11, 0.08);
  } else if (id === 'Pistola') {
    B(0.05, 0.08, 0.22, 0x2e2e2e, 0, 0, 0.03); B(0.045, 0.14, 0.07, 0x1a1a1a, 0, -0.09, -0.04, -0.25);
  }
  return (CH.cache[k] = U.build(P));
};

CH.sleeveParts = function (pal, P, side, len, rTop, rBot, y0) {
  P.push(U.part(new THREE.CylinderGeometry(rTop, rBot, len, 10), pal.jacket, U.mat4(0, y0 - len / 2, 0)));
  // três listras brancas ao longo da manga, do lado de fora
  for (let i = -1; i <= 1; i++)
    P.push(U.part(new THREE.BoxGeometry(0.012, len * 0.96, 0.016), pal.stripe, U.mat4(side * (rTop - 0.004), y0 - len / 2, i * 0.026), 'radial'));
};

CH.boneParts = function (pal) {
  const key = JSON.stringify(pal);
  if (CH.cache[key]) return CH.cache[key];
  const S = (r, c, x, y, z, sx, sy, sz, ws, hs) => U.part(new THREE.SphereGeometry(r, ws || 12, hs || 8), c, U.mat4(x, y, z, 0, 0, 0, sx || 1, sy || sx || 1, sz || sx || 1), 'radial');
  const Cy = (rt, rb, h, c, x, y, z, sx, sz) => U.part(new THREE.CylinderGeometry(rt, rb, h, 10), c, U.mat4(x, y, z, 0, 0, 0, sx || 1, 1, sz || 1));
  const Bx = (w, h, d, c, x, y, z) => U.part(new THREE.BoxGeometry(w, h, d), c, U.mat4(x, y, z), 'radial');
  const out = {};
  out.pelvis = U.build([S(0.2, pal.pants, 0, 0, 0, 1.0, 0.65, 0.72)]);
  out.thigh = U.build([Cy(0.11, 0.1, 0.48, pal.pants, 0, -0.24, 0), Bx(0.008, 0.44, 0.01, 0xd9dce8, 0, -0.24, -0.103)]);
  out.shin = U.build([Cy(0.1, 0.12, 0.44, pal.pants, 0, -0.22, 0), Bx(0.008, 0.4, 0.01, 0xd9dce8, 0, -0.22, -0.11),
    S(0.1, pal.shoe, 0, -0.45, 0.05, 0.95, 0.62, 1.55), Bx(0.17, 0.03, 0.3, 0xbfbfbf, 0, -0.505, 0.05)]);
  const hood = new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.78);
  out.torso = U.build([
    Cy(0.2, 0.18, 0.52, pal.jacket, 0, 0.27, 0, 1.18, 0.78),
    S(0.2, pal.jacket, 0, 0.5, 0, 1.28, 0.5, 0.82),
    Cy(0.205, 0.195, 0.05, pal.stripe, 0, 0.32, 0, 1.19, 0.79),
    Cy(0.205, 0.195, 0.03, pal.stripe, 0, 0.4, 0, 1.19, 0.79),
    Bx(0.32, 0.38, 0.17, pal.pack, 0, 0.3, -0.21),
    Bx(0.2, 0.08, 0.04, pal.packTrim, 0, 0.22, -0.305),
    Bx(0.04, 0.3, 0.03, 0x222222, 0.12, 0.33, 0.13), Bx(0.04, 0.3, 0.03, 0x222222, -0.12, 0.33, 0.13),
  ]);
  out.head = U.build([
    S(0.125, pal.skin, 0, 0.13, 0.035),
    U.part(hood, pal.hood, new THREE.Matrix4().compose(new THREE.Vector3(0, 0.15, -0.025), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0, 0)), new THREE.Vector3(1, 1.08, 1.05)), 'radial'),
    S(0.14, pal.hood, 0, 0.05, -0.09, 1.15, 0.6, 0.8),
  ]);
  const arm = (side) => {
    const up = [], fo = [];
    CH.sleeveParts(pal, up, side, 0.3, 0.075, 0.068, 0);
    CH.sleeveParts(pal, fo, side, 0.27, 0.066, 0.06, 0);
    fo.push(S(0.055, pal.skin, 0, -0.29, 0, 1, 1, 1, 8, 6));
    return { up: U.build(up), fo: U.build(fo) };
  };
  out.armL = arm(1); out.armR = arm(-1);
  return (CH.cache[key] = out);
};

CH.boardPair = function () {
  if (CH.cache.board) return CH.cache.board;
  CH.cache.board = U.build([
    U.part(new THREE.SphereGeometry(1, 16, 8), 0x39e0ff, U.mat4(0, 0, 0, 0, 0, 0, 0.3, 0.045, 1.05), 'radial'),
    U.part(new THREE.SphereGeometry(1, 16, 8), 0xff5fb8, U.mat4(0, -0.035, 0.05, 0, 0, 0, 0.26, 0.03, 0.9), 'radial'),
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
  const B = CH.boneParts(pal);
  const mat = U.toon({ vertexColors: true });
  const olm = U.outlineMat(CH.OL);
  const outlines = [], meshes = [];
  const add = (parent, pair, x, y, z) => {
    const m = new THREE.Mesh(pair.g, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    parent.add(m);
    const o = new THREE.Mesh(pair.o, olm);
    o.userData.isOutline = true;
    m.add(o);
    outlines.push(o); meshes.push(m);
    return m;
  };
  const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new THREE.Group();
  const body = grp(root, 0, 0, 0);
  const hips = grp(body, 0, 0.95, 0);
  add(hips, B.pelvis);
  const leg = (side) => {
    const hip = grp(hips, side * 0.1, -0.04, 0);
    add(hip, B.thigh);
    const knee = grp(hip, 0, -0.46, 0);
    add(knee, B.shin);
    return { hip: hip, knee: knee };
  };
  const L = leg(1), R = leg(-1);
  const torso = grp(hips, 0, 0.06, 0);
  add(torso, B.torso);
  const neck = grp(torso, 0, 0.58, 0);
  add(neck, B.head);
  const arm = (side, pair) => {
    const sh = grp(torso, side * 0.25, 0.47, 0);
    add(sh, pair.up);
    const el = grp(sh, 0, -0.29, 0);
    add(el, pair.fo);
    return { sh: sh, el: el };
  };
  const AL = arm(1, B.armL), AR = arm(-1, B.armR);

  // arma na mão e arma guardada nas costas (geometria trocada conforme o inventário)
  const gun = grp(torso, -0.11, 0.3, 0.3);
  const gunMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); gunMesh.castShadow = true; gun.add(gunMesh);
  const gunOl = new THREE.Mesh(new THREE.BufferGeometry(), olm); gunOl.userData.isOutline = true; gun.add(gunOl);
  outlines.push(gunOl);
  const muzzle = new THREE.Object3D(); gun.add(muzzle);
  const stow = grp(torso, 0, 0.32, -0.32); stow.rotation.set(0, Math.PI / 2, 0.85);
  const stowMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); stow.add(stowMesh);
  const stowOl = new THREE.Mesh(new THREE.BufferGeometry(), olm); stowOl.userData.isOutline = true; stow.add(stowOl);
  outlines.push(stowOl);

  // prancha e paraquedas
  const board = new THREE.Group();
  const bp = CH.boardPair();
  const bm = new THREE.Mesh(bp.g, U.toon({ vertexColors: true, emissive: 0x113344 })); board.add(bm);
  board.add(new THREE.Mesh(bp.o, U.outlineMat(0.03)));
  const trail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.6, depthWrite: false }));
  trail.scale.z = 30; trail.position.set(0, 0, -15.5); trail.rotation.x = 0;
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
    root: root, body: body, hips: hips, torso: torso, neck: neck, L: L, R: R, AL: AL, AR: AR, gun: gun, gunMesh: gunMesh, gunOl: gunOl, muzzle: muzzle,
    stow: stow, stowMesh: stowMesh, stowOl: stowOl, board: board, chute: chute, mat: mat, outlines: outlines, meshes: meshes,
    phase: Math.random() * 6, deadT: -1, flash: 0, punchT: 0, gunId: null, stowId: null,
  };
  CH.pose(ch, 0, 0, 0, 0, 0);
  return ch;
};

CH.setGuns = function (ch, inHand, onBack) {
  if (ch.gunId !== inHand) {
    ch.gunId = inHand;
    if (inHand) {
      const p = CH.gunPair(inHand);
      ch.gunMesh.geometry = p.g; ch.gunOl.geometry = p.o;
      ch.muzzle.position.set(0, 0.02, CH.GUN_LEN[inHand] * 0.9 + 0.05);
    }
    ch.gun.visible = !!inHand;
  }
  if (ch.stowId !== onBack) {
    ch.stowId = onBack;
    if (onBack) { const p = CH.gunPair(onBack); ch.stowMesh.geometry = p.g; ch.stowOl.geometry = p.o; }
    ch.stow.visible = !!onBack;
  }
};

// anima por procedimento. s: {speed, aim, air, pitch, dead, mode:'ground'|'fall'|'chute', crouch, armed}
CH.animate = function (ch, dt, s) {
  if (s.dead) {
    if (ch.deadT < 0) ch.deadT = 0;
    ch.deadT += dt;
    const k = U.smooth(0, 0.45, ch.deadT);
    ch.body.rotation.x = -k * 1.5;
    ch.body.position.y = k * 0.18;
    ch.L.hip.rotation.x = -k * 0.4; ch.R.hip.rotation.x = -k * 0.1;
    ch.AL.sh.rotation.set(-k * 2.6, 0, k * 0.4); ch.AR.sh.rotation.set(-k * 2.4, 0, -k * 0.4);
    ch.board.visible = false; ch.chute.visible = false;
    return;
  }
  ch.deadT = -1; ch.body.rotation.x = 0; ch.body.position.y = 0;
  if (ch.flash > 0) {
    ch.flash -= dt;
    ch.mat.emissive.setHex(ch.flash > 0 ? 0x662222 : 0x000000);
  }
  if (s.mode === 'fall') {
    // de pé na prancha, braços abertos
    ch.board.visible = s.board !== false; ch.chute.visible = false;
    ch.hips.position.y = 0.95 - 0.12; ch.hips.rotation.y = 0;
    ch.L.hip.rotation.x = -0.35; ch.R.hip.rotation.x = 0.25; ch.L.knee.rotation.x = 0.6; ch.R.knee.rotation.x = 0.35;
    ch.L.hip.rotation.z = 0.12; ch.R.hip.rotation.z = -0.12;
    ch.torso.rotation.set(0.25 + Math.sin(ch.phase += dt * 3) * 0.03, 0, 0);
    ch.neck.rotation.x = -0.2;
    ch.AL.sh.rotation.set(0, 0, 1.45); ch.AR.sh.rotation.set(0, 0, -1.45);
    ch.AL.el.rotation.set(0, 0, 0); ch.AR.el.rotation.set(0, 0, 0);
    ch.gun.visible = false;
    return;
  }
  if (s.mode === 'chute') {
    ch.board.visible = false; ch.chute.visible = true;
    ch.hips.position.y = 0.95;
    ch.L.hip.rotation.set(-0.2, 0, 0.05); ch.R.hip.rotation.set(0.1, 0, -0.05);
    ch.L.knee.rotation.x = 0.3; ch.R.knee.rotation.x = 0.15;
    ch.torso.rotation.set(0, 0, 0); ch.neck.rotation.x = 0;
    ch.AL.sh.rotation.set(-2.85, 0, 0.35); ch.AR.sh.rotation.set(-2.85, 0, -0.35);
    ch.AL.el.rotation.set(-0.3, 0, 0); ch.AR.el.rotation.set(-0.3, 0, 0);
    ch.gun.visible = false;
    return;
  }
  ch.board.visible = false; ch.chute.visible = false;
  ch.gun.visible = !!ch.gunId;
  ch.L.hip.rotation.z = 0; ch.R.hip.rotation.z = 0;
  const spd = s.speed || 0, run = U.clamp(spd / 6, 0, 1.2);
  ch.phase += dt * (4 + spd * 1.55) * (run > 0.05 ? 1 : 0);
  if (!isFinite(ch.phase)) ch.phase = 0;
  CH.pose(ch, ch.phase, run, s.aim, s.air, s.pitch, s.crouch, s.armed);
  if (ch.punchT > 0) {
    ch.punchT -= dt;
    const k = Math.sin(U.clamp(1 - ch.punchT / 0.3, 0, 1) * Math.PI);
    ch.AR.sh.rotation.set(-1.5 * k - 0.3, 0, -0.1); ch.AR.el.rotation.set(-0.2, 0, 0);
  }
};

CH.pose = function (ch, p, run, aim, air, pitch, crouch, armed) {
  const A = run;
  const sw = Math.sin(p), cw = Math.cos(p);
  let thL = -sw * 0.75 * A, thR = sw * 0.75 * A;
  let knL = 0.08 + Math.max(0, cw) * 1.1 * A, knR = 0.08 + Math.max(0, -cw) * 1.1 * A;
  let hy = 0.95 - 0.02 * A + Math.abs(Math.sin(p)) * 0.05 * A;
  if (crouch) { thL = -1.1 - sw * 0.25 * A; thR = -0.5 + sw * 0.25 * A; knL = 1.5; knR = 1.6; hy = 0.62; }
  if (air) { thL = -0.7; thR = 0.15; knL = 1.2; knR = 0.5; }
  ch.L.hip.rotation.x = thL; ch.R.hip.rotation.x = thR;
  ch.L.knee.rotation.x = knL; ch.R.knee.rotation.x = knR;
  ch.hips.position.y = hy;
  ch.hips.rotation.y = sw * 0.12 * A;
  ch.torso.rotation.y = -sw * 0.18 * A;
  const lean = 0.18 * A * (1 - aim * 0.7) + (crouch ? 0.25 : 0);
  ch.torso.rotation.x = lean - (pitch || 0) * (0.55 + aim * 0.25);
  ch.neck.rotation.x = -lean * 0.5 - (pitch || 0) * 0.25;
  if (armed === false) {
    // desarmado: braços balançam na corrida
    ch.AR.sh.rotation.set(-sw * 0.8 * A - 0.05, 0, -0.12); ch.AR.el.rotation.set(-0.3 - 0.5 * A, 0, 0);
    ch.AL.sh.rotation.set(sw * 0.8 * A - 0.05, 0, 0.12); ch.AL.el.rotation.set(-0.3 - 0.5 * A, 0, 0);
    return;
  }
  const up = aim;
  ch.AR.sh.rotation.set(U.lerp(-0.75, -1.35, up) + sw * 0.08 * A, 0.25, -0.15);
  ch.AR.el.rotation.set(U.lerp(-0.9, -0.35, up), 0, 0);
  ch.AL.sh.rotation.set(U.lerp(-0.95, -1.4, up) - sw * 0.08 * A, -0.2, -0.55);
  ch.AL.el.rotation.set(U.lerp(-0.85, -0.45, up), 0, 0);
  ch.gun.position.set(-0.11, U.lerp(0.27, 0.42, up), U.lerp(0.3, 0.36, up));
  ch.gun.rotation.set(U.lerp(0.18, 0, up), 0, 0);
};

CH.setOutlinesVisible = function (ch, v) {
  if (ch._olv === v) return;
  ch._olv = v;
  for (const o of ch.outlines) o.visible = v;
};

CH.setShadow = function (ch, v) {
  if (ch._shv === v) return;
  ch._shv = v;
  for (const m of ch.meshes) m.castShadow = v;
  ch.gunMesh.castShadow = v;
};
