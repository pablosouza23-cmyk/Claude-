import type { GameId } from '../../../shared/minigames';
import { createMudanca, initRapier } from './mudanca/MudancaServer';
import type { MinigameFactory } from './types';

/** Registro de minigames do servidor. Cada um vive em sua própria pasta. */
export const FACTORIES: Partial<Record<GameId, MinigameFactory>> = {
  mudanca: createMudanca,
};

/** Inicializa recursos assíncronos (física) antes de aceitar conexões. */
export async function initGames(): Promise<void> {
  await initRapier();
}
