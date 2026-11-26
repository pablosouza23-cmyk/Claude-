export type GameId = 'mudanca' | 'roubo' | 'loja' | 'hotel' | 'oficina' | 'nave';
export type Difficulty = 'facil' | 'medio' | 'dificil';

export interface GameDef {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  min: number;
  max: number;
  color: string;
  accent: string;
  destination: string;
  /** já jogável de ponta a ponta? (a UI mostra "em construção" quando false) */
  playable: boolean;
}

export const GAMES: Record<GameId, GameDef> = {
  mudanca: {
    id: 'mudanca', name: 'Mudança Maluca', tagline: 'Carregue tudo. Não quebre nada.',
    description: 'Equipe de mudanças: leve sofás, geladeiras e caixas até o caminhão, dirija até a casa nova e descarregue antes do tempo acabar. Itens pesados exigem dois carregadores.',
    min: 2, max: 4, color: '#ff8a3d', accent: '#ffc93c', destination: 'Vila Girassol', playable: true,
  },
  roubo: {
    id: 'roubo', name: 'Roubo Perfeito', tagline: 'Entre, pegue, fuja.',
    description: 'Infiltração cooperativa: hackeie câmeras, desative alarmes, abra cofres e fuja de carro antes que os guardas soem o alarme.',
    min: 2, max: 6, color: '#7c5cff', accent: '#39d0ff', destination: 'Distrito Dourado', playable: false,
  },
  loja: {
    id: 'loja', name: 'Loja em Caos', tagline: 'O cliente sempre tem pressa.',
    description: 'Reponha prateleiras, opere os caixas, receba entregas e controle o caos de um supermercado lotado.',
    min: 2, max: 8, color: '#2bb3a3', accent: '#7bd389', destination: 'Mercadão Central', playable: false,
  },
  hotel: {
    id: 'hotel', name: 'Hotel Estranho', tagline: 'Não pegue o elevador sozinho.',
    description: 'Explore um hotel misterioso, encontre chaves e pistas, resolva enigmas e escape das criaturas.',
    min: 2, max: 6, color: '#d7263d', accent: '#ff9f9f', destination: 'Colina Sombria', playable: false,
  },
  oficina: {
    id: 'oficina', name: 'Oficina Impossível', tagline: 'Conserta até disco voador.',
    description: 'Troque pneus, repare motores, abasteça e teste veículos para atender aos pedidos dos clientes.',
    min: 2, max: 6, color: '#ffb400', accent: '#ff6b35', destination: 'Rodovia 77', playable: false,
  },
  nave: {
    id: 'nave', name: 'Nave em Perigo', tagline: 'Houston, temos vários problemas.',
    description: 'Pilote, mantenha energia, combustível e motores funcionando e sobreviva à jornada espacial.',
    min: 2, max: 10, color: '#3a7bd5', accent: '#9ad1ff', destination: 'Órbita Kepler', playable: false,
  },
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];

export const DIFFICULTIES: Record<Difficulty, { name: string; timeMul: number; hints: boolean; desc: string }> = {
  facil: { name: 'Fácil', timeMul: 1.35, hints: true, desc: 'Mais tempo, dicas na tela, menos obstáculos.' },
  medio: { name: 'Médio', timeMul: 1.0, hints: false, desc: 'Tempo equilibrado e mais tarefas.' },
  dificil: { name: 'Difícil', timeMul: 0.78, hints: false, desc: 'Menos tempo, tarefas simultâneas e desafios extras.' },
};

export function isDifficulty(d: unknown): d is Difficulty {
  return d === 'facil' || d === 'medio' || d === 'dificil';
}
export function isGameId(g: unknown): g is GameId {
  return typeof g === 'string' && g in GAMES;
}
