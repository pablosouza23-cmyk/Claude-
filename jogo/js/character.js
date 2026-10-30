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
  // personagem feito a partir de outro modelo (sem arquivo novo): roupa gasta e escura, pele pálida e máscara 3D
  carrasco: { base: 'jeans', grade: 'grim', mask: true },
  // jogador de futebol original: camisa amarela com detalhes verdes, calção azul, número 10 e nome CRAQUE
  craque: { base: 'bone', kit: { cell: 'm022_body', name: 'CRAQUE', num: '10', sleeve: [0.42, 0.86], cuff: 0.79, front: [0.56, 0.56], back: [0.5, 0.31, 0.2] } },
};
// 10 camisas (molde do Boné) e 10 conjuntos (roupa inteira recolorida), todos originais do jogo
const KIT0 = { cell: 'm022_body', sleeve: [0.42, 0.86], cuff: 0.79, front: [0.56, 0.56], back: [0.5, 0.31, 0.2] };
const SHIRTS = [['cm_tropical', [255, 140, 0], [255, 220, 0], [30, 30, 30]], ['cm_oceano', [20, 110, 200], [255, 255, 255], [20, 40, 90]], ['cm_vulcao', [200, 30, 30], [30, 30, 30], [40, 40, 40]],
  ['cm_floresta', [40, 120, 50], [230, 200, 60], [60, 50, 30]], ['cm_neon', [170, 40, 220], [40, 240, 255], [20, 20, 40]], ['cm_areia', [220, 195, 140], [120, 80, 40], [90, 70, 50]],
  ['cm_gelo', [200, 235, 255], [60, 150, 230], [220, 230, 240]], ['cm_noite', [25, 25, 35], [255, 200, 0], [25, 25, 35]], ['cm_rosa', [255, 80, 160], [255, 255, 255], [60, 30, 60]], ['cm_listrada', [245, 245, 245], [20, 60, 160], [20, 40, 90], [8, [30, 70, 190]]]];
for (const s of SHIRTS) CH.AV[s[0]] = { base: 'bone', lazy: true, kit: Object.assign({}, KIT0, { shirt: s[1], cuffC: s[2], pants: s[3], stripe: s[4] }) };
const OUTFITS = [['cj_artico', 'soldado', [235, 240, 250]], ['cj_deserto', 'soldado2', [205, 175, 115]], ['cj_urbano', 'swat', [95, 100, 115]], ['cj_carmesim', 'jeans', [175, 30, 40]], ['cj_real', 'soldada', [215, 170, 45]],
  ['cj_cyber', 'swat', [90, 45, 210]], ['cj_selva', 'soldado', [65, 115, 45]], ['cj_oceano', 'camisa', [30, 95, 185]], ['cj_sombra', 'heroi', [38, 38, 44]], ['cj_lava', 'jeans', [235, 95, 25]]];
for (const o of OUTFITS) CH.AV[o[0]] = { base: o[1], lazy: true, grade: { tint: o[2] } };
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
  // Passinho do Jamal: pernas e balanço da dança base; os braços são montados por IK (CH.jamal)
  if (CH.clips.dance3) { const j = CH.clips.dance3.clone(); j.name = 'jamal'; CH.clips.jamal = j; }
};

CH.load = async function (onStep) {
  const get = async p => { const r = await fetch(CH.url(CH.BASE + p)); if (!r.ok) throw new Error('falta ' + p); return r.arrayBuffer(); };
  CH.buildClips(await get('anims.bin'));
  const keys = Object.keys(CH.AV).filter(k => !CH.AV[k].base);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], cfg = CH.AV[k];
    const av = CH.buildAvatar(k, await get(k + '.bin'));
    const maps = [], nmaps = [];
    for (const m of av.h.mats) {
      const png = (cfg.png || []).includes(m);
      maps.push(await CH.loadTex(CH.BASE + 'tex/' + m + (png ? '.png' : '.jpg'), true));
      nmaps.push((cfg.normal || []).includes(m) ? await CH.loadTex(CH.BASE + 'tex/' + m + '_n.jpg', false) : null);
    }
    CH.atlas(av, cfg, maps, nmaps);
    CH.prepRig(av);
    CH.data[k] = av;
    if (onStep) onStep((i + 1) / keys.length);
  }
  for (const k in CH.AV) if (CH.AV[k].base && !CH.AV[k].lazy && CH.data[CH.AV[k].base]) CH.data[k] = CH.variant(k, CH.AV[k]);
  CH.ready = true;
};

