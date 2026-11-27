/**
 * MUDANÇA MALUCA — cliente: mapa, móveis, caminhão, HUD, interações e efeitos.
 */
import * as THREE from 'three';
import { CollisionWorld, pushCircle, type BoxCollider, type Collider } from '../../../../shared/collision';
import {
  FLOOR_H, ITEMS, MUDANCA_ARRIVAL, TRUCK, buildMudancaMap, planMudanca, stepTruck,
  type HouseDef, type ItemKind, type MudancaMap, type MudancaPlan, type TruckState,
} from '../../../../shared/games/mudanca';
import { audio } from '../../core/Audio';
import { canvasTexture, mat, mesh, model, rbox } from '../../core/Assets';
import type { LocalPlayer } from '../../game/LocalPlayer';
import { MatchView } from '../../game/MatchView';
import type { ActionButton, Interactable } from '../../game/types';
import { el, esc } from '../../ui/dom';
import { Batcher, addBush, addTree, lamp, place, signPlane, signTexture } from '../../world/props';
import type { MinigameClient, MinigameClientCtx } from '../types';
import { buildFurniture } from './furniture';

const FLAG = { carried: 1, waiting: 2, loaded: 4, delivered: 8, broken: 16, rightRoom: 32 };
type Row = [number, number, number, number, number, number, number, number, number, string, number, number];

interface CItem {
  id: number; kind: ItemKind; obj: THREE.Group; flags: number; carriers: number[]; damage: number; slot: number;
  target: THREE.Vector3; targetQ: THREE.Quaternion; marker: THREE.Object3D | null; shown: boolean;
}

export default function create(ctx: MinigameClientCtx): MinigameClient {
  return new MudancaClient(ctx);
}

class MudancaClient implements MinigameClient {
  readonly sky;
  readonly mood = 'work' as const;
  hud: HTMLElement;
  private app: MinigameClientCtx['app'];
  private plan: MudancaPlan;
  private map: MudancaMap;
  private root!: THREE.Group;
  private items = new Map<number, CItem>();
  private truckObj = new THREE.Group();
  private truck: TruckState;
  private truckTarget: TruckState;
  private driver = 0;
  private loadedCount = 0;
  private endsAt = 0;
  private startAt = 0;
  private isStarted = false;
  private score = { total: 1, delivered: 0, broken: 0, count: 0, of: 0, right: 0, trips: 0, loaded: 0 };
  private sendAcc = 0;
  private col: CollisionWorld;
  private truckDyn: BoxCollider;
  private fx: { mesh: THREE.Points; vel: Float32Array; life: number }[] = [];
  private rain: THREE.LineSegments | null = null;
  private hintArrow: THREE.Mesh;
  private loadMarker: THREE.Mesh;
  private lastHud = '';
  private wheels: THREE.Object3D[] = [];
  private dynAdded = false;
  private roofs: { house: HouseDef; obj: THREE.Object3D[] }[] = [];

  constructor(ctx: MinigameClientCtx) {
    this.app = ctx.app;
    this.plan = planMudanca(ctx.players, ctx.difficulty);
    this.map = buildMudancaMap(this.plan);
    this.sky = this.plan.rain ? 'dusk' as const : 'day' as const;
    this.col = new CollisionWorld(this.map.colliders, null);
    const p = this.map.parkOld;
    this.truck = { x: p.x, z: p.z, yaw: p.yaw, speed: 0 };
    this.truckTarget = { ...this.truck };
    this.truckDyn = { kind: 'box', x: p.x, y: 1.6, z: p.z, hx: TRUCK.hx, hy: 1.6, hz: TRUCK.hz, rot: p.yaw, id: 'truck' };
    this.hud = el('div', 'passthrough');
    this.hud.style.cssText = 'position:absolute;inset:0';
    this.hintArrow = mesh(new THREE.ConeGeometry(0.4, 0.9, 4), mat('#ffc93c', 0.3, 0, '#ffb400', 1.2), false);
    this.hintArrow.rotation.x = Math.PI;
    this.loadMarker = mesh(new THREE.RingGeometry(1.6, 2.1, 40), new THREE.MeshBasicMaterial({ color: '#39ff88', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }), false);
    this.loadMarker.rotation.x = -Math.PI / 2;
  }

  colliders(): Collider[] { return this.map.colliders; }
  arrivalPose() { return MUDANCA_ARRIVAL; }

  /* ------------------------------ construção ------------------------------ */

