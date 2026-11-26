import { PROTOCOL_VERSION } from '../../../shared/constants';
import type { C2S, S2C } from '../../../shared/protocol';

type Handler<T extends S2C['t']> = (m: Extract<S2C, { t: T }>) => void;

const TOKEN_KEY = 'pv.token';

/**
 * Conexão WebSocket com reconexão automática (backoff), sincronização de
 * relógio com o servidor (ping/pong, mediana) e despacho tipado de mensagens.
 */
export class Net {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(m: never) => void>>();
  private offsets: number[] = [];
  private offset = 0;
  rtt = 0;
  connected = false;
  private retry = 0;
  private pingTimer: number | null = null;
  private pendingName: string | undefined;
  onStatus: ((s: 'connecting' | 'online' | 'offline') => void) | null = null;
  readonly url: string;

  constructor(url?: string) {
    const override = new URLSearchParams(location.search).get('server');
    if (url) this.url = url;
    else if (override) this.url = override;
    else this.url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  get token(): string | null {
    try { return localStorage.getItem(this.tokenKey()); } catch { return null; }
  }
  private tokenKey(): string {
    // perfis separados por aba de teste (?profile=x) — útil para testar multiplayer no mesmo PC
    const p = new URLSearchParams(location.search).get('profile');
    return p ? `${TOKEN_KEY}.${p}` : TOKEN_KEY;
  }

  /** hora estimada do servidor (ms) */
  now(): number {
    return Date.now() + this.offset;
  }

  connect(name?: string): void {
    if (name) this.pendingName = name;
    this.onStatus?.('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      this.raw({ t: 'hello', v: PROTOCOL_VERSION, token: this.token ?? undefined, name: this.pendingName });
      this.ping();
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.ping(), 2000);
    };
    ws.onmessage = (ev) => {
      let m: S2C;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'pong') {
        const now = Date.now();
        this.rtt = now - m.c;
        this.offsets.push(m.s + this.rtt / 2 - now);
        if (this.offsets.length > 9) this.offsets.shift();
        const sorted = [...this.offsets].sort((a, b) => a - b);
        this.offset = sorted[Math.floor(sorted.length / 2)];
      }
      if (m.t === 'welcome') {
        try { localStorage.setItem(this.tokenKey(), m.token); } catch { /* */ }
        this.offset = m.serverTime - Date.now();
        this.onStatus?.('online');
      }
      const hs = this.handlers.get(m.t);
      if (hs) for (const h of hs) h(m as never);
    };
    ws.onclose = () => {
      this.connected = false;
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.onStatus?.('offline');
      const delay = Math.min(8000, 500 * Math.pow(1.7, this.retry++));
      setTimeout(() => { if (this.ws === ws) this.connect(); }, delay);
    };
    ws.onerror = () => {};
  }

  /** simula queda de conexão (testes de reconexão) */
  dropForTest(): void {
    this.ws?.close();
  }

  private ping(): void {
    this.raw({ t: 'ping', c: Date.now() });
  }

  private raw(m: C2S): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  /** contadores de mensagens enviadas por tipo (diagnóstico) */
  readonly sent: Record<string, number> = {};
  send(m: C2S): void {
    this.sent[m.t] = (this.sent[m.t] ?? 0) + 1;
    this.raw(m);
  }

  on<T extends S2C['t']>(t: T, h: Handler<T>): () => void {
    let set = this.handlers.get(t);
    if (!set) this.handlers.set(t, (set = new Set()));
    set.add(h as never);
    return () => set!.delete(h as never);
  }
}
