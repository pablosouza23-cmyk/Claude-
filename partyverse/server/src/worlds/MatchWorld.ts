/**
 * Mundo de partida: viagem no Trem Voador + minigame.
 * Fases: boarding -> departing -> flight -> arrived -> game -> results.
 * A pose do trem é calculada de forma determinística a partir do cronograma,
 * então todos os clientes veem a mesma viagem.
 */
import { CollisionWorld, stepCharacter, type CharacterState, type Collider } from '../../../shared/collision';
import type { C2S } from '../../../shared/protocol';
import { GAMES } from '../../../shared/minigames';
import {
  DEPART_POSE, TRAIN, insideTrain, nearDoor, stationLocalColliders, stationSpawns, trainHullColliders, trainInteriorColliders,
  trainLocalToWorld, trainPose, trainSeats, trainWorldToLocal, transformColliders, type Pose, type TrainSchedule,
} from '../../../shared/train';
import type { Room } from '../rooms';
import type { Game } from '../Game';
import type { Session } from '../Session';
import type { GameResult, MinigameServer } from '../games/types';
import { World, type WPlayer } from './World';

// PV_FAST_TRAIN=1 encurta a viagem (apenas para testes automatizados)
const FAST = process.env.PV_FAST_TRAIN === '1';
const FLIGHT_MS = FAST ? 6_000 : 32_000;
const BOARD_TIMEOUT_MS = FAST ? 1_500 : 75_000;
const DISEMBARK_TIMEOUT_MS = FAST ? 1_500 : 30_000;
const DEPART_COUNTDOWN_MS = FAST ? 1_000 : 5_000;
const RESULTS_TIMEOUT_MS = 120_000;

export type MatchPhase = 'boarding' | 'departing' | 'flight' | 'arrived' | 'game' | 'results';

export class MatchWorld extends World {
  phase: MatchPhase = 'boarding';
  schedule: TrainSchedule;
  private trainCol: CollisionWorld;
  private departCol: CollisionWorld;
  private arriveCol: CollisionWorld;
  private phaseDeadline: number;
  private seats = new Map<string, number>(); // seatId -> player id
  private lights = 0;
  private resultSent: GameResult | null = null;
  private disposed = false;
  readonly startedWith: number;
  readonly memberIds: string[];

  minigame: MinigameServer;

  constructor(private game: Game, public room: Room) {
    super('match', new CollisionWorld([], null));
    this.minigame = game.factories[room.game]!({ match: this, difficulty: room.difficulty, players: room.members.size });
    this.startedWith = room.members.size;
    this.memberIds = [...room.members.keys()];
    const now = Date.now();
    const to = this.minigame.arrivalPose();
    this.schedule = { from: DEPART_POSE, to, departAt: now + 3_600_000, arriveAt: now + 3_600_000 + FLIGHT_MS, phase: 'boarding', doorsOpen: true, seed: Math.floor(Math.random() * 1e6) };
    this.trainCol = new CollisionWorld(trainInteriorColliders(true), null);
    const dep: Collider[] = [...transformColliders(stationLocalColliders(), DEPART_POSE), ...transformColliders(trainHullColliders(true), DEPART_POSE)];
    this.departCol = new CollisionWorld(dep, null);
    const arr: Collider[] = [...this.minigame.colliders(), ...transformColliders(stationLocalColliders(false), to), ...transformColliders(trainHullColliders(true), to)];
    this.arriveCol = new CollisionWorld(arr, null);
    this.col = this.departCol;
    this.phaseDeadline = now + BOARD_TIMEOUT_MS;
  }

  private setDoors(open: boolean): void {
    this.schedule.doorsOpen = open;
    for (const w of [this.trainCol, this.departCol, this.arriveCol]) for (const c of w.colliders) if (c.id === 'doorleaf') c.disabled = open;
  }

  /** colisor móvel no mapa de destino (ex.: caminhão) */
  addDynamic(c: Collider): void {
    this.arriveCol.addDynamic(c);
  }

  /** acesso ao mundo de colisão do mapa (consultas do minigame) */
  get mapCol(): CollisionWorld {
    return this.arriveCol;
  }

  pose(now = Date.now()): Pose {
    return trainPose(this.schedule, now);
  }

  collisionFor(p: WPlayer): CollisionWorld {
    return p.plat === 1 ? this.trainCol : this.col;
  }

