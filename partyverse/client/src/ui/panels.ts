/**
 * Painéis modais: Jogar/Sala, Amigos, Visual (guarda-roupa + loja com prévia
 * 3D), Perfil (estatísticas, conquistas, histórico, recordes), Configurações,
 * Pausa, Nome e Resultados.
 */
import * as THREE from 'three';
import { COSMETICS, COSMETIC_BY_ID, HAIR_COLORS, PALETTE, SKIN_TONES, type Outfit, type Slot } from '../../../shared/cosmetics';
import { DIFFICULTIES, GAMES, GAME_IDS, type Difficulty, type GameId } from '../../../shared/minigames';
import { planSummary } from '../../../shared/plans';
import { ACHIEVEMENTS } from '../../../shared/progression';
import type { S2C } from '../../../shared/protocol';
import { Avatar } from '../avatar/Avatar';
import { audio } from '../core/Audio';
import { DEFAULT_KEYS, KEY_LABELS, settings, type Quality } from '../core/Settings';
import { colorFor, el, esc, initials, on } from './dom';
import { gameIconSvg, icon } from './icons';
import type { UI } from './UI';

export type PanelName = 'play' | 'friends' | 'wardrobe' | 'shop' | 'profile' | 'settings' | 'pause' | 'name' | 'results' | 'voice' | 'recovery';

const SLOT_NAMES: Record<Slot, string> = { hair: 'Cabelo', hat: 'Chapéu', top: 'Roupa', bottom: 'Calça', shoes: 'Sapatos', face: 'Rosto', acc: 'Acessório' };
const SLOT_ICON: Record<Slot, string> = { hair: '💇', hat: '🧢', top: '👕', bottom: '👖', shoes: '👟', face: '😊', acc: '🕶️' };

