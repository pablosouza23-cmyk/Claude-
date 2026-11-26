/**
 * Construtores de objetos de cenário reutilizáveis + Batcher (instancing).
 * Objetos repetidos (árvores, arbustos, cercas, flores) viram InstancedMesh,
 * reduzindo drasticamente as draw calls (essencial para celulares).
 */
import * as THREE from 'three';
import { canvasTexture, mat, mesh, rbox } from '../core/Assets';

export class Batcher {
  private groups = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; colors: THREE.Color[] | null; shadow: boolean }>();
  private dummy = new THREE.Object3D();

  add(key: string, geo: THREE.BufferGeometry, m: THREE.Material, pos: THREE.Vector3Like, rot = 0, scale: number | THREE.Vector3Like = 1, color?: string, shadow = true, rx = 0, rz = 0): void {
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { geo, mat: m, mats: [], colors: null, shadow }));
    this.dummy.position.set(pos.x, pos.y, pos.z);
    this.dummy.rotation.set(rx, rot, rz);
    if (typeof scale === 'number') this.dummy.scale.setScalar(scale); else this.dummy.scale.set(scale.x, scale.y, scale.z);
    this.dummy.updateMatrix();
    g.mats.push(this.dummy.matrix.clone());
    if (color) {
      if (!g.colors) g.colors = [];
      g.colors[g.mats.length - 1] = new THREE.Color(color);
    }
  }

  build(parent: THREE.Object3D): void {
    for (const g of this.groups.values()) {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.mats.length);
      g.mats.forEach((m, i) => im.setMatrixAt(i, m));
      if (g.colors) for (let i = 0; i < g.mats.length; i++) im.setColorAt(i, g.colors[i] ?? new THREE.Color('#ffffff'));
      im.castShadow = g.shadow;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
    }
    this.groups.clear();
  }
}

/* ------------------------------ geometrias base ------------------------------ */

const foliageGeo = new THREE.IcosahedronGeometry(1, 1);
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 8);
const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });
const whiteSmooth = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });

export function addTree(b: Batcher, x: number, z: number, s: number, rot: number, tall: boolean, y = 0): void {
  const greens = ['#5fb84a', '#4ea63d', '#73c255', '#3f9a4a', '#88c94f'];
  const gc = greens[Math.floor(Math.abs(Math.sin(x * 12.9 + z * 78.2)) * greens.length) % greens.length];
  b.add('trunk', trunkGeo, mat('#8a5a32', 0.9), { x, y: y + 1.0 * s, z }, rot, { x: s, y: 2.0 * s, z: s });
  if (tall) {
    b.add('cone', coneGeo, white, { x, y: y + 2.6 * s, z }, rot, { x: 1.5 * s, y: 2.2 * s, z: 1.5 * s }, gc);
    b.add('cone', coneGeo, white, { x, y: y + 3.6 * s, z }, rot, { x: 1.15 * s, y: 1.8 * s, z: 1.15 * s }, gc);
    b.add('cone', coneGeo, white, { x, y: y + 4.5 * s, z }, rot, { x: 0.75 * s, y: 1.3 * s, z: 0.75 * s }, gc);
  } else {
    b.add('foliage', foliageGeo, white, { x, y: y + 2.7 * s, z }, rot, 1.45 * s, gc);
    b.add('foliage', foliageGeo, white, { x: x + 0.7 * s, y: y + 2.3 * s, z: z + 0.3 * s }, rot + 1, 0.95 * s, gc);
    b.add('foliage', foliageGeo, white, { x: x - 0.6 * s, y: y + 2.4 * s, z: z - 0.4 * s }, rot + 2, 1.0 * s, gc);
    b.add('foliage', foliageGeo, white, { x: x + 0.1 * s, y: y + 3.5 * s, z: z - 0.1 * s }, rot + 3, 0.85 * s, gc);
  }
}

export function addBush(b: Batcher, x: number, z: number, s: number, rot: number, y = 0): void {
  const gc = ['#4fa83c', '#5cb84a', '#3e9a45'][Math.floor(Math.abs(Math.sin(x * 3.1 + z)) * 3) % 3];
  b.add('foliage', foliageGeo, white, { x, y: y + 0.45 * s, z }, rot, { x: 0.9 * s, y: 0.65 * s, z: 0.9 * s }, gc);
  b.add('foliage', foliageGeo, white, { x: x + 0.5 * s, y: y + 0.35 * s, z: z + 0.2 * s }, rot, 0.55 * s, gc);
  if (s > 1) {
    const fc = ['#ff6fa8', '#ffd23c', '#ffffff', '#b38cff'][Math.floor(Math.abs(Math.cos(x + z * 2)) * 4) % 4];
    for (let i = 0; i < 4; i++) b.add('flower', sphereGeo, whiteSmooth, { x: x + Math.cos(i * 1.7) * 0.6 * s, y: y + 0.75 * s, z: z + Math.sin(i * 1.7) * 0.6 * s }, 0, 0.09 * s, fc, false);
  }
}