  async build(root: THREE.Group, progress: (p: number) => void): Promise<void> {
    this.root = root;
    const b = this.map.bounds;
    // chão: grama + rua + calçadas
    const groundTex = canvasTexture(1024, 1024, (c) => {
      c.fillStyle = '#86c45f'; c.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 9000; i++) { c.fillStyle = Math.random() > 0.5 ? 'rgba(70,140,50,0.22)' : 'rgba(170,220,110,0.2)'; c.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3); }
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(8, 6);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0 + 60, b.z1 - b.z0 + 60), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);
    const roadTex = canvasTexture(512, 256, (c) => {
      c.fillStyle = '#4a4f5c'; c.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; c.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
      c.fillStyle = '#ffd23c'; for (let x = 0; x < 512; x += 96) c.fillRect(x, 124, 56, 8);
      c.fillStyle = '#ffffff'; c.fillRect(0, 10, 512, 5); c.fillRect(0, 241, 512, 5);
    });
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.repeat.set(10, 1);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0 + 4, 14), new THREE.MeshStandardMaterial({ map: roadTex, roughness: this.plan.rain ? 0.25 : 0.85, metalness: this.plan.rain ? 0.3 : 0 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, -7);
    road.receiveShadow = true;
    root.add(road);
    for (const z of [-15.5, 1.5]) {
      const sw = mesh(new THREE.BoxGeometry(b.x1 - b.x0 + 4, 0.16, 3), mat('#d9d4cc', 0.9), false);
      sw.position.set(0, 0.06, z);
      sw.receiveShadow = true;
      root.add(sw);
    }
    // caminho da estação até a rua
    const path = mesh(new THREE.BoxGeometry(8, 0.1, 6), mat('#d9d4cc', 0.9), false);
    path.position.set(0, 0.04, -19.5);
    path.receiveShadow = true;
    root.add(path);
    progress(0.15);
    for (const h of this.map.houses) this.buildHouse(h);
    progress(0.45);
    // decoração
    const batch = new Batcher();
    for (const d of this.map.decor) {
      if (d.kind === 'tree') addTree(batch, d.x, d.z, 1.3, d.x, Math.abs(d.x) % 2 < 1);
      if (d.kind === 'lamp') root.add(place(lamp(this.plan.rain), d.x, 0, d.z));
      if (d.kind === 'mailbox') {
        const g = new THREE.Group();
        g.add(place(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), mat('#3b4252', 0.5)), 0, 0.5, 0));
        g.add(place(mesh(rbox(0.5, 0.35, 0.3, 0.1), mat('#e64545', 0.5)), 0, 1.15, 0));
        root.add(place(g, d.x, 0, d.z));
      }
      if (d.kind === 'hydrant') {
        const g = new THREE.Group();
        g.add(place(mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.75, 12), mat('#e64545', 0.4)), 0, 0.38, 0));
        g.add(place(mesh(new THREE.SphereGeometry(0.22, 12, 8), mat('#e64545', 0.4)), 0, 0.78, 0));
        root.add(place(g, d.x, 0, d.z));
      }
      if (d.kind === 'neighbor') {
        const models = ['building-small-a', 'building-small-b', 'building-small-d', 'building-small-c'];
        const m = await model(`kenney/city/${models[Math.abs(Math.round(d.x + d.z)) % models.length]}.glb`, 9);
        m.position.set(d.x, 0, d.z);
        m.rotation.y = Math.PI;
        root.add(m);
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = b.x0 + 4 + ((i * 37) % 100) / 100 * (b.x1 - b.x0 - 8);
      const z = 20 + ((i * 53) % 100) / 100 * 18;
      if (Math.abs(x - 0) < 7 || Math.abs(x + 36) < 10 || Math.abs(x - 36) < 10) continue;
      addBush(batch, x, z, 1 + (i % 3) * 0.3, i);
    }
    // cercas vivas na frente das casas
    for (const hx of [-36, 36]) for (const s of [-1, 1]) for (let k = 0; k < 4; k++) addBush(batch, hx + s * (6 + k * 1.6), 2.6, 0.9, k, 0);
    batch.build(root);
    // placas
    const s1 = signPlane(signTexture('CASA ANTIGA', { sub: 'Retire tudo daqui!', bg: '#ff8a3d' }), 4.4, 1.1);
    s1.position.set(this.map.houses[0].doorX + 4.2, 1.6, this.map.houses[0].z - this.map.houses[0].d / 2 - 1.2);
    s1.rotation.y = Math.PI;
    root.add(s1);
    const s2 = signPlane(signTexture('CASA NOVA', { sub: 'Entregue os móveis aqui', bg: '#2fc97a' }), 4.4, 1.1);
    s2.position.set(this.map.houses[1].doorX - 4.2, 1.6, this.map.houses[1].z - this.map.houses[1].d / 2 - 1.2);
    s2.rotation.y = Math.PI;
    root.add(s2);
    for (const s of [s1, s2]) { const post = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), mat('#3b4252')); post.position.set(s.position.x, 0.55, s.position.z + 0.05); root.add(post); }
    progress(0.6);
    await this.buildTruck();
    progress(0.8);
    for (const [i, kind] of this.plan.items.entries()) {
      const obj = buildFurniture(kind);
      root.add(obj);
      this.items.set(i + 1, { id: i + 1, kind, obj, flags: 0, carriers: [], damage: 0, slot: -1, target: new THREE.Vector3(), targetQ: new THREE.Quaternion(), marker: null, shown: false });
    }
    root.add(this.hintArrow, this.loadMarker);
    if (this.plan.rain) this.buildRain();
    progress(1);
  }

  private buildHouse(h: HouseDef): void {
    const g = new THREE.Group();
    const isNew = h.id === 'new';
    const wallC = isNew ? '#fff3d6' : '#f2d1c9';
    const wallM = mat(wallC, 0.85);
    const innerM = mat(isNew ? '#fffaf0' : '#f7ece8', 0.9);
    const trimM = mat(isNew ? '#2fc97a' : '#ff8a3d', 0.6);
    const H = FLOOR_H * h.floors;
    const zN = h.z - h.d / 2, zS = h.z + h.d / 2, xW = h.x - h.w / 2, xE = h.x + h.w / 2;
    // piso de madeira
    const woodTex = canvasTexture(256, 256, (c) => {
      c.fillStyle = '#c8935a'; c.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 32) { c.fillStyle = y % 64 ? '#bd8750' : '#d29e65'; c.fillRect(0, y, 256, 30); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, y + 30, 256, 2); c.fillRect((y * 7) % 256, y, 2, 30); }
    });
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(h.w / 3, h.d / 3);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(h.w, 0.3, h.d), [mat('#d9cfc2'), mat('#d9cfc2'), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7 }), mat('#d9cfc2'), mat('#d9cfc2'), mat('#d9cfc2')]);
    floor.position.set(h.x, 0.15, h.z);
    floor.receiveShadow = true;
    g.add(floor);
    const wall = (cx: number, cy: number, cz: number, w: number, hh: number, d: number, m = wallM) => { const o = mesh(new THREE.BoxGeometry(w, hh, d), m); o.position.set(cx, cy, cz); g.add(o); return o; };
    // paredes (mesmas dimensões dos colisores)
    wall(h.x, H / 2, zS, h.w, H, 0.4);
    wall(xW, H / 2, h.z, 0.4, H, h.d);
    wall(xE, H / 2, h.z, 0.4, H, h.d);
    const dl = h.doorX - 1.35, dr = h.doorX + 1.35;
    wall((xW + dl) / 2, H / 2, zN, dl - xW, H, 0.4);
    wall((dr + xE) / 2, H / 2, zN, xE - dr, H, 0.4);
    wall(h.doorX, H - (H - 2.9) / 2, zN, 2.7, H - 2.9, 0.4);
    // batente da porta
    for (const s of [-1, 1]) wall(h.doorX + s * 1.4, 1.45, zN - 0.05, 0.15, 2.9, 0.5, trimM);
    wall(h.doorX, 2.95, zN - 0.05, 2.95, 0.15, 0.5, trimM);
    // janelas na fachada
    const glass = new THREE.MeshPhysicalMaterial({ color: '#bfe3ff', roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false });
    for (let fl = 0; fl < h.floors; fl++) for (const wx of [xW + 2.4, xE - 2.4, ...(fl ? [h.doorX] : [])]) {
      if (Math.abs(wx - h.doorX) < 2 && fl === 0) continue;
      const wy = 1.9 + fl * FLOOR_H;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), glass);
      pane.position.set(wx, wy, zN - 0.21);
      pane.rotation.y = Math.PI;
      g.add(pane);
      wall(wx, wy - 0.68, zN - 0.25, 1.9, 0.12, 0.2, trimM);
      wall(wx, wy + 0.66, zN - 0.22, 1.8, 0.1, 0.12, mat('#ffffff'));
    }
    // divisória interna
    const midZ = h.z - h.d * 0.1;
    wall((xW + h.x - 1.8) / 2, 0.3 + FLOOR_H / 2, midZ, h.x - 1.8 - xW, FLOOR_H, 0.4, innerM);
    wall((h.x + 1.8 + xE) / 2, 0.3 + FLOOR_H / 2, midZ, xE - h.x - 1.8, FLOOR_H, 0.4, innerM);
    if (h.floors === 2) {
      const st = this.map.stairs.find((s) => Math.abs(s.x - (xW + 1.4)) < 0.1 && s.z0 > zN && s.z0 < zS)!;
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        const top = 0.3 + ((i + 1) / steps) * FLOOR_H;
        const step = mesh(rbox(2.1, top, st.len / steps, 0.03), i % 2 ? mat('#b98552', 0.7) : mat('#c8935a', 0.7));
        step.position.set(st.x, top / 2, st.z0 + (i + 0.5) * (st.len / steps));
        g.add(step);
      }
      const slabTop = 0.3 + FLOOR_H;
      const holeX1 = st.x + 1.1;
      const slab = (cx: number, cz: number, w: number, d: number) => { const s = mesh(new THREE.BoxGeometry(w, 0.3, d), mat('#d6c3a5', 0.8)); s.position.set(cx, slabTop - 0.15, cz); g.add(s); };
      slab((holeX1 + xE) / 2, h.z, xE - holeX1, h.d);
      slab((xW + holeX1) / 2, (st.z0 + st.len + zS) / 2, holeX1 - xW, zS - (st.z0 + st.len));
      slab((xW + holeX1) / 2, (zN + st.z0 - 0.2) / 2, holeX1 - xW, Math.max(0.2, st.z0 - 0.2 - zN));
      wall(holeX1 + 0.06, slabTop + 0.55, st.z0 + st.len / 2 - 0.6, 0.12, 1.1, st.len - 1.2, mat('#8a5a32', 0.6));
      wall((xW + h.x - 1.8) / 2 + 1.2, slabTop + FLOOR_H / 2, h.z + h.d * 0.15, h.x - 1.8 - xW - 2.4, FLOOR_H, 0.4, innerM);
    }
    const upperStart = g.children.length;
    // telhado (sem sombra projetada dentro: deixa o interior iluminado)
    const roofM = mat(isNew ? '#3a7bd5' : '#c2412d', 0.7);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, h.w * 0.74, 2.6, 4, 1), roofM);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, h.d / h.w);
    roof.position.set(h.x, H + 1.3, h.z);
    roof.castShadow = true;
    roof.userData.roof = true;
    g.add(roof);
    const hideWhenInside: THREE.Object3D[] = [roof];
    // etiquetas dos cômodos (casa nova)
    if (isNew) {
      const colors: Record<string, string> = { sala: '#3a7bd5', cozinha: '#ffb400', quarto: '#7c5cff' };
      for (const r of h.rooms) {
        const tint = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 - 0.6, r.z1 - r.z0 - 0.6), new THREE.MeshBasicMaterial({ color: colors[r.name], transparent: true, opacity: 0.16, depthWrite: false }));
        tint.rotation.x = -Math.PI / 2;
        tint.position.set((r.x0 + r.x1) / 2, 0.31, (r.z0 + r.z1) / 2);
        g.add(tint);
        const label = signPlane(signTexture(r.name.toUpperCase(), { w: 512, h: 160, bg: colors[r.name] }), 2.4, 0.75, 0.6);
        label.position.set((r.x0 + r.x1) / 2, 2.6, r.z0 + 0.3);
        label.userData.room = r.name;
        g.add(label);
      }
    }
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.roof) m.castShadow = true; });
    void upperStart;
    this.roofs.push({ house: h, obj: hideWhenInside });
    this.root.add(g);
  }

  private async buildTruck(): Promise<void> {
    const cab = await model('kenney/racing/vehicle-truck-red.glb', 2.4);
    cab.position.z = 0.6;
    cab.traverse((o) => { if (o.name.startsWith('wheel')) this.wheels.push(o); });
    this.truckObj.add(cab);
    // baú de mudança
    const boxM = mat('#ffffff', 0.5, 0.1);
    const box = mesh(rbox(3.7, 3.1, 4.2, 0.12), boxM);
    box.position.set(0, 2.75, -1.95);
    this.truckObj.add(box);
    const logo = canvasTexture(1024, 512, (c) => {
      const gr = c.createLinearGradient(0, 0, 1024, 512);
      gr.addColorStop(0, '#ff8a3d'); gr.addColorStop(1, '#ffc93c');
      c.fillStyle = gr; c.fillRect(0, 0, 1024, 512);
      c.fillStyle = '#fff'; c.font = '150px Lilita, system-ui'; c.textAlign = 'center';
      c.fillText('MUDANÇA', 512, 230); c.fillText('MALUCA', 512, 380);
      c.font = 'bold 44px system-ui'; c.fillText('Leva tudo • Não quebra nada*', 512, 470);
    });
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.0), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.6 }));
      side.position.set(s * 1.86, 2.8, -1.95);
      side.rotation.y = s * Math.PI / 2;
      this.truckObj.add(side);
    }
    // traseira aberta (portas) + rampa
    for (const s of [-1, 1]) {
      const door = mesh(rbox(0.08, 2.9, 1.8, 0.03), mat('#e8e8e8', 0.5));
      door.position.set(s * 2.6, 2.75, -4.05 - 0.0);
      door.rotation.y = s * -1.2;
      this.truckObj.add(door);
    }
    const inside = mesh(new THREE.BoxGeometry(3.4, 2.8, 0.05), mat('#4a3a2a', 0.9), false);
    inside.position.set(0, 2.75, -0.2);
    this.truckObj.add(inside);
    const ramp = mesh(rbox(1.6, 0.08, 1.8, 0.02), mat('#9aa5b1', 0.4, 0.7));
    ramp.position.set(0, 0.6, -4.75);
    ramp.rotation.x = -0.42;
    this.truckObj.add(ramp);
    // contador de carga
    const counter = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: this.counterTex(0), transparent: true }));
    counter.position.set(0, 4.55, -1.0);
    counter.name = 'counter';
    this.truckObj.add(counter);
    this.truckObj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    this.root.add(this.truckObj);
    this.placeTruck();
  }

  private counterTex(n: number): THREE.CanvasTexture {
    return canvasTexture(256, 96, (c) => {
      c.fillStyle = 'rgba(20,12,48,0.8)'; c.beginPath(); c.roundRect(0, 0, 256, 96, 30); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 54px system-ui'; c.textAlign = 'center'; c.fillText(`${n}/${this.plan.truckCapacity}`, 128, 66);
    });
  }

  private buildRain(): void {
    const n = Math.floor(1400 * this.app.renderer.preset.particles);
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 80, y = Math.random() * 30, z = (Math.random() - 0.5) * 80;
      pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.45 }));
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
  }

  /* ------------------------------ estado ------------------------------ */

  applyState(s: unknown): void {
    const st = s as { items: Row[]; truck: number[]; startAt: number; endsAt: number; started: boolean; score: MudancaClient['score'] };
    if (!st) return;
    this.startAt = st.startAt;
    this.endsAt = st.endsAt;
    this.isStarted = st.started;
    this.score = st.score;
    for (const r of st.items) this.applyItem(r, true);
    this.applyTruck(st.truck, true);
  }

  applyDelta(d: unknown): void {
    const st = d as { i: Row[]; t: number[]; s: MudancaClient['score']; e?: { e: string; d: unknown }[]; endsAt: number; started: boolean };
    if (!st) return;
    for (const r of st.i) this.applyItem(r, false);
    this.applyTruck(st.t, false);
    this.score = st.s;
    this.endsAt = st.endsAt;
    if (st.started && !this.isStarted) this.isStarted = true;
    for (const e of st.e ?? []) this.onEvent(e.e, e.d);
  }

  private applyItem(r: Row, snap: boolean): void {
    const it = this.items.get(r[0]);
    if (!it) return;
    it.target.set(r[1], r[2], r[3]);
    it.targetQ.set(r[4], r[5], r[6], r[7]);
    const wasBroken = it.flags & FLAG.broken;
    it.flags = r[8];
    it.carriers = r[9] ? String(r[9]).split(',').map(Number) : [];
    it.damage = r[10];
    it.slot = r[11];
    if (snap || !it.shown) { it.obj.position.copy(it.target); it.obj.quaternion.copy(it.targetQ); it.shown = true; }
    if ((it.flags & FLAG.broken) && !wasBroken) this.showBroken(it);
  }

  private applyTruck(t: number[], snap: boolean): void {
    if (!t) return;
    this.truckTarget = { x: t[0], z: t[1], yaw: t[2], speed: t[3] };
    const prevDriver = this.driver;
    this.driver = t[4];
    if (t[5] !== this.loadedCount) {
      this.loadedCount = t[5];
      const c = this.truckObj.getObjectByName('counter') as THREE.Mesh | undefined;
      if (c) { (c.material as THREE.MeshBasicMaterial).map?.dispose(); (c.material as THREE.MeshBasicMaterial).map = this.counterTex(this.loadedCount); }
    }
    const me = this.app.myId;
    if (snap || this.driver !== me || prevDriver !== me) {
      if (snap || this.driver !== me) {
        if (snap) this.truck = { ...this.truckTarget };
      } else this.truck = { ...this.truckTarget };
    } else {
      // motorista local: reconcilia com o servidor
      const err = Math.hypot(this.truck.x - this.truckTarget.x, this.truck.z - this.truckTarget.z);
      if (err > 3) this.truck = { ...this.truckTarget };
    }
  }

  private showBroken(it: CItem): void {
    // visual: inclina, escurece e mostra rachaduras (fumaça + cacos)
    it.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mm = (m.material as THREE.MeshStandardMaterial).clone();
        if (mm.color) mm.color.multiplyScalar(0.55);
        m.material = mm;
      }
    });
    this.burst(it.obj.position, '#ffe0b0', 40);
  }

  private burst(p: THREE.Vector3, color: string, n: number): void {
    n = Math.max(6, Math.floor(n * this.app.renderer.preset.particles));
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([p.x, p.y, p.z], i * 3);
      vel.set([(Math.random() - 0.5) * 6, Math.random() * 6 + 1, (Math.random() - 0.5) * 6], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.18, transparent: true }));
    m.frustumCulled = false;
    this.root.add(m);
    this.fx.push({ mesh: m, vel, life: 1.2 });
  }

  /* ------------------------------ interação ------------------------------ */

  private myItem(): CItem | null {
    const me = this.app.myId;
    for (const it of this.items.values()) if ((it.flags & (FLAG.carried | FLAG.waiting)) && it.carriers.includes(me)) return it;
    return null;
  }

  private loadPoint(): THREE.Vector3 {
    return new THREE.Vector3(this.truck.x + Math.sin(this.truck.yaw) * TRUCK.loadZ, 0, this.truck.z + Math.cos(this.truck.yaw) * TRUCK.loadZ);
  }

  interactables(lp: LocalPlayer): Interactable[] {
    if (!this.isStarted) return [];
    const out: Interactable[] = [];
    const send = (id: string) => () => this.app.net.send({ t: 'interact', id });
    const me = this.app.myId;
    const wp = lp.worldPos(new THREE.Vector3());
    if (this.driver === me) {
      out.push({ id: 'truck:exit', pos: wp, r: 99, prio: 10, label: 'Sair do caminhão', use: send('truck:exit') });
      return out;
    }
    const mine = this.myItem();
    const parked = Math.abs(this.truck.speed) < 0.8;
    const lpnt = this.loadPoint();
    if (mine) {
      if ((mine.flags & FLAG.carried) && parked) out.push({ id: 'truck:load', pos: lpnt.clone().setY(wp.y), r: TRUCK.loadR + 0.6, prio: 5, label: `Colocar no caminhão (${this.loadedCount}/${this.plan.truckCapacity})`, use: send('truck:load') });
      out.push({ id: 'drop', pos: wp, r: 99, label: mine.flags & FLAG.waiting ? 'Soltar (aguardando ajuda)' : 'Colocar no chão', use: send('drop') });
      return out;
    }
    if (parked && this.loadedCount > 0) out.push({ id: 'truck:unload', pos: lpnt.clone().setY(wp.y), r: TRUCK.loadR + 0.6, prio: 2, label: 'Descarregar item', use: send('truck:unload') });
    if (!this.driver) {
      const cab = new THREE.Vector3(this.truck.x + Math.sin(this.truck.yaw) * 2.3, wp.y, this.truck.z + Math.cos(this.truck.yaw) * 2.3);
      out.push({ id: 'truck:drive', pos: cab, r: 4.2, label: 'Dirigir caminhão', use: send('truck:drive') });
    }
    for (const it of this.items.values()) {
      if (it.flags & FLAG.loaded) continue;
      const def = ITEMS[it.kind];
      const full = (it.flags & FLAG.carried) && (def.carriers === 1 || it.carriers.length >= 2);
      if (full) continue;
      const waiting = it.flags & FLAG.waiting;
      const p = it.obj.position;
      if (Math.abs(p.y - (wp.y + 0.8)) > 2.2) continue;
      const label = waiting ? `Ajudar a carregar ${def.name}` : def.carriers === 2 ? `Pegar ${def.name} (2 pessoas)` : `Pegar ${def.name}${def.fragile ? ' (frágil!)' : ''}`;
      out.push({ id: `item:${it.id}`, pos: new THREE.Vector3(p.x, wp.y, p.z), r: Math.max(def.hx, def.hz) + 1.6, prio: waiting ? 1 : 0, label, use: send(`item:${it.id}`) });
    }
    return out;
  }

  actionButtons(_lp: LocalPlayer): ActionButton[] {
    const me = this.app.myId;
    if (this.driver === me) return [{ id: 'honk', label: 'Buzina', key: 'F', onDown: () => this.app.net.send({ t: 'act', a: 'honk' }) }];
    if (this.myItem()) return [{ id: 'drop', label: 'Soltar', key: 'F', onDown: () => this.app.net.send({ t: 'interact', id: 'drop' }) }];
    return [];
  }

  /* ------------------------------ eventos ------------------------------ */

  onEvent(e: string, d: unknown): void {
    const o = (d ?? {}) as Record<string, number | string | boolean | null>;
    const it = typeof o.id === 'number' ? this.items.get(o.id) : undefined;
    switch (e) {
      case 'countdown': this.app.ui.banner('Preparar…', 'Leve tudo da CASA ANTIGA para a CASA NOVA', 2800); break;
      case 'break': audio.play('break', { at: it?.obj.position }); if (it) this.app.ui.toast(`💥 ${ITEMS[it.kind].name} quebrou!`, 'err', 2200); this.app.cam.addShake(0.15); break;
      case 'dent': audio.play('impact', { at: it?.obj.position, vol: 0.6 }); break;
      case 'delivered': audio.play('coin', { at: it?.obj.position }); if (it) this.burst(it.obj.position, '#7bff9a', 24); break;
      case 'loaded': audio.play('pop'); break;
      case 'unloaded': audio.play('pop'); break;
      case 'pickup': audio.play('pop', { at: it?.obj.position, vol: 0.6 }); break;
      case 'place': audio.play('land', { at: it?.obj.position, vol: 0.5 }); break;
      case 'needHelp': if (o.by !== this.app.myId && it) this.app.ui.toast(`Alguém precisa de ajuda com: ${ITEMS[it.kind].name}!`, 'info', 2200); else if (it) this.app.ui.toast(`${ITEMS[it.kind].name} é pesado — aguarde um parceiro pegar do outro lado.`, 'info', 2600); break;
      case 'slip': this.app.ui.toast('Vocês se afastaram demais e o móvel caiu!', 'warn', 2200); audio.play('fall'); break;
      case 'crash': audio.play('impact'); this.app.cam.addShake(0.5); this.app.ui.toast('Batida! Cuidado com a carga no baú.', 'warn', 2000); break;
      case 'honk': audio.play('horn', { at: { x: Number(o.x), y: 1, z: Number(o.z) } }); break;
      case 'trip': this.app.ui.toast(`Viagem ${o.n} concluída — descarreguem!`, 'ok', 2200); break;
      case 'driver': if (o.id === this.app.myId) this.app.ui.toast('W/S acelera e freia • A/D vira • E sai do caminhão', 'info', 4000); break;
    }
  }

  started(): void { this.isStarted = true; }

  /* ------------------------------ atualização ------------------------------ */

  update(dt: number, now: number, lp: LocalPlayer): void {
    const me = this.app.myId;
    if (!this.dynAdded && this.app.view instanceof MatchView) {
      this.app.view.colFor(0).addDynamic(this.truckDyn);
      this.dynAdded = true;
    }
    // caminhão: motorista local prediz; demais suavizam
    if (this.driver === me) {
      const input = this.app.input;
      const inp = { throttle: input.move.y, steer: input.move.x };
      stepTruck(this.truck, inp, dt, { push: (x, z, r) => pushCircle(this.col, x, z, r) }, this.plan.rain ? 0.75 : 1);
      this.sendAcc += dt;
      if (this.sendAcc > 0.05) { this.sendAcc = 0; this.app.net.send({ t: 'act', a: 'drive', d: { th: inp.throttle, st: inp.steer } }); }
      if (input.take('action')) this.app.net.send({ t: 'act', a: 'honk' });
      this.app.cam.forceDist = 12;
    } else {
      this.app.cam.forceDist = null;
      const k = 1 - Math.exp(-dt * 10);
      this.truck.x += (this.truckTarget.x - this.truck.x) * k;
      this.truck.z += (this.truckTarget.z - this.truck.z) * k;
      let dy = this.truckTarget.yaw - this.truck.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.truck.yaw += dy * k;
      this.truck.speed = this.truckTarget.speed;
    }
    this.placeTruck();
    // som do motor
    const sp = Math.abs(this.truck.speed);
    if (this.driver) audio.loop('truck', 'engine', 0.12 + Math.min(0.3, sp / 40), 0.7 + sp / 14); else audio.stopLoop('truck');
    // motoristas (local e remotos) sentados na cabine
    const seat = () => {
      const fx = Math.sin(this.truck.yaw), fz = Math.cos(this.truck.yaw);
      const rx = -fz, rz = fx;
      return new THREE.Vector3(this.truck.x + fx * 2.3 - rx * 0.55, 1.0, this.truck.z + fz * 2.3 - rz * 0.55);
    };
    if (this.driver) {
      const p = seat();
      if (this.driver === me) { lp.s.x = p.x; lp.s.y = p.y; lp.s.z = p.z; lp.yaw = this.truck.yaw; lp.syncAvatar(); }
      else { const r = this.app.remotes.get(this.driver); if (r) { r.avatar.root.position.copy(p); r.avatar.root.rotation.y = this.truck.yaw; } }
    }
    // carregando: velocidade e trava de pulo locais
    const mine = this.myItem();
    lp.carrying = !!mine && !!(mine.flags & FLAG.carried);
    // câmera não "entra" no móvel: mais alta/afastada e o objeto fica translúcido para quem carrega
    if (this.driver !== me) {
      const big = mine && (mine.flags & FLAG.carried) && ITEMS[mine.kind].hy + ITEMS[mine.kind].hx > 0.9;
      this.app.cam.forceDist = big ? 8.5 : null;
      if (big && this.app.cam.pitch < 0.5) this.app.cam.pitch += (0.5 - this.app.cam.pitch) * Math.min(1, dt * 4);
    }
    for (const it of this.items.values()) this.setSeeThrough(it, it === mine && !!(mine.flags & FLAG.carried));
    lp.speedMul = mine && (mine.flags & FLAG.carried) ? ITEMS[mine.kind].speed : 1;
    // itens
    const k = 1 - Math.exp(-dt * 14);
    for (const it of this.items.values()) {
      if (it.flags & FLAG.loaded) {
        // dentro do baú: acompanha o caminhão
        const [lx, ly, lz] = [((it.slot % 3) - 1) * 1.1, 1.9 + Math.floor(it.slot / 12) * 1.0, -0.6 - (Math.floor(it.slot / 3) % 4) * 0.85];
        const c = Math.cos(this.truck.yaw), s = Math.sin(this.truck.yaw);
        it.obj.position.set(this.truck.x + lx * c + lz * s, ly, this.truck.z - lx * s + lz * c);
        it.obj.rotation.set(0, this.truck.yaw, 0);
        it.obj.scale.setScalar(0.5);
        continue;
      }
      it.obj.scale.setScalar(1);
      if ((it.flags & FLAG.carried) && it.carriers.length) {
        // posiciona localmente a partir dos avatares (sem atraso de rede)
        const ps = it.carriers.map((id) => id === me ? lp.avatar.root : this.app.remotes.get(id)?.avatar.root).filter((x): x is THREE.Group => !!x);
        const def = ITEMS[it.kind];
        if (ps.length === 1) {
          const a = ps[0].getWorldPosition(new THREE.Vector3());
          const yaw = ps[0].rotation.y;
          const off = 0.55 + def.hz;
          it.obj.position.lerp(new THREE.Vector3(a.x + Math.sin(yaw) * off, a.y + 1.05 + def.hy * 0.4, a.z + Math.cos(yaw) * off), 0.6);
          it.obj.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), 0.5);
          continue;
        }
        if (ps.length === 2) {
          const a = ps[0].getWorldPosition(new THREE.Vector3()), b = ps[1].getWorldPosition(new THREE.Vector3());
          const yaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
          it.obj.position.lerp(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.95 + def.hy * 0.3, (a.z + b.z) / 2), 0.6);
          it.obj.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), 0.5);
          continue;
        }
      }
      it.obj.position.lerp(it.target, k);
      it.obj.quaternion.slerp(it.targetQ, k);
    }
    // telhado some quando o jogador está dentro da casa (visão do interior)
    const wpos = lp.worldPos(new THREE.Vector3());
    for (const r of this.roofs) {
      const h = r.house;
      const inside = wpos.x > h.x - h.w / 2 - 0.5 && wpos.x < h.x + h.w / 2 + 0.5 && wpos.z > h.z - h.d / 2 - 0.5 && wpos.z < h.z + h.d / 2 + 0.5;
      for (const o of r.obj) o.visible = !inside;
    }
    // marcadores: ponto de carga e dica
    const lpt = this.loadPoint();
    this.loadMarker.position.set(lpt.x, 0.08, lpt.z);
    this.loadMarker.visible = !!mine || this.loadedCount > 0;
    (this.loadMarker.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(now / 200) * 0.2;
    this.hintArrow.visible = false;
    if (this.plan.hints && !mine && this.driver !== me) {
      let best: CItem | null = null, bd = Infinity;
      const wp = lp.worldPos(new THREE.Vector3());
      for (const it of this.items.values()) {
        if (it.flags & (FLAG.delivered | FLAG.loaded | FLAG.broken | FLAG.carried)) continue;
        const d = it.obj.position.distanceTo(wp) - ITEMS[it.kind].value * 0.02;
        if (d < bd) { bd = d; best = it; }
      }
      if (best) {
        this.hintArrow.visible = true;
        this.hintArrow.position.copy(best.obj.position).add(new THREE.Vector3(0, ITEMS[best.kind].hy + 1.2 + Math.sin(now / 250) * 0.2, 0));
        this.hintArrow.rotation.y += dt * 3;
      }
    }
    // efeitos
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      const pos = f.mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < pos.count; j++) {
        f.vel[j * 3 + 1] -= 14 * dt;
        pos.setXYZ(j, pos.getX(j) + f.vel[j * 3] * dt, Math.max(0.05, pos.getY(j) + f.vel[j * 3 + 1] * dt), pos.getZ(j) + f.vel[j * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
      (f.mesh.material as THREE.PointsMaterial).opacity = Math.max(0, f.life);
      if (f.life <= 0) { f.mesh.removeFromParent(); f.mesh.geometry.dispose(); this.fx.splice(i, 1); }
    }
    if (this.rain) {
      const wp = lp.worldPos(new THREE.Vector3());
      this.rain.position.set(wp.x, 0, wp.z);
      const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 2) {
        let y = pos.getY(i) - dt * 22;
        if (y < 0) y += 30;
        pos.setY(i, y); pos.setY(i + 1, y - 0.7);
      }
      pos.needsUpdate = true;
    }
    this.updateHud(now, mine);
  }

  private setSeeThrough(it: CItem, on: boolean): void {
    if ((it.obj.userData.seeThrough ?? false) === on) return;
    it.obj.userData.seeThrough = on;
    it.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (on) {
        if (!m.userData.solidMat) m.userData.solidMat = m.material;
        const c = (m.userData.solidMat as THREE.Material).clone();
        c.transparent = true;
        c.opacity = 0.45;
        c.depthWrite = false;
        m.material = c;
        m.castShadow = true;
      } else if (m.userData.solidMat) {
        (m.material as THREE.Material).dispose();
        m.material = m.userData.solidMat;
        delete m.userData.solidMat;
      }
    });
  }

  private placeTruck(): void {
    this.truckObj.position.set(this.truck.x, 0, this.truck.z);
    this.truckObj.rotation.y = this.truck.yaw;
    for (const w of this.wheels) w.rotation.x += this.truck.speed * 0.02;
    this.truckDyn.x = this.truck.x;
    this.truckDyn.z = this.truck.z;
    this.truckDyn.rot = this.truck.yaw;
  }

  private updateHud(now: number, mine: CItem | null): void {
    const s = this.score;
    const left = this.isStarted ? Math.max(0, Math.ceil((this.endsAt - now) / 1000)) : this.plan.timeSec;
    const pct = s.total ? s.delivered / s.total : 0;
    const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
    const cls = left <= 20 ? 'danger' : left <= 60 ? 'warn' : '';
    const objectives = [
      { done: pct >= this.plan.quota, t: `Entregar ${Math.round(this.plan.quota * 100)}% do valor na casa nova` },
      { done: s.count === s.of - s.broken && s.of > 0, t: `Levar todos os itens (${s.count}/${s.of})` },
      { done: s.broken === 0 && pct >= this.plan.quota, t: 'Não quebrar nada' + (s.broken ? ` (${s.broken} quebrado${s.broken > 1 ? 's' : ''})` : '') },
      ...(this.plan.roomsMatter ? [{ done: s.count > 0 && s.right === s.count, t: `Cômodo certo: ${s.right}/${s.count} (+25% valor)` }] : []),
    ];
    let hint = '';
    if (this.driver === this.app.myId) hint = 'Dirigindo: W/S acelerar/ré • A/D virar • F buzina • E sair';
    else if (mine && (mine.flags & FLAG.waiting)) hint = `Aguardando parceiro para levantar: ${ITEMS[mine.kind].name}`;
    else if (mine) hint = `Carregando ${ITEMS[mine.kind].name}${ITEMS[mine.kind].fragile ? ' — FRÁGIL!' : ''} • leve ao caminhão (círculo verde) ou à casa nova`;
    else if (this.isStarted && now < this.startAt) hint = `Começando em ${Math.ceil((this.startAt - now) / 1000)}…`;
    const html = `
      <div class="mhud">
        <div class="mbox ${cls}"><small>Tempo</small><b>${mm}:${ss}</b></div>
        <div class="mbox"><small>Valor</small><b>${Math.round(pct * 100)}%</b></div>
        <div class="mbox"><small>Entregues</small><b>${s.count}/${s.of}</b></div>
        <div class="mbox"><small>Caminhão</small><b>${this.loadedCount}/${this.plan.truckCapacity}</b></div>
      </div>
      <div class="objectives"><h5>📦 Mudança Maluca</h5>
        ${objectives.map((o) => `<div class="obj ${o.done ? 'done' : ''}"><i>${o.done ? '✓' : ''}</i><span>${esc(o.t)}</span></div>`).join('')}
        <div class="progress"><i style="width:${Math.min(100, (pct / this.plan.quota) * 100)}%"></i></div>
      </div>
      ${hint ? `<div class="hint">${esc(hint)}</div>` : ''}`;
    if (html !== this.lastHud) { this.hud.innerHTML = html; this.lastHud = html; }
  }

  dispose(): void {
    this.app.cam.forceDist = null;
    audio.stopLoop('truck');
    for (const f of this.fx) f.mesh.removeFromParent();
  }
}
