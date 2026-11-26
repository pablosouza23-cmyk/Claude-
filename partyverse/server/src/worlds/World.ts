/**
 * Mundo autoritativo genérico: jogadores, validação de movimento, snapshots.
 * Lobby e Partida herdam desta classe.
 */
import { CHAR, CollisionWorld, resolvePosition } from '../../../shared/collision';
import type { AnimName } from '../../../shared/constants';
import type { C2S, Platform, PlayerInit, PlayerSnap, S2C, WorldKind } from '../../../shared/protocol';
import type { Session } from '../Session';
import { levelFromXp } from '../../../shared/progression';

export interface WPlayer {
  id: number;
  session: Session;
  x: number; y: number; z: number; yaw: number;
  anim: AnimName;
  plat: Platform;
  lastMoveAt: number;
  connected: boolean;
  /** id do objeto carregado (0 = nada) */
  carry: number;
  seat: string | null;
  /** quando true o servidor controla a posição (sentado, dirigindo, teleporte) */
  locked: boolean;
  speedMul: number;
  /** dados livres do minigame */
  data: Record<string, unknown>;
}

const ANIMS = new Set<AnimName>(['idle', 'walk', 'run', 'jump', 'fall', 'sit', 'drive', 'carry', 'carry-walk', 'interact', 'pick-up', 'emote-yes', 'emote-no', 'wave', 'die', 'crouch', 'tool']);

let worldSeq = 1;

export abstract class World {
  readonly id: string;
  readonly players = new Map<number, WPlayer>();
  readonly byUser = new Map<string, WPlayer>();
  private nextId = 1;
  col: CollisionWorld;

  constructor(public readonly kind: WorldKind, colliders: CollisionWorld) {
    this.id = `${kind}-${worldSeq++}`;
    this.col = colliders;
  }

  abstract spawnPoint(s: Session): { x: number; y: number; z: number; yaw: number; plat?: Platform };
  /** estado inicial específico enviado ao entrar/reconectar */
  stateFor(_p: WPlayer): unknown { return undefined; }
  /** delta incluído em cada snapshot */
  worldDelta(): unknown { return undefined; }
  extraEnter(): Partial<Extract<S2C, { t: 'world' }>> { return {}; }
  onInteract(_p: WPlayer, _id: string, _arg: unknown): void {}
  onAct(_p: WPlayer, _a: string, _d: unknown): void {}
  onLeave(_p: WPlayer): void {}
  onJoin(_p: WPlayer): void {}
  tick(_dt: number, _now: number): void {}
  /** colisão usada para validar um jogador numa plataforma */
  collisionFor(p: WPlayer): CollisionWorld { return p.plat === 0 ? this.col : this.col; }
  /** permite troca de plataforma (ex.: entrar no trem)? Deve converter coordenadas. */
  platformChange(_p: WPlayer, _m: Extract<C2S, { t: 'move' }>): boolean { return false; }

  get size(): number { return this.players.size; }

  init(p: WPlayer): PlayerInit {
    const u = p.session.user;
    return {
      id: p.id, userId: u.id, name: u.name, level: levelFromXp(u.xp).level, outfit: u.outfit,
      x: p.x, y: p.y, z: p.z, yaw: p.yaw, plat: p.plat, anim: p.anim, connected: p.connected,
    };
  }

  join(s: Session): WPlayer {
    if (s.world && s.world !== this) s.world.leave(s);
    const existing = this.byUser.get(s.id);
    if (existing) {
      existing.session = s;
      this.setConnected(s, true);
      this.sendEnter(existing);
      return existing;
    }
    const sp = this.spawnPoint(s);
    const p: WPlayer = {
      id: this.nextId++, session: s, x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw, anim: 'idle', plat: sp.plat ?? 0,
      lastMoveAt: Date.now(), connected: s.connected, carry: 0, seat: null, locked: false, speedMul: 1, data: {},
    };
    this.players.set(p.id, p);
    this.byUser.set(s.id, p);
    s.world = this;
    this.broadcast({ t: 'pjoin', p: this.init(p) }, p);
    this.onJoin(p);
    this.sendEnter(p);
    return p;
  }