// ---------- personagens derivados ----------
// "grim": dessatura, puxa para o verde-oliva e escurece (roupa encardida, pele pálida de filme de terror)
CH.grade = function (tex, kind) {
  const im = tex.image, w0 = im.width, h0 = im.height, sc = Math.min(1, 1024 / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc);
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const l = a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11;
    if (kind && kind.tint) {
      // conjunto: roupa ganha a cor nova (com as dobras do tecido), a pele continua igual
      const R = a[i], Gc = a[i + 1], B = a[i + 2];
      if (R > Gc + 18 && R > B + 30 && l > 70) continue;
      const k = 0.32 + Math.min(1, l / 200) * 0.85, T = kind.tint;
      a[i] = Math.min(255, T[0] * k); a[i + 1] = Math.min(255, T[1] * k); a[i + 2] = Math.min(255, T[2] * k);
      continue;
    }
    const n = (Math.random() - 0.5) * 18; // sujeira
    a[i] = Math.max(0, Math.min(255, (l * 0.86 + a[i] * 0.14) * 0.92 + n));
    a[i + 1] = Math.max(0, Math.min(255, (l * 0.86 + a[i + 1] * 0.14) * 0.94 + n));
    a[i + 2] = Math.max(0, Math.min(255, (l * 0.86 + a[i + 2] * 0.14) * 0.74 + n));
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = tex.flipY;
  return t;
};
// uniforme pintado em cima da textura da camiseta: as regiões são as do mapa UV do modelo "camisa"
CH.kitTex = function (tex, cell, kit) {
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const X = cell.x, Y = cell.y, S = cell.s;
  const d = g.getImageData(X, Y, S, S), a = d.data;
  const tint = (i, r, gg, b, k) => { a[i] = Math.min(255, r * k); a[i + 1] = Math.min(255, gg * k); a[i + 2] = Math.min(255, b * k); };
  const sv = kit.sleeve;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4, R = a[i], Gc = a[i + 1], B = a[i + 2];
    const l = R * 0.3 + Gc * 0.59 + B * 0.11, skin = R > Gc + 18 && R > B + 30 && l > 70;
    const shirt = u > 0.31 && u < 0.69 && v < 0.9 && !skin, sleeve = (u < 0.31 || u > 0.69) && v > sv[0] && v < sv[1] && !skin;
    const pants = (u < 0.3 || u > 0.7) && v < sv[0] - 0.01;
    if (shirt || sleeve) {
      // cor lisa (some o desenho da roupa original), só com um pouco das dobras do tecido
      const k = 0.78 + Math.min(1, l / 255) * 0.3, S1 = kit.shirt || [250, 214, 30], C1 = kit.cuffC || [0, 150, 90];
      const st = kit.stripe && shirt && Math.floor(u * kit.stripe[0]) % 2 === 1;
      if (sleeve && v > kit.cuff) tint(i, C1[0], C1[1], C1[2], k); else if (st) tint(i, kit.stripe[1][0], kit.stripe[1][1], kit.stripe[1][2], k); else tint(i, S1[0], S1[1], S1[2], k);
    } else if (pants) {
      const k = 0.55 + Math.min(1, l / 150) * 0.6, P1 = kit.pants || [32, 72, 205];
      tint(i, P1[0], P1[1], P1[2], k);
    }
  }
  g.putImageData(d, 0, 0);
  // número e nome em azul com contorno verde; nas costas o desenho do molde fica de cabeça para baixo, então gira 180°
  const txt = (s, cx, cy, size, rot) => {
    g.save(); g.translate(X + cx * S, Y + cy * S); if (rot) g.rotate(Math.PI);
    g.font = '900 ' + Math.round(size * S) + 'px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, S * 0.006); g.strokeStyle = '#0a7a4a'; g.fillStyle = '#1636a8';
    g.strokeText(s, 0, 0); g.fillText(s, 0, 0); g.restore();
  };
  if (kit.num) {
    txt(kit.num, kit.front[0], kit.front[1], 0.075, false);
    txt(kit.name, kit.back[0], kit.back[1], 0.045, true);
    txt(kit.num, kit.back[0], kit.back[2], 0.13, true);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = tex.flipY;
  return t;
};
CH.variant = function (key, cfg) {
  const src = CH.data[cfg.base];
  const kitCell = cfg.kit && src.cellOf && src.cellOf[cfg.kit.cell];
  const mats = src.mats.map((m, mi) => {
    const c = m.clone();
    if (m.map && m.map.image) c.map = kitCell && mi === 0 ? CH.kitTex(m.map, kitCell, cfg.kit) : cfg.grade ? CH.grade(m.map, cfg.grade) : m.map;
    c.name = key + '_' + m.name; return c;
  });
  const av = Object.assign({}, src, { key: key, mats: mats, mask: !!cfg.mask });
  if (cfg.mask) {
    // posição da máscara no osso da cabeça, medida no esqueleto em repouso
    const inst = CH.rig(src);
    inst.holder.rotation.y = -src.yaw;
    inst.top.updateMatrixWorld(true);
    const R = inst.bones, wp = b => b.getWorldPosition(new THREE.Vector3());
    const eyes = wp(R.Bip01_LEye).add(wp(R.Bip01_REye)).multiplyScalar(0.5);
    const fw = new THREE.Vector3(0, 0, 1);
    const mw = new THREE.Matrix4().compose(eyes.clone().addScaledVector(fw, -0.028).add(new THREE.Vector3(0, -0.035, 0)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    av.maskM = R.Bip01_Head.matrixWorld.clone().invert().multiply(mw);
  }
  return av;
};
// máscara original do Carrasco: casca branca encardida com costura no meio, fendas e furinhos
CH.maskMesh = function () {
  if (!CH.cache.mask) {
    const geo = new THREE.SphereGeometry(1, 28, 20, Math.PI / 2 - 1.15, 2.3, 0.32, 2.35);
    geo.scale(0.092, 0.132, 0.1);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.184 + 0.5, pos.getY(i) / 0.264 + 0.5);
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S * 0.45, 10, S / 2, S / 2, S * 0.6);
    gr.addColorStop(0, '#e6e0cc'); gr.addColorStop(1, '#a89e84');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(70,55,35,' + Math.random() * 0.12 + ')'; g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 4, 2 + Math.random() * 4); }
    // olhos: fendas inclinadas
    g.fillStyle = '#0c0a08';
    for (const sd of [-1, 1]) { g.save(); g.translate(S / 2 + sd * 46, S * 0.42); g.rotate(sd * 0.22); g.beginPath(); g.ellipse(0, 0, 26, 11, 0, 0, 7); g.fill(); g.restore(); }
    // furinhos de respirar em leque na boca
    for (let r = 0; r < 3; r++) for (let k = -3 + (r % 2) * 0.5; k <= 3; k++) { g.beginPath(); g.arc(S / 2 + k * 15, S * 0.68 + r * 14, 3.4, 0, 7); g.fill(); }
    // costura vertical
    g.strokeStyle = '#3b2a1c'; g.lineWidth = 3; g.beginPath(); g.moveTo(S / 2, 10); g.lineTo(S / 2, S * 0.3); g.stroke();
    g.lineWidth = 2; for (let y = 16; y < S * 0.3; y += 12) { g.beginPath(); g.moveTo(S / 2 - 7, y); g.lineTo(S / 2 + 7, y + 4); g.stroke(); }
    // arranhões
    g.strokeStyle = 'rgba(60,40,25,.7)'; g.lineWidth = 2.5;
    for (const [x, y] of [[70, 150], [78, 160], [86, 170]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 34, y - 46); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    CH.cache.mask = { geo: geo, mat: new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, side: THREE.DoubleSide }) };
  }
  const m = new THREE.Mesh(CH.cache.mask.geo, CH.cache.mask.mat);
  m.castShadow = true;
  // tira de couro em volta da cabeça segurando a máscara
  if (!CH.cache.strap) CH.cache.strap = { geo: new THREE.TorusGeometry(1, 0.075, 6, 28).rotateX(Math.PI / 2).scale(0.079, 1, 0.09).translate(0, 0.03, -0.072), mat: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.85 }) };
  const st = new THREE.Mesh(CH.cache.strap.geo, CH.cache.strap.mat); st.scale.y = 0.12; m.add(st);
  return m;
};

