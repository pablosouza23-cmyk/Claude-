'use strict';
// Personagens realistas (Microsoft Rocketbox, licença MIT) com animações de captura de movimento.
// O corpo toca os clipes (parado, andar, correr...) e por cima disso:
// - o quadril gira para o lado do movimento (andar de lado e de costas sem deslizar);
// - o tronco inclina com a mira;
// - os braços seguram a arma por IK de dois ossos e os dedos fecham no cabo;
// - salto, prancha, paraquedas e queda são poses montadas com IK de braços e pernas.
const CH = {};

CH.BASE = 'assets/chars/';
// avatar -> materiais com textura de transparência (png) e com mapa de normais
CH.AV = {
  heroi: { png: ['m006_opacity'], normal: ['m006_body', 'm006_head'] },
  swat: { png: ['m158_opacity'] },
  soldado: {},
  soldado2: {},
  bone: {},
  camisa: { png: ['m017_opacity'] },
  jeans: {},
  soldada: {},
};
CH.PLAYER_PAL = 'heroi';
CH.BOT_PALS = ['swat', 'soldado', 'bone', 'camisa', 'soldado2', 'jeans', 'soldada', 'swat', 'bone', 'soldado'];
CH.data = {};
CH.clips = {};
CH.ready = false;

// No arquivo único os binários vêm embutidos em window.ASSETS
CH.url = p => (window.ASSETS && window.ASSETS[p]) || p;

CH.parse = function (buf) {
  const dv = new DataView(buf);
  const hl = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
  let p = 8 + hl;
  return { header, buf, base: p };
};

CH.loadTex = function (url, srgb) {
  return new Promise(res => {
    new THREE.TextureLoader().load(CH.url(url), t => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      res(t);
    }, undefined, () => res(null));
  });
};

CH.buildAvatar = function (key, buf) {
  const { header: h } = CH.parse(buf);
  const n = h.verts;
  // seções do binário, na ordem gravada pelo conversor (alinhadas em 4 bytes)
  let off = 8 + ((new DataView(buf).getUint32(4, true)));
  const al = () => { off = (off + 3) & ~3; };
  const take = (Ctor, count) => { al(); const a = new Ctor(buf, off, count); off += a.byteLength; return a; };
  const pos = take(Float32Array, n * 3);
  const nor = take(Int16Array, n * 3);
  const uv = take(Float32Array, n * 2);
  const si = take(Uint8Array, n * 4);
  const sw = take(Uint8Array, n * 4);
  let triCount = 0; for (const g of h.groups) triCount += g.count;
  const idx = take(h.idx32 ? Uint32Array : Uint16Array, triCount);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const gr of h.groups) g.addGroup(gr.start, gr.count, gr.m);
  const invArr = take(Float32Array, h.bones.length * 16);
  const inverses = [];
  for (let i = 0; i < h.bones.length; i++) inverses.push(new THREE.Matrix4().fromArray(invArr, i * 16));
  return { key, h, geo: g, inverses };
};

CH.buildClips = function (buf) {
  const { header: h } = CH.parse(buf);
  const base = 8 + new DataView(buf).getUint32(4, true);
  const data0 = (base + 3) & ~3;
  for (const c of h.clips) {
    const tracks = [];
    const nf = c.tracks[0].n;
    const times = new Float32Array(nf);
    for (let i = 0; i < nf; i++) times[i] = i / h.fps;
    for (const t of c.tracks) {
      if (t.t === 'q') {
        const q = new Int16Array(buf, data0 + t.off, t.n * 4);
        const v = new Float32Array(t.n * 4);
        for (let i = 0; i < v.length; i++) v[i] = q[i] / 32767;
        tracks.push(new THREE.QuaternionKeyframeTrack(t.node + '.quaternion', times, v));
      } else {
        const v = new Float32Array(buf.slice(data0 + t.off, data0 + t.off + t.n * 12));
        tracks.push(new THREE.VectorKeyframeTrack(t.node + '.position', times, v));
      }
    }
    const clip = new THREE.AnimationClip(c.name, c.dur, tracks);
    clip.userData = { speed: c.speed / 100 }; // m/s
    CH.clips[c.name] = clip;
  }
};

