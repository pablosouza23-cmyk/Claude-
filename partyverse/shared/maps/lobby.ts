/**
 * Layout do Lobby (Praça PARTYVERSE). Fonte única de verdade para:
 *  - colisores (servidor valida, cliente prediz)
 *  - posicionamento dos objetos visuais (cliente constrói os modelos)
 *  - zonas de interação
 */
import type { Collider } from '../collision';
import type { GameId } from '../minigames';
import { GAME_IDS } from '../minigames';

export type LobbyPropType =
  | 'tree' | 'treeTall' | 'bench' | 'lamp' | 'building' | 'planter' | 'kiosk' | 'fountain'
  | 'station' | 'trainDocked' | 'shop' | 'board' | 'stage' | 'arch' | 'flowerbed' | 'bush' | 'fence'
  | 'balloon' | 'statue' | 'banner' | 'crate' | 'mirror' | 'counter' | 'mannequin';

export interface LobbyProp {
  type: LobbyPropType;
  x: number; y?: number; z: number;
  rot?: number;
  scale?: number;
  model?: string;
  color?: string;
  game?: GameId;
  w?: number; d?: number; h?: number;
}

export interface InteractZone {
  id: string;
  x: number; y: number; z: number;
  r: number;
  label: string;
  kind: 'shop' | 'wardrobe' | 'game' | 'friends' | 'rooms' | 'seat' | 'board';
  game?: GameId;
  /** para assentos: orientação ao sentar */
  yaw?: number;
}

export interface LobbyLayout {
  islandRadius: number;
  spawn: { x: number; z: number; yaw: number; r: number };
  colliders: Collider[];
  props: LobbyProp[];
  zones: InteractZone[];
  /** posição do trem atracado (para o visual e para a área de embarque) */
  train: { x: number; y: number; z: number; rot: number };
}

