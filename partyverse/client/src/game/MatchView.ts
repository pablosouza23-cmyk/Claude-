/**
 * Mundo da partida no cliente: estação de partida flutuante, Trem Voador
 * funcional (pose calculada do mesmo cronograma do servidor => viagem
 * sincronizada), cenário de voo e o mapa do minigame (carregado sob demanda).
 */
import * as THREE from 'three';
import { CollisionWorld, type Collider } from '../../../shared/collision';
import { GAMES, type Difficulty, type GameId } from '../../../shared/minigames';
import type { Platform } from '../../../shared/protocol';
import {
  DEPART_POSE, TRAIN, insideTrain, nearDoor, stationLocalColliders, trainHullColliders, trainInteriorColliders,
  trainPose, trainSeats, trainWorldToLocal, trainLocalToWorld, transformColliders, type Pose, type TrainSchedule,
} from '../../../shared/train';
import { audio } from '../core/Audio';
import { mat, mesh, rbox } from '../core/Assets';
import { CLIENT_GAMES } from '../games/index';
import type { MinigameClient } from '../games/types';
import { buildTrain, type TrainParts } from '../world/TrainModel';
import { floatingRock } from '../world/lobby/LobbyScene';
import { Batcher, addTree, addBush, lamp, place, signPlane, signTexture } from '../world/props';
import type { App } from '../app/App';
import type { LocalPlayer } from './LocalPlayer';
import type { ActionButton, Interactable } from './types';
import { View } from './View';

interface TrainState extends Omit<TrainSchedule, 'phase'> { phase: TrainSchedule['phase']; seats: Record<string, number>; lights: number; deadline: number }
type Phase = 'boarding' | 'departing' | 'flight' | 'arrived' | 'game' | 'results';

export class MatchView extends View {
  game: GameId;
  difficulty: Difficulty;
  phase: Phase = 'boarding';
  train!: TrainParts;
  schedule!: TrainState;
  minigame: MinigameClient | null = null;
  private trainCol = new CollisionWorld(trainInteriorColliders(true), null);
  private departCol!: CollisionWorld;
  private arriveCol!: CollisionWorld;
  private doorsVis = 1;
  private lastDoors = true;
  private flightDecor = new THREE.Group();
  private gameRoot = new THREE.Group();
  private pose: Pose = { ...DEPART_POSE };
  private engineOn = false;
  private started = false;

  constructor(app: App, game: GameId, difficulty: Difficulty, private initState: { train: TrainState; game: unknown; phase: Phase; result: unknown }) {
    super(app);
    this.game = game;
    this.difficulty = difficulty;
    this.schedule = initState.train;
    this.phase = initState.phase;
  }

  async load(progress: (p: number, msg: string) => void): Promise<void> {
    const def = GAMES[this.game];
    progress(0.1, `Preparando a viagem para ${def.destination}…`);
    const loader = CLIENT_GAMES[this.game];
    if (!loader) throw new Error(`Minigame ${this.game} sem cliente`);
    const mod = await loader();
    this.minigame = mod.default({ app: this.app, difficulty: this.difficulty, players: this.app.playerCount() });
    this.app.env.setSky(this.phase === 'game' || this.phase === 'results' || this.phase === 'arrived' ? this.minigame.sky : 'golden');
    this.app.env.clearClouds();
    await this.app.env.addClouds(70, [80, 900], [-120, 120], [10, 30], 7);
    progress(0.3, 'Ligando os propulsores do trem…');
    this.train = buildTrain({ interior: true, particles: this.app.renderer.preset.particles });
    this.root.add(this.train.root);
    this.buildDepartIsland();
    progress(0.45, `Construindo ${def.destination}…`);
    this.root.add(this.gameRoot);
    await this.minigame.build(this.gameRoot, (p) => progress(0.45 + p * 0.45, `Construindo ${def.destination}…`));
    this.minigame.applyState(this.initState.game);
    const to = this.minigame.arrivalPose();
    const dep: Collider[] = [...transformColliders(stationLocalColliders(), DEPART_POSE), ...transformColliders(trainHullColliders(true), DEPART_POSE)];
    this.departCol = new CollisionWorld(dep, null);
    const arr: Collider[] = [...this.minigame.colliders(), ...transformColliders(stationLocalColliders(false), to), ...transformColliders(trainHullColliders(true), to)];
    this.arriveCol = new CollisionWorld(arr, null);
    this.buildStationAt(to, def.destination.toUpperCase(), def.color);
    this.buildFlightDecor(DEPART_POSE, to);
    this.applyDoors(this.schedule.doorsOpen, true);
    this.app.ui.setMatchHud(this.minigame.hud);
    audio.setMood(this.phase === 'game' ? this.minigame.mood : 'flight');
    if (this.phase === 'game' || this.phase === 'results') this.startGame(false);
    progress(1, 'Embarque!');
  }