CH.load = async function (onStep) {
  const get = async p => { const r = await fetch(CH.url(CH.BASE + p)); if (!r.ok) throw new Error('falta ' + p); return r.arrayBuffer(); };
  CH.buildClips(await get('anims.bin'));
  const keys = Object.keys(CH.AV);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], cfg = CH.AV[k];
    const av = CH.buildAvatar(k, await get(k + '.bin'));
    av.mats = [];
    for (const m of av.h.mats) {
      const png = (cfg.png || []).includes(m);
      const map = await CH.loadTex(CH.BASE + 'tex/' + m + (png ? '.png' : '.jpg'), true);
      const nm = (cfg.normal || []).includes(m) ? await CH.loadTex(CH.BASE + 'tex/' + m + '_n.jpg', false) : null;
      const o = { map, roughness: /helmet|equipment|pistol|knife/.test(m) ? 0.6 : 0.82, metalness: /pistol|knife/.test(m) ? 0.4 : 0 };
      if (nm) { o.normalMap = nm; o.normalScale = new THREE.Vector2(0.8, 0.8); }
      if (png) { o.alphaTest = 0.45; o.side = THREE.DoubleSide; }
      const mat = new THREE.MeshStandardMaterial(o);
      mat.name = m;
      av.mats.push(mat);
    }
    CH.prepRig(av);
    CH.data[k] = av;
    if (onStep) onStep((i + 1) / keys.length);
  }
  CH.ready = true;
};

// mede o esqueleto em repouso: frente do rosto, eixos dos dedos e da palma de cada mão
CH.prepRig = function (av) {
  const inst = CH.rig(av);
  const R = inst.bones;
  inst.top.updateMatrixWorld(true);
  const wp = b => b.getWorldPosition(new THREE.Vector3());
  const eyes = wp(R.Bip01_LEye).add(wp(R.Bip01_REye)).multiplyScalar(0.5);
  const fw = eyes.sub(wp(R.Bip01_Head)); fw.y = 0; fw.normalize();
  av.yaw = Math.atan2(fw.x, fw.z); // girar -yaw deixa o rosto em +Z
  inst.holder.rotation.y = -av.yaw;
  inst.top.updateMatrixWorld(true);
  const rig = {};
  for (const s of ['L', 'R']) {
    const hand = R['Bip01_' + s + '_Hand'];
    const q = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
    const f = wp(R['Bip01_' + s + '_Finger2']).sub(wp(hand)).normalize().applyQuaternion(q);
    // palma: em T a palma olha para baixo
    const pn = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
    pn.sub(f.clone().multiplyScalar(pn.dot(f))).normalize();
    rig[s] = { f, pn };
  }
  av.rig = rig;
  // altura do quadril em repouso, para IK das pernas
  av.hipH = wp(R.Bip01_Pelvis).y;
  av.footH = wp(R.Bip01_L_Foot).y;
};

// cria o esqueleto (ossos + malha) de um avatar
CH.rig = function (av, mats) {
  const h = av.h;
  const objs = h.nodes.map(nd => {
    let o;
    if (nd.t === 'b') o = new THREE.Bone();
    else if (nd.t === 'm') o = new THREE.SkinnedMesh(av.geo, mats || av.mats || []);
    else o = new THREE.Object3D();
    o.name = nd.n;
    o.position.fromArray(nd.pos); o.quaternion.fromArray(nd.q); o.scale.fromArray(nd.s);
    return o;
  });
  const holder = new THREE.Group();
  holder.scale.setScalar(0.01);
  h.nodes.forEach((nd, i) => { if (nd.p >= 0) objs[nd.p].add(objs[i]); else holder.add(objs[i]); });
  const mesh = objs[h.mesh];
  const bones = h.bones.map(i => objs[i]);
  const skel = new THREE.Skeleton(bones, av.inverses.map(m => m.clone()));
  mesh.bind(skel, new THREE.Matrix4().fromArray(h.bindMatrix));
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e9);
  mesh.frustumCulled = false;
  const B = {};
  for (const o of objs) if (o.isBone) B[o.name] = o;
  const top = new THREE.Group(); top.add(holder);
  return { holder, top, mesh, bones: B, root: objs[0] };
};

