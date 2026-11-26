export function xpForLevel(level: number): number {
  // XP necessária para ir de `level` para `level+1`
  return Math.round(120 * Math.pow(level, 1.35));
}

export function levelFromXp(totalXp: number): { level: number; into: number; need: number } {
  let level = 1;
  let xp = totalXp;
  while (xp >= xpForLevel(level) && level < 99) {
    xp -= xpForLevel(level);
    level++;
  }
  return { level, into: xp, need: xpForLevel(level) };
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  coins: number;
  /** cosmético liberado */
  unlock?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-steps', name: 'Bem-vindo!', desc: 'Entre no PARTYVERSE pela primeira vez.', coins: 50 },
  { id: 'social', name: 'Turma Formada', desc: 'Adicione seu primeiro amigo.', coins: 80 },
  { id: 'first-ride', name: 'Passageiro', desc: 'Faça sua primeira viagem no Trem Voador.', coins: 60 },
  { id: 'shopper', name: 'Estiloso', desc: 'Compre seu primeiro item na loja.', coins: 40 },
  { id: 'first-move', name: 'Carregador', desc: 'Conclua uma Mudança Maluca.', coins: 100, unlock: 'hat-helmet' },
  { id: 'first-heist', name: 'Mão Leve', desc: 'Conclua um Roubo Perfeito.', coins: 100 },
  { id: 'first-shop', name: 'Funcionário do Mês', desc: 'Conclua um turno na Loja em Caos.', coins: 100 },
  { id: 'first-hotel', name: 'Hóspede Corajoso', desc: 'Escape do Hotel Estranho.', coins: 100 },
  { id: 'first-workshop', name: 'Graxa nas Mãos', desc: 'Conclua um dia na Oficina Impossível.', coins: 100, unlock: 'top-overall' },
  { id: 'first-space', name: 'Tripulação', desc: 'Sobreviva à Nave em Perigo.', coins: 100 },
  { id: 'no-breaks', name: 'Mãos de Seda', desc: 'Conclua uma mudança sem quebrar nada.', coins: 150 },
  { id: 'hard-mode', name: 'Sem Medo', desc: 'Vença qualquer experiência no Difícil.', coins: 200 },
  { id: 'squad-goals', name: 'Melhores Amigos', desc: 'Vença uma partida com 2 ou mais amigos.', coins: 150, unlock: 'acc-friend-badge' },
  { id: 'full-house', name: 'Casa Cheia', desc: 'Jogue uma partida com 8 ou mais jogadores.', coins: 150 },
  { id: 'level-5', name: 'Veterano', desc: 'Alcance o nível 5.', coins: 200 },
  { id: 'level-10', name: 'Lenda da Festa', desc: 'Alcance o nível 10.', coins: 500 },
];

export const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export interface MatchReward {
  xp: number;
  coins: number;
  friendBonus: boolean;
}

/** Recompensa de partida. `stars` 0..3. Bônus por jogar com amigos (só XP/moedas, nada de vantagem em jogo). */
export function computeReward(win: boolean, stars: number, difficulty: 'facil' | 'medio' | 'dificil', friendsInMatch: number): MatchReward {
  const dm = difficulty === 'facil' ? 1 : difficulty === 'medio' ? 1.25 : 1.6;
  let xp = 60 + stars * 40 + (win ? 60 : 0);
  let coins = 30 + stars * 20 + (win ? 40 : 0);
  xp *= dm; coins *= dm;
  const friendBonus = friendsInMatch > 0;
  if (friendBonus) { xp *= 1.2; coins *= 1.2; }
  return { xp: Math.round(xp), coins: Math.round(coins), friendBonus };
}