  spawnPoint(s: Session) {
    const idx = this.memberIds.indexOf(s.id);
    if (this.phase === 'game' || this.phase === 'results') {
      const sp = this.minigame.spawn(Math.max(0, idx));
      return { ...sp, plat: 0 as const };
    }
    if (this.phase === 'boarding' || this.phase === 'arrived') {
      const pose = this.phase === 'boarding' ? DEPART_POSE : this.schedule.to;
      const sp = stationSpawns(10)[Math.max(0, idx) % 10];
      const [x, y, z] = trainLocalToWorld(pose, sp.x, 0, sp.z);
      return { x, y, z, yaw: pose.yaw + Math.PI, plat: 0 as const };
    }
    // em voo: nasce dentro do trem
    return { x: -6 + (idx % 5) * 2, y: 0, z: 0, yaw: Math.PI / 2, plat: 1 as const };
  }

  extraEnter() {
    return { game: this.minigame.id, difficulty: this.room.difficulty };
  }

  stateFor(): unknown {
    return { train: this.trainState(), game: this.minigame.state(), phase: this.phase, result: this.resultSent };
  }

  private trainState() {
    return {
      phase: this.schedule.phase, doorsOpen: this.schedule.doorsOpen, departAt: this.schedule.departAt, arriveAt: this.schedule.arriveAt,
      from: this.schedule.from, to: this.schedule.to, seed: this.schedule.seed, seats: Object.fromEntries(this.seats), lights: this.lights,
      deadline: this.phaseDeadline,
    };
  }

  worldDelta(): unknown {
    return { ph: this.phase, tr: this.trainState(), g: this.phase === 'game' || this.phase === 'results' ? this.minigame.delta() : undefined };
  }

  onJoin(p: WPlayer): void {
    p.speedMul = 1;
  }

  onLeave(p: WPlayer): void {
    this.standUp(p, false);
    this.minigame.onPlayerLeave(p);
  }

  /* ----------------------------- plataforma ----------------------------- */

  private docked(): boolean {
    return this.phase === 'boarding' || this.phase === 'arrived' || this.phase === 'game' || this.phase === 'results';
  }

  platformChange(p: WPlayer, m: Extract<C2S, { t: 'move' }>): boolean {
    if (!this.docked() || !this.schedule.doorsOpen) return false;
    const pose = this.pose();
    if (m.plat === 1 && p.plat === 0) {
      const [lx, , lz] = trainWorldToLocal(pose, p.x, p.y, p.z);
      if (!nearDoor(lx, lz) && !insideTrain(lx, lz)) return false;
      if (!insideTrain(m.x, m.z)) return false;
      p.plat = 1; p.x = m.x; p.y = m.y; p.z = m.z; p.lastMoveAt = Date.now();
      return true;
    }
    if (m.plat === 0 && p.plat === 1) {
      if (p.z < TRAIN.innerHalfWidth - 0.9) return false;
      const [lx, , lz] = trainWorldToLocal(pose, m.x, m.y, m.z);
      if (!nearDoor(lx, lz)) return false;
      p.plat = 0; p.x = m.x; p.y = m.y; p.z = m.z; p.lastMoveAt = Date.now();
      return true;
    }
    return false;
  }

  /* ----------------------------- assentos ----------------------------- */

  sitDown(p: WPlayer, seatId: string): void {
    const seat = trainSeats().find((s) => s.id === seatId);
    if (!seat || p.plat !== 1 || this.seats.has(seatId) || p.carry) return;
    if (Math.hypot(p.x - seat.x, p.z - seat.z) > 2.2) return;
    this.standUp(p, false);
    this.seats.set(seatId, p.id);
    p.seat = seatId;
    p.locked = true;
    p.x = seat.x; p.y = 0.05; p.z = seat.z; p.yaw = seat.yaw; p.anim = 'sit';
    this.correct(p);
  }

  private standUp(p: WPlayer, notify = true): void {
    if (!p.seat) return;
    const seat = trainSeats().find((s) => s.id === p.seat);
    this.seats.delete(p.seat);
    p.seat = null;
    p.locked = false;
    p.anim = 'idle';
    if (seat && notify) {
      p.x = seat.x + 0.1; p.y = 0; p.z = seat.z * 0.15; // vai para o corredor
      this.correct(p);
    }
  }

  onInteract(p: WPlayer, id: string, arg: unknown): void {
    if (id.startsWith('seat:')) return this.sitDown(p, id.slice(5));
    if (id === 'stand') return this.standUp(p);
    if (this.phase === 'game') this.minigame.onInteract(p, id, arg);
  }

