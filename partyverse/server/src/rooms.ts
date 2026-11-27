/**
 * Salas (party): públicas ou privadas, código de entrada, votação de
 * experiência, dificuldade, prontos, expulsão e matchmaking rápido.
 */
import { randomBytes } from 'node:crypto';
import { MAX_ROOM_PLAYERS } from '../../shared/constants';
import { GAMES, type Difficulty, type GameId } from '../../shared/minigames';
import type { RoomListEntry, RoomView } from '../../shared/protocol';
import { levelFromXp } from '../../shared/progression';
import type { Game } from './Game';
import type { Session } from './Session';
import type { MatchWorld } from './worlds/MatchWorld';

export interface Member { ready: boolean; vote: GameId | null; joinedAt: number }

export class Room {
  readonly members = new Map<string, Member>();
  state: RoomView['state'] = 'waiting';
  match: MatchWorld | null = null;
  constructor(
    public readonly id: string,
    public readonly code: string,
    public visibility: 'public' | 'private',
    public game: GameId,
    public difficulty: Difficulty,
    public hostId: string,
  ) {}
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  readonly rooms = new Map<string, Room>(); // por código

  constructor(private game: Game) {}

  private newCode(): string {
    for (;;) {
      const c = Array.from(randomBytes(5), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
      if (!this.rooms.has(c)) return c;
    }
  }

  view(r: Room): RoomView {
    return {
      id: r.id, code: r.code, visibility: r.visibility, game: r.game, difficulty: r.difficulty, state: r.state,
      maxPlayers: MAX_ROOM_PLAYERS,
      members: [...r.members.entries()].map(([uid, m]) => {
        const s = this.game.sessions.get(uid);
        return {
          userId: uid, name: s?.user.name ?? '?', level: s ? levelFromXp(s.user.xp).level : 1,
          ready: m.ready, host: uid === r.hostId, connected: !!s?.connected, vote: m.vote,
          outfit: s?.user.outfit ?? (undefined as never),
          bot: !!s?.isBot,
        };
      }),
    };
  }

  push(r: Room): void {
    const v = this.view(r);
    for (const uid of r.members.keys()) this.game.sessions.get(uid)?.send({ t: 'room', room: v });
    this.game.friendsChanged([...r.members.keys()]);
  }

  list(): RoomListEntry[] {
    return [...this.rooms.values()]
      .filter((r) => r.visibility === 'public')
      .map((r) => ({
        code: r.code, game: r.game, difficulty: r.difficulty, players: r.members.size, max: Math.min(MAX_ROOM_PLAYERS, GAMES[r.game].max),
        hostName: this.game.sessions.get(r.hostId)?.user.name ?? '?', state: r.state,
      }));
  }

  create(s: Session, visibility: 'public' | 'private', game: GameId, difficulty: Difficulty): Room {
    this.leave(s);
    const r = new Room(randomBytes(6).toString('hex'), this.newCode(), visibility, game, difficulty, s.id);
    r.members.set(s.id, { ready: true, vote: game, joinedAt: Date.now() });
    this.rooms.set(r.code, r);
    s.room = r;
    this.push(r);
    return r;
  }

  join(s: Session, code: string): Room | string {
    const r = this.rooms.get(code.trim().toUpperCase());
    if (!r) return 'Sala não encontrada.';
    if (s.room === r) return r;
    if (r.state !== 'waiting') return 'Essa sala já está em partida.';
    if (r.members.size >= MAX_ROOM_PLAYERS) return 'Sala cheia.';
    this.leave(s);
    r.members.set(s.id, { ready: false, vote: null, joinedAt: Date.now() });
    s.room = r;
    this.push(r);
    this.notify(r, `${s.user.name} entrou na sala.`, s.id);
    return r;
  }

  quick(s: Session, game?: GameId): Room {
    const candidates = [...this.rooms.values()].filter(
      (r) => r.visibility === 'public' && r.state === 'waiting' && r.members.size < Math.min(MAX_ROOM_PLAYERS, GAMES[r.game].max) && (!game || r.game === game),
    );
    // prioriza salas mais cheias (partida começa mais rápido)
    candidates.sort((a, b) => b.members.size - a.members.size);
    if (candidates[0]) {
      const res = this.join(s, candidates[0].code);
      if (typeof res !== 'string') return res;
    }
    return this.create(s, 'public', game ?? 'mudanca', 'medio');
  }

  leave(s: Session): void {
    const r = s.room;
    if (!r) return;
    r.members.delete(s.id);
    s.room = null;
    s.send({ t: 'room', room: null });
    if (r.match) r.match.memberLeftRoom(s);
    // sala sem humanos: os robôs saem junto
    const humans = [...r.members.keys()].filter((u) => !this.game.sessions.get(u)?.isBot);
    if (!humans.length) for (const u of [...r.members.keys()]) { r.members.delete(u); this.game.removeBot(u); }
    if (r.members.size === 0) {
      this.rooms.delete(r.code);
      r.match?.dispose();
      return;
    }
    if (r.hostId === s.id) {
      // passa a liderança para o humano que está há mais tempo
      const next = [...r.members.entries()].filter(([u]) => !this.game.sessions.get(u)?.isBot).sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0];
      r.hostId = next[0];
      r.members.get(next[0])!.ready = true;
      this.notify(r, `${this.game.sessions.get(next[0])?.user.name} agora é o líder da sala.`);
    }
    this.push(r);
    this.game.friendsChanged([s.id]);
  }

