/*
 * Limite de tentativas em memória (janela fixa). Suficiente para um servidor; com várias
 * instâncias, troque por um armazenamento compartilhado (ex.: Redis) mantendo esta interface.
 */

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Registra uma tentativa. Retorna false se o limite foi excedido. */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const t = this.now();
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= t) {
      b = { count: 0, resetAt: t + this.windowMs };
      this.buckets.set(key, b);
    }
    b.count += 1;
    if (this.buckets.size > 10_000) this.sweep(t);
    return { allowed: b.count <= this.max, retryAfterSeconds: Math.max(0, Math.ceil((b.resetAt - t) / 1000)) };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private sweep(t: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
  }
}

const g = globalThis as unknown as { __phcLimiters?: Record<string, RateLimiter> };
g.__phcLimiters ??= {
  loginIp: new RateLimiter(20, 15 * 60_000),
  loginAccount: new RateLimiter(8, 15 * 60_000),
  register: new RateLimiter(10, 60 * 60_000),
  sensitive: new RateLimiter(10, 15 * 60_000),
};

export const limiters = g.__phcLimiters as {
  loginIp: RateLimiter;
  loginAccount: RateLimiter;
  register: RateLimiter;
  sensitive: RateLimiter;
};
