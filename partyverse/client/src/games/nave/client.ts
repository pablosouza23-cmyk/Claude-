/**
 * NAVE EM PERIGO — cliente: interior da nave, espaço em movimento, consoles com
 * telas vivas, alarmes, partículas, HUD (recursos, falhas, papel, mapa estelar),
 * painel de energia e interações. Todas as decisões vêm do servidor.
 */
import * as THREE from 'three';
import type { Collider } from '../../../../shared/collision';
import {
  ENGINE_STAGES, FAILS, KM_PER_UNIT, NAVE_ARRIVAL, POWER_FX, POWER_MAX, ROLE_INFO, SHIP_FLOOR, SYSTEMS, SYSTEM_NAMES, USE_R,
  buildNaveMap, insideShip, planNave, stationsFor, usePoint,
  type FailKind, type NaveMap, type NavePlan, type RoleId, type StationDef,
} from '../../../../shared/games/nave';
import { audio } from '../../core/Audio';
import { mat, mesh } from '../../core/Assets';
import type { LocalPlayer } from '../../game/LocalPlayer';
import { MatchView } from '../../game/MatchView';
import type { ActionButton, Interactable } from '../../game/types';
import { el, esc } from '../../ui/dom';
import type { MinigameClient, MinigameClientCtx } from '../types';
import { drawConsoleScreen, drawStarMap, type MapAst, type ScreenData } from './screens';
import { buildShip, type ShipParts } from './ship';
import { Emitter, SpaceField } from './space';

/** [id, tipo, console, console2, etapa, etapas, progresso%, prazo, trabalhando] */
type FRow = [number, FailKind, string, string, number, number, number, number, number];

interface Core {
  run: number; ph: 'embark' | 'flight' | 'end'; st: number; la: number; lt: number;
  n: [number, number, number, number, number];
  hu: number; fu: number; o2: number; sh: number; pw: number[]; bud: number; cells: number; pil: number;
  rem: number; sw: number; f: FRow[]; w: [number, number][]; c: number[]; res: number; imp: number; end: string;
  ro?: [number, RoleId, string][];
  ast?: [number, number, number, number, number, number][];
  e?: { e: string; d: unknown }[];
}

const STYLE = `
.nv-left { width: min(300px, 46vw); }
.nv-role { display:flex; gap:8px; align-items:center; padding:6px 8px; border-radius:12px; margin:0 0 8px; font-weight:800; font-size:.9em; }
.nv-role small { display:block; font-weight:600; opacity:.85; font-size:.78em; }
.nv-fail { padding:6px 8px; border-radius:10px; background:rgba(255,77,94,.16); border:1px solid rgba(255,77,94,.45); margin:5px 0; font-size:.84em; }
.nv-fail.duo { background:rgba(124,92,255,.2); border-color:rgba(124,92,255,.6); }
.nv-fail.ev { background:rgba(255,201,60,.14); border-color:rgba(255,201,60,.5); }
.nv-fail b { display:block; }
.nv-fail .loc { opacity:.85; }
.nv-fail .bars { display:flex; gap:4px; margin-top:4px; }
.nv-fail .bars i { flex:1; height:5px; border-radius:9px; background:rgba(255,255,255,.15); overflow:hidden; }
.nv-fail .bars i u { display:block; height:100%; }
.nv-ok { font-size:.84em; opacity:.8; margin:4px 0; }
.nv-map { position:absolute; right:calc(10px + var(--safe-r)); top:calc(66px + var(--safe-t)); pointer-events:none !important; border-radius:50%; box-shadow:0 6px 24px rgba(0,0,0,.45); }
.nv-map canvas { display:block; width:100%; height:100%; }
.nv-pilot { position:absolute; right:calc(10px + var(--safe-r)); top:calc(74px + var(--safe-t) + var(--nvmap)); pointer-events:none !important; width:var(--nvmap); min-width:0; text-align:center; box-sizing:border-box; }
.nv-thr { height:10px; border-radius:99px; background:rgba(255,255,255,.15); overflow:hidden; margin-top:4px; }
.nv-thr i { display:block; height:100%; background:linear-gradient(90deg,#39d0ff,#ffc93c,#ff4d5e); }
.nv-power { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(380px,90vw); padding:14px 16px; border-radius:20px; background:rgba(14,10,38,.9); border:2px solid #ffc93c; pointer-events:auto; }
.nv-power h5 { margin:0 0 10px; font-family:var(--display); font-weight:normal; font-size:1.2em; display:flex; justify-content:space-between; }
.nv-row { display:flex; align-items:center; gap:10px; margin:8px 0; font-weight:800; }
.nv-row span { flex:1; }
.nv-row .pips { display:flex; gap:4px; }
.nv-row .pips i { width:22px; height:16px; border-radius:5px; background:rgba(255,255,255,.14); }
.nv-row button, .nv-power .close { width:44px; height:40px; border-radius:12px; border:0; font:22px var(--display); color:#fff; background:rgba(255,255,255,.16); touch-action:manipulation; }
.nv-power .close { width:100%; margin-top:8px; font-size:1em; background:var(--violet); }
.nv-flash { position:absolute; inset:0; pointer-events:none !important; box-shadow: inset 0 0 160px 40px rgba(255,30,50,.7); opacity:0; transition:opacity .5s; }
.nv-hintbar { position:absolute; bottom:calc(110px + var(--safe-b)); left:50%; transform:translateX(-50%); min-width:240px; padding:8px 14px; border-radius:12px; background:rgba(255,201,60,.95); color:#3a2a00; font-weight:800; pointer-events:none !important; text-align:center; max-width:80vw; }
.nv-hintbar .pg { height:8px; border-radius:99px; background:rgba(0,0,0,.18); overflow:hidden; margin-top:5px; }
.nv-hintbar .pg i { display:block; height:100%; background:#2fc97a; }
@media (max-width:760px) { .nv-left { width:min(230px,48vw); font-size:.9em; } }
`;

