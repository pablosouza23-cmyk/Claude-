/**
 * NAVE EM PERIGO — modelo 3D procedural da nave, construído a partir dos MESMOS
 * dados de shared/games/nave.ts (paredes, consoles e caixas têm o tamanho exato
 * dos colisores). Inclui consoles com telas em canvas, luzes por módulo
 * (que ficam vermelhas no alarme), janelas para o espaço e o casco externo.
 */
import * as THREE from 'three';
import {
  FACE_VEC, SHIP_FLOOR, STATION_EDGE_Z, STATION_HALF_X, WALKWAY, WALL_H, WALL_T, usePoint,
  type NaveMap, type RoomDef, type StationDef, type WallSeg,
} from '../../../../shared/games/nave';
import { canvasTexture, mat, mesh, rbox } from '../../core/Assets';
import { place, signPlane, signTexture } from '../../world/props';

export interface Screen { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; w: number; h: number }

export interface ConsoleParts {
  st: StationDef;
  group: THREE.Group;
  screen: Screen;
  beacon: THREE.MeshStandardMaterial;
  /** ponto de efeitos (fogo, faíscas, fumaça) em mundo */
  fxAt: THREE.Vector3;
  /** partes animadas por tipo */
  spin: THREE.Object3D[];
  glow: THREE.MeshStandardMaterial | null;
  stick?: THREE.Object3D;
  lever?: THREE.Object3D;
  cells?: THREE.Object3D[];
  orb?: THREE.Mesh;
  flames?: THREE.Group;
}

export interface ShipParts {
  root: THREE.Group;
  roofs: THREE.Object3D[];
  consoles: Map<string, ConsoleParts>;
  roomMats: Map<string, { mat: THREE.MeshStandardMaterial; base: THREE.Color }>;
  airlockDoor: THREE.Object3D;
  /** passarela + estruturas da estação (afastam-se na decolagem) */
  dock: THREE.Group;
  nozzles: { flame: THREE.Mesh; glow: THREE.MeshStandardMaterial }[];
  arrows: Map<string, THREE.Object3D>;
}

const HULL = '#d9dee8';
const DARK = '#262b3a';

function makeScreen(w: number, h: number): Screen {
  const tex = canvasTexture(w, h, (c) => { c.fillStyle = '#071022'; c.fillRect(0, 0, w, h); });
  const ctx = (tex.image as HTMLCanvasElement).getContext('2d')!;
  return { tex, ctx, w, h };
}

function screenMat(s: Screen): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false });
}