// Junta as texturas opacas do avatar numa só (um desenho por personagem em vez de 3 a 6).
// As UVs de cada parte são levadas para a sua célula do atlas; a parte com transparência
// (cabelo, cílios) continua separada porque usa recorte de alfa.
CH.atlas = function (av, cfg, maps, nmaps) {
  const g = av.geo, uv = g.attributes.uv, idx = g.index.array;
  const names = av.h.mats;
  const opaque = names.map((m, i) => !(cfg.png || []).includes(m) && maps[i] && maps[i].image ? i : -1).filter(i => i >= 0);
  // UVs fora de 0..1 (textura repetida) não cabem no atlas
  const range = names.map(() => [1e9, -1e9]);
  for (const gr of g.groups) for (let j = gr.start; j < gr.start + gr.count; j++) { const v = idx[j], a = uv.getX(v), b = uv.getY(v); const r = range[gr.materialIndex]; r[0] = Math.min(r[0], a, b); r[1] = Math.max(r[1], a, b); }
  const cells = opaque.filter(i => range[i][0] > -0.02 && range[i][1] < 1.02);
  const mk = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, o));
  const mats = [], remap = new Array(names.length).fill(-1);
  if (cells.length > 1) {
    const cs = Math.max(...cells.map(i => maps[i].image.width));
    const cols = Math.ceil(Math.sqrt(cells.length)), rows = Math.ceil(cells.length / cols);
    const draw = (list, fill) => {
      const c = document.createElement('canvas'); c.width = cols * cs; c.height = rows * cs;
      const x = c.getContext('2d');
      if (fill) { x.fillStyle = fill; x.fillRect(0, 0, c.width, c.height); }
      cells.forEach((mi, n) => { const im = list[mi] && list[mi].image; if (im) x.drawImage(im, (n % cols) * cs, Math.floor(n / cols) * cs, cs, cs); });
      return c;
    };
    const tex = new THREE.CanvasTexture(draw(maps)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const hasN = cells.some(i => nmaps[i]);
    const o = { map: tex };
    if (hasN) { const nt = new THREE.CanvasTexture(draw(nmaps, 'rgb(128,128,255)')); nt.anisotropy = 4; o.normalMap = nt; o.normalScale = new THREE.Vector2(0.8, 0.8); }
    const m0 = mk(o); m0.name = av.key + '_atlas';
    mats.push(m0);
    const done = new Uint8Array(uv.count);
    // onde cada textura ficou no atlas (usado pelos personagens derivados que pintam a roupa)
    av.cellOf = {};
    cells.forEach((mi, n) => { av.cellOf[names[mi]] = { x: (n % cols) * cs, y: Math.floor(n / cols) * cs, s: cs }; });
    cells.forEach((mi, n) => {
      remap[mi] = 0;
      const cx = n % cols, cy = Math.floor(n / cols);
      for (const gr of g.groups) if (gr.materialIndex === mi) for (let j = gr.start; j < gr.start + gr.count; j++) {
        const v = idx[j]; if (done[v]) continue; done[v] = 1;
        // a textura é lida com flipY: v=0 é a base da imagem
        uv.setXY(v, (cx + uv.getX(v)) / cols, 1 - (cy + 1 - uv.getY(v)) / rows);
      }
    });
    uv.needsUpdate = true;
  }
  names.forEach((m, i) => {
    if (remap[i] >= 0) return;
    const png = (cfg.png || []).includes(m);
    const o = { map: maps[i], roughness: /helmet|equipment|pistol|knife/.test(m) ? 0.6 : 0.82, metalness: /pistol|knife/.test(m) ? 0.4 : 0 };
    if (nmaps[i]) { o.normalMap = nmaps[i]; o.normalScale = new THREE.Vector2(0.8, 0.8); }
    if (png) { o.alphaTest = 0.45; o.side = THREE.DoubleSide; }
    const mat = mk(o); mat.name = m;
    remap[i] = mats.length; mats.push(mat);
  });
  // refaz os grupos com os materiais novos, juntando os vizinhos iguais
  const old = g.groups.slice().sort((a, b) => a.start - b.start);
  g.clearGroups();
  let cur = null;
  for (const gr of old) {
    const m = remap[gr.materialIndex];
    if (cur && cur.m === m && cur.start + cur.count === gr.start) cur.count += gr.count;
    else { if (cur) g.addGroup(cur.start, cur.count, cur.m); cur = { start: gr.start, count: gr.count, m }; }
  }
  if (cur) g.addGroup(cur.start, cur.count, cur.m);
  av.mats = mats;
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
  // dedos: eixo de dobra no espaço de cada osso (calculado uma vez; a pose sai pronta depois)
  av.fingers = { L: [], R: [] };
  for (const s of ['L', 'R']) {
    const hand = R['Bip01_' + s + '_Hand'];
    const hq = hand.getWorldQuaternion(new THREE.Quaternion());
    const f = rig[s].f.clone().applyQuaternion(hq), n = rig[s].pn.clone().applyQuaternion(hq);
    const bend = new THREE.Vector3().crossVectors(n, f).normalize();
    const sign = s === 'L' ? -1 : 1;
    const add = (name, axisW, thumb, base) => {
      const b = R[name]; if (!b) return;
      const bq = b.getWorldQuaternion(new THREE.Quaternion()).invert();
      av.fingers[s].push({ name, ax: axisW.clone().applyQuaternion(bq).normalize(), thumb, base, sign: thumb ? -sign : sign });
    };
    for (let i = 1; i <= 4; i++) for (const seg of ['', '1', '2']) add('Bip01_' + s + '_Finger' + i + seg, bend, false, seg === '');
    add('Bip01_' + s + '_Finger0', f, true, false);
  }
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
  // esfera fixa (em cm, espaço da malha) folgada para as poses: some da lista quando sai da tela
  if (!av.geo.boundingSphere) av.geo.computeBoundingSphere();
  mesh.boundingSphere = av.geo.boundingSphere.clone();
  mesh.boundingSphere.radius *= 1.5;
  mesh.frustumCulled = true;
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

// paraquedas de células (tipo asa): perfil de asa com espessura, células infladas, painéis laterais
// e faixas coloridas; a linha central passa pelo topo (y = 0) e as pontas caem em arco
CH.CHUTE = { R: 3.7, SPAN: 1.02, CHORD: 2.8, CELLS: 9 };
CH.chuteGeo = function () {
  if (CH.cache.chute) return CH.cache.chute;
  const C = CH.CHUTE, NS = C.CELLS * 4, NC = 14;
  const pos = [], col = [], uv = [], idx = [];
  const PAL = [[0.86, 0.14, 0.12], [0.96, 0.95, 0.92], [0.98, 0.72, 0.1], [0.96, 0.95, 0.92]];
  // perfil NACA (espessura) com leve curvatura; t = 0 bordo de ataque (frente, +z)
  const thick = (t) => 5 * 0.17 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1036 * t * t * t * t) * C.CHORD;
  const camber = (t) => 0.07 * C.CHORD * Math.sin(Math.PI * t) * (1 - t * 0.4);
  const point = (u, t, side) => {
    const a = u * C.SPAN, rx = Math.sin(a), ry = Math.cos(a);
    const cellPh = ((u + 1) / 2 * C.CELLS) % 1, bulge = 0.82 + 0.28 * Math.sin(Math.PI * cellPh);
    const off = camber(t) + side * thick(t) / 2 * (side > 0 ? bulge : 0.95);
    const r = C.R + off;
    return [rx * r, ry * r - C.R, C.CHORD / 2 - t * C.CHORD];
  };
  // superfície de cima (side 1) e de baixo (side -1)
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NC; j++) {
      const u = i / NS * 2 - 1, t = Math.pow(j / NC, 1.4);
      const p = point(u, t, side);
      pos.push(p[0], p[1], p[2]);
      const cell = Math.min(C.CELLS - 1, Math.floor((u + 1) / 2 * C.CELLS)), c = PAL[cell % PAL.length], k = side > 0 ? 1 : 0.62;
      col.push(c[0] * k, c[1] * k, c[2] * k);
      uv.push((u + 1) * 6, t * 3);
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NC; j++) {
      const a = base + i * (NC + 1) + j, b2 = a + NC + 1;
      if (side > 0) idx.push(a, b2, a + 1, b2, b2 + 1, a + 1); else idx.push(a, a + 1, b2, b2, a + 1, b2 + 1);
    }
  }
  // painéis das pontas (fecham o perfil dos dois lados)
  for (const u of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= NC; j++) {
      const t = Math.pow(j / NC, 1.4);
      for (const side of [1, -1]) { const p = point(u, t, side); pos.push(p[0], p[1], p[2]); col.push(0.2, 0.22, 0.26); uv.push(t * 3, side > 0 ? 1 : 0); }
    }
    for (let j = 0; j < NC; j++) { const a = base + j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  CH.cache.chute = g;
  return g;
};
// linhas: de cada mão (tirantes) até vários pontos da parte de baixo da asa
CH.chuteLines = function (y0) {
  const C = CH.CHUTE, lp = [];
  for (let i = 0; i < 8; i++) {
    const u = (i + 0.5) / 8 * 2 - 1, a = u * C.SPAN, sd = u < 0 ? -1 : 1;
    for (const t of [0.12, 0.45, 0.8]) {
      const r = C.R - 0.08, x = Math.sin(a) * r, y = Math.cos(a) * r - C.R + y0, z = C.CHORD / 2 - t * C.CHORD;
      lp.push(sd * 0.26, 2.02, 0.05, x, y, z);
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  return lg;
};

// ---------- personagem ----------
// hq = armas com o modelo detalhado (jogador local); os outros usam a versão leve
CH.make = function (key, hq) {
  if (!CH.data[key] && CH.AV[key] && CH.AV[key].base && CH.data[CH.AV[key].base]) CH.data[key] = CH.variant(key, CH.AV[key]);
  const av = CH.data[key] || CH.data.heroi;
  const mats = av.mats.map(m => m.clone());
  const r = CH.rig(av, mats);
  r.holder.rotation.y = -av.yaw;
  if (av.mask && av.maskM && r.bones.Bip01_Head) { const mk = CH.maskMesh(); mk.matrixAutoUpdate = false; mk.matrix.copy(av.maskM); r.bones.Bip01_Head.add(mk); }
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
  if (!CH.chuteMat) {
    const fab = TX.tex('weave');
    CH.chuteMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, metalness: 0.02, bumpMap: fab, bumpScale: 0.6, envMapIntensity: 0.8 });
    CH.lineMat = new THREE.LineBasicMaterial({ color: 0x2a2d33, transparent: true, opacity: 0.85 });
  }
  const CY = 5.3;
  const fp = typeof WPN !== 'undefined' && WPN.furia && WPN.furia.parachute;
  if (fp) {
    // modelo do Fúria Tropical (velame com as cordas), as cordas começam acima dos ombros
    const fm = CH.fuChuteMat || (CH.fuChuteMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.02 }));
    const canopy = new THREE.Mesh(fp, fm); canopy.position.y = 0.66; canopy.castShadow = true; chute.add(canopy);
  } else {
    const canopy = new THREE.Mesh(CH.chuteGeo(), CH.chuteMat);
    canopy.position.y = CY; canopy.castShadow = true;
    chute.add(canopy);
    chute.add(new THREE.LineSegments(CH.chuteLines(CY), CH.lineMat));
  }
  // tirantes nos ombros
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0x1d2026, roughness: 0.8 }));
  riser.position.set(0, 2.02, 0.05); chute.add(riser);
  chute.visible = false;
  root.add(chute);

  const B = r.bones;
  const ch = {
    key, av, root, body, holder: r.holder, mesh: r.mesh, B, mixer, acts, mats,
    gun, gunMesh, gunGlow, muzzle, eject, stow, stowMesh, stowGlow, board, chute,
    outlines: [], meshes: [r.mesh, gunMesh, stowMesh],
    deadT: -1, flash: 0, punchT: 0, landT: 0, recoil: 0, gunId: null, stowId: null, grip: null,
    cur: null, w: {}, hipYaw: 0, aimK: 0, crouchK: 0, airK: 0, prevFace: 0, idleT: 0, emote: null,
    lod: 0, tick: 0, acc: 0, hq: !!hq, fingers: { L: [], R: [] },
  };
  for (const k in acts) ch.w[k] = 0;
  for (const sd of ['L', 'R']) for (const f of av.fingers[sd]) { const b = B[f.name]; if (b) ch.fingers[sd].push({ b, q0: b.quaternion.clone(), ax: f.ax, thumb: f.thumb, base: f.base, sign: f.sign }); }
  gunGlow.visible = false; stowGlow.visible = false;
  // caminho da raiz até o peito (para os personagens distantes)
  ch.spinePath = [];
  for (let o = B.Bip01_Spine2; o; o = o.parent) { ch.spinePath.unshift(o); if (o === root) break; }
  return ch;
};

