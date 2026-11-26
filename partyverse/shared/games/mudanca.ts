/**
 * MUDANÇA MALUCA — definição compartilhada (mapa, itens, plano da missão).
 * O desenho da missão muda com o número de jogadores (não apenas "mais itens"):
 *  2 jogadores: casa térrea compacta, 1 viagem, itens pesados só no térreo.
 *  3 jogadores: casa com mais cômodos + itens frágeis, caminhão menor => 2 viagens.
 *  4 jogadores: sobrado (escada) + garagem, piano exige 2 carregadores na escada,
 *               2 viagens e entrega em cômodos específicos da casa nova.
 */
import type { Collider } from '../collision';
import type { Difficulty } from '../minigames';
import type { Pose } from '../train';

export type ItemKind = 'box' | 'boxFragile' | 'lamp' | 'chair' | 'tv' | 'plant' | 'sofa' | 'fridge' | 'bed' | 'piano' | 'table' | 'wardrobe' | 'washer';

export interface ItemDef {
  name: string;
  /** meia-extensão do corpo físico */
  hx: number; hy: number; hz: number;
  mass: number;
  value: number;
  fragile: boolean;
  /** carregadores necessários */
  carriers: 1 | 2;
  /** velocidade ao carregar */
  speed: number;
  /** sala de destino na casa nova */
  room: 'sala' | 'quarto' | 'cozinha' | 'qualquer';
}

export const ITEMS: Record<ItemKind, ItemDef> = {
  box: { name: 'Caixa', hx: 0.35, hy: 0.3, hz: 0.35, mass: 8, value: 40, fragile: false, carriers: 1, speed: 0.92, room: 'qualquer' },
  boxFragile: { name: 'Caixa Frágil', hx: 0.32, hy: 0.28, hz: 0.32, mass: 6, value: 90, fragile: true, carriers: 1, speed: 0.8, room: 'cozinha' },
  lamp: { name: 'Abajur', hx: 0.22, hy: 0.55, hz: 0.22, mass: 4, value: 70, fragile: true, carriers: 1, speed: 0.9, room: 'quarto' },
  chair: { name: 'Cadeira', hx: 0.3, hy: 0.5, hz: 0.3, mass: 7, value: 50, fragile: false, carriers: 1, speed: 0.9, room: 'cozinha' },
  tv: { name: 'TV', hx: 0.55, hy: 0.38, hz: 0.12, mass: 12, value: 160, fragile: true, carriers: 1, speed: 0.75, room: 'sala' },
  plant: { name: 'Vaso de Planta', hx: 0.28, hy: 0.5, hz: 0.28, mass: 9, value: 60, fragile: true, carriers: 1, speed: 0.85, room: 'sala' },
  table: { name: 'Mesa', hx: 0.8, hy: 0.4, hz: 0.5, mass: 25, value: 120, fragile: false, carriers: 2, speed: 0.62, room: 'cozinha' },
  sofa: { name: 'Sofá', hx: 1.1, hy: 0.45, hz: 0.48, mass: 45, value: 220, fragile: false, carriers: 2, speed: 0.55, room: 'sala' },
  fridge: { name: 'Geladeira', hx: 0.45, hy: 0.9, hz: 0.42, mass: 60, value: 260, fragile: false, carriers: 2, speed: 0.5, room: 'cozinha' },
  bed: { name: 'Cama', hx: 1.0, hy: 0.35, hz: 0.75, mass: 40, value: 200, fragile: false, carriers: 2, speed: 0.55, room: 'quarto' },
  wardrobe: { name: 'Guarda-roupa', hx: 0.7, hy: 1.0, hz: 0.35, mass: 55, value: 240, fragile: false, carriers: 2, speed: 0.5, room: 'quarto' },
  washer: { name: 'Máquina de Lavar', hx: 0.4, hy: 0.45, hz: 0.4, mass: 50, value: 210, fragile: false, carriers: 2, speed: 0.5, room: 'cozinha' },
  piano: { name: 'Piano', hx: 0.85, hy: 0.65, hz: 0.38, mass: 90, value: 400, fragile: true, carriers: 2, speed: 0.42, room: 'sala' },
};