// ---------- prancha e paraquedas ----------
CH.cache = {};
CH.boardGeo = function () {
  if (CH.cache.board) return CH.cache.board;
  const parts = [
    U.part(new THREE.SphereGeometry(1, 24, 10), 0x39e0ff, U.mat4(0, 0, 0, 0, 0, 0, 0.3, 0.045, 1.05), 'radial'),
    U.part(new THREE.SphereGeometry(1, 24, 10), 0xff5fb8, U.mat4(0, -0.035, 0.05, 0, 0, 0, 0.26, 0.03, 0.9), 'radial'),
    U.part(new THREE.BoxGeometry(0.22, 0.012, 1.4), 0xffffff, U.mat4(0, 0.042, 0), 'radial'),
    U.part(new THREE.BoxGeometry(0.02, 0.14, 0.2), 0xffffff, U.mat4(0, -0.1, -0.7), 'radial'),
  ];
  CH.cache.board = U.merge(parts.map(p => p.g));
  return CH.cache.board;
};

CH.chuteGeo = function () {
  if (CH.cache.chute) return CH.cache.chute;
  // asa curva em gomos vermelho/branco
  const g = new THREE.CylinderGeometry(3.4, 3.4, 2.6, 24, 4, true, -1.15, 2.3);
  g.rotateX(-Math.PI / 2);
  const ng = g.toNonIndexed();
  const pos = ng.attributes.position, n = pos.count, cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    let x = 0, y = 0;
    for (let k = 0; k < 3; k++) { x += pos.getX(i + k); y += pos.getY(i + k); }
    const a = Math.floor((Math.atan2(x / 3, y / 3) + 1.15) / 2.3 * 8);
    const red = a % 2 === 0;
    for (let k = 0; k < 3; k++) { const j = (i + k) * 3; cols[j] = red ? 0.82 : 0.95; cols[j + 1] = red ? 0.16 : 0.95; cols[j + 2] = red ? 0.14 : 0.93; }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  ng.computeVertexNormals();
  CH.cache.chute = ng;
  return ng;
};

// ---------- personagem ----------
CH.make = function (key) {
  const av = CH.data[key] || CH.data.heroi;
  const mats = av.mats.map(m => m.clone());
  const r = CH.rig(av, mats);
  r.holder.rotation.y = -av.yaw;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.order = 'YXZ';
  root.add(body);
  body.add(r.holder);
  r.mesh.castShadow = true;
  const mixer = new THREE.AnimationMixer(r.root);
  const acts = {};
  for (const k in CH.clips) {
    const a = mixer.clipAction(CH.clips[k]);
    a.enabled = true; a.setEffectiveWeight(0); a.play();
    acts[k] = a;
  }

  // arma na mão (filha do corpo; a posição segue o peito) e arma guardada nas costas
  const gmat = WPN.gunMat();
  const gun = new THREE.Group(); body.add(gun);
  const gunMesh = new THREE.Mesh(new THREE.BufferGeometry(), gmat); gunMesh.castShadow = true; gun.add(gunMesh);
  const gunGlow = new THREE.Mesh(new THREE.BufferGeometry(), WPN.glowMat()); gun.add(gunGlow);
  const muzzle = new THREE.Object3D(); gun.add(muzzle);
  const eject = new THREE.Object3D(); eject.position.set(0.05, 0.04, 0.02); gun.add(eject);
  const stow = new THREE.Group(); body.add(stow);
  const stowMesh = new THREE.Mesh(new THREE.BufferGeometry(), gmat); stowMesh.castShadow = true; stow.add(stowMesh);
  const stowGlow = new THREE.Mesh(new THREE.BufferGeometry(), WPN.glowMat()); stow.add(stowGlow);

  const board = new THREE.Group();
  board.add(new THREE.Mesh(CH.boardGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1, emissive: 0x0a2a3a })));
  const trail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.55, depthWrite: false }));
  trail.scale.z = 30; trail.position.set(0, 0, -15.5);
  board.add(trail);
  board.userData.trail = trail;
  board.position.y = -0.02; board.visible = false;
  root.add(board);
  const chute = new THREE.Group();
  const canopy = new THREE.Mesh(CH.chuteGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  canopy.position.y = 2.2; canopy.castShadow = true;
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

  const B = r.bones;
  const ch = {
    key, av, root, body, holder: r.holder, mesh: r.mesh, B, mixer, acts, mats,
    gun, gunMesh, gunGlow, muzzle, eject, stow, stowMesh, stowGlow, board, chute,
    outlines: [], meshes: [r.mesh, gunMesh, stowMesh],
    deadT: -1, flash: 0, punchT: 0, landT: 0, recoil: 0, gunId: null, stowId: null, grip: null,
    cur: null, w: {}, hipYaw: 0, aimK: 0, crouchK: 0, airK: 0, prevFace: 0, idleT: 0, emote: null,
    lod: 0, skip: 0,
  };
  for (const k in acts) ch.w[k] = 0;
  return ch;
};

