import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ gameId: schema.favorites.gameId })
    .from(schema.favorites)
    .where(eq(schema.favorites.userId, userId))
    .orderBy(desc(schema.favorites.createdAt));
  return rows.map((r) => r.gameId);
}

export async function isFavorite(userId: string, gameId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ gameId: schema.favorites.gameId })
    .from(schema.favorites)
    .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.gameId, gameId)))
    .limit(1);
  return rows.length > 0;
}

export async function setFavorite(userId: string, gameId: string, on: boolean): Promise<void> {
  const db = await getDb();
  if (on) {
    await db.insert(schema.favorites).values({ userId, gameId }).onConflictDoNothing();
  } else {
    await db.delete(schema.favorites).where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.gameId, gameId)));
  }
}

export type HistoryItem = { gameId: string; lastPlayedAt: Date; playCount: number; totalSeconds: number };

export async function getHistory(userId: string, limit: number): Promise<HistoryItem[]> {
  const db = await getDb();
  return db
    .select({
      gameId: schema.playHistory.gameId,
      lastPlayedAt: schema.playHistory.lastPlayedAt,
      playCount: schema.playHistory.playCount,
      totalSeconds: schema.playHistory.totalSeconds,
    })
    .from(schema.playHistory)
    .where(eq(schema.playHistory.userId, userId))
    .orderBy(desc(schema.playHistory.lastPlayedAt))
    .limit(limit);
}

/** Registra o início de uma partida no histórico do usuário. */
export async function recordPlayStart(userId: string, gameId: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.playHistory)
    .values({ userId, gameId })
    .onConflictDoUpdate({
      target: [schema.playHistory.userId, schema.playHistory.gameId],
      set: { lastPlayedAt: new Date(), playCount: sql`${schema.playHistory.playCount} + 1` },
    });
}

export async function addPlayTime(userId: string, gameId: string, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const db = await getDb();
  await db
    .update(schema.playHistory)
    .set({ totalSeconds: sql`${schema.playHistory.totalSeconds} + ${Math.round(seconds)}`, lastPlayedAt: new Date() })
    .where(and(eq(schema.playHistory.userId, userId), eq(schema.playHistory.gameId, gameId)));
}

/** Importa favoritos e histórico guardados no navegador antes do login. */
export async function importLocalLibrary(
  userId: string,
  data: { favorites: string[]; history: { gameId: string; lastPlayedAt: string; seconds: number }[] },
  validIds: Set<string>,
): Promise<void> {
  const db = await getDb();
  const favs = [...new Set(data.favorites)].filter((id) => validIds.has(id)).slice(0, 200);
  if (favs.length) await db.insert(schema.favorites).values(favs.map((gameId) => ({ userId, gameId }))).onConflictDoNothing();
  for (const h of data.history.slice(0, 50)) {
    if (!validIds.has(h.gameId)) continue;
    const when = new Date(h.lastPlayedAt);
    const lastPlayedAt = Number.isNaN(when.getTime()) || when.getTime() > Date.now() ? new Date() : when;
    const seconds = Math.min(Math.max(0, Math.round(h.seconds || 0)), 24 * 3600);
    await db
      .insert(schema.playHistory)
      .values({ userId, gameId: h.gameId, lastPlayedAt, totalSeconds: seconds })
      .onConflictDoUpdate({
        target: [schema.playHistory.userId, schema.playHistory.gameId],
        set: { totalSeconds: sql`${schema.playHistory.totalSeconds} + ${seconds}` },
      });
  }
}
