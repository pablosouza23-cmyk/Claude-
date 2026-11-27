/**
 * NAVE EM PERIGO — definição compartilhada (mapa da nave, consoles, falhas,
 * papéis e plano da missão). Cliente e servidor usam exatamente os mesmos
 * dados: a colisão das paredes, consoles e caixas nasce daqui.
 *
 * O desenho da nave muda com o número de jogadores (não só a quantidade):
 *  2      → nave pequena: ponte + 1 sala técnica, falhas uma de cada vez.
 *  3–5    → 4 módulos (máquinas, elétrica, carga) e falhas simultâneas ocasionais.
 *  6–7    → 6 módulos (+ escudos e suporte de vida) e tarefas de 2 pessoas
 *           em consoles diferentes ao mesmo tempo.
 *  8–10   → cruzador com dois motores em alas distantes, ala de carga,
 *           comunicações e eventos simultâneos longe um do outro.
 *
 * Espaço: x = leste (proa da nave), z = sul. A estação orbital fica ao norte
 * (z ≈ -32, plataforma do trem em +Z do trem, piso em y = 0.4) e uma
 * passarela leva até a eclusa da nave (z = -14). Piso interno da nave em y = 0.4.
 */
import type { Collider } from '../collision';
import type { Difficulty } from '../minigames';
import type { Pose } from '../train';

export const NAVE_ARRIVAL: Pose = { x: 0, y: 0.4, z: -32, yaw: 0, pitch: 0, roll: 0 };
export const SHIP_FLOOR = 0.4;
export const WALL_H = 2.9;
export const WALL_T = 0.3;
/** fim da plataforma da estação (lado da nave) */
export const STATION_EDGE_Z = -20.75;
export const STATION_HALF_X = 24.1;
/** passarela: da plataforma até a eclusa */
export const WALKWAY = { x0: -1.5, x1: 1.5, z0: STATION_EDGE_Z, z1: -14 };
/** escala: 1 unidade do setor = SECTOR_TO_WORLD metros no cenário 3D */
export const SECTOR_TO_WORLD = 4;
/** raio de colisão da nave no setor */
export const SHIP_R = 6;
/** cada unidade do setor vale 10 mil km na UI */
export const KM_PER_UNIT = 10;

export type ShipLayout = 'pequena' | 'media' | 'grande' | 'cruzador';
export type SystemId = 'motores' | 'escudos' | 'vida' | 'sensores';
export const SYSTEMS: SystemId[] = ['motores', 'escudos', 'vida', 'sensores'];
export const SYSTEM_NAMES: Record<SystemId, string> = { motores: 'Motores', escudos: 'Escudos', vida: 'Suporte de vida', sensores: 'Sensores' };
export const POWER_MAX = 3;
export const POWER_BUDGET = 8;
/** energia perdida enquanto há curto-circuito */
export const SHORT_PENALTY = 3;

/** efeitos por nível de energia (0..3) */
export const POWER_FX = {
  speed: [0.3, 0.62, 0.86, 1.0],
  burn: [0.6, 0.85, 1.0, 1.25],
  shieldMax: [0, 50, 80, 100],
  shieldRegen: [0, 2.2, 3.6, 5],
  o2: [-0.7, 0.25, 0.55, 0.9],
  sensor: [70, 140, 220, 300],
};

export type StationKind = 'helm' | 'nav' | 'engine' | 'power' | 'shield' | 'life' | 'tank' | 'cells';
export type Face = 'n' | 's' | 'e' | 'w';

export interface StationDef {
  id: string;
  kind: StationKind;
  room: string;
  /** centro do console */
  x: number; z: number;
  /** lado em que o operador fica (direção para fora da parede) */
  face: Face;
  /** largura ao longo da parede e profundidade */
  w: number; d: number; h: number;
  label: string;
}

export interface RoomDef { id: string; name: string; x0: number; x1: number; z0: number; z1: number; color: string; corridor?: boolean }
export interface DoorDef { axis: 'x' | 'z'; at: number; from: number; to: number; id?: string }

export interface WallSeg {
  /** colisor da parede */
  c: Extract<Collider, { kind: 'box' }>;
  axis: 'x' | 'z';
  at: number; from: number; to: number;
  /** parede externa (casco) e cômodo do lado de dentro */
  outer: boolean;
  room: string;
  /** lado do cômodo em relação à parede (+1 / -1 no eixo perpendicular) */
  side: 1 | -1;
}