  /* ------------------------------ cenário ------------------------------ */

  private buildDepartIsland(): void {
    const g = new THREE.Group();
    const p = DEPART_POSE;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.yaw;
    // plataforma + ilha
    const z0 = TRAIN.halfWidth + 0.05;
    const slab = mesh(rbox(48, 0.8, 9.2, 0.2), mat('#d8d2e8', 0.8));
    slab.position.set(0, -0.4, z0 + 4.5);
    g.add(slab);
    g.add(place(mesh(new THREE.BoxGeometry(48, 0.02, 0.5), mat('#ffc93c', 0.6)), 0, 0.01, z0 + 0.45));
    const isl = mesh(new THREE.CylinderGeometry(30, 28, 1.2, 48), mat('#79c257', 0.9));
    isl.position.set(0, -1.2, z0 + 22);
    g.add(isl);
    const rock = floatingRock(28, 32, 5);
    rock.position.set(0, -1.8, z0 + 22);
    g.add(rock);
    const b = new Batcher();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const r = 16 + (i % 4) * 3;
      const x = Math.cos(a) * r, z = z0 + 22 + Math.sin(a) * r;
      if (z < z0 + 12) continue;
      addTree(b, x, z, 1 + (i % 3) * 0.2, i, i % 3 === 0, -0.6);
      addBush(b, x + 2, z + 1, 1.2, i, -0.6);
    }
    b.build(g);
    for (const x of [-18, -6, 6, 18]) g.add(place(lamp(true), x, 0, z0 + 8.3));
    const sign = signPlane(signTexture('ESTAÇÃO PARTYVERSE', { sub: 'Embarque no Trem Voador' }), 10, 2.5);
    sign.position.set(0, 5, z0 + 8.6);
    sign.rotation.y = Math.PI;
    g.add(sign);
    const frame = mesh(rbox(10.6, 3.0, 0.3, 0.1), mat('#2b2440', 0.5));
    frame.position.set(0, 5, z0 + 8.8);
    g.add(frame);
    for (const x of [-4.8, 4.8]) g.add(place(mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), mat('#2b2440', 0.5)), x, 2, z0 + 8.8));
    this.root.add(g);
  }

  private buildStationAt(p: Pose, name: string, color: string): void {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.yaw;
    const z0 = TRAIN.halfWidth + 0.05;
    const slab = mesh(rbox(48, 0.8, 9.2, 0.2), mat('#e4dccf', 0.85));
    slab.position.set(0, -0.4, z0 + 4.5);
    g.add(slab);
    g.add(place(mesh(new THREE.BoxGeometry(48, 0.02, 0.5), mat('#ffc93c', 0.6)), 0, 0.01, z0 + 0.45));
    const sign = signPlane(signTexture(name, { sub: 'Estação do Trem Voador', bg: color }), 9, 2.25);
    sign.position.set(0, 4.6, z0 + 8.6);
    sign.rotation.y = Math.PI;
    g.add(sign);
    for (const x of [-4.4, 4.4]) g.add(place(mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), mat('#2b2440', 0.5)), x, 2, z0 + 8.8));
    // trilho
    g.add(place(mesh(rbox(70, 0.5, 2.4, 0.15), mat('#3b4252', 0.4, 0.6)), 0, -1.4, 0));
    this.gameRoot.add(g);
  }

  private buildFlightDecor(a: Pose, b: Pose): void {
    // ilhas flutuantes ao longo da rota
    let s = this.schedule.seed || 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const bt = new Batcher();
    for (let i = 0; i < 16; i++) {
      const t = (i + 0.5) / 16;
      const sched = { ...this.schedule, departAt: 0, arriveAt: 1000 } as TrainSchedule;
      const p = trainPose(sched, t * 1000);
      const side = rnd() > 0.5 ? 1 : -1;
      const off = 60 + rnd() * 140;
      const x = p.x + Math.sin(p.yaw) * off * side;
      const z = p.z + Math.cos(p.yaw) * off * side;
      const y = p.y - 30 - rnd() * 50;
      const r = 10 + rnd() * 18;
      const isl = new THREE.Group();
      isl.position.set(x, y, z);
      isl.add(mesh(new THREE.CylinderGeometry(r, r * 0.92, 1.4, 20), mat('#79c257', 0.9), false));
      const rock = floatingRock(r * 0.92, r * 1.6, i);
      rock.position.y = -0.7;
      isl.add(rock);
      for (let k = 0; k < 6; k++) addTree(bt, x + Math.cos(k * 1.1) * r * 0.55, z + Math.sin(k * 1.7) * r * 0.55, 1.6, k, k % 2 === 0, y + 0.7);
      if (i % 4 === 1) {
        const tower = mesh(rbox(4, 14, 4, 0.5), mat(['#ff8a3d', '#7c5cff', '#39d0ff'][i % 3], 0.5), false);
        tower.position.set(0, 7.5, 0);
        isl.add(tower);
        const cap = mesh(new THREE.ConeGeometry(3.4, 4, 4), mat('#ffffff', 0.5), false);
        cap.position.set(0, 16.5, 0);
        cap.rotation.y = Math.PI / 4;
        isl.add(cap);
      }
      this.flightDecor.add(isl);
    }
    bt.build(this.flightDecor);
    // anéis luminosos de rota (portais)
    for (let i = 1; i < 6; i++) {
      const sched = { ...this.schedule, departAt: 0, arriveAt: 1000 } as TrainSchedule;
      const p = trainPose(sched, (i / 6) * 1000);
      const ring = mesh(new THREE.TorusGeometry(9, 0.45, 10, 48), mat('#ffffff', 0.3, 0, ['#ff4fa3', '#39d0ff', '#ffc93c'][i % 3], 2.2), false);
      ring.position.set(p.x, p.y + 1.6, p.z);
      ring.rotation.y = p.yaw + Math.PI / 2;
      this.flightDecor.add(ring);
    }
    void a; void b;
    this.root.add(this.flightDecor);
  }

  /* ------------------------------ plataformas ------------------------------ */

  colFor(p: Platform): CollisionWorld {
    if (p === 1) return this.trainCol;
    return this.phase === 'boarding' || this.phase === 'departing' ? this.departCol : this.arriveCol;
  }
  parentFor(p: Platform): THREE.Object3D { return p === 1 ? this.train.cabin : this.root; }
  platYaw(p: Platform): number { return p === 1 ? this.pose.yaw : 0; }

  cameraWorlds() {
    const lp = this.app.local;
    const out: { col: CollisionWorld; toLocal?: (v: THREE.Vector3) => THREE.Vector3 }[] = [];
    if (lp?.plat === 1) out.push({ col: this.trainCol, toLocal: (v) => this.train.cabin.worldToLocal(v) });
    else out.push({ col: this.colFor(0) });
    return out;
  }

  private docked(): boolean {
    return this.phase === 'boarding' || this.phase === 'arrived' || this.phase === 'game' || this.phase === 'results' || (this.phase === 'departing' && this.schedule.doorsOpen);
  }

  platformCheck(lp: LocalPlayer): void {
    if (!this.docked() || !this.schedule.doorsOpen) return;
    const p = this.pose;
    if (lp.plat === 0) {
      const [lx, ly, lz] = trainWorldToLocal(p, lp.s.x, lp.s.y, lp.s.z);
      if (insideTrain(lx, lz) && lz < TRAIN.innerHalfWidth - 0.05) lp.switchPlatform(1, lx, Math.max(0, ly), lz, -p.yaw);
    } else if (lp.s.z > TRAIN.innerHalfWidth + 0.15 && nearDoor(lp.s.x, lp.s.z)) {
      const [wx, wy, wz] = trainLocalToWorld(p, lp.s.x, lp.s.y, lp.s.z);
      lp.switchPlatform(0, wx, wy, wz, p.yaw);
    }
  }

  /* ------------------------------ interação ------------------------------ */

  interactables(lp: LocalPlayer): Interactable[] {
    const out: Interactable[] = [];
    if (lp.plat === 1 && !lp.locked && !lp.carrying) {
      const occupied = new Set(Object.keys(this.schedule.seats ?? {}));
      for (const s of trainSeats()) {
        if (occupied.has(s.id)) continue;
        const v = new THREE.Vector3(s.x, 0.5, s.z);
        this.train.cabin.localToWorld(v);
        out.push({ id: `seat:${s.id}`, pos: v, r: 1.3, label: s.id === 'pilot' ? 'Sentar (piloto)' : s.id === 'copilot' ? 'Sentar (copiloto)' : 'Sentar', use: () => this.app.net.send({ t: 'interact', id: `seat:${s.id}` }) });
      }
    }
    if (lp.locked) {
      out.push({ id: 'stand', pos: lp.worldPos(new THREE.Vector3()), r: 99, label: 'Levantar', prio: 10, use: () => this.app.net.send({ t: 'interact', id: 'stand' }) });
    }
    if ((this.phase === 'game' || this.phase === 'results') && this.minigame) out.push(...this.minigame.interactables(lp));
    return out;
  }

  actionButtons(): ActionButton[] {
    const lp = this.app.local;
    const out: ActionButton[] = [];
    const seat = this.mySeat();
    if (seat === 'pilot') out.push({ id: 'horn', label: 'Buzina', key: 'F', onDown: () => this.app.net.send({ t: 'act', a: 'horn' }) });
    if (seat === 'pilot' || seat === 'copilot') out.push({ id: 'lights', label: 'Luzes', key: 'R', onDown: () => this.app.net.send({ t: 'act', a: 'lights' }) });
    if ((this.phase === 'game') && this.minigame && lp) out.push(...this.minigame.actionButtons(lp));
    return out;
  }

  mySeat(): string | null {
    const me = this.app.myId;
    for (const [sid, pid] of Object.entries(this.schedule.seats ?? {})) if (pid === me) return sid;
    return null;
  }

  /* ------------------------------ estado ------------------------------ */

  onWorld(w: unknown): void {
    const d = w as { ph: Phase; tr: TrainState; g?: unknown };
    if (!d) return;
    if (d.ph !== this.phase) this.setPhase(d.ph);
    this.schedule = d.tr;
    if (d.g !== undefined && this.minigame) this.minigame.applyDelta(d.g);
  }

  private setPhase(ph: Phase): void {
    const prev = this.phase;
    this.phase = ph;
    if (ph === 'flight' && prev !== 'flight') this.app.env.setSky('golden');
    if (ph === 'arrived' && this.minigame) {
      this.app.env.setSky(this.minigame.sky);
      this.app.ui.banner(GAMES[this.game].destination, 'Desembarque! Saia do trem para começar', 3500);
    }
    if (ph === 'game' && !this.started) this.startGame(true);
  }

  private startGame(announce: boolean): void {
    if (this.started) return;
    this.started = true;
    this.minigame?.started();
    audio.setMood(this.minigame?.mood ?? 'work');
    if (announce) this.app.ui.banner(GAMES[this.game].name, 'Valendo!', 2500);
  }

  onEvent(e: string, d: unknown): void {
    switch (e) {
      case 'departing': audio.play('chime'); this.app.ui.banner('Partida em instantes', 'Portas fechando — segurem-se!', 2500); break;
      case 'takeoff': audio.play('thruster'); audio.play('whoosh'); this.app.cam.addShake(0.6); break;
      case 'arrived': audio.play('chime'); this.app.cam.addShake(0.3); break;
      case 'horn': audio.play('horn'); break;
      case 'gameStart': this.startGame(true); break;
      case 'results': this.app.ui.results(d as never, this.game, this.difficulty); break;
      default: this.minigame?.onEvent(e, d);
    }
  }

  private applyDoors(open: boolean, instant = false): void {
    for (const w of [this.trainCol, this.departCol, this.arriveCol]) if (w) for (const c of w.colliders) if (c.id === 'doorleaf') c.disabled = open;
    if (open !== this.lastDoors && !instant) audio.play('door', { at: this.app.local?.worldPos(new THREE.Vector3()) });
    this.lastDoors = open;
    if (instant) this.doorsVis = open ? 1 : 0;
  }

  update(dt: number, now: number): void {
    const p = trainPose(this.schedule as TrainSchedule, now);
    this.pose = p;
    this.train.root.position.set(p.x, p.y, p.z);
    this.train.root.rotation.set(p.roll, p.yaw, p.pitch, 'YZX');
    if (this.schedule.doorsOpen !== this.lastDoors) this.applyDoors(this.schedule.doorsOpen);
    this.doorsVis += ((this.schedule.doorsOpen ? 1 : 0) - this.doorsVis) * Math.min(1, dt * 4);
    this.train.setDoors(this.doorsVis);
    const flying = now > this.schedule.departAt && now < this.schedule.arriveAt;
    const thrust = flying ? 1 : this.phase === 'departing' ? 0.5 : 0.25;
    this.train.setThrust(thrust);
    this.train.setLights(this.schedule.lights ?? 0);
    this.train.update(dt, now / 1000);
    // som do motor
    const lp = this.app.local;
    const near = lp ? lp.plat === 1 || lp.worldPos(new THREE.Vector3()).distanceTo(this.train.root.position) < 40 : false;
    if (near && this.phase !== 'game' && this.phase !== 'results') {
      audio.loop('train', 'engine', 0.08 + thrust * 0.22, 0.6 + thrust * 0.6);
      this.engineOn = true;
    } else if (this.engineOn) { audio.stopLoop('train'); this.engineOn = false; }
    this.flightDecor.visible = this.phase !== 'game' && this.phase !== 'results';
    this.app.ui.trainStatus(this.phase, this.schedule, now, GAMES[this.game].destination, this.mySeat());
    if (this.minigame && lp && (this.phase === 'game' || this.phase === 'results' || this.phase === 'arrived')) this.minigame.update(dt, now, lp);
  }

  dispose(): void {
    audio.stopLoop('train');
    this.minigame?.dispose();
    this.app.ui.setMatchHud(null);
    super.dispose();
  }
}
