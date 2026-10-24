'use strict';
// Personagem toon: capuz vermelho, jaqueta com listras brancas, calça larga azul-marinho,
// tênis brancos, mochila com arma presa nas costas e submetralhadora (UMP) nas mãos.
const CH = {};

CH.PLAYER_PAL = { hood: 0xd81f26, jacket: 0xd5232b, stripe: 0xffffff, pants: 0x1c2550, shoe: 0xf4f4f4, skin: 0xe0a77c, pack: 0x3b4a3a, packTrim: 0x34d17a, gun: 0xf4b21b, gun2: 0xf5c518 };

CH.BOT_PALS = [
  { hood: 0x2f6fd6, jacket: 0x2a5fb8, stripe: 0xffffff, pants: 0x2b2b2b, shoe: 0xffffff, skin: 0xc68b5e, pack: 0x5a4632, packTrim: 0xf2c94c, gun: 0x5b5b5b, gun2: 0x8a8a8a },
  { hood: 0x2e8b3e, jacket: 0x3d9b45, stripe: 0x111111, pants: 0x6b5233, shoe: 0x222222, skin: 0xf0c29a, pack: 0x333333, packTrim: 0xff7a1a, gun: 0x222222, gun2: 0x7a7a7a },
  { hood: 0x7d3cc4, jacket: 0x8b4fd3, stripe: 0xffe14d, pants: 0x1b1b1b, shoe: 0xfff3c4, skin: 0x8a5a3c, pack: 0x2d3a5a, packTrim: 0xffe14d, gun: 0x444444, gun2: 0x999999 },
  { hood: 0xf2f2f2, jacket: 0xefefef, stripe: 0x111111, pants: 0x3a4f8a, shoe: 0x111111, skin: 0xe8b48a, pack: 0x7a2a2a, packTrim: 0xffffff, gun: 0x2b2b2b, gun2: 0x707070 },
  { hood: 0xff8a1c, jacket: 0xf07a12, stripe: 0x1a1a1a, pants: 0x2f3b2f, shoe: 0xffffff, skin: 0xd99a6c, pack: 0x1f1f1f, packTrim: 0xff8a1c, gun: 0x353535, gun2: 0x9a9a9a },
  { hood: 0x111111, jacket: 0x1f1f1f, stripe: 0xff2e63, pants: 0x4a4a4a, shoe: 0xff2e63, skin: 0xb57a52, pack: 0x404040, packTrim: 0xff2e63, gun: 0x5a3e2a, gun2: 0xbbbbbb },
];

CH.geo = {};
CH.g = function (key, fn) { return CH.geo[key] || (CH.geo[key] = fn()); };

CH.sleeveTex = function (base, stripe) {
  return U.canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#' + new THREE.Color(base).getHexString(); g.fillRect(0, 0, w, h);
    g.fillStyle = '#' + new THREE.Color(stripe).getHexString();
    // três listras ao longo da manga
    for (let i = 0; i < 3; i++) g.fillRect(4 + i * 7, 0, 4, h);
  });
};

CH.pantsTex = function (base) {
  return U.canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#' + new THREE.Color(base).getHexString(); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.5; g.setLineDash([4, 3]);
    g.beginPath(); g.moveTo(16, 0); g.lineTo(16, h); g.moveTo(48, 0); g.lineTo(48, h); g.stroke();
  });
};