  set(s: Session, patch: { game?: GameId; difficulty?: Difficulty; visibility?: 'public' | 'private' }): void {
    const r = s.room;
    if (!r || r.hostId !== s.id || r.state !== 'waiting') return;
    if (patch.game) r.game = patch.game;
    if (patch.difficulty) r.difficulty = patch.difficulty;
    if (patch.visibility) r.visibility = patch.visibility;
    this.push(r);
  }

  vote(s: Session, game: GameId): void {
    const r = s.room;
    if (!r || r.state !== 'waiting') return;
    r.members.get(s.id)!.vote = game;
    this.push(r);
  }

  ready(s: Session, ready: boolean): void {
    const r = s.room;
    if (!r || r.state !== 'waiting') return;
    r.members.get(s.id)!.ready = ready || r.hostId === s.id;
    this.push(r);
  }

  kick(s: Session, userId: string): void {
    const r = s.room;
    if (!r || r.hostId !== s.id || userId === s.id || !r.members.has(userId)) return;
    const target = this.game.sessions.get(userId);
    if (target?.isBot) { r.members.delete(userId); this.game.removeBot(userId); this.push(r); return; }
    if (target) {
      this.leave(target);
      target.send({ t: 'toast', msg: 'Você foi removido da sala pelo líder.', kind: 'warn' });
      if (target.world?.kind === 'match') this.game.toLobby(target);
    } else {
      r.members.delete(userId);
      this.push(r);
    }
  }

  /** Experiência vencedora da votação (empate => escolha do líder). Considera o nº de jogadores. */
  resolveVote(r: Room): GameId {
    const n = r.members.size;
    const counts = new Map<GameId, number>();
    for (const m of r.members.values()) if (m.vote) counts.set(m.vote, (counts.get(m.vote) ?? 0) + 1);
    let best: GameId = r.game;
    let bestN = counts.get(r.game) ?? 0;
    for (const [g, c] of counts) {
      const def = GAMES[g];
      if (n < def.min || n > def.max || !def.playable) continue;
      if (c > bestN) { best = g; bestN = c; }
    }
    return best;
  }

  start(s: Session): string | null {
    const r = s.room;
    if (!r) return 'Você não está em uma sala.';
    if (r.hostId !== s.id) return 'Só o líder pode iniciar.';
    if (r.state !== 'waiting') return 'A sala já está em partida.';
    const connected = [...r.members.keys()].filter((u) => this.game.sessions.get(u)?.connected);
    if (connected.length !== r.members.size) return 'Aguarde todos os jogadores reconectarem.';
    const notReady = [...r.members.entries()].filter(([u, m]) => !m.ready && u !== r.hostId);
    if (notReady.length) return 'Nem todos estão prontos.';
    const game = this.resolveVote(r);
    const def = GAMES[game];
    if (!def.playable) return `${def.name} ainda está em desenvolvimento.`;
    const n = r.members.size;
    if (n < def.min) return `${def.name} precisa de pelo menos ${def.min} jogadores.`;
    if (n > def.max) return `${def.name} aceita no máximo ${def.max} jogadores.`;
    r.game = game;
    this.game.startMatch(r);
    return null;
  }

  /** líder adiciona um robô ajudante */
  addBot(s: Session): void {
    const r = s.room;
    if (!r || r.hostId !== s.id || r.state !== 'waiting') return;
    if (r.members.size >= Math.min(MAX_ROOM_PLAYERS, GAMES[r.game].max)) { s.send({ t: 'toast', msg: 'A sala já está cheia para esta experiência.', kind: 'warn' }); return; }
    const bot = this.game.createBot(r.members.size);
    r.members.set(bot.id, { ready: true, vote: null, joinedAt: Date.now() });
    bot.room = r;
    this.push(r);
  }

  removeBot(s: Session): void {
    const r = s.room;
    if (!r || r.hostId !== s.id || r.state !== 'waiting') return;
    const id = [...r.members.keys()].reverse().find((u) => this.game.sessions.get(u)?.isBot);
    if (!id) return;
    r.members.delete(id);
    this.game.removeBot(id);
    this.push(r);
  }

  notify(r: Room, msg: string, except?: string): void {
    for (const uid of r.members.keys()) if (uid !== except) this.game.sessions.get(uid)?.send({ t: 'toast', msg, kind: 'info' });
  }
}
