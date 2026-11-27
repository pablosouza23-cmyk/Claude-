/**
 * NAVE EM PERIGO — lógica autoritativa no servidor.
 *  - Embarque: o trem para na estação orbital; a tripulação atravessa a
 *    passarela até a eclusa. A nave decola quando todos estão a bordo (ou no
 *    fim do prazo, levando quem ficou para dentro) e a eclusa se fecha.
 *  - Voo: simulado como estado (posição no setor, rumo, velocidade). O piloto
 *    controla rumo e acelerador pelo manche; asteroides são corpos no setor e
 *    batem na nave se o piloto não desviar (o escudo absorve parte do dano).
 *  - Falhas aleatórias com prazo: cada uma exige trabalho em um console
 *    específico (às vezes 2 pessoas em consoles diferentes ao mesmo tempo).
 *    Ignoradas, pioram e o casco perde integridade.
 *  - Energia (painel elétrico), combustível (células carregadas da carga até o
 *    tanque), oxigênio, escudo e casco são recursos decididos aqui.
 */
import {
  ENGINE_STAGES, FAILS, NAVE_ARRIVAL, POWER_BUDGET, POWER_FX, POWER_MAX, ROLE_BONUS, SHIP_FLOOR, SHIP_R, SHORT_PENALTY, SYSTEMS, USE_R,
  buildNaveMap, insideShip, planNave, rolesFor, stationsFor, usePoint,
  type FailKind, type NaveMap, type NavePlan, type RoleSlot, type Skill, type StationDef, type SystemId,
} from '../../../../shared/games/nave';
import type { Collider } from '../../../../shared/collision';
import type { Pose } from '../../../../shared/train';
import type { MatchWorld } from '../../worlds/MatchWorld';
import type { WPlayer } from '../../worlds/World';
import type { GameResult, MinigameContext, MinigameServer } from '../types';

const FAST = process.env.PV_FAST_TRAIN === '1';
const EMBARK_MS = FAST ? 30_000 : 45_000;
const CELL = 1;

interface Failure {
  id: number;
  kind: FailKind;
  station: string;
  /** segundo console exigido ao mesmo tempo ('' = nenhum) */
  station2: string;
  stage: number;
  stages: number;
  progress: number;
  deadline: number;
  working: boolean;
  escalations: number;
}

interface Asteroid { id: number; x: number; y: number; vx: number; vy: number; r: number }

interface Stat { fixed: number; work: number; cells: number; piloted: number }

export function createNave(ctx: MinigameContext): MinigameServer {
  return new NaveServer(ctx);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const num = (v: unknown, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, a, b) : 0);

class NaveServer implements MinigameServer {
  readonly id = 'nave' as const;
  private match: MatchWorld;
  readonly plan: NavePlan;
  readonly map: NaveMap;
  private readonly run = Math.floor(Math.random() * 1e9);
  private phase: 'embark' | 'flight' | 'end' = 'embark';
  private started = false;
  private startAt = 0;
  private launchAt = 0;
  private launchedAt = 0;
  private finished: GameResult | null = null;
  private endReason = '';
  // navegação no setor
  private nav = { x: 0, y: 0, h: 0, v: 0, thr: 0.45 };
  private pilot = 0;
  private pilotIn = { turn: 0, at: 0 };
  // recursos
  private hull = 100;
  private fuel: number;
  private o2 = 100;
  private shield = 80;
  private power: Record<SystemId, number> = { motores: 2, escudos: 2, vida: 2, sensores: 2 };
  private cells: number;
  private driftT = 0;
  // falhas e asteroides
  private failures: Failure[] = [];
  private nextFailId = 1;
  private nextFailAt = 0;
  private nextShowerAt = 0;
  private showerEnd = 0;
  private asteroids: Asteroid[] = [];
  private nextAstId = 1;
  private astDirty = true;
  // papéis e estatísticas
  private roles = new Map<number, RoleSlot>();
  private rolesKey = '';
  private rolesSent = '';
  private stats = new Map<string, Stat>();
  private resolved = 0;
  private spawned = 0;
  private impacts = 0;
  private events: { e: string; d: unknown }[] = [];

