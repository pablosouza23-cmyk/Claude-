'use strict';
// Utilidades compartilhadas: ruído, materiais toon, contornos e mescla de geometrias.
const U = {};

U.rng = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

U.hash2 = function (x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

U.noise = function (x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = U.hash2(xi, zi), b = U.hash2(xi + 1, zi);
  const c = U.hash2(xi, zi + 1), d = U.hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

U.fbm = function (x, z) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * U.noise(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s / 0.9375;
};

U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
U.lerp = (a, b, t) => a + (b - a) * t;
U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
U.damp = (a, b, k, dt) => U.lerp(a, b, 1 - Math.exp(-k * dt));
U.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
U.dampAngle = (a, b, k, dt) => a + U.angDiff(a, b) * (1 - Math.exp(-k * dt));
U.pick = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];

// Rampa de 3 tons usada por todos os materiais toon (visual cel-shading do vídeo).
U.gradient = (function () {
  const data = new Uint8Array([110, 190, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

// Material padrão do jogo (PBR). O nome ficou da versão desenho; hoje é iluminação realista.
U.toon = function (opts) {
  const o = Object.assign({ roughness: 0.9, metalness: 0, envMapIntensity: 0.55 }, opts || {});
  delete o.gradientMap;
  return new THREE.MeshStandardMaterial(o);
};
// contornos de desenho desligados no visual realista
U.OUTLINES = false;
U._hidden = new THREE.MeshBasicMaterial({ visible: false });

// Contorno preto estilo desenho: casca invertida deslocada ao longo da normal.
U.outlineMats = {};
U.outlineMat = function (thick, color) {
  if (!U.OUTLINES) return U._hidden;
  const key = thick.toFixed(3) + '_' + (color || 0x1b1b22);
  if (U.outlineMats[key]) return U.outlineMats[key];
  const m = new THREE.MeshBasicMaterial({ color: color || 0x1b1b22, side: THREE.BackSide });
  m.onBeforeCompile = function (sh) {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed += normalize(normal) * ' + thick.toFixed(4) + ';');
  };
  m.customProgramCacheKey = () => 'ol' + key;
  U.outlineMats[key] = m;
  return m;
};

U.addOutline = function (mesh, thick) {
  const o = new THREE.Mesh(mesh.geometry, U.outlineMat(thick));
  o.userData.isOutline = true;
  o.castShadow = false;
  mesh.add(o);
  return o;
};

// Converte uma geometria em peça não indexada com cor por vértice e UV projetada (textura sem esticar).
// mode 'radial' gera também normais de contorno a partir do centro (para caixas e bolhas).
// mat escolhe a textura de detalhe da peça (ver TX.SCALE): 'plain', 'plaster', 'roof', 'wood', 'stone'...
U.part = function (geo, color, matrix, mode, mat) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  const col = new THREE.Color(color);
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (!U.OUTLINES) {
    if (matrix) g.applyMatrix4(matrix);
    U.projectUV(g, (typeof TX !== 'undefined' && TX.SCALE[mat || 'plain']) || 0.5);
    return { g: g, o: null, mat: mat || 'plain' };
  }
  const o = g.clone();
  if (mode === 'radial') {
    const p = o.attributes.position, nn = o.attributes.normal;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      nn.setXYZ(i, v.x, v.y, v.z);
    }
  }
  if (matrix) { g.applyMatrix4(matrix); o.applyMatrix4(matrix); }
  U.projectUV(g, (typeof TX !== 'undefined' && TX.SCALE[mat || 'plain']) || 0.5);
  return { g: g, o: o, mat: mat || 'plain' };
};

// UV a partir da posição: cada face usa o plano do eixo dominante da sua normal
U.projectUV = function (g, scale) {
  const p = g.attributes.position, nrm = g.attributes.normal, n = p.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 3) {
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 3 && i + k < n; k++) { nx += nrm.getX(i + k); ny += nrm.getY(i + k); nz += nrm.getZ(i + k); }
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    for (let k = 0; k < 3 && i + k < n; k++) {
      const x = p.getX(i + k), y = p.getY(i + k), z = p.getZ(i + k), j = (i + k) * 2;
      if (ay >= ax && ay >= az) { uv[j] = x * scale; uv[j + 1] = z * scale; }
      else if (ax >= az) { uv[j] = z * scale; uv[j + 1] = y * scale; }
      else { uv[j] = x * scale; uv[j + 1] = y * scale; }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
};

U.mat4 = function (x, y, z, rx, ry, rz, sx, sy, sz) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x || 0, y || 0, z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz));
  return m;
};

U.merge = function (list) {
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let off = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, off * 3);
    if (g.attributes.uv && g.attributes.uv.itemSize === 2) uv.set(g.attributes.uv.array.subarray(0, g.attributes.position.count * 2), off * 2);
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
};

// Monta um par {main, outline} a partir de várias peças.
U.build = function (parts) {
  const g = U.merge(parts.map(p => p.g));
  return { g: g, o: U.OUTLINES ? U.merge(parts.map(p => p.o)) : g };
};

// Agrupa as peças por textura: {mats: {chave: geometria}, o: contorno único}
U.buildBy = function (parts) {
  const by = {};
  for (const p of parts) (by[p.mat] = by[p.mat] || []).push(p.g);
  const mats = {};
  for (const k in by) mats[k] = U.merge(by[k]);
  return { mats: mats, o: U.OUTLINES ? U.merge(parts.map(p => p.o)) : null };
};

U.blob = function (r, detail) {
  return new THREE.IcosahedronGeometry(r, detail === undefined ? 1 : detail);
};

U.canvasTex = function (w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

U.softDot = (function () {
  let tex = null;
  return function () {
    if (tex) return tex;
    tex = U.canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    return tex;
  };
})();

U.fmtTime = function (s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60), r = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
};