export interface MudancaPlan {
  layout: 'compacta' | 'familia' | 'sobrado';
  items: ItemKind[];
  timeSec: number;
  /** % do valor total necessário para vencer */
  quota: number;
  truckCapacity: number;
  /** quebra: velocidade de impacto que danifica itens frágeis */
  breakSpeed: number;
  /** cômodos específicos exigidos na casa nova? */
  roomsMatter: boolean;
  hints: boolean;
  /** evento extra do difícil: chuva => piso escorregadio na rua */
  rain: boolean;
  lines: string[];
}

export function planMudanca(players: number, diff: Difficulty): MudancaPlan {
  const n = Math.max(2, Math.min(4, players));
  const dm = diff === 'facil' ? 1.35 : diff === 'medio' ? 1 : 0.78;
  let items: ItemKind[];
  let layout: MudancaPlan['layout'];
  let cap: number;
  if (n === 2) {
    layout = 'compacta';
    items = ['box', 'box', 'box', 'boxFragile', 'lamp', 'chair', 'chair', 'tv', 'plant', 'sofa', 'table'];
    cap = 12;
  } else if (n === 3) {
    layout = 'familia';
    items = ['box', 'box', 'box', 'box', 'boxFragile', 'boxFragile', 'lamp', 'chair', 'chair', 'tv', 'plant', 'plant', 'sofa', 'fridge', 'bed', 'table'];
    cap = 9;
  } else {
    layout = 'sobrado';
    items = ['box', 'box', 'box', 'box', 'box', 'boxFragile', 'boxFragile', 'boxFragile', 'lamp', 'lamp', 'chair', 'chair', 'chair', 'tv', 'plant', 'plant', 'sofa', 'fridge', 'bed', 'wardrobe', 'washer', 'piano'];
    cap = 12;
  }
  if (diff === 'dificil') items.push('boxFragile', 'tv');
  if (diff === 'facil') items = items.filter((_, i) => i !== items.length - 1 || n === 2);
  const baseTime = n === 2 ? 300 : n === 3 ? 360 : 420;
  const timeSec = Math.round(baseTime * dm);
  const quota = diff === 'facil' ? 0.55 : diff === 'medio' ? 0.7 : 0.82;
  const breakSpeed = diff === 'facil' ? 7.5 : diff === 'medio' ? 6 : 4.8;
  const roomsMatter = n >= 3 && diff !== 'facil';
  const lines = [
    `Casa ${layout === 'compacta' ? 'térrea compacta' : layout === 'familia' ? 'familiar com 5 cômodos' : 'sobrado de 2 andares'}`,
    `${items.length} itens (${items.filter((k) => ITEMS[k].carriers === 2).length} exigem 2 pessoas)`,
    `Caminhão leva ${cap} itens por viagem${items.length > cap ? ' — serão 2 viagens' : ''}`,
    roomsMatter ? 'Entregue cada item no cômodo certo (bônus)' : 'Entregue em qualquer cômodo da casa nova',
    `Meta: ${Math.round(quota * 100)}% do valor em ${Math.floor(timeSec / 60)}:${String(timeSec % 60).padStart(2, '0')}`,
  ];
  if (diff === 'dificil') lines.push('Chuva: rua escorregadia e itens frágeis extras');
  if (diff === 'facil') lines.push('Setas indicam o próximo item');
  return { layout, items, timeSec, quota, truckCapacity: cap, breakSpeed, roomsMatter, hints: diff === 'facil', rain: diff === 'dificil', lines };
}

/* ------------------------------------------------------------------ */
/* Mapa: Vila Girassol                                                   */
/* Rua ao longo de X. Casa antiga a oeste (x≈-34), casa nova a leste      */
/* (x≈+34). A estação do trem fica ao norte (z≈-30).                      */
/* ------------------------------------------------------------------ */

export const MUDANCA_ARRIVAL: Pose = { x: 0, y: 0.4, z: -32, yaw: 0, pitch: 0, roll: 0 };

export interface Room { name: 'sala' | 'quarto' | 'cozinha'; x0: number; x1: number; z0: number; z1: number; floor: number }

export interface HouseDef {
  id: 'old' | 'new';
  x: number; z: number; // centro
  w: number; d: number; // largura (x), profundidade (z)
  floors: 1 | 2;
  /** porta na fachada sul (+z) */
  doorX: number;
  rooms: Room[];
}

