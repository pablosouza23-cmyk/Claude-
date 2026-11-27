/**
 * NAVE EM PERIGO — espaço ao redor da nave: estrelas em movimento (riscos
 * proporcionais à velocidade), asteroides do setor (mesmas posições do
 * servidor, em escala) e planetas. Tudo num grupo girado pelo rumo da nave:
 * a nave aponta sempre para +X no cenário e o espaço gira ao redor.
 */
import * as THREE from 'three';
import { SECTOR_TO_WORLD, SHIP_FLOOR } from '../../../../shared/games/nave';
import { canvasTexture } from '../../core/Assets';
import type { MapAst } from './screens';

const K = SECTOR_TO_WORLD;
const BOX = 420;
const AST_K = 2.5;

function planetTexture(c1: string, c2: string, bands: number, seed: number): THREE.CanvasTexture {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return canvasTexture(256, 128, (c) => {
    c.fillStyle = c1; c.fillRect(0, 0, 256, 128);
    for (let i = 0; i < bands; i++) {
      c.fillStyle = i % 2 ? c2 : `rgba(255,255,255,${0.05 + rnd() * 0.12})`;
      c.globalAlpha = 0.35 + rnd() * 0.4;
      c.fillRect(0, rnd() * 128, 256, 4 + rnd() * 14);
    }
    c.globalAlpha = 1;
  });
}

export class SpaceField {
  readonly group = new THREE.Group();
  private stars: THREE.LineSegments;
  private starPos: Float32Array;
  private base: Float32Array;
  private astMesh: THREE.InstancedMesh;
  private dest: THREE.Mesh;
  private giant: THREE.Group;
  private dummy = new THREE.Object3D();
  /** destroços decorativos passando pelas janelas (só visual) */
  private debris: THREE.InstancedMesh;
  private debrisPos: Float32Array;
  private last: { x: number; y: number } | null = null;

