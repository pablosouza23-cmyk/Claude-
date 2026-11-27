import type * as THREE from 'three';
import type { Collider } from '../../../shared/collision';
import type { Difficulty } from '../../../shared/minigames';
import type { Pose } from '../../../shared/train';
import type { App } from '../app/App';
import type { LocalPlayer } from '../game/LocalPlayer';
import type { ActionButton, Interactable } from '../game/types';
import type { SKIES } from '../world/Environment';

export interface MinigameClientCtx {
  app: App;
  difficulty: Difficulty;
  players: number;
}

/** Contrato que todo minigame do cliente implementa. */
export interface MinigameClient {
  readonly sky: keyof typeof SKIES;
  readonly mood: 'work' | 'tense' | 'lobby' | 'flight';
  /** passos curtos de "como jogar" exibidos na chegada (opcional) */
  readonly howTo?: string[];
  build(root: THREE.Group, progress: (p: number) => void): Promise<void>;
  colliders(): Collider[];
  arrivalPose(): Pose;
  applyState(s: unknown): void;
  applyDelta(d: unknown): void;
  update(dt: number, now: number, lp: LocalPlayer): void;
  interactables(lp: LocalPlayer): Interactable[];
  actionButtons(lp: LocalPlayer): ActionButton[];
  /** HUD do minigame (inserido na camada de UI da partida) */
  hud: HTMLElement;
  onEvent(e: string, d: unknown): void;
  /** o jogo começou (após o desembarque) */
  started(): void;
  dispose(): void;
}

export type MinigameClientFactory = (ctx: MinigameClientCtx) => MinigameClient;
