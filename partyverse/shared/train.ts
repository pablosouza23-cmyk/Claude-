/**
 * Trem Voador: geometria local (colisão do interior, assentos, portas) e rota
 * de voo determinística. Servidor e clientes calculam a MESMA posição do trem a
 * partir do relógio do servidor => viagem sincronizada para todos.
 *
 * Espaço local: comprimento em X (frente = +X), largura em Z (portas em +Z),
 * piso interno em y = 0.
 */
import type { Collider } from './collision';

export const TRAIN = {
  cars: 3,
  carLen: 13,
  gap: 0.6,
  halfWidth: 2.2, // externo
  innerHalfWidth: 1.95,
  height: 3.3,
  doorHalf: 0.85,
  /** altura do piso do trem em relação aos trilhos/plataforma */
  floorY: 0,
};

/** centro X de cada vagão (0 = cabine/frente) */
export function carCenter(i: number): number {
  const total = TRAIN.cars * TRAIN.carLen + (TRAIN.cars - 1) * TRAIN.gap;
  return total / 2 - TRAIN.carLen / 2 - i * (TRAIN.carLen + TRAIN.gap);
}
export const TRAIN_HALF_LEN = (TRAIN.cars * TRAIN.carLen + (TRAIN.cars - 1) * TRAIN.gap) / 2;

export interface TrainSeat { id: string; x: number; z: number; yaw: number; cockpit?: boolean }
export interface TrainDoor { id: string; x: number }

export function trainDoors(): TrainDoor[] {
  // uma porta por vagão, no lado +Z
  return [0, 1, 2].map((i) => ({ id: `door${i}`, x: carCenter(i) - (i === 0 ? 2.5 : 0) }));
}

export function trainSeats(): TrainSeat[] {
  const seats: TrainSeat[] = [];
  // cabine: 2 assentos de piloto voltados para frente (+X => yaw = PI/2)
  const c0 = carCenter(0);
  seats.push({ id: 'pilot', x: c0 + 4.6, z: -0.8, yaw: Math.PI / 2, cockpit: true });
  seats.push({ id: 'copilot', x: c0 + 4.6, z: 0.8, yaw: Math.PI / 2, cockpit: true });
  // vagão 0 (parte traseira): 4 assentos
  for (let r = 0; r < 2; r++)
    for (const side of [-1, 1]) seats.push({ id: `c0r${r}${side > 0 ? 'b' : 'a'}`, x: c0 - 1.2 - r * 1.6, z: side * 1.25, yaw: Math.PI / 2 });
  // vagões 1 e 2: 8 assentos cada (4 fileiras x 2 lados), corredor central
  for (let car = 1; car < 3; car++) {
    const cc = carCenter(car);
    for (let r = 0; r < 4; r++)
      for (const side of [-1, 1]) {
        if (r === 2 && side > 0) continue; // espaço da porta
        seats.push({ id: `c${car}r${r}${side > 0 ? 'b' : 'a'}`, x: cc + 4.2 - r * 2.2 - (r >= 2 ? 1.6 : 0), z: side * 1.25, yaw: Math.PI / 2 });
      }
  }
  return seats;
}

/** Colisores do interior (espaço local). `doorsOpen` remove as folhas das portas. */
export function trainInteriorColliders(doorsOpen: boolean): Collider[] {
  const out: Collider[] = [];
  const hw = TRAIN.innerHalfWidth;
  const H = TRAIN.height;
  const L = TRAIN_HALF_LEN;
  const t = 0.15;
  // piso
  out.push({ kind: 'box', x: 0, y: -0.25, z: 0, hx: L, hy: 0.25, hz: hw + 0.3 });
  // teto
  out.push({ kind: 'box', x: 0, y: H + 0.25, z: 0, hx: L, hy: 0.25, hz: hw + 0.3 });
  // parede -Z (inteira)
  out.push({ kind: 'box', x: 0, y: H / 2, z: -hw - t, hx: L, hy: H / 2, hz: t });
  // parede +Z com vãos das portas
  const doors = trainDoors().map((d) => d.x).sort((a, b) => a - b);
  let start = -L;
  for (const dx of doors) {
    const a = start, b = dx - TRAIN.doorHalf;
    if (b > a) out.push({ kind: 'box', x: (a + b) / 2, y: H / 2, z: hw + t, hx: (b - a) / 2, hy: H / 2, hz: t });
    out.push({ kind: 'box', x: dx, y: H / 2, z: hw + t, hx: TRAIN.doorHalf, hy: H / 2, hz: t, id: 'doorleaf', disabled: doorsOpen });
    start = dx + TRAIN.doorHalf;
  }
  out.push({ kind: 'box', x: (start + L) / 2, y: H / 2, z: hw + t, hx: (L - start) / 2, hy: H / 2, hz: t });
  // testeiras (frente e traseira)
  out.push({ kind: 'box', x: L + t, y: H / 2, z: 0, hx: t, hy: H / 2, hz: hw + 0.3 });
  out.push({ kind: 'box', x: -L - t, y: H / 2, z: 0, hx: t, hy: H / 2, hz: hw + 0.3 });
  // divisórias entre vagões com passagem (0.8 de meia-largura)
  for (let i = 0; i < TRAIN.cars - 1; i++) {
    const x = (carCenter(i) + carCenter(i + 1)) / 2;
    const side = (hw - 0.8) / 2;
    out.push({ kind: 'box', x, y: H / 2, z: -(0.8 + side), hx: TRAIN.gap / 2 + 0.1, hy: H / 2, hz: side });
    out.push({ kind: 'box', x, y: H / 2, z: 0.8 + side, hx: TRAIN.gap / 2 + 0.1, hy: H / 2, hz: side });
  }
  // console da cabine
  const c0 = carCenter(0);
  out.push({ kind: 'box', x: c0 + 5.9, y: 0.55, z: 0, hx: 0.45, hy: 0.55, hz: 1.7 });
  // assentos (bloqueiam; altura acima do degrau)
  for (const s of trainSeats()) out.push({ kind: 'box', x: s.x - 0.12, y: 0.3, z: s.z, hx: 0.32, hy: 0.3, hz: 0.42 });
  return out;
}

