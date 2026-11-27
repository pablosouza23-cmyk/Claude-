/**
 * MUDANÇA MALUCA — lógica autoritativa no servidor.
 *  - Física real (Rapier): móveis são corpos rígidos; jogadores são cápsulas
 *    cinemáticas que empurram objetos; o caminhão é um corpo cinemático.
 *  - Carregar: itens leves com 1 pessoa, pesados exigem 2 (o item segue o
 *    ponto médio entre os carregadores; afastar demais derruba).
 *  - Quebra: variação brusca de velocidade (queda, batida do caminhão) quebra
 *    frágeis e amassa os demais (perdem valor).
 *  - Caminhão: dirigível (física compartilhada stepTruck), capacidade por
 *    viagem; itens no baú tremem e podem quebrar se você bater forte.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { CollisionWorld, pushCircle, type BoxCollider, type Collider } from '../../../../shared/collision';
import {
  ITEMS, MUDANCA_ARRIVAL, TRUCK, buildMudancaMap, inRoom, insideHouse, planMudanca, stepTruck,
  type ItemKind, type MudancaMap, type MudancaPlan, type TruckState,
} from '../../../../shared/games/mudanca';
import type { Pose } from '../../../../shared/train';
import type { MatchWorld } from '../../worlds/MatchWorld';
import type { WPlayer } from '../../worlds/World';
import type { GameResult, MinigameContext, MinigameServer } from '../types';

type ItemState = 'free' | 'carried' | 'waiting' | 'loaded' | 'delivered';

interface Item {
  id: number;
  kind: ItemKind;
  body: RAPIER.RigidBody;
  state: ItemState;
  carriers: number[];
  broken: boolean;
  damage: number;
  lastV: { x: number; y: number; z: number };
  slot: number;
  room: string | null;
  sent: string;
  lastCarrier: string | null;
  restT: number;
}

export const FLAG = { carried: 1, waiting: 2, loaded: 4, delivered: 8, broken: 16, rightRoom: 32 };

let rapierReady = false;
export async function initRapier(): Promise<void> {
  if (rapierReady) return;
  await RAPIER.init();
  rapierReady = true;
}

export function createMudanca(ctx: MinigameContext): MinigameServer {
  return new MudancaServer(ctx);
}

class MudancaServer implements MinigameServer {
  readonly id = 'mudanca' as const;
  private match: MatchWorld;
  readonly plan: MudancaPlan;
  readonly map: MudancaMap;
  private world: RAPIER.World;
  private items: Item[] = [];
  private playerBodies = new Map<number, RAPIER.RigidBody>();
  private truck: TruckState;
  private truckBody: RAPIER.RigidBody;
  private truckCollider: BoxCollider;
  private driver = 0;
  private driveInput = { throttle: 0, steer: 0, at: 0 };
  private loaded: number[] = [];
  private startAt = 0;
  private endsAt = 0;
  private finished: GameResult | null = null;
  private started = false;
  private trips = 0;
  private wasAtNew = false;
  private events: { e: string; d: unknown }[] = [];
  private stats = new Map<string, { carried: number; delivered: number; driven: number; breaks: number }>();
  private dynAdded = false;
  private staticCol: CollisionWorld;
  private lastTruckHit = 0;

  constructor(ctx: MinigameContext) {
    this.match = ctx.match;
    this.plan = planMudanca(ctx.players, ctx.difficulty);
    this.map = buildMudancaMap(this.plan);
    this.staticCol = new CollisionWorld(this.map.colliders, null);
    this.world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    this.world.timestep = 1 / 30;
    for (const c of this.map.colliders) this.addStatic(c);
    // caminhão
    const p = this.map.parkOld;
    this.truck = { x: p.x, z: p.z, yaw: p.yaw, speed: 0 };
    this.truckBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, 1.7, p.z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(TRUCK.hx, 1.5, TRUCK.hz).setFriction(0.9), this.truckBody);
    this.truckCollider = { kind: 'box', x: p.x, y: 1.6, z: p.z, hx: TRUCK.hx, hy: 1.6, hz: TRUCK.hz, rot: p.yaw, id: 'truck' };
    this.spawnItems();
  }

  private addStatic(c: Collider): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    if (c.kind === 'box') {
      const q = yawQuat(c.rot ?? 0);
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z).setRotation(q).setFriction(0.8), body);
    } else {
      const hh = (c.y1 - c.y0) / 2;
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(hh, c.r).setTranslation(c.x, c.y0 + hh, c.z), body);
    }
  }

  private spawnItems(): void {
    // IDs seguem a ordem do plano (o cliente usa a mesma ordem). A distribuição
    // nos pontos prioriza pesados no térreo e leves no 2º andar (sobrado).
    const kinds = this.plan.items;
    const order = kinds.map((k, i) => i).sort((a, b) => ITEMS[kinds[b]].carriers - ITEMS[kinds[a]].carriers);
    const spots = [...this.map.itemSpots];
    let seed = 1234 + kinds.length;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    const upstairs = spots.filter((s) => s.floor === 1);
    const ground = spots.filter((s) => s.floor === 0);
    const placed = new Map<number, (typeof spots)[number]>();
    order.forEach((idx, n) => {
      const def = ITEMS[kinds[idx]];
      let spot = def.carriers === 1 && upstairs.length && (n % 2 === 0 || !ground.length) ? upstairs.shift() : ground.shift() ?? upstairs.shift();
      if (!spot) spot = { x: this.map.houses[0].x + (n % 4) - 2, y: 0.32, z: this.map.houses[0].z + Math.floor(n / 4) - 2, floor: 0 };
      placed.set(idx, spot);
    });
    kinds.forEach((kind, i) => {
      const def = ITEMS[kind];
      const spot = placed.get(i)!;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(spot.x, spot.y + def.hy + 0.02, spot.z).setRotation(yawQuat(rnd() * 0.6 - 0.3)).setLinearDamping(0.4).setAngularDamping(0.8).setCcdEnabled(true),
      );
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(def.hx, def.hy, def.hz).setMass(def.mass).setFriction(0.7).setRestitution(0.05), body);
      this.items.push({ id: i + 1, kind, body, state: 'free', carriers: [], broken: false, damage: 0, lastV: { x: 0, y: 0, z: 0 }, slot: -1, room: null, sent: '', lastCarrier: null, restT: 0 });
    });
  }

  colliders(): Collider[] { return this.map.colliders; }
  arrivalPose(): Pose { return MUDANCA_ARRIVAL; }
  spawn(i: number) {
    const s = this.map.spawns[i % this.map.spawns.length];
    return { x: s.x, y: 0, z: s.z, yaw: Math.PI };
  }

  /* ------------------------------ estado ------------------------------ */

  state(): unknown {
    return {
      plan: { layout: this.plan.layout, items: this.plan.items, timeSec: this.plan.timeSec, quota: this.plan.quota, cap: this.plan.truckCapacity, roomsMatter: this.plan.roomsMatter, hints: this.plan.hints, rain: this.plan.rain },
      items: this.items.map((it) => this.itemRow(it)),
      truck: this.truckRow(),
      startAt: this.startAt, endsAt: this.endsAt, started: this.started,
      score: this.scoreInfo(),
    };
  }

  private itemRow(it: Item): (number | string)[] {
    const t = it.body.translation(), q = it.body.rotation();
    let flags = 0;
    if (it.state === 'carried') flags |= FLAG.carried;
    if (it.state === 'waiting') flags |= FLAG.waiting;
    if (it.state === 'loaded') flags |= FLAG.loaded;
    if (it.state === 'delivered') flags |= FLAG.delivered;
    if (it.broken) flags |= FLAG.broken;
    if (it.room && ITEMS[it.kind].room === it.room) flags |= FLAG.rightRoom;
    return [it.id, r2(t.x), r2(t.y), r2(t.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w), flags, it.carriers.join(','), Math.round(it.damage * 100), it.slot];
  }

  private truckRow(): number[] {
    return [r2(this.truck.x), r2(this.truck.z), r3(this.truck.yaw), r2(this.truck.speed), this.driver, this.loaded.length];
  }

  delta(): unknown {
    const items: unknown[] = [];
    for (const it of this.items) {
      const row = this.itemRow(it);
      const key = row.join('|');
      if (key !== it.sent) { it.sent = key; items.push(row); }
    }
    const ev = this.events;
    this.events = [];
    return { i: items, t: this.truckRow(), s: this.scoreInfo(), e: ev.length ? ev : undefined, endsAt: this.endsAt, started: this.started };
  }

  private scoreInfo() {
    let total = 0, delivered = 0, broken = 0, count = 0, right = 0;
    for (const it of this.items) {
      const v = ITEMS[it.kind].value;
      total += v;
      if (it.broken) broken++;
      if (it.state === 'delivered' && !it.broken) {
        const val = v * (1 - it.damage);
        const bonus = this.plan.roomsMatter && it.room === ITEMS[it.kind].room ? 1.25 : 1;
        delivered += val * bonus;
        count++;
        if (it.room === ITEMS[it.kind].room) right++;
      }
    }
    return { total, delivered: Math.round(delivered), broken, count, of: this.items.length, right, trips: this.trips, loaded: this.loaded.length };
  }

  private emit(e: string, d: unknown): void {
    this.events.push({ e, d });
  }

  /* ------------------------------ ciclo ------------------------------ */

  start(now: number): void {
    this.started = true;
    this.startAt = now + 3000;
    // PV_GAME_TIME (s) encurta a partida — apenas para testes automatizados
    const override = Number(process.env.PV_GAME_TIME ?? 0);
    this.endsAt = this.startAt + (override > 0 ? override : this.plan.timeSec) * 1000;
    if (!this.dynAdded) { this.match.addDynamic(this.truckCollider); this.dynAdded = true; }
    this.emit('countdown', { at: this.startAt });
  }

  tick(dt: number, now: number): void {
    // jogadores -> cápsulas cinemáticas
    for (const p of this.match.players.values()) {
      let b = this.playerBodies.get(p.id);
      if (!b) {
        b = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + 0.9, p.z));
        this.world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.36), b);
        this.playerBodies.set(p.id, b);
      }
      const away = p.plat !== 0 || p.locked;
      b.setNextKinematicTranslation(away ? { x: 0, y: -100 - p.id * 3, z: 0 } : { x: p.x, y: p.y + 0.9, z: p.z });
    }
    for (const [id, b] of this.playerBodies) if (!this.match.players.has(id)) { this.world.removeRigidBody(b); this.playerBodies.delete(id); }

    this.tickTruck(dt, now);
    this.tickCarry();
    this.world.step();
    this.tickItems(dt);
    if (this.finished || !this.started) return;
    if (now >= this.endsAt) this.finish(false);
    else {
      const remaining = this.items.filter((it) => !it.broken && it.state !== 'delivered');
      if (remaining.length === 0) this.finish(true);
    }
  }

  private tickTruck(dt: number, now: number): void {
    const d = this.driver ? this.match.players.get(this.driver) : null;
    if (this.driver && (!d || !d.connected)) this.exitTruck(d ?? null);
    const inp = this.driver && now - this.driveInput.at < 600 ? this.driveInput : { throttle: 0, steer: 0 };
    const before = this.truck.speed;
    const grip = this.plan.rain ? 0.75 : 1;
    stepTruck(this.truck, inp, dt, { push: (x, z, r) => pushCircle(this.staticCol, x, z, r) }, grip);
    // batida forte => itens no baú sofrem
    const impact = Math.abs(before) - Math.abs(this.truck.speed);
    if (Math.abs(before) > 6 && impact > 5 && now - this.lastTruckHit > 800) {
      this.lastTruckHit = now;
      this.emit('crash', { x: this.truck.x, z: this.truck.z, v: Math.round(Math.abs(before)) });
      for (const id of this.loaded) {
        const it = this.items.find((x) => x.id === id)!;
        if (ITEMS[it.kind].fragile && Math.random() < 0.45) this.breakItem(it, 'crash');
        else it.damage = Math.min(0.6, it.damage + 0.1);
      }
    }
    this.truckBody.setNextKinematicTranslation({ x: this.truck.x, y: 1.7, z: this.truck.z });
    this.truckBody.setNextKinematicRotation(yawQuat(this.truck.yaw));
    this.truckCollider.x = this.truck.x;
    this.truckCollider.z = this.truck.z;
    this.truckCollider.rot = this.truck.yaw;
    if (d) {
      // motorista no banco (cabine na frente do caminhão)
      const fx = Math.sin(this.truck.yaw), fz = Math.cos(this.truck.yaw);
      const rx = -fz, rz = fx;
      d.x = this.truck.x + fx * 2.3 + rx * -0.55;
      d.z = this.truck.z + fz * 2.3 + rz * -0.55;
      d.y = 1.0;
      d.yaw = this.truck.yaw;
      d.anim = 'drive';
      const st = this.stat(d);
      st.driven += Math.abs(this.truck.speed) * dt;
    }
    // itens carregados seguem o caminhão
    this.loaded.forEach((id, k) => {
      const it = this.items.find((x) => x.id === id)!;
      const [lx, ly, lz] = slotPos(k);
      const c = Math.cos(this.truck.yaw), s = Math.sin(this.truck.yaw);
      it.body.setNextKinematicTranslation({ x: this.truck.x + lx * c + lz * s, y: ly, z: this.truck.z - lx * s + lz * c });
      it.body.setNextKinematicRotation(yawQuat(this.truck.yaw));
    });
    // contagem de viagens (chegou na casa nova com carga)
    const atNew = Math.hypot(this.truck.x - this.map.parkNew.x, this.truck.z - this.map.parkNew.z) < 14;
    if (atNew && !this.wasAtNew && this.loaded.length) { this.trips++; this.emit('trip', { n: this.trips }); }
    this.wasAtNew = atNew;
  }

  private tickCarry(): void {
    for (const it of this.items) {
      if (it.state !== 'carried' && it.state !== 'waiting') continue;
      const ps = it.carriers.map((id) => this.match.players.get(id)).filter((p): p is WPlayer => !!p && p.connected && p.plat === 0);
      if (ps.length !== it.carriers.length) { this.release(it, false); continue; }
      const def = ITEMS[it.kind];
      if (it.state === 'waiting') {
        // aguardando parceiro: se o único carregador se afastar, solta
        const p = ps[0];
        const t = it.body.translation();
        if (Math.hypot(p.x - t.x, p.z - t.z) > Math.max(def.hx, def.hz) + 2.2) this.release(it, false);
        continue;
      }
      let x: number, y: number, z: number, yaw: number;
      if (ps.length === 1) {
        const p = ps[0];
        const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
        const off = 0.55 + def.hz;
        x = p.x + fx * off; z = p.z + fz * off; y = p.y + 1.05 + def.hy * 0.4; yaw = p.yaw;
      } else {
        const [a, b] = ps;
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        if (dist > Math.max(def.hx, def.hz) * 2 + 3.2 || Math.abs(a.y - b.y) > 2.4) { this.release(it, true); this.emit('slip', { id: it.id }); continue; }
        x = (a.x + b.x) / 2; z = (a.z + b.z) / 2; y = (a.y + b.y) / 2 + 0.95 + def.hy * 0.3;
        yaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
      }
      it.body.setNextKinematicTranslation({ x, y, z });
      it.body.setNextKinematicRotation(yawQuat(yaw));
    }
  }

  private tickItems(dt: number): void {
    for (const it of this.items) {
      const t = it.body.translation();
      if (t.y < -15) {
        // caiu do mapa: volta para a casa antiga (quebrado)
        this.breakItem(it, 'fall');
        it.body.setTranslation({ x: this.map.houses[0].x, y: 1.5, z: this.map.houses[0].z }, true);
        it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      if (it.state !== 'free' && it.state !== 'delivered') { it.lastV = { x: 0, y: 0, z: 0 }; continue; }
      const v = it.body.linvel();
      const dv = Math.hypot(v.x - it.lastV.x, v.y - it.lastV.y, v.z - it.lastV.z);
      const def = ITEMS[it.kind];
      if (!it.broken && dv > this.plan.breakSpeed) {
        if (def.fragile) this.breakItem(it, 'impact');
        else if (dv > this.plan.breakSpeed * 1.5) { it.damage = Math.min(0.6, it.damage + 0.2); this.emit('dent', { id: it.id }); }
      }
      it.lastV = { x: v.x, y: v.y, z: v.z };
      // entrega: em repouso dentro da casa nova
      const speed = Math.hypot(v.x, v.y, v.z);
      it.restT = speed < 0.4 ? it.restT + dt : 0;
      const nh = this.map.houses[1];
      const inside = insideHouse(nh, t.x, t.z) && t.y < 3;
      if (it.state === 'free' && inside && it.restT > 0.4) {
        it.state = 'delivered';
        const room = inRoom(nh, t.x, t.z, t.y - def.hy);
        it.room = room?.name ?? null;
        if (it.lastCarrier) this.statByUser(it.lastCarrier).delivered++;
        this.emit('delivered', { id: it.id, room: it.room, right: it.room === def.room });
      } else if (it.state === 'delivered' && !inside) {
        it.state = 'free';
        it.room = null;
      }
    }
  }

  private breakItem(it: Item, why: string): void {
    if (it.broken) return;
    it.broken = true;
    const t = it.body.translation();
    if (it.lastCarrier) this.statByUser(it.lastCarrier).breaks++;
    this.emit('break', { id: it.id, x: t.x, y: t.y, z: t.z, why });
  }

  /* ------------------------------ ações ------------------------------ */

  private stat(p: WPlayer) { return this.statByUser(p.session.id); }
  private statByUser(uid: string) {
    let s = this.stats.get(uid);
    if (!s) this.stats.set(uid, (s = { carried: 0, delivered: 0, driven: 0, breaks: 0 }));
    return s;
  }

  private carrying(p: WPlayer): Item | undefined {
    return this.items.find((it) => (it.state === 'carried' || it.state === 'waiting') && it.carriers.includes(p.id));
  }

  speedMul(p: WPlayer): number {
    const it = this.carrying(p);
    return it && it.state === 'carried' ? ITEMS[it.kind].speed : 1;
  }

  onInteract(p: WPlayer, id: string): void {
    if (this.finished || !this.started || p.plat !== 0) return;
    if (id === 'truck:drive') return this.enterTruck(p);
    if (id === 'truck:exit') return this.exitTruck(p);
    if (p.id === this.driver) return;
    const holding = this.carrying(p);
    if (id === 'drop') { if (holding) this.release(holding, false, p); return; }
    if (id === 'truck:load') { if (holding) this.load(p, holding); return; }
    if (id === 'truck:unload') { if (!holding) this.unload(p); return; }
    if (id.startsWith('item:')) {
      const dbg = (why: string) => { if (process.env.PV_DEBUG) console.log('[mudanca] pegar rejeitado', id, 'p', p.id, why); };
      if (holding) return dbg('já segurando ' + holding.id);
      const it = this.items.find((x) => x.id === Number(id.slice(5)));
      if (!it || it.state === 'loaded') return dbg('estado');
      const t = it.body.translation();
      const def = ITEMS[it.kind];
      if (Math.hypot(p.x - t.x, p.z - t.z) > Math.max(def.hx, def.hz) + 1.9 || Math.abs(p.y + 0.8 - t.y) > 2.2) return dbg(`distância p=(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}) t=(${t.x.toFixed(1)},${t.y.toFixed(1)},${t.z.toFixed(1)})`);
      if (it.state === 'carried' && (def.carriers === 1 || it.carriers.length >= 2)) return;
      if (it.state === 'delivered') { it.state = 'free'; it.room = null; }
      it.carriers.push(p.id);
      p.carry = it.id;
      it.lastCarrier = p.session.id;
      this.stat(p).carried++;
      if (def.carriers === 2 && it.carriers.length < 2) {
        it.state = 'waiting';
        this.emit('needHelp', { id: it.id, by: p.id });
      } else {
        it.state = 'carried';
        it.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        this.emit('pickup', { id: it.id });
      }
    }
  }

  onAct(p: WPlayer, a: string, d: unknown): void {
    if (a === 'drive' && p.id === this.driver && d && typeof d === 'object') {
      const o = d as { th?: unknown; st?: unknown };
      this.driveInput = { throttle: num(o.th), steer: num(o.st), at: Date.now() };
    }
    if (a === 'honk' && p.id === this.driver) this.emit('honk', { x: this.truck.x, z: this.truck.z });
    // apenas em testes automatizados (PV_DEBUG): encerra a partida agora
    if (a === 'debug:end' && process.env.PV_DEBUG && !this.finished) this.finish(false);
  }

  /** solta o item; `tumble` => cai sem cuidado (pode quebrar); senão é pousado no chão */
  private release(it: Item, tumble: boolean, by?: WPlayer): void {
    for (const cid of it.carriers) { const cp = this.match.players.get(cid); if (cp) cp.carry = 0; }
    const wasCarried = it.state === 'carried';
    it.carriers = [];
    it.state = 'free';
    if (!wasCarried) return;
    it.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const def = ITEMS[it.kind];
    const t = it.body.translation();
    if (!tumble) {
      // pousa suavemente: procura o chão logo abaixo
      const ray = new RAPIER.Ray({ x: t.x, y: t.y + 0.1, z: t.z }, { x: 0, y: -1, z: 0 });
      const hit = this.world.castRay(ray, 6, true, undefined, undefined, undefined, it.body);
      const gy = hit ? t.y + 0.1 - hit.timeOfImpact : 0;
      it.body.setTranslation({ x: t.x, y: gy + def.hy + 0.03, z: t.z }, true);
      it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      it.lastV = { x: 0, y: 0, z: 0 };
      this.emit('place', { id: it.id, by: by?.id });
    } else {
      it.body.setLinvel({ x: (Math.random() - 0.5) * 2, y: 1, z: (Math.random() - 0.5) * 2 }, true);
      it.lastV = { x: 0, y: 0, z: 0 };
    }
  }

  private truckParked(): boolean {
    return Math.abs(this.truck.speed) < 0.8;
  }

  private loadPoint(): { x: number; z: number } {
    return { x: this.truck.x + Math.sin(this.truck.yaw) * TRUCK.loadZ, z: this.truck.z + Math.cos(this.truck.yaw) * TRUCK.loadZ };
  }

  private load(p: WPlayer, it: Item): void {
    const lp = this.loadPoint();
    if (!this.truckParked() || Math.hypot(p.x - lp.x, p.z - lp.z) > TRUCK.loadR + 1) return;
    if (this.loaded.length >= this.plan.truckCapacity) { p.session.send({ t: 'toast', msg: 'O caminhão está cheio! Leve esta carga até a casa nova.', kind: 'warn' }); return; }
    for (const cid of it.carriers) { const cp = this.match.players.get(cid); if (cp) cp.carry = 0; }
    it.carriers = [];
    it.state = 'loaded';
    it.slot = this.loaded.length;
    this.loaded.push(it.id);
    it.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.emit('loaded', { id: it.id, n: this.loaded.length });
  }

  private unload(p: WPlayer): void {
    const lp = this.loadPoint();
    if (!this.truckParked() || Math.hypot(p.x - lp.x, p.z - lp.z) > TRUCK.loadR + 1 || !this.loaded.length) return;
    const id = this.loaded.pop()!;
    const it = this.items.find((x) => x.id === id)!;
    it.slot = -1;
    const def = ITEMS[it.kind];
    it.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const bx = this.truck.x + Math.sin(this.truck.yaw) * (TRUCK.loadZ - 0.8 - def.hz);
    const bz = this.truck.z + Math.cos(this.truck.yaw) * (TRUCK.loadZ - 0.8 - def.hz);
    it.body.setTranslation({ x: bx, y: def.hy + 0.05, z: bz }, true);
    it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    it.lastV = { x: 0, y: 0, z: 0 };
    it.state = 'free';
    // itens leves vão direto para as mãos
    if (def.carriers === 1) {
      it.state = 'carried';
      it.carriers = [p.id];
      p.carry = it.id;
      it.lastCarrier = p.session.id;
      it.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    } else {
      p.session.send({ t: 'toast', msg: `${def.name} é pesado: chame alguém para ajudar!`, kind: 'info' });
    }
    this.emit('unloaded', { id: it.id });
  }

  private enterTruck(p: WPlayer): void {
    if (this.driver || this.carrying(p)) return;
    const fx = Math.sin(this.truck.yaw), fz = Math.cos(this.truck.yaw);
    const cabX = this.truck.x + fx * 2.3, cabZ = this.truck.z + fz * 2.3;
    if (Math.hypot(p.x - cabX, p.z - cabZ) > 4.5) return;
    this.driver = p.id;
    p.locked = true;
    p.anim = 'drive';
    this.driveInput = { throttle: 0, steer: 0, at: Date.now() };
    this.emit('driver', { id: p.id });
  }

  private exitTruck(p: WPlayer | null): void {
    if (!this.driver) return;
    if (p && p.id !== this.driver) return;
    this.driver = 0;
    this.truck.speed = 0;
    if (p) {
      const fx = Math.sin(this.truck.yaw), fz = Math.cos(this.truck.yaw);
      const rx = -fz, rz = fx;
      p.locked = false;
      p.anim = 'idle';
      let x = this.truck.x + fx * 2.0 - rx * (TRUCK.hx + 1.0);
      let z = this.truck.z + fz * 2.0 - rz * (TRUCK.hx + 1.0);
      const push = pushCircle(this.match.mapCol, x, z, 0.4, 0.6, this.truckCollider);
      if (push) { x += push[0]; z += push[1]; }
      this.match.teleport(p, x, 0, z, 0, this.truck.yaw);
    }
    this.emit('driver', { id: 0 });
  }

  /* ------------------------------ robô ajudante ------------------------------ */

  /** rota até o alvo passando pela porta e pelo vão da divisória das casas */
  private route(fx: number, fz: number, tx: number, tz: number): { x: number; z: number }[] {
    const houseAt = (x: number, z: number) => this.map.houses.find((h) => insideHouse(h, x, z)) ?? null;
    const hf = houseAt(fx, fz), ht = houseAt(tx, tz);
    const pts: { x: number; z: number }[] = [];
    const midZ = (h: typeof hf) => h!.z - h!.d * 0.1;
    const exit = (h: NonNullable<typeof hf>, z: number) => {
      if (z > midZ(h)) pts.push({ x: h.x, z: midZ(h) + 1 }, { x: h.x, z: midZ(h) - 1 });
      pts.push({ x: h.doorX, z: h.z - h.d / 2 + 1.2 }, { x: h.doorX, z: h.z - h.d / 2 - 1.8 });
    };
    const enter = (h: NonNullable<typeof hf>, z: number) => {
      pts.push({ x: h.doorX, z: h.z - h.d / 2 - 1.8 }, { x: h.doorX, z: h.z - h.d / 2 + 1.2 });
      if (z > midZ(h)) pts.push({ x: h.x, z: midZ(h) - 1 }, { x: h.x, z: midZ(h) + 1 });
    };
    if (hf && hf === ht) {
      if ((fz > midZ(hf)) !== (tz > midZ(hf))) {
        const side = fz > midZ(hf) ? 1 : -1;
        pts.push({ x: hf.x, z: midZ(hf) + side }, { x: hf.x, z: midZ(hf) - side });
      }
    } else {
      if (hf) exit(hf, fz);
      if (ht) enter(ht, tz);
    }
    pts.push({ x: tx, z: tz });
    return pts;
  }

  /** segue a rota até (tx,tz); devolve a distância ao alvo final */
  private botGo(p: WPlayer, tx: number, tz: number, move: (x: number, z: number) => number): number {
    const key = `${tx.toFixed(1)},${tz.toFixed(1)}`;
    let path = p.data.path as { x: number; z: number }[] | undefined;
    if (p.data.pathKey !== key || !path || !path.length || ((p.data.pathAge as number) ?? 0) > 3) {
      path = this.route(p.x, p.z, tx, tz);
      p.data.path = path; p.data.pathKey = key; p.data.pathAge = 0;
    }
    p.data.pathAge = ((p.data.pathAge as number) ?? 0) + 1 / 30;
    while (path.length > 1 && Math.hypot(path[0].x - p.x, path[0].z - p.z) < 0.8) path.shift();
    const d = move(path[0].x, path[0].z);
    return path.length === 1 ? d : Math.hypot(tx - p.x, tz - p.z);
  }

  botThink(p: WPlayer, _dt: number, move: (x: number, z: number) => number, act: (id: string) => void): void {
    if (!this.started || this.finished || Date.now() < this.startAt) { p.anim = 'idle'; return; }
    const mine = this.carrying(p);
    // 1) carregando junto com alguém: acompanha o parceiro, que conduz
    if (mine && mine.carriers.length === 2) {
      const partner = this.match.players.get(mine.carriers.find((c) => c !== p.id)!);
      if (partner) {
        const def = ITEMS[mine.kind];
        const want = Math.max(def.hx, def.hz) * 2 + 0.3;
        const dx = p.x - partner.x, dz = p.z - partner.z;
        const d = Math.hypot(dx, dz) || 1;
        move(partner.x + (dx / d) * want, partner.z + (dz / d) * want);
      }
      return;
    }
    // aguardando ajuda num item pesado: fica parado
    if (mine && mine.state === 'waiting') { p.anim = 'idle'; return; }
    const lp = this.loadPoint();
    const nh = this.map.houses[1];
    const truckAtNew = Math.hypot(this.truck.x - this.map.parkNew.x, this.truck.z - this.map.parkNew.z) < 14;
    // 2) carregando sozinho um item leve
    if (mine) {
      if (truckAtNew || this.loaded.length >= this.plan.truckCapacity) {
        // leva para dentro da casa nova
        const d = this.botGo(p, nh.x + 3, nh.z + 2, move);
        if (d < 1.2) act('drop');
      } else if (this.truckParked()) {
        const d = this.botGo(p, lp.x, lp.z, move);
        if (d < TRUCK.loadR) act('truck:load');
      } else p.anim = 'carry';
      return;
    }
    // 3) alguém (humano) esperando ajuda num item pesado: vai pelo outro lado
    for (const it of this.items) {
      if (it.state !== 'waiting' || it.carriers.includes(p.id)) continue;
      const helper = this.match.players.get(it.carriers[0]);
      if (!helper || helper.session.isBot) continue;
      const t = it.body.translation();
      const def = ITEMS[it.kind];
      const dx = t.x - helper.x, dz = t.z - helper.z;
      const d0 = Math.hypot(dx, dz) || 1;
      const r = Math.max(def.hx, def.hz) + 0.9;
      const d = this.botGo(p, t.x + (dx / d0) * r, t.z + (dz / d0) * r, move);
      if (d < 1.4 || Math.hypot(t.x - p.x, t.z - p.z) < Math.max(def.hx, def.hz) + 1.6) act(`item:${it.id}`);
      return;
    }
    // 4) caminhão na casa nova com carga: descarrega
    if (truckAtNew && this.loaded.length && this.truckParked()) {
      const d = this.botGo(p, lp.x, lp.z, move);
      if (d < TRUCK.loadR) act('truck:unload');
      return;
    }
    // 5) busca o item leve livre mais próximo na casa antiga (térreo)
    const old = this.map.houses[0];
    let best: Item | null = null, bd = Infinity;
    const skip = (p.data.skip as Record<number, number> | undefined) ?? {};
    for (const it of this.items) {
      const def = ITEMS[it.kind];
      if (it.state !== 'free' || it.broken || def.carriers !== 1 || (skip[it.id] ?? 0) > Date.now()) continue;
      const t = it.body.translation();
      if (!insideHouse(old, t.x, t.z) || t.y > 2.5) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) {
      // nada a fazer: acompanha o humano mais próximo
      let h: WPlayer | null = null, hd = Infinity;
      for (const q of this.match.players.values()) if (!q.session.isBot && !q.locked) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < hd) { hd = d; h = q; } }
      if (h && hd > 3) this.botGo(p, h.x, h.z, move); else p.anim = 'idle';
      return;
    }
    const t = best.body.translation();
    const def = ITEMS[best.kind];
    if (p.data.target !== best.id) { p.data.target = best.id; p.data.targetSince = Date.now(); }
    if (Date.now() - (p.data.targetSince as number) > 25_000) { skip[best.id] = Date.now() + 30_000; p.data.skip = skip; p.data.target = null; return; }
    const d = this.botGo(p, t.x, t.z, move);
    if (d < Math.max(def.hx, def.hz) + 1.2) act(`item:${best.id}`);
  }

  onPlayerLeave(p: WPlayer): void {
    const it = this.carrying(p);
    if (it) this.release(it, true);
    if (p.id === this.driver) this.exitTruck(p);
    const b = this.playerBodies.get(p.id);
    if (b) { this.world.removeRigidBody(b); this.playerBodies.delete(p.id); }
  }

  /* ------------------------------ fim ------------------------------ */

  private finish(allDone: boolean): void {
    const s = this.scoreInfo();
    const pct = s.delivered / s.total;
    const win = pct >= this.plan.quota;
    const timeLeft = Math.max(0, Math.round((this.endsAt - Date.now()) / 1000));
    let stars = 0;
    if (win) stars = 1;
    if (win && pct >= 0.85) stars = 2;
    if (win && pct >= 0.95 && s.broken <= 1) stars = 3;
    const score = Math.max(0, s.delivered + (win ? timeLeft * 5 : 0) - s.broken * 50);
    const flags: string[] = [];
    if (win && s.broken === 0) flags.push('noBreaks');
    const mvp: { userId: string; title: string }[] = [];
    const arr = [...this.stats.entries()];
    const best = (k: 'delivered' | 'driven' | 'carried') => arr.sort((a, b) => b[1][k] - a[1][k])[0];
    const bd = best('delivered'); if (bd && bd[1].delivered > 0) mvp.push({ userId: bd[0], title: `Mais entregas (${bd[1].delivered})` });
    const dr = best('driven'); if (dr && dr[1].driven > 20) mvp.push({ userId: dr[0], title: `Motorista (${Math.round(dr[1].driven)} m)` });
    this.finished = {
      win, score, stars, flags, mvp,
      summary: [
        { label: 'Itens entregues', value: `${s.count}/${s.of}` },
        { label: 'Valor entregue', value: `${Math.round(pct * 100)}% (meta ${Math.round(this.plan.quota * 100)}%)` },
        { label: 'Itens quebrados', value: String(s.broken) },
        { label: this.plan.roomsMatter ? 'Cômodo certo' : 'Viagens do caminhão', value: this.plan.roomsMatter ? `${s.right}/${s.count}` : String(s.trips) },
        { label: 'Tempo restante', value: `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` },
        { label: 'Pontuação', value: String(score) },
      ],
    };
    void allDone;
    // solta tudo
    for (const it of this.items) if (it.state === 'carried' || it.state === 'waiting') this.release(it, false);
    if (this.driver) this.exitTruck(this.match.players.get(this.driver) ?? null);
  }

  result(): GameResult | null { return this.finished; }

  dispose(): void {
    try { this.world.free(); } catch { /* já liberado */ }
  }
}

/** posição local de um slot dentro do baú (3 colunas x 2 camadas) */
export function slotPos(k: number): [number, number, number] {
  const col = k % 3, row = Math.floor(k / 3) % 4, layer = Math.floor(k / 12);
  return [(col - 1) * 1.1, 1.9 + layer * 1.0, -0.6 - row * 0.85];
}

function yawQuat(yaw: number) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