CH.make = function (pal, isPlayer) {
  const M = {
    hood: U.toon({ color: pal.hood }),
    jacket: U.toon({ color: pal.jacket }),
    sleeve: U.toon({ map: CH.sleeveTex(pal.jacket, pal.stripe) }),
    pants: U.toon({ map: CH.pantsTex(pal.pants) }),
    shoe: U.toon({ color: pal.shoe }),
    skin: U.toon({ color: pal.skin }),
    pack: U.toon({ color: pal.pack }),
    trim: U.toon({ color: pal.packTrim }),
    gun: U.toon({ color: pal.gun }),
    gun2: U.toon({ color: pal.gun2 }),
    black: U.toon({ color: 0x1d1d1d }),
  };
  const all = [];
  const OL = 0.022;
  const mesh = (geo, mat, parent, x, y, z, ol) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    parent.add(m);
    if (ol !== false) all.push(U.addOutline(m, typeof ol === 'number' ? ol : OL));
    return m;
  };

  const root = new THREE.Group();
  const body = new THREE.Group(); // gira para a direção do personagem
  root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);

  const pelvis = mesh(CH.g('pelvis', () => new THREE.SphereGeometry(0.2, 12, 8)), M.pants, hips, 0, 0, 0);
  pelvis.scale.set(1.0, 0.65, 0.72);

  const leg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.1, -0.04, 0); hips.add(hip);
    mesh(CH.g('thigh', () => new THREE.CylinderGeometry(0.11, 0.1, 0.48, 10).translate(0, -0.24, 0)), M.pants, hip);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    mesh(CH.g('shin', () => new THREE.CylinderGeometry(0.1, 0.12, 0.44, 10).translate(0, -0.22, 0)), M.pants, knee);
    const shoe = mesh(CH.g('shoe', () => new THREE.SphereGeometry(0.1, 10, 6)), M.shoe, knee, 0, -0.45, 0.05);
    shoe.scale.set(0.95, 0.62, 1.55);
    return { hip: hip, knee: knee };
  };
  const L = leg(1), R = leg(-1);

  const torso = new THREE.Group(); torso.position.y = 0.06; hips.add(torso);
  const chest = mesh(CH.g('chest', () => new THREE.CylinderGeometry(0.2, 0.18, 0.52, 12).translate(0, 0.27, 0)), M.jacket, torso);
  chest.scale.set(1.18, 1, 0.78);
  const shoulders = mesh(CH.g('shou', () => new THREE.SphereGeometry(0.2, 12, 8)), M.jacket, torso, 0, 0.5, 0);
  shoulders.scale.set(1.28, 0.5, 0.82);
  // listra branca nas costas/peito
  const band = mesh(CH.g('band', () => new THREE.CylinderGeometry(0.205, 0.195, 0.05, 12)), U.toon({ color: pal.stripe }), torso, 0, 0.32, 0, false);
  band.scale.set(1.19, 1, 0.79);

  const neck = new THREE.Group(); neck.position.y = 0.58; torso.add(neck);
  const face = mesh(CH.g('head', () => new THREE.SphereGeometry(0.125, 12, 10)), M.skin, neck, 0, 0.13, 0.035);
  const hood = mesh(CH.g('hood', () => new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.78)), M.hood, neck, 0, 0.15, -0.025);
  hood.scale.set(1.0, 1.08, 1.05);
  hood.rotation.x = -0.55;
  const hoodBack = mesh(CH.g('hoodb', () => new THREE.SphereGeometry(0.14, 10, 8)), M.hood, neck, 0, 0.05, -0.09);
  hoodBack.scale.set(1.15, 0.6, 0.8);

  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.25, 0.47, 0); torso.add(sh);
    mesh(CH.g('upper', () => new THREE.CylinderGeometry(0.075, 0.068, 0.3, 10).translate(0, -0.15, 0)), M.sleeve, sh);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    mesh(CH.g('fore', () => new THREE.CylinderGeometry(0.066, 0.06, 0.27, 10).translate(0, -0.135, 0)), M.sleeve, el);
    mesh(CH.g('hand', () => new THREE.SphereGeometry(0.055, 8, 6)), M.skin, el, 0, -0.29, 0);
    return { sh: sh, el: el };
  };
  const AL = arm(1), AR = arm(-1);

  // mochila + arma presa nas costas (amarela)
  const pack = mesh(CH.g('pack', () => new THREE.BoxGeometry(0.32, 0.38, 0.17)), M.pack, torso, 0, 0.3, -0.21, 0.018);
  mesh(CH.g('packtrim', () => new THREE.BoxGeometry(0.2, 0.08, 0.04)), M.trim, pack, 0, -0.08, -0.095, false);
  const stow = new THREE.Group(); stow.position.set(0, 0.32, -0.32); stow.rotation.z = 0.85; torso.add(stow);
  mesh(CH.g('sbody', () => new THREE.BoxGeometry(0.075, 0.5, 0.09)), M.gun2, stow, 0, 0, 0, 0.012);
  mesh(CH.g('sstock', () => new THREE.BoxGeometry(0.1, 0.14, 0.06)), M.black, stow, 0.02, -0.3, 0, 0.012);
  mesh(CH.g('smag', () => new THREE.BoxGeometry(0.06, 0.14, 0.07)), M.black, stow, 0.08, 0.05, 0, 0.015);

  // arma na mão (UMP): presa ao tronco, apontando para frente (+Z)
  const gun = new THREE.Group(); gun.position.set(-0.13, 0.36, 0.32); torso.add(gun);
  mesh(CH.g('gbody', () => new THREE.BoxGeometry(0.085, 0.13, 0.42)), M.gun, gun, 0, 0, 0, 0.015);
  mesh(CH.g('gmag', () => new THREE.BoxGeometry(0.06, 0.2, 0.08)), M.black, gun, 0, -0.14, 0.06, 0.012).rotation.x = 0.25;
  mesh(CH.g('gstock', () => new THREE.BoxGeometry(0.06, 0.12, 0.2)), M.gun, gun, 0, -0.02, -0.28, 0.012);
  mesh(CH.g('gbar', () => new THREE.CylinderGeometry(0.022, 0.022, 0.16, 6).rotateX(Math.PI / 2)), M.black, gun, 0, 0.02, 0.29, false);
  mesh(CH.g('gsight', () => new THREE.BoxGeometry(0.04, 0.05, 0.1)), M.black, gun, 0, 0.09, 0.02, false);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, 0.38); gun.add(muzzle);

  const ch = {
    root: root, body: body, hips: hips, torso: torso, neck: neck, L: L, R: R, AL: AL, AR: AR, gun: gun, muzzle: muzzle,
    mats: M, outlines: all, phase: Math.random() * 6, deadT: -1, flash: 0,
  };
  CH.pose(ch, 0, 0, 0, false, 0, 0);
  return ch;
};

