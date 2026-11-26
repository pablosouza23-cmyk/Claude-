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
/* Estação ao norte (z≈-32). Rua ao longo de X (z -14..0). Casas ao sul,  */
/* com a porta voltada para a rua (parede norte). Casa antiga a oeste     */
/* (x=-36), casa nova a leste (x=+36).                                    */
/* ------------------------------------------------------------------ */

export const MUDANCA_ARRIVAL: Pose = { x: 0, y: 0.4, z: -32, yaw: 0, pitch: 0, roll: 0 };
export const FLOOR_H = 3.2;
export const HOUSE_Z = 12;

export interface Room { name: 'sala' | 'quarto' | 'cozinha'; x0: number; x1: number; z0: number; z1: number; floor: number }

export interface HouseDef {
  id: 'old' | 'new';
  x: number; z: number; // centro
  w: number; d: number; // largura (x), profundidade (z)
  floors: 1 | 2;
  /** porta na fachada norte (-z), voltada para a rua */
  doorX: number;
  rooms: Room[];
}

export interface MudancaMap {
  colliders: Collider[];
  houses: HouseDef[];
  /** vaga do caminhão em cada casa */
  parkOld: { x: number; z: number; yaw: number };
  parkNew: { x: number; z: number; yaw: number };
  bounds: { x0: number; x1: number; z0: number; z1: number };
  itemSpots: { x: number; y: number; z: number; floor: number }[];
  spawns: { x: number; z: number }[];
  stairs: { x: number; z0: number; w: number; len: number; height: number }[];
  /** objetos decorativos com colisão (para o cliente desenhar) */
  decor: { kind: 'neighbor' | 'lamp' | 'tree' | 'mailbox' | 'hydrant'; x: number; z: number; rot?: number }[];
}

const WALL = 0.2;
const DOOR_HALF = 1.35;

function houseColliders(h: HouseDef, out: Collider[], stairs: MudancaMap['stairs']): void {
  const { x, z, w, d } = h;
  const H = FLOOR_H * h.floors;
  const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, extra: Partial<Collider> = {}) => out.push({ kind: 'box', x: cx, y: cy, z: cz, hx, hy, hz, ...extra } as Collider);
  const zN = z - d / 2, zS = z + d / 2, xW = x - w / 2, xE = x + w / 2;
  // piso elevado 0.3 (degrau natural)
  box(x, 0.15, z, w / 2, 0.15, d / 2);
  // paredes externas
  box(x, H / 2, zS, w / 2, H / 2, WALL);
  box(xW, H / 2, z, WALL, H / 2, d / 2);
  box(xE, H / 2, z, WALL, H / 2, d / 2);
  const dl = h.doorX - DOOR_HALF, dr = h.doorX + DOOR_HALF;
  box((xW + dl) / 2, H / 2, zN, (dl - xW) / 2, H / 2, WALL);
  box((dr + xE) / 2, H / 2, zN, (xE - dr) / 2, H / 2, WALL);
  box(h.doorX, H - (H - 2.9) / 2, zN, DOOR_HALF, (H - 2.9) / 2, WALL, { noFloor: true });
  // divisória interna (frente / fundos) com vão central de 3.6 m
  const midZ = z - d * 0.1;
  const gap = 1.8;
  box((xW + x - gap) / 2, 0.3 + FLOOR_H / 2, midZ, (x - gap - xW) / 2, FLOOR_H / 2, WALL);
  box((x + gap + xE) / 2, 0.3 + FLOOR_H / 2, midZ, (xE - x - gap) / 2, FLOOR_H / 2, WALL);
  if (h.floors === 2) {
    // escada junto à parede oeste, subindo para o sul (+z)
    const sx = xW + 1.4;
    const z0 = zN + 1.6;
    const steps = 12, len = 6.6;
    const slabTop = 0.3 + FLOOR_H;
    for (let i = 0; i < steps; i++) {
      const top = 0.3 + ((i + 1) / steps) * FLOOR_H;
      const sz = z0 + (i + 0.5) * (len / steps);
      box(sx, top / 2, sz, 1.05, top / 2, len / steps / 2);
    }
    stairs.push({ x: sx, z0, w: 2.1, len, height: FLOOR_H });
    // laje do 2º andar com o vão da escada (x de xW a sx+1.05, z de z0-0.2 a z0+len)
    const holeX1 = sx + 1.1;
    box((holeX1 + xE) / 2, slabTop - 0.15, z, (xE - holeX1) / 2, 0.15, d / 2);
    box((xW + holeX1) / 2, slabTop - 0.15, (z0 + len + zS) / 2, (holeX1 - xW) / 2, 0.15, (zS - (z0 + len)) / 2);
    box((xW + holeX1) / 2, slabTop - 0.15, (zN + z0 - 0.2) / 2, (holeX1 - xW) / 2, 0.15, Math.max(0.1, (z0 - 0.2 - zN) / 2));
    // guarda-corpo ao longo do vão
    box(holeX1 + 0.06, slabTop + 0.55, z0 + len / 2 - 0.6, 0.06, 0.55, len / 2 - 0.6, { noFloor: true });
    // divisória do 2º andar
    box((xW + x - gap) / 2 + 1.2, slabTop + FLOOR_H / 2, z + d * 0.15, (x - gap - xW) / 2 - 1.2, FLOOR_H / 2, WALL);
  }
}