const _emptyGeo = new THREE.BufferGeometry();
CH.setGuns = function (ch, inHand, onBack) {
  if (ch.gunId !== inHand) {
    ch.gunId = inHand;
    if (inHand) {
      const p = WPN.build(inHand, !ch.hq);
      ch.gunMesh.geometry = p.g; ch.gunGlow.geometry = p.glow || _emptyGeo; ch.gunGlow.visible = !!p.glow;
      ch.gunMesh.material = ch.skins && ch.skins[inHand] ? WPN.skinMat(ch.skins[inHand]) : WPN.gunMat();
      ch.muzzle.position.set(0, p.muzzleY !== undefined ? p.muzzleY : 0.03, p.len + 0.02);
      ch.grip = p;
    }
    ch.gun.visible = !!inHand;
  }
  if (ch.stowId !== onBack) {
    ch.stowId = onBack;
    if (onBack) { const p = WPN.build(onBack, true); ch.stowMesh.geometry = p.g; ch.stowGlow.geometry = p.glow || _emptyGeo; ch.stowGlow.visible = !!p.glow; ch.stowMesh.material = ch.skins && ch.skins[onBack] ? WPN.skinMat(ch.skins[onBack]) : WPN.gunMat(); }
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

// posição da arma em relação ao peito: [lado, altura, frente] parado e mirando
CH.TUNE = { rifle: [0.15, 0.17, 0.36, 0.1, 0.25, 0.36], pistol: [0.06, 0.2, 0.5, 0.02, 0.27, 0.52] };

// ---------- matemática de ossos (tudo em espaço de mundo) ----------
// Os mundos dos ossos vêm do updateMatrixWorld feito logo após o mixer; cada ajuste atualiza só o
// próprio osso (e quem vem logo depois na cadeia), sem subir a hierarquia nem criar objetos.
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _mr = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function wpos(o, out) { return out.setFromMatrixPosition(o.matrixWorld); }
function worldQ(o, out) { _mr.extractRotation(o.matrixWorld); return out.setFromRotationMatrix(_mr); }
function upd(o) { o.updateMatrix(); o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); }
function rotWorld(bone, q) {
  worldQ(bone.parent, _q2);
  _q3.copy(_q2).invert().multiply(q).multiply(_q2);
  bone.quaternion.premultiply(_q3);
  upd(bone);
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
  upd(b); upd(c);
  wpos(c, _C);
  _v5.copy(_A).addScaledVector(dir, d);
  aimBone(b, _C, _v5);
  upd(c);
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
  worldQ(hand.parent, _q2);
  hand.quaternion.copy(_q2.invert().multiply(_q1));
  upd(hand);
}
// dedos: pose pronta calculada no carregamento (k = 0 relaxado, 1 fechado no cabo)
const _fq = new THREE.Quaternion();
function curlFingers(ch, s, k, thumb) {
  const list = ch.fingers[s];
  for (const f of list) {
    const ang = f.thumb ? thumb * f.sign : (f.base ? 0.9 : 1.0) * (0.25 + k * 1.05) * f.sign;
    _fq.setFromAxisAngle(f.ax, ang);
    f.b.quaternion.copy(f.q0).multiply(_fq);
  }
}

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
  for (const n in ch.acts) {
    const act = ch.acts[n], w = tot > 0 ? ch.w[n] / tot : 0;
    act.setEffectiveWeight(w);
    // clipe com peso zero não precisa ser calculado
    act.enabled = w > 0.001;
  }
}
// escolhe o clipe pela velocidade; sincroniza a fase ao trocar
const LOCO = [['walk', 1.01, 0, 1.9], ['jog', 2.41, 1.9, 3.9], ['sprint', 5.84, 3.9, 99]];
function locoPick(spd) {
  for (const l of LOCO) if (spd < l[3]) return l;
  return LOCO[2];
}

