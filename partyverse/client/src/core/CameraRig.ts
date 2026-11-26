import * as THREE from 'three';
import { colliderBottom, colliderTop, overlaps2D, type CollisionWorld } from '../../../shared/collision';

/**
 * Câmera em terceira pessoa com órbita, zoom, suavização e colisão contra o
 * cenário (a câmera se aproxima quando há uma parede entre ela e o jogador).
 */
export class CameraRig {
  yaw = Math.PI;
  pitch = 0.32;
  distance = 7.5;
  targetDistance = 7.5;
  minDist = 2.2;
  maxDist = 14;
  readonly target = new THREE.Vector3();
  private smoothTarget = new THREE.Vector3();
  private shake = 0;
  private initialized = false;
  /** colisão (mundo e, opcionalmente, interior do trem em espaço local) */
  worlds: { col: CollisionWorld; toLocal?: (v: THREE.Vector3) => THREE.Vector3 }[] = [];

  constructor(public camera: THREE.PerspectiveCamera) {}

  addShake(a: number): void { this.shake = Math.min(1, this.shake + a); }

  update(dt: number, look: { x: number; y: number; zoom: number }, focus: THREE.Vector3): void {
    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.y, -0.12, 1.25);
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + look.zoom, this.minDist, this.maxDist);
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 8);

    if (!this.initialized) { this.smoothTarget.copy(focus); this.initialized = true; }
    this.smoothTarget.lerp(focus, 1 - Math.exp(-dt * 14));
    this.target.copy(this.smoothTarget);

    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let d = this.distance;
    // colisão: amostra ao longo do raio
    for (let s = 0.6; s <= this.distance; s += 0.35) {
      const p = this.target.clone().addScaledVector(dir, s);
      if (this.blocked(p)) { d = Math.max(0.6, s - 0.35); break; }
    }
    const pos = this.target.clone().addScaledVector(dir, d);
    if (this.shake > 0) {
      pos.x += (Math.random() - 0.5) * this.shake * 0.4;
      pos.y += (Math.random() - 0.5) * this.shake * 0.4;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  snap(focus: THREE.Vector3): void {
    this.smoothTarget.copy(focus);
    this.initialized = true;
  }

  /** direção "para frente" da câmera no plano (para o movimento relativo) */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  private blocked(p: THREE.Vector3): boolean {
    for (const w of this.worlds) {
      const q = w.toLocal ? w.toLocal(p.clone()) : p;
      const set = new Set<never>();
      w.col.query(q.x, q.z, 0.25, set as never);
      for (const c of set as Set<import('../../../shared/collision').Collider>) {
        if (c.kind === 'box' && c.noFloor) continue;
        if (q.y < colliderBottom(c) - 0.1 || q.y > colliderTop(c) + 0.1) continue;
        if (overlaps2D(q.x, q.z, 0.2, c)) return true;
      }
    }
    return false;
  }
}