export function addFlowerbed(b: Batcher, x: number, z: number, rot: number, w = 3.2, d = 1.4): void {
  const c = Math.cos(rot), s = Math.sin(rot);
  const L = (lx: number, lz: number) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  b.add('planter', rbox(1, 1, 1, 0.12), mat('#d9cdb8', 0.85), { x, y: 0.3, z }, rot, { x: w, y: 0.6, z: d });
  b.add('soil', rbox(1, 1, 1, 0.05), mat('#6b4a32', 1), { x, y: 0.58, z }, rot, { x: w - 0.2, y: 0.08, z: d - 0.2 }, undefined, false);
  const cols = ['#ff4fa3', '#ffc93c', '#ffffff', '#b38cff', '#ff8a3d'];
  for (let i = 0; i < 14; i++) {
    const p = L((((i * 37) % 100) / 100 - 0.5) * (w - 0.6), (((i * 61) % 100) / 100 - 0.5) * (d - 0.5));
    b.add('stem', coneGeo, mat('#4ea63d', 0.9), { x: p.x, y: 0.75, z: p.z }, 0, { x: 0.06, y: 0.35, z: 0.06 }, undefined, false);
    b.add('flower', sphereGeo, whiteSmooth, { x: p.x, y: 0.95, z: p.z }, 0, 0.13, cols[i % cols.length], false);
  }
}

/* ------------------------------ objetos ------------------------------ */

export function bench(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#c98a4b', 0.8);
  const metal = mat('#3b4252', 0.4, 0.6);
  for (let i = 0; i < 3; i++) g.add(place(mesh(rbox(2.0, 0.08, 0.16, 0.03), wood), 0, 0.5, -0.12 + i * 0.18));
  for (let i = 0; i < 2; i++) g.add(place(mesh(rbox(2.0, 0.08, 0.14, 0.03), wood), 0, 0.75 + i * 0.2, -0.3, -0.18));
  for (const sx of [-0.8, 0.8]) {
    g.add(place(mesh(rbox(0.08, 0.5, 0.5, 0.02), metal), sx, 0.25, 0));
    g.add(place(mesh(rbox(0.08, 0.6, 0.08, 0.02), metal), sx, 0.75, -0.3, -0.18));
  }
  return g;
}

export function lamp(lit = false): THREE.Group {
  const g = new THREE.Group();
  const metal = mat('#2f3646', 0.35, 0.7);
  g.add(place(mesh(new THREE.CylinderGeometry(0.1, 0.16, 4, 10), metal), 0, 2, 0));
  g.add(place(mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.25, 12), metal), 0, 0.12, 0));
  g.add(place(mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.18, 12), metal), 0, 4.1, 0));
  const glow = mesh(new THREE.SphereGeometry(0.32, 16, 12), mat('#fff6d8', 0.2, 0, '#ffd98a', lit ? 2.2 : 0.7), false);
  g.add(place(glow, 0, 4.45, 0));
  g.add(place(mesh(new THREE.ConeGeometry(0.42, 0.3, 12), metal), 0, 4.85, 0));
  return g;
}

export function balloonCluster(color: string): THREE.Group {
  const g = new THREE.Group();
  const cols = [color, '#ffffff', color];
  for (let i = 0; i < 3; i++) {
    const m = mesh(sphereGeo, mat(cols[i], 0.25, 0.05), false);
    m.scale.set(0.55, 0.68, 0.55);
    m.position.set(Math.cos(i * 2.1) * 0.45, 0.2 * i, Math.sin(i * 2.1) * 0.45);
    g.add(m);
  }
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3, 4), mat('#ffffff'));
  line.position.y = -1.7;
  g.add(line);
  return g;
}

/** placa com texto desenhado em canvas */
export function signTexture(text: string, opts: { w?: number; h?: number; bg?: string | CanvasGradient; fg?: string; font?: string; sub?: string; border?: string } = {}): THREE.CanvasTexture {
  const W = opts.w ?? 1024, H = opts.h ?? 256;
  return canvasTexture(W, H, (c) => {
    if (opts.bg === undefined) {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#7c5cff'); g.addColorStop(0.55, '#ff4fa3'); g.addColorStop(1, '#ffb400');
      c.fillStyle = g;
    } else c.fillStyle = opts.bg;
    c.beginPath(); c.roundRect(0, 0, W, H, H * 0.18); c.fill();
    if (opts.border) { c.strokeStyle = opts.border; c.lineWidth = H * 0.05; c.beginPath(); c.roundRect(H * 0.04, H * 0.04, W - H * 0.08, H - H * 0.08, H * 0.15); c.stroke(); }
    c.fillStyle = opts.fg ?? '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = opts.font ?? `${Math.floor(H * 0.5)}px Lilita, system-ui, sans-serif`;
    c.shadowColor = 'rgba(0,0,0,0.25)';
    c.shadowOffsetY = H * 0.03;
    c.fillText(text, W / 2, opts.sub ? H * 0.4 : H / 2, W * 0.92);
    if (opts.sub) {
      c.font = `700 ${Math.floor(H * 0.2)}px system-ui, sans-serif`;
      c.fillText(opts.sub, W / 2, H * 0.76, W * 0.9);
    }
  });
}

export function signPlane(tex: THREE.Texture, w: number, h: number, emissive = 0.35): THREE.Mesh {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: emissive, transparent: true });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  return p;
}

export function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

/** canteiro de grama e caminho: textura procedural para o topo da ilha */
export function islandTopTexture(size: number, R: number, draw?: (c: CanvasRenderingContext2D, toPx: (v: number) => number) => void): THREE.CanvasTexture {
  const tex = canvasTexture(size, size, (c) => {
    const toPx = (v: number) => ((v + R) / (2 * R)) * size;
    // grama com ruído
    c.fillStyle = '#7cc45a';
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 6; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      c.fillStyle = Math.random() > 0.5 ? 'rgba(80,160,60,0.25)' : 'rgba(150,210,100,0.25)';
      c.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    draw?.(c, toPx);
  });
  tex.anisotropy = 8;
  return tex;
}