let wallTex: THREE.CanvasTexture | null = null;
const wallTexCache = new Map<string, THREE.Texture>();
function wallTexture(repeat: number): THREE.Texture {
  if (!wallTex) {
    wallTex = canvasTexture(256, 256, (c) => {
      c.fillStyle = '#c9d1df'; c.fillRect(0, 0, 256, 256);
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#8f99ad'; c.fillRect(0, 200, 256, 56); // rodapé
      c.fillStyle = '#7a8499'; c.fillRect(0, 198, 256, 3);
      c.strokeStyle = 'rgba(40,50,70,0.35)'; c.lineWidth = 2;
      c.strokeRect(6, 8, 120, 184); c.strokeRect(134, 8, 116, 184);
      c.fillStyle = 'rgba(40,50,70,0.4)';
      for (const [x, y] of [[14, 16], [118, 16], [14, 184], [118, 184], [142, 16], [242, 16], [142, 184], [242, 184]]) { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(20, 90, 90, 4); c.fillRect(150, 60, 80, 4);
      // grade de ventilação
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(30,36,52,0.5)'; c.fillRect(160, 120 + i * 8, 70, 4); }
    });
    wallTex.wrapS = THREE.RepeatWrapping;
  }
  const k = String(Math.max(1, Math.round(repeat)));
  let t = wallTexCache.get(k);
  if (!t) { t = wallTex.clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(Number(k), 1); t.needsUpdate = true; wallTexCache.set(k, t); }
  return t;
}

function floorTexture(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#3a4256'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const g = c.createLinearGradient(x * 128, y * 128, x * 128 + 128, y * 128 + 128);
      g.addColorStop(0, '#464f66'); g.addColorStop(1, '#353d51');
      c.fillStyle = g; c.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    }
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 2; i++) { c.fillRect(0, i * 128, 256, 3); c.fillRect(i * 128, 0, 3, 256); }
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) c.fillRect(10 + ((i * 37) % 230), 10 + ((i * 71) % 230), 6, 2);
    c.fillStyle = 'rgba(20,24,34,0.6)';
    for (const [x, y] of [[10, 10], [118, 10], [10, 118], [118, 118], [138, 138], [246, 138], [138, 246], [246, 246]]) { c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildShip(map: NaveMap, particles: number): ShipParts {
  const root = new THREE.Group();
  const roofs: THREE.Object3D[] = [];
  const consoles = new Map<string, ConsoleParts>();
  const roomMats = new Map<string, { mat: THREE.MeshStandardMaterial; base: THREE.Color }>();
  const arrows = new Map<string, THREE.Object3D>();
  void particles;
  const rooms = new Map(map.rooms.map((r) => [r.id, r]));
  for (const r of map.rooms) {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: r.color, emissiveIntensity: 1.6, roughness: 0.4 });
    roomMats.set(r.id, { mat: m, base: new THREE.Color(r.color) });
  }
  const hullM = new THREE.MeshPhysicalMaterial({ color: HULL, roughness: 0.35, metalness: 0.45, clearcoat: 0.5 });
  const darkM = mat(DARK, 0.5, 0.5);
  const outerWallM = new THREE.MeshStandardMaterial({ color: '#b9c2d3', roughness: 0.55, metalness: 0.3 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#4a7bd0', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, emissive: '#0b1d44', emissiveIntensity: 0.4 });
  const frameM = mat('#5b6478', 0.4, 0.6);

  /* ---------------- pisos e casco inferior ---------------- */
  const ftex = floorTexture();
  for (const r of map.rooms) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const t = ftex.clone(); t.needsUpdate = true; t.repeat.set(w / 2.5, d / 2.5);
    const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.35, color: r.corridor ? '#cfd6e6' : '#ffffff' });
    const fl = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 1.0, d + 0.1), [hullM, hullM, top, darkM, hullM, hullM]);
    fl.position.set((r.x0 + r.x1) / 2, SHIP_FLOOR - 0.5, (r.z0 + r.z1) / 2);
    fl.receiveShadow = true;
    root.add(fl);
    // faixas de luz no piso (contorno do módulo, cor do módulo)
    const rm = roomMats.get(r.id)!.mat;
    const inset = 0.45;
    const sx0 = r.x0 + inset, sx1 = r.x1 - inset, sz0 = r.z0 + inset, sz1 = r.z1 - inset;
    for (const z of [sz0, sz1]) root.add(place(mesh(new THREE.BoxGeometry(sx1 - sx0, 0.03, 0.08), rm, false), (sx0 + sx1) / 2, SHIP_FLOOR + 0.015, z));
    for (const x of [sx0, sx1]) root.add(place(mesh(new THREE.BoxGeometry(0.08, 0.03, sz1 - sz0), rm, false), x, SHIP_FLOOR + 0.015, (sz0 + sz1) / 2));
    // nome do módulo pintado no piso
    if (r.id !== 'eclusa' && !r.corridor) {
      const label = signPlane(signTexture(r.name.toUpperCase(), { w: 1024, h: 192, bg: 'rgba(0,0,0,0)', fg: r.color }), Math.min(w - 1.5, 7), Math.min(w - 1.5, 7) * 0.19, 0.6);
      label.rotation.x = -Math.PI / 2;
      label.position.set((r.x0 + r.x1) / 2, SHIP_FLOOR + 0.02, (r.z0 + r.z1) / 2 + (r.z1 - r.z0) * 0.12);
      (label.material as THREE.MeshStandardMaterial).opacity = 0.75;
      (label.material as THREE.MeshStandardMaterial).depthWrite = false;
      root.add(label);
    }
    // teto/casco superior (escondido quando o jogador está dentro)
    const roof = mesh(rbox(w + 0.3, 0.3, d + 0.3, 0.12), hullM);
    roof.position.set((r.x0 + r.x1) / 2, SHIP_FLOOR + WALL_H + 0.15, (r.z0 + r.z1) / 2);
    root.add(roof);
    roofs.push(roof);
    const stripe = mesh(new THREE.BoxGeometry(w * 0.8, 0.04, 0.5), mat(r.color, 0.4, 0.2, r.color, 0.5), false);
    stripe.position.set((r.x0 + r.x1) / 2, SHIP_FLOOR + WALL_H + 0.32, (r.z0 + r.z1) / 2);
    root.add(stripe);
    roofs.push(stripe);
  }

  /* ---------------- paredes (mesmo tamanho dos colisores) ---------------- */
  const ponte = rooms.get('ponte')!;
  for (const w of map.walls) buildWall(w, rooms.get(w.room)!, ponte, root, { hullM: outerWallM, glassM, frameM, roomMats });

  /* ---------------- portas internas: batentes luminosos ---------------- */
  for (const d of map.doors) {
    const room = map.rooms.find((r) => d.axis === 'x' ? (Math.abs(r.z0 - d.at) < 0.01 || Math.abs(r.z1 - d.at) < 0.01) && d.from >= r.x0 - 0.01 && d.to <= r.x1 + 0.01 : (Math.abs(r.x0 - d.at) < 0.01 || Math.abs(r.x1 - d.at) < 0.01) && d.from >= r.z0 - 0.01 && d.to <= r.z1 + 0.01);
    const rm = roomMats.get(room?.id ?? 'eclusa')!.mat;
    for (const u of [d.from, d.to]) {
      const post = axisBox(d.axis, d.at, u - 0.12, u + 0.12, SHIP_FLOOR, SHIP_FLOOR + WALL_H, WALL_T + 0.12, frameM);
      root.add(post);
      root.add(axisBox(d.axis, d.at, u - 0.04, u + 0.04, SHIP_FLOOR + 0.2, SHIP_FLOOR + 2.5, WALL_T + 0.16, rm));
    }
  }
  // porta da eclusa (desliza para cima ao abrir)
  const air = map.doors.find((d) => d.id)!;
  const airlockDoor = new THREE.Group();
  const leaf = mesh(new THREE.BoxGeometry(air.to - air.from, WALL_H, 0.2), mat('#e8ecf3', 0.4, 0.5));
  leaf.position.set((air.from + air.to) / 2, SHIP_FLOOR + WALL_H / 2, air.at);
  airlockDoor.add(leaf);
  const hazard = canvasTexture(256, 64, (c) => { c.fillStyle = '#ffc93c'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#262b3a'; for (let x = -64; x < 256; x += 40) { c.beginPath(); c.moveTo(x, 64); c.lineTo(x + 20, 64); c.lineTo(x + 84, 0); c.lineTo(x + 64, 0); c.fill(); } });
  for (const s of [-1, 1]) {
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(air.to - air.from - 0.1, 0.35), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6 }));
    hz.position.set((air.from + air.to) / 2, SHIP_FLOOR + 0.4, air.at + s * 0.11);
    if (s < 0) hz.rotation.y = Math.PI;
    airlockDoor.add(hz);
  }
  root.add(airlockDoor);
  const eclSign = signPlane(signTexture('ECLUSA', { w: 512, h: 128, bg: '#262b3a', fg: '#ffc93c' }), 2.2, 0.55, 0.6);
  eclSign.position.set(0, SHIP_FLOOR + WALL_H + 0.45, air.at - 0.2);
  eclSign.rotation.y = Math.PI;
  root.add(eclSign);

  /* ---------------- consoles ---------------- */
  for (const s of map.stations) consoles.set(s.id, buildConsole(s, root));
  // caixas de carga
  const crateTex = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#5c6b86'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#ffc93c'; c.lineWidth = 8; c.strokeRect(6, 6, 116, 116);
    c.strokeStyle = '#3b4660'; c.lineWidth = 6; c.beginPath(); c.moveTo(10, 10); c.lineTo(118, 118); c.moveTo(118, 10); c.lineTo(10, 118); c.stroke();
  });
  const crateM = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.6, metalness: 0.3 });
  for (const c of map.crates) {
    const b = mesh(rbox(c.s, 0.9 * c.s, c.s, 0.06), crateM);
    b.position.set(c.x, SHIP_FLOOR + 0.45 * c.s, c.z);
    b.rotation.y = -c.rot;
    root.add(b);
  }

  /* ---------------- exterior: proa, asas, bocais dos motores ---------------- */
  // proa: cunha baixa à frente da ponte (abaixo da janela panorâmica)
  const noseGeo = new THREE.ConeGeometry(1, 1, 4);
  noseGeo.rotateY(Math.PI / 4);
  const nose = new THREE.Mesh(noseGeo, hullM);
  nose.rotation.z = -Math.PI / 2;
  nose.scale.set(0.9, 5, (ponte.z1 - ponte.z0) * 0.5);
  nose.position.set(ponte.x1 + 2.5, SHIP_FLOOR - 0.1, (ponte.z0 + ponte.z1) / 2);
  nose.castShadow = true;
  root.add(nose);
  const b = map.bounds;
  for (const side of [1]) {
    // asa ao sul (o norte é a estação)
    const wing = mesh(rbox(Math.min(18, b.x1 - b.x0 - 8), 0.4, 9, 0.15), hullM);
    wing.position.set((b.x0 + b.x1) / 2 - 4, SHIP_FLOOR - 0.6, b.z1 + 4.3 * side);
    wing.rotation.y = 0.12;
    root.add(wing);
    root.add(place(mesh(new THREE.BoxGeometry(Math.min(16, b.x1 - b.x0 - 10), 0.06, 0.4), mat('#ff4fa3', 0.4, 0, '#ff4fa3', 1.2), false), (b.x0 + b.x1) / 2 - 4, SHIP_FLOOR - 0.38, b.z1 + 7.5));
  }
  const nozzles: ShipParts['nozzles'] = [];
  for (const e of map.engines) {
    const [fx, fz] = FACE_VEC[e.dir];
    const g = new THREE.Group();
    g.position.set(e.x + fx * 1.3, SHIP_FLOOR + 0.7, e.z + fz * 1.3);
    g.rotation.y = Math.atan2(fx, fz);
    const bell = mesh(new THREE.CylinderGeometry(0.8, 1.3, 2.4, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#9aa3b8', roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide }));
    bell.rotation.x = Math.PI / 2;
    g.add(bell);
    const ringM = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#59c8ff', emissiveIntensity: 2.2 });
    const ring = mesh(new THREE.TorusGeometry(1.2, 0.14, 10, 28), ringM, false);
    ring.position.z = 0.9;
    g.add(ring);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.0, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#6fd3ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    flame.rotation.x = Math.PI / 2;
    flame.position.z = 4.3;
    g.add(flame);
    root.add(g);
    nozzles.push({ flame, glow: ringM });
  }

  /* ---------------- passarela e estação orbital ---------------- */
  const dock = buildDock();
  root.add(dock);

  /* ---------------- setas de dica (modo fácil) ---------------- */
  const arrowM = mat('#ffc93c', 0.3, 0, '#ffb400', 1.6);
  for (const s of map.stations) {
    const a = mesh(new THREE.ConeGeometry(0.4, 0.9, 4), arrowM, false);
    a.rotation.x = Math.PI;
    a.position.set(s.x, SHIP_FLOOR + s.h + 1.3, s.z);
    a.visible = false;
    root.add(a);
    arrows.set(s.id, a);
  }
  return { root, roofs, consoles, roomMats, airlockDoor, dock, nozzles, arrows };
}

function axisBox(axis: 'x' | 'z', at: number, u0: number, u1: number, y0: number, y1: number, thick: number, m: THREE.Material): THREE.Mesh {
  const g = axis === 'x' ? new THREE.BoxGeometry(u1 - u0, y1 - y0, thick) : new THREE.BoxGeometry(thick, y1 - y0, u1 - u0);
  const me = mesh(g, m);
  if (axis === 'x') me.position.set((u0 + u1) / 2, (y0 + y1) / 2, at); else me.position.set(at, (y0 + y1) / 2, (u0 + u1) / 2);
  return me;
}

function buildWall(w: WallSeg, room: RoomDef, ponte: RoomDef, root: THREE.Group, m: { hullM: THREE.Material; glassM: THREE.Material; frameM: THREE.Material; roomMats: ShipParts['roomMats'] }): void {
  const u0 = w.from - WALL_T / 2, u1 = w.to + WALL_T / 2;
  const L = w.to - w.from;
  const y0 = SHIP_FLOOR, y1 = SHIP_FLOOR + WALL_H;
  const inner = new THREE.MeshStandardMaterial({ map: wallTexture(L / 2.6), roughness: 0.55, metalness: 0.25 });
  const mats = w.outer ? inner : inner;
  // janelas: frente panorâmica da ponte e janelas no casco externo
  const panoramic = w.outer && w.room === 'ponte' && w.axis === 'z' && Math.abs(w.at - ponte.x1) < 0.01;
  const windows: [number, number][] = [];
  if (panoramic) windows.push([w.from + 0.8, w.to - 0.8]);
  else if (w.outer && L >= 4 && room.id !== 'eclusa' && !room.corridor) {
    const k = Math.floor((L - 1) / 4);
    for (let i = 0; i < k; i++) { const c = w.from + (L * (i + 0.5)) / k; windows.push([c - 0.9, c + 0.9]); }
  }
  const wy0 = panoramic ? SHIP_FLOOR + 0.9 : SHIP_FLOOR + 1.25, wy1 = SHIP_FLOOR + WALL_H - 0.35;
  let cur = u0;
  for (const [a, b] of windows) {
    if (a > cur) root.add(axisBox(w.axis, w.at, cur, a, y0, y1, WALL_T, mats));
    root.add(axisBox(w.axis, w.at, a, b, y0, wy0, WALL_T, mats));
    root.add(axisBox(w.axis, w.at, a, b, wy1, y1, WALL_T, mats));
    const pane = axisBox(w.axis, w.at, a, b, wy0, wy1, 0.05, m.glassM);
    pane.castShadow = false;
    root.add(pane);
    // moldura
    root.add(axisBox(w.axis, w.at, a - 0.06, a + 0.06, wy0, wy1, WALL_T + 0.06, m.frameM));
    root.add(axisBox(w.axis, w.at, b - 0.06, b + 0.06, wy0, wy1, WALL_T + 0.06, m.frameM));
    cur = b;
  }
  if (u1 > cur) root.add(axisBox(w.axis, w.at, cur, u1, y0, y1, WALL_T, mats));
  // faixa de luz no topo da parede (cor do módulo; fica vermelha no alarme)
  const rm = m.roomMats.get(room.id)!.mat;
  const cap = axisBox(w.axis, w.at, u0, u1, y1, y1 + 0.06, WALL_T + 0.04, rm);
  cap.castShadow = false;
  root.add(cap);
  // casco externo mais grosso por fora
  if (w.outer) {
    const off = -w.side * (WALL_T / 2 + 0.12);
    const shell = w.axis === 'x' ? new THREE.BoxGeometry(u1 - u0 + 0.3, WALL_H + 0.3, 0.24) : new THREE.BoxGeometry(0.24, WALL_H + 0.3, u1 - u0 + 0.3);
    const parts = windows.length ? [] : [shell];
    for (const g of parts) {
      const me = mesh(g, m.hullM);
      if (w.axis === 'x') me.position.set((u0 + u1) / 2, (y0 + y1) / 2 - 0.15, w.at + off); else me.position.set(w.at + off, (y0 + y1) / 2 - 0.15, (u0 + u1) / 2);
      root.add(me);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Consoles                                                             */
/* ------------------------------------------------------------------ */

function buildConsole(s: StationDef, parent: THREE.Group): ConsoleParts {
  const g = new THREE.Group();
  const [fx, fz] = FACE_VEC[s.face];
  g.position.set(s.x, SHIP_FLOOR, s.z);
  g.rotation.y = Math.atan2(fx, fz);
  const w = s.w, d = s.d, h = s.h;
  const body = mat('#39415a', 0.45, 0.55);
  const trim = mat('#8f9bb5', 0.35, 0.7);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, shadow = true) => { const me = mesh(geo, m, shadow); me.position.set(x, y, z); g.add(me); return me; };
  const spin: THREE.Object3D[] = [];
  let screen: Screen;
  let glow: THREE.MeshStandardMaterial | null = null;
  const parts: Partial<ConsoleParts> = {};
  let fxLocal = new THREE.Vector3(0, h * 0.7, 0.2);
  switch (s.kind) {
    case 'helm': {
      add(rbox(w, 0.85, d, 0.12), body, 0, 0.425, 0);
      add(rbox(w + 0.06, 0.06, d + 0.06, 0.02), trim, 0, 0.87, 0);
      screen = makeScreen(256, 256);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), screenMat(screen));
      scr.position.set(0, 1.25, -0.25);
      scr.rotation.x = -0.45;
      g.add(scr);
      add(rbox(1.2, 1.2, 0.08, 0.04), body, 0, 1.24, -0.3).rotation.x = -0.45;
      // manche funcional (inclina com a entrada do piloto)
      const stick = new THREE.Group();
      stick.position.set(0, 0.9, d / 2 - 0.22);
      stick.add(place(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.38, 10), trim), 0, 0.19, 0));
      stick.add(place(mesh(new THREE.SphereGeometry(0.075, 14, 10), mat('#ff4d5e', 0.3, 0.1, '#ff4d5e', 0.4)), 0, 0.4, 0));
      add(new THREE.CylinderGeometry(0.12, 0.14, 0.05, 16), mat('#1c2030', 0.6), 0, 0.89, d / 2 - 0.22);
      g.add(stick);
      parts.stick = stick;
      const lever = new THREE.Group();
      lever.position.set(w / 2 - 0.3, 0.9, d / 2 - 0.25);
      lever.add(place(mesh(rbox(0.06, 0.3, 0.06, 0.02), trim), 0, 0.15, 0));
      lever.add(place(mesh(rbox(0.16, 0.07, 0.1, 0.03), mat('#ffc93c', 0.4, 0.2, '#ffb400', 0.4)), 0, 0.3, 0));
      g.add(lever);
      parts.lever = lever;
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.1, 0.03, 0.07), mat(['#39d0ff', '#2fc97a', '#ffc93c', '#ff4fa3', '#7c5cff', '#ff8a3d'][i], 0.4, 0, ['#39d0ff', '#2fc97a', '#ffc93c', '#ff4fa3', '#7c5cff', '#ff8a3d'][i], 1.4), -w / 2 + 0.25 + i * 0.13, 0.9, d / 2 - 0.15, false);
      // cadeira do piloto (no ponto de uso)
      const chair = new THREE.Group();
      chair.position.set(0, 0, d / 2 + 0.85);
      chair.add(place(mesh(new THREE.CylinderGeometry(0.08, 0.2, 0.42, 10), trim), 0, 0.21, 0));
      chair.add(place(mesh(rbox(0.62, 0.12, 0.58, 0.05), mat('#ff4fa3', 0.6)), 0, 0.46, 0));
      chair.add(place(mesh(rbox(0.6, 0.7, 0.1, 0.05), mat('#ff4fa3', 0.6)), 0, 0.85, 0.3, -0.12));
      g.add(chair);
      fxLocal = new THREE.Vector3(0, 1.3, -0.2);
      break;
    }
    case 'nav': {
      add(rbox(w, 0.9, d, 0.1), body, 0, 0.45, 0);
      add(rbox(w * 0.9, 1.2, 0.12, 0.04), body, 0, 1.5, -d / 2 + 0.08);
      screen = makeScreen(256, 256);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), screenMat(screen));
      scr.position.set(0, 1.5, -d / 2 + 0.15);
      g.add(scr);
      const dish = new THREE.Group();
      dish.position.set(w / 2 - 0.25, 2.2, -d / 2 + 0.1);
      dish.add(mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), trim));
      dish.children[0].rotation.x = -Math.PI / 2;
      g.add(dish);
      spin.push(dish);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), trim, w / 2 - 0.25, 1.95, -d / 2 + 0.1);
      fxLocal = new THREE.Vector3(0, 1.4, 0);
      break;
    }
    case 'engine': {
      add(rbox(w, 0.3, d, 0.08), mat('#2a3042', 0.6, 0.5), 0, 0.15, 0);
      const cyl = add(new THREE.CylinderGeometry(0.8, 0.8, w - 0.3, 28), mat('#a9b3c7', 0.3, 0.8), 0, 1.15, -0.15);
      cyl.rotation.z = Math.PI / 2;
      for (const x of [-(w / 2) + 0.5, 0, w / 2 - 0.5]) {
        const ring = add(new THREE.TorusGeometry(0.84, 0.07, 10, 30), mat('#596480', 0.4, 0.8), x, 1.15, -0.15);
        ring.rotation.y = Math.PI / 2;
      }
      glow = new THREE.MeshStandardMaterial({ color: '#0b1430', emissive: '#59c8ff', emissiveIntensity: 2.2 });
      const core = add(new THREE.CylinderGeometry(0.86, 0.86, 0.5, 28), glow, -0.6, 1.15, -0.15, false);
      core.rotation.z = Math.PI / 2;
      const rotor = new THREE.Group();
      rotor.position.set(w / 2 - 0.12, 1.15, -0.15);
      for (let i = 0; i < 6; i++) { const blade = mesh(rbox(0.05, 1.3, 0.18, 0.02), mat('#d6dbe6', 0.4, 0.7)); blade.rotation.x = (i / 6) * Math.PI; rotor.add(blade); }
      g.add(rotor);
      spin.push(rotor);
      for (const x of [-0.8, 0.8]) add(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 10), mat('#ff8a3d', 0.5, 0.4), x, 2.0, -0.6);
      screen = makeScreen(256, 128);
      add(rbox(0.95, 0.6, 0.12, 0.04), body, w / 2 - 0.55, 1.0, d / 2 - 0.12);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.42), screenMat(screen));
      scr.position.set(w / 2 - 0.55, 1.0, d / 2 - 0.05);
      g.add(scr);
      // chamas (visíveis só durante o fogo)
      const flames = new THREE.Group();
      const fm = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const fm2 = new THREE.MeshBasicMaterial({ color: '#ffd25a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 5; i++) {
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.28 - (i % 2) * 0.08, 1.1 + (i % 3) * 0.3, 8), i % 2 ? fm2 : fm);
        fl.position.set(-1.1 + i * 0.55, 2.05, -0.15 + ((i * 37) % 3) * 0.12 - 0.12);
        flames.add(fl);
      }
      flames.visible = false;
      g.add(flames);
      parts.flames = flames;
      fxLocal = new THREE.Vector3(-0.3, 1.9, 0.1);
      break;
    }
    case 'power': {
      add(rbox(w, h, d, 0.08), body, 0, h / 2, 0);
      screen = makeScreen(256, 192);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), screenMat(screen));
      scr.position.set(0, 1.45, d / 2 + 0.01);
      g.add(scr);
      const cols = ['#ff8a3d', '#7c5cff', '#ff4fa3', '#39d0ff'];
      for (let i = 0; i < 4; i++) {
        add(rbox(0.32, 0.36, 0.1, 0.03), mat('#1c2030', 0.6), -0.6 + i * 0.4, 0.7, d / 2 + 0.03);
        add(rbox(0.12, 0.18, 0.06, 0.02), mat(cols[i], 0.4, 0, cols[i], 1.2), -0.6 + i * 0.4, 0.72, d / 2 + 0.09, false);
      }
      for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) add(new THREE.BoxGeometry(0.12, WALL_H - h + 0.1, 0.12), mat('#ffc93c', 0.5, 0.3), x, h + (WALL_H - h) / 2, -d / 2 + 0.1);
      fxLocal = new THREE.Vector3(0, 1.2, d / 2 + 0.2);
      break;
    }
    case 'shield': {
      add(new THREE.CylinderGeometry(0.62, 0.72, 0.75, 24), body, 0, 0.375, 0);
      add(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 24), trim, 0, 0.79, 0);
      const orbM = new THREE.MeshStandardMaterial({ color: '#b9a8ff', emissive: '#7c5cff', emissiveIntensity: 2, transparent: true, opacity: 0.85 });
      const orb = add(new THREE.SphereGeometry(0.3, 20, 14), orbM, 0, 1.3, 0, false);
      parts.orb = orb;
      glow = orbM;
      for (let i = 0; i < 2; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.1, 0.03, 8, 36), mat('#cfc4ff', 0.3, 0.2, '#7c5cff', 1.5));
        ring.position.set(0, 1.3, 0);
        ring.rotation.x = i ? 1.1 : 0.4;
        g.add(ring);
        spin.push(ring);
      }
      screen = makeScreen(256, 128);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), screenMat(screen));
      scr.position.set(0, 0.55, 0.69);
      scr.rotation.x = -0.25;
      g.add(scr);
      fxLocal = new THREE.Vector3(0, 1.3, 0);
      break;
    }
    case 'life': {
      for (const x of [-w / 2 + 0.35, w / 2 - 0.35]) {
        add(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 18), mat('#e9eef6', 0.35, 0.5), x, 0.85, -0.05);
        add(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e9eef6', 0.35, 0.5), x, 1.6, -0.05);
        add(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 18), mat('#ff4fa3', 0.4, 0.2, '#ff4fa3', 0.6), x, 1.1, -0.05, false);
      }
      add(rbox(0.75, h, d * 0.8, 0.06), body, 0, h / 2, -0.05);
      screen = makeScreen(256, 128);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.36), screenMat(screen));
      scr.position.set(0, 1.4, d * 0.35 + 0.01);
      g.add(scr);
      const fan = new THREE.Group();
      fan.position.set(0, 0.6, d * 0.35 + 0.02);
      for (let i = 0; i < 4; i++) { const blade = mesh(new THREE.BoxGeometry(0.5, 0.07, 0.02), mat('#9aa5b1', 0.4, 0.6), false); blade.rotation.z = (i / 4) * Math.PI; fan.add(blade); }
      g.add(fan);
      spin.push(fan);
      fxLocal = new THREE.Vector3(0, 1.6, 0.3);
      break;
    }
    case 'tank': {
      for (const x of [-w / 2 + 0.4, w / 2 - 0.4]) add(rbox(0.25, 0.45, d * 0.8, 0.04), body, x, 0.22, 0);
      const tank = add(new THREE.CylinderGeometry(0.72, 0.72, w - 0.25, 24), mat('#ffb400', 0.35, 0.45), 0, 1.0, -0.05);
      tank.rotation.z = Math.PI / 2;
      for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) { const cap = add(new THREE.SphereGeometry(0.72, 20, 12), mat('#ffb400', 0.35, 0.45), x, 1.0, -0.05); cap.scale.set(0.25, 1, 1); }
      const band = add(new THREE.CylinderGeometry(0.74, 0.74, 0.25, 24), mat('#262b3a', 0.5, 0.4), 0.5, 1.0, -0.05);
      band.rotation.z = Math.PI / 2;
      screen = makeScreen(256, 128);
      add(rbox(0.9, 0.5, 0.1, 0.03), body, -0.5, 1.15, d / 2 - 0.08);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.41), screenMat(screen));
      scr.position.set(-0.5, 1.15, d / 2 - 0.02);
      g.add(scr);
      glow = new THREE.MeshStandardMaterial({ color: '#0b2a18', emissive: '#2fc97a', emissiveIntensity: 1.8 });
      const port = add(new THREE.TorusGeometry(0.16, 0.05, 8, 20), glow, 0.75, 0.95, d / 2 - 0.05, false);
      void port;
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12), trim, 0.75, 0.95, d / 2 - 0.12).rotation.x = Math.PI / 2;
      fxLocal = new THREE.Vector3(0.3, 1.2, 0.5);
      break;
    }
    case 'cells': {
      for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) add(new THREE.BoxGeometry(0.08, h, d), trim, x, h / 2, 0);
      for (const y of [0.12, 0.78, 1.44]) add(new THREE.BoxGeometry(w, 0.05, d), body, 0, y, 0);
      add(new THREE.BoxGeometry(w, h, 0.04), mat('#2a3042', 0.6), 0, h / 2, -d / 2 + 0.02);
      const cells: THREE.Object3D[] = [];
      const cellM = new THREE.MeshStandardMaterial({ color: '#c8ffe0', emissive: '#2fc97a', emissiveIntensity: 1.6, roughness: 0.3 });
      for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
        const c = new THREE.Group();
        c.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.4, 12), cellM, false));
        c.add(place(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), trim, false), 0, 0.22, 0));
        c.position.set(-w / 2 + 0.3 + i * ((w - 0.6) / 5), 0.38 + row * 0.66, 0);
        g.add(c);
        cells.push(c);
      }
      parts.cells = cells;
      screen = makeScreen(256, 96);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.375), screenMat(screen));
      scr.position.set(0, h + 0.25, -d / 2 + 0.1);
      g.add(scr);
      fxLocal = new THREE.Vector3(0, 1.0, 0.3);
      break;
    }
  }
  // sinalizador de alarme no topo
  const beacon = new THREE.MeshStandardMaterial({ color: '#5a1a22', emissive: '#ff2a3d', emissiveIntensity: 0, roughness: 0.3 });
  const bx = w / 2 - 0.18, by = (s.kind === 'helm' || s.kind === 'nav' ? 0.95 : h) + 0.05;
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), mat('#262b3a', 0.5), bx, by, -d / 2 + 0.18);
  add(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), beacon, bx, by + 0.04, -d / 2 + 0.18, false);
  g.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) me.receiveShadow = true; });
  parent.add(g);
  g.updateMatrixWorld(true);
  const fxAt = g.localToWorld(fxLocal.clone());
  // etiqueta do console voltada para cima (legível pela câmera do alto)
  const u = usePoint(s);
  void u;
  return { st: s, group: g, screen: screen!, beacon, fxAt, spin, glow, ...parts };
}

