import * as THREE from 'three';
import type { CollisionWorld } from '../../../shared/collision';
import type { Platform } from '../../../shared/protocol';
import type { App } from '../app/App';
import type { LocalPlayer } from './LocalPlayer';
import type { ActionButton, Interactable } from './types';

/** Um "mundo" visual no cliente (lobby ou partida). */
export abstract class View {
  readonly root = new THREE.Group();
  constructor(protected app: App) {}
  abstract load(progress: (p: number, msg: string) => void): Promise<void>;
  abstract colFor(p: Platform): CollisionWorld;
  parentFor(_p: Platform): THREE.Object3D { return this.root; }
  platYaw(_p: Platform): number { return 0; }
  platformCheck(_lp: LocalPlayer): void {}
  interactables(_lp: LocalPlayer): Interactable[] { return []; }
  actionButtons(): ActionButton[] { return []; }
  cameraWorlds(): { col: CollisionWorld; toLocal?: (v: THREE.Vector3) => THREE.Vector3 }[] { return []; }
  update(_dt: number, _now: number): void {}
  onWorld(_w: unknown): void {}
  onEvent(_e: string, _d: unknown): void {}
  dispose(): void { this.root.removeFromParent(); }
}