// nível de detalhe da animação: 0 completo, 1 sem dedos/pés, 2 só o clipe (meia taxa), 3 só o clipe (1/4)
CH.setLod = function (ch, dist, inView) {
  let l = dist < 18 ? 0 : dist < 45 ? 1 : dist < 90 ? 2 : 3;
  if (!inView) l = Math.max(l, dist < 25 ? 2 : 3);
  ch.lod = l;
};

const _bodyR = new THREE.Vector3(), _bodyF = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _gunPos = new THREE.Vector3(), _gunQ = new THREE.Quaternion(), _gunE = new THREE.Euler(0, 0, 0, 'YXZ');
const _tgt = new THREE.Vector3(), _pole = new THREE.Vector3(), _fw = new THREE.Vector3(), _nw = new THREE.Vector3();
const _fl = new THREE.Vector3(), _fr = new THREE.Vector3(), _sp = new THREE.Vector3(), _hw = new THREE.Vector3(), _lg = new THREE.Vector3();
const W0 = {};

// s: {mode:'ground'|'fall'|'chute', speed, vx, vz, aim, air, pitch, crouch, armed, dead, board, emote}
CH.animate = function (ch, dt, s) {
  const B = ch.B;
  if (ch.flash > 0) {
    ch.flash -= dt;
    const e = ch.flash > 0 ? 0x661a1a : 0x000000;
    for (const m of ch.mats) m.emissive.setHex(e);
  }
  // personagens longe ou fora da tela animam com menos frequência
  const every = ch.lod >= 3 ? 4 : ch.lod === 2 ? 2 : 1;
  ch.acc = (ch.acc || 0) + dt;
  if (++ch.tick % every !== 0) return;
  dt = Math.min(ch.acc, 0.25); ch.acc = 0;
  const full = ch.lod === 0, armsIK = ch.lod <= 1;

  const face = ch.body.rotation.y;
  _bodyF.set(Math.sin(face), 0, Math.cos(face));
  _bodyR.set(-Math.cos(face), 0, Math.sin(face)); // direita do personagem
  for (const k in W0) delete W0[k];
  const W = W0;
  let rate = 1;
  const mode = s.dead ? 'dead' : s.mode || 'ground';
  ch.board.visible = mode === 'fall' && s.board !== false;
  ch.chute.visible = mode === 'chute';
  if (mode === 'chute') {
    // a asa acompanha o corpo, balança e inclina um pouco nas curvas
    const t = performance.now() / 1000;
    ch.chute.rotation.set(Math.sin(t * 1.3) * 0.03, ch.body.rotation.y, Math.sin(t * 0.9) * 0.05, 'YXZ');
  }
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
    ch.hipYaw = U.damp(ch.hipYaw, yawT, 12, dt);
    if (s.emote !== ch.curEmote) { if (s.emote && ch.acts[s.emote]) ch.acts[s.emote].time = 0; ch.curEmote = s.emote; }
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
  setWeights(ch, W, dt, mode === 'dead' ? 6 : 14);
  ch.mixer.update(dt);
  if (armsIK) ch.root.updateMatrixWorld(true);
  else {
    // longe: só a cadeia até o peito (posição da arma); o resto o renderizador atualiza
    for (const o of ch.spinePath) { if (o.matrixAutoUpdate) o.updateMatrix(); if (o.parent) o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); else o.matrixWorld.copy(o.matrix); }
  }

  // ---- camadas procedurais ----
  const hipYaw = mode === 'ground' && armsIK ? ch.hipYaw : 0;
  if (Math.abs(hipYaw) > 1e-3) {
    rotAxis(B.Bip01, UP, -hipYaw); upd(B.Bip01_Pelvis);
    rotAxis(B.Bip01_Spine, UP, hipYaw * 0.4);
    rotAxis(B.Bip01_Spine1, UP, hipYaw * 0.3);
    rotAxis(B.Bip01_Spine2, UP, hipYaw * 0.3);
    B.Bip01.updateMatrixWorld(true);
  }
  // agachar e pouso: baixa o corpo e dobra as pernas por IK mantendo os pés no chão
  ch.crouchK = U.damp(ch.crouchK, mode === 'ground' && s.crouch && (s.speed || 0) >= 0.3 ? 1 : 0, 8, dt);
  let squash = ch.crouchK * 0.32;
  if (ch.landT > 0) { ch.landT -= dt; squash += Math.sin(U.clamp(ch.landT / 0.28, 0, 1) * Math.PI) * 0.16; }
  ch.airK = U.damp(ch.airK, mode === 'ground' && s.air ? 1 : 0, 10, dt);
  if (mode === 'fall') squash = 0.3;
  if (armsIK && (squash > 0.005 || ch.airK > 0.01)) {
    wpos(B.Bip01_L_Foot, _fl); wpos(B.Bip01_R_Foot, _fr);
    if (ch.airK > 0.01) {
      // pulo: joelhos sobem
      _fl.addScaledVector(UP, 0.28 * ch.airK).addScaledVector(_bodyF, 0.12 * ch.airK);
      _fr.addScaledVector(UP, 0.16 * ch.airK).addScaledVector(_bodyF, -0.05 * ch.airK);
    }
    // desce o quadril em espaço de mundo
    wpos(B.Bip01, _tmp); _tmp.y -= squash;
    B.Bip01.parent.worldToLocal(_tmp);
    B.Bip01.position.copy(_tmp);
    B.Bip01.updateMatrixWorld(true);
    _pole.copy(_bodyF).addScaledVector(UP, 0.1);
    ik2(B.Bip01_L_Thigh, B.Bip01_L_Calf, B.Bip01_L_Foot, _fl, _pole);
    ik2(B.Bip01_R_Thigh, B.Bip01_R_Calf, B.Bip01_R_Foot, _fr, _pole);
  }
  const arm = (s2, target, pole) => ik2(B['Bip01_' + s2 + '_UpperArm'], B['Bip01_' + s2 + '_Forearm'], B['Bip01_' + s2 + '_Hand'], target, pole);

  if (mode === 'fall') {
    if (!armsIK) return;
    // em cima da prancha: braços abertos
    wpos(B.Bip01_Spine2, _sp);
    const sw = Math.sin(performance.now() / 600) * 0.06;
    for (const [sd, s2] of SIDES) {
      _tgt.copy(_sp).addScaledVector(_bodyR, sd * 0.72).addScaledVector(UP, 0.12 + sw * sd).addScaledVector(_bodyF, -0.08);
      _pole.copy(_bodyF).multiplyScalar(-1).addScaledVector(UP, -0.3);
      arm(s2, _tgt, _pole);
    }
    return;
  }
  if (mode === 'chute') {
    if (!armsIK) return;
    wpos(B.Bip01_Spine2, _sp);
    for (const [sd, s2] of SIDES) {
      _tgt.copy(_sp).addScaledVector(_bodyR, sd * 0.26).addScaledVector(UP, 0.62).addScaledVector(_bodyF, 0.05);
      _pole.copy(_bodyR).multiplyScalar(sd).addScaledVector(_bodyF, -0.4);
      arm(s2, _tgt, _pole);
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
    if (!armsIK) return;
    wpos(B.Bip01_Spine2, _sp);
    for (const [sd, s2] of SIDES) {
      _tgt.copy(_sp).addScaledVector(_bodyR, sd * 0.6 * d).addScaledVector(UP, 0.1 * d);
      _tgt.lerp(wpos(B['Bip01_' + s2 + '_Hand'], _hw), 1 - d);
      _pole.set(0, -1, 0);
      arm(s2, _tgt, _pole);
    }
    return;
  }
  ch.body.rotation.x = 0; ch.body.position.y = 0;

  // ---- tronco e arma ----
  const armed = ch.gun.visible && ch.grip;
  ch.aimK = U.damp(ch.aimK, armed ? 1 : 0, 10, dt);
  const pitch = s.pitch || 0, aim = s.aim || 0;
  if (armed) {
    if (armsIK) {
      // inclina o tronco com a mira (dividido pela coluna)
      const pk = -pitch * 0.85;
      rotAxis(B.Bip01_Spine, _bodyR, pk * 0.25 + 0.04); upd(B.Bip01_Spine1);
      rotAxis(B.Bip01_Spine1, _bodyR, pk * 0.3); upd(B.Bip01_Spine2);
      rotAxis(B.Bip01_Spine2, _bodyR, pk * 0.3); upd(B.Bip01_Neck);
      rotAxis(B.Bip01_Neck, _bodyR, pk * 0.1);
      upd(B.Bip01_Head);
      for (const [, s2] of SIDES) { upd(B['Bip01_' + s2 + '_Clavicle']); upd(B['Bip01_' + s2 + '_UpperArm']); upd(B['Bip01_' + s2 + '_Forearm']); upd(B['Bip01_' + s2 + '_Hand']); }
    }
    // a arma fica num ponto fixo em relação ao peito, apontando para a mira
    const chest = wpos(B.Bip01_Spine2, _sp);
    const g = ch.grip;
    const pistol = g.pistol;
    const rc = ch.recoil; ch.recoil = Math.max(0, ch.recoil - dt * 9);
    const T = pistol ? CH.TUNE.pistol : CH.TUNE.rifle;
    const sx = U.lerp(T[0], T[3], aim), sy = U.lerp(T[1], T[4], aim), sz = U.lerp(T[2], T[5], aim);
    // sacando a arma: vem de baixo, inclinada, e sobe até a posição
    let dk = 0;
    if (ch.drawT > 0) { ch.drawT -= dt; dk = U.smooth(0, 0.35, Math.max(0, ch.drawT)); }
    // inspecionar: levanta a arma, vira de lado para a câmera e depois mostra o outro lado
    const it = s.inspect || 0;
    const ie = it > 0 ? U.smooth(0, 0.14, it) * (1 - U.smooth(0.84, 1, it)) : 0;
    if (s.gunAt) {
      // câmera de peito: a arma fica num ponto fixo da tela (canto inferior direito)
      _gunQ.copy(s.gunAt.q);
      if (dk || rc) { _gunE.set(-rc * 0.1 - dk * 1.1, 0, dk * 0.6); _q1.setFromEuler(_gunE); _gunQ.multiply(_q1); }
      _gunPos.copy(s.gunAt.p).addScaledVector(UP, -dk * 0.25 + ie * 0.06);
      _tmp.set(0, 0, -rc * 0.05).applyQuaternion(_gunQ); _gunPos.add(_tmp);
    } else {
      _gunE.set(pitch * 0.98 - rc * 0.1 - dk * 1.1, face, dk * 0.6);
      _gunQ.setFromEuler(_gunE);
      _gunPos.copy(chest).addScaledVector(_bodyR, sx * (1 - ie * 0.45)).addScaledVector(UP, sy - 0.12 - dk * 0.28 + ie * 0.03);
      // inspecionando: a arma vem para perto do peito, assim as duas mãos alcançam o cabo e a telha
      _tmp.set(0, -0.02, sz - rc * 0.05 - ie * 0.14).applyQuaternion(_gunQ);
      _gunPos.add(_tmp);
    }
    if (ie > 0) {
      // gira pouco em volta do próprio cano (mostra um lado, depois o outro): as mãos continuam no cabo e na telha
      const rm = s.gunAt ? 1 : 0.55, roll = (it < 0.5 ? U.smooth(0.1, 0.4, it) * 0.62 : 0.62 - U.smooth(0.5, 0.8, it) * 1.1) * rm;
      _gunE.set((0.24 + Math.sin(it * 6) * 0.02) * (s.gunAt ? 1 : 0.6), s.gunAt ? -0.3 : 0.22, roll); _gunE.x *= ie; _gunE.y *= ie; _gunE.z *= ie;
      _q1.setFromEuler(_gunE); _gunQ.multiply(_q1);
    }
    // o grupo da arma é filho do corpo: converte para o espaço local
    _m2.copy(ch.body.matrixWorld).invert();
    ch.gun.position.copy(_gunPos).applyMatrix4(_m2);
    worldQ(ch.body, _q3);
    ch.gun.quaternion.copy(_q3.invert().multiply(_gunQ));
    ch.gun.updateMatrix(); ch.gun.matrixWorld.multiplyMatrices(ch.body.matrixWorld, ch.gun.matrix);
    if (armsIK) {
      // mão direita no cabo, mão esquerda na frente (ou no carregador, recarregando)
      const gm = ch.gun.matrixWorld;
      const fwd = _v3.set(0, 0, 1).applyQuaternion(_gunQ), upg = _v2.set(0, 1, 0).applyQuaternion(_gunQ);
      const leftG = _lg.crossVectors(upg, fwd); // +X da arma (lado esquerdo)
      _tgt.set(0, -0.06, g.gripZ + 0.02).applyMatrix4(gm);
      _pole.copy(_bodyR).multiplyScalar(0.8).addScaledVector(UP, -1);
      arm('R', _tgt.addScaledVector(fwd, -0.06).addScaledVector(leftG, -0.035), _pole);
      if (full) {
        _fw.copy(fwd).multiplyScalar(0.55).addScaledVector(upg, -0.75).normalize();
        orientHand(B.Bip01_R_Hand, ch.av.rig.R, _fw, leftG);
        curlFingers(ch, 'R', 0.85, 0.35);
      }
      const rl = s.reload || 0; // 0..1 durante a recarga
      if (pistol) _tgt.set(0.02, -0.09, g.gripZ + 0.0); else _tgt.set(0.0, g.foreY !== undefined ? g.foreY - 0.02 : -0.035, g.foreZ);
      if (rl > 0) {
        // mão vai ao carregador, puxa para baixo e volta
        const k = Math.sin(Math.min(1, rl) * Math.PI);
        _tgt.lerp(_tmp.set(0.03, -0.18 - k * 0.12, (g.gripZ + g.foreZ) * 0.5 + 0.06), Math.min(1, k * 1.6));
      }
      _tgt.applyMatrix4(gm);
      _pole.copy(_bodyR).multiplyScalar(-0.6).addScaledVector(UP, -1);
      _tgt.addScaledVector(fwd, -0.05).addScaledVector(leftG, 0.03).addScaledVector(upg, -0.03);
      arm('L', _tgt, _pole);
      if (full) {
        _fw.copy(fwd).multiplyScalar(0.8).addScaledVector(leftG, -0.5).normalize();
        _nw.copy(upg).addScaledVector(leftG, -0.4).normalize();
        orientHand(B.Bip01_L_Hand, ch.av.rig.L, _fw, _nw);
        curlFingers(ch, 'L', pistol ? 0.85 : 0.7, 0.2);
      }
    }
  } else {
    if (full) { curlFingers(ch, 'R', 0.15, 0); curlFingers(ch, 'L', 0.15, 0); }
    if (ch.punchT > 0) {
      ch.punchT -= dt;
      const pk = Math.sin(U.clamp(1 - ch.punchT / 0.3, 0, 1) * Math.PI);
      wpos(B.Bip01_R_UpperArm, _tmp);
      _tgt.copy(_tmp).addScaledVector(_bodyF, 0.6).addScaledVector(UP, -0.05);
      _tgt.lerp(wpos(B.Bip01_R_Hand, _hw), 1 - pk);
      _pole.copy(_bodyR).addScaledVector(UP, -1);
      arm('R', _tgt, _pole);
    }
  }
  // deslizando: o corpo inclina para trás e cola no chão (pernas vão à frente com a pose de agachar)
  const sl = U.clamp(s.slide || 0, 0, 1);
  if (sl > 0 || ch.slideK) { ch.slideK = sl; ch.body.rotation.x = -0.62 * sl; ch.body.position.y = -0.42 * sl; }
  if (s.emote === 'jamal' && ch.acts.jamal) CH.jamal(ch, ch.acts.jamal.time, arm, B);
  // cabeça acompanha a mira
  if (full) rotAxis(B.Bip01_Head, _bodyR, -pitch * 0.25);
  // arma guardada nas costas, na diagonal
  if (ch.stow.visible) {
    wpos(B.Bip01_Spine2, _tmp).addScaledVector(_bodyF, -0.2).addScaledVector(UP, -0.02);
    _m2.copy(ch.body.matrixWorld).invert();
    ch.stow.position.copy(_tmp).applyMatrix4(_m2);
    ch.stow.rotation.set(0, Math.PI / 2, 0.85);
  }
};
const SIDES = [[1, 'R'], [-1, 'L']];