/* ------------------------------------------------------------------ */
/* Doca: passarela tubular + anel da estação orbital                    */
/* ------------------------------------------------------------------ */

function buildDock(): THREE.Group {
  const g = new THREE.Group();
  const len = WALKWAY.z1 - WALKWAY.z0;
  const zc = (WALKWAY.z0 + WALKWAY.z1) / 2;
  const floor = mesh(rbox(WALKWAY.x1 - WALKWAY.x0 + 0.2, 0.3, len + 0.1, 0.06), mat('#8a93a8', 0.5, 0.6));
  floor.position.set(0, SHIP_FLOOR - 0.15, zc);
  g.add(floor);
  g.add(place(mesh(new THREE.BoxGeometry(0.6, 0.02, len), mat('#ffc93c', 0.4, 0, '#ffb400', 0.6), false), 0, SHIP_FLOOR + 0.01, zc));
  const railM = mat('#cfd6e4', 0.35, 0.7);
  for (const x of [WALKWAY.x0 - 0.1, WALKWAY.x1 + 0.1]) {
    g.add(place(mesh(new THREE.BoxGeometry(0.08, 0.08, len), railM), x, SHIP_FLOOR + 1.15, zc));
    g.add(place(mesh(new THREE.BoxGeometry(0.05, 0.05, len), mat('#39d0ff', 0.3, 0, '#39d0ff', 1.6), false), x, SHIP_FLOOR + 0.12, zc));
  }
  // arcos de vidro do tubo
  for (let z = WALKWAY.z0 + 0.6; z < WALKWAY.z1; z += 1.6) {
    const arch = mesh(new THREE.TorusGeometry(1.9, 0.07, 8, 24, Math.PI), railM);
    arch.position.set(0, SHIP_FLOOR, z);
    g.add(arch);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, len, 24, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshPhysicalMaterial({ color: '#9ad1ff', transparent: true, opacity: 0.12, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, SHIP_FLOOR, zc);
  g.add(tube);
  // guarda-corpos da plataforma (mesmos colisores do compartilhado)
  const ez = STATION_EDGE_Z + 0.12;
  for (const [a, b] of [[-STATION_HALF_X, WALKWAY.x0], [WALKWAY.x1, STATION_HALF_X]]) {
    g.add(place(mesh(new THREE.BoxGeometry(b - a, 0.08, 0.1), railM), (a + b) / 2, SHIP_FLOOR + 1.15, ez));
    for (let x = a + 0.5; x < b; x += 2.5) g.add(place(mesh(new THREE.BoxGeometry(0.07, 1.15, 0.07), railM), x, SHIP_FLOOR + 0.58, ez));
    g.add(place(mesh(new THREE.BoxGeometry(b - a, 0.04, 0.06), mat('#39d0ff', 0.3, 0, '#39d0ff', 1.4), false), (a + b) / 2, SHIP_FLOOR + 0.6, ez));
  }
  for (const sx of [-STATION_HALF_X - 0.1, STATION_HALF_X + 0.1]) g.add(place(mesh(new THREE.BoxGeometry(0.1, 0.08, 9.2), railM), sx, SHIP_FLOOR + 1.15, -25.25));
  // placa
  const sign = signPlane(signTexture('NAVE KEPLER-7', { sub: 'Embarque pela passarela →  Eclusa', bg: '#3a7bd5' }), 6, 1.5);
  sign.position.set(-6, SHIP_FLOOR + 2.4, STATION_EDGE_Z + 0.4);
  g.add(sign);
  for (const x of [-8.8, -3.2]) g.add(place(mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), railM), x, SHIP_FLOOR + 1.2, STATION_EDGE_Z + 0.45));
  // anel da estação orbital (ao norte, atrás do trem)
  const st = new THREE.Group();
  st.position.set(0, 14, -95);
  const ringM = new THREE.MeshPhysicalMaterial({ color: '#e5e9f2', roughness: 0.3, metalness: 0.5, clearcoat: 0.6 });
  const ring = mesh(new THREE.TorusGeometry(38, 3.2, 16, 72), ringM, false);
  ring.rotation.x = Math.PI / 2 - 0.35;
  st.add(ring);
  const lightsRing = mesh(new THREE.TorusGeometry(38, 0.6, 8, 72), mat('#39d0ff', 0.3, 0, '#39d0ff', 2.2), false);
  lightsRing.rotation.x = Math.PI / 2 - 0.35;
  lightsRing.position.y = 0.4;
  st.add(lightsRing);
  const hub = mesh(new THREE.SphereGeometry(9, 24, 16), ringM, false);
  st.add(hub);
  for (let i = 0; i < 4; i++) {
    const spoke = mesh(new THREE.CylinderGeometry(1.1, 1.1, 30, 10), ringM, false);
    spoke.rotation.set(Math.PI / 2 - 0.35, 0, (i / 4) * Math.PI * 2);
    const a = (i / 4) * Math.PI * 2;
    spoke.position.set(Math.cos(a) * 19, Math.sin(a) * 19 * Math.sin(0.35) * -1, Math.sin(a) * 19 * Math.cos(0.35));
    spoke.lookAt(0, 0, 0);
    spoke.rotateX(Math.PI / 2);
    st.add(spoke);
  }
  const panelTex = canvasTexture(128, 128, (c) => { c.fillStyle = '#1b2f6b'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#6f9cff'; c.lineWidth = 2; for (let i = 0; i <= 128; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); } });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 10), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.3, metalness: 0.6 }));
    p.position.set(s * 62, 6, 0);
    st.add(p);
    st.add(place(mesh(new THREE.CylinderGeometry(0.5, 0.5, 26, 8), ringM, false), s * 32, 3, 0, 0, 0, Math.PI / 2));
  }
  g.add(st);
  return g;
}
