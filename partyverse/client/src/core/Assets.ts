import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

/** Carrega (com cache) um GLB da pasta de assets. */
export function loadGLB(path: string): Promise<GLTF> {
  let p = cache.get(path);
  if (!p) {
    p = loader.loadAsync(`/assets/${path}`).then((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) {
            const sm = mat as THREE.MeshStandardMaterial;
            if (sm.map) {
              // paleta da Kenney: amostragem nítida (sem borrar entre cores)
              sm.map.magFilter = THREE.NearestFilter;
              sm.map.minFilter = THREE.NearestMipmapLinearFilter;
              sm.map.anisotropy = 4;
              sm.map.needsUpdate = true;
            }
            sm.roughness = Math.max(0.55, sm.roughness ?? 1);
            sm.metalness = Math.min(0.1, sm.metalness ?? 0);
          }
        }
      });
      return g;
    });
    cache.set(path, p);
  }
  return p;
}

/** Instância clonada de um modelo (geometria/material compartilhados). */
export async function model(path: string, scale = 1): Promise<THREE.Object3D> {
  const g = await loadGLB(path);
  const o = g.scene.clone(true);
  o.scale.setScalar(scale);
  return o;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** Material PBR estilizado compartilhado por cor/acabamento. */
export function mat(color: string | number, rough = 0.7, metal = 0, emissive?: string | number, emissiveIntensity = 1): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${metal}|${emissive ?? ''}|${emissiveIntensity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (emissive !== undefined) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
/** Caixa com cantos arredondados (cacheada). */
export function rbox(w: number, h: number, d: number, r = Math.min(w, h, d) * 0.18, seg = 2): THREE.BufferGeometry {
  const key = `rb|${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}|${seg}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
    geoCache.set(key, g);
  }
  return g;
}

export function mesh(g: THREE.BufferGeometry, m: THREE.Material, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

/** Cria textura a partir de um canvas desenhado na hora. */
export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