const _emptyGeo = new THREE.BufferGeometry();
CH.setGuns = function (ch, inHand, onBack) {
  if (ch.gunId !== inHand) {
    ch.gunId = inHand;
    if (inHand) {
      const p = WPN.build(inHand);
      ch.gunMesh.geometry = p.g; ch.gunGlow.geometry = p.glow || _emptyGeo;
      ch.muzzle.position.set(0, 0.03, p.len + 0.02);
      ch.grip = p;
    }
    ch.gun.visible = !!inHand;
  }
  if (ch.stowId !== onBack) {
    ch.stowId = onBack;
    if (onBack) { const p = WPN.build(onBack); ch.stowMesh.geometry = p.g; ch.stowGlow.geometry = p.glow || _emptyGeo; }
    ch.stow.visible = !!onBack;
  }
};

CH.setOpacity = function (ch, o) {
  for (const m of ch.mats) {
    const t = o < 0.99;
    if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
    m.opacity = o;
    m.depthWrite = !t;
  }
};
CH.setOutlinesVisible = function () {};
CH.setShadow = function (ch, v) {
  if (ch._shv === v) return;
  ch._shv = v;
  for (const m of ch.meshes) m.castShadow = v;
};

// ---------- matemática de ossos (tudo em espaço de mundo) ----------
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function wpos(o, out) { return out.setFromMatrixPosition(o.matrixWorld); }
function parentQ(o, out) { return o.parent.getWorldQuaternion(out); }
// aplica uma rotação de mundo a um osso e atualiza os filhos
function rotWorld(bone, q) {
  parentQ(bone, _q2);
  _q3.copy(_q2).invert().multiply(q).multiply(_q2);
  bone.quaternion.premultiply(_q3);
  bone.updateMatrixWorld(true);
}
function rotAxis(bone, axis, ang) {
  if (Math.abs(ang) < 1e-4) return;
  _q1.setFromAxisAngle(axis, ang);
  rotWorld(bone, _q1);
}
// gira o osso para que o ponto "child" (posição atual do filho) aponte para "target"
function aimBone(bone, child, target) {
  wpos(bone, _v1);
  _v2.subVectors(child, _v1).normalize();
  _v3.subVectors(target, _v1).normalize();
  _q1.setFromUnitVectors(_v2, _v3);
  rotWorld(bone, _q1);
}
const _A = new THREE.Vector3(), _Bp = new THREE.Vector3(), _C = new THREE.Vector3(), _E = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3();
// IK de dois ossos com vetor de polo (direção para onde o cotovelo/joelho aponta)
function ik2(a, b, c, target, pole) {
  wpos(a, _A); wpos(b, _Bp); wpos(c, _C);
  const l1 = _A.distanceTo(_Bp), l2 = _Bp.distanceTo(_C);
  _T.copy(target);
  const dir = _v4.subVectors(_T, _A);
  let d = dir.length();
  if (d < 1e-4) return;
  dir.divideScalar(d);
  d = U.clamp(d, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.999);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _P.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (_P.lengthSq() < 1e-6) _P.set(0, -1, 0);
  _P.normalize();
  _E.copy(_A).addScaledVector(dir, x).addScaledVector(_P, hh);
  aimBone(a, _Bp, _E);
  wpos(c, _C);
  _v5.copy(_A).addScaledVector(dir, d);
  aimBone(b, _C, _v5);
}
// orienta a mão: dedos para "f" e palma para "n" (mundo)
const _bl = new THREE.Matrix4(), _bw = new THREE.Matrix4();
function orientHand(hand, rig, f, n) {
  const fl = rig.f, nl = rig.pn;
  _v1.crossVectors(fl, nl);
  _bl.makeBasis(fl, nl, _v1);
  _v2.copy(n).addScaledVector(f, -n.dot(f)).normalize();
  _v3.crossVectors(f, _v2);
  _bw.makeBasis(f, _v2, _v3);
  _m1.copy(_bw).multiply(_bl.transpose());
  _q1.setFromRotationMatrix(_m1); // rotação de mundo desejada
  parentQ(hand, _q2);
  hand.quaternion.copy(_q2.invert().multiply(_q1));
  hand.updateMatrixWorld(true);
}
// fecha os dedos (k=0 aberto relaxado, 1 fechado no cabo)
function curlFingers(ch, s, k, thumb) {
  const B = ch.B, rig = ch.av.rig[s];
  const hand = B['Bip01_' + s + '_Hand'];
  hand.getWorldQuaternion(_q2);
  const f = _v4.copy(rig.f).applyQuaternion(_q2), n = _v5.copy(rig.pn).applyQuaternion(_q2);
  const ax = new THREE.Vector3().crossVectors(n, f).normalize();
  for (let i = 1; i <= 4; i++) {
    for (const seg of ['', '1', '2']) {
      const b = B['Bip01_' + s + '_Finger' + i + seg];
      if (!b) continue;
      rotAxis(b, ax, (seg === '' ? 0.9 : 1.0) * (0.25 + k * 1.05) * (s === 'L' ? -1 : 1) * CH.CURL_SIGN);
    }
  }
  const th = B['Bip01_' + s + '_Finger0'];
  if (th && thumb) rotAxis(th, f, thumb * (s === 'L' ? 1 : -1));
}
CH.CURL_SIGN = 1;
// posição da arma em relação ao peito: [lado, altura, frente] parado e mirando
CH.TUNE = { rifle: [0.15, 0.17, 0.36, 0.1, 0.25, 0.36], pistol: [0.06, 0.2, 0.5, 0.02, 0.27, 0.52] };

