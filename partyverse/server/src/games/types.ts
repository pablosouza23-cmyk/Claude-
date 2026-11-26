import type { Collider } from '../../../shared/collision';
import type { Difficulty, GameId } from '../../../shared/minigames';
import type { Pose } from '../../../shared/train';
import type { MatchWorld } from '../worlds/MatchWorld';
import type { WPlayer } from '../worlds/World';

export interface GameResult {
  win: boolean;
  score: number;
  stars: number; // 0..3
  /** linhas do resumo exibidas na tela de resultados */
  summary: { label: string; value: string }[];
  /** flags para conquistas (ex.: noBreaks) */
  flags: string[];
  /** destaque individual (userId -> título) */
  mvp?: { userId: string; title: string }[];
}

export interface MinigameContext {
  match: MatchWorld;
  difficulty: Difficulty;
  /** nº de jogadores no início da partida */
  players: number;
}

/** Contrato que todo minigame do servidor implementa. */
export interface MinigameServer {
  readonly id: GameId;
  /** colisores estáticos do mapa (mundo) */
  colliders(): Collider[];
  /** pose do trem atracado na estação do mapa */
  arrivalPose(): Pose;
  /** ponto de surgimento ao reiniciar */
  spawn(index: number): { x: number; y: number; z: number; yaw: number };
  /** estado completo (entrada / reconexão) */
  state(): unknown;
  /** delta por snapshot */
  delta(): unknown;
  start(now: number): void;
  tick(dt: number, now: number): void;
  onInteract(p: WPlayer, id: string, arg: unknown): void;
  onAct(p: WPlayer, a: string, d: unknown): void;
  onPlayerLeave(p: WPlayer): void;
  /** multiplicador de velocidade (ex.: carregando algo pesado) */
  speedMul(p: WPlayer): number;
  result(): GameResult | null;
  dispose(): void;
}

/** Fábricas são síncronas: recursos assíncronos (Rapier) são inicializados no boot. */
export type MinigameFactory = (ctx: MinigameContext) => MinigameServer;