  constructor(ctx: MinigameContext) {
    this.match = ctx.match;
    this.plan = planNave(ctx.players, ctx.difficulty);
    this.map = buildNaveMap(this.plan.layout);
    this.fuel = this.plan.startFuel;
    this.cells = this.plan.cells;
  }

  colliders(): Collider[] { return this.map.colliders; }
  arrivalPose(): Pose { return NAVE_ARRIVAL; }
  spawn(i: number) {
    const s = this.map.spawns[i % this.map.spawns.length];
    return { x: s.x, y: SHIP_FLOOR, z: s.z, yaw: Math.PI };
  }

  private station(id: string): StationDef | undefined { return this.map.stations.find((s) => s.id === id); }
  private emit(e: string, d: unknown): void { this.events.push({ e, d }); }

  /* ------------------------------ estado ------------------------------ */

  private remaining(): number { return Math.hypot(this.plan.distance - this.nav.x, this.nav.y); }

  private core() {
    return {
      run: this.run, ph: this.phase, st: this.startAt, la: this.launchAt, lt: this.launchedAt,
      n: [r2(this.nav.x), r2(this.nav.y), Math.round(this.nav.h * 1000) / 1000, r2(this.nav.v), r2(this.nav.thr)],
      hu: r1(this.hull), fu: r1(this.fuel), o2: r1(this.o2), sh: r1(this.shield),
      pw: SYSTEMS.map((s) => this.power[s]), bud: this.budget(), cells: this.cells, pil: this.pilot,
      rem: r1(this.remaining()), sw: this.showerEnd,
      f: this.failures.map((f) => [f.id, f.kind, f.station, f.station2, f.stage, f.stages, Math.round(f.progress * 100), f.deadline, f.working ? 1 : 0]),
      w: [...this.match.players.values()].filter((p) => p.data.work).map((p) => [p.id, p.data.work as number]),
      c: [...this.match.players.values()].filter((p) => p.carry === CELL).map((p) => p.id),
      res: this.resolved, imp: this.impacts, end: this.endReason,
    };
  }

  state(): unknown {
    this.ensureRoles();
    return { ...this.core(), ro: this.roleRows(), ast: this.astRows() };
  }

  delta(): unknown {
    const d: Record<string, unknown> = this.core();
    if (this.rolesKey !== this.rolesSent) { this.rolesSent = this.rolesKey; d.ro = this.roleRows(); }
    if (this.astDirty) { this.astDirty = false; d.ast = this.astRows(); }
    if (this.events.length) { d.e = this.events; this.events = []; }
    return d;
  }

  private roleRows() { return [...this.roles.entries()].map(([pid, r]) => [pid, r.id, r.skills.join(',')]); }
  private astRows() { return this.asteroids.map((a) => [a.id, r2(a.x), r2(a.y), r2(a.vx), r2(a.vy), r1(a.r)]); }

  private budget(): number {
    return POWER_BUDGET - (this.failures.some((f) => f.kind === 'short') ? SHORT_PENALTY : 0);
  }

  /* ------------------------------ papéis ------------------------------ */

  private ensureRoles(): void {
    const ids = [...this.match.players.keys()].sort((a, b) => a - b);
    for (const id of [...this.roles.keys()]) if (!this.match.players.has(id)) this.roles.delete(id);
    if (ids.length === this.roles.size && ids.every((id) => this.roles.has(id))) return;
    // a tripulação mudou: redistribui (times pequenos acumulam especialidades)
    const slots = rolesFor(Math.max(ids.length, 2));
    this.roles.clear();
    ids.forEach((id, i) => this.roles.set(id, slots[i % slots.length]));
    this.rolesKey = [...this.roles.entries()].map(([k, v]) => `${k}:${v.id}`).join('|');
  }

  private hasSkill(p: WPlayer, s: Skill): boolean {
    return !!this.roles.get(p.id)?.skills.includes(s);
  }

  private stat(p: WPlayer): Stat {
    let s = this.stats.get(p.session.id);
    if (!s) this.stats.set(p.session.id, (s = { fixed: 0, work: 0, cells: 0, piloted: 0 }));
    return s;
  }

  /* ------------------------------ ciclo ------------------------------ */

