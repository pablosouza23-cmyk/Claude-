import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Token de lançamento dos jogos próprios. Vai no caminho da URL (/g/<token>/<jogo>/...), então todos
 * os arquivos do jogo carregam o token sem depender de cookies (o iframe roda com origem opaca).
 * Emitido só depois de verificar o acesso do usuário ao jogo.
 */

export type GameTokenPayload = { g: string; u: string; exp: number };

export const GAME_TOKEN_TTL_SECONDS = 4 * 3600;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(`phc-game:${data}`).digest("base64url");
}

export function createGameToken(gameId: string, userId: string | null, secret: string, now = Date.now()): string {
  const payload: GameTokenPayload = { g: gameId, u: userId ?? "anon", exp: Math.floor(now / 1000) + GAME_TOKEN_TTL_SECONDS };
  const data = b64(JSON.stringify(payload));
  return `${data}.${sign(data, secret)}`;
}

export function verifyGameToken(token: string, secret: string, now = Date.now()): GameTokenPayload | null {
  if (token.length > 400) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as GameTokenPayload;
    if (typeof p.g !== "string" || typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}