const SYS_COLORS = ['#ff8a3d', '#7c5cff', '#ff4fa3', '#39d0ff'];

export default function create(ctx: MinigameClientCtx): MinigameClient {
  return new NaveClient(ctx);
}

class NaveClient implements MinigameClient {
  readonly sky = 'space' as const;
  readonly mood = 'tense' as const;
  hud: HTMLElement;
  private app: MinigameClientCtx['app'];
  readonly plan: NavePlan;
  readonly map: NaveMap;
  private root!: THREE.Group;
  private ship!: ShipParts;
  private space!: SpaceField;
  private own = new Set<THREE.Object3D>();
  core: Core | null = null;
  private run = 0;
  readonly asts = new Map<number, MapAst>();
  readonly roles = new Map<number, { id: RoleId; skills: string[] }>();
  readonly nav = { x: 0, y: 0, h: 0, v: 0, thr: 0.45 };
  private navAt = 0;
  isStarted = false;
  private emitters: { st: string; e: Emitter }[] = [];
  private myThr = 0.45;
  private myTurn = 0;
  private wasPilot = false;
  private pilotSend = 0;
  private stopSent = 0;
  powerOpen = false;
  private screenT = 0;
  private screenIdx = 0;
  private alarmT = 0;
  private cloudsCleared = false;
  private heldCells = new Map<number, THREE.Object3D>();
  private embarkArrow: THREE.Mesh;
  private center: THREE.Vector3;
  // HUD
  private topEl: HTMLElement;
  private leftEl: HTMLElement;
  private mapBox: HTMLElement;
  private mapCanvas: HTMLCanvasElement;
  private pilotEl: HTMLElement;
  private powerEl: HTMLElement;
  private hintEl: HTMLElement;
  private flashEl: HTMLElement;
  private last = { top: '', left: '', pilot: '', power: '', hint: '' };
  private mapBig = false;

