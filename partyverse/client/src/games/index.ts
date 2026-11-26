import type { GameId } from '../../../shared/minigames';
import type { MinigameClientFactory } from './types';

/**
 * Carregamento sob demanda: cada minigame é um chunk separado, baixado só
 * quando a partida começa — os seis mapas nunca ficam na memória ao mesmo tempo.
 */
export const CLIENT_GAMES: Partial<Record<GameId, () => Promise<{ default: MinigameClientFactory }>>> = {};