export interface MudancaMap {
  colliders: Collider[];
  houses: HouseDef[];
  /** área de estacionamento do caminhão em cada casa (centro, yaw) */
  parkOld: { x: number; z: number; yaw: number };
  parkNew: { x: number; z: number; yaw: number };
  /** limites da vila */
  bounds: { x0: number; x1: number; z0: number; z1: number };
  /** pontos de surgimento dos itens (dentro da casa antiga) */
  itemSpots: { x: number; y: number; z: number; floor: number }[];
  spawns: { x: number; z: number }[];
  stairs: { x: number; z: number; w: number; len: number; height: number; dir: 1 | -1 }[];
}

const WALL = 0.2;
const FLOOR_H = 3.2;

function houseColliders(h: HouseDef, out: Collider[], stairs: MudancaMap['stairs']): void {
  const { x, z, w, d } = h;
  const H = FLOOR_H * h.floors;
  const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, extra: Partial<Collider> = {}) => out.push({ kind: 'box', x: cx, y: cy, z: cz, hx, hy, hz, ...extra } as Collider);
  // piso (degrau de 0.3 na entrada)
  box(x, 0.15, z, w / 2, 0.15, d / 2);
  // paredes externas
  box(x, H / 2, z - d / 2, w / 2, H / 2, WALL); // norte (fundos)
  box(x - w / 2, H / 2, z, WALL, H / 2, d / 2); // oeste
  box(x + w / 2, H / 2, z, WALL, H / 2, d / 2); // leste
  // sul com porta larga (2.6 m) para passar sofás
  const dl = h.doorX - 1.3, dr = h.doorX + 1.3;
  box((x - w / 2 + dl) / 2, H / 2, z + d / 2, (dl - (x - w / 2)) / 2, H / 2, WALL);
  box((dr + x + w / 2) / 2, H / 2, z + d / 2, (x + w / 2 - dr) / 2, H / 2, WALL);
  box(h.doorX, H - (H - 2.8) / 2, z + d / 2, 1.3, (H - 2.8) / 2, WALL, { noFloor: true });
  // divisória interna (corredor central) com vãos
  const midZ = z - d * 0.1;
  box(x - w / 4 - 0.9, FLOOR_H / 2 + 0.3, midZ, w / 4 - 0.9, FLOOR_H / 2, WALL);
  box(x + w / 4 + 0.9, FLOOR_H / 2 + 0.3, midZ, w / 4 - 0.9, FLOOR_H / 2, WALL);
  if (h.floors === 2) {
    // laje do 2º andar com vão da escada
    const sx = x - w / 2 + 2.2;
    const holeX0 = sx - 1.1, holeX1 = sx + 1.1;
    const slabTop = FLOOR_H + 0.3;
    box((holeX1 + x + w / 2) / 2, slabTop - 0.15, z, (x + w / 2 - holeX1) / 2, 0.15, d / 2);
    box((x - w / 2 + holeX0) / 2, slabTop - 0.15, z, Math.max(0.05, (holeX0 - (x - w / 2)) / 2), 0.15, d / 2);
    box(sx, slabTop - 0.15, z + d / 2 - 2.6, 1.1, 0.15, 2.6 - 0.05);
    // escada: degraus de 0.3 subindo para -z
    const steps = 11;
    const len = 6.0;
    for (let i = 0; i < steps; i++) {
      const top = 0.3 + ((i + 1) / steps) * FLOOR_H;
      const sz = z + d / 2 - 2.6 - 0.3 - (i + 0.5) * (len / steps);
      box(sx, top / 2, sz, 1.0, top / 2, len / steps / 2);
    }
    stairs.push({ x: sx, z: z + d / 2 - 2.9, w: 2.0, len, height: FLOOR_H, dir: -1 });
    // corrimão do vão
    box(sx + 1.15, slabTop + 0.5, z - 0.5, 0.06, 0.5, d / 2 - 3.2, { noFloor: true });
  }
}