export interface NaveMap {
  layout: ShipLayout;
  rooms: RoomDef[];
  doors: DoorDef[];
  walls: WallSeg[];
  stations: StationDef[];
  crates: { x: number; z: number; s: number; rot: number }[];
  colliders: Collider[];
  spawns: { x: number; z: number }[];
  /** limites da nave (para efeitos e câmera) */
  bounds: { x0: number; x1: number; z0: number; z1: number };
  /** cômodos dos motores (para bocais e chamas externas) */
  engines: { station: string; x: number; z: number; dir: Face }[];
}

export type FailKind = 'fire' | 'engine' | 'short' | 'leak' | 'shield' | 'life' | 'sensors' | 'asteroids';

export interface FailDef {
  name: string;
  station: StationKind;
  /** segundos de trabalho (por etapa) para 1 pessoa sem bônus */
  work: number;
  /** verbo do prompt */
  action: string;
  icon: string;
}

export const FAILS: Record<FailKind, FailDef> = {
  fire: { name: 'Fogo no motor', station: 'engine', work: 4.5, action: 'Apagar o fogo', icon: '🔥' },
  engine: { name: 'Motor avariado', station: 'engine', work: 3, action: 'Consertar motor', icon: '🔧' },
  short: { name: 'Curto-circuito', station: 'power', work: 3.6, action: 'Trocar fusíveis', icon: '⚡' },
  leak: { name: 'Vazamento de combustível', station: 'tank', work: 4, action: 'Vedar vazamento', icon: '🛢️' },
  shield: { name: 'Escudo baixo', station: 'shield', work: 4.5, action: 'Recalibrar escudo', icon: '🛡️' },
  life: { name: 'Falha no suporte de vida', station: 'life', work: 4, action: 'Trocar filtro de O₂', icon: '🫁' },
  sensors: { name: 'Sensores fora do ar', station: 'nav', work: 3.5, action: 'Reiniciar sensores', icon: '📡' },
  asteroids: { name: 'Chuva de asteroides', station: 'helm', work: 0, action: 'Desviar pelo mapa estelar', icon: '☄️' },
};

/** etapas do reparo do motor (a última, nas naves grandes, exige alguém no manche) */
export const ENGINE_STAGES = ['Remover painel queimado', 'Trocar bobina', 'Dar partida no motor'];

export type RoleId = 'piloto' | 'engenheiro' | 'eletricista' | 'abastecedor' | 'medico' | 'artilheiro' | 'navegador';
export type Skill = FailKind | 'helm' | 'cells' | 'power';

export const ROLE_INFO: Record<RoleId, { name: string; color: string; icon: string }> = {
  piloto: { name: 'Piloto', color: '#39d0ff', icon: '🧑‍✈️' },
  engenheiro: { name: 'Engenheiro', color: '#ff8a3d', icon: '🔧' },
  eletricista: { name: 'Eletricista', color: '#ffc93c', icon: '⚡' },
  abastecedor: { name: 'Abastecedor', color: '#2fc97a', icon: '⛽' },
  medico: { name: 'Médico (Suporte de Vida)', color: '#ff4fa3', icon: '🩺' },
  artilheiro: { name: 'Artilheiro de Escudo', color: '#7c5cff', icon: '🛡️' },
  navegador: { name: 'Navegador', color: '#9ad1ff', icon: '📡' },
};

export interface RoleSlot { id: RoleId; skills: Skill[] }

/** Papéis distribuídos automaticamente (times pequenos acumulam especialidades). */
export function rolesFor(n: number): RoleSlot[] {
  const c = Math.max(2, Math.min(10, n));
  if (c === 2) return [
    { id: 'piloto', skills: ['helm', 'sensors', 'life', 'asteroids', 'shield'] },
    { id: 'engenheiro', skills: ['fire', 'engine', 'short', 'leak', 'cells', 'power'] },
  ];
  if (c === 3) return [
    { id: 'piloto', skills: ['helm', 'sensors', 'shield', 'asteroids'] },
    { id: 'engenheiro', skills: ['fire', 'engine', 'leak', 'cells'] },
    { id: 'eletricista', skills: ['short', 'power', 'life'] },
  ];
  const base: RoleSlot[] = [
    { id: 'piloto', skills: ['helm', 'sensors', 'asteroids'] },
    { id: 'engenheiro', skills: ['fire', 'engine'] },
    { id: 'eletricista', skills: ['short', 'power', 'shield'] },
    { id: 'abastecedor', skills: ['leak', 'cells', 'life'] },
  ];
  if (c >= 5) { base[3].skills = ['leak', 'cells']; base.push({ id: 'medico', skills: ['life'] }); }
  if (c >= 6) { base[2].skills = ['short', 'power']; base.push({ id: 'artilheiro', skills: ['shield'] }); }
  const extra: RoleSlot[] = [
    { id: 'engenheiro', skills: ['fire', 'engine'] },
    { id: 'navegador', skills: ['sensors', 'helm', 'asteroids'] },
    { id: 'abastecedor', skills: ['leak', 'cells'] },
    { id: 'eletricista', skills: ['short', 'power'] },
  ];
  for (let i = 0; base.length < c; i++) base.push(extra[i % extra.length]);
  return base;
}

