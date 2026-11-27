/**
 * Interface do jogo (DOM sobre o canvas): HUD, prompts, toasts, convites,
 * controles touch, chat, carregamento, banners e resultados. Os painéis
 * (Jogar, Amigos, Visual, Perfil, Configurações) ficam em panels.ts.
 */
import { GAMES, type Difficulty, type GameId } from '../../../shared/minigames';
import { ACH_BY_ID, levelFromXp } from '../../../shared/progression';
import type { FriendEntry, PrivateProfile, RoomListEntry, RoomView, S2C } from '../../../shared/protocol';
import { sanitizeName } from '../../../shared/constants';
import type { TrainSchedule } from '../../../shared/train';
import type { App } from '../app/App';
import { audio } from '../core/Audio';
import { isTyping } from '../core/Input';
import { settings, useTouch } from '../core/Settings';
import type { ActionButton } from '../game/types';
import { el, esc, on } from './dom';
import { gameIconSvg, icon } from './icons';
import { Panels, type PanelName } from './panels';
import { VoiceDock } from './voiceDock';

export class UI {
  readonly root: HTMLElement;
  private hud: HTMLElement;
  private promptEl: HTMLElement;
  private toasts: HTMLElement;
  private chat: HTMLElement;
  private chatLog: HTMLElement;
  private chatInput: HTMLInputElement;
  private roomPill: HTMLElement;
  private touch: HTMLElement;
  private matchLayer: HTMLElement;
  private trainBar: HTMLElement;
  private fpsEl: HTMLElement;
  private netEl: HTMLElement | null = null;
  private loading: HTMLElement | null = null;
  readonly panels: Panels;
  profile: PrivateProfile | null = null;
  friends: Extract<S2C, { t: 'friends' }> = { t: 'friends', friends: [], incoming: [], outgoing: [] };
  room: RoomView | null = null;
  roomList: RoomListEntry[] = [];
  mode: 'lobby' | 'match' = 'lobby';
  private actionKey = '';
  private actions: ActionButton[] = [];
  private bannerTimer = 0;
  private voiceDock: VoiceDock;
  leaderboard: { name: string; level: number; xp: number; wins: number }[] = [];
  private tutorialEl: HTMLElement | null = null;