  start(now: number): void {
    this.started = true;
    this.phase = 'embark';
    this.startAt = now;
    this.launchAt = now + EMBARK_MS;
    const door = this.match.mapCol.byId('nave-airlock');
    if (door) door.disabled = true;
    this.ensureRoles();
    this.emit('embark', { at: this.launchAt });
  }

  tick(dt: number, now: number): void {
    if (!this.started || this.finished) return;
    this.ensureRoles();
    if (this.phase === 'embark') {
      const active = [...this.match.players.values()].filter((p) => p.connected);
      const allIn = active.length > 0 && active.every((p) => p.plat === 0 && insideShip(this.map, p.x, p.z, p.y));
      if (allIn || now >= this.launchAt) this.launch(now);
      return;
    }
    this.tickFlight(dt, now);
  }

  private launch(now: number): void {
    this.phase = 'flight';
    this.launchedAt = now;
    let i = 0;
    for (const p of this.match.players.values()) {
      if (p.plat === 0 && insideShip(this.map, p.x, p.z, p.y)) continue;
      const s = this.spawn(i++);
      this.match.teleport(p, s.x, s.y, s.z, 0, s.yaw);
    }
    const door = this.match.mapCol.byId('nave-airlock');
    if (door) door.disabled = false;
    const first = this.plan.hints ? 14 : this.plan.failEvery[0] > 15 ? 10 : 7;
    this.nextFailAt = now + first * 1000;
    this.nextShowerAt = now + (this.plan.showerEvery * 0.55 + rnd(0, 15)) * 1000;
    // campo inicial de asteroides à frente
    for (let k = 0; k < Math.round(8 * this.plan.asteroidDensity); k++) this.spawnAsteroid(rnd(140, 520), false);
    this.emit('launch', {});
  }

  private tickFlight(dt: number, now: number): void {
    const pilot = this.pilot ? this.match.players.get(this.pilot) : null;
    if (this.pilot && (!pilot || !pilot.connected)) this.leaveHelm(pilot ?? null);

    // ---------- motores e navegação ----------
    const engines = stationsFor(this.map, 'engine');
    let ef = 0;
    for (const e of engines) {
      const broken = this.failures.some((f) => f.kind === 'engine' && f.station === e.id);
      const fire = this.failures.some((f) => f.kind === 'fire' && f.station === e.id);
      ef += (broken ? 0.25 : 1) * (fire ? 0.6 : 1);
    }
    ef = (ef / Math.max(1, engines.length)) * POWER_FX.speed[this.power.motores];
    if (this.fuel <= 0) ef = 0;
    if (this.pilot && now - this.pilotIn.at < 700) this.nav.h += this.pilotIn.turn * 0.65 * dt;
    const target = this.plan.vmax * this.nav.thr * ef;
    this.nav.v += (target - this.nav.v) * Math.min(1, dt * 0.5);
    const step = this.nav.v * dt;
    this.nav.x += Math.cos(this.nav.h) * step;
    this.nav.y += Math.sin(this.nav.h) * step;
    if (pilot) this.stat(pilot).piloted += step;

    // ---------- recursos ----------
    const has = (k: FailKind) => this.failures.some((f) => f.kind === k);
    const leak = has('leak');
    this.fuel = Math.max(0, this.fuel - this.plan.burn * (this.nav.v / this.plan.vmax) * POWER_FX.burn[this.power.motores] * dt - (leak ? 0.45 * dt : 0));
    this.o2 = clamp(this.o2 + (POWER_FX.o2[this.power.vida] - (has('life') ? 1.5 : 0)) * dt, 0, 100);
    const shieldFail = has('shield');
    const smax = shieldFail ? 15 : POWER_FX.shieldMax[this.power.escudos];
    if (this.shield > smax) this.shield = Math.max(smax, this.shield - 6 * dt);
    else if (!shieldFail) this.shield = Math.min(smax, this.shield + POWER_FX.shieldRegen[this.power.escudos] * dt);
    const fires = this.failures.filter((f) => f.kind === 'fire').length;
    this.hull -= (fires * 0.5 + (has('short') ? 0.12 : 0)) * dt;
    this.enforceBudget();

    // ---------- asteroides ----------
    this.tickAsteroids(dt, now);

    // ---------- falhas ----------
    this.tickFailures(now);
    this.tickWork(dt, now);

    // ---------- fim ----------
    if (this.fuel <= 0) {
      const carrying = [...this.match.players.values()].some((p) => p.carry === CELL);
      this.driftT += dt * (this.cells === 0 && !carrying ? 3 : 1);
    } else this.driftT = 0;
    const override = Number(process.env.PV_GAME_TIME ?? 0);
    const maxMs = (override > 0 ? override : this.plan.maxTime) * 1000;
    if (this.remaining() < 25) this.finish(true, 'chegada');
    else if (this.hull <= 0) this.finish(false, 'casco');
    else if (this.o2 <= 0) this.finish(false, 'oxigenio');
    else if (this.driftT > 30) this.finish(false, 'combustivel');
    else if (now - this.launchedAt > maxMs) this.finish(false, 'tempo');
  }