/** bônus de velocidade na interação quando a tarefa é da sua especialidade */
export const ROLE_BONUS = 1.6;

/* ------------------------------------------------------------------ */
/* Plano da missão                                                     */
/* ------------------------------------------------------------------ */

export interface NavePlan {
  layout: ShipLayout;
  /** distância até o destino (unidades do setor) */
  distance: number;
  vmax: number;
  startFuel: number;
  cells: number;
  cellFuel: number;
  /** consumo (% por segundo) a toda velocidade com motores no nível 2 */
  burn: number;
  /** intervalo entre falhas (s) */
  failEvery: [number, number];
  /** tempo para resolver antes de a falha piorar (s) */
  deadline: number;
  maxConcurrent: number;
  /** tarefas de 2 pessoas em consoles diferentes */
  duo: boolean;
  /** eventos simultâneos em alas distantes */
  farEvents: boolean;
  asteroidDensity: number;
  /** intervalo médio entre chuvas de asteroides (s) */
  showerEvery: number;
  hints: boolean;
  workMul: number;
  /** tempo máximo de viagem (s) */
  maxTime: number;
  lines: string[];
}

const LAYOUT_NAMES: Record<ShipLayout, string> = {
  pequena: 'Nave pequena: ponte + sala técnica',
  media: 'Nave média: 4 módulos ligados por um corredor',
  grande: 'Nave grande: 6 módulos (escudos e suporte de vida próprios)',
  cruzador: 'Cruzador: dois motores em alas distantes e ala de carga',
};

export function layoutFor(players: number): ShipLayout {
  const n = Math.max(2, Math.min(10, players));
  return n <= 2 ? 'pequena' : n <= 5 ? 'media' : n <= 7 ? 'grande' : 'cruzador';
}

export function planNave(players: number, diff: Difficulty): NavePlan {
  const n = Math.max(2, Math.min(10, players));
  const layout = layoutFor(n);
  const distance = { pequena: 1300, media: 1650, grande: 1950, cruzador: 2250 }[layout];
  const vmax = 9;
  const burn = 0.5;
  const startFuel = diff === 'facil' ? 75 : diff === 'medio' ? 60 : 42;
  const margin = diff === 'facil' ? 1.6 : diff === 'medio' ? 1.3 : 1.1;
  const cellFuel = 25;
  const need = (distance / vmax) * burn;
  const cells = Math.max(1, Math.ceil((need * margin - startFuel) / cellFuel));
  const failBase: [number, number] = diff === 'facil' ? [26, 36] : diff === 'medio' ? [17, 25] : [11, 17];
  const crowd = layout === 'cruzador' ? 0.75 : layout === 'grande' ? 0.85 : 1;
  const failEvery: [number, number] = [Math.round(failBase[0] * crowd), Math.round(failBase[1] * crowd)];
  const deadline = diff === 'facil' ? 50 : diff === 'medio' ? 36 : 26;
  let maxConcurrent = { pequena: 1, media: 2, grande: 3, cruzador: 4 }[layout];
  if (diff === 'dificil' && layout !== 'pequena') maxConcurrent++;
  const duo = layout === 'grande' || layout === 'cruzador';
  const farEvents = layout === 'cruzador';
  const asteroidDensity = diff === 'facil' ? 0.6 : diff === 'medio' ? 1 : 1.4;
  const showerEvery = diff === 'facil' ? 110 : diff === 'medio' ? 80 : 55;
  const roles = rolesFor(n);
  const roleNames = [...new Set(roles.map((r) => ROLE_INFO[r.id].name.split(' (')[0]))];
  const lines = [
    LAYOUT_NAMES[layout],
    `Papéis: ${roleNames.join(', ')}`,
    `Destino a ${(distance * KM_PER_UNIT).toLocaleString('pt-BR')} mil km • ${cells} células de combustível na carga`,
    layout === 'pequena' ? 'Falhas aparecem uma de cada vez'
      : layout === 'media' ? 'Falhas simultâneas ocasionais em módulos diferentes'
        : layout === 'grande' ? 'Tarefas de 2 pessoas: escudo e partida do motor'
          : 'Eventos simultâneos em alas distantes da nave',
  ];
  if (diff === 'facil') lines.push('Falhas lentas, setas e dicas na tela');
  if (diff === 'dificil') lines.push('Mais falhas e combustível apertado');
  return {
    layout, distance, vmax, startFuel, cells, cellFuel, burn, failEvery, deadline, maxConcurrent, duo, farEvents,
    asteroidDensity, showerEvery, hints: diff === 'facil', workMul: diff === 'facil' ? 1.25 : diff === 'medio' ? 1 : 0.85,
    maxTime: Math.round(distance / vmax * 3.2), lines,
  };
}