// ---------- Passinho do Jamal ----------
// 8 tempos: braços cruzados (2), mãos na nuca (2), soco pra baixo dir./esq., varrida dir./esq.
// cada pose: [direita, esquerda] em (lado, altura, frente) a partir do pescoço
const JAMAL = [
  [[-0.14, -0.13, 0.22], [0.14, -0.09, 0.25]],
  [[-0.14, -0.13, 0.22], [0.14, -0.09, 0.25]],
  [[0.13, 0.17, -0.05], [-0.13, 0.17, -0.05]],
  [[0.13, 0.17, -0.05], [-0.13, 0.17, -0.05]],
  [[0.06, -0.58, 0.32], [-0.14, -0.24, 0.24]],
  [[0.14, -0.24, 0.24], [-0.06, -0.58, 0.32]],
  [[-0.42, 0.14, 0.34], [-0.18, -0.3, 0.2]],
  [[0.18, -0.3, 0.2], [0.42, 0.14, 0.34]],
];
CH.JAMAL_BEAT = 60 / 128;
const _jn = new THREE.Vector3(), _jt = new THREE.Vector3(), _jp = new THREE.Vector3(), _ja = new THREE.Vector3(), _jb = new THREE.Vector3();
CH.jamal = function (ch, t, arm, B) {
  const nk = B.Bip01_Neck || B.Bip01_Head;
  if (!nk) return;
  wpos(nk, _jn);
  const bt = t / CH.JAMAL_BEAT, i = Math.floor(bt) % 8, ph = bt - Math.floor(bt);
  const k = U.smooth(0, 0.35, ph), P0 = JAMAL[(i + 7) % 8], P1 = JAMAL[i];
  const head = i === 2 || i === 3;
  for (let sd = 0; sd < 2; sd++) {
    const a = P0[sd], b = P1[sd], sg = sd ? -1 : 1;
    const r = a[0] + (b[0] - a[0]) * k, u = a[1] + (b[1] - a[1]) * k, f = a[2] + (b[2] - a[2]) * k;
    _jt.copy(_jn).addScaledVector(_bodyR, r).addScaledVector(UP, u).addScaledVector(_bodyF, f);
    _jp.copy(_bodyR).multiplyScalar(sg).addScaledVector(UP, head ? 0.4 : -1).addScaledVector(_bodyF, head ? 0.2 : 0);
    arm(sd ? 'L' : 'R', _jt, _jp);
  }
};
