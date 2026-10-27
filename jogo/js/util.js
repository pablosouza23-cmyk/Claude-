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

// Muitos quadrados virados para a câmera num único desenho (partículas e nuvens).
// Cada um tem posição, tamanho, giro, cor e transparência próprios.
U.Billboards = function (max, map, opts) {
  opts = opts || {};
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  this.off = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.sr = new Float32Array(max * 3);
  const mk = (arr, n) => { const a = new THREE.InstancedBufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  this.attrs = [mk(this.off, 3), mk(this.col, 4), mk(this.sr, 3)];
  g.setAttribute('iOff', this.attrs[0]); g.setAttribute('iCol', this.attrs[1]); g.setAttribute('iSR', this.attrs[2]);
  const tiles = opts.tiles || 1;
  if (tiles > 1) { this.tile = new Float32Array(max); this.attrs.push(mk(this.tile, 1)); g.setAttribute('iTile', this.attrs[3]); }
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: !!opts.fog, toneMapped: !opts.additive,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
    vertexShader: [
      'attribute vec3 iOff; attribute vec4 iCol; attribute vec3 iSR;', tiles > 1 ? 'attribute float iTile;' : '',
      'varying vec2 vUv; varying vec4 vCol;',
      '#include <fog_pars_vertex>',
      'void main(){',
      ' vec4 mvPosition = modelViewMatrix * vec4(iOff, 1.0);',
      ' float c = cos(iSR.z), s = sin(iSR.z); vec2 p = position.xy * iSR.xy;',
      ' mvPosition.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);',
      ' vUv = uv;', tiles > 1 ? ' vUv.y = (uv.y + iTile) / ' + tiles.toFixed(1) + ';' : '',
      ' vCol = iCol; gl_Position = projectionMatrix * mvPosition;',
      '#include <fog_vertex>',
      '}'].join('\n'),
    fragmentShader: [
      'uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;',
      '#include <fog_pars_fragment>',
      'void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a); if (gl_FragColor.a < 0.004) discard;',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '#include <fog_fragment>',
      '}'].join('\n'),
  });
  mat.uniforms.map.value = map;
  this.mesh = new THREE.Mesh(g, mat);
  this.mesh.frustumCulled = false;
  this.mesh.renderOrder = opts.order || 0;
  this.max = max; this.n = 0; this.g = g;
};
U.Billboards.prototype.begin = function () { this.n = 0; };
U.Billboards.prototype.push = function (x, y, z, sx, sy, rot, r, g, b, a, tile) {
  if (this.n >= this.max) return;
  const i = this.n++;
  this.off[i * 3] = x; this.off[i * 3 + 1] = y; this.off[i * 3 + 2] = z;
  this.sr[i * 3] = sx; this.sr[i * 3 + 1] = sy; this.sr[i * 3 + 2] = rot;
  this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
  if (this.tile) this.tile[i] = tile || 0;
};
U.Billboards.prototype.end = function () {
  this.g.instanceCount = this.n;
  if (this.n) for (const a of this.attrs) a.needsUpdate = true;
  this.mesh.visible = this.n > 0;
};

// fumaça: bolota com ruído (bordas irregulares, miolo mais denso)
U.smokeTex = (function () {
  let tex = null;
  return function () {
    if (tex) return tex;
    tex = U.canvasTex(128, 128, (g) => {
      const r = U.rng(41);
      for (let i = 0; i < 38; i++) {
        const a = r() * 6.28, d = Math.pow(r(), 0.7) * 34, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, rad = 14 + r() * 22;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        const v = Math.floor(200 + r() * 55);
        gr.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.32)'); gr.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    });
    return tex;
  };
})();
// fogo: chama com miolo claro e bordas recortadas
U.fireTex = (function () {
  let tex = null;
  return function () {
    if (tex) return tex;
    tex = U.canvasTex(128, 128, (g) => {
      const r = U.rng(77);
      for (let i = 0; i < 30; i++) {
        const a = r() * 6.28, d = Math.pow(r(), 0.8) * 30, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.9, rad = 10 + r() * 20;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255,240,200,0.55)'); gr.addColorStop(0.45, 'rgba(255,160,50,0.35)'); gr.addColorStop(1, 'rgba(200,40,0,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    });
    return tex;
  };
})();
// feixe vertical (luz de raridade do loot): forte embaixo, some no alto
U.beamTex = (function () {
  let tex = null;
  return function () {
    if (tex) return tex;
    tex = U.canvasTex(32, 128, (g) => {
      const gr = g.createLinearGradient(0, 128, 0, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 128);
      const h = g.createLinearGradient(0, 0, 32, 0);
      h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 32, 128);
    });
    return tex;
  };
})();

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

// copiar texto: primeiro o jeito antigo (funciona dentro de iframe e no celular), depois a API nova
U.copy = function (text, okMsg) {
  text = String(text); let done = false;
  try {
    const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(t); t.focus(); t.select(); t.setSelectionRange(0, text.length); done = document.execCommand('copy'); t.remove();
  } catch (e) { done = false; }
  if (done) return notify('ok', okMsg || 'Copiado!');
  const fail = () => notify('info', 'Não deu para copiar sozinho: segure no código e escolha Copiar.');
  try { navigator.clipboard.writeText(text).then(() => notify('ok', okMsg || 'Copiado!'), fail); } catch (e) { fail(); }
};