  onAct(p: WPlayer, a: string, d: unknown): void {
    if (a === 'horn' && p.seat === 'pilot') {
      this.broadcast({ t: 'ev', e: 'horn' });
      return;
    }
    if (a === 'lights' && (p.seat === 'pilot' || p.seat === 'copilot')) {
      this.lights = (this.lights + 1) % 3;
      return;
    }
    if (this.phase === 'game') this.minigame.onAct(p, a, d);
  }

  /* ----------------------------- ciclo ----------------------------- */

  /* ----------------------------- robôs ----------------------------- */

  /** anda o robô em direção a (x,z) com a física compartilhada; devolve a distância */
  private botMove(p: WPlayer, x: number, z: number, dt: number): number {
    let st = p.data.botState as CharacterState | undefined;
    if (!st || p.data.botPlat !== p.plat) { st = { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, grounded: true }; p.data.botState = st; p.data.botPlat = p.plat; }
    st.x = p.x; st.y = p.y; st.z = p.z;
    const dx = x - p.x, dz = z - p.z;
    const d = Math.hypot(dx, dz);
    const mx = d > 0.3 ? dx / d : 0, mz = d > 0.3 ? dz / d : 0;
    stepCharacter(st, { mx, mz, sprint: d > 8 && !p.carry, jump: false, speedMul: p.speedMul }, dt, this.collisionFor(p));
    // destravar: se não andou, tenta um passo lateral
    const moved = Math.hypot(st.x - p.x, st.z - p.z);
    p.data.stuck = moved < 0.01 && d > 0.5 ? ((p.data.stuck as number) ?? 0) + dt : 0;
    if ((p.data.stuck as number) > 0.6) { st.x += -mz * 0.25; st.z += mx * 0.25; p.data.stuck = 0; }
    p.x = st.x; p.y = st.y; p.z = st.z;
    if (d > 0.3) p.yaw = Math.atan2(mx, mz);
    p.anim = d > 0.3 ? (p.carry ? 'carry-walk' : 'walk') : p.carry ? 'carry' : 'idle';
    return d;
  }

  private botTick(p: WPlayer, dt: number): void {
    if (p.locked && p.anim === 'drive') return;
    switch (this.phase) {
      case 'boarding':
        if (p.plat === 0) {
          // entra direto no trem e senta num assento livre
          const free = trainSeats().find((s) => !s.cockpit && !this.seats.has(s.id));
          this.teleport(p, free ? free.x + 0.6 : 0, 0, free ? free.z * 0.2 : 0, 1, Math.PI / 2);
          if (free) this.sitDown(p, free.id);
        }
        break;
      case 'arrived':
        if (p.plat === 1) {
          this.standUp(p, false);
          const sp = stationSpawns(10)[9];
          const [x, y, z] = trainLocalToWorld(this.pose(), sp.x, 0, sp.z);
          this.teleport(p, x, y, z, 0);
        }
        break;
      case 'game': {
        const mg = this.minigame;
        if (mg.botThink) mg.botThink(p, dt, (x, z) => this.botMove(p, x, z, dt), (id) => mg.onInteract(p, id, undefined));
        else {
          // sem IA específica: acompanha o humano mais próximo
          let best: WPlayer | null = null, bd = Infinity;
          for (const q of this.players.values()) if (!q.session.isBot && q.plat === 0) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
          if (best && bd > 3) this.botMove(p, best.x, best.z, dt); else p.anim = 'idle';
        }
        break;
      }
    }
  }