/* ------------------------------------------------------------------ */
/* Mapa                                                                 */
/* ------------------------------------------------------------------ */

interface LayoutSpec { rooms: RoomDef[]; doors: DoorDef[]; stations: Omit<StationDef, 'w' | 'd' | 'h' | 'label'>[]; crates: NaveMap['crates'] }

const C = {
  eclusa: '#9aa5b1', corredor: '#7c8bb0', ponte: '#39d0ff', tecnica: '#ff8a3d', maquinas: '#ff8a3d', eletrica: '#ffc93c',
  carga: '#2fc97a', vida: '#ff4fa3', escudos: '#7c5cff', comms: '#9ad1ff',
};

const ECLUSA: RoomDef = { id: 'eclusa', name: 'Eclusa', x0: -2.5, x1: 2.5, z0: -14, z1: -10, color: C.eclusa };
const AIRLOCK_DOOR: DoorDef = { axis: 'x', at: -14, from: -1.5, to: 1.5, id: 'nave-airlock' };
const ECLUSA_IN: DoorDef = { axis: 'x', at: -10, from: -1.5, to: 1.5 };

function spec(layout: ShipLayout): LayoutSpec {
  switch (layout) {
    case 'pequena': return {
      rooms: [
        ECLUSA,
        { id: 'tecnica', name: 'Sala Técnica', x0: -10, x1: 8, z0: -10, z1: 0, color: C.tecnica },
        { id: 'ponte', name: 'Ponte', x0: 8, x1: 16, z0: -9, z1: -1, color: C.ponte },
      ],
      doors: [AIRLOCK_DOOR, ECLUSA_IN, { axis: 'z', at: 8, from: -6.5, to: -3.5 }],
      stations: [
        { id: 'helm', kind: 'helm', room: 'ponte', x: 15, z: -5, face: 'w' },
        { id: 'nav', kind: 'nav', room: 'ponte', x: 11.5, z: -8.55, face: 's' },
        { id: 'engine', kind: 'engine', room: 'tecnica', x: -8.85, z: -5, face: 'e' },
        { id: 'power', kind: 'power', room: 'tecnica', x: -5.5, z: -9.6, face: 's' },
        { id: 'shield', kind: 'shield', room: 'tecnica', x: 5.2, z: -9.15, face: 's' },
        { id: 'tank', kind: 'tank', room: 'tecnica', x: -5.5, z: -0.95, face: 'n' },
        { id: 'life', kind: 'life', room: 'tecnica', x: -0.8, z: -0.55, face: 'n' },
        { id: 'cells', kind: 'cells', room: 'tecnica', x: 4.2, z: -0.55, face: 'n' },
      ],
      crates: [{ x: 7, z: -1, s: 0.9, rot: 0.2 }, { x: -9, z: -1, s: 0.8, rot: 0.5 }],
    };
    case 'media': return {
      rooms: [
        ECLUSA,
        { id: 'corredor', name: 'Corredor', x0: -12, x1: 10, z0: -10, z1: -6, color: C.corredor, corridor: true },
        { id: 'ponte', name: 'Ponte', x0: 10, x1: 18, z0: -13, z1: -3, color: C.ponte },
        { id: 'maquinas', name: 'Sala de Máquinas', x0: -22, x1: -12, z0: -14, z1: -2, color: C.maquinas },
        { id: 'eletrica', name: 'Painel Elétrico', x0: -12, x1: -1, z0: -6, z1: 4, color: C.eletrica },
        { id: 'carga', name: 'Compartimento de Carga', x0: -1, x1: 10, z0: -6, z1: 4, color: C.carga },
      ],
      doors: [
        AIRLOCK_DOOR, ECLUSA_IN,
        { axis: 'z', at: 10, from: -9.5, to: -6.5 },
        { axis: 'z', at: -12, from: -9.5, to: -6.5 },
        { axis: 'x', at: -6, from: -8, to: -5 },
        { axis: 'x', at: -6, from: 3, to: 6 },
      ],
      stations: [
        { id: 'helm', kind: 'helm', room: 'ponte', x: 17, z: -8, face: 'w' },
        { id: 'nav', kind: 'nav', room: 'ponte', x: 13.5, z: -12.55, face: 's' },
        { id: 'engine', kind: 'engine', room: 'maquinas', x: -20.85, z: -8, face: 'e' },
        { id: 'tank', kind: 'tank', room: 'maquinas', x: -17, z: -2.95, face: 'n' },
        { id: 'power', kind: 'power', room: 'eletrica', x: -8.5, z: 3.6, face: 'n' },
        { id: 'life', kind: 'life', room: 'eletrica', x: -3.8, z: 3.45, face: 'n' },
        { id: 'shield', kind: 'shield', room: 'eletrica', x: -11.15, z: -0.5, face: 'e' },
        { id: 'cells', kind: 'cells', room: 'carga', x: 5, z: 3.45, face: 'n' },
      ],
      crates: [{ x: 1, z: 2.6, s: 1, rot: 0.1 }, { x: 8.6, z: -4.4, s: 0.9, rot: 0.6 }, { x: 8.6, z: 2.4, s: 1.1, rot: 0 }, { x: -21, z: -12.6, s: 0.8, rot: 0.3 }],
    };
    case 'grande': return {
      rooms: [
        ECLUSA,
        { id: 'corredor', name: 'Corredor', x0: -20, x1: 12, z0: -10, z1: -6, color: C.corredor, corridor: true },
        { id: 'ponte', name: 'Ponte', x0: 12, x1: 20, z0: -13, z1: -3, color: C.ponte },
        { id: 'maquinas', name: 'Sala de Máquinas', x0: -30, x1: -20, z0: -14, z1: -2, color: C.maquinas },
        { id: 'vida', name: 'Suporte de Vida', x0: -13, x1: -3, z0: -16, z1: -10, color: C.vida },
        { id: 'eletrica', name: 'Painel Elétrico', x0: -20, x1: -9, z0: -6, z1: 4, color: C.eletrica },
        { id: 'escudos', name: 'Escudos', x0: -9, x1: 2, z0: -6, z1: 4, color: C.escudos },
        { id: 'carga', name: 'Compartimento de Carga', x0: 2, x1: 12, z0: -6, z1: 4, color: C.carga },
      ],
      doors: [
        AIRLOCK_DOOR, ECLUSA_IN,
        { axis: 'z', at: 12, from: -9.5, to: -6.5 },
        { axis: 'z', at: -20, from: -9.5, to: -6.5 },
        { axis: 'x', at: -10, from: -9.5, to: -6.5 },
        { axis: 'x', at: -6, from: -16, to: -13 },
        { axis: 'x', at: -6, from: -5, to: -2 },
        { axis: 'x', at: -6, from: 5.5, to: 8.5 },
      ],
      stations: [
        { id: 'helm', kind: 'helm', room: 'ponte', x: 19, z: -8, face: 'w' },
        { id: 'nav', kind: 'nav', room: 'ponte', x: 15.5, z: -12.55, face: 's' },
        { id: 'engine', kind: 'engine', room: 'maquinas', x: -28.85, z: -8, face: 'e' },
        { id: 'tank', kind: 'tank', room: 'maquinas', x: -25, z: -2.95, face: 'n' },
        { id: 'life', kind: 'life', room: 'vida', x: -8, z: -15.55, face: 's' },
        { id: 'power', kind: 'power', room: 'eletrica', x: -14.5, z: 3.6, face: 'n' },
        { id: 'shield', kind: 'shield', room: 'escudos', x: -3.5, z: 3.15, face: 'n' },
        { id: 'cells', kind: 'cells', room: 'carga', x: 7, z: 3.45, face: 'n' },
      ],
      crates: [{ x: 3.4, z: 2.6, s: 1, rot: 0.1 }, { x: 10.6, z: -4.4, s: 0.9, rot: 0.6 }, { x: 10.6, z: 2.4, s: 1.1, rot: 0 }, { x: -29, z: -12.6, s: 0.8, rot: 0.3 }, { x: -12, z: -14.6, s: 0.7, rot: 0.9 }],
    };
    case 'cruzador': return {
      rooms: [
        ECLUSA,
        { id: 'corredor', name: 'Corredor Principal', x0: -24, x1: 12, z0: -10, z1: -6, color: C.corredor, corridor: true },
        { id: 'ponte', name: 'Ponte', x0: 12, x1: 20, z0: -13, z1: -3, color: C.ponte },
        { id: 'motorB', name: 'Motor Bombordo', x0: -34, x1: -24, z0: -14, z1: -2, color: C.maquinas },
        { id: 'vida', name: 'Suporte de Vida', x0: -14, x1: -4, z0: -16, z1: -10, color: C.vida },
        { id: 'comms', name: 'Comunicações', x0: 4, x1: 12, z0: -16, z1: -10, color: C.comms },
        { id: 'eletrica', name: 'Painel Elétrico', x0: -22, x1: -12, z0: -6, z1: 4, color: C.eletrica },
        { id: 'escudos', name: 'Escudos', x0: -12, x1: -2, z0: -6, z1: 4, color: C.escudos },
        { id: 'corredorSul', name: 'Ala de Carga', x0: -2, x1: 2, z0: -6, z1: 16, color: C.corredor, corridor: true },
        { id: 'carga', name: 'Compartimento de Carga', x0: 2, x1: 12, z0: -6, z1: 10, color: C.carga },
        { id: 'motorE', name: 'Motor Estibordo', x0: -6, x1: 6, z0: 16, z1: 24, color: C.maquinas },
      ],
      doors: [
        AIRLOCK_DOOR, ECLUSA_IN,
        { axis: 'z', at: 12, from: -9.5, to: -6.5 },
        { axis: 'z', at: -24, from: -9.5, to: -6.5 },
        { axis: 'x', at: -10, from: -10.5, to: -7.5 },
        { axis: 'x', at: -10, from: 6.5, to: 9.5 },
        { axis: 'x', at: -6, from: -18.5, to: -15.5 },
        { axis: 'x', at: -6, from: -8.5, to: -5.5 },
        { axis: 'x', at: -6, from: -2, to: 2 },
        { axis: 'z', at: 2, from: 1.5, to: 4.5 },
        { axis: 'x', at: 16, from: -2, to: 2 },
      ],
      stations: [
        { id: 'helm', kind: 'helm', room: 'ponte', x: 19, z: -8, face: 'w' },
        { id: 'nav', kind: 'nav', room: 'comms', x: 8, z: -15.55, face: 's' },
        { id: 'engineB', kind: 'engine', room: 'motorB', x: -32.85, z: -8, face: 'e' },
        { id: 'engineE', kind: 'engine', room: 'motorE', x: 0, z: 22.85, face: 'n' },
        { id: 'tank', kind: 'tank', room: 'motorE', x: 5.05, z: 19.5, face: 'w' },
        { id: 'life', kind: 'life', room: 'vida', x: -9, z: -15.55, face: 's' },
        { id: 'power', kind: 'power', room: 'eletrica', x: -17, z: 3.6, face: 'n' },
        { id: 'shield', kind: 'shield', room: 'escudos', x: -7, z: 3.15, face: 'n' },
        { id: 'cells', kind: 'cells', room: 'carga', x: 11.55, z: 2, face: 'w' },
      ],
      crates: [{ x: 4, z: 8.6, s: 1, rot: 0.1 }, { x: 10.6, z: -4.4, s: 0.9, rot: 0.6 }, { x: 10.6, z: 8.4, s: 1.1, rot: 0 }, { x: 6.5, z: 8.7, s: 0.8, rot: 0.4 }, { x: -33, z: -12.6, s: 0.8, rot: 0.3 }, { x: -4.8, z: 17.4, s: 0.8, rot: 0.2 }],
    };
  }
}