  constructor(private center: THREE.Vector3, particles: number) {
    const n = Math.max(120, Math.floor(650 * particles));
    this.base = new Float32Array(n * 3);
    this.starPos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      let y = (Math.random() - 0.5) * 260;
      if (Math.abs(y) < 14) y = Math.sign(y || 1) * (14 + Math.random() * 30);
      this.base.set([(Math.random() - 0.5) * BOX * 2, y - 20, (Math.random() - 0.5) * BOX * 2], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.starPos, 3));
    this.stars = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.8, fog: false }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
    const rock = new THREE.IcosahedronGeometry(1, 1);
    const pos = rock.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const f = 0.78 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.4; pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f); }
    rock.computeVertexNormals();
    this.astMesh = new THREE.InstancedMesh(rock, new THREE.MeshStandardMaterial({ color: '#9a8670', roughness: 0.95, flatShading: true, fog: false, emissive: '#2a1d12', emissiveIntensity: 0.6 }), 90);
    this.astMesh.count = 0;
    this.astMesh.frustumCulled = false;
    this.astMesh.castShadow = false;
    this.group.add(this.astMesh);
    const nd = Math.max(8, Math.floor(26 * particles));
    this.debrisPos = new Float32Array(nd * 4);
    for (let i = 0; i < nd; i++) {
      const side = i % 2 ? 1 : -1;
      this.debrisPos.set([(Math.random() - 0.5) * 300, side * (7 + Math.random() * 30), (Math.random() - 0.5) * 300, 0.5 + Math.random() * 2], i * 4);
    }
    this.debris = new THREE.InstancedMesh(rock, this.astMesh.material as THREE.Material, nd);
    this.debris.frustumCulled = false;
    this.group.add(this.debris);
    // planeta de destino (cresce conforme a nave se aproxima)
    this.dest = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.MeshStandardMaterial({ map: planetTexture('#2fb38a', '#1f6f9a', 14, 7), roughness: 0.8, fog: false, emissive: '#0c3a40', emissiveIntensity: 0.35 }));
    this.group.add(this.dest);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 32, 20), new THREE.MeshBasicMaterial({ color: '#7ff0ff', transparent: true, opacity: 0.18, fog: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.dest.add(atmo);
    // gigante gasoso com anel (paisagem)
    this.giant = new THREE.Group();
    const gp = new THREE.Mesh(new THREE.SphereGeometry(260, 40, 24), new THREE.MeshStandardMaterial({ map: planetTexture('#d98a4b', '#7c3d2a', 22, 3), roughness: 0.9, fog: false, emissive: '#3a1a0a', emissiveIntensity: 0.3 }));
    this.giant.add(gp);
    const ring = new THREE.Mesh(new THREE.RingGeometry(330, 470, 64), new THREE.MeshBasicMaterial({ color: '#f2d3a5', transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false, depthWrite: false }));
    ring.rotation.x = Math.PI / 2.4;
    this.giant.add(ring);
    this.giant.position.set(900, -380, -1700);
    this.group.add(this.giant);
    this.group.position.copy(center);
  }

  /** ship: posição/rumo no setor; speed em u/s */
  update(dt: number, t: number, ship: { x: number; y: number; h: number; v: number; vmax: number }, asts: Map<number, MapAst>, destX: number, destY: number, progress: number): void {
    this.group.position.set(this.center.x, SHIP_FLOOR - 4, this.center.z);
    this.group.rotation.y = ship.h;
    // estrelas: deslocam-se em sentido contrário ao movimento e dão a volta na caixa
    if (!this.last) this.last = { x: ship.x, y: ship.y };
    const mx = (ship.x - this.last.x) * K * 3, my = (ship.y - this.last.y) * K * 3;
    this.last = { x: ship.x, y: ship.y };
    const len = 1 + (ship.v / ship.vmax) * 22;
    const fx = Math.cos(ship.h), fy = Math.sin(ship.h);
    const b = this.base, p = this.starPos;
    for (let i = 0; i < b.length / 3; i++) {
      let x = b[i * 3] - mx, z = b[i * 3 + 2] - my;
      if (x < -BOX) x += BOX * 2; else if (x > BOX) x -= BOX * 2;
      if (z < -BOX) z += BOX * 2; else if (z > BOX) z -= BOX * 2;
      b[i * 3] = x; b[i * 3 + 2] = z;
      const y = b[i * 3 + 1];
      p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
      p[i * 6 + 3] = x + fx * len; p[i * 6 + 4] = y; p[i * 6 + 5] = z + fy * len;
    }
    (this.stars.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const dp = this.debrisPos;
    for (let i = 0; i < dp.length / 4; i++) {
      let x = dp[i * 4] - mx * 0.8, z = dp[i * 4 + 2] - my * 0.8;
      if (x < -150) x += 300; else if (x > 150) x -= 300;
      if (z < -150) z += 300; else if (z > 150) z -= 300;
      dp[i * 4] = x; dp[i * 4 + 2] = z;
      this.dummy.position.set(x, dp[i * 4 + 1], z);
      this.dummy.rotation.set(t * 0.5 + i, t * 0.3 + i * 2, 0);
      this.dummy.scale.setScalar(dp[i * 4 + 3]);
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(i, this.dummy.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    // asteroides (escala do setor)
    let n = 0;
    for (const [id, a] of asts) {
      const dx = a.x - ship.x, dy = a.y - ship.y;
      if (dx * dx + dy * dy > 170 * 170 || n >= 90) continue;
      // escala comprimida (passam perto das janelas); acima ou abaixo do casco
      const yo = (id % 2 ? 1 : -1) * (6 + (id % 5) * 2);
      this.dummy.position.set(dx * AST_K, yo + 4, dy * AST_K);
      this.dummy.rotation.set(t * 0.3 + id, t * 0.2 + id * 0.7, 0);
      this.dummy.scale.setScalar(a.r * 1.5);
      this.dummy.updateMatrix();
      this.astMesh.setMatrixAt(n++, this.dummy.matrix);
    }
    this.astMesh.count = n;
    this.astMesh.instanceMatrix.needsUpdate = true;
    // destino
    const ddx = destX - ship.x, ddy = destY - ship.y;
    const dd = Math.hypot(ddx, ddy) || 1;
    const r = 70 + 650 * progress * progress;
    this.dest.position.set((ddx / dd) * 2100, -160 + progress * 120, (ddy / dd) * 2100);
    this.dest.scale.setScalar(r);
    this.dest.rotation.y += dt * 0.02;
    this.giant.rotation.y += dt * 0.004;
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}

/** emissor de partículas simples (fogo, faíscas, fumaça, vapor) */
export class Emitter {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  active = false;
  constructor(public at: THREE.Vector3, public kind: 'fire' | 'spark' | 'smoke' | 'mist', count: number) {
    const n = Math.max(8, count);
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const col = { fire: '#ff8a3d', spark: '#ffe27a', smoke: '#8a8f9c', mist: '#cfefff' }[kind];
    const size = { fire: 0.32, spark: 0.12, smoke: 0.6, mist: 0.45 }[kind];
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size, transparent: true, opacity: kind === 'smoke' ? 0.45 : 0.9, depthWrite: false, blending: kind === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    for (let i = 0; i < n; i++) { this.life[i] = 0; this.pos[i * 3 + 1] = -999; }
  }

  update(dt: number): void {
    const n = this.life.length;
    let alive = false;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) {
        if (!this.active || Math.random() > dt * (this.kind === 'spark' ? 14 : 8)) { this.pos[i * 3 + 1] = -999; continue; }
        this.life[i] = this.kind === 'spark' ? 0.5 : this.kind === 'smoke' ? 2.2 : 1.0;
        this.pos[i * 3] = this.at.x + (Math.random() - 0.5) * 0.6;
        this.pos[i * 3 + 1] = this.at.y + (Math.random() - 0.5) * 0.3;
        this.pos[i * 3 + 2] = this.at.z + (Math.random() - 0.5) * 0.6;
        const sp = this.kind === 'spark' ? 4 : 0.6;
        this.vel[i * 3] = (Math.random() - 0.5) * sp;
        this.vel[i * 3 + 1] = this.kind === 'spark' ? Math.random() * 3 : 0.8 + Math.random() * 1.4;
        this.vel[i * 3 + 2] = (Math.random() - 0.5) * sp;
      }
      alive = true;
      this.life[i] -= dt;
      if (this.kind === 'spark') this.vel[i * 3 + 1] -= 12 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(SHIP_FLOOR + 0.02, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.points.visible = alive;
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
