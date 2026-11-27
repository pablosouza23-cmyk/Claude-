/**
 * Orquestrador do cliente: renderer, câmera, entrada, rede, UI e mundos.
 */
import * as THREE from 'three';
import type { PlayerInit, PrivateProfile, WorldEnter } from '../../../shared/protocol';
import type { GameId } from '../../../shared/minigames';
import { Avatar, loadAvatarClips } from '../avatar/Avatar';
import { audio } from '../core/Audio';
import { CameraRig } from '../core/CameraRig';
import { Input } from '../core/Input';
import { Renderer } from '../core/Renderer';
import { settings } from '../core/Settings';
import { LobbyView } from '../game/LobbyView';
import { LocalPlayer } from '../game/LocalPlayer';
import { MatchView } from '../game/MatchView';
import { RemotePlayer } from '../game/Remote';
import type { Interactable } from '../game/types';
import type { View } from '../game/View';
import { Net } from '../net/Net';
import { UI } from '../ui/UI';
import { Environment } from '../world/Environment';
import { VoiceChat, type VoicePeerInfo } from '../voice/Voice';

export class App {
  readonly renderer: Renderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  readonly cam: CameraRig;
  readonly input: Input;
  readonly net = new Net();
  readonly env: Environment;
  readonly ui: UI;
  clips!: Map<string, THREE.AnimationClip>;
  profile: PrivateProfile | null = null;
  view: View | null = null;
  local: LocalPlayer | null = null;
  myId = 0;
  readonly remotes = new Map<number, RemotePlayer>();
  private pendingWorld: WorldEnter | null = null;
  private pendingCorrect: { x: number; y: number; z: number; plat: 0 | 1 } | null = null;
  private loadingWorld = false;
  private clock = new THREE.Clock();
  private focus = new THREE.Vector3();
  private nearest: Interactable | null = null;
  private lastPos = new THREE.Vector3();
  readonly voice: VoiceChat;
  private speakingShown = new Map<number, boolean>();
  /** contadores para testes automatizados */
  readonly stats = { snaps: 0, corrections: 0, worlds: 0 };

