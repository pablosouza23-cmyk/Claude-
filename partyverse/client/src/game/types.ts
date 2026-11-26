import type * as THREE from 'three';
import type { CollisionWorld } from '../../../shared/collision';

export interface Interactable {
  id: string;
  /** posição em mundo */
  pos: THREE.Vector3;
  r: number;
  label: string;
  /** prioridade (maior vence quando há empate de distância) */
  prio?: number;
  /** tecla/ícone mostrado no prompt */
  key?: string;
  use: () => void;
}

/** Botão contextual extra (mobile e PC) fornecido pelo minigame. */
export interface ActionButton {
  id: string;
  label: string;
  key: string;
  onDown: () => void;
  onUp?: () => void;
}

export interface PlatformInfo {
  /** coordenadas locais -> mundo do grupo da plataforma */
  group: THREE.Object3D;
  col: CollisionWorld;
}