  tick(dt: number, now: number): void {
    if (this.disposed) return;
    for (const p of this.players.values()) if (p.session.isBot) { try { this.botTick(p, dt); } catch (e) { console.error('[robô]', e); } }
    const players = [...this.players.values()];
    const active = players.filter((p) => p.connected);
    switch (this.phase) {
      case 'boarding': {
        const allIn = active.length > 0 && active.every((p) => p.plat === 1);
        if (allIn || now > this.phaseDeadline) {
          if (!allIn) this.forceBoard(players);
          this.phase = 'departing';
          this.schedule.phase = 'departing';
          this.schedule.departAt = now + DEPART_COUNTDOWN_MS;
          this.schedule.arriveAt = this.schedule.departAt + FLIGHT_MS;
          this.phaseDeadline = this.schedule.departAt;
          this.broadcast({ t: 'ev', e: 'departing', d: { at: this.schedule.departAt } });
        }
        break;
      }
      case 'departing': {
        // se alguém saiu antes de as portas fecharem, volta ao embarque
        if (this.schedule.doorsOpen && active.some((p) => p.plat === 0)) {
          this.phase = 'boarding';
          this.schedule.phase = 'boarding';
          this.schedule.departAt = now + 3_600_000;
          this.phaseDeadline = now + BOARD_TIMEOUT_MS / 2;
          break;
        }
        if (this.schedule.doorsOpen && now > this.schedule.departAt - 2500) {
          this.forceBoard(players);
          this.setDoors(false);
        }
        if (now >= this.schedule.departAt) {
          this.phase = 'flight';
          this.schedule.phase = 'flight';
          this.col = this.arriveCol; // o mapa de destino passa a valer
          this.broadcast({ t: 'ev', e: 'takeoff' });
        }
        break;
      }
      case 'flight': {
        if (now >= this.schedule.arriveAt) {
          this.phase = 'arrived';
          this.schedule.phase = 'arrived';
          this.setDoors(true);
          this.phaseDeadline = now + DISEMBARK_TIMEOUT_MS;
          this.broadcast({ t: 'ev', e: 'arrived' });
          for (const p of players) this.standUp(p);
        }
        break;
      }
      case 'arrived': {
        const allOut = active.length > 0 && active.every((p) => p.plat === 0);
        if (allOut || now > this.phaseDeadline) {
          if (!allOut) this.forceDisembark(players);
          this.phase = 'game';
          this.schedule.phase = 'parked';
          this.minigame.start(now);
          this.broadcast({ t: 'ev', e: 'gameStart' });
        }
        break;
      }
      case 'game': {
        for (const p of players) p.speedMul = this.minigame.speedMul(p);
        this.minigame.tick(dt, now);
        const res = this.minigame.result();
        if (res) this.finish(res);
        break;
      }
      case 'results':
        this.minigame.tick(dt, now);
        // ninguém fica preso: após 2 min na tela de resultados, todos voltam ao lobby
        if (now - this.resultsAt > RESULTS_TIMEOUT_MS) for (const p of [...this.players.values()]) this.game.toLobby(p.session);
        break;
    }
  }

  private forceBoard(players: WPlayer[]): void {
    let i = 0;
    for (const p of players) {
      if (p.plat === 1) continue;
      this.standUp(p, false);
      this.teleport(p, -8 + (i % 6) * 2.4, 0, 0, 1, Math.PI / 2);
      i++;
    }
  }

  private forceDisembark(players: WPlayer[]): void {
    const pose = this.pose();
    const sp = stationSpawns(10);
    let i = 0;
    for (const p of players) {
      if (p.plat === 0) continue;
      this.standUp(p, false);
      const s = sp[i++ % sp.length];
      const [x, y, z] = trainLocalToWorld(pose, s.x, 0, s.z);
      this.teleport(p, x, y, z, 0);
    }
  }

  private resultsAt = 0;

  private finish(res: GameResult): void {
    this.phase = 'results';
    this.resultsAt = Date.now();
    this.resultSent = res;
    this.room.state = 'results';
    this.game.rooms.push(this.room);
    this.broadcast({ t: 'ev', e: 'results', d: res });
    for (const p of this.players.values()) this.game.awardMatch(p.session, this, res);
  }

  /** líder pede para jogar de novo: reinicia o minigame no mesmo mapa */
  playAgain(s: Session): void {
    if (this.phase !== 'results' || this.room.hostId !== s.id) return;
    const factory = this.game.factories[this.minigame.id];
    if (!factory) return;
    this.minigame.dispose();
    this.minigame = factory({ match: this, difficulty: this.room.difficulty, players: this.players.size });
    this.resultSent = null;
    let i = 0;
    for (const p of this.players.values()) {
      this.standUp(p, false);
      p.carry = 0;
      const sp = this.minigame.spawn(i++);
      this.teleport(p, sp.x, sp.y, sp.z, 0, sp.yaw);
    }
    this.room.state = 'playing';
    this.game.rooms.push(this.room);
    this.phase = 'game';
    for (const p of this.players.values()) this.sendEnter(p);
    this.minigame.start(Date.now());
    this.broadcast({ t: 'ev', e: 'gameStart' });
  }

  memberLeftRoom(s: Session): void {
    if (this.byUser.has(s.id)) {
      this.leave(s);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.minigame.dispose();
  }

  get gameName(): string {
    return GAMES[this.minigame.id].name;
  }
}