  constructor(public app: App, root: HTMLElement) {
    this.root = root;
    document.documentElement.style.setProperty('--ui-scale', String(settings.data.uiScale));
    settings.on((d) => document.documentElement.style.setProperty('--ui-scale', String(d.uiScale)));

    // ---------------- HUD superior ----------------
    this.hud = el('div', 'hud-top');
    this.hud.innerHTML = `
      <div class="profile-chip" data-act="profile"><div class="lvl">1</div><div><div class="nm">…</div><div class="xpbar"><i style="width:0%"></i></div></div></div>
      <div class="coins"><span class="coin"></span><span data-coins>0</span></div>
      <div class="grow"></div>
      <div class="hud-menu">
        <button class="btn pink" data-act="play">${icon('play')}<span class="lbl">Jogar</span></button>
        <button class="btn" data-act="friends" style="position:relative">${icon('users')}<span class="lbl">Amigos</span><span class="badge" data-fbadge hidden></span></button>
        <button class="btn orange" data-act="style">${icon('shirt')}<span class="lbl">Visual</span></button>
        <button class="btn yellow icon-btn" data-act="profile2" title="Perfil e conquistas">${icon('trophy')}</button>
        <button class="btn light icon-btn" data-act="settings" title="Configurações">${icon('gear')}</button>
      </div>`;
    root.appendChild(this.hud);
    on(this.hud, '[data-act]', 'click', (_e, t) => {
      audio.play('click');
      const a = t.dataset.act!;
      if (a === 'profile' || a === 'profile2') this.open('profile');
      else if (a === 'style') this.open('wardrobe');
      else this.open(a as PanelName);
    });

    this.roomPill = el('div', 'room-pill');
    this.roomPill.hidden = true;
    root.appendChild(this.roomPill);
    on(this.roomPill, '[data-act]', 'click', (_e, t) => {
      const a = t.dataset.act;
      if (a === 'open') this.open('play');
      if (a === 'ready') this.app.net.send({ t: 'roomReady', ready: !this.myMember()?.ready });
      if (a === 'start') this.app.net.send({ t: 'roomStart' });
    });

    this.matchLayer = el('div', 'passthrough');
    this.matchLayer.style.cssText = 'position:absolute;inset:0;';
    root.appendChild(this.matchLayer);
    this.trainBar = el('div', 'trainbar');
    this.trainBar.hidden = true;
    root.appendChild(this.trainBar);

    this.promptEl = el('div', 'prompt');
    this.promptEl.hidden = true;
    this.promptEl.addEventListener('click', () => this.app.useNearest());
    root.appendChild(this.promptEl);

    this.toasts = el('div', 'toasts');
    root.appendChild(this.toasts);

    // ---------------- chat ----------------
    this.chat = el('div', 'chat');
    this.chat.innerHTML = `<div class="chat-log"></div><div class="chat-input"><input maxlength="120" placeholder="Mensagem… (Enter)"/><button class="btn small">Enviar</button></div>`;
    root.appendChild(this.chat);
    this.chatLog = this.chat.querySelector('.chat-log')!;
    this.chatInput = this.chat.querySelector('input')!;
    const send = () => {
      const v = this.chatInput.value.trim();
      if (v) this.app.net.send({ t: 'chat', text: v });
      this.chatInput.value = '';
      this.chat.classList.remove('open');
      this.chatInput.blur();
    };
    this.chat.querySelector('button')!.addEventListener('click', send);
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
      if (e.key === 'Escape') { this.chat.classList.remove('open'); this.chatInput.blur(); }
      e.stopPropagation();
    });

    // ---------------- touch ----------------
    this.touch = el('div', 'touch');
    root.appendChild(this.touch);
    this.buildTouch();
    settings.on(() => this.buildTouch());

    this.fpsEl = el('div', 'fps');
    root.appendChild(this.fpsEl);

    this.panels = new Panels(this);

    // voz
    this.voiceDock = new VoiceDock(app.voice, () => this.open('voice'));
    root.appendChild(this.voiceDock.root);
    app.voice.onChange = () => { if (this.panels.current === 'voice') this.panels.refresh(); };

    // atalhos globais
    this.app.input.onKey = (code) => {
      if (code === 'Escape') {
        if (this.panels.isOpen()) this.panels.close();
        else this.open('pause');
        return;
      }
      if (this.panels.isOpen()) return;
      if (code === settings.data.keys.chat && !isTyping(document.activeElement)) {
        this.chat.classList.add('open');
        setTimeout(() => this.chatInput.focus(), 0);
      }
      if (code === 'Tab') this.open('play');
      if (code === 'KeyF' && this.mode === 'lobby') { /* reservado */ }
      for (const b of this.actions) if (code === `Key${b.key}` || (b.key === 'F' && code === settings.data.keys.action)) b.onDown();
    };
    addEventListener('keyup', (e) => {
      for (const b of this.actions) if (e.code === `Key${b.key}`) b.onUp?.();
    });
  }

  /* ------------------------------ estado ------------------------------ */

  setProfile(p: PrivateProfile): void {
    const first = !this.profile;
    this.profile = p;
    this.hud.querySelector('.lvl')!.textContent = String(p.level);
    this.hud.querySelector('.nm')!.textContent = p.name;
    (this.hud.querySelector('.xpbar i') as HTMLElement).style.width = `${Math.round((p.xpInto / p.xpNeed) * 100)}%`;
    this.hud.querySelector('[data-coins]')!.textContent = String(p.coins);
    this.panels.refresh();
    if (first) this.renderRoomPill();
    if (first && !p.tutorialDone) setTimeout(() => this.startTutorial(), 1500);
  }

  /* ------------------------------ contas ------------------------------ */

  onAuth(m: Extract<S2C, { t: 'auth' }>): void {
    if (!m.ok) { this.toast(m.msg ?? 'Não foi possível concluir.', 'err'); return; }
    if (m.msg === 'registered') { this.panels.open('recovery', { code: m.recovery, then: null }); return; }
    if (m.msg === 'login' && m.token) { this.toast('Entrando na sua conta…', 'ok'); this.app.net.switchAccount(m.token); return; }
    if (m.msg === 'recovered' && m.token) { this.panels.open('recovery', { code: m.recovery, then: m.token }); return; }
  }

  setLeaderboard(rows: UI['leaderboard']): void {
    this.leaderboard = rows;
    this.panels.refresh();
  }

  /* ------------------------------ tutorial ------------------------------ */

  private startTutorial(): void {
    if (this.tutorialEl || this.mode !== 'lobby') return;
    const touch = useTouch();
    const steps = [
      { t: 'Bem-vindo ao PARTYVERSE!', d: touch ? 'Use o joystick à esquerda para andar e arraste a tela para girar a câmera.' : 'Ande com WASD, corra com Shift, pule com Espaço. Arraste o mouse para girar a câmera.' },
      { t: 'Interaja com tudo', d: `Chegue perto de bancos, quiosques, da loja e do trem. Quando aparecer um balão, ${touch ? 'toque no botão de mão' : 'aperte E'}.` },
      { t: 'Jogue com amigos', d: 'Em "Jogar", crie uma sala (pública ou privada) ou entre com um código. Em "Amigos", troque códigos e mande convites.' },
      { t: 'Embarque no Trem Voador', d: 'Quando o líder iniciar, todos vão para a estação: entrem no trem, sentem e aproveitem a viagem até a missão.' },
      { t: 'Fale com a equipe', d: 'O botão de microfone à direita ativa o chat de voz por proximidade. É opcional e você pode silenciar quando quiser.' },
    ];
    let i = 0;
    const el2 = el('div', 'tutorial');
    this.tutorialEl = el2;
    const render = () => {
      const s2 = steps[i];
      el2.innerHTML = `<h4>${esc(s2.t)}</h4><p style="margin:0 0 12px">${esc(s2.d)}</p>
        <div class="row between"><div class="dots">${steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="row"><button class="btn small ghost" style="color:var(--ink)" data-t="skip">Pular</button><button class="btn small pink" data-t="next">${i === steps.length - 1 ? 'Vamos jogar!' : 'Próximo'}</button></div></div>`;
    };
    render();
    el2.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-t]') as HTMLElement | null;
      if (!b) return;
      audio.play('click');
      if (b.dataset.t === 'next' && i < steps.length - 1) { i++; render(); return; }
      el2.remove();
      this.tutorialEl = null;
      this.app.net.send({ t: 'tutorialDone' });
    });
    this.root.appendChild(el2);
  }

  setFriends(f: Extract<S2C, { t: 'friends' }>): void {
    this.friends = f;
    const b = this.hud.querySelector('[data-fbadge]') as HTMLElement;
    b.hidden = f.incoming.length === 0;
    b.textContent = String(f.incoming.length);
    this.panels.refresh();
  }

  setRoom(r: RoomView | null): void {
    const prev = this.room;
    this.room = r;
    if (r && !prev) audio.play('pop');
    this.renderRoomPill();
    this.panels.refresh();
  }

  setRoomList(l: RoomListEntry[]): void {
    this.roomList = l;
    this.panels.refresh();
  }

  myMember() {
    return this.room?.members.find((m) => m.userId === this.profile?.userId);
  }

  private renderRoomPill(): void {
    const r = this.room;
    if (!r || this.mode !== 'lobby') { this.roomPill.hidden = true; return; }
    this.roomPill.hidden = false;
    const me = this.myMember();
    const host = me?.host;
    const def = GAMES[r.game];
    this.roomPill.innerHTML = `
      <h4><span>${esc(def.name)}</span><span class="code">${esc(r.code)}</span></h4>
      <div class="muted" style="color:#fff;opacity:.75;font-size:.82em">${r.members.length}/${Math.min(r.maxPlayers, def.max)} jogadores • ${r.visibility === 'private' ? 'Privada' : 'Pública'}</div>
      <div class="mini-members">${r.members.map((m) => `<span class="${m.ready ? 'ok' : ''}">${m.host ? '👑 ' : ''}${esc(m.name)}${m.connected ? '' : ' ⚠'}</span>`).join('')}</div>
      <div class="row">
        <button class="btn small ghost" data-act="open">Sala</button>
        ${host ? `<button class="btn small green" data-act="start">Iniciar viagem</button>` : `<button class="btn small ${me?.ready ? 'yellow' : 'green'}" data-act="ready">${me?.ready ? 'Cancelar pronto' : 'Estou pronto'}</button>`}
      </div>`;
  }

  setMode(m: 'lobby' | 'match'): void {
    this.mode = m;
    this.hud.style.display = m === 'lobby' ? '' : 'none';
    this.trainBar.hidden = true;
    this.renderRoomPill();
    if (m === 'lobby') this.app.net.send({ t: 'roomList' });
  }

  setMatchHud(h: HTMLElement | null): void {
    this.matchLayer.innerHTML = '';
    if (h) this.matchLayer.appendChild(h);
    const pause = el('button', 'btn light icon-btn', icon('gear'));
    pause.style.cssText = 'position:absolute;top:calc(10px + var(--safe-t));right:calc(10px + var(--safe-r));pointer-events:auto';
    pause.addEventListener('click', () => this.open('pause'));
    if (h) this.matchLayer.appendChild(pause);
  }

  /* ------------------------------ painéis ------------------------------ */

  open(name: PanelName, arg?: unknown): void {
    this.panels.open(name, arg);
  }
  isBlocking(): boolean {
    return this.panels.isOpen() || this.chat.classList.contains('open') || !!this.loading;
  }

  askName(): void {
    this.panels.open('name');
  }

  /* ------------------------------ feedback ------------------------------ */

  toast(msg: string, kind: 'info' | 'ok' | 'warn' | 'err' = 'info', ms = 3200): void {
    const t = el('div', `toast ${kind}`);
    t.textContent = msg;
    this.toasts.appendChild(t);
    if (kind === 'err') audio.play('error'); else if (kind === 'ok') audio.play('chime');
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
  }

  invite(from: string, code: string, game: GameId): void {
    const c = el('div', 'invite-card');
    c.innerHTML = `<div><b>${esc(from)}</b> convidou você para <b>${esc(GAMES[game].name)}</b></div>
      <button class="btn small green" data-a="y">Entrar</button><button class="btn small ghost" style="color:var(--ink)" data-a="n">✕</button>`;
    this.toasts.appendChild(c);
    audio.play('chime');
    const close = () => c.remove();
    c.querySelector('[data-a=y]')!.addEventListener('click', () => { this.app.net.send({ t: 'inviteRespond', code, accept: true }); close(); });
    c.querySelector('[data-a=n]')!.addEventListener('click', close);
    setTimeout(close, 20000);
  }

  achievement(id: string): void {
    const a = ACH_BY_ID.get(id);
    if (!a) return;
    this.toast(`🏆 Conquista: ${a.name} (+${a.coins} moedas)`, 'ok', 4500);
    audio.play('success');
  }

  reward(r: Extract<S2C, { t: 'reward' }>): void {
    this.panels.lastReward = r;
    this.panels.refresh();
    if (r.levelUp) setTimeout(() => this.banner(`Nível ${r.levelUp}!`, 'Você subiu de nível', 3000), 800);
  }

  chatLine(name: string, text: string): void {
    const d = el('div');
    d.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
    this.chatLog.appendChild(d);
    while (this.chatLog.children.length > 30) this.chatLog.firstElementChild?.remove();
  }

  prompt(label: string | null): void {
    if (!label) { this.promptEl.hidden = true; return; }
    const html = `<kbd>${useTouch() ? '👆' : esc(settings.data.keys.interact.replace('Key', ''))}</kbd>${esc(label)}`;
    if (this.promptEl.hidden || this.promptEl.innerHTML !== html) this.promptEl.innerHTML = html;
    this.promptEl.hidden = false;
  }

  banner(title: string, sub = '', ms = 2500): void {
    this.root.querySelectorAll('.banner').forEach((b) => b.remove());
    const b = el('div', 'banner', `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`);
    this.root.appendChild(b);
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.remove(), ms);
  }

  netStatus(s: 'connecting' | 'online' | 'offline'): void {
    if (s === 'online') { this.netEl?.remove(); this.netEl = null; return; }
    if (!this.netEl) { this.netEl = el('div', 'netwarn'); this.root.appendChild(this.netEl); }
    this.netEl.textContent = s === 'offline' ? 'Conexão perdida — reconectando…' : 'Conectando…';
  }

  showLoading(msg: string, p: number): void {
    const boot = document.getElementById('boot');
    if (boot && !boot.classList.contains('hide')) {
      (document.getElementById('boot-msg') as HTMLElement).textContent = msg;
      (document.getElementById('boot-bar') as HTMLElement).style.width = `${Math.round(40 + p * 60)}%`;
      this.loading = boot;
      return;
    }
    if (!this.loading) {
      this.loading = el('div', 'boot');
      this.loading.innerHTML = `<div class="boot-logo"><span>PARTY</span><b>VERSE</b></div><div class="boot-bar"><i></i></div><div class="boot-msg"></div>`;
      this.root.appendChild(this.loading);
    }
    (this.loading.querySelector('.boot-msg') as HTMLElement).textContent = msg;
    (this.loading.querySelector('.boot-bar i') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
  }

  hideLoading(): void {
    const l = this.loading;
    this.loading = null;
    if (!l) return;
    l.classList.add('hide');
    setTimeout(() => { if (l.id !== 'boot') l.remove(); else l.remove(); }, 500);
  }

  /* ------------------------------ trem ------------------------------ */

  trainStatus(phase: string, s: TrainSchedule & { deadline?: number; seats?: Record<string, number> }, now: number, dest: string, seat: string | null): void {
    const show = phase === 'boarding' || phase === 'departing' || phase === 'flight' || phase === 'arrived';
    this.trainBar.hidden = !show;
    if (!show) return;
    let title = '', right = '', prog = 0;
    if (phase === 'boarding') {
      const left = Math.max(0, Math.ceil(((s.deadline ?? now) - now) / 1000));
      title = 'Embarque: entre no trem pelas portas verdes';
      right = `Partida automática em ${left}s`;
    } else if (phase === 'departing') {
      title = 'Todos a bordo! Fechando as portas…';
      right = `${Math.max(0, Math.ceil((s.departAt - now) / 1000))}s`;
    } else if (phase === 'flight') {
      prog = Math.min(1, Math.max(0, (now - s.departAt) / (s.arriveAt - s.departAt)));
      title = `Voando para ${dest}${seat === 'pilot' ? ' • Você é o piloto! (F buzina, R luzes)' : ''}`;
      right = `Chegada em ${Math.max(0, Math.ceil((s.arriveAt - now) / 1000))}s`;
    } else {
      prog = 1;
      title = `Bem-vindo a ${dest}! Desembarque para começar`;
      right = `${Math.max(0, Math.ceil(((s.deadline ?? now) - now) / 1000))}s`;
    }
    const html = `<div class="row"><span>${esc(title)}</span><span>${esc(right)}</span></div><div class="track"><i style="width:${prog * 100}%"></i><b style="left:${prog * 100}%"></b></div>`;
    if (this.trainBar.innerHTML !== html) this.trainBar.innerHTML = html;
  }

  /* ------------------------------ resultados ------------------------------ */

  results(res: { win: boolean; score: number; stars: number; summary: { label: string; value: string }[]; mvp?: { userId: string; title: string }[] }, game: GameId, diff: Difficulty): void {
    this.panels.open('results', { res, game, diff });
    audio.play(res.win ? 'success' : 'fail');
  }

  /* ------------------------------ touch / ações ------------------------------ */

  private buildTouch(): void {
    this.touch.innerHTML = '';
    if (!useTouch()) { this.actionKey = ''; this.renderActions(); return; }
    const joy = el('div', 'joy', '<i></i>');
    const knob = joy.querySelector('i') as HTMLElement;
    let id: number | null = null;
    let cx = 0, cy = 0;
    const R = 55;
    joy.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      joy.setPointerCapture(e.pointerId);
      move(e);
    });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(1, l / R);
      this.app.input.setStick((dx / R), (-dy / R), mag > 0.08);
      this.app.input.sprintToggle = mag > 0.95 && this.app.input.sprintToggle;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      this.app.input.setStick(0, 0, false);
    };
    joy.addEventListener('pointermove', move);
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
    this.touch.appendChild(joy);
    const btns = el('div', 'tbtns');
    btns.innerHTML = `
      <button class="tbtn main" data-b="interact">${icon('hand')}</button>
      <button class="tbtn" data-b="jump">${icon('jump')}</button>
      <button class="tbtn" data-b="sprint">${icon('run')}</button>
      <button class="tbtn hidden" data-b="a0"></button>
      <button class="tbtn hidden" data-b="a1"></button>
      <button class="tbtn" data-b="wave">${icon('wave')}</button>`;
    this.touch.appendChild(btns);
    btns.querySelectorAll<HTMLElement>('.tbtn').forEach((b) => {
      const name = b.dataset.b!;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        audio.unlock();
        if (name === 'interact') this.app.useNearest();
        else if (name === 'jump') this.app.input.down('jump');
        else if (name === 'sprint') { this.app.input.sprintToggle = !this.app.input.sprintToggle; b.classList.toggle('on', this.app.input.sprintToggle); }
        else if (name === 'wave') this.app.emote('wave');
        else if (name.startsWith('a')) this.actions[Number(name.slice(1))]?.onDown();
      });
      b.addEventListener('pointerup', () => {
        if (name === 'jump') this.app.input.up('jump');
        if (name.startsWith('a')) this.actions[Number(name.slice(1))]?.onUp?.();
      });
    });
    const chatBtn = el('button', 'btn ghost small', icon('chat'));
    chatBtn.style.cssText = 'position:absolute;left:calc(190px + var(--safe-l));bottom:calc(30px + var(--safe-b));';
    chatBtn.addEventListener('click', () => { this.chat.classList.add('open'); this.chatInput.focus(); });
    this.touch.appendChild(chatBtn);
    this.actionKey = '';
    this.renderActions();
  }

  setActionButtons(btns: ActionButton[]): void {
    const key = btns.map((b) => b.id + b.label).join('|');
    this.actions = btns;
    if (key === this.actionKey) return;
    this.actionKey = key;
    this.renderActions();
  }

  private renderActions(): void {
    const btns = this.actions;
    if (useTouch()) {
      for (let i = 0; i < 2; i++) {
        const b = this.touch.querySelector(`[data-b=a${i}]`) as HTMLElement | null;
        if (!b) continue;
        const a = btns[i];
        b.classList.toggle('hidden', !a);
        b.textContent = a ? a.label : '';
      }
    } else {
      let bar = this.root.querySelector('.action-hints') as HTMLElement | null;
      if (!bar) {
        bar = el('div', 'action-hints passthrough');
        bar.style.cssText = 'position:absolute;right:calc(12px + var(--safe-r));bottom:calc(12px + var(--safe-b));display:flex;gap:8px;';
        this.root.appendChild(bar);
      }
      bar.innerHTML = btns.map((b) => `<div class="mbox" style="min-width:auto;padding:6px 12px;font-weight:800"><kbd style="font-family:var(--display);background:var(--violet);padding:2px 8px;border-radius:8px;margin-right:6px">${esc(b.key)}</kbd>${esc(b.label)}</div>`).join('');
    }
  }

  frame(_dt: number, fps: number): void {
    const sp: { name: string; self?: boolean }[] = [];
    const v = this.app.voice;
    if (v.state !== 'off') {
      if (v.selfSpeaking) sp.push({ name: 'Você', self: true });
      for (const r of this.app.remotes.values()) if (v.isSpeaking(r.id)) sp.push({ name: r.avatar.name });
    }
    this.voiceDock.render(sp);
    this.fpsEl.textContent = settings.data.showFps ? `${Math.round(fps)} FPS • ${Math.round(this.app.net.rtt)} ms` : '';
  }

  /** valida nome localmente */
  validName(n: string): string | null {
    return sanitizeName(n);
  }

  gameIcon(id: GameId): string {
    return gameIconSvg(id);
  }

  levelOf(xp: number): number {
    return levelFromXp(xp).level;
  }

  friendStatus(f: FriendEntry): string {
    return f.status === 'offline' ? 'Offline' : f.status === 'lobby' ? 'No lobby' : f.status === 'room' ? 'Em uma sala' : 'Em partida';
  }
}