export function buildMudancaMap(plan: Pick<MudancaPlan, 'layout'>): MudancaMap {
  const colliders: Collider[] = [];
  const stairs: MudancaMap['stairs'] = [];
  const two = plan.layout === 'sobrado';
  const oldW = plan.layout === 'compacta' ? 14 : 18;
  const oldD = plan.layout === 'compacta' ? 11 : 14;
  const old: HouseDef = { id: 'old', x: -36, z: HOUSE_Z, w: oldW, d: oldD, floors: two ? 2 : 1, doorX: -36 + 2.5, rooms: [] };
  const nz = HOUSE_Z, nd = 14, mid = nz - nd * 0.1;
  const nw: HouseDef = {
    id: 'new', x: 36, z: nz, w: 18, d: nd, floors: 1, doorX: 36 - 2.5,
    rooms: [
      { name: 'sala', x0: 27, x1: 36, z0: nz - nd / 2, z1: mid, floor: 0 },
      { name: 'cozinha', x0: 36, x1: 45, z0: nz - nd / 2, z1: mid, floor: 0 },
      { name: 'quarto', x0: 27, x1: 45, z0: mid, z1: nz + nd / 2, floor: 0 },
    ],
  };
  houseColliders(old, colliders, stairs);
  houseColliders(nw, colliders, stairs);
  const bounds = { x0: -62, x1: 62, z0: -40, z1: 40 };
  const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, extra: Partial<Collider> = {}) => colliders.push({ kind: 'box', x: cx, y: cy, z: cz, hx, hy, hz, ...extra } as Collider);
  box(0, -0.5, 0, 66, 0.5, 44); // chão
  box(0, 1, bounds.z0 - 0.3, 64, 1.2, 0.3, { noFloor: true });
  box(0, 1, bounds.z1 + 0.3, 64, 1.2, 0.3, { noFloor: true });
  box(bounds.x0 - 0.3, 1, 0, 0.3, 1.2, 42, { noFloor: true });
  box(bounds.x1 + 0.3, 1, 0, 0.3, 1.2, 42, { noFloor: true });
  const decor: MudancaMap['decor'] = [];
  // vizinhos (sólidos)
  for (const [cx, cz] of [[0, 14], [-12, 30], [12, 30], [-52, 30], [52, 30]] as const) { box(cx, 4, cz, 4.5, 4, 4.5); decor.push({ kind: 'neighbor', x: cx, z: cz }); }
  // postes nas duas calçadas
  for (let x = -54; x <= 54; x += 18) {
    colliders.push({ kind: 'cyl', x, z: -16, r: 0.3, y0: 0, y1: 5 }); decor.push({ kind: 'lamp', x, z: -16 });
    colliders.push({ kind: 'cyl', x: x + 9, z: 2.2, r: 0.3, y0: 0, y1: 5 }); decor.push({ kind: 'lamp', x: x + 9, z: 2.2, rot: Math.PI });
  }
  for (const [tx, tz] of [[-56, 10], [-20, 6], [20, 6], [56, 10], [-24, 26], [24, 26], [-44, 32], [44, 32], [0, 34], [-60, -24], [60, -24], [-40, -26], [40, -26]] as const) {
    colliders.push({ kind: 'cyl', x: tx, z: tz, r: 0.5, y0: 0, y1: 6 }); decor.push({ kind: 'tree', x: tx, z: tz });
  }
  for (const h of [old, nw]) { decor.push({ kind: 'mailbox', x: h.doorX + 3.2, z: h.z - h.d / 2 - 2.5 }); colliders.push({ kind: 'cyl', x: h.doorX + 3.2, z: h.z - h.d / 2 - 2.5, r: 0.25, y0: 0, y1: 1.3 }); }
  decor.push({ kind: 'hydrant', x: -4, z: 1.5 }); colliders.push({ kind: 'cyl', x: -4, z: 1.5, r: 0.3, y0: 0, y1: 0.9 });
  // pontos de itens na casa antiga
  const itemSpots: MudancaMap['itemSpots'] = [];
  const cols = plan.layout === 'compacta' ? 4 : 5;
  const xW = old.x - old.w / 2, zN = old.z - old.d / 2;
  for (let fl = 0; fl < old.floors; fl++) {
    const y = 0.3 + fl * FLOOR_H + 0.02;
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
      const ix = xW + 2.2 + c * ((old.w - 4.4) / (cols - 1));
      const iz = zN + 2.4 + r * ((old.d - 4.6) / 2);
      if (Math.abs(ix - old.doorX) < 2.2 && r === 0) continue; // caminho da porta
      if (Math.abs(iz - (old.z - old.d * 0.1)) < 1.2) continue; // divisória
      if (two && ix < xW + 3.4 && iz < zN + 1.6 + 6.8) continue; // escada
      itemSpots.push({ x: ix, y, z: iz, floor: fl });
    }
  }
  return {
    colliders, houses: [old, nw],
    parkOld: { x: old.doorX + 1, z: -5, yaw: Math.PI / 2 },
    parkNew: { x: nw.doorX + 1, z: -5, yaw: Math.PI / 2 },
    bounds, itemSpots, stairs, decor,
    spawns: Array.from({ length: 4 }, (_, i) => ({ x: -6 + i * 4, z: -19 })),
  };
}