  private enforceBudget(): void {
    const bud = this.budget();
    let sum = SYSTEMS.reduce((a, s) => a + this.power[s], 0);
    if (sum <= bud) return;
    for (const s of ['sensores', 'escudos', 'vida', 'motores'] as SystemId[]) {
      while (sum > bud && this.power[s] > 0) { this.power[s]--; sum--; }
    }
    this.emit('powercut', {});
  }

  /* ------------------------------ asteroides ------------------------------ */

  private routeDir(): [number, number, number, number] {
    const dx = this.plan.distance - this.nav.x, dy = -this.nav.y;
    const d = Math.hypot(dx, dy) || 1;
    const fx = dx / d, fy = dy / d;
    return [fx, fy, -fy, fx];
  }

  private spawnAsteroid(along: number, shower: boolean): void {
    const [fx, fy, px, py] = this.routeDir();
    // na chuva, as rochas vêm pela rota em direção à nave
    const lat = rnd(-1, 1) * (shower ? 110 : 230);
    const hx = Math.cos(this.nav.h), hy = Math.sin(this.nav.h);
    const bx = this.nav.x + (fx * 0.6 + hx * 0.4) * along, by = this.nav.y + (fy * 0.6 + hy * 0.4) * along;
    const sp = shower ? rnd(4, 7.5) : 0;
    this.asteroids.push({
      id: this.nextAstId++, x: bx + px * lat, y: by + py * lat,
      vx: rnd(-1.5, 1.5) - fx * sp, vy: rnd(-1.5, 1.5) - fy * sp,
      r: shower ? rnd(3, 6.5) : rnd(3.5, 9),
    });
    this.astDirty = true;
  }

