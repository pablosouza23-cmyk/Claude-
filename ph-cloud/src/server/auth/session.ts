import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { env } from "@/config/env";
import { getDb, schema } from "@/server/db";
import type { User } from "@/server/db/schema";

const SESSION_DAYS = 30;
const RENEW_WHEN_DAYS_LEFT = 15;
const TOUCH_EVERY_MS = 10 * 60_000;

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "avatar" | "createdAt">;

function secureCookies(): boolean {
  const e = env();
  if (e.APP_URL) return e.APP_URL.startsWith("https://");
  return e.NODE_ENV === "production";
}

export function sessionCookieName(): string {
  // O prefixo __Host- exige HTTPS, caminho "/" e nenhum domínio: o cookie não vaza para subdomínios.
  return secureCookies() ? "__Host-phc_session" : "phc_session";
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function cookieOptions(expires: Date) {
  return { httpOnly: true, secure: secureCookies(), sameSite: "lax" as const, path: "/", expires };
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  const db = await getDb();
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt, userAgent: ua });
  // Limpeza oportunista de sessões vencidas deste usuário.
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), lt(schema.sessions.expiresAt, new Date())));
  (await cookies()).set(sessionCookieName(), token, cookieOptions(expiresAt));
}

/** Sessão atual (uma consulta por requisição, graças ao cache do React). */
export const getSession = cache(async (): Promise<{ user: SessionUser; sessionId: string } | null> => {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const db = await getDb();
  const rows = await db
    .select({
      sessionId: schema.sessions.id,
      expiresAt: schema.sessions.expiresAt,
      lastSeenAt: schema.sessions.lastSeenAt,
      user: {
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        avatar: schema.users.avatar,
        createdAt: schema.users.createdAt,
      },
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const daysLeft = (row.expiresAt.getTime() - now) / 86_400_000;
  if (daysLeft < RENEW_WHEN_DAYS_LEFT || now - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    const renew = daysLeft < RENEW_WHEN_DAYS_LEFT;
    const expiresAt = renew ? new Date(now + SESSION_DAYS * 86_400_000) : row.expiresAt;
    await db.update(schema.sessions).set({ lastSeenAt: new Date(now), expiresAt }).where(eq(schema.sessions.id, id));
    if (renew) {
      try {
        jar.set(sessionCookieName(), token, cookieOptions(expiresAt));
      } catch {
        // Componentes de servidor não podem gravar cookies; a renovação acontece na próxima ação ou API.
      }
    }
  }
  return { user: row.user, sessionId: row.sessionId };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  jar.delete(sessionCookieName());
}

export async function destroyOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, keepSessionId)));
}