// ---------- clipes ----------
function setWeights(ch, target, dt, k) {
  const a = 1 - Math.exp(-(k || 10) * dt);
  let tot = 0;
  for (const n in ch.acts) {
    const t = target[n] || 0;
    ch.w[n] += (t - ch.w[n]) * a;
    if (ch.w[n] < 0.002 && t === 0) ch.w[n] = 0;
    tot += ch.w[n];
  }
  for (const n in ch.acts) ch.acts[n].setEffectiveWeight(tot > 0 ? ch.w[n] / tot : 0);
}
// escolhe o clipe pela velocidade; sincroniza a fase ao trocar
const LOCO = [['walk', 1.01, 0, 1.9], ['jog', 2.41, 1.9, 3.9], ['sprint', 5.84, 3.9, 99]];
function locoPick(spd) {
  for (const l of LOCO) if (spd < l[3]) return l;
  return LOCO[2];
}

const _bodyR = new THREE.Vector3(), _bodyF = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _gunPos = new THREE.Vector3(), _gunQ = new THREE.Quaternion();
const _tgt = new THREE.Vector3(), _pole = new THREE.Vector3(), _fw = new THREE.Vector3(), _nw = new THREE.Vector3();

// s: {mode:'ground'|'fall'|'chute', speed, vx, vz, aim, air, pitch, crouch, armed, dead, board, emote}
CH.animate = function (ch, dt, s) {
  const B = ch.B;
  if (ch.flash > 0) {
    ch.flash -= dt;
    const e = ch.flash > 0 ? 0x661a1a : 0x000000;
    for (const m of ch.mats) m.emissive.setHex(e);
  }
  const face = ch.body.rotation.y;
  _bodyF.set(Math.sin(face), 0, Math.cos(face));
  _bodyR.set(-Math.cos(face), 0, Math.sin(face)); // direita do personagem
  const W = {};
  let rate = 1;
  const mode = s.dead ? 'dead' : s.mode || 'ground';
  ch.board.visible = mode === 'fall' && s.board !== false;
  ch.chute.visible = mode === 'chute';
  if (mode === 'dead') {
    if (ch.deadT < 0) ch.deadT = 0;
    ch.deadT += dt;
    if (ch.deadT > 1.2) return; // pose final congelada
    W.idle = 1;
    ch.gun.visible = false;
  } else ch.deadT = -1;

  if (mode === 'fall' || mode === 'chute') {
    W.idle = 1;
    ch.gun.visible = false;
  } else if (mode === 'ground') {
    ch.gun.visible = !!ch.gunId && s.armed !== false;
    const spd = s.speed || 0;
    // velocidade no referencial do corpo
    const vf = spd > 0.05 ? ((s.vx || 0) * _bodyF.x + (s.vz || 0) * _bodyF.z) : 0;
    const vs = spd > 0.05 ? ((s.vx || 0) * _bodyR.x + (s.vz || 0) * _bodyR.z) : 0;
    let yawT = 0, back = false;
    if (spd > 0.3) {
      const rel = Math.atan2(vs, vf); // 0 = frente, +pi/2 = direita
      if (Math.abs(rel) <= 1.75) yawT = U.clamp(rel, -1.1, 1.1);
      else { back = true; yawT = U.clamp(U.angDiff(Math.PI, rel), -1.0, 1.0); }
    }
    ch.hipYaw = U.damp(ch.hipYaw, yawT, 9, dt);
    if (s.emote && spd < 0.3) {
      W[s.emote] = 1;
    } else if (spd < 0.3) {
      W[s.crouch ? 'crouch' : 'idle'] = 1;
    } else {
      const l = locoPick(s.crouch ? Math.min(spd, 1.5) : spd);
      W[l[0]] = 1;
      rate = U.clamp(spd / l[1], 0.55, 1.6) * (back ? -1 : 1);
      if (ch.cur !== l[0]) {
        // mantém a fase do passo ao trocar de clipe
        const old = ch.cur && ch.acts[ch.cur];
        const nw = ch.acts[l[0]];
        if (old && LOCO.some(x => x[0] === ch.cur)) nw.time = (old.time / old.getClip().duration) * nw.getClip().duration;
      }
      ch.acts[l[0]].timeScale = rate;
      ch.cur = l[0];
    }
    if (spd < 0.3) ch.cur = null;
  }
  setWeights(ch, W, dt, mode === 'dead' ? 6 : 10);
  ch.mixer.update(dt);
  ch.root.updateMatrixWorld(true);

  // ---- camadas procedurais ----
  const hipYaw = mode === 'ground' ? ch.hipYaw : 0;
  if (Math.abs(hipYaw) > 1e-3) {
    rotAxis(B.Bip01, UP, -hipYaw);
    rotAxis(B.Bip01_Spine, UP, hipYaw * 0.4);
    rotAxis(B.Bip01_Spine1, UP, hipYaw * 0.3);
    rotAxis(B.Bip01_Spine2, UP, hipYaw * 0.3);
  }
  // agachar e pouso: baixa o corpo e dobra as pernas por IK mantendo os pés no chão
  ch.crouchK = U.damp(ch.crouchK, mode === 'ground' && s.crouch && (s.speed || 0) >= 0.3 ? 1 : 0, 8, dt);
  let squash = ch.crouchK * 0.32;
  if (ch.landT > 0) { ch.landT -= dt; squash += Math.sin(U.clamp(ch.landT / 0.28, 0, 1) * Math.PI) * 0.16; }
  ch.airK = U.damp(ch.airK, mode === 'ground' && s.air ? 1 : 0, 10, dt);
  if (mode === 'fall') squash = 0.3;
  if (squash > 0.005 || ch.airK > 0.01) {
    const fl = wpos(B.Bip01_L_Foot, new THREE.Vector3()), fr = wpos(B.Bip01_R_Foot, new THREE.Vector3());
    if (ch.airK > 0.01) {
      // pulo: joelhos sobem
      fl.addScaledVector(UP, 0.28 * ch.airK).addScaledVector(_bodyF, 0.12 * ch.airK);
      fr.addScaledVector(UP, 0.16 * ch.airK).addScaledVector(_bodyF, -0.05 * ch.airK);
    }
    // desce o quadril em espaço de mundo
    wpos(B.Bip01, _tmp); _tmp.y -= squash;
    B.Bip01.parent.worldToLocal(_tmp);
    B.Bip01.position.copy(_tmp);
    B.Bip01.updateMatrixWorld(true);
    _pole.copy(_bodyF).addScaledVector(UP, 0.1);
    ik2(B.Bip01_L_Thigh, B.Bip01_L_Calf, B.Bip01_L_Foot, fl, _pole);
    ik2(B.Bip01_R_Thigh, B.Bip01_R_Calf, B.Bip01_R_Foot, fr, _pole);
  }

  if (mode === 'fall') {
    // em cima da prancha: braços abertos
    const sp = wpos(B.Bip01_Spine2, new THREE.Vector3());
    const sw = Math.sin(performance.now() / 600) * 0.06;
    for (const [sd, s2] of [[1, 'R'], [-1, 'L']]) {
      _tgt.copy(sp).addScaledVector(_bodyR, sd * 0.72).addScaledVector(UP, 0.12 + sw * sd).addScaledVector(_bodyF, -0.08);
      _pole.copy(_bodyF).multiplyScalar(-1).addScaledVector(UP, -0.3);
      ik2(B['Bip01_' + s2 + '_UpperArm'], B['Bip01_' + s2 + '_Forearm'], B['Bip01_' + s2 + '_Hand'], _tgt, _pole);
    }
    rotAxis(B.Bip01_Spine1, _bodyR, 0.15);
    return;
  }
  if (mode === 'chute') {
    const sp = wpos(B.Bip01_Spine2, new THREE.Vector3());
    for (const [sd, s2] of [[1, 'R'], [-1, 'L']]) {
      _tgt.copy(sp).addScaledVector(_bodyR, sd * 0.26).addScaledVector(UP, 0.62).addScaledVector(_bodyF, 0.05);
      _pole.copy(_bodyR).multiplyScalar(sd).addScaledVector(_bodyF, -0.4);
      ik2(B['Bip01_' + s2 + '_UpperArm'], B['Bip01_' + s2 + '_Forearm'], B['Bip01_' + s2 + '_Hand'], _tgt, _pole);
      curlFingers(ch, s2, 0.9, 0.3);
    }
    // pernas balançando
    const t = performance.now() / 700;
    rotAxis(B.Bip01_L_Thigh, _bodyR, -0.25 + Math.sin(t) * 0.12);
    rotAxis(B.Bip01_R_Thigh, _bodyR, -0.05 - Math.sin(t) * 0.12);
    return;
  }
  if (mode === 'dead') {
    // cai de costas
    const d = U.smooth(0, 0.55, ch.deadT);
    ch.body.rotation.x = -d * 1.5;
    ch.body.position.y = d * 0.14;
    const sp = wpos(B.Bip01_Spine2, new THREE.Vector3());
    for (const [sd, s2] of [[1, 'R'], [-1, 'L']]) {
      _tgt.copy(sp).addScaledVector(_bodyR, sd * 0.6 * d).addScaledVector(UP, 0.1 * d);
      _tgt.lerp(wpos(B['Bip01_' + s2 + '_Hand'], new THREE.Vector3()), 1 - d);
      _pole.copy(UP).multiplyScalar(-1);
      ik2(B['Bip01_' + s2 + '_UpperArm'], B['Bip01_' + s2 + '_Forearm'], B['Bip01_' + s2 + '_Hand'], _tgt, _pole);
    }
    return;
  }
  ch.body.rotation.x = 0; ch.body.position.y = 0;

  // ---- tronco e arma ----
  const armed = ch.gun.visible && ch.grip;
  ch.aimK = U.damp(ch.aimK, armed ? 1 : 0, 10, dt);
  const pitch = s.pitch || 0, aim = s.aim || 0;
  if (armed) {
    // inclina o tronco com a mira (dividido pela coluna)
    const pk = -pitch * 0.85;
    rotAxis(B.Bip01_Spine, _bodyR, pk * 0.25 + 0.04);
    rotAxis(B.Bip01_Spine1, _bodyR, pk * 0.3);
    rotAxis(B.Bip01_Spine2, _bodyR, pk * 0.3);
    rotAxis(B.Bip01_Neck, _bodyR, pk * 0.1);
    // a arma fica num ponto fixo em relação ao peito, apontando para a mira
    const chest = wpos(B.Bip01_Spine2, _v1);
    const g = ch.grip;
    const pistol = g.pistol;
    const rc = ch.recoil; ch.recoil = Math.max(0, ch.recoil - dt * 9);
    const T = pistol ? CH.TUNE.pistol : CH.TUNE.rifle;
    const sx = U.lerp(T[0], T[3], aim), sy = U.lerp(T[1], T[4], aim), sz = U.lerp(T[2], T[5], aim);
    _gunQ.setFromEuler(new THREE.Euler(pitch * 0.98 - rc * 0.1, face, 0, 'YXZ'));
    _gunPos.copy(chest).addScaledVector(_bodyR, sx).addScaledVector(UP, sy - 0.12);
    _tmp.set(0, -0.02, sz - rc * 0.05).applyQuaternion(_gunQ);
    _gunPos.add(_tmp);
    // o grupo da arma é filho do corpo: converte para o espaço local
    ch.body.updateMatrixWorld(true);
    _m2.copy(ch.body.matrixWorld).invert();
    ch.gun.position.copy(_gunPos).applyMatrix4(_m2);
    ch.body.getWorldQuaternion(_q3);
    ch.gun.quaternion.copy(_q3.invert().multiply(_gunQ));
    ch.gun.updateMatrixWorld(true);
    // mão direita no cabo, mão esquerda na frente
    const gp = (x, y, z, out) => out.set(x, y, z).applyMatrix4(ch.gun.matrixWorld);
    const fwd = _v3.set(0, 0, 1).applyQuaternion(_gunQ), upg = _v2.set(0, 1, 0).applyQuaternion(_gunQ);
    const leftG = new THREE.Vector3().crossVectors(upg, fwd); // +X da arma (lado esquerdo)
    gp(0, -0.06, g.gripZ + 0.02, _tgt);
    _pole.copy(_bodyR).multiplyScalar(0.8).addScaledVector(UP, -1);
    ik2(B.Bip01_R_UpperArm, B.Bip01_R_Forearm, B.Bip01_R_Hand, _tgt.addScaledVector(fwd, -0.06).addScaledVector(leftG, -0.035), _pole);
    _fw.copy(fwd).multiplyScalar(0.55).addScaledVector(upg, -0.75).normalize();
    orientHand(B.Bip01_R_Hand, ch.av.rig.R, _fw, leftG);
    curlFingers(ch, 'R', 0.85, 0.35);
    if (pistol) gp(0.02, -0.09, g.gripZ + 0.0, _tgt); else gp(0.0, -0.035, g.foreZ, _tgt);
    _pole.copy(_bodyR).multiplyScalar(-0.6).addScaledVector(UP, -1);
    _tgt.addScaledVector(fwd, -0.05).addScaledVector(leftG, 0.03).addScaledVector(upg, -0.03);
    ik2(B.Bip01_L_UpperArm, B.Bip01_L_Forearm, B.Bip01_L_Hand, _tgt, _pole);
    _fw.copy(fwd).multiplyScalar(0.8).addScaledVector(leftG, -0.5).normalize();
    _nw.copy(upg).addScaledVector(leftG, -0.4).normalize();
    orientHand(B.Bip01_L_Hand, ch.av.rig.L, _fw, _nw);
    curlFingers(ch, 'L', pistol ? 0.85 : 0.7, 0.2);
  } else {
    curlFingers(ch, 'R', 0.15, 0); curlFingers(ch, 'L', 0.15, 0);
    if (ch.punchT > 0) {
      ch.punchT -= dt;
      const pk = Math.sin(U.clamp(1 - ch.punchT / 0.3, 0, 1) * Math.PI);
      const sh = wpos(B.Bip01_R_UpperArm, new THREE.Vector3());
      _tgt.copy(sh).addScaledVector(_bodyF, 0.6).addScaledVector(UP, -0.05);
      _tgt.lerp(wpos(B.Bip01_R_Hand, new THREE.Vector3()), 1 - pk);
      _pole.copy(_bodyR).addScaledVector(UP, -1);
      ik2(B.Bip01_R_UpperArm, B.Bip01_R_Forearm, B.Bip01_R_Hand, _tgt, _pole);
    }
  }
  // cabeça acompanha a mira
  rotAxis(B.Bip01_Head, _bodyR, -pitch * 0.25);
  // arma guardada nas costas, na diagonal
  if (ch.stow.visible) {
    const sp = wpos(B.Bip01_Spine2, _v1);
    _tmp.copy(sp).addScaledVector(_bodyF, -0.2).addScaledVector(UP, -0.02);
    ch.body.updateMatrixWorld(true);
    _m2.copy(ch.body.matrixWorld).invert();
    ch.stow.position.copy(_tmp).applyMatrix4(_m2);
    ch.stow.rotation.set(0, Math.PI / 2, 0.85);
  }
};
