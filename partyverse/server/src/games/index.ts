import type { GameId } from '../../../shared/minigames';
import type { MinigameFactory } from './types';

/** Registro de minigames do servidor. Cada um vive em sua própria pasta. */
export const FACTORIES: Partial<Record<GameId, MinigameFactory>> = {};

/** Inicializa recursos assíncronos (física) antes de aceitar conexões. */
export async function initGames(): Promise<void> {}
