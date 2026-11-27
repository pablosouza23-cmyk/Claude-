/**
 * Orquestrador: sessões, lobby (shards), salas, partidas, amigos,
 * progressão e roteamento de mensagens. Laço de simulação a 30 Hz.
 */
import type { WebSocket } from 'ws';
import { MAX_LOBBY_SHARD, PROTOCOL_VERSION, RECONNECT_GRACE_MS, SERVER_TICK, SNAPSHOT_RATE, sanitizeChat, sanitizeName } from '../../shared/constants';
import { COSMETIC_BY_ID, validateOutfit } from '../../shared/cosmetics';
import { NAME_MAX } from '../../shared/constants';
import { isDifficulty, isGameId, type GameId } from '../../shared/minigames';
import type { C2S, FriendEntry, PrivateProfile } from '../../shared/protocol';
import { ACH_BY_ID, computeReward, levelFromXp } from '../../shared/progression';
import { Database, type UserRow } from './db';
import type { GameResult, MinigameFactory } from './games/types';
import { RoomManager, type Room } from './rooms';
import { Session } from './Session';
import { LobbyWorld } from './worlds/LobbyWorld';
import { MatchWorld } from './worlds/MatchWorld';
import type { World } from './worlds/World';

export class Game {
  readonly sessions = new Map<string, Session>();
  readonly lobbies: LobbyWorld[] = [];
  readonly matches = new Set<MatchWorld>();
  readonly rooms: RoomManager;
  private timer: NodeJS.Timeout | null = null;
  private lastTick = Date.now();
  private snapAcc = 0;

  constructor(public db: Database, public factories: Partial<Record<GameId, MinigameFactory>>) {
    this.rooms = new RoomManager(this);
  }