/** Colisores do casco externo (espaço local) usados quando o trem está atracado, com vãos de porta. */
export function trainHullColliders(doorsOpen: boolean): Collider[] {
  const out: Collider[] = [];
  const hw = TRAIN.halfWidth;
  const L = TRAIN_HALF_LEN + 0.6;
  const H = TRAIN.height + 0.6;
  // piso no vão das portas (para quem está entrando pela plataforma)
  out.push({ kind: 'box', x: 0, y: -0.2, z: hw / 2, hx: L, hy: 0.2, hz: hw / 2 + 0.1 });
  out.push({ kind: 'box', x: 0, y: H / 2, z: -hw / 2 - 0.2, hx: L, hy: H / 2, hz: hw / 2 + 0.2 });
  // lado +Z: paredes entre portas (o interior em si é tratado pela plataforma 1)
  const doors = trainDoors().map((d) => d.x).sort((a, b) => a - b);
  let start = -L;
  for (const dx of doors) {
    const a = start, b = dx - TRAIN.doorHalf;
    out.push({ kind: 'box', x: (a + b) / 2, y: H / 2, z: hw / 2, hx: (b - a) / 2, hy: H / 2, hz: hw / 2 });
    out.push({ kind: 'box', x: dx, y: H / 2, z: hw / 2, hx: TRAIN.doorHalf, hy: H / 2, hz: hw / 2, id: 'doorleaf', disabled: doorsOpen });
    start = dx + TRAIN.doorHalf;
  }
  out.push({ kind: 'box', x: (start + L) / 2, y: H / 2, z: hw / 2, hx: (L - start) / 2, hy: H / 2, hz: hw / 2 });
  return out;
}

/** O ponto local (x,z) está dentro do salão do trem? */
export function insideTrain(lx: number, lz: number): boolean {
  return Math.abs(lx) < TRAIN_HALF_LEN - 0.2 && Math.abs(lz) < TRAIN.innerHalfWidth + 0.05;
}

/** Está no vão de alguma porta (lado de fora, perto do batente)? */
export function nearDoor(lx: number, lz: number): boolean {
  if (lz < TRAIN.innerHalfWidth - 0.6 || lz > TRAIN.halfWidth + 1.2) return false;
  return trainDoors().some((d) => Math.abs(lx - d.x) < TRAIN.doorHalf);
}

/* ------------------------------------------------------------------ */
/* Rota de voo                                                          */
/* ------------------------------------------------------------------ */

export interface Pose { x: number; y: number; z: number; yaw: number; pitch: number; roll: number }

