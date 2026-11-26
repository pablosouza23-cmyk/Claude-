/**
 * Persistência (SQLite embutido do Node 22 — sem dependência nativa).
 * Contas de convidado com token de dispositivo (hash SHA-256 no banco).
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_OWNED, randomOutfit, type Outfit } from '../../shared/cosmetics';
import type { MatchHistoryEntry } from '../../shared/protocol';

export interface UserRow {
  id: string;
  name: string;
  friendCode: string;
  xp: number;
  coins: number;
  owned: string[];
  outfit: Outfit;
  achievements: string[];
  stats: Record<string, number>;
  records: Record<string, number>;
  createdAt: number;
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

export class Database {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        friend_code TEXT UNIQUE NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0,
        owned TEXT NOT NULL,
        outfit TEXT NOT NULL,
        achievements TEXT NOT NULL DEFAULT '[]',
        stats TEXT NOT NULL DEFAULT '{}',
        records TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS friendships (
        a TEXT NOT NULL, b TEXT NOT NULL,
        status TEXT NOT NULL, -- 'pending' (a pediu para b) | 'accepted'
        created_at INTEGER NOT NULL,
        PRIMARY KEY (a, b)
      );
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        at INTEGER NOT NULL,
        game TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        players INTEGER NOT NULL,
        win INTEGER NOT NULL,
        score INTEGER NOT NULL,
        stars INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_matches_user ON matches(user_id, at DESC);
    `);
  }

  private row(r: Record<string, unknown> | undefined): UserRow | null {
    if (!r) return null;
    return {
      id: r.id as string,
      name: r.name as string,
      friendCode: r.friend_code as string,
      xp: Number(r.xp),
      coins: Number(r.coins),
      owned: JSON.parse(r.owned as string),
      outfit: JSON.parse(r.outfit as string),
      achievements: JSON.parse(r.achievements as string),
      stats: JSON.parse(r.stats as string),
      records: JSON.parse(r.records as string),
      createdAt: Number(r.created_at),
    };
  }

  byToken(token: string): UserRow | null {
    return this.row(this.db.prepare('SELECT * FROM users WHERE token_hash = ?').get(hash(token)) as never);
  }
  byId(id: string): UserRow | null {
    return this.row(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as never);
  }
  byFriendCode(code: string): UserRow | null {
    return this.row(this.db.prepare('SELECT * FROM users WHERE friend_code = ?').get(code.toUpperCase()) as never);
  }

  createUser(name: string): { user: UserRow; token: string } {
    const token = randomBytes(24).toString('base64url');
    const id = randomBytes(8).toString('hex');
    let code = '';
    for (let i = 0; i < 20; i++) {
      code = Array.from(randomBytes(6), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
      if (!this.byFriendCode(code)) break;
    }
    const now = Date.now();
    this.db
      .prepare('INSERT INTO users (id, token_hash, name, friend_code, xp, coins, owned, outfit, created_at, last_seen) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, hash(token), name, code, 0, 250, JSON.stringify(DEFAULT_OWNED), JSON.stringify(randomOutfit()), now, now);
    return { user: this.byId(id)!, token };
  }

  save(u: UserRow): void {
    this.db
      .prepare('UPDATE users SET name=?, xp=?, coins=?, owned=?, outfit=?, achievements=?, stats=?, records=?, last_seen=? WHERE id=?')
      .run(u.name, u.xp, u.coins, JSON.stringify(u.owned), JSON.stringify(u.outfit), JSON.stringify(u.achievements), JSON.stringify(u.stats), JSON.stringify(u.records), Date.now(), u.id);
  }

  /* ----------------------------- amigos ----------------------------- */

  friendRows(userId: string): { other: string; status: string; dir: 'out' | 'in' }[] {
    const rows = this.db.prepare('SELECT a, b, status FROM friendships WHERE a = ? OR b = ?').all(userId, userId) as { a: string; b: string; status: string }[];
    return rows.map((r) => ({ other: r.a === userId ? r.b : r.a, status: r.status, dir: r.a === userId ? 'out' : 'in' }));
  }

  relation(a: string, b: string): { a: string; b: string; status: string } | null {
    return (this.db.prepare('SELECT a, b, status FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)').get(a, b, b, a) as never) ?? null;
  }

  requestFriend(from: string, to: string): 'sent' | 'accepted' | 'exists' {
    const rel = this.relation(from, to);
    if (rel) {
      if (rel.status === 'accepted') return 'exists';
      if (rel.a === to) {
        // o outro já tinha pedido: aceita
        this.db.prepare("UPDATE friendships SET status='accepted' WHERE a=? AND b=?").run(to, from);
        return 'accepted';
      }
      return 'exists';
    }
    this.db.prepare("INSERT INTO friendships (a,b,status,created_at) VALUES (?,?,'pending',?)").run(from, to, Date.now());
    return 'sent';
  }

  respondFriend(me: string, other: string, accept: boolean): boolean {
    const rel = this.relation(me, other);
    if (!rel || rel.status !== 'pending' || rel.b !== me) return false;
    if (accept) this.db.prepare("UPDATE friendships SET status='accepted' WHERE a=? AND b=?").run(other, me);
    else this.db.prepare('DELETE FROM friendships WHERE a=? AND b=?').run(other, me);
    return true;
  }

  removeFriend(a: string, b: string): void {
    this.db.prepare('DELETE FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)').run(a, b, b, a);
  }

  areFriends(a: string, b: string): boolean {
    return this.relation(a, b)?.status === 'accepted';
  }

  /* ----------------------------- partidas ----------------------------- */

  addMatch(userId: string, m: MatchHistoryEntry): void {
    this.db
      .prepare('INSERT INTO matches (user_id, at, game, difficulty, players, win, score, stars) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, m.at, m.game, m.difficulty, m.players, m.win ? 1 : 0, m.score, m.stars);
  }

  history(userId: string, limit = 20): MatchHistoryEntry[] {
    const rows = this.db.prepare('SELECT * FROM matches WHERE user_id = ? ORDER BY at DESC LIMIT ?').all(userId, limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      at: Number(r.at), game: r.game as never, difficulty: r.difficulty as never, players: Number(r.players),
      win: Number(r.win) === 1, score: Number(r.score), stars: Number(r.stars),
    }));
  }

  close(): void {
    this.db.close();
  }
}