const STATION_SIZE: Record<StationKind, { w: number; d: number; h: number; label: string }> = {
  helm: { w: 2.4, d: 1.0, h: 1.05, label: 'Manche' },
  nav: { w: 1.8, d: 0.7, h: 1.1, label: 'Sensores e comunicação' },
  engine: { w: 3.2, d: 2.0, h: 2.3, label: 'Motor' },
  power: { w: 2.2, d: 0.6, h: 2.2, label: 'Painel elétrico' },
  shield: { w: 1.5, d: 1.5, h: 1.2, label: 'Gerador de escudo' },
  life: { w: 1.9, d: 0.8, h: 1.9, label: 'Suporte de vida' },
  tank: { w: 2.6, d: 1.6, h: 1.8, label: 'Tanque de combustível' },
  cells: { w: 2.4, d: 0.8, h: 1.7, label: 'Células de combustível' },
};

export const FACE_VEC: Record<Face, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** colisor (caixa) do console */
export function stationBox(s: StationDef): Extract<Collider, { kind: 'box' }> {
  const alongX = s.face === 'n' || s.face === 's';
  return { kind: 'box', x: s.x, y: SHIP_FLOOR + s.h / 2, z: s.z, hx: alongX ? s.w / 2 : s.d / 2, hy: s.h / 2, hz: alongX ? s.d / 2 : s.w / 2, id: `st:${s.id}` };
}