export function buildMudancaMap(plan: Pick<MudancaPlan, 'layout'>): MudancaMap {
  const colliders: Collider[] = [];
  const stairs: MudancaMap['stairs'] = [];
  const two = plan.layout === 'sobrado';
  const oldW = plan.layout === 'compacta' ? 14 : 18;
  const oldD = plan.layout === 'compacta' ? 11 : 14;
  const old: HouseDef = {
    id: 'old', x: -36, z: 10, w: oldW, d: oldD, floors: two ? 2 : 1, doorX: -36 + 2,
    rooms: [],
  };
  const nw: HouseDef = {
    id: 'new', x: 36, z: 10, w: 18, d: 14, floors: 1, doorX: 36 - 2,
    rooms: [
      { name: 'sala', x0: 27, x1: 36, z0: 10 - 1.4, z1: 17, floor: 0 },
      { name: 'cozinha', x0: 36, x1: 45, z0: 10 - 1.4, z1: 17, floor: 0 },
      { name: 'quarto', x0: 27, x1: 45, z0: 3, z1: 10 - 1.4, floor: 0 },
    ],
  };
  houseColliders(old, colliders, stairs);
  houseColliders(nw, colliders, stairs);
  // ---------------- vila: limites, calçadas, cercas, árvores ----------------
  const bounds = { x0: -62, x1: 62, z0: -40, z1: 44 };
  const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, extra: Partial<Collider> = {}) => colliders.push({ kind: 'box', x: cx, y: cy, z: cz, hx, hy, hz, ...extra } as Collider);
  box(0, -0.5, 0, 64, 0.5, 46); // chão
  box(0, 1, bounds.z0 - 0.3, 64, 1.2, 0.3, { noFloor: true });
  box(0, 1, bounds.z1 + 0.3, 64, 1.2, 0.3, { noFloor: true });
  box(bounds.x0 - 0.3, 1, 0, 0.3, 1.2, 46, { noFloor: true });
  box(bounds.x1 + 0.3, 1, 0, 0.3, 1.2, 46, { noFloor: true });
  // cercas dos quintais (deixam o portão aberto)
  for (const hx of [-36, 36]) {
    box(hx - 12, 0.6, 26, 0.12, 0.6, 7, { noFloor: true });
    box(hx + 12, 0.6, 26, 0.12, 0.6, 7, { noFloor: true });
  }
  // casas vizinhas decorativas (sólidas)
  for (const [cx, cz] of [[0, 18], [-36, 38], [36, 38], [0, 38]] as const) box(cx, 3.5, cz, 6, 3.5, 5);
  // postes / árvores da rua
  for (let x = -54; x <= 54; x += 18) { colliders.push({ kind: 'cyl', x, z: -6.5, r: 0.35, y0: 0, y1: 5 }); }
  // pontos de itens na casa antiga
  const itemSpots: MudancaMap['itemSpots'] = [];
  const cols = plan.layout === 'compacta' ? 4 : 5;
  for (let fl = 0; fl < old.floors; fl++) {
    const y = 0.3 + fl * FLOOR_H + 0.05;
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
      const ix = old.x - old.w / 2 + 2.4 + c * ((old.w - 4.8) / (cols - 1));
      const iz = old.z - old.d / 2 + 2.0 + r * ((old.d - 4.5) / 2);
      if (fl === 0 && Math.abs(ix - old.doorX) < 2 && r === 2) continue;
      if (two && Math.abs(ix - (old.x - old.w / 2 + 2.2)) < 1.6) continue; // escada
      itemSpots.push({ x: ix, y, z: iz, floor: fl });
    }
  }
  return {
    colliders,
    houses: [old, nw],
    parkOld: { x: old.doorX, z: 25, yaw: Math.PI / 2 },
    parkNew: { x: nw.doorX, z: 25, yaw: Math.PI / 2 },
    bounds,
    itemSpots,
    spawns: Array.from({ length: 4 }, (_, i) => ({ x: -6 + i * 4, z: -18 })),
    stairs,
  };
}

export const TRUCK = {
  /** dimensões do corpo (para colisão) */
  hx: 1.5, hz: 3.4,
  /** caçamba (espaço local: frente = +z) */
  bedZ0: -3.1, bedZ1: 0.2, bedHalfW: 1.25, bedY: 1.0,
  maxSpeed: 14, accel: 7, brake: 12, turn: 1.6,
};

export function inRoom(h: HouseDef, x: number, z: number, y: number): Room | null {
  for (const r of h.rooms) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && Math.abs(y - (0.3 + r.floor * FLOOR_H)) < 1.6) return r;
  return null;
}

export function insideHouse(h: HouseDef, x: number, z: number): boolean {
  return x > h.x - h.w / 2 + 0.2 && x < h.x + h.w / 2 - 0.2 && z > h.z - h.d / 2 + 0.2 && z < h.z + h.d / 2 - 0.2;
}