  private tickAsteroids(dt: number, now: number): void {
    // chuva de asteroides (evento listado como falha da ponte)
    if (now >= this.nextShowerAt && !this.showerEnd) {
      this.showerEnd = now + 22_000;
      this.failures.push({ id: this.nextFailId++, kind: 'asteroids', station: 'helm', station2: '', stage: 0, stages: 1, progress: 0, deadline: this.showerEnd, working: false, escalations: 0 });
      this.emit('shower', { until: this.showerEnd });
    }
    if (this.showerEnd && now >= this.showerEnd) {
      this.showerEnd = 0;
      this.failures = this.failures.filter((f) => f.kind !== 'asteroids');
      this.nextShowerAt = now + this.plan.showerEvery * rnd(0.8, 1.25) * 1000;
      this.emit('showerEnd', {});
    }
    const shower = !!this.showerEnd;
    const [fx, fy] = this.routeDir();
    const sx = this.nav.x, sy = this.nav.y;
    for (const a of this.asteroids) { a.x += a.vx * dt; a.y += a.vy * dt; }
    const before = this.asteroids.length;
    this.asteroids = this.asteroids.filter((a) => {
      const dx = a.x - sx, dy = a.y - sy;
      return Math.hypot(dx, dy) < 600 && dx * fx + dy * fy > -160;
    });
    if (this.asteroids.length !== before) this.astDirty = true;
    const nearDest = this.remaining() < 160;
    const target = nearDest ? 0 : Math.round(11 * this.plan.asteroidDensity * (shower ? 2.6 : 1));
    for (let k = 0; k < 2 && this.asteroids.length < target; k++) this.spawnAsteroid(shower ? rnd(200, 420) : rnd(320, 560), shower);
    // colisão
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i];
      const dx = a.x - sx, dy = a.y - sy;
      if (Math.hypot(dx, dy) >= a.r + SHIP_R) continue;
      const base = a.r * 1.5;
      const absorb = Math.min(1, this.shield / 60) * 0.85;
      const dmg = base * (1 - absorb);
      this.hull -= dmg;
      this.shield = Math.max(0, this.shield - base * 2.5);
      this.impacts++;
      // lado do impacto relativo à proa (para o tremor/efeito no cliente)
      const ang = Math.atan2(dy, dx) - this.nav.h;
      this.emit('impact', { dmg: Math.round(dmg), abs: Math.round(base - dmg), ang: Math.round(ang * 100) / 100, r: a.r });
      this.asteroids.splice(i, 1);
      this.astDirty = true;
    }
  }

  /* ------------------------------ falhas ------------------------------ */

  private busyStations(): Set<string> {
    const s = new Set<string>();
    for (const f of this.failures) { if (f.kind === 'asteroids') continue; s.add(f.station); if (f.station2) s.add(f.station2); }
    return s;
  }

  /** cria uma falha (opcionalmente em um console específico); devolve false se não couber */
  private spawnFailure(now: number, kind?: FailKind, onlyStation?: string): boolean {
    const busy = this.busyStations();
    const weights: [FailKind, number][] = [['fire', 1], ['engine', 0.7], ['short', 1], ['leak', 1], ['shield', 1], ['life', 1], ['sensors', 0.9]];
    const options: { k: FailKind; st: StationDef; w: number }[] = [];
    for (const [k, w] of weights) {
      if (kind && k !== kind) continue;
      for (const st of stationsFor(this.map, FAILS[k].station)) {
        if (busy.has(st.id) || (onlyStation && st.id !== onlyStation)) continue;
        // o escudo em dupla também ocupa o painel elétrico
        if (k === 'shield' && this.plan.duo && busy.has('power')) continue;
        options.push({ k, st, w });
      }
    }
    if (!options.length) return false;
    let t = Math.random() * options.reduce((a, o) => a + o.w, 0);
    let pick = options[0];
    for (const o of options) { t -= o.w; if (t <= 0) { pick = o; break; } }
    const k = pick.k;
    const stages = k === 'engine' ? ENGINE_STAGES.length : 1;
    const dl = this.plan.deadline * (k === 'engine' ? 1.6 : k === 'fire' ? 0.85 : 1);
    const f: Failure = {
      id: this.nextFailId++, kind: k, station: pick.st.id, station2: k === 'shield' && this.plan.duo ? 'power' : '',
      stage: 0, stages, progress: 0, deadline: now + dl * 1000, working: false, escalations: 0,
    };
    this.failures.push(f);
    this.spawned++;
    this.emit('fail', { id: f.id, kind: k, st: f.station });
    return true;
  }

  private tickFailures(now: number): void {
    if (now >= this.nextFailAt) {
      const active = this.failures.filter((f) => f.kind !== 'asteroids').length;
      if (active < this.plan.maxConcurrent) {
        let ok = false;
        if (this.plan.farEvents && active + 2 <= this.plan.maxConcurrent && Math.random() < 0.4) {
          // eventos simultâneos nas duas alas distantes (motor bombordo x ala sul)
          const a = this.spawnFailure(now, Math.random() < 0.5 ? 'fire' : 'engine', 'engineB');
          const south = Math.random() < 0.5 ? this.spawnFailure(now, 'leak', 'tank') : this.spawnFailure(now, 'fire', 'engineE');
          ok = a || south;
          if (a && south) this.emit('farEvents', {});
        }
        if (!ok) ok = this.spawnFailure(now);
        this.nextFailAt = now + rnd(this.plan.failEvery[0], this.plan.failEvery[1]) * 1000;
      } else this.nextFailAt = now + 4000;
    }
    for (const f of [...this.failures]) {
      if (f.kind === 'asteroids' || now < f.deadline) continue;
      f.escalations++;
      f.deadline = now + this.plan.deadline * 0.75 * 1000;
      switch (f.kind) {
        case 'fire':
          // o fogo destrói o motor: vira avaria com reparo em etapas
          this.hull -= 12;
          f.kind = 'engine'; f.stage = 0; f.stages = ENGINE_STAGES.length; f.progress = 0;
          f.deadline = now + this.plan.deadline * 1.4 * 1000;
          break;
        case 'engine': this.hull -= 6; break;
        case 'short': {
          this.hull -= 5;
          const on = SYSTEMS.filter((s) => this.power[s] > 0);
          if (on.length) this.power[on[Math.floor(Math.random() * on.length)]]--;
          break;
        }
        case 'leak': this.fuel = Math.max(0, this.fuel - 8); this.hull -= 3; break;
        case 'shield': this.hull -= 6; this.shield = 0; break;
        case 'life': this.o2 = Math.max(0, this.o2 - 12); break;
        case 'sensors': this.hull -= 4; break;
      }
      this.emit('escalate', { id: f.id, kind: f.kind, st: f.station });
    }
  }

  private tickWork(dt: number, now: number): void {
    const rates = new Map<number, Map<string, number>>();
    const workers = new Map<number, WPlayer[]>();
    const addRate = (f: Failure, st: string, p: WPlayer) => {
      let m = rates.get(f.id);
      if (!m) rates.set(f.id, (m = new Map()));
      const skill = this.hasSkill(p, f.kind) || (st === 'helm' && this.hasSkill(p, 'helm'));
      const v = skill ? ROLE_BONUS : 1;
      const prev = m.get(st) ?? 0;
      m.set(st, prev ? prev + v * 0.5 : v);
      let w = workers.get(f.id);
      if (!w) workers.set(f.id, (w = []));
      if (!w.includes(p)) w.push(p);
    };
    for (const p of this.match.players.values()) {
      const wid = p.data.work as number | undefined;
      if (!wid) continue;
      const f = this.failures.find((x) => x.id === wid);
      if (!f || !p.connected || p.locked) { this.stopWork(p); continue; }
      const st = [f.station, f.station2].filter((s) => s && s !== 'helm').find((sid) => {
        const s = this.station(sid);
        if (!s) return false;
        const u = usePoint(s);
        return Math.hypot(p.x - u.x, p.z - u.z) <= USE_R + 0.5;
      });
      if (!st) { this.stopWork(p); continue; }
      addRate(f, st, p);
      this.stat(p).work += dt;
    }
    // o piloto sentado conta como operador do manche (partida do motor em dupla)
    const pilot = this.pilot ? this.match.players.get(this.pilot) : null;
    if (pilot) for (const f of this.failures) if (f.station2 === 'helm') addRate(f, 'helm', pilot);
    for (const f of [...this.failures]) {
      if (f.kind === 'asteroids') continue;
      const need = [f.station, f.station2].filter(Boolean);
      const m = rates.get(f.id);
      const ok = !!m && need.every((s) => (m.get(s) ?? 0) > 0);
      f.working = !!m && m.size > 0;
      if (!ok) continue;
      const rate = need.reduce((a, s) => a + m!.get(s)!, 0) / need.length;
      f.progress += (dt * rate * this.plan.workMul) / FAILS[f.kind].work;
      if (f.progress < 1) continue;
      const by = (workers.get(f.id) ?? []);
      if (f.stage < f.stages - 1) {
        f.stage++;
        f.progress = 0;
        if (f.kind === 'engine' && f.stage === f.stages - 1 && this.plan.duo) f.station2 = 'helm';
        f.deadline = Math.max(f.deadline, now + 12_000);
        this.emit('stage', { id: f.id, kind: f.kind, stage: f.stage, st: f.station });
        continue;
      }
      this.failures = this.failures.filter((x) => x !== f);
      this.resolved++;
      for (const p of by) { this.stat(p).fixed++; if (p.data.work === f.id) this.stopWork(p); }
      this.emit('fixed', { id: f.id, kind: f.kind, st: f.station, by: by.map((p) => p.id) });
    }
  }

  private stopWork(p: WPlayer): void {
    delete p.data.work;
  }

  /* ------------------------------ ações ------------------------------ */

  private near(p: WPlayer, s: StationDef | undefined, slack = 0): boolean {
    if (!s || p.plat !== 0) return false;
    const u = usePoint(s);
    return Math.hypot(p.x - u.x, p.z - u.z) <= USE_R + slack && Math.abs(p.y - SHIP_FLOOR) < 1.2;
  }

  speedMul(p: WPlayer): number {
    if (p.carry === CELL) return this.hasSkill(p, 'cells') ? 1 : 0.82;
    return 1;
  }

  onInteract(p: WPlayer, id: string): void {
    if (this.finished || !this.started || this.phase !== 'flight') return;
    const dbg = (why: string) => { if (process.env.PV_DEBUG) console.log('[nave] interação recusada', id, 'p', p.id, why); };
    if (id === 'helm:exit') return this.leaveHelm(p);
    if (p.id === this.pilot) return;
    if (id === 'stop') return this.stopWork(p);
    if (id.startsWith('work:')) {
      const f = this.failures.find((x) => x.id === Number(id.slice(5)));
      if (!f || f.kind === 'asteroids') return dbg('falha inexistente');
      if (p.carry) return dbg('carregando célula');
      const ok = [f.station, f.station2].some((sid) => sid && sid !== 'helm' && this.near(p, this.station(sid)));
      if (!ok) return dbg(`longe (${p.x.toFixed(1)},${p.z.toFixed(1)})`);
      p.data.work = f.id;
      return;
    }
    if (id === 'helm') {
      const s = stationsFor(this.map, 'helm')[0];
      if (this.pilot || p.carry || !this.near(p, s)) return dbg('manche ocupado/longe');
      this.stopWork(p);
      const u = usePoint(s);
      this.pilot = p.id;
      p.locked = true;
      p.anim = 'sit';
      p.x = u.x; p.y = SHIP_FLOOR + 0.05; p.z = u.z; p.yaw = u.yaw;
      this.match.correct(p);
      this.pilotIn = { turn: 0, at: 0 };
      this.emit('pilot', { id: p.id });
      return;
    }
    if (id === 'cell:take') {
      if (p.carry || this.cells <= 0 || !this.near(p, stationsFor(this.map, 'cells')[0])) return dbg('célula indisponível');
      this.stopWork(p);
      this.cells--;
      p.carry = CELL;
      this.emit('cell', { pid: p.id, n: this.cells });
      return;
    }
    if (id === 'tank:fill') {
      if (p.carry !== CELL || !this.near(p, stationsFor(this.map, 'tank')[0], 0.4)) return dbg('sem célula/longe do tanque');
      p.carry = 0;
      this.fuel = Math.min(100, this.fuel + this.plan.cellFuel);
      this.stat(p).cells++;
      this.emit('refuel', { pid: p.id, fuel: Math.round(this.fuel) });
      return;
    }
    if (id === 'cell:drop') {
      if (p.carry !== CELL) return;
      p.carry = 0;
      this.cells++;
      this.emit('celldrop', { pid: p.id });
    }
  }

  onAct(p: WPlayer, a: string, d: unknown): void {
    const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    if (a === 'pilot' && p.id === this.pilot && !this.finished) {
      this.pilotIn = { turn: num(o.turn, -1, 1), at: Date.now() };
      this.nav.thr = num(o.thr, 0, 1);
      return;
    }
    if (a === 'power' && this.phase === 'flight' && !this.finished) {
      const s = o.s as SystemId;
      const dv = o.d === 1 ? 1 : o.d === -1 ? -1 : 0;
      if (!SYSTEMS.includes(s) || !dv) return;
      if (!this.near(p, stationsFor(this.map, 'power')[0], 0.6)) return;
      const nv = this.power[s] + dv;
      if (nv < 0 || nv > POWER_MAX) return;
      if (dv > 0 && SYSTEMS.reduce((acc, k) => acc + this.power[k], 0) + 1 > this.budget()) { p.session.send({ t: 'toast', msg: 'Sem energia sobrando: tire de outro sistema primeiro.', kind: 'warn' }); return; }
      this.power[s] = nv;
      this.emit('power', { s, v: nv });
      return;
    }
    if (!process.env.PV_DEBUG) return;
    // apenas em testes automatizados (PV_DEBUG)
    if (a === 'debug:end' && !this.finished) this.finish(false, 'debug');
    if (a === 'debug:fail' && this.phase === 'flight') this.spawnFailure(Date.now(), o.kind as FailKind, typeof o.st === 'string' ? o.st : undefined);
    if (a === 'debug:shower' && this.phase === 'flight') this.nextShowerAt = Date.now();
  }

  private leaveHelm(p: WPlayer | null): void {
    if (!this.pilot) return;
    if (p && p.id !== this.pilot) return;
    this.pilot = 0;
    this.pilotIn = { turn: 0, at: 0 };
    if (p) {
      p.locked = false;
      p.anim = 'idle';
      const u = usePoint(stationsFor(this.map, 'helm')[0]);
      this.match.teleport(p, u.x - Math.sin(u.yaw) * 0.5, SHIP_FLOOR, u.z - Math.cos(u.yaw) * 0.5, 0, u.yaw);
    }
    this.emit('pilot', { id: 0 });
  }

  onPlayerLeave(p: WPlayer): void {
    if (p.id === this.pilot) this.leaveHelm(p);
    if (p.carry === CELL) { p.carry = 0; this.cells++; }
    this.stopWork(p);
    this.roles.delete(p.id);
  }

  /* ------------------------------ fim ------------------------------ */

  private finish(win: boolean, reason: string): void {
    this.phase = 'end';
    this.endReason = reason;
    const now = Date.now();
    const total = this.plan.distance;
    const traveled = clamp(total - this.remaining(), 0, total);
    const pct = traveled / total;
    const hull = Math.max(0, Math.round(this.hull));
    let stars = 0;
    if (win) stars = hull >= 70 && this.o2 >= 30 ? 3 : hull >= 40 ? 2 : 1;
    const score = Math.round(pct * 1000) + hull * 10 + this.resolved * 60 + (win ? 500 : 0);
    const secs = this.launchedAt ? Math.round((now - this.launchedAt) / 1000) : 0;
    const km = (u: number) => Math.round(u * 10).toLocaleString('pt-BR');
    const reasons: Record<string, string> = {
      chegada: 'Chegamos!', casco: 'Casco destruído', oxigenio: 'Sem oxigênio', combustivel: 'Sem combustível',
      tempo: 'Tempo esgotado', debug: 'Encerrada',
    };
    const mvp: { userId: string; title: string }[] = [];
    const arr = [...this.stats.entries()];
    const best = (k: keyof Stat) => [...arr].sort((a, b) => b[1][k] - a[1][k])[0];
    const fx = best('fixed'); if (fx && fx[1].fixed > 0) mvp.push({ userId: fx[0], title: `Mais consertos (${fx[1].fixed})` });
    const pl = best('piloted'); if (pl && pl[1].piloted > 20) mvp.push({ userId: pl[0], title: `Piloto (${km(pl[1].piloted)} mil km)` });
    const ce = best('cells'); if (ce && ce[1].cells > 0) mvp.push({ userId: ce[0], title: `Abastecedor (${ce[1].cells} células)` });
    const flags: string[] = [];
    if (win && hull >= 100) flags.push('noHullDamage');
    this.finished = {
      win, score, stars, flags, mvp,
      summary: [
        { label: 'Resultado', value: reasons[reason] ?? reason },
        { label: 'Trajeto percorrido', value: `${Math.round(pct * 100)}%` },
        { label: 'Distância (mil km)', value: `${km(traveled)}/${km(total)}` },
        { label: 'Casco', value: `${hull}%` },
        { label: 'Falhas resolvidas', value: `${this.resolved} de ${this.spawned}` },
        { label: 'Asteroides que bateram', value: String(this.impacts) },
        { label: 'Combustível', value: `${Math.round(this.fuel)}%` },
        { label: 'Tempo', value: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` },
        { label: 'Pontuação', value: String(score) },
      ],
    };
    this.emit('end', { win, reason });
    for (const p of this.match.players.values()) { this.stopWork(p); if (p.carry === CELL) p.carry = 0; }
    if (this.pilot) this.leaveHelm(this.match.players.get(this.pilot) ?? null);
  }

  result(): GameResult | null { return this.finished; }

  dispose(): void {
    for (const p of this.match.players.values()) { delete p.data.work; if (p.carry === CELL) p.carry = 0; }
  }
}