export interface TrainSchedule {
  /** estação de partida e chegada (pose do centro do trem com piso na plataforma) */
  from: Pose;
  to: Pose;
  departAt: number; // relógio do servidor (ms)
  arriveAt: number;
  /** fase atual decidida pelo servidor */
  phase: 'boarding' | 'departing' | 'flight' | 'arrived' | 'parked';
  doorsOpen: boolean;
  /** semente do cenário de voo */
  seed: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function bez(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Pose do trem no instante `now` (ms do servidor). Antes da partida: na origem;
 * depois da chegada: no destino. No meio: curva Bézier com subida, cruzeiro e descida.
 */
export function trainPose(s: TrainSchedule, now: number): Pose {
  if (now <= s.departAt) return { ...s.from };
  if (now >= s.arriveAt) return { ...s.to };
  const T = (now - s.departAt) / (s.arriveAt - s.departAt);
  const t = smooth(T);
  const a = s.from, b = s.to;
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const fx = Math.cos(a.yaw), fz = -Math.sin(a.yaw); // frente local +X em mundo
  const tx = Math.cos(b.yaw), tz = -Math.sin(b.yaw);
  const cruise = Math.max(a.y, b.y) + 60 + dist * 0.04;
  const p1 = { x: a.x + fx * dist * 0.45, y: cruise, z: a.z + fz * dist * 0.45 };
  const p2 = { x: b.x - tx * dist * 0.45, y: cruise, z: b.z - tz * dist * 0.45 };
  const x = bez(a.x, p1.x, p2.x, b.x, t);
  const y = bez(a.y, p1.y, p2.y, b.y, t) + Math.sin(T * Math.PI * 6) * 0.6 * Math.sin(T * Math.PI);
  const z = bez(a.z, p1.z, p2.z, b.z, t);
  // direção pela derivada numérica
  const e = 0.002;
  const t2 = smooth(Math.min(1, T + e));
  const x2 = bez(a.x, p1.x, p2.x, b.x, t2), z2 = bez(a.z, p1.z, p2.z, b.z, t2), y2 = bez(a.y, p1.y, p2.y, b.y, t2);
  const hd = Math.hypot(x2 - x, z2 - z);
  let yaw = hd > 1e-5 ? Math.atan2(-(z2 - z), x2 - x) : a.yaw;
  // nas pontas, mistura com o yaw das estações para não girar no lugar
  const edge = Math.min(1, Math.min(T, 1 - T) * 12);
  yaw = lerpAngle(T < 0.5 ? a.yaw : b.yaw, yaw, edge);
  const pitch = hd > 1e-5 ? Math.atan2(y2 - y, hd) * 0.8 * edge : 0;
  const roll = Math.sin(T * Math.PI * 2) * 0.06 * edge;
  return { x, y, z, yaw, pitch, roll };
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Converte ponto local do trem para mundo (ignora pitch/roll — usados apenas no visual). */
export function trainLocalToWorld(p: Pose, lx: number, ly: number, lz: number): [number, number, number] {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [p.x + lx * c + lz * s, p.y + ly, p.z - lx * s + lz * c];
}
export function trainWorldToLocal(p: Pose, wx: number, wy: number, wz: number): [number, number, number] {
  const dx = wx - p.x, dz = wz - p.z;
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [dx * c - dz * s, wy - p.y, dx * s + dz * c];
}

/** Transforma colisores locais (do trem/estação) para o mundo segundo a pose (yaw). */
export function transformColliders(list: Collider[], p: Pose): Collider[] {
  return list.map((c) => {
    if (c.kind === 'box') {
      const [x, y, z] = trainLocalToWorld(p, c.x, c.y, c.z);
      return { ...c, x, y, z, rot: (c.rot ?? 0) + p.yaw };
    }
    const [x, , z] = trainLocalToWorld(p, c.x, 0, c.z);
    return { ...c, x, z, y0: c.y0 + p.y, y1: c.y1 + p.y };
  });
}

/** Plataforma de estação (espaço local do trem atracado): fica do lado +Z (portas). */
export const STATION = { depth: 9, halfLen: TRAIN_HALF_LEN + 4 };

export function stationLocalColliders(floating = true): Collider[] {
  const z0 = TRAIN.halfWidth + 0.05;
  const zc = z0 + STATION.depth / 2;
  if (!floating) return [{ kind: 'box', x: 0, y: -0.4, z: zc, hx: STATION.halfLen, hy: 0.4, hz: STATION.depth / 2 }];
  return [
    // laje da plataforma (topo no nível do piso do trem)
    { kind: 'box', x: 0, y: -0.4, z: zc, hx: STATION.halfLen, hy: 0.4, hz: STATION.depth / 2 },
    // guarda-corpo traseiro e laterais (estações flutuantes)
    { kind: 'box', x: 0, y: 0.6, z: z0 + STATION.depth + 0.15, hx: STATION.halfLen, hy: 0.6, hz: 0.15, noFloor: true },
    { kind: 'box', x: STATION.halfLen + 0.15, y: 0.6, z: zc, hx: 0.15, hy: 0.6, hz: STATION.depth / 2, noFloor: true },
    { kind: 'box', x: -STATION.halfLen - 0.15, y: 0.6, z: zc, hx: 0.15, hy: 0.6, hz: STATION.depth / 2, noFloor: true },
  ];
}

/** Pontos de surgimento na plataforma (local). */
export function stationSpawns(n: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ x: -10 + (i % 5) * 5, z: TRAIN.halfWidth + 3.5 + Math.floor(i / 5) * 2.2 });
  return out;
}

/** Estação de partida (ilha flutuante da Estação PARTYVERSE no mundo da partida). */
export const DEPART_POSE: Pose = { x: -1100, y: 60, z: -420, yaw: 0, pitch: 0, roll: 0 };
