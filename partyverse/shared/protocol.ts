import type { AnimName } from './constants';
import type { Outfit } from './cosmetics';
import type { Difficulty, GameId } from './minigames';

/* ------------------------------------------------------------------ */
/* Tipos de visão                                                       */
/* ------------------------------------------------------------------ */

export interface PublicProfile {
  userId: string;
  name: string;
  level: number;
  outfit: Outfit;
  friendCode: string;
}

export interface PrivateProfile extends PublicProfile {
  xp: number;
  xpInto: number;
  xpNeed: number;
  coins: number;
  owned: string[];
  achievements: string[];
  stats: Record<string, number>;
  history: MatchHistoryEntry[];
  records: Record<string, number>;
  /** nome de usuário (null = conta convidado sem senha) */
  username: string | null;
  tutorialDone: boolean;
}

export interface MatchHistoryEntry {
  at: number;
  game: GameId;
  difficulty: Difficulty;
  players: number;
  win: boolean;
  score: number;
  stars: number;
}

export interface FriendEntry {
  userId: string;
  name: string;
  level: number;
  online: boolean;
  /** onde está: lobby / sala / partida */
  status: 'offline' | 'lobby' | 'room' | 'match';
  roomCode?: string;
}

export interface RoomMember {
  userId: string;
  name: string;
  level: number;
  ready: boolean;
  host: boolean;
  connected: boolean;
  vote: GameId | null;
  outfit: Outfit;
}

export interface RoomView {
  id: string;
  code: string;
  visibility: 'public' | 'private';
  game: GameId;
  difficulty: Difficulty;
  members: RoomMember[];
  state: 'waiting' | 'traveling' | 'playing' | 'results';
  maxPlayers: number;
}

export interface RoomListEntry {
  code: string;
  game: GameId;
  difficulty: Difficulty;
  players: number;
  max: number;
  hostName: string;
  state: RoomView['state'];
}

/** Jogador presente em um mundo (lobby ou partida). */
export interface PlayerInit {
  id: number; // id curto de entidade dentro do mundo
  userId: string;
  name: string;
  level: number;
  outfit: Outfit;
  x: number; y: number; z: number; yaw: number;
  plat: Platform;
  anim: AnimName;
  connected: boolean;
}

/** Plataforma móvel em cujo espaço local o jogador está (0 = mundo, 1 = trem). */
export type Platform = 0 | 1;

/** [id, x, y, z, yaw, anim, plat, carryId] */
export type PlayerSnap = [number, number, number, number, number, AnimName, Platform, number];

export type WorldKind = 'lobby' | 'match';

/* ------------------------------------------------------------------ */
/* Cliente -> Servidor                                                   */
/* ------------------------------------------------------------------ */

export type C2S =
  | { t: 'hello'; v: number; token?: string; name?: string }
  | { t: 'ping'; c: number }
  | { t: 'setName'; name: string }
  | { t: 'setOutfit'; outfit: Outfit }
  | { t: 'buy'; item: string }
  | { t: 'move'; x: number; y: number; z: number; yaw: number; anim: AnimName; plat: Platform; vx: number; vz: number }
  | { t: 'emote'; id: string }
  | { t: 'chat'; text: string }
  | { t: 'interact'; id: string; arg?: unknown }
  | { t: 'act'; a: string; d?: unknown }
  | { t: 'friendAdd'; code: string }
  | { t: 'friendRespond'; userId: string; accept: boolean }
  | { t: 'friendRemove'; userId: string }
  | { t: 'invite'; userId: string }
  | { t: 'inviteRespond'; code: string; accept: boolean }
  | { t: 'roomCreate'; visibility: 'public' | 'private'; game: GameId; difficulty: Difficulty }
  | { t: 'roomJoin'; code: string }
  | { t: 'roomQuick'; game?: GameId }
  | { t: 'roomLeave' }
  | { t: 'roomSet'; game?: GameId; difficulty?: Difficulty; visibility?: 'public' | 'private' }
  | { t: 'roomVote'; game: GameId }
  | { t: 'roomReady'; ready: boolean }
  | { t: 'roomKick'; userId: string }
  | { t: 'roomStart' }
  | { t: 'roomList' }
  | { t: 'returnLobby' }
  | { t: 'playAgain' }
  /* voz: estado e sinalização WebRTC (o servidor só repassa dentro do mesmo mundo) */
  | { t: 'voice'; on: boolean; mic: boolean }
  | { t: 'rtc'; to: number; d: unknown }
  /* contas */
  | { t: 'register'; username: string; password: string }
  | { t: 'login'; username: string; password: string }
  | { t: 'recover'; username: string; code: string; password: string }
  | { t: 'logout'; token: string }
  | { t: 'leaderboard' }
  | { t: 'tutorialDone' };

/* ------------------------------------------------------------------ */
/* Servidor -> Cliente                                                   */
/* ------------------------------------------------------------------ */

export interface WorldEnter {
  t: 'world';
  kind: WorldKind;
  worldId: string;
  you: number;
  players: PlayerInit[];
  /** só em partidas */
  game?: GameId;
  difficulty?: Difficulty;
  /** estado inicial específico do mundo (trem, minigame...) */
  state?: unknown;
}

export type S2C =
  | { t: 'welcome'; token: string; profile: PrivateProfile; serverTime: number; needName: boolean }
  | { t: 'pong'; c: number; s: number }
  | { t: 'profile'; profile: PrivateProfile }
  | WorldEnter
  | { t: 'pjoin'; p: PlayerInit }
  | { t: 'pleave'; id: number }
  | { t: 'pconn'; id: number; connected: boolean }
  | { t: 'pout'; id: number; outfit: Outfit; name: string; level: number }
  | { t: 'snap'; st: number; p: PlayerSnap[]; w?: unknown }
  | { t: 'correct'; x: number; y: number; z: number; plat: Platform }
  | { t: 'ev'; e: string; d?: unknown }
  | { t: 'chat'; from: string; name: string; text: string }
  | { t: 'emote'; id: number; e: string }
  | { t: 'friends'; friends: FriendEntry[]; incoming: { userId: string; name: string }[]; outgoing: { userId: string; name: string }[] }
  | { t: 'invite'; fromName: string; code: string; game: GameId }
  | { t: 'room'; room: RoomView | null }
  | { t: 'roomList'; rooms: RoomListEntry[] }
  | { t: 'toast'; msg: string; kind?: 'info' | 'ok' | 'warn' | 'err' }
  | { t: 'reward'; xp: number; coins: number; achievements: string[]; levelUp: number | null }
  | { t: 'err'; msg: string }
  | { t: 'voice'; on: number[]; mic: number[] }
  | { t: 'rtc'; from: number; d: unknown }
  | { t: 'ice'; servers: { urls: string | string[]; username?: string; credential?: string }[] }
  | { t: 'auth'; ok: boolean; msg?: string; token?: string; recovery?: string; username?: string }
  | { t: 'leaderboard'; rows: { name: string; level: number; xp: number; wins: number }[] };