  constructor(host: HTMLElement, uiRoot: HTMLElement) {
    this.renderer = new Renderer(host);
    this.cam = new CameraRig(this.camera);
    this.input = new Input(this.renderer.gl.domElement);
    this.env = new Environment(this.scene, this.renderer);
    this.voice = new VoiceChat(
      (to, d) => this.net.send({ t: 'rtc', to, d }),
      (on, mic) => this.net.send({ t: 'voice', on, mic }),
    );
    this.ui = new UI(this, uiRoot);
    settings.on(() => { this.env.applyQuality(); this.camera.far = Math.max(600, this.renderer.preset.drawDistance * 8); this.camera.updateProjectionMatrix(); });
    addEventListener('resize', () => this.onResize());
    this.onResize();
    this.bindNet();
    const unlock = () => { audio.unlock(); };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.clock.getDelta(); });
  }

  async start(boot: (p: number, msg: string) => void): Promise<void> {
    boot(0.15, 'Carregando personagens…');
    this.clips = await loadAvatarClips();
    boot(0.35, 'Conectando ao servidor…');
    const name = new URLSearchParams(location.search).get('name') ?? undefined;
    this.net.connect(name);
    this.renderer.gl.setAnimationLoop(() => this.frame());
  }

  playerCount(): number {
    return this.remotes.size + (this.local ? 1 : 0);
  }

  private onResize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.fov = innerWidth < innerHeight ? 75 : 60;
    this.camera.updateProjectionMatrix();
  }

  /* ------------------------------ rede ------------------------------ */

  private bindNet(): void {
    const n = this.net;
    n.onStatus = (s) => this.ui.netStatus(s);
    n.on('welcome', (m) => {
      this.profile = m.profile;
      this.ui.setProfile(m.profile);
      if (m.needName) this.ui.askName();
    });
    n.on('profile', (m) => {
      this.profile = m.profile;
      this.ui.setProfile(m.profile);
      if (this.local) {
        this.local.avatar.applyOutfit(m.profile.outfit);
        this.local.avatar.setName(m.profile.name, m.profile.level);
      }
    });
    n.on('world', (m) => { this.pendingWorld = m; void this.enterWorld(); });
    n.on('pjoin', (m) => this.addRemote(m.p));
    n.on('pleave', (m) => this.removeRemote(m.id));
    n.on('pconn', (m) => {
      const r = this.remotes.get(m.id);
      if (r) { r.connected = m.connected; r.avatar.setGhost(!m.connected); r.avatar.setName(r.avatar.name, r.avatar.level, m.connected ? '' : '⚠'); }
    });
    n.on('pout', (m) => {
      const r = this.remotes.get(m.id);
      if (r) { r.avatar.applyOutfit(m.outfit); r.avatar.setName(m.name, m.level); }
    });
    n.on('snap', (m) => {
      this.stats.snaps++;
      for (const s of m.p) {
        if (s[0] === this.myId) {
          const lp = this.local;
          if (!lp) continue;
          const serverLock = this.view instanceof MatchView && (s[5] === 'sit' || s[5] === 'drive');
          if (serverLock) {
            lp.locked = true;
            lp.anim = s[5];
            lp.s.x = s[1]; lp.s.y = s[2]; lp.s.z = s[3]; lp.yaw = s[4];
            if (lp.plat !== s[6]) { lp.plat = s[6]; lp.reparent(); }
            lp.syncAvatar();
          } else if (lp.locked) {
            lp.locked = false;
          }
          continue;
        }
        this.remotes.get(s[0])?.push(m.st, s);
      }
      if (m.w !== undefined) this.view?.onWorld(m.w);
    });
    n.on('correct', (m) => {
      this.stats.corrections++;
      // durante o carregamento guarda a correção para aplicar depois
      if (this.loadingWorld || !this.local?.colFor) { this.pendingCorrect = m; return; }
      this.local.correct(m.x, m.y, m.z, m.plat);
    });
    n.on('ev', (m) => {
      if (m.e === 'achievement') { this.ui.achievement((m.d as { id: string }).id); return; }
      this.view?.onEvent(m.e, m.d);
    });
    n.on('chat', (m) => this.ui.chatLine(m.name, m.text));
    n.on('emote', (m) => {
      const r = this.remotes.get(m.id);
      r?.avatar.trigger(m.e, 2);
    });
    n.on('friends', (m) => this.ui.setFriends(m));
    n.on('invite', (m) => this.ui.invite(m.fromName, m.code, m.game));
    n.on('room', (m) => this.ui.setRoom(m.room));
    n.on('roomList', (m) => {
      this.ui.setRoomList(m.rooms);
      if (this.view instanceof LobbyView) this.view.onDepartures(m.rooms.filter((r) => r.state !== 'waiting').map((r) => ({ code: r.code, game: r.game, players: r.players })));
    });
    n.on('toast', (m) => this.ui.toast(m.msg, m.kind));
    n.on('ice', (m) => { this.voice.iceServers = m.servers as RTCIceServer[]; });
    n.on('voice', (m) => this.voice.setVoiceIds(m.on, this.myId));
    n.on('rtc', (m) => { void this.voice.onSignal(m.from, m.d as never); });
    n.on('auth', (m) => this.ui.onAuth(m));
    n.on('leaderboard', (m) => this.ui.setLeaderboard(m.rows));
    n.on('reward', (m) => this.ui.reward(m));
    n.on('err', (m) => this.ui.toast(m.msg, 'err'));
    // painel de partidas do lobby: atualiza periodicamente
    setInterval(() => { if (this.view instanceof LobbyView && this.net.connected) n.send({ t: 'roomList' }); }, 5000);
  }

  private async enterWorld(): Promise<void> {
    if (this.loadingWorld) return;
    const m = this.pendingWorld;
    if (!m) return;
    this.pendingWorld = null;
    // mesmo mundo (reconexão): só ressincroniza jogadores
    if (this.view && m.worldId === (this.view as unknown as { worldId?: string }).worldId) {
      this.syncPlayers(m);
      return;
    }
    this.loadingWorld = true;
    this.stats.worlds++;
    this.ui.showLoading(m.kind === 'lobby' ? 'Voltando à Praça PARTYVERSE…' : 'Rumo à estação…', 0);
    try {
      this.view?.dispose();
      this.voice.reset();
      for (const r of this.remotes.values()) r.avatar.dispose();
      this.remotes.clear();
      this.local?.avatar.dispose();
      this.local = null;
      const view: View = m.kind === 'lobby'
        ? new LobbyView(this)
        : new MatchView(this, m.game as GameId, m.difficulty!, m.state as never);
      (view as unknown as { worldId: string }).worldId = m.worldId;
      this.view = view;
      this.scene.add(view.root);
      this.myId = m.you;
      // jogadores (antes do load para o minigame saber quantos são)
      this.syncPlayers(m, false);
      await view.load((p, msg) => this.ui.showLoading(msg, p));
      this.syncPlayers(m);
      this.ui.setMode(m.kind);
      // o servidor cria um jogador novo a cada mundo: reanuncia a voz
      if (this.voice.state === 'on' || this.voice.state === 'listen-only') this.net.send({ t: 'voice', on: true, mic: this.voice.state === 'on' && !this.voice.micMuted });
      this.cam.worlds = view.cameraWorlds();
      const lp = this.local as LocalPlayer | null;
      if (lp) this.cam.snap(lp.worldPos(new THREE.Vector3()).add(new THREE.Vector3(0, 1.5, 0)));
    } catch (e) {
      console.error(e);
      this.ui.toast('Falha ao carregar o mundo. Tentando novamente…', 'err');
    } finally {
      this.loadingWorld = false;
      this.ui.hideLoading();
      if (this.pendingWorld) void this.enterWorld();
    }
  }

  private syncPlayers(m: WorldEnter, attach = true): void {
    const seen = new Set<number>();
    for (const p of m.players) {
      seen.add(p.id);
      if (p.id === m.you) {
        if (!this.local) {
          const av = new Avatar(p.outfit, this.clips, p.name, p.level);
          av.showTag(false);
          this.local = new LocalPlayer(av, this.net);
        }
        if (attach && this.view) this.bindLocal(p);
        continue;
      }
      if (!this.remotes.has(p.id)) this.addRemote(p);
      else if (attach) this.remotes.get(p.id)!.set(p.x, p.y, p.z, p.yaw, p.plat, p.anim);
    }
    for (const id of [...this.remotes.keys()]) if (!seen.has(id)) this.removeRemote(id);
    if (attach && this.view) for (const r of this.remotes.values()) r.update(0, this.net.now(), (pl) => this.view!.parentFor(pl));
  }

  private bindLocal(p: PlayerInit): void {
    const lp = this.local!;
    const v = this.view!;
    lp.colFor = (pl) => v.colFor(pl);
    lp.parentFor = (pl) => v.parentFor(pl);
    lp.platYaw = () => v.platYaw(lp.plat);
    lp.platformCheck = (l) => v.platformCheck(l);
    lp.place(p.x, p.y, p.z, p.plat, p.yaw);
    const pc = this.pendingCorrect;
    this.pendingCorrect = null;
    if (pc) lp.place(pc.x, pc.y, pc.z, pc.plat);
    this.cam.yaw = p.yaw + Math.PI;
  }

  private addRemote(p: PlayerInit): void {
    if (p.id === this.myId || this.remotes.has(p.id)) return;
    const av = new Avatar(p.outfit, this.clips, p.name, p.level);
    const r = new RemotePlayer(p.id, av, p.userId);
    r.connected = p.connected;
    av.setGhost(!p.connected);
    r.set(p.x, p.y, p.z, p.yaw, p.plat, p.anim);
    if (this.view) this.view.parentFor(p.plat).add(av.root);
    this.remotes.set(p.id, r);
  }

  private removeRemote(id: number): void {
    const r = this.remotes.get(id);
    if (!r) return;
    r.avatar.dispose();
    this.remotes.delete(id);
  }

  /* ------------------------------ loop ------------------------------ */

  private frame(): void {
    const dt = Math.min(0.1, this.clock.getDelta());
    this.renderer.track(dt);
    this.input.enabled = !this.ui.isBlocking();
    this.input.update();
    const now = this.net.now();
    const view = this.view;
    const lp = this.local;
    if (view && lp && !this.loadingWorld) {
      // emote rápido
      if (this.input.take('emote')) this.emote('wave');
      lp.update(dt, this.input, this.cam);
      for (const r of this.remotes.values()) r.update(dt, now, (pl) => view.parentFor(pl));
      view.update(dt, now);
      this.cam.worlds = view.cameraWorlds();
      // dentro do trem a câmera fica mais próxima (interior estreito)
      this.cam.maxDist = lp.plat === 1 ? 5 : 16;
      lp.worldPos(this.focus);
      this.focus.y += 1.55;
      // interação mais próxima
      const list = view.interactables(lp);
      let best: Interactable | null = null;
      let bestD = Infinity;
      const wp = lp.worldPos(new THREE.Vector3());
      for (const it of list) {
        const d = it.pos.distanceTo(wp) - (it.prio ?? 0) * 100;
        if (d < it.r && d < bestD) { best = it; bestD = d; }
      }
      this.nearest = best;
      this.ui.prompt(best ? best.label : null);
      if (best && this.input.take('interact')) { best.use(); audio.play('click'); }
      this.ui.setActionButtons(view.actionButtons());
      // velocidade para ouvir
      audio.listener = { x: wp.x, y: wp.y, z: wp.z };
      // etiquetas: esconde distantes
      for (const r of this.remotes.values()) r.avatar.showTag(r.avatar.root.getWorldPosition(this.lastPos).distanceTo(wp) < 30);
    }
    const look = this.input.consumeLook();
    if (!this.input.enabled) { look.x = look.y = look.zoom = 0; }
    this.cam.update(dt, look, this.focus);
    this.env.update(dt, this.focus);
    if (lp && view && this.voice.state !== 'off') this.updateVoice(lp, view);
    // atualiza avatares
    if (lp) lp.avatar.update(dt);
    for (const r of this.remotes.values()) r.avatar.update(dt);
    this.renderer.gl.render(this.scene, this.camera);
    this.ui.frame(dt, this.renderer.fps);
  }

  private updateVoice(lp: LocalPlayer, view: View): void {
    const info = new Map<number, VoicePeerInfo & { userId: string }>();
    const roomOnly = view instanceof LobbyView && settings.data.voiceLobby === 'room';
    const members = new Set(this.ui.room?.members.map((m) => m.userId) ?? []);
    const party = new Set<number>();
    const v = new THREE.Vector3();
    for (const r of this.remotes.values()) {
      const inRoom = members.has(r.userId);
      if (roomOnly && !inRoom) continue;
      if (roomOnly && inRoom) party.add(r.id);
      r.avatar.root.getWorldPosition(v);
      info.set(r.id, { id: r.id, name: r.avatar.name, userId: r.userId, pos: { x: v.x, y: v.y + 1.6, z: v.z } });
    }
    const me = lp.worldPos(new THREE.Vector3());
    const col = lp.plat === 0 ? view.colFor(0) : null;
    this.voice.update({ x: me.x, y: me.y + 1.6, z: me.z }, this.cam.yaw, info, col, roomOnly ? party : null);
    // indicador de fala na etiqueta de nome
    for (const r of this.remotes.values()) {
      const sp = this.voice.isSpeaking(r.id);
      if (this.speakingShown.get(r.id) !== sp) {
        this.speakingShown.set(r.id, sp);
        r.avatar.setName(r.avatar.name, r.avatar.level, sp ? '🔊' : r.connected ? '' : '⚠');
      }
    }
  }

  useNearest(): void {
    if (this.nearest) { this.nearest.use(); audio.play('click'); }
  }

  emote(id: string): void {
    if (!this.local) return;
    this.local.avatar.trigger(id, 2);
    this.net.send({ t: 'emote', id });
  }
}