/** ponto onde o operador fica (na frente do console) */
export function usePoint(s: StationDef): { x: number; z: number; yaw: number } {
  const [fx, fz] = FACE_VEC[s.face];
  const off = s.d / 2 + (s.kind === 'helm' ? 0.85 : 0.75);
  // o operador olha para o console (direção oposta à face)
  return { x: s.x + fx * off, z: s.z + fz * off, yaw: Math.atan2(-fx, -fz) };
}

/** distância máxima para usar um console (servidor) */
export const USE_R = 2.3;

const GRID = 0.5;

export function buildNaveMap(layout: ShipLayout): NaveMap {
  const sp = spec(layout);
  const rooms = sp.rooms;
  const colliders: Collider[] = [];
  const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, extra: Partial<Collider> = {}) => {
    const c = { kind: 'box', x: cx, y: cy, z: cz, hx, hy, hz, ...extra } as Extract<Collider, { kind: 'box' }>;
    colliders.push(c);
    return c;
  };
  // pisos (topo em SHIP_FLOOR)
  for (const r of rooms) box((r.x0 + r.x1) / 2, SHIP_FLOOR / 2 - 0.3, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2 + 0.05, SHIP_FLOOR / 2 + 0.3, (r.z1 - r.z0) / 2 + 0.05);
  // grade de cômodos -> paredes onde cômodos diferentes (ou o espaço) se encontram
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const r of rooms) { bx0 = Math.min(bx0, r.x0); bx1 = Math.max(bx1, r.x1); bz0 = Math.min(bz0, r.z0); bz1 = Math.max(bz1, r.z1); }
  const nx = Math.round((bx1 - bx0) / GRID), nz = Math.round((bz1 - bz0) / GRID);
  const cell = (i: number, j: number): number => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return -1;
    const x = bx0 + (i + 0.5) * GRID, z = bz0 + (j + 0.5) * GRID;
    return rooms.findIndex((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  };
  const grid: number[][] = [];
  for (let i = -1; i <= nx; i++) { grid[i + 1] = []; for (let j = -1; j <= nz; j++) grid[i + 1][j + 1] = cell(i, j); }
  const at = (i: number, j: number) => grid[i + 1][j + 1];
  const inDoor = (axis: 'x' | 'z', line: number, a: number, b: number) => sp.doors.some((d) => d.axis === axis && Math.abs(d.at - line) < 1e-6 && a >= d.from - 1e-6 && b <= d.to + 1e-6);
  const walls: WallSeg[] = [];
  // paredes altas demais para subir: `noFloor` também faz a câmera passar por cima
  // delas (vista de "casa de bonecas" com a câmera acima das paredes)
  const H = WALL_H, yc = SHIP_FLOOR + H / 2;
  // paredes ao longo de X (linhas z constantes)
  for (let j = 0; j <= nz; j++) {
    const z = bz0 + j * GRID;
    let run: { from: number; key: string; outer: boolean; room: number; side: 1 | -1 } | null = null;
    const flush = (endI: number) => {
      if (!run) return;
      const from = run.from, to = bx0 + endI * GRID;
      const c = box((from + to) / 2, yc, z, (to - from) / 2 + WALL_T / 2, H / 2, WALL_T / 2, { noFloor: true });
      walls.push({ c, axis: 'x', at: z, from, to, outer: run.outer, room: rooms[run.room].id, side: run.side });
      run = null;
    };
    for (let i = 0; i < nx; i++) {
      const a = at(i, j - 1), b = at(i, j);
      const x0 = bx0 + i * GRID;
      const wall = a !== b && !inDoor('x', z, x0, x0 + GRID);
      if (!wall) { flush(i); continue; }
      const outer = a === -1 || b === -1;
      const room = b !== -1 ? b : a;
      const side: 1 | -1 = b !== -1 ? 1 : -1;
      const key = `${a}|${b}`;
      if (run && run.key !== key) flush(i);
      if (!run) run = { from: x0, key, outer, room, side };
    }
    flush(nx);
  }
  // paredes ao longo de Z (linhas x constantes)
  for (let i = 0; i <= nx; i++) {
    const x = bx0 + i * GRID;
    let run: { from: number; key: string; outer: boolean; room: number; side: 1 | -1 } | null = null;
    const flush = (endJ: number) => {
      if (!run) return;
      const from = run.from, to = bz0 + endJ * GRID;
      const c = box(x, yc, (from + to) / 2, WALL_T / 2, H / 2, (to - from) / 2 + WALL_T / 2, { noFloor: true });
      walls.push({ c, axis: 'z', at: x, from, to, outer: run.outer, room: rooms[run.room].id, side: run.side });
      run = null;
    };
    for (let j = 0; j < nz; j++) {
      const a = at(i - 1, j), b = at(i, j);
      const z0 = bz0 + j * GRID;
      const wall = a !== b && !inDoor('z', x, z0, z0 + GRID);
      if (!wall) { flush(j); continue; }
      const outer = a === -1 || b === -1;
      const room = b !== -1 ? b : a;
      const side: 1 | -1 = b !== -1 ? 1 : -1;
      const key = `${a}|${b}`;
      if (run && run.key !== key) flush(j);
      if (!run) run = { from: z0, key, outer, room, side };
    }
    flush(nz);
  }
  // porta externa da eclusa (aberta no embarque; fecha na decolagem)
  for (const d of sp.doors) if (d.id) {
    if (d.axis === 'x') box((d.from + d.to) / 2, yc, d.at, (d.to - d.from) / 2, H / 2, WALL_T / 2, { id: d.id, disabled: true });
    else box(d.at, yc, (d.from + d.to) / 2, WALL_T / 2, H / 2, (d.to - d.from) / 2, { id: d.id, disabled: true });
  }
  // consoles
  const stations: StationDef[] = sp.stations.map((s) => ({ ...s, ...STATION_SIZE[s.kind], label: s.kind === 'engine' && layout === 'cruzador' ? (s.id === 'engineB' ? 'Motor Bombordo' : 'Motor Estibordo') : STATION_SIZE[s.kind].label }));
  for (const s of stations) colliders.push(stationBox(s));
  // caixas de carga
  for (const c of sp.crates) colliders.push({ kind: 'box', x: c.x, y: SHIP_FLOOR + 0.45 * c.s, z: c.z, hx: 0.5 * c.s, hy: 0.45 * c.s, hz: 0.5 * c.s, rot: c.rot });
  // passarela + guarda-corpos
  box(0, SHIP_FLOOR - 0.15, (WALKWAY.z0 + WALKWAY.z1) / 2, (WALKWAY.x1 - WALKWAY.x0) / 2 + 0.05, 0.15, (WALKWAY.z1 - WALKWAY.z0) / 2 + 0.05);
  for (const sx of [WALKWAY.x0 - 0.1, WALKWAY.x1 + 0.1]) box(sx, SHIP_FLOOR + 0.6, (WALKWAY.z0 + WALKWAY.z1) / 2, 0.08, 0.6, (WALKWAY.z1 - WALKWAY.z0) / 2, { noFloor: true });
  // guarda-corpos da plataforma (borda voltada para a nave e laterais)
  const ez = STATION_EDGE_Z + 0.12;
  box((-STATION_HALF_X + WALKWAY.x0) / 2, SHIP_FLOOR + 0.6, ez, (WALKWAY.x0 + STATION_HALF_X) / 2, 0.6, 0.1, { noFloor: true });
  box((WALKWAY.x1 + STATION_HALF_X) / 2, SHIP_FLOOR + 0.6, ez, (STATION_HALF_X - WALKWAY.x1) / 2, 0.6, 0.1, { noFloor: true });
  for (const sx of [-STATION_HALF_X - 0.1, STATION_HALF_X + 0.1]) box(sx, SHIP_FLOOR + 0.6, -25.25, 0.1, 0.6, 4.6, { noFloor: true });
  // spawns dentro da nave (perto da eclusa)
  const spawns: NaveMap['spawns'] = [];
  for (let i = 0; i < 10; i++) spawns.push({ x: -3 + (i % 5) * 1.5, z: -8.6 + Math.floor(i / 5) * 1.3 });
  const engines = stations.filter((s) => s.kind === 'engine').map((s) => {
    const r = rooms.find((q) => q.id === s.room)!;
    const dir: Face = s.face === 'e' ? 'w' : s.face === 'w' ? 'e' : s.face === 'n' ? 's' : 'n';
    const x = dir === 'w' ? r.x0 : dir === 'e' ? r.x1 : (r.x0 + r.x1) / 2;
    const z = dir === 'n' ? r.z0 : dir === 's' ? r.z1 : (r.z0 + r.z1) / 2;
    return { station: s.id, x, z, dir };
  });
  return { layout, rooms, doors: sp.doors, walls, stations, crates: sp.crates, colliders, spawns, bounds: { x0: bx0, x1: bx1, z0: bz0, z1: bz1 }, engines };
}

/** cômodo da nave em que o ponto está (ou null) */
export function roomAt(m: NaveMap, x: number, z: number): RoomDef | null {
  for (const r of m.rooms) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r;
  return null;
}

export function insideShip(m: NaveMap, x: number, z: number, y: number): boolean {
  return y > SHIP_FLOOR - 1 && !!roomAt(m, x, z);
}

/** estação que trata cada tipo de falha (para naves com dois motores, ambas) */
export function stationsFor(m: NaveMap, kind: StationKind): StationDef[] {
  return m.stations.filter((s) => s.kind === kind);
}