  constructor(ctx: MinigameClientCtx) {
    this.app = ctx.app;
    this.plan = planNave(ctx.players, ctx.difficulty);
    this.map = buildNaveMap(this.plan.layout);
    const b = this.map.bounds;
    this.center = new THREE.Vector3((b.x0 + b.x1) / 2, SHIP_FLOOR, (b.z0 + b.z1) / 2);
    this.hud = el('div', 'passthrough');
    this.hud.style.cssText = 'position:absolute;inset:0';
    const style = document.createElement('style');
    style.textContent = STYLE;
    this.hud.appendChild(style);
    this.topEl = el('div'); this.topEl.style.pointerEvents = 'none';
    this.leftEl = el('div', 'objectives nv-left');
    this.mapBox = el('div', 'nv-map');
    this.mapCanvas = document.createElement('canvas');
    this.mapBox.appendChild(this.mapCanvas);
    this.pilotEl = el('div', 'nv-pilot mbox');
    this.pilotEl.hidden = true;
    this.powerEl = el('div');
    this.powerEl.style.pointerEvents = 'none';
    this.hintEl = el('div');
    this.hintEl.style.pointerEvents = 'none';
    this.flashEl = el('div', 'nv-flash');
    this.hud.append(this.topEl, this.leftEl, this.mapBox, this.pilotEl, this.powerEl, this.hintEl, this.flashEl);
    this.setMapSize(false);
    this.powerEl.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!t) return;
      if (t.dataset.close !== undefined) { this.powerOpen = false; this.renderPower(); return; }
      this.app.net.send({ t: 'act', a: 'power', d: { s: t.dataset.s, d: Number(t.dataset.d) } });
      audio.play('click');
    });
    this.embarkArrow = mesh(new THREE.ConeGeometry(0.35, 0.8, 4), mat('#39d0ff', 0.3, 0, '#39d0ff', 1.8), false);
    this.embarkArrow.rotation.x = Math.PI;
  }

  colliders(): Collider[] { return this.map.colliders; }
  arrivalPose() { return NAVE_ARRIVAL; }

  /* ------------------------------ construção ------------------------------ */

  async build(root: THREE.Group, progress: (p: number) => void): Promise<void> {
    this.root = root;
    const q = this.app.renderer.preset.particles;
    progress(0.1);
    this.ship = buildShip(this.map, q);
    root.add(this.ship.root);
    progress(0.6);
    this.space = new SpaceField(this.center, q);
    root.add(this.space.group);
    for (const s of this.map.stations) {
      const c = this.ship.consoles.get(s.id)!;
      const kinds: ('fire' | 'spark' | 'smoke' | 'mist')[] = s.kind === 'engine' ? ['fire', 'spark', 'smoke'] : s.kind === 'power' || s.kind === 'nav' || s.kind === 'shield' ? ['spark'] : s.kind === 'tank' ? ['smoke'] : s.kind === 'life' ? ['mist'] : [];
      for (const k of kinds) {
        const e = new Emitter(c.fxAt, k, Math.round((k === 'smoke' ? 30 : 50) * q));
        root.add(e.points);
        this.emitters.push({ st: s.id, e });
      }
    }
    root.add(this.embarkArrow);
    for (const o of root.children) this.own.add(o);
    progress(1);
  }

  private setMapSize(big: boolean): void {
    this.mapBig = big;
    const px = big ? 300 : 190;
    this.mapCanvas.width = px * 2;
    this.mapCanvas.height = px * 2;
    const size = big ? 'min(300px, 32vw)' : 'min(190px, 26vw)';
    this.hud.style.setProperty('--nvmap', size);
    this.mapBox.style.width = size;
    this.mapBox.style.height = size;
  }

  /* ------------------------------ estado ------------------------------ */

  applyState(s: unknown): void { this.applyCore(s as Core); }
  applyDelta(d: unknown): void { this.applyCore(d as Core); }

  private applyCore(d: Core): void {
    if (!d || d.run === undefined) return;
    if (d.run !== this.run) {
      // nova partida (inclusive "Jogar de novo"): zera o estado local
      this.run = d.run;
      this.asts.clear();
      this.roles.clear();
      this.powerOpen = false;
      this.myThr = d.n[4];
    }
    this.core = d;
    this.nav.x = d.n[0]; this.nav.y = d.n[1]; this.nav.v = d.n[3]; this.nav.thr = d.n[4];
    let dh = d.n[2] - this.nav.h;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    if (Math.abs(dh) > 0.5) this.nav.h = d.n[2];
    this.navTarget = d.n[2];
    this.navAt = performance.now();
    if (d.ro) { this.roles.clear(); for (const [pid, id, sk] of d.ro) this.roles.set(pid, { id, skills: sk ? sk.split(',') : [] }); }
    if (d.ast) {
      this.asts.clear();
      for (const [id, x, y, vx, vy, r] of d.ast) this.asts.set(id, { x, y, vx, vy, r });
    }
    if (d.ph !== 'embark' && !this.isStarted) this.isStarted = true;
    for (const e of d.e ?? []) this.onEvent(e.e, e.d);
  }
  private navTarget = 0;

  started(): void { this.isStarted = true; }

  /* ------------------------------ helpers ------------------------------ */

  private me(): number { return this.app.myId; }
  private myRole() { return this.roles.get(this.me()); }
  private hasSkill(s: string): boolean { return !!this.myRole()?.skills.includes(s); }
  private station(id: string): StationDef | undefined { return this.map.stations.find((s) => s.id === id); }
  private roomName(stId: string): string {
    if (stId === 'helm') return 'Ponte (manche)';
    const s = this.station(stId);
    const r = s && this.map.rooms.find((q) => q.id === s.room);
    return r ? r.name : stId;
  }
  private fails(): FRow[] { return this.core?.f ?? []; }
  private myWork(): FRow | null {
    const w = this.core?.w.find((x) => x[0] === this.me());
    return w ? this.fails().find((f) => f[0] === w[1]) ?? null : null;
  }
  private carrying(): boolean { return !!this.core?.c.includes(this.me()); }
  private isPilot(): boolean { return !!this.core && this.core.pil === this.me() && this.core.pil !== 0; }
  private sensorRange(): number { return POWER_FX.sensor[this.core?.pw[3] ?? 2]; }
  private sensorsDown(): boolean { return this.fails().some((f) => f[1] === 'sensors'); }

  private failLabel(f: FRow): string {
    const def = FAILS[f[1]];
    if (f[1] === 'engine') return `${ENGINE_STAGES[f[4]] ?? def.action} (${f[4] + 1}/${f[5]})`;
    return def.action;
  }

  /* ------------------------------ interação ------------------------------ */

  interactables(lp: LocalPlayer): Interactable[] {
    const c = this.core;
    if (!c || c.ph !== 'flight') return [];
    const out: Interactable[] = [];
    const send = (id: string) => () => this.app.net.send({ t: 'interact', id });
    const wp = lp.worldPos(new THREE.Vector3());
    if (this.isPilot()) {
      out.push({ id: 'helm:exit', pos: wp, r: 99, prio: 11, label: 'Sair do manche', use: send('helm:exit') });
      return out;
    }
    const work = this.myWork();
    if (work) {
      out.push({ id: 'stop', pos: wp, r: 99, prio: 11, label: `Parar: ${this.failLabel(work)}`, use: send('stop') });
      return out;
    }
    const carrying = this.carrying();
    const at = (s: StationDef) => { const u = usePoint(s); return new THREE.Vector3(u.x, wp.y, u.z); };
    for (const s of this.map.stations) {
      const pos = at(s);
      if (carrying) {
        if (s.kind === 'tank') out.push({ id: 'tank:fill', pos, r: 1.9, prio: 3, label: `Abastecer o tanque (+${this.plan.cellFuel}%)`, use: send('tank:fill') });
        continue;
      }
      const f = this.fails().find((x) => x[1] !== 'asteroids' && (x[2] === s.id || x[3] === s.id));
      if (f) {
        const duo = !!f[3];
        const bonus = this.hasSkill(f[1]) ? ' ★' : '';
        const other = duo ? (f[2] === s.id ? f[3] : f[2]) : '';
        out.push({ id: `work:${f[0]}`, pos, r: 1.8, prio: 2, label: `${this.failLabel(f)}${duo ? ` — junto com alguém em ${this.roomName(other)}` : ''}${bonus}`, use: send(`work:${f[0]}`) });
        continue;
      }
      if (s.kind === 'helm' && !c.pil) out.push({ id: 'helm', pos, r: 1.8, prio: 1, label: 'Assumir o manche (pilotar)', use: send('helm') });
      if (s.kind === 'power') out.push({ id: 'power:open', pos, r: 1.8, prio: 1, label: 'Abrir o painel de energia', use: () => { this.powerOpen = true; this.renderPower(); } });
      if (s.kind === 'cells' && c.cells > 0) out.push({ id: 'cell:take', pos, r: 1.8, prio: 1, label: `Pegar célula de combustível (${c.cells})`, use: send('cell:take') });
    }
    return out;
  }

  private nearPower(lp: LocalPlayer, slack = 0): boolean {
    const s = stationsFor(this.map, 'power')[0];
    const u = usePoint(s);
    return lp.plat === 0 && Math.hypot(lp.s.x - u.x, lp.s.z - u.z) < USE_R + slack;
  }

  actionButtons(lp: LocalPlayer): ActionButton[] {
    const c = this.core;
    if (!c || c.ph !== 'flight') return [];
    const send = (id: string) => () => this.app.net.send({ t: 'interact', id });
    if (this.isPilot()) return [{ id: 'helm:exit', label: 'Sair', key: 'F', onDown: send('helm:exit') }];
    const out: ActionButton[] = [];
    if (this.myWork()) out.push({ id: 'stop', label: 'Parar', key: 'F', onDown: send('stop') });
    else if (this.carrying()) out.push({ id: 'cell:drop', label: 'Devolver célula', key: 'F', onDown: send('cell:drop') });
    if (this.nearPower(lp)) out.push({ id: 'power', label: this.powerOpen ? 'Fechar energia' : 'Energia', key: 'R', onDown: () => { this.powerOpen = !this.powerOpen; this.renderPower(); } });
    return out;
  }

  /* ------------------------------ eventos ------------------------------ */

  onEvent(e: string, d: unknown): void {
    const o = (d ?? {}) as Record<string, unknown>;
    const st = typeof o.st === 'string' ? this.station(o.st) : undefined;
    const at = st ? { x: st.x, y: SHIP_FLOOR + 1, z: st.z } : undefined;
    const kind = o.kind as FailKind | undefined;
    switch (e) {
      case 'embark': this.app.ui.banner('Estação Órbita Kepler', 'Atravessem a passarela até a eclusa da nave', 3200); break;
      case 'launch':
        audio.play('thruster'); audio.play('whoosh'); this.app.cam.addShake(0.7);
        this.app.ui.banner('Decolagem!', 'Eclusa fechada — mantenham a nave inteira até o destino', 3200);
        break;
      case 'fail':
        if (kind) { this.app.ui.toast(`${FAILS[kind].icon} ${FAILS[kind].name} — ${this.roomName(String(o.st))}`, 'warn', 3200); audio.play('error'); }
        break;
      case 'escalate':
        audio.play('break', { at }); this.app.cam.addShake(0.45);
        if (kind === 'engine') this.app.ui.toast('💥 O fogo destruiu o motor! Agora precisa de reparo em etapas.', 'err', 3600);
        else if (kind) this.app.ui.toast(`⚠ ${FAILS[kind].name} piorou! O casco sofreu dano.`, 'err', 3000);
        this.flash();
        break;
      case 'stage': audio.play('chime', { at }); if (kind === 'engine') this.app.ui.toast(`🔧 Etapa concluída — próxima: ${ENGINE_STAGES[Number(o.stage)]}${this.plan.duo && Number(o.stage) === ENGINE_STAGES.length - 1 ? ' (alguém precisa estar no manche!)' : ''}`, 'info', 3500); break;
      case 'fixed':
        audio.play('success');
        if (kind) this.app.ui.toast(`✓ ${FAILS[kind].name} resolvido!`, 'ok', 2400);
        break;
      case 'impact': {
        const dmg = Number(o.dmg) || 0;
        audio.play('impact', { vol: 1 });
        this.app.cam.addShake(Math.min(1, 0.35 + dmg / 12));
        if (dmg > 0) { this.app.ui.toast(`☄ Impacto de asteroide! −${dmg}% de casco`, 'err', 1800); this.flash(); } else this.app.ui.toast('☄ O escudo absorveu um impacto', 'info', 1500);
        break;
      }
      case 'shower': audio.play('whoosh'); this.app.ui.banner('Chuva de asteroides!', 'Piloto: desvie pelo mapa estelar • Escudos no máximo!', 3000); break;
      case 'showerEnd': this.app.ui.toast('A chuva de asteroides passou.', 'ok', 2200); break;
      case 'pilot': if (o.id === this.me()) this.app.ui.toast('Pilotando: A/D vira o rumo • W/S acelera e freia • F sai do manche', 'info', 4500); break;
      case 'cell': case 'celldrop': audio.play('pop'); break;
      case 'refuel': audio.play('coin'); this.app.ui.toast(`⛽ Tanque abastecido: ${o.fuel}%`, 'ok', 2000); break;
      case 'power': audio.play('click', { vol: 0.5 }); break;
      case 'powercut': this.app.ui.toast('⚡ Curto-circuito! Energia cortada — redistribua no painel elétrico.', 'warn', 3000); break;
      case 'farEvents': this.app.ui.toast('🚨 Falhas em alas opostas da nave! Dividam a tripulação.', 'warn', 3500); break;
    }
  }

  private flash(): void {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '1';
    requestAnimationFrame(() => { this.flashEl.style.transition = 'opacity .8s'; this.flashEl.style.opacity = '0'; });
  }

  /* ------------------------------ atualização ------------------------------ */

  update(dt: number, now: number, lp: LocalPlayer): void {
    const c = this.core;
    if (!c) return;
    if (!this.cloudsCleared) { this.app.env.clearClouds(); this.cloudsCleared = true; }
    const t = now / 1000;
    const flying = c.ph !== 'embark' && c.lt > 0;
    // navegação: extrapola entre snapshots
    const since = Math.min(0.25, (performance.now() - this.navAt) / 1000);
    let dh = this.navTarget - this.nav.h;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.nav.h += dh * Math.min(1, dt * 8);
    const nx = c.n[0] + Math.cos(c.n[2]) * c.n[3] * since, ny = c.n[1] + Math.sin(c.n[2]) * c.n[3] * since;
    this.nav.x += (nx - this.nav.x) * Math.min(1, dt * 10);
    this.nav.y += (ny - this.nav.y) * Math.min(1, dt * 10);
    for (const a of this.asts.values()) { a.x += a.vx * dt; a.y += a.vy * dt; }

    // ---------- piloto local ----------
    const pilot = this.isPilot();
    if (pilot) {
      if (!this.wasPilot) this.myThr = c.n[4];
      const inp = this.app.input;
      this.myTurn = inp.move.x;
      this.myThr = Math.max(0, Math.min(1, this.myThr + inp.move.y * 0.5 * dt));
      this.pilotSend += dt;
      if (this.pilotSend > 0.1) { this.pilotSend = 0; this.app.net.send({ t: 'act', a: 'pilot', d: { turn: Math.round(this.myTurn * 100) / 100, thr: Math.round(this.myThr * 100) / 100 } }); }
      this.app.cam.forceDist = 11;
    } else if (this.wasPilot) this.app.cam.forceDist = null;
    if (pilot !== this.wasPilot) this.setMapSize(pilot);
    this.wasPilot = pilot;

    // ---------- trabalho / célula ----------
    const work = this.myWork();
    if (work) {
      lp.busy = 0.2;
      const m = this.app.input.move;
      if (Math.hypot(m.x, m.y) > 0.6 && now - this.stopSent > 400) { this.stopSent = now; this.app.net.send({ t: 'interact', id: 'stop' }); }
    }
    const carrying = this.carrying();
    lp.carrying = carrying;
    lp.speedMul = carrying ? (this.hasSkill('cells') ? 1 : 0.82) : 1;
    this.updateHeldCells(c, lp);
    // PC: teclas das ações contextuais
    const btns = this.actionButtons(lp);
    if (this.app.input.take('action')) btns.find((b) => b.key === 'F')?.onDown();
    if (this.app.input.take('action2')) btns.find((b) => b.key === 'R')?.onDown();
    if (this.powerOpen && !this.nearPower(lp, 1)) { this.powerOpen = false; }

    // ---------- eclusa, doca e partida ----------
    const door = this.app.view instanceof MatchView ? this.app.view.colFor(0).byId('nave-airlock') : undefined;
    if (door) door.disabled = c.ph === 'embark';
    const dl = this.ship.airlockDoor;
    const targetY = c.ph === 'embark' ? 2.7 : 0;
    dl.position.y += (targetY - dl.position.y) * Math.min(1, dt * 3);
    const k = flying ? Math.min(1, (now - c.lt) / 7000) : 0;
    const off = new THREE.Vector3(-k * k * 160, -k * k * 25, -k * k * 70);
    this.ship.dock.position.copy(off);
    this.ship.dock.visible = k < 1;
    for (const o of this.root.children) {
      if (this.own.has(o)) continue;
      if (o.userData.navBase === undefined) o.userData.navBase = o.position.clone();
      o.position.copy(o.userData.navBase as THREE.Vector3).add(off);
      o.visible = k < 1;
    }
    if (this.app.view instanceof MatchView) {
      const tr = this.app.view.train.root;
      tr.position.add(off);
      tr.visible = k < 1;
    }
    const wpos = lp.worldPos(new THREE.Vector3());
    const inside = lp.plat === 0 && insideShip(this.map, wpos.x, wpos.z, wpos.y);
    for (const r of this.ship.roofs) r.visible = !inside;
    this.embarkArrow.visible = c.ph === 'embark' && !inside && wpos.z < -20.4;
    this.embarkArrow.position.set(0, SHIP_FLOOR + 4.4 + Math.sin(t * 4) * 0.25, -14.6);
    this.embarkArrow.rotation.y += dt * 3;
    if (inside && this.app.cam.pitch < 0.75) this.app.cam.pitch += (0.75 - this.app.cam.pitch) * Math.min(1, dt * 3);

    // ---------- alarmes, consoles e efeitos ----------
    const fails = this.fails();
    const failing = new Map<string, FRow>();
    for (const f of fails) { if (f[1] === 'asteroids') continue; failing.set(f[2], f); if (f[3] && f[3] !== 'helm') failing.set(f[3], f); }
    const failRooms = new Set<string>();
    for (const sid of failing.keys()) { const s = this.station(sid); if (s) failRooms.add(s.room); }
    if (c.sw) failRooms.add('ponte');
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    const red = new THREE.Color('#ff2a3d');
    for (const [rid, m] of this.ship.roomMats) {
      if (failRooms.has(rid)) { m.mat.emissive.copy(red); m.mat.emissiveIntensity = 0.6 + pulse * 2.2; }
      else { m.mat.emissive.copy(m.base); m.mat.emissiveIntensity = 1.6; }
    }
    const engines = this.map.engines;
    for (const [sid, cp] of this.ship.consoles) {
      const f = failing.get(sid);
      cp.beacon.emissiveIntensity = f ? (Math.sin(t * 10) > 0 ? 3 : 0.2) : 0;
      const arrow = this.ship.arrows.get(sid);
      if (arrow) { arrow.visible = this.plan.hints && !!f; arrow.position.y = SHIP_FLOOR + cp.st.h + 1.3 + Math.sin(t * 4) * 0.2; arrow.rotation.y += dt * 3; }
      const sp = this.nav.v / this.plan.vmax;
      if (cp.st.kind === 'engine') {
        const broken = f?.[1] === 'engine', fire = f?.[1] === 'fire';
        cp.spin.forEach((o) => { o.rotation.x += dt * (broken ? 0.5 : 2 + sp * 16); });
        cp.glow?.emissive.set(fire ? '#ff6a1a' : broken ? '#ff2a3d' : '#59c8ff');
        if (cp.glow) cp.glow.emissiveIntensity = fire || broken ? 1.2 + pulse * 2 : 1.2 + sp * 1.8;
        if (cp.flames) {
          cp.flames.visible = fire;
          if (fire) cp.flames.children.forEach((o, i) => { o.scale.set(1, 0.7 + 0.45 * Math.abs(Math.sin(t * 9 + i * 1.7)), 1); o.position.y = 1.95 + o.scale.y * 0.35; });
        }
      } else for (const o of cp.spin) o.rotation.y += dt * 1.5;
      if (cp.st.kind === 'life') cp.spin.forEach((o) => { o.rotation.z += dt * (f ? 0.6 : 6); });
      if (cp.orb) {
        const shf = c.sh / 100;
        cp.orb.scale.setScalar(0.6 + shf * 0.7 + Math.sin(t * 3) * 0.04);
        (cp.orb.material as THREE.MeshStandardMaterial).opacity = 0.35 + shf * 0.6;
        (cp.orb.material as THREE.MeshStandardMaterial).emissive.set(f ? '#ff2a3d' : '#7c5cff');
      }
      if (cp.cells) cp.cells.forEach((o, i) => { o.visible = i < c.cells; });
      if (cp.stick) {
        const turn = pilot ? this.myTurn : 0;
        cp.stick.rotation.z += (-turn * 0.45 - cp.stick.rotation.z) * Math.min(1, dt * 10);
        cp.stick.rotation.x += (((pilot ? this.app.input.move.y : 0) * 0.4) - cp.stick.rotation.x) * Math.min(1, dt * 10);
      }
      if (cp.lever) cp.lever.rotation.x = (0.5 - (pilot ? this.myThr : c.n[4])) * 1.2;
    }
    for (const { st, e } of this.emitters) {
      const f = failing.get(st);
      const fk = f?.[1];
      e.active = (e.kind === 'fire' && fk === 'fire') || (e.kind === 'spark' && (fk === 'short' || fk === 'engine' || fk === 'sensors' || fk === 'shield')) || (e.kind === 'smoke' && (fk === 'leak' || fk === 'fire' || fk === 'engine')) || (e.kind === 'mist' && fk === 'life');
      e.update(dt);
    }
    // bocais externos
    const sp = flying ? this.nav.v / this.plan.vmax : 0;
    this.ship.nozzles.forEach((n, i) => {
      const es = engines[i] ? failing.get(engines[i].station) : undefined;
      const lvl = es?.[1] === 'engine' ? sp * 0.25 : sp;
      n.flame.scale.set(0.5 + lvl * 0.6, 0.3 + lvl * 1.6 + Math.random() * 0.1 * lvl, 0.5 + lvl * 0.6);
      (n.flame.material as THREE.MeshBasicMaterial).opacity = 0.08 + lvl * 0.3;
      n.glow.emissiveIntensity = 0.6 + lvl * 2.2;
    });
    // espaço
    const progress = Math.max(0, Math.min(1, 1 - c.rem / this.plan.distance));
    this.space.update(dt, t, { ...this.nav, vmax: this.plan.vmax }, this.asts, this.plan.distance, 0, progress);
    // telas (algumas por quadro, ~5 Hz cada)
    this.screenT += dt;
    if (this.screenT > 0.05) { this.screenT = 0; this.drawScreens(t, failing); }
    // sons
    if (flying && c.ph === 'flight') audio.loop('nave', 'engine', 0.05 + sp * 0.12, 0.45 + sp * 0.5); else audio.stopLoop('nave');
    this.alarmT -= dt;
    if (failing.size && c.ph === 'flight' && this.alarmT <= 0) { this.alarmT = 1.6; audio.play('error', { vol: 0.35 }); }
    this.updateHud(now, lp, failing);
  }

  private updateHeldCells(c: Core, lp: LocalPlayer): void {
    const ids = new Set(c.c);
    for (const [pid, o] of this.heldCells) if (!ids.has(pid)) { o.removeFromParent(); this.heldCells.delete(pid); }
    for (const pid of ids) {
      let o = this.heldCells.get(pid);
      if (!o) {
        o = new THREE.Group();
        o.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.45, 12), mat('#c8ffe0', 0.3, 0, '#2fc97a', 2), false));
        o.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 12), mat('#8f9bb5', 0.35, 0.7), false));
        o.children[1].position.y = 0.25;
        this.root.add(o);
        this.heldCells.set(pid, o);
      }
      const av = pid === this.me() ? lp.avatar.root : this.app.remotes.get(pid)?.avatar.root;
      if (!av) continue;
      const p = av.getWorldPosition(new THREE.Vector3());
      const yaw = av.rotation.y;
      o.position.set(p.x + Math.sin(yaw) * 0.45, p.y + 1.15, p.z + Math.cos(yaw) * 0.45);
      o.rotation.set(0, yaw, Math.PI / 2);
    }
  }

  private screenData(t: number, f: FRow | undefined): ScreenData {
    const c = this.core!;
    return {
      t, v: this.nav.v, vmax: this.plan.vmax, fuel: c.fu, o2: c.o2, shield: c.sh, hull: c.hu, cells: c.cells, pw: c.pw, bud: c.bud,
      fail: f ? { kind: f[1], stage: f[4], stages: f[5], progress: f[6] } : null, leak: this.fails().some((x) => x[1] === 'leak'), range: this.sensorRange(),
    };
  }

  private drawScreens(t: number, failing: Map<string, FRow>): void {
    const list = [...this.ship.consoles.values()];
    for (let i = 0; i < 2; i++) {
      const cp = list[this.screenIdx++ % list.length];
      const s = cp.screen;
      if (cp.st.kind === 'helm') drawStarMap(s.ctx, s.w, s.h, this.mapView(t), false);
      else drawConsoleScreen(cp.st.kind, s.ctx, s.w, s.h, this.screenData(t, failing.get(cp.st.id)));
      s.tex.needsUpdate = true;
    }
  }

  private mapView(t: number) {
    const c = this.core!;
    return { x: this.nav.x, y: this.nav.y, h: this.nav.h, v: this.nav.v, thr: c.n[4], destX: this.plan.distance, destY: 0, asts: this.asts.values(), range: this.sensorRange(), sensorsDown: this.sensorsDown(), shower: !!c.sw, t, vmax: this.plan.vmax };
  }

  /* ------------------------------ HUD ------------------------------ */

  private renderPower(): void {
    const c = this.core;
    if (!this.powerOpen || !c) { if (this.last.power) { this.powerEl.innerHTML = ''; this.last.power = ''; } return; }
    const used = c.pw.reduce((a, b) => a + b, 0);
    const short = this.fails().some((f) => f[1] === 'short');
    const html = `<div class="nv-power"><h5><span>⚡ Painel de energia</span><small>${used}/${c.bud}${short ? ' ⚠ curto' : ''}</small></h5>
      ${SYSTEMS.map((s, i) => `<div class="nv-row"><span>${esc(SYSTEM_NAMES[s])}</span><button data-s="${s}" data-d="-1" aria-label="Menos">−</button><div class="pips">${Array.from({ length: POWER_MAX }, (_, k) => `<i style="${k < c.pw[i] ? `background:${SYS_COLORS[i]}` : ''}"></i>`).join('')}</div><button data-s="${s}" data-d="1" aria-label="Mais">+</button></div>`).join('')}
      <div class="nv-ok">Motores = velocidade • Escudos = proteção • Suporte de vida = O₂ • Sensores = alcance do mapa</div>
      <button class="close" data-close>Fechar</button></div>`;
    if (html !== this.last.power) { this.powerEl.innerHTML = html; this.last.power = html; }
  }

  private updateHud(now: number, lp: LocalPlayer, failing: Map<string, FRow>): void {
    const c = this.core!;
    const cls = (v: number, warn: number, bad: number) => (v <= bad ? 'danger' : v <= warn ? 'warn' : '');
    const top = `<div class="mhud">
      <div class="mbox ${cls(c.hu, 50, 25)}"><small>Casco</small><b>${Math.ceil(c.hu)}%</b></div>
      <div class="mbox ${cls(c.sh, 30, 10)}"><small>Escudo</small><b>${Math.round(c.sh)}%</b></div>
      <div class="mbox ${cls(c.fu, 30, 12)}"><small>Combustível</small><b>${Math.round(c.fu)}%</b></div>
      <div class="mbox ${cls(c.o2, 40, 20)}"><small>O₂</small><b>${Math.round(c.o2)}%</b></div>
      <div class="mbox"><small>Destino</small><b>${Math.round(c.rem * KM_PER_UNIT).toLocaleString('pt-BR')}</b><small>mil km</small></div>
    </div>`;
    if (top !== this.last.top) { this.topEl.innerHTML = top; this.last.top = top; }
    // painel esquerdo: papel + falhas
    const role = this.myRole();
    const ri = role ? ROLE_INFO[role.id] : null;
    const skillTxt = role ? role.skills.filter((s) => s !== 'asteroids').map((s) => s === 'helm' ? 'pilotar' : s === 'cells' ? 'carregar células' : s === 'power' ? 'energia' : FAILS[s as FailKind]?.name.toLowerCase()).join(', ') : '';
    let body = '';
    if (c.ph === 'embark') {
      const left = Math.max(0, Math.ceil((c.la - now) / 1000));
      body = `<div class="nv-ok">🚪 Entrem todos na nave pela passarela. Decolagem quando a tripulação estiver a bordo (ou em ${left}s).</div>`;
    } else {
      const list = this.fails();
      if (!list.length) body = '<div class="nv-ok">✓ Todos os sistemas funcionando. Fiquem atentos!</div>';
      for (const f of list) {
        const def = FAILS[f[1]];
        const leftS = Math.max(0, Math.ceil((f[7] - now) / 1000));
        const duo = !!f[3];
        const loc = f[1] === 'asteroids' ? 'Ponte: piloto desvia pelo mapa' : `${this.roomName(f[2])}${duo ? ` + ${this.roomName(f[3])}` : ''}`;
        const stage = f[1] === 'engine' ? ` • etapa ${f[4] + 1}/${f[5]}` : '';
        const tag = duo ? ' • 2 pessoas' : '';
        const mine = this.hasSkill(f[1]) ? ' ★' : '';
        body += `<div class="nv-fail ${f[1] === 'asteroids' ? 'ev' : duo ? 'duo' : ''}"><b>${def.icon} ${esc(def.name)}${mine}</b><span class="loc">📍 ${esc(loc)}${stage}${tag}</span>
          <div class="bars"><i><u style="width:${Math.min(100, f[6])}%;background:#2fc97a"></u></i><i title="prazo"><u style="width:${Math.min(100, (leftS / (this.plan.deadline * (f[1] === 'engine' ? 1.6 : 1))) * 100)}%;background:${leftS < 10 ? '#ff4d5e' : '#ffc93c'}"></u></i></div>
          ${f[1] !== 'asteroids' ? `<small>${f[8] ? '🔧 em reparo' : this.plan.hints ? `→ vá até ${esc(this.roomName(f[2]))}` : ''} ⏱ ${leftS}s</small>` : `<small>⏱ ${leftS}s</small>`}</div>`;
      }
    }
    const left = `<h5>🚀 Nave em Perigo</h5>
      ${ri ? `<div class="nv-role" style="background:${ri.color}33;border:1px solid ${ri.color}"><span style="font-size:1.4em">${ri.icon}</span><div>Seu papel: ${esc(ri.name)}<small>Bônus ★ em: ${esc(skillTxt)}</small></div></div>` : ''}
      ${body}
      <div class="progress"><i style="width:${Math.round(Math.max(0, Math.min(1, 1 - c.rem / this.plan.distance)) * 100)}%"></i></div>
      <div class="nv-ok">⛽ ${c.cells} células na carga • ✓ ${c.res} falhas resolvidas</div>`;
    if (left !== this.last.left) { this.leftEl.innerHTML = left; this.last.left = left; }
    // mapa estelar
    drawStarMap(this.mapCanvas.getContext('2d')!, this.mapCanvas.width, this.mapCanvas.height, this.mapView(now / 1000), this.mapBig);
    this.mapBox.style.display = c.ph === 'embark' ? 'none' : '';
    // painel do piloto
    const pil = this.isPilot();
    this.pilotEl.hidden = !pil;
    if (pil) {
      const thr = Math.round(this.myThr * 100);
      const ph = `<small>Acelerador ${thr}% • ${(this.nav.v * KM_PER_UNIT).toFixed(0)} mil km/s</small><div class="nv-thr"><i style="width:${thr}%"></i></div>`;
      if (ph !== this.last.pilot) { this.pilotEl.innerHTML = ph; this.last.pilot = ph; }
    }
    this.renderPower();
    // dica contextual
    const work = this.myWork();
    let hint = '';
    let pg = -1;
    if (work) { hint = `${FAILS[work[1]].icon} ${this.failLabel(work)}…${work[3] && !(c.w.length > 1) ? ' (precisa de mais alguém no outro console!)' : ''}`; pg = work[6]; }
    else if (pil) hint = 'Pilotando: A/D vira • W/S acelera/freia • desvie dos asteroides vermelhos • F sai';
    else if (this.carrying()) hint = `Carregando célula de combustível → leve ao tanque (${this.roomName(stationsFor(this.map, 'tank')[0].id)})`;
    else if (c.ph === 'flight' && c.fu < 30 && c.cells > 0) hint = `Combustível baixo! Leve células de ${this.roomName('cells')} até o tanque`;
    else if (c.ph === 'flight' && !c.pil && this.hasSkill('helm')) hint = 'Ninguém no manche! Vá até a Ponte e assuma a pilotagem';
    else if (c.ph === 'flight' && c.o2 < 30) hint = 'Oxigênio baixo! Dê mais energia ao suporte de vida';
    void failing; void lp;
    const hh = hint ? `<div class="nv-hintbar">${esc(hint)}${pg >= 0 ? `<div class="pg"><i style="width:${Math.min(100, pg)}%"></i></div>` : ''}</div>` : '';
    if (hh !== this.last.hint) { this.hintEl.innerHTML = hh; this.last.hint = hh; }
  }

  dispose(): void {
    this.app.cam.forceDist = null;
    audio.stopLoop('nave');
    for (const o of this.heldCells.values()) o.removeFromParent();
    this.space?.dispose();
    if (this.app.view instanceof MatchView) this.app.view.train.root.visible = true;
  }
}

