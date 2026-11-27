import type { WebSocket } from 'ws';
import type { S2C } from '../../shared/protocol';
import type { UserRow } from './db';
import type { World } from './worlds/World';
import type { Room } from './rooms';

/** Uma sessão sobrevive à queda da conexão por RECONNECT_GRACE_MS. */
export class Session {
  ws: WebSocket | null = null;
  world: World | null = null;
  room: Room | null = null;
  disconnectedAt = 0;
  /** limite simples de taxa de mensagens */
  private bucket = 60;
  private bucketAt = Date.now();
  /** tentativas de login/recuperação (anti força bruta) */
  authTries: number[] = [];

  constructor(public user: UserRow, public token: string) {}

  get id(): string { return this.user.id; }
  get connected(): boolean { return this.ws !== null; }

  send(msg: S2C): void {
    const ws = this.ws;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  /** token bucket: ~60 msgs/s sustentado, rajada de 120 */
  allow(): boolean {
    const now = Date.now();
    this.bucket = Math.min(120, this.bucket + ((now - this.bucketAt) / 1000) * 60);
    this.bucketAt = now;
    if (this.bucket < 1) return false;
    this.bucket -= 1;
    return true;
  }
}