// anima por procedimento: caminhada/corrida, mira, salto e queda
CH.animate = function (ch, dt, s) {
  // s: {speed (m/s), aim 0..1, air, pitch, dead, crouch}
  if (s.dead) {
    if (ch.deadT < 0) ch.deadT = 0;
    ch.deadT += dt;
    const k = U.smooth(0, 0.45, ch.deadT);
    ch.body.rotation.x = -k * 1.5;
    ch.body.position.y = k * 0.18;
    ch.L.hip.rotation.x = -k * 0.4; ch.R.hip.rotation.x = -k * 0.1;
    ch.AL.sh.rotation.set(-k * 2.6, 0, k * 0.4); ch.AR.sh.rotation.set(-k * 2.4, 0, -k * 0.4);
    return;
  }
  ch.deadT = -1; ch.body.rotation.x = 0; ch.body.position.y = 0;
  const run = U.clamp(s.speed / 6, 0, 1.2);
  ch.phase += dt * (4 + s.speed * 1.55) * (run > 0.05 ? 1 : 0);
  CH.pose(ch, ch.phase, run, s.aim, s.air, s.pitch, dt);
  if (ch.flash > 0) {
    ch.flash -= dt;
    const e = ch.flash > 0 ? 0x662222 : 0x000000;
    for (const k in ch.mats) ch.mats[k].emissive.setHex(e);
  }
};

CH.pose = function (ch, p, run, aim, air, pitch, dt) {
  const A = run;
  const sw = Math.sin(p), cw = Math.cos(p);
  let thL = -sw * 0.75 * A, thR = sw * 0.75 * A;
  let knL = 0.08 + Math.max(0, cw) * 1.1 * A, knR = 0.08 + Math.max(0, -cw) * 1.1 * A;
  if (air) { thL = -0.7; thR = 0.15; knL = 1.2; knR = 0.5; }
  ch.L.hip.rotation.x = thL; ch.R.hip.rotation.x = thR;
  ch.L.knee.rotation.x = knL; ch.R.knee.rotation.x = knR;
  ch.hips.position.y = 0.95 - 0.02 * A + Math.abs(Math.sin(p)) * 0.05 * A;
  ch.hips.rotation.y = sw * 0.12 * A;
  ch.torso.rotation.y = -sw * 0.18 * A;
  const lean = 0.18 * A * (1 - aim * 0.7);
  ch.torso.rotation.x = lean - pitch * (0.55 + aim * 0.25);
  ch.neck.rotation.x = -lean * 0.5 - pitch * 0.25;
  // braços seguram a arma (mais alto ao mirar)
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
  ch.root.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.castShadow = v; });
};