export class Panels {
  private wrap: HTMLElement | null = null;
  current: PanelName | null = null;
  private arg: Record<string, unknown> = {};
  private tab: Record<string, string> = { play: 'create', style: 'wardrobe', profile: 'stats' };
  private draft: Outfit | null = null;
  private preview: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; av: Avatar | null; raf: number } | null = null;
  private createGame: GameId = 'mudanca';
  private createDiff: Difficulty = 'medio';
  private createVis: 'public' | 'private' = 'public';
  private slot: Slot = 'hair';
  private rebind: string | null = null;
  lastReward: Extract<S2C, { t: 'reward' }> | null = null;

  constructor(private ui: UI) {
    addEventListener('keydown', (e) => {
      if (!this.rebind) return;
      e.preventDefault();
      settings.set('keys', { ...settings.data.keys, [this.rebind]: e.code });
      this.rebind = null;
      this.render();
    }, true);
  }

  isOpen(): boolean { return !!this.wrap; }

  open(name: PanelName, arg?: unknown): void {
    if (name === 'shop') { this.tab.style = 'shop'; name = 'wardrobe'; }
    else if (name === 'wardrobe' && this.current !== 'wardrobe') this.tab.style = this.tab.style ?? 'wardrobe';
    this.arg = (arg as Record<string, unknown>) ?? {};
    if (name === 'play' && this.arg.game) { this.createGame = this.arg.game as GameId; this.tab.play = 'create'; }
    if (name === 'play') this.ui.app.net.send({ t: 'roomList' });
    if (name === 'profile') this.ui.app.net.send({ t: 'leaderboard' });
    if (name === 'wardrobe' && this.ui.profile) this.draft = { ...this.ui.profile.outfit };
    this.current = name;
    if (!this.wrap) {
      this.wrap = el('div', 'modal-wrap');
      this.wrap.addEventListener('pointerdown', (e) => { if (e.target === this.wrap && this.current !== 'name' && this.current !== 'results') this.close(); });
      this.ui.root.appendChild(this.wrap);
    }
    this.render();
  }

  close(): void {
    if (this.current === 'wardrobe') this.disposePreview();
    this.wrap?.remove();
    this.wrap = null;
    this.current = null;
  }

  refresh(): void {
    if (this.wrap && this.current && this.current !== 'name' && this.current !== 'settings' && this.current !== 'recovery' && !(this.current === 'profile' && this.tab.profile === 'account')) this.render();
  }

  private frame(title: string, body: string, narrow = false): string {
    const closable = this.current !== 'name' && this.current !== 'recovery';
    return `<div class="panel ${narrow ? 'narrow' : ''}"><div class="panel-head"><h2>${title}</h2>${closable ? `<button class="x" data-close>${icon('close')}</button>` : ''}</div><div class="panel-body">${body}</div></div>`;
  }

  private render(): void {
    const w = this.wrap;
    if (!w || !this.current) return;
    const scroll = w.querySelector('.panel-body')?.scrollTop ?? 0;
    switch (this.current) {
      case 'play': w.innerHTML = this.ui.room ? this.roomHtml() : this.playHtml(); break;
      case 'friends': w.innerHTML = this.friendsHtml(); break;
      case 'wardrobe': w.innerHTML = this.styleHtml(); break;
      case 'profile': w.innerHTML = this.profileHtml(); break;
      case 'settings': w.innerHTML = this.settingsHtml(); break;
      case 'pause': w.innerHTML = this.pauseHtml(); break;
      case 'name': w.innerHTML = this.nameHtml(); break;
      case 'results': w.innerHTML = this.resultsHtml(); break;
      case 'voice': w.innerHTML = this.voiceHtml(); break;
      case 'recovery': w.innerHTML = this.recoveryHtml(); break;
    }
    const body = w.querySelector('.panel-body');
    if (body) body.scrollTop = scroll;
    this.bind(w);
    if (this.current === 'wardrobe') this.mountPreview();
  }

  /* ------------------------------ JOGAR ------------------------------ */

  private gameCards(selected: GameId, votes?: Map<GameId, number>, players?: number): string {
    return `<div class="game-cards">${GAME_IDS.map((id) => {
      const g = GAMES[id];
      const v = votes?.get(id) ?? 0;
      const fits = players === undefined || (players >= g.min && players <= g.max);
      return `<button class="gcard ${id === selected ? 'on' : ''}" data-game="${id}" style="${fits ? '' : 'opacity:.55'}">
        <div class="art" style="background:linear-gradient(135deg,${g.color},${g.accent})">${gameIconSvg(id)}</div>
        ${v ? `<span class="votes">🗳 ${v}</span>` : ''}${g.playable ? '' : '<span class="soon">EM BREVE</span>'}
        <div class="info"><div class="nm">${esc(g.name)}</div><div class="meta">${g.min}–${g.max} jogadores • ${esc(g.destination)}</div></div></button>`;
    }).join('')}</div>`;
  }

  private diffSeg(sel: Difficulty, enabled = true): string {
    return `<div class="seg">${(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => `<button data-diff="${d}" class="${d === sel ? 'on' : ''}" ${enabled ? '' : 'disabled'}>${DIFFICULTIES[d].name}</button>`).join('')}</div>`;
  }

  private playHtml(): string {
    const t = this.tab.play;
    let body = `<div class="tabs"><button data-tab="create" class="${t === 'create' ? 'on' : ''}">Criar sala</button><button data-tab="join" class="${t === 'join' ? 'on' : ''}">Entrar com código</button><button data-tab="list" class="${t === 'list' ? 'on' : ''}">Salas públicas</button></div>`;
    if (t === 'create') {
      const g = GAMES[this.createGame];
      body += `${this.gameCards(this.createGame)}
        <div class="card" style="margin-top:14px">
          <div class="row between"><h3 style="margin:0">${esc(g.name)}</h3><span class="tag">${g.min}–${g.max} jogadores</span></div>
          <p class="muted" style="margin:6px 0 12px">${esc(g.description)}</p>
          <div class="row" style="gap:16px">
            <div class="field"><label>Dificuldade</label>${this.diffSeg(this.createDiff)}</div>
            <div class="field"><label>Sala</label><div class="seg"><button data-vis="public" class="${this.createVis === 'public' ? 'on' : ''}">Pública</button><button data-vis="private" class="${this.createVis === 'private' ? 'on' : ''}">Privada</button></div></div>
          </div>
          <p class="muted" style="margin:10px 0 0">${esc(DIFFICULTIES[this.createDiff].desc)}</p>
        </div>
        <div class="row" style="margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" style="color:var(--ink)" data-act="quick">⚡ Partida rápida</button>
          <button class="btn pink big" data-act="create">Criar sala</button>
        </div>`;
    } else if (t === 'join') {
      body += `<div class="card" style="max-width:420px;margin:0 auto;text-align:center">
        <h3>Digite o código da sala</h3>
        <input class="input code" maxlength="5" placeholder="ABCDE" data-code autocomplete="off" />
        <button class="btn pink block" style="margin-top:12px" data-act="join">Entrar</button>
        <p class="muted">Peça o código ao líder da sala. Salas privadas só aceitam por código ou convite.</p></div>`;
    } else {
      const rooms = this.ui.roomList;
      body += rooms.length
        ? `<div class="list">${rooms.map((r) => `<div class="li"><div class="avatar-dot" style="background:linear-gradient(135deg,${GAMES[r.game].color},${GAMES[r.game].accent})">${gameIconSvg(r.game)}</div>
            <div class="grow"><div class="t">${esc(GAMES[r.game].name)} <span class="tag gray">${esc(DIFFICULTIES[r.difficulty].name)}</span></div><div class="muted">Líder: ${esc(r.hostName)} • ${r.players}/${r.max} • ${r.state === 'waiting' ? 'Aguardando' : 'Em partida'}</div></div>
            <button class="btn small green" data-joincode="${esc(r.code)}" ${r.state !== 'waiting' || r.players >= r.max ? 'disabled' : ''}>Entrar</button></div>`).join('')}</div>`
        : `<div class="empty">Nenhuma sala pública agora. Crie a sua ou use a Partida rápida!</div>`;
      body += `<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn small" data-act="refresh">Atualizar</button></div>`;
    }
    return this.frame('Jogar', body);
  }

  private roomHtml(): string {
    const r = this.ui.room!;
    const me = this.ui.myMember();
    const host = !!me?.host;
    const votes = new Map<GameId, number>();
    for (const m of r.members) if (m.vote) votes.set(m.vote, (votes.get(m.vote) ?? 0) + 1);
    const g = GAMES[r.game];
    const n = r.members.length;
    const plan = planSummary(r.game, n, r.difficulty);
    const fits = n >= g.min && n <= g.max;
    const body = `
      <div class="row between" style="margin-bottom:12px">
        <div class="row"><span class="tag ${r.visibility === 'private' ? 'yellow' : 'green'}">${r.visibility === 'private' ? 'Privada' : 'Pública'}</span>
          <span class="muted">Código:</span><b style="font-family:var(--display);font-size:1.5em;letter-spacing:3px">${esc(r.code)}</b>
          <button class="btn small ghost" style="color:var(--ink)" data-act="copy">${icon('copy')} Copiar</button></div>
        ${host ? `<button class="btn small ghost" style="color:var(--ink)" data-act="vis">Tornar ${r.visibility === 'private' ? 'pública' : 'privada'}</button>` : ''}
      </div>
      <h3>Jogadores (${n}/${Math.min(r.maxPlayers, g.max)})</h3>
      <div class="members">${r.members.map((m) => `<div class="member ${m.ready ? 'ready' : ''} ${m.connected ? '' : 'off'}">
          ${m.host ? '<span class="crown">👑</span>' : ''}
          <div class="avatar-dot" style="background:${colorFor(m.name)}">${initials(m.name)}</div>
          <div class="grow" style="min-width:0"><div class="t" style="font-weight:800">${esc(m.name)}</div><div class="muted" style="font-size:.8em">${m.bot ? 'Robô ajudante (IA)' : `Nv ${m.level} • ${m.host ? 'Líder' : m.ready ? 'Pronto' : 'Aguardando'}${m.connected ? '' : ' • reconectando'}`}</div></div>
          ${host && !m.host ? `<button class="btn small red" data-kick="${esc(m.userId)}" title="Remover">✕</button>` : ''}</div>`).join('')}
        <button class="member" style="border:2px dashed var(--line);justify-content:center;cursor:pointer;font-weight:800;color:var(--violet)" data-act="invite">+ Convidar amigos</button>
        ${host ? `<button class="member" style="border:2px dashed var(--line);justify-content:center;cursor:pointer;font-weight:800;color:#13824a" data-act="addbot" title="Um robô controlado pelo servidor para completar a equipe">+ 🤖 Robô ajudante</button>` : ''}
      </div>
      <h3 style="margin-top:16px">Votação de experiência ${host ? '<span class="muted">(clique para escolher; o mais votado vence)</span>' : '<span class="muted">(clique para votar)</span>'}</h3>
      ${this.gameCards(me?.vote ?? r.game, votes, n)}
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><div class="field"><label>Dificuldade ${host ? '' : '(o líder escolhe)'}</label>${this.diffSeg(r.difficulty, host)}</div>
          <p class="muted">${esc(DIFFICULTIES[r.difficulty].desc)}</p></div>
        <div class="card"><div class="field"><label>Missão com ${n} jogador${n > 1 ? 'es' : ''}</label></div>
          <ul style="margin:6px 0 0;padding-left:18px;font-size:.92em">${plan.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
          ${fits ? '' : `<p class="tag red" style="margin-top:8px">Requer ${g.min}–${g.max} jogadores</p>`}</div>
      </div>
      <div class="row" style="margin-top:16px;justify-content:space-between">
        <button class="btn red" data-act="leave">Sair da sala</button>
        ${host
          ? `<button class="btn green big" data-act="start">${icon('play')} Embarcar no trem</button>`
          : `<button class="btn ${me?.ready ? 'yellow' : 'green'} big" data-act="ready">${me?.ready ? 'Cancelar pronto' : 'Estou pronto!'}</button>`}
      </div>`;
    return this.frame(`Sala • ${esc(g.name)}`, body);
  }

  /* ------------------------------ AMIGOS ------------------------------ */

  private friendsHtml(): string {
    const f = this.ui.friends;
    const p = this.ui.profile;
    const inRoom = !!this.ui.room;
    const body = `
      <div class="grid g2">
        <div class="card"><div class="field"><label>Seu código de amigo</label>
          <div class="row"><b style="font-family:var(--display);font-size:1.6em;letter-spacing:3px">${esc(p?.friendCode ?? '…')}</b><button class="btn small ghost" style="color:var(--ink)" data-act="copyfc">${icon('copy')}</button></div>
          <p class="muted" style="margin:4px 0 0">Compartilhe para que adicionem você.</p></div></div>
        <div class="card"><div class="field"><label>Adicionar amigo</label>
          <div class="row" style="flex-wrap:nowrap"><input class="input code" maxlength="6" placeholder="CÓDIGO" data-fcode autocomplete="off" style="font-size:1.1em"/><button class="btn pink" data-act="addf">Adicionar</button></div></div></div>
      </div>
      ${f.incoming.length ? `<h3 style="margin-top:16px">Pedidos recebidos</h3><div class="list">${f.incoming.map((r) => `<div class="li"><div class="avatar-dot" style="background:${colorFor(r.name)}">${initials(r.name)}</div><div class="grow t">${esc(r.name)}</div>
          <button class="btn small green" data-faccept="${esc(r.userId)}">Aceitar</button><button class="btn small red" data-fdecline="${esc(r.userId)}">Recusar</button></div>`).join('')}</div>` : ''}
      <h3 style="margin-top:16px">Amigos (${f.friends.length})</h3>
      ${f.friends.length ? `<div class="list">${f.friends.map((fr) => `<div class="li"><span class="dot ${fr.online ? 'on' : ''}"></span>
          <div class="avatar-dot" style="background:${colorFor(fr.name)}">${initials(fr.name)}</div>
          <div class="grow"><div class="t">${esc(fr.name)} <span class="tag gray">Nv ${fr.level}</span></div><div class="muted">${esc(this.ui.friendStatus(fr))}</div></div>
          ${fr.online && inRoom && fr.status !== 'match' ? `<button class="btn small pink" data-finvite="${esc(fr.userId)}">Convidar</button>` : ''}
          ${fr.online && !inRoom && fr.roomCode && fr.status === 'room' ? `<button class="btn small green" data-joincode="${esc(fr.roomCode)}">Entrar na sala</button>` : ''}
          <button class="btn small ghost" style="color:var(--ink)" data-fremove="${esc(fr.userId)}" title="Remover">✕</button></div>`).join('')}</div>`
        : `<div class="empty">Você ainda não tem amigos adicionados. Troque códigos com quem joga com você!</div>`}
      ${f.outgoing.length ? `<h3 style="margin-top:16px">Pedidos enviados</h3><div class="list">${f.outgoing.map((r) => `<div class="li"><div class="grow t">${esc(r.name)}</div><span class="tag gray">Aguardando</span></div>`).join('')}</div>` : ''}
      <p class="muted" style="margin-top:14px">Jogar com amigos rende +20% de XP e moedas.</p>`;
    return this.frame('Amigos', body);
  }

  /* ------------------------------ VISUAL ------------------------------ */

  private styleHtml(): string {
    const p = this.ui.profile;
    if (!p || !this.draft) return this.frame('Visual', '<div class="empty">Carregando…</div>');
    const t = this.tab.style;
    const owned = new Set(p.owned);
    const items = COSMETICS.filter((c) => c.slot === this.slot);
    const d = this.draft;
    const colorKey: Partial<Record<Slot, keyof Outfit>> = { hair: 'hairColor', hat: 'hatColor', top: 'topColor', bottom: 'bottomColor', shoes: 'shoesColor', acc: 'accColor' };
    const ck = colorKey[this.slot];
    const palette = this.slot === 'hair' ? HAIR_COLORS : PALETTE;
    const level = p.level;
    const body = `
      <div class="tabs"><button data-stab="wardrobe" class="${t === 'wardrobe' ? 'on' : ''}">Guarda-roupa</button><button data-stab="shop" class="${t === 'shop' ? 'on' : ''}">Loja</button></div>
      <div class="shop-layout">
        <div><div class="preview" data-preview></div>
          <div class="field" style="margin-top:10px"><label>Tom de pele</label><div class="swatches">${SKIN_TONES.map((c, i) => `<button class="sw ${d.skin === i ? 'on' : ''}" style="background:${c}" data-skin="${i}"></button>`).join('')}</div></div>
          ${t === 'wardrobe' ? `<div class="row" style="margin-top:12px"><button class="btn ghost small" style="color:var(--ink)" data-act="resetdraft">Desfazer</button><button class="btn green" style="flex:1" data-act="saveoutfit">Salvar visual</button></div>` : `<p class="muted" style="margin-top:12px">Todos os itens são apenas visuais — nada altera o equilíbrio das partidas.</p>`}
        </div>
        <div>
          <div class="tabs">${(Object.keys(SLOT_NAMES) as Slot[]).map((s) => `<button data-slot="${s}" class="${s === this.slot ? 'on' : ''}">${SLOT_ICON[s]} ${SLOT_NAMES[s]}</button>`).join('')}</div>
          <div class="items">${items.filter((it) => t === 'shop' || owned.has(it.id)).map((it) => {
            const has = owned.has(it.id);
            const eq = (d as unknown as Record<string, string>)[it.slot] === it.id;
            const lockedLv = it.level && level < it.level;
            return `<button class="item ${eq ? 'equipped' : ''}" data-item="${it.id}">
              ${lockedLv ? '<span class="lock">🔒</span>' : ''}
              <div class="ic">${SLOT_ICON[it.slot]}</div><div class="nm">${esc(it.name)}</div>
              <div class="pr">${has ? (eq ? '<span class="tag green">Usando</span>' : '<span class="tag">Seu</span>') : it.achievement ? '<span class="tag yellow">Conquista</span>' : lockedLv ? `<span class="tag gray">Nível ${it.level}</span>` : `<span class="coin" style="width:14px;height:14px"></span>${it.price}`}</div>
            </button>`;
          }).join('')}</div>
          ${ck ? `<div class="field" style="margin-top:12px"><label>Cor</label><div class="swatches">${palette.map((c) => `<button class="sw ${(d[ck] as string) === c ? 'on' : ''}" style="background:${c}" data-color="${c}"></button>`).join('')}</div></div>` : ''}
          ${t === 'shop' ? `<div class="row" style="margin-top:12px;justify-content:space-between"><span class="muted">Prove clicando — compre o que gostar.</span><span class="coins" style="color:var(--ink);background:var(--paper-2);border:0"><span class="coin"></span>${p.coins}</span></div>` : ''}
        </div>
      </div>`;
    return this.frame(t === 'shop' ? 'Loja' : 'Guarda-roupa', body);
  }

  private mountPreview(): void {
    const host = this.wrap?.querySelector('[data-preview]') as HTMLElement | null;
    if (!host || !this.draft) return;
    if (!this.preview) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.setPixelRatio(Math.min(2, devicePixelRatio));
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', '#9a8fd1', 1.6));
      const dl = new THREE.DirectionalLight('#ffffff', 2.2);
      dl.position.set(2, 4, 5);
      scene.add(dl);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      cam.position.set(0, 1.25, 6.2);
      cam.lookAt(0, 0.95, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.15, 40), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
      base.position.y = -0.08;
      scene.add(base);
      this.preview = { r, scene, cam, av: null, raf: 0 };
      let last = performance.now();
      let t = 0;
      const loop = () => {
        const pv = this.preview;
        if (!pv) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        if (pv.av) { pv.av.root.rotation.y = Math.sin(t * 0.6) * 0.6; pv.av.update(dt); }
        pv.r.render(pv.scene, pv.cam);
        pv.raf = requestAnimationFrame(loop);
      };
      loop();
    }
    const pv = this.preview;
    if (pv.r.domElement.parentElement !== host) host.appendChild(pv.r.domElement);
    const w = host.clientWidth || 260, h = host.clientHeight || 300;
    pv.r.setSize(w, h, false);
    pv.cam.aspect = w / h;
    pv.cam.updateProjectionMatrix();
    if (!pv.av) {
      pv.av = new Avatar(this.draft, this.ui.app.clips);
      pv.av.setAnim('idle');
      pv.scene.add(pv.av.root);
    } else pv.av.applyOutfit(this.draft);
  }

  private disposePreview(): void {
    if (!this.preview) return;
    cancelAnimationFrame(this.preview.raf);
    this.preview.r.dispose();
    this.preview.r.forceContextLoss();
    this.preview = null;
  }

  /* ------------------------------ PERFIL ------------------------------ */

  private profileHtml(): string {
    const p = this.ui.profile;
    if (!p) return this.frame('Perfil', '');
    const t = this.tab.profile;
    const st = p.stats;
    let body = `<div class="row" style="margin-bottom:12px;gap:14px">
        <div class="avatar-dot" style="width:64px;height:64px;font-size:1.8em;background:linear-gradient(135deg,#7c5cff,#ff4fa3)">${p.level}</div>
        <div class="grow"><div style="font-family:var(--display);font-size:1.5em">${esc(p.name)}</div>
          <div class="muted">Nível ${p.level} • ${p.xpInto}/${p.xpNeed} XP • Código ${esc(p.friendCode)}</div>
          <div class="progress" style="background:var(--paper-2);max-width:320px"><i style="width:${Math.round((p.xpInto / p.xpNeed) * 100)}%"></i></div></div>
        <button class="btn small" data-act="rename">Mudar nome</button></div>
      <div class="tabs"><button data-ptab="stats" class="${t === 'stats' ? 'on' : ''}">Estatísticas</button><button data-ptab="ach" class="${t === 'ach' ? 'on' : ''}">Conquistas (${p.achievements.length}/${ACHIEVEMENTS.length})</button><button data-ptab="hist" class="${t === 'hist' ? 'on' : ''}">Histórico</button><button data-ptab="rank" class="${t === 'rank' ? 'on' : ''}">Ranking</button><button data-ptab="account" class="${t === 'account' ? 'on' : ''}">Conta</button></div>`;
    if (t === 'stats') {
      body += `<div class="grid g3">
        <div class="stat"><b>${st.matches ?? 0}</b>Partidas</div><div class="stat"><b>${st.wins ?? 0}</b>Vitórias</div>
        <div class="stat"><b>${st.withFriends ?? 0}</b>Com amigos</div><div class="stat"><b>${p.coins}</b>Moedas</div>
        <div class="stat"><b>${p.owned.length}</b>Itens</div><div class="stat"><b>${p.xp}</b>XP total</div></div>
        <h3 style="margin-top:16px">Recordes</h3>
        ${Object.keys(p.records).length ? `<div class="list">${Object.entries(p.records).map(([k, v]) => { const [g, d] = k.split('_') as [GameId, Difficulty]; return `<div class="li"><div class="grow t">${esc(GAMES[g]?.name ?? g)} • ${esc(DIFFICULTIES[d]?.name ?? d)}</div><b>${v}</b></div>`; }).join('')}</div>` : '<div class="empty">Vença partidas para registrar recordes.</div>'}`;
    } else if (t === 'ach') {
      const got = new Set(p.achievements);
      body += `<div class="grid g2">${ACHIEVEMENTS.map((a) => `<div class="ach ${got.has(a.id) ? 'got' : ''}"><div class="medal">${got.has(a.id) ? '★' : '🔒'}</div><div><b>${esc(a.name)}</b><div class="muted">${esc(a.desc)}</div><div class="muted" style="font-size:.8em">+${a.coins} moedas${a.unlock ? ` • libera ${esc(COSMETIC_BY_ID.get(a.unlock)?.name ?? '')}` : ''}</div></div></div>`).join('')}</div>`;
    } else if (t === 'rank') {
      const rows = this.ui.leaderboard;
      body += rows.length ? `<div class="list">${rows.map((r, i) => `<div class="li" style="${r.name === p.name ? 'outline:2px solid var(--violet)' : ''}"><b style="width:32px;font-family:var(--display);font-size:1.2em;color:${i < 3 ? ['#e0a800', '#9aa5b1', '#c2692d'][i] : 'var(--ink-2)'}">${i + 1}º</b><div class="grow t">${esc(r.name)}</div><span class="tag">Nv ${r.level}</span><span class="tag green">${r.wins} vitórias</span></div>`).join('')}</div>` : '<div class="empty">Carregando ranking…</div>';
    } else if (t === 'account') {
      body += p.username
        ? `<div class="card"><h3>Conta protegida</h3><p class="muted">Usuário: <b>${esc(p.username)}</b>. Use usuário e senha para entrar em outro celular ou computador.</p>
            <div class="row"><button class="btn red" data-act="logout">Sair da conta neste dispositivo</button></div></div>`
        : `<div class="card"><h3>Proteja seu progresso</h3><p class="muted">Você está jogando como convidado: o progresso fica salvo neste dispositivo. Crie usuário e senha para não perder nada e jogar em outros aparelhos.</p>
            <div class="grid g2"><div class="field"><label>Usuário</label><input class="input" data-ru maxlength="16" autocomplete="username"/></div>
            <div class="field"><label>Senha (mín. 6)</label><input class="input" type="password" data-rp maxlength="72" autocomplete="new-password"/></div></div>
            <button class="btn green" style="margin-top:10px" data-act="register">Criar conta com este progresso</button></div>`;
      body += `<div class="grid g2" style="margin-top:12px">
        <div class="card"><h3>Entrar em outra conta</h3>
          <div class="field"><label>Usuário</label><input class="input" data-lu maxlength="16" autocomplete="username"/></div>
          <div class="field" style="margin-top:6px"><label>Senha</label><input class="input" type="password" data-lp maxlength="72" autocomplete="current-password"/></div>
          <button class="btn" style="margin-top:10px" data-act="login">Entrar</button>
          ${p.username ? '' : '<p class="muted" style="font-size:.8em">Atenção: o progresso deste convidado fica para trás se você não criar uma conta antes.</p>'}</div>
        <div class="card"><h3>Esqueci a senha</h3>
          <div class="field"><label>Usuário</label><input class="input" data-cu maxlength="16"/></div>
          <div class="field" style="margin-top:6px"><label>Código de recuperação</label><input class="input" data-cc maxlength="14" placeholder="XXXX-XXXX-XXXX"/></div>
          <div class="field" style="margin-top:6px"><label>Nova senha</label><input class="input" type="password" data-cp maxlength="72" autocomplete="new-password"/></div>
          <button class="btn yellow" style="margin-top:10px" data-act="recover">Redefinir senha</button></div></div>
        <p class="muted" style="margin-top:10px"><a href="/privacidade.html" target="_blank" rel="noopener">Política de privacidade e uso do microfone</a></p>`;
    } else {
      body += p.history.length
        ? `<div class="list">${p.history.map((h) => `<div class="li"><div class="avatar-dot" style="background:linear-gradient(135deg,${GAMES[h.game].color},${GAMES[h.game].accent})">${gameIconSvg(h.game)}</div>
            <div class="grow"><div class="t">${esc(GAMES[h.game].name)} <span class="tag ${h.win ? 'green' : 'red'}">${h.win ? 'Vitória' : 'Derrota'}</span></div>
            <div class="muted">${new Date(h.at).toLocaleString('pt-BR')} • ${h.players} jogadores • ${esc(DIFFICULTIES[h.difficulty].name)}</div></div>
            <div style="text-align:right"><b>${h.score}</b><div>${'★'.repeat(h.stars)}${'☆'.repeat(3 - h.stars)}</div></div></div>`).join('')}</div>`
        : '<div class="empty">Nenhuma partida ainda.</div>';
    }
    return this.frame('Perfil', body);
  }

  /* ------------------------------ CONFIGURAÇÕES ------------------------------ */

  private settingsHtml(): string {
    const s = settings.data;
    const slider = (k: string, v: number, min: number, max: number, step: number, label: string) =>
      `<div class="field"><label>${label}: <span data-val="${k}">${v.toFixed(2)}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-range="${k}"/></div>`;
    const toggle = (k: string, v: boolean, label: string) => `<label class="li" style="cursor:pointer"><input type="checkbox" data-toggle="${k}" ${v ? 'checked' : ''}/> <span class="grow">${label}</span></label>`;
    const body = `
      <h3>Gráficos</h3>
      <div class="field"><label>Qualidade</label><div class="seg">${(['low', 'medium', 'high'] as Quality[]).map((q) => `<button data-quality="${q}" class="${s.quality === q ? 'on' : ''}">${{ low: 'Baixa', medium: 'Média', high: 'Alta' }[q]}</button>`).join('')}</div></div>
      <p class="muted">Baixa: sem sombras, menos partículas, resolução 1x. Média: sombras 1024. Alta: sombras 2048, reflexos e resolução até 2x.</p>
      <div class="grid g2">${slider('renderScale', s.renderScale, 0.5, 1, 0.05, 'Escala de resolução')}${slider('uiScale', s.uiScale, 0.8, 1.3, 0.05, 'Tamanho da interface')}</div>
      ${toggle('autoResolution', s.autoResolution, 'Resolução dinâmica (mantém o FPS estável)')}
      ${toggle('showFps', s.showFps, 'Mostrar FPS e latência')}
      <h3 style="margin-top:14px">Controles</h3>
      <div class="grid g2">${slider('sensitivity', s.sensitivity, 0.2, 3, 0.05, 'Sensibilidade da câmera')}
        <div class="field"><label>Controles touch</label><div class="seg">${(['auto', 'on', 'off'] as const).map((m) => `<button data-touch="${m}" class="${s.touchControls === m ? 'on' : ''}">${{ auto: 'Auto', on: 'Sempre', off: 'Nunca' }[m]}</button>`).join('')}</div></div></div>
      ${toggle('invertY', s.invertY, 'Inverter eixo vertical da câmera')}
      <div class="grid g3" style="margin-top:8px">${Object.keys(DEFAULT_KEYS).map((k) => `<button class="li" data-rebind="${k}" style="border:0;cursor:pointer"><span class="grow" style="text-align:left">${KEY_LABELS[k]}</span><b class="tag">${this.rebind === k ? '…' : esc(s.keys[k].replace('Key', '').replace('Left', ''))}</b></button>`).join('')}</div>
      <div class="row" style="margin-top:8px"><button class="btn small ghost" style="color:var(--ink)" data-act="resetkeys">Restaurar teclas</button></div>
      <h3 style="margin-top:14px">Áudio</h3>
      <div class="grid g2">${slider('masterVolume', s.masterVolume, 0, 1, 0.05, 'Geral')}${slider('musicVolume', s.musicVolume, 0, 1, 0.05, 'Música')}${slider('sfxVolume', s.sfxVolume, 0, 1, 0.05, 'Efeitos')}${slider('voiceVolume', s.voiceVolume, 0, 1.5, 0.05, 'Voz dos jogadores')}</div>
      <div class="field" style="margin-top:8px"><label>Voz no lobby</label><div class="seg"><button data-vlobby="proximity" class="${s.voiceLobby === 'proximity' ? 'on' : ''}">Por proximidade</button><button data-vlobby="room" class="${s.voiceLobby === 'room' ? 'on' : ''}">Só minha sala</button></div></div>`;
    return this.frame('Configurações', body);
  }

  private pauseHtml(): string {
    const match = this.ui.mode === 'match';
    return this.frame('Pausa', `<div class="pause-menu">
      <button class="btn big block" data-close>Continuar</button>
      <button class="btn block light" data-open="settings">${icon('gear')} Configurações</button>
      ${match ? `<button class="btn block red" data-act="leavematch">Sair da partida</button>` : `<button class="btn block light" data-open="profile">${icon('trophy')} Perfil e conquistas</button>`}
      <p class="muted" style="text-align:center;margin:6px 0 0">PC: WASD mover • Shift correr • Espaço pular • E interagir • F ação • G acenar • Enter chat • Arraste o mouse (ou Z/C) para girar a câmera</p>
    </div>`, true);
  }

  private nameHtml(): string {
    return this.frame('Bem-vindo ao PARTYVERSE!', `
      <p class="muted">Escolha como os outros jogadores vão te ver.</p>
      <input class="input" data-name maxlength="16" placeholder="Seu apelido" value="${esc(this.ui.profile?.name ?? '')}" autocomplete="off"/>
      <button class="btn pink block big" style="margin-top:12px" data-act="setname">Começar!</button>`, true);
  }

  private resultsHtml(): string {
    const a = this.arg as { res: { win: boolean; score: number; stars: number; summary: { label: string; value: string }[]; mvp?: { userId: string; title: string }[] }; game: GameId; diff: Difficulty };
    const { res, game } = a;
    const r = this.lastReward;
    const host = this.ui.myMember()?.host;
    const star = (on: boolean, i: number) => `<svg class="star ${on ? 'on' : ''}" style="transition-delay:${0.2 + i * 0.25}s" viewBox="0 0 24 24"><path fill="#ffc93c" stroke="#d99a00" stroke-width="1" d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"/></svg>`;
    const mvp = (res.mvp ?? []).map((m) => `<div class="li"><span>🏅</span><div class="grow t">${esc(this.ui.room?.members.find((x) => x.userId === m.userId)?.name ?? 'Jogador')}</div><span class="tag">${esc(m.title)}</span></div>`).join('');
    const body = `<div class="results">
      <p class="big" style="color:${res.win ? 'var(--green)' : 'var(--red)'}">${res.win ? 'MISSÃO CUMPRIDA!' : 'NÃO FOI DESSA VEZ'}</p>
      <div class="stars">${[0, 1, 2].map((i) => star(i < res.stars, i)).join('')}</div>
      <div class="grid g2">${res.summary.map((s) => `<div class="li"><span class="grow muted">${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('')}</div>
      ${mvp ? `<h3 style="margin-top:12px">Destaques</h3><div class="list">${mvp}</div>` : ''}
      ${r ? `<div class="reward"><div>+${r.xp} XP</div><div><span class="coin"></span>+${r.coins}</div>${r.levelUp ? `<div>⬆ Nível ${r.levelUp}</div>` : ''}</div>
        ${r.achievements.length ? `<p style="text-align:center">🏆 ${r.achievements.map((id) => esc(ACHIEVEMENTS.find((x) => x.id === id)?.name ?? id)).join(', ')}</p>` : ''}` : '<p class="muted" style="text-align:center">Calculando recompensas…</p>'}
      <div class="row" style="justify-content:center;margin-top:10px">
        ${host ? `<button class="btn green big" data-act="again">Jogar de novo</button>` : `<span class="muted">O líder pode reiniciar a partida.</span>`}
        <button class="btn big" data-act="tolobby">Voltar ao lobby</button>
      </div></div>`;
    void game;
    setTimeout(() => this.wrap?.querySelectorAll('.star').forEach((s) => s.classList.add('x')), 50);
    return this.frame(GAMES[game].name, body, true);
  }

  private voiceHtml(): string {
    const v = this.ui.app.voice;
    const st = v.state;
    if (st === 'off' || st === 'denied' || st === 'unsupported' || st === 'requesting') {
      return this.frame('Chat de voz', `
        <p><b>Converse com quem está perto de você.</b> Quanto mais longe, mais baixo; muito longe, você não ouve. Na partida, só a sua equipe ouve.</p>
        <ul class="muted" style="padding-left:18px">
          <li>O navegador vai pedir permissão para usar o <b>microfone</b>. Ele só é usado enquanto o chat de voz estiver ligado.</li>
          <li>O áudio vai direto entre os jogadores (WebRTC). <b>Não gravamos nem armazenamos</b> sua voz.</li>
          <li>Aplicamos cancelamento de eco, redução de ruído, controle de volume e limitador para a voz chegar limpa.</li>
          <li>Você pode silenciar seu microfone ou qualquer jogador a qualquer momento.</li>
        </ul>
        ${st === 'unsupported' ? '<p class="tag red">Este navegador não suporta chat de voz.</p>' : ''}
        ${st === 'denied' ? '<p class="tag yellow">Permissão negada. Você pode só ouvir ou liberar o microfone nas configurações do navegador.</p>' : ''}
        <div class="row" style="justify-content:flex-end;margin-top:12px">
          <button class="btn ghost" style="color:var(--ink)" data-close>Agora não</button>
          <button class="btn green" data-act="voiceon" ${st === 'unsupported' || st === 'requesting' ? 'disabled' : ''}>${st === 'requesting' ? 'Aguardando permissão…' : 'Ativar microfone'}</button>
        </div>
        <p class="muted" style="font-size:.8em"><a href="/privacidade.html" target="_blank" rel="noopener">Política de privacidade</a></p>`, true);
    }
    const app = this.ui.app;
    const rows = [...app.remotes.values()].map((r) => {
      const has = v.voiceIds.has(r.id);
      const peer = v.peers.get(r.id);
      const blocked = v.blocked.has(r.userId);
      return `<div class="li"><span class="dot ${peer?.connected ? 'on' : ''}"></span><div class="grow"><div class="t">${esc(r.avatar.name)} ${v.isSpeaking(r.id) ? '🔊' : ''}</div><div class="muted" style="font-size:.8em">${has ? (peer?.connected ? 'Conectado por voz' : 'Conectando…') : 'Sem voz'}</div></div>
        <button class="btn small ${blocked ? 'green' : 'red'}" data-vblock="${esc(r.userId)}">${blocked ? 'Ouvir' : 'Silenciar'}</button></div>`;
    }).join('');
    return this.frame('Chat de voz', `
      <div class="row between"><div><b>${st === 'on' ? (v.micMuted ? 'Microfone silenciado' : 'Microfone ligado') : 'Somente ouvindo'}</b>
        ${st === 'on' ? `<div class="progress" style="background:var(--paper-2);width:200px"><i style="width:${Math.min(100, Math.round(v.micLevel * 600))}%"></i></div>` : ''}</div>
        <div class="row">${st === 'on' ? `<button class="btn small ${v.micMuted ? 'green' : 'yellow'}" data-act="micmute">${v.micMuted ? 'Ativar microfone' : 'Silenciar microfone'}</button>` : `<button class="btn small green" data-act="voiceretry">Tentar microfone</button>`}
        <button class="btn small red" data-act="voiceoff">Desligar voz</button></div></div>
      <h3 style="margin-top:14px">Jogadores aqui</h3>
      ${rows ? `<div class="list">${rows}</div>` : '<div class="empty">Ninguém por perto ainda.</div>'}
      <div class="grid g2" style="margin-top:12px"><div class="field"><label>Volume das vozes: <span data-val="voiceVolume">${settings.data.voiceVolume.toFixed(2)}</span></label><input type="range" min="0" max="1.5" step="0.05" value="${settings.data.voiceVolume}" data-range="voiceVolume"/></div>
      <div class="field"><label>No lobby</label><div class="seg"><button data-vlobby="proximity" class="${settings.data.voiceLobby === 'proximity' ? 'on' : ''}">Proximidade</button><button data-vlobby="room" class="${settings.data.voiceLobby === 'room' ? 'on' : ''}">Só minha sala</button></div></div></div>`, true);
  }

  private recoveryHtml(): string {
    const a = this.arg as { code?: string; then?: string | null };
    return this.frame('Guarde seu código', `
      <p>Este é o seu <b>código de recuperação</b>. Ele é a única forma de redefinir a senha se você esquecê-la. Anote ou tire um print — ele não será mostrado de novo.</p>
      <div class="recovery">${esc(a.code ?? '')}</div>
      <div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn ghost" style="color:var(--ink)" data-act="copyrec">Copiar</button><button class="btn green" data-act="recdone">Já guardei</button></div>`, true);
  }

  /* ------------------------------ eventos ------------------------------ */

  private bind(w: HTMLElement): void {
    const net = this.ui.app.net;
    const q = <T extends HTMLElement>(s: string) => w.querySelector(s) as T | null;
    w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    on(w, '[data-open]', 'click', (_e, t) => this.open(t.dataset.open as PanelName));
    on(w, '[data-tab]', 'click', (_e, t) => { this.tab.play = t.dataset.tab!; if (t.dataset.tab === 'list') net.send({ t: 'roomList' }); this.render(); });
    on(w, '[data-stab]', 'click', (_e, t) => { this.tab.style = t.dataset.stab!; this.render(); });
    on(w, '[data-ptab]', 'click', (_e, t) => { this.tab.profile = t.dataset.ptab!; this.render(); });
    on(w, '[data-game]', 'click', (_e, t) => {
      const g = t.dataset.game as GameId;
      audio.play('click');
      if (this.ui.room) {
        net.send({ t: 'roomVote', game: g });
        if (this.ui.myMember()?.host) net.send({ t: 'roomSet', game: g });
      } else { this.createGame = g; this.render(); }
    });
    on(w, '[data-diff]', 'click', (_e, t) => {
      const d = t.dataset.diff as Difficulty;
      if (this.ui.room) net.send({ t: 'roomSet', difficulty: d });
      else { this.createDiff = d; this.render(); }
    });
    on(w, '[data-vis]', 'click', (_e, t) => { this.createVis = t.dataset.vis as 'public' | 'private'; this.render(); });
    on(w, '[data-joincode]', 'click', (_e, t) => net.send({ t: 'roomJoin', code: t.dataset.joincode! }));
    on(w, '[data-kick]', 'click', (_e, t) => net.send({ t: 'roomKick', userId: t.dataset.kick! }));
    on(w, '[data-faccept]', 'click', (_e, t) => net.send({ t: 'friendRespond', userId: t.dataset.faccept!, accept: true }));
    on(w, '[data-fdecline]', 'click', (_e, t) => net.send({ t: 'friendRespond', userId: t.dataset.fdecline!, accept: false }));
    on(w, '[data-fremove]', 'click', (_e, t) => { if (confirm('Remover este amigo?')) net.send({ t: 'friendRemove', userId: t.dataset.fremove! }); });
    on(w, '[data-finvite]', 'click', (_e, t) => net.send({ t: 'invite', userId: t.dataset.finvite! }));
    on(w, '[data-slot]', 'click', (_e, t) => { this.slot = t.dataset.slot as Slot; this.render(); });
    on(w, '[data-item]', 'click', (_e, t) => {
      const it = COSMETIC_BY_ID.get(t.dataset.item!);
      const p = this.ui.profile;
      if (!it || !p || !this.draft) return;
      (this.draft as unknown as Record<string, string>)[it.slot] = it.id;
      if (it.color && !p.owned.includes(it.id)) {
        const ck = ({ hat: 'hatColor', acc: 'accColor', shoes: 'shoesColor', bottom: 'bottomColor' } as Record<string, keyof Outfit>)[it.slot];
        if (ck) (this.draft as unknown as Record<string, string>)[ck] = it.color;
      }
      if (this.tab.style === 'shop' && !p.owned.includes(it.id) && !it.achievement && !(it.level && p.level < it.level)) {
        if (confirm(`Comprar ${it.name} por ${it.price} moedas?`)) net.send({ t: 'buy', item: it.id });
      }
      audio.play('pop');
      this.render();
    });
    on(w, '[data-color]', 'click', (_e, t) => {
      const ck = ({ hair: 'hairColor', hat: 'hatColor', top: 'topColor', bottom: 'bottomColor', shoes: 'shoesColor', acc: 'accColor' } as Record<Slot, keyof Outfit>)[this.slot];
      if (ck && this.draft) { (this.draft as unknown as Record<string, string>)[ck] = t.dataset.color!; this.render(); }
    });
    on(w, '[data-skin]', 'click', (_e, t) => { if (this.draft) { this.draft.skin = Number(t.dataset.skin); this.render(); } });
    on(w, '[data-vlobby]', 'click', (_e, t) => { settings.set('voiceLobby', t.dataset.vlobby as 'room'); this.render(); });
    on(w, '[data-vblock]', 'click', (_e, t) => {
      const v = this.ui.app.voice;
      const id = t.dataset.vblock!;
      if (v.blocked.has(id)) v.blocked.delete(id); else v.blocked.add(id);
      this.render();
    });
    on(w, '[data-quality]', 'click', (_e, t) => { settings.set('quality', t.dataset.quality as Quality); this.render(); });
    on(w, '[data-touch]', 'click', (_e, t) => { settings.set('touchControls', t.dataset.touch as 'auto'); this.render(); });
    on(w, '[data-rebind]', 'click', (_e, t) => { this.rebind = t.dataset.rebind!; this.render(); });
    w.querySelectorAll<HTMLInputElement>('[data-range]').forEach((r) => r.addEventListener('input', () => {
      const k = r.dataset.range as 'sensitivity';
      settings.set(k, Number(r.value));
      const v = w.querySelector(`[data-val=${k}]`);
      if (v) v.textContent = Number(r.value).toFixed(2);
    }));
    w.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((c) => c.addEventListener('change', () => settings.set(c.dataset.toggle as 'invertY', c.checked)));
    on(w, '[data-act]', 'click', (_e, t) => {
      const a = t.dataset.act!;
      audio.play('click');
      switch (a) {
        case 'create': net.send({ t: 'roomCreate', visibility: this.createVis, game: this.createGame, difficulty: this.createDiff }); break;
        case 'quick': net.send({ t: 'roomQuick', game: this.createGame }); break;
        case 'join': { const c = q<HTMLInputElement>('[data-code]')?.value.trim().toUpperCase(); if (c) net.send({ t: 'roomJoin', code: c }); break; }
        case 'refresh': net.send({ t: 'roomList' }); break;
        case 'copy': void navigator.clipboard?.writeText(this.ui.room?.code ?? '').then(() => this.ui.toast('Código copiado!', 'ok')); break;
        case 'copyfc': void navigator.clipboard?.writeText(this.ui.profile?.friendCode ?? '').then(() => this.ui.toast('Código de amigo copiado!', 'ok')); break;
        case 'vis': net.send({ t: 'roomSet', visibility: this.ui.room?.visibility === 'private' ? 'public' : 'private' }); break;
        case 'leave': net.send({ t: 'roomLeave' }); break;
        case 'ready': net.send({ t: 'roomReady', ready: !this.ui.myMember()?.ready }); break;
        case 'start': net.send({ t: 'roomStart' }); break;
        case 'invite': this.open('friends'); break;
        case 'addbot': net.send({ t: 'roomBot', add: true }); break;
        case 'addf': { const c = q<HTMLInputElement>('[data-fcode]')?.value.trim().toUpperCase(); if (c) net.send({ t: 'friendAdd', code: c }); break; }
        case 'saveoutfit': if (this.draft) { net.send({ t: 'setOutfit', outfit: this.draft }); this.ui.toast('Visual salvo!', 'ok'); } break;
        case 'resetdraft': if (this.ui.profile) { this.draft = { ...this.ui.profile.outfit }; this.render(); } break;
        case 'rename': this.open('name'); break;
        case 'setname': {
          const v = q<HTMLInputElement>('[data-name]')?.value ?? '';
          const n = this.ui.validName(v);
          if (!n) { this.ui.toast('Use de 3 a 16 letras ou números.', 'err'); break; }
          net.send({ t: 'setName', name: n });
          this.close();
          break;
        }
        case 'resetkeys': settings.set('keys', { ...DEFAULT_KEYS }); this.render(); break;
        case 'leavematch': net.send({ t: 'returnLobby' }); this.close(); break;
        case 'again': net.send({ t: 'playAgain' }); this.close(); break;
        case 'voiceon': case 'voiceretry': {
          const v = this.ui.app.voice;
          if (a === 'voiceretry') v.disable();
          void v.enable().then((st) => {
            this.ui.toast(st === 'on' ? 'Microfone ligado — fale com quem está perto!' : st === 'listen-only' ? 'Sem microfone: você está só ouvindo.' : 'Chat de voz indisponível.', st === 'on' ? 'ok' : 'warn');
            this.render();
          });
          this.render();
          break;
        }
        case 'micmute': this.ui.app.voice.setMicMuted(!this.ui.app.voice.micMuted); this.render(); break;
        case 'voiceoff': this.ui.app.voice.disable(); this.close(); break;
        case 'register': {
          const u = q<HTMLInputElement>('[data-ru]')?.value.trim() ?? '', pw = q<HTMLInputElement>('[data-rp]')?.value ?? '';
          net.send({ t: 'register', username: u, password: pw });
          break;
        }
        case 'login': net.send({ t: 'login', username: q<HTMLInputElement>('[data-lu]')?.value.trim() ?? '', password: q<HTMLInputElement>('[data-lp]')?.value ?? '' }); break;
        case 'recover': net.send({ t: 'recover', username: q<HTMLInputElement>('[data-cu]')?.value.trim() ?? '', code: q<HTMLInputElement>('[data-cc]')?.value.trim() ?? '', password: q<HTMLInputElement>('[data-cp]')?.value ?? '' }); break;
        case 'logout': {
          if (!confirm('Sair da conta neste dispositivo? Você poderá entrar de novo com usuário e senha.')) break;
          const tok = net.token;
          if (tok) net.send({ t: 'logout', token: tok });
          setTimeout(() => net.switchAccount(null), 300);
          break;
        }
        case 'copyrec': void navigator.clipboard?.writeText(String((this.arg as { code?: string }).code ?? '')).then(() => this.ui.toast('Código copiado!', 'ok')); break;
        case 'recdone': {
          const then = (this.arg as { then?: string | null }).then;
          this.close();
          if (then) net.switchAccount(then);
          else this.ui.toast('Conta criada! Seu progresso está protegido.', 'ok');
          break;
        }
        case 'tolobby': net.send({ t: 'returnLobby' }); this.lastReward = null; this.close(); break;
      }
    });
    const nameInput = q<HTMLInputElement>('[data-name]');
    if (nameInput) { setTimeout(() => nameInput.focus(), 50); nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') (w.querySelector('[data-act=setname]') as HTMLElement).click(); e.stopPropagation(); }); }
    w.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
  }
}