  sendEnter(p: WPlayer): void {
    p.session.send({
      t: 'world', kind: this.kind, worldId: this.id, you: p.id,
      players: [...this.players.values()].map((q) => this.init(q)),
      state: this.stateFor(p),
      ...this.extraEnter(),
    });
  }

  leave(s: Session): void {
    const p = this.byUser.get(s.id);
    if (!p) return;
    this.onLeave(p);
    this.players.delete(p.id);
    this.byUser.delete(s.id);
    if (s.world === this) s.world = null;
    this.broadcast({ t: 'pleave', id: p.id });
  }

  setConnected(s: Session, connected: boolean): void {
    const p = this.byUser.get(s.id);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    this.broadcast({ t: 'pconn', id: p.id, connected }, p);
  }

  refreshProfile(s: Session): void {
    const p = this.byUser.get(s.id);
    if (!p) return;
    this.broadcast({ t: 'pout', id: p.id, outfit: s.user.outfit, name: s.user.name, level: levelFromXp(s.user.xp).level });
  }

  broadcast(msg: S2C, except?: WPlayer): void {
    const json = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p === except) continue;
      const ws = p.session.ws;
      if (ws && ws.readyState === 1) ws.send(json);
    }
  }

  correct(p: WPlayer): void {
    if (process.env.PV_DEBUG) console.log('[correct]', p.id, p.x.toFixed(2), p.z.toFixed(2), new Error().stack?.split('\n')[2]?.trim());
    p.session.send({ t: 'correct', x: p.x, y: p.y, z: p.z, plat: p.plat });
  }

  teleport(p: WPlayer, x: number, y: number, z: number, plat: Platform, yaw?: number): void {
    p.x = x; p.y = y; p.z = z; p.plat = plat;
    if (yaw !== undefined) p.yaw = yaw;
    p.lastMoveAt = Date.now();
    this.correct(p);
  }

  handleMove(p: WPlayer, m: Extract<C2S, { t: 'move' }>): void {
    if (p.locked) return;
    if (![m.x, m.y, m.z, m.yaw].every(Number.isFinite)) return;
    if (ANIMS.has(m.anim)) p.anim = m.anim;
    p.yaw = m.yaw;
    if (m.plat !== p.plat) {
      if (!this.platformChange(p, m)) { if (process.env.PV_DEBUG) console.log('[move] plataforma rejeitada', p.id, p.plat, '->', m.plat); this.correct(p); }
      return;
    }
    const now = Date.now();
    const dt = Math.min(1.0, Math.max(0.03, (now - p.lastMoveAt) / 1000));
    const maxH = CHAR.sprintSpeed * Math.max(1, p.speedMul) * 1.35 * dt + 0.8;
    const dh = Math.hypot(m.x - p.x, m.z - p.z);
    if (dh > maxH || Math.abs(m.y - p.y) > 12) {
      if (process.env.PV_DEBUG) console.log('[move] rejeitado (velocidade)', p.id, dh.toFixed(2), '>', maxH.toFixed(2));
      this.correct(p);
      return;
    }
    if (m.y < -25) {
      const sp = this.spawnPoint(p.session);
      this.teleport(p, sp.x, sp.y, sp.z, sp.plat ?? 0, sp.yaw);
      return;
    }
    const [rx, rz] = resolvePosition(this.collisionFor(p), m.x, m.y, m.z);
    if (Math.hypot(rx - m.x, rz - m.z) > 0.4) {
      if (process.env.PV_DEBUG) console.log('[move] rejeitado (parede)', p.id, m.x.toFixed(2), m.z.toFixed(2), '->', rx.toFixed(2), rz.toFixed(2));
      p.x = rx; p.z = rz; p.y = m.y;
      this.correct(p);
      return;
    }
    p.x = m.x; p.y = m.y; p.z = m.z;
    p.lastMoveAt = now;
    if (process.env.PV_DEBUG === '2') console.log('[move] ok', p.id, m.x.toFixed(2), m.z.toFixed(2));
  }

  snapshot(now: number): S2C {
    const arr: PlayerSnap[] = [];
    for (const p of this.players.values())
      arr.push([p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), p.anim, p.plat, p.carry]);
    const w = this.worldDelta();
    return w === undefined ? { t: 'snap', st: now, p: arr } : { t: 'snap', st: now, p: arr, w };
  }
}

export const r2 = (v: number) => Math.round(v * 100) / 100;
