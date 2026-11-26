import type { Difficulty, GameId } from './minigames';
import { planMudanca } from './games/mudanca';

/** Resumo da missão para a UI da sala (muda conforme o nº de jogadores). */
export function planSummary(game: GameId, players: number, diff: Difficulty): string[] {
  switch (game) {
    case 'mudanca': return planMudanca(players, diff).lines;
    default: return ['Em desenvolvimento — disponível em breve.'];
  }
}