/** Caminhão de mudança (cabine Kenney + baú). Espaço local: frente = +z. */
export const TRUCK = {
  hx: 1.9, hz: 3.8,
  /** ponto de carga atrás do baú (local) */
  loadZ: -4.6, loadR: 2.6,
  maxSpeed: 15, reverse: 6, accel: 8, brake: 16, drag: 2.5, turn: 1.7,
};

export interface TruckState { x: number; z: number; yaw: number; speed: number }
export interface TruckInput { throttle: number; steer: number }

/** Física arcade do caminhão (compartilhada: servidor simula, motorista prediz). */
export function stepTruck(s: TruckState, inp: TruckInput, dt: number, col: CollisionLike, grip = 1): void {
  const th = Math.max(-1, Math.min(1, inp.throttle || 0));
  const st = Math.max(-1, Math.min(1, inp.steer || 0));
  if (th > 0) s.speed += (s.speed < 0 ? TRUCK.brake : TRUCK.accel) * th * dt;
  else if (th < 0) s.speed += (s.speed > 0 ? TRUCK.brake : TRUCK.accel * 0.6) * th * dt;
  else s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed), TRUCK.drag * dt);
  s.speed = Math.max(-TRUCK.reverse, Math.min(TRUCK.maxSpeed, s.speed));
  const turnRate = TRUCK.turn * st * Math.max(-1, Math.min(1, s.speed / 4)) * grip;
  s.yaw -= turnRate * dt;
  const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
  s.x += fx * s.speed * dt;
  s.z += fz * s.speed * dt;
  // colisão: 3 círculos ao longo do corpo
  for (let pass = 0; pass < 2; pass++) {
    let hit = false;
    for (const off of [-2.4, 0, 2.4]) {
      const cx = s.x + fx * off, cz = s.z + fz * off;
      const p = col.push(cx, cz, 1.85);
      if (p) { s.x += p[0]; s.z += p[1]; hit = true; }
    }
    if (hit) { s.speed *= -0.25; } else break;
  }
}

export interface CollisionLike { push(x: number, z: number, r: number): [number, number] | null }

export function inRoom(h: HouseDef, x: number, z: number, y: number): Room | null {
  for (const r of h.rooms) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && Math.abs(y - (0.3 + r.floor * FLOOR_H)) < 1.6) return r;
  return null;
}

export function insideHouse(h: HouseDef, x: number, z: number): boolean {
  return x > h.x - h.w / 2 + 0.2 && x < h.x + h.w / 2 - 0.2 && z > h.z - h.d / 2 + 0.2 && z < h.z + h.d / 2 - 0.2;
}