  start(): void {
    this.timer = setInterval(() => this.loop(), 1000 / SERVER_TICK);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private worlds(): World[] {
    return [...this.lobbies, ...this.matches];
  }

  private loop(): void {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    for (const w of this.worlds()) {
      try { w.tick(dt, now); } catch (e) { console.error('[tick]', w.id, e); }
    }
    this.snapAcc += dt;
    if (this.snapAcc >= 1 / SNAPSHOT_RATE) {
      this.snapAcc = 0;
      for (const w of this.worlds()) if (w.size) w.broadcast(w.snapshot(now));
    }
    // limpeza de sessões desconectadas
    for (const s of this.sessions.values()) {
      if (!s.connected && now - s.disconnectedAt > RECONNECT_GRACE_MS) this.dropSession(s);
    }
    // shards vazios
    for (let i = this.lobbies.length - 1; i > 0; i--) if (this.lobbies[i].size === 0) this.lobbies.splice(i, 1);
  }

  /* ----------------------------- conexão ----------------------------- */

  attach(ws: WebSocket): void {
    let session: Session | null = null;
    const hello = setTimeout(() => { if (!session) ws.close(4000, 'hello timeout'); }, 10_000);
    ws.on('message', (raw) => {
      let msg: C2S;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
      if (!session) {
        if (msg.t !== 'hello') return;
        clearTimeout(hello);
        session = this.handshake(ws, msg);
        return;
      }
      if (session.ws !== ws) return; // conexão antiga
      if (!session.allow()) return;
      try { this.handle(session, msg); } catch (e) { console.error('[msg]', msg.t, e); }
    });
    ws.on('close', () => {
      clearTimeout(hello);
      if (session && session.ws === ws) this.onDisconnect(session);
    });
    ws.on('error', () => {});
  }

  private handshake(ws: WebSocket, m: Extract<C2S, { t: 'hello' }>): Session | null {
    if (m.v !== PROTOCOL_VERSION) {
      ws.send(JSON.stringify({ t: 'err', msg: 'Versão desatualizada. Atualize o jogo.' }));
      ws.close();
      return null;
    }
    let user: UserRow | null = null;
    let token = typeof m.token === 'string' ? m.token : '';
    if (token) user = this.db.byToken(token);
    let needName = false;
    if (!user) {
      const name = sanitizeName(m.name) ?? `Jogador${Math.floor(Math.random() * 9000 + 1000)}`;
      needName = !sanitizeName(m.name);
      const created = this.db.createUser(name);
      user = created.user;
      token = created.token;
    }
    let s = this.sessions.get(user.id);
    const reconnect = !!s;
    if (s) {
      // reconexão (ou login em outro dispositivo): assume a sessão
      if (s.ws && s.ws !== ws) { try { s.ws.close(4001, 'outra conexão'); } catch { /* */ } }
      s.ws = ws;
      s.user = user.id === s.user.id ? s.user : user;
    } else {
      s = new Session(user, token);
      s.ws = ws;
      this.sessions.set(user.id, s);
    }
    s.send({ t: 'welcome', token, profile: this.profile(s), serverTime: Date.now(), needName });
    s.send({ t: 'ice', servers: ICE_SERVERS });
    this.unlock(s, 'first-steps');
    if (reconnect && s.world) {
      s.world.join(s); // reenvia o estado atual e marca como conectado
    } else {
      this.toLobby(s);
    }
    if (s.room) s.send({ t: 'room', room: this.rooms.view(s.room) });
    if (s.room) this.rooms.push(s.room);
    this.sendFriends(s);
    this.friendsChanged([s.id]);
    return s;
  }

  private onDisconnect(s: Session): void {
    s.ws = null;
    s.disconnectedAt = Date.now();
    s.world?.setConnected(s, false);
    if (s.room) this.rooms.push(s.room);
    this.friendsChanged([s.id]);
    this.db.save(s.user);
  }

  private dropSession(s: Session): void {
    if (this.sessions.get(s.id) !== s) return;
    this.db.save(s.user);
    this.rooms.leave(s);
    const w = s.world;
    w?.leave(s);
    if (w instanceof MatchWorld && w.size === 0) this.endMatch(w);
    this.sessions.delete(s.id);
    this.friendsChanged([s.id]);
  }

  /* ----------------------------- mundos ----------------------------- */

  lobbyFor(s: Session): LobbyWorld {
    // prefere o shard onde estão amigos
    const friends = new Set(this.db.friendRows(s.id).filter((f) => f.status === 'accepted').map((f) => f.other));
    let best: LobbyWorld | null = null;
    let bestScore = -1;
    for (const l of this.lobbies) {
      if (l.size >= MAX_LOBBY_SHARD) continue;
      let score = 0;
      for (const p of l.players.values()) if (friends.has(p.session.id)) score++;
      if (score > bestScore) { best = l; bestScore = score; }
    }
    if (!best) {
      best = new LobbyWorld();
      this.lobbies.push(best);
    }
    return best;
  }

  toLobby(s: Session): void {
    const prev = s.world;
    if (prev?.kind === 'lobby') { prev.join(s); return; }
    prev?.leave(s);
    this.lobbyFor(s).join(s);
    if (prev instanceof MatchWorld && prev.size === 0) this.endMatch(prev);
    this.friendsChanged([s.id]);
  }

  startMatch(r: Room): void {
    if (!this.factories[r.game]) return;
    r.state = 'traveling';
    const match = new MatchWorld(this, r);
    r.match = match;
    this.rooms.push(r);
    this.matches.add(match);
    for (const uid of r.members.keys()) {
      const s = this.sessions.get(uid);
      if (!s) continue;
      s.world?.leave(s);
      match.join(s);
      this.unlock(s, 'first-ride');
    }
    this.friendsChanged([...r.members.keys()]);
  }

  private endMatch(m: MatchWorld): void {
    m.dispose();
    this.matches.delete(m);
    const r = m.room;
    if (r.match === m) {
      r.match = null;
      r.state = 'waiting';
      for (const [uid, mem] of r.members) mem.ready = uid === r.hostId;
      if (this.rooms.rooms.has(r.code)) this.rooms.push(r);
    }
  }

  /* ----------------------------- mensagens ----------------------------- */

  private handle(s: Session, m: C2S): void {
    const w = s.world;
    const p = w?.byUser.get(s.id);
    switch (m.t) {
      case 'ping': s.send({ t: 'pong', c: m.c, s: Date.now() }); break;
      case 'move': if (w && p) w.handleMove(p, m); break;
      case 'interact': if (w && p && typeof m.id === 'string') w.onInteract(p, m.id, m.arg); break;
      case 'act': if (w && p && typeof m.a === 'string') w.onAct(p, m.a, m.d); break;
      case 'emote': if (w && p && typeof m.id === 'string' && m.id.length < 20) w.broadcast({ t: 'emote', id: p.id, e: m.id }); break;
      case 'chat': {
        const text = sanitizeChat(m.text);
        if (text && w) w.broadcast({ t: 'chat', from: s.id, name: s.user.name, text });
        break;
      }
      case 'setName': {
        const n = sanitizeName(m.name);
        if (!n) { s.send({ t: 'toast', msg: 'Nome inválido (3 a 16 letras/números).', kind: 'err' }); break; }
        s.user.name = n;
        this.db.save(s.user);
        this.sendProfile(s);
        w?.refreshProfile(s);
        if (s.room) this.rooms.push(s.room);
        break;
      }
      case 'setOutfit': {
        s.user.outfit = validateOutfit(m.outfit, new Set(s.user.owned), s.user.outfit);
        this.db.save(s.user);
        this.sendProfile(s);
        w?.refreshProfile(s);
        if (s.room) this.rooms.push(s.room);
        break;
      }
      case 'buy': this.buy(s, m.item); break;
      case 'friendAdd': this.friendAdd(s, m.code); break;
      case 'friendRespond': {
        if (this.db.respondFriend(s.id, m.userId, !!m.accept)) {
          if (m.accept) { this.unlock(s, 'social'); const o = this.sessions.get(m.userId); if (o) this.unlock(o, 'social'); }
          this.sendFriends(s);
          const o = this.sessions.get(m.userId);
          if (o) { this.sendFriends(o); if (m.accept) o.send({ t: 'toast', msg: `${s.user.name} aceitou seu pedido de amizade!`, kind: 'ok' }); }
        }
        break;
      }
      case 'friendRemove': {
        this.db.removeFriend(s.id, m.userId);
        this.sendFriends(s);
        const o = this.sessions.get(m.userId);
        if (o) this.sendFriends(o);
        break;
      }
      case 'invite': {
        const o = this.sessions.get(m.userId);
        if (!s.room) { s.send({ t: 'toast', msg: 'Crie ou entre em uma sala para convidar.', kind: 'warn' }); break; }
        if (!o || !o.connected) { s.send({ t: 'toast', msg: 'Esse amigo está offline.', kind: 'warn' }); break; }
        if (!this.db.areFriends(s.id, o.id)) break;
        o.send({ t: 'invite', fromName: s.user.name, code: s.room.code, game: s.room.game });
        s.send({ t: 'toast', msg: `Convite enviado para ${o.user.name}.`, kind: 'ok' });
        break;
      }
      case 'inviteRespond': {
        if (!m.accept) break;
        if (s.world?.kind === 'match') { s.send({ t: 'toast', msg: 'Termine a partida atual primeiro.', kind: 'warn' }); break; }
        const res = this.rooms.join(s, String(m.code));
        if (typeof res === 'string') s.send({ t: 'toast', msg: res, kind: 'err' });
        break;
      }
      case 'roomCreate':
        if (s.world?.kind === 'match') break;
        if (!isGameId(m.game) || !isDifficulty(m.difficulty)) break;
        this.rooms.create(s, m.visibility === 'private' ? 'private' : 'public', m.game, m.difficulty);
        break;
      case 'roomJoin': {
        if (s.world?.kind === 'match') break;
        const res = this.rooms.join(s, String(m.code ?? ''));
        if (typeof res === 'string') s.send({ t: 'toast', msg: res, kind: 'err' });
        break;
      }
      case 'roomQuick':
        if (s.world?.kind === 'match') break;
        this.rooms.quick(s, isGameId(m.game) ? m.game : undefined);
        break;
      case 'roomLeave':
        this.rooms.leave(s);
        if (s.world?.kind === 'match') this.toLobby(s);
        break;
      case 'roomSet':
        this.rooms.set(s, {
          game: isGameId(m.game) ? m.game : undefined,
          difficulty: isDifficulty(m.difficulty) ? m.difficulty : undefined,
          visibility: m.visibility === 'public' || m.visibility === 'private' ? m.visibility : undefined,
        });
        break;
      case 'roomVote': if (isGameId(m.game)) this.rooms.vote(s, m.game); break;
      case 'roomReady': this.rooms.ready(s, !!m.ready); break;
      case 'roomKick': this.rooms.kick(s, String(m.userId)); break;
      case 'roomStart': {
        const err = this.rooms.start(s);
        if (err) s.send({ t: 'toast', msg: err, kind: 'warn' });
        break;
      }
      case 'roomList': s.send({ t: 'roomList', rooms: this.rooms.list() }); break;
      case 'returnLobby': if (w?.kind === 'match') this.toLobby(s); break;
      case 'voice': {
        if (!w || !p) break;
        p.voice = !!m.on;
        p.mic = !!m.on && !!m.mic;
        w.broadcastVoice();
        break;
      }
      case 'rtc': {
        // repassa sinalização WebRTC apenas para alguém do MESMO mundo com voz ativa
        if (!w || !p || !p.voice) break;
        const target = w.players.get(Number(m.to));
        if (!target || !target.voice || target === p) break;
        const raw = JSON.stringify(m.d ?? null);
        if (raw.length > 16_000) break;
        target.session.send({ t: 'rtc', from: p.id, d: m.d });
        break;
      }
      case 'register': this.register(s, m.username, m.password); break;
      case 'login': this.login(s, m.username, m.password); break;
      case 'recover': this.recover(s, m.username, m.code, m.password); break;
      case 'logout': {
        if (typeof m.token === 'string' && this.db.byToken(m.token)?.id === s.id) this.db.revokeToken(m.token);
        s.send({ t: 'auth', ok: true, msg: 'logout' });
        this.dropSession(s);
        break;
      }
      case 'leaderboard':
        s.send({ t: 'leaderboard', rows: this.db.leaderboard(20).map((r) => ({ ...r, level: levelFromXp(r.xp).level })) });
        break;
      case 'tutorialDone':
        s.user.stats.tutorial = 1;
        this.db.save(s.user);
        this.sendProfile(s);
        break;
      case 'playAgain': if (w instanceof MatchWorld) w.playAgain(s); break;
    }
  }

  /* ----------------------------- contas ----------------------------- */

  private authAllowed(s: Session): boolean {
    const now = Date.now();
    s.authTries = s.authTries.filter((t) => now - t < 60_000);
    if (s.authTries.length >= 6) { s.send({ t: 'auth', ok: false, msg: 'Muitas tentativas. Aguarde um minuto.' }); return false; }
    s.authTries.push(now);
    return true;
  }

  private validCreds(username: unknown, password: unknown): { u: string; pw: string } | string {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,16}$/.test(username)) return `Usuário: 3 a ${NAME_MAX} letras, números, ponto, hífen ou _.`;
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) return 'Senha: de 6 a 72 caracteres.';
    return { u: username, pw: password };
  }

  private register(s: Session, username: unknown, password: unknown): void {
    const c = this.validCreds(username, password);
    if (typeof c === 'string') { s.send({ t: 'auth', ok: false, msg: c }); return; }
    const r = this.db.register(s.id, c.u, c.pw);
    if (r === 'taken') { s.send({ t: 'auth', ok: false, msg: 'Esse nome de usuário já existe.' }); return; }
    if (r === 'already') { s.send({ t: 'auth', ok: false, msg: 'Esta conta já tem usuário e senha.' }); return; }
    s.send({ t: 'auth', ok: true, msg: 'registered', recovery: r, username: c.u.toLowerCase() });
    this.sendProfile(s);
  }

  private login(s: Session, username: unknown, password: unknown): void {
    if (!this.authAllowed(s)) return;
    const c = this.validCreds(username, password);
    if (typeof c === 'string') { s.send({ t: 'auth', ok: false, msg: 'Usuário ou senha incorretos.' }); return; }
    const r = this.db.login(c.u, c.pw);
    if (!r) { s.send({ t: 'auth', ok: false, msg: 'Usuário ou senha incorretos.' }); return; }
    s.send({ t: 'auth', ok: true, msg: 'login', token: r.token, username: c.u.toLowerCase() });
    // a sessão convidado atual é encerrada; o cliente reconecta com o novo token
    if (r.user.id !== s.id) this.dropSession(s);
  }

  private recover(s: Session, username: unknown, code: unknown, password: unknown): void {
    if (!this.authAllowed(s)) return;
    const c = this.validCreds(username, password);
    if (typeof c === 'string' || typeof code !== 'string') { s.send({ t: 'auth', ok: false, msg: typeof c === 'string' ? c : 'Código inválido.' }); return; }
    const r = this.db.recover(c.u, code, c.pw);
    if (!r) { s.send({ t: 'auth', ok: false, msg: 'Usuário ou código de recuperação incorretos.' }); return; }
    const live = this.sessions.get(r.user.id);
    if (live && live !== s) { live.send({ t: 'toast', msg: 'Sua senha foi redefinida em outro dispositivo.', kind: 'warn' }); live.ws?.close(4002, 'senha redefinida'); this.dropSession(live); }
    s.send({ t: 'auth', ok: true, msg: 'recovered', token: r.token, recovery: r.recovery, username: c.u.toLowerCase() });
    if (r.user.id !== s.id) this.dropSession(s);
  }

  /* ----------------------------- loja ----------------------------- */

  private buy(s: Session, itemId: string): void {
    const it = COSMETIC_BY_ID.get(itemId);
    const u = s.user;
    if (!it) return;
    if (u.owned.includes(it.id)) { s.send({ t: 'toast', msg: 'Você já tem esse item.', kind: 'info' }); return; }
    if (it.achievement) { s.send({ t: 'toast', msg: `Desbloqueie com a conquista "${ACH_BY_ID.get(it.achievement)?.name}".`, kind: 'warn' }); return; }
    if (it.level && levelFromXp(u.xp).level < it.level) { s.send({ t: 'toast', msg: `Requer nível ${it.level}.`, kind: 'warn' }); return; }
    if (u.coins < it.price) { s.send({ t: 'toast', msg: 'Moedas insuficientes.', kind: 'err' }); return; }
    u.coins -= it.price;
    u.owned.push(it.id);
    this.db.save(u);
    s.send({ t: 'toast', msg: `Você comprou ${it.name}!`, kind: 'ok' });
    this.unlock(s, 'shopper');
    this.sendProfile(s);
  }

  /* ----------------------------- progressão ----------------------------- */

  profile(s: Session): PrivateProfile {
    const u = s.user;
    const lv = levelFromXp(u.xp);
    return {
      userId: u.id, name: u.name, level: lv.level, outfit: u.outfit, friendCode: u.friendCode,
      xp: u.xp, xpInto: lv.into, xpNeed: lv.need, coins: u.coins, owned: u.owned, achievements: u.achievements,
      stats: u.stats, history: this.db.history(u.id, 15), records: u.records,
      username: this.db.usernameOf(u.id), tutorialDone: !!u.stats.tutorial,
    };
  }

  sendProfile(s: Session): void {
    s.send({ t: 'profile', profile: this.profile(s) });
  }

  /** Concede conquista (uma vez). Retorna true se foi nova. */
  unlock(s: Session, id: string, silent = false): boolean {
    const a = ACH_BY_ID.get(id);
    if (!a || s.user.achievements.includes(id)) return false;
    s.user.achievements.push(id);
    s.user.coins += a.coins;
    if (a.unlock && !s.user.owned.includes(a.unlock)) s.user.owned.push(a.unlock);
    this.db.save(s.user);
    if (!silent) {
      s.send({ t: 'ev', e: 'achievement', d: { id } });
      this.sendProfile(s);
    }
    return true;
  }

  awardMatch(s: Session, m: MatchWorld, res: GameResult): void {
    const u = s.user;
    const friendIds = new Set(this.db.friendRows(u.id).filter((f) => f.status === 'accepted').map((f) => f.other));
    const friendsIn = [...m.players.values()].filter((p) => friendIds.has(p.session.id)).length;
    const reward = computeReward(res.win, res.stars, m.room.difficulty, friendsIn);
    const before = levelFromXp(u.xp).level;
    u.xp += reward.xp;
    u.coins += reward.coins;
    const g = m.minigame.id;
    u.stats.matches = (u.stats.matches ?? 0) + 1;
    u.stats[`played_${g}`] = (u.stats[`played_${g}`] ?? 0) + 1;
    if (res.win) { u.stats.wins = (u.stats.wins ?? 0) + 1; u.stats[`wins_${g}`] = (u.stats[`wins_${g}`] ?? 0) + 1; }
    if (friendsIn) u.stats.withFriends = (u.stats.withFriends ?? 0) + 1;
    const recKey = `${g}_${m.room.difficulty}`;
    if (res.win && res.score > (u.records[recKey] ?? 0)) u.records[recKey] = res.score;
    this.db.addMatch(u.id, { at: Date.now(), game: g, difficulty: m.room.difficulty, players: m.size, win: res.win, score: res.score, stars: res.stars });
    const newAch: string[] = [];
    const tryU = (id: string) => { if (this.unlock(s, id, true)) newAch.push(id); };
    if (res.win) {
      const map: Record<GameId, string> = { mudanca: 'first-move', roubo: 'first-heist', loja: 'first-shop', hotel: 'first-hotel', oficina: 'first-workshop', nave: 'first-space' };
      tryU(map[g]);
      if (m.room.difficulty === 'dificil') tryU('hard-mode');
      if (friendsIn >= 2) tryU('squad-goals');
      if (res.flags.includes('noBreaks')) tryU('no-breaks');
    }
    if (m.size >= 8) tryU('full-house');
    const after = levelFromXp(u.xp).level;
    if (after >= 5) tryU('level-5');
    if (after >= 10) tryU('level-10');
    this.db.save(u);
    s.send({ t: 'reward', xp: reward.xp, coins: reward.coins, achievements: newAch, levelUp: after > before ? after : null });
    this.sendProfile(s);
    m.refreshProfile(s);
  }

  /* ----------------------------- amigos ----------------------------- */

  private friendAdd(s: Session, code: string): void {
    const other = this.db.byFriendCode(String(code ?? '').trim());
    if (!other) { s.send({ t: 'toast', msg: 'Código de amigo não encontrado.', kind: 'err' }); return; }
    if (other.id === s.id) { s.send({ t: 'toast', msg: 'Esse é o seu próprio código 🙂', kind: 'warn' }); return; }
    const r = this.db.requestFriend(s.id, other.id);
    const o = this.sessions.get(other.id);
    if (r === 'sent') {
      s.send({ t: 'toast', msg: `Pedido enviado para ${other.name}.`, kind: 'ok' });
      o?.send({ t: 'toast', msg: `${s.user.name} quer ser seu amigo!`, kind: 'info' });
    } else if (r === 'accepted') {
      s.send({ t: 'toast', msg: `Agora você e ${other.name} são amigos!`, kind: 'ok' });
      o?.send({ t: 'toast', msg: `${s.user.name} aceitou a amizade!`, kind: 'ok' });
      this.unlock(s, 'social');
      if (o) this.unlock(o, 'social');
    } else s.send({ t: 'toast', msg: 'Vocês já são amigos ou o pedido já existe.', kind: 'info' });
    this.sendFriends(s);
    if (o) this.sendFriends(o);
  }

  private statusOf(uid: string): { online: boolean; status: FriendEntry['status']; roomCode?: string } {
    const s = this.sessions.get(uid);
    if (!s || !s.connected) return { online: false, status: 'offline' };
    if (s.world?.kind === 'match') return { online: true, status: 'match', roomCode: s.room?.code };
    if (s.room) return { online: true, status: 'room', roomCode: s.room.visibility === 'public' ? s.room.code : undefined };
    return { online: true, status: 'lobby' };
  }

  sendFriends(s: Session): void {
    const rows = this.db.friendRows(s.id);
    const friends: FriendEntry[] = [];
    const incoming: { userId: string; name: string }[] = [];
    const outgoing: { userId: string; name: string }[] = [];
    for (const r of rows) {
      const live = this.sessions.get(r.other)?.user;
      const u = live ?? this.db.byId(r.other);
      if (!u) continue;
      if (r.status === 'accepted') friends.push({ userId: u.id, name: u.name, level: levelFromXp(u.xp).level, ...this.statusOf(u.id) });
      else if (r.dir === 'in') incoming.push({ userId: u.id, name: u.name });
      else outgoing.push({ userId: u.id, name: u.name });
    }
    friends.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
    s.send({ t: 'friends', friends, incoming, outgoing });
  }

  /** avisa os amigos online de que o status destes usuários mudou */
  friendsChanged(userIds: string[]): void {
    const notify = new Set<string>();
    for (const uid of userIds)
      for (const r of this.db.friendRows(uid)) if (r.status === 'accepted' && this.sessions.get(r.other)?.connected) notify.add(r.other);
    for (const uid of notify) this.sendFriends(this.sessions.get(uid)!);
  }
}

/** servidores ICE para WebRTC (STUN público; TURN configurável via PV_ICE_SERVERS em JSON) */
const ICE_SERVERS: { urls: string | string[]; username?: string; credential?: string }[] = (() => {
  try { if (process.env.PV_ICE_SERVERS) return JSON.parse(process.env.PV_ICE_SERVERS); } catch { /* */ }
  return [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
})();