export function buildLobbyLayout(): LobbyLayout {
  const colliders: Collider[] = [];
  const props: LobbyProp[] = [];
  const zones: InteractZone[] = [];
  const R = 50;

  const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, rot = 0, extra: Partial<Collider> = {}) =>
    colliders.push({ kind: 'box', x, y, z, hx, hy, hz, rot, ...extra } as Collider);
  const cyl = (x: number, z: number, r: number, y0: number, y1: number) => colliders.push({ kind: 'cyl', x, z, r, y0, y1 });

  // ---------------- Borda da ilha: grade (colisão anelar) ----------------
  const segs = 64;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const a2 = ((i + 0.5) / segs) * Math.PI * 2;
    const x = Math.cos(a2) * (R - 0.4), z = Math.sin(a2) * (R - 0.4);
    // colisor tangente
    box(x, 0.8, z, (Math.PI * 2 * R) / segs / 2 + 0.2, 0.8, 0.25, -a2 + Math.PI / 2);
    if (i % 2 === 0) props.push({ type: 'fence', x: Math.cos(a) * (R - 0.4), z: Math.sin(a) * (R - 0.4), rot: -a + Math.PI / 2 });
  }

  // ---------------- Fonte central ----------------
  props.push({ type: 'fountain', x: 0, z: 0 });
  cyl(0, 0, 3.6, 0, 1.1);
  cyl(0, 0, 0.9, 0, 3.2);
  // bancos em anel (sentáveis)
  for (let i = 0; i < 8; i++) {
    if (i === 2 || i === 6) continue; // aberturas para circulação leste/oeste
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 7.2, z = Math.sin(a) * 7.2;
    const rot = -a - Math.PI / 2; // de frente para a fonte
    props.push({ type: 'bench', x, z, rot });
    box(x, 0.25, z, 1.0, 0.25, 0.35, rot);
    // o banco "olha" para fora; o assento fica no lado de fora
    zones.push({ id: `bench-${i}`, x: Math.cos(a) * 7.55, y: 0.5, z: Math.sin(a) * 7.55, r: 1.1, label: 'Sentar', kind: 'seat', yaw: Math.atan2(Math.cos(a), Math.sin(a)) });
  }
  // postes
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * 12, z = Math.sin(a) * 12;
    props.push({ type: 'lamp', x, z });
    cyl(x, z, 0.18, 0, 4.2);
  }
  // canteiros de flores entre os postes
  for (let i = 0; i < 10; i++) {
    const a = ((i + 0.5) / 10) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.95) continue; // não bloquear eixo norte/sul
    const x = Math.cos(a) * 14.5, z = Math.sin(a) * 14.5;
    props.push({ type: 'flowerbed', x, z, rot: -a });
    box(x, 0.3, z, 1.6, 0.3, 0.7, -a + Math.PI / 2);
  }

  // ---------------- Estação do Trem Voador (norte) ----------------
  // plataforma elevada (0.4 m) com degraus naturais (stepHeight 0.45)
  props.push({ type: 'station', x: 0, z: -31 });
  box(0, 0.2, -31.5, 20, 0.2, 5.5);
  // pilares da cobertura
  for (const px of [-16, -8, 8, 16]) cyl(px, -33.5, 0.3, 0.4, 6);
  // borda da plataforma (não cair nos trilhos) — o trem decorativo fica atrás
  box(0, 1.0, -37.3, 20, 0.6, 0.3);
  const train = { x: 0, y: 0.6, z: -40.5, rot: 0 };
  props.push({ type: 'trainDocked', x: train.x, y: train.y, z: train.z, rot: train.rot });
  box(0, 2.5, -40.5, 24, 2.5, 2.2);
  zones.push({ id: 'train-info', x: 0, y: 0.4, z: -35.5, r: 3, label: 'Embarcar (abrir Salas)', kind: 'rooms' });
  zones.push({ id: 'board-departures', x: -12, y: 0.4, z: -27.5, r: 2.2, label: 'Painel de Partidas', kind: 'rooms' });
  props.push({ type: 'board', x: -12, y: 0.4, z: -27.2, rot: 0 });
  box(-12, 1.5, -27.2, 1.6, 1.5, 0.2);

  // ---------------- Boutique (oeste) ----------------
  const sx = -30, sz = 0;
  props.push({ type: 'shop', x: sx, z: sz, rot: 0 });
  // paredes (12 x 12), porta voltada para +x (leste) com 3.4 m de vão
  box(sx, 2.5, sz - 6, 6, 2.5, 0.25); // norte
  box(sx, 2.5, sz + 6, 6, 2.5, 0.25); // sul
  box(sx - 6, 2.5, sz, 0.25, 2.5, 6); // oeste
  box(sx + 6, 2.5, sz - 3.85, 0.25, 2.5, 2.15); // leste (esq. da porta)
  box(sx + 6, 2.5, sz + 3.85, 0.25, 2.5, 2.15); // leste (dir. da porta)
  box(sx + 6, 4.6, sz, 0.25, 0.4, 1.7); // verga da porta
  // interior
  props.push({ type: 'counter', x: sx - 3.5, z: sz - 3.6, rot: 0 });
  box(sx - 3.5, 0.55, sz - 3.6, 1.8, 0.55, 0.5);
  zones.push({ id: 'shop', x: sx - 3.5, y: 0, z: sz - 2.4, r: 1.8, label: 'Comprar na Loja', kind: 'shop' });
  props.push({ type: 'mirror', x: sx - 5.7, z: sz + 2.5, rot: Math.PI / 2 });
  box(sx - 5.7, 1.4, sz + 2.5, 0.15, 1.4, 1.0);
  zones.push({ id: 'wardrobe', x: sx - 4.6, y: 0, z: sz + 2.5, r: 1.7, label: 'Personalizar Visual', kind: 'wardrobe' });
  for (const [mx, mz] of [[-1.5, 4.3], [0.8, 4.3], [-1.5, -4.4]] as const) {
    props.push({ type: 'mannequin', x: sx + mx, z: sz + mz, rot: mz > 0 ? Math.PI : 0 });
    cyl(sx + mx, sz + mz, 0.45, 0, 2);
  }

  // ---------------- Galeria de Experiências (leste) ----------------
  const ids = GAME_IDS;
  for (let i = 0; i < ids.length; i++) {
    const a = (-0.62 + (i / (ids.length - 1)) * 1.24); // arco
    const rr = 27;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const rot = -a - Math.PI / 2; // frente para o centro
    props.push({ type: 'kiosk', x, z, rot, game: ids[i] });
    box(x, 1.4, z, 1.4, 1.4, 0.9, rot);
    zones.push({ id: `game-${ids[i]}`, x: Math.cos(a) * (rr - 2.2), y: 0, z: Math.sin(a) * (rr - 2.2), r: 1.8, label: 'Ver experiência', kind: 'game', game: ids[i] });
  }

  // ---------------- Palco + mural de amigos (sul) ----------------
  props.push({ type: 'arch', x: 0, z: 30 });
  cyl(-5.2, 30, 0.6, 0, 6.5);
  cyl(5.2, 30, 0.6, 0, 6.5);
  props.push({ type: 'board', x: 14, y: 0, z: 24, rot: -Math.PI / 4, color: 'friends' });
  box(14, 1.5, 24, 1.6, 1.5, 0.2, -Math.PI / 4);
  zones.push({ id: 'friends-board', x: 12.6, y: 0, z: 22.6, r: 2, label: 'Mural de Amigos', kind: 'friends' });
  props.push({ type: 'stage', x: -16, z: 24, rot: Math.PI / 4 });
  box(-16, 0.3, 24, 4.5, 0.3, 3, Math.PI / 4);

  // ---------------- Prédios decorativos (perímetro) ----------------
  const buildingModels = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage'];
  const bAngles = [2.35, 2.75, 3.55, 3.95, 0.72, 0.35, 5.95, 5.55, 1.95, 4.35];
  bAngles.forEach((a, i) => {
    const rr = 41;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const rot = -a + Math.PI / 2 + Math.PI;
    const model = buildingModels[i % buildingModels.length];
    props.push({ type: 'building', x, z, rot, model, scale: 9 });
    box(x, 4, z, 4.3, 4, 4.3, rot);
  });

  // ---------------- Árvores e arbustos ----------------
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blocked = (x: number, z: number) => {
    if (Math.hypot(x, z) < 17) return true;
    if (z < -23 && Math.abs(x) < 24) return true; // estação
    if (Math.hypot(x - sx, z - sz) < 10) return true; // loja
    if (x > 18 && Math.abs(z) < 20) return true; // galeria
    if (Math.abs(x) < 7 && z > 15) return true; // caminho sul
    if (Math.hypot(x + 16, z - 24) < 7) return true; // palco
    if (Math.hypot(x - 14, z - 24) < 4) return true; // mural
    for (const a of bAngles) if (Math.hypot(x - Math.cos(a) * 41, z - Math.sin(a) * 41) < 7) return true;
    return false;
  };
  let placed = 0;
  for (let tries = 0; tries < 600 && placed < 46; tries++) {
    const a = rnd() * Math.PI * 2;
    const rr = 19 + rnd() * 27;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (blocked(x, z)) continue;
    const tall = rnd() > 0.5;
    const s = 0.8 + rnd() * 0.5;
    props.push({ type: tall ? 'treeTall' : 'tree', x, z, scale: s, rot: rnd() * 6.28 });
    cyl(x, z, 0.45 * s, 0, 5);
    placed++;
  }
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = 16 + rnd() * 32;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (blocked(x, z) && rr > 17) continue;
    if (Math.hypot(x, z) < 16) continue;
    props.push({ type: 'bush', x, z, scale: 0.7 + rnd() * 0.8, rot: rnd() * 6.28 });
  }
  // balões flutuantes decorativos
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    props.push({ type: 'balloon', x: Math.cos(a) * 22, y: 8 + (i % 3) * 2, z: Math.sin(a) * 22, color: ['#ff4fa3', '#ffc93c', '#39d0ff', '#7bd389'][i % 4] });
  }

  return {
    islandRadius: R,
    spawn: { x: 0, z: 22, yaw: Math.PI, r: 3 },
    colliders,
    props,
    zones,
    train,
  };
}
