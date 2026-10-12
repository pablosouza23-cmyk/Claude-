import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

/*
 * Métricas próprias e mínimas: início, duração (por batimentos) e método de entrada.
 * Sem IP, sem cookies de rastreamento e sem serviços de terceiros.
 */

/** Batimentos a cada ~30 s; aceitamos no máximo 90 s por batimento para não inflar a duração. */
const MAX_BEAT_SECONDS = 90;

export async function startPlaySession(input: {
  userId: string | null;
  gameId: string;
  kind: "game" | "cloud" | "external";
  inputMethod?: string;
  deviceClass?: string;
}): Promise<string> {
  const db = await getDb();
  const rows = await db
    .insert(schema.playSessions)
    .values({
      userId: input.userId,
      gameId: input.gameId,
      kind: input.kind,
      inputMethod: input.inputMethod?.slice(0, 20),
      deviceClass: input.deviceClass?.slice(0, 20),
    })
    .returning({ id: schema.playSessions.id });
  return rows[0]!.id;
}

/** Soma o tempo desde o último batimento. Retorna os segundos contabilizados. */
export async function beatPlaySession(sessionId: string, userId: string | null, inputMethod?: string): Promise<{ seconds: number; gameId: string; kind: string } | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.playSessions).where(eq(schema.playSessions.id, sessionId)).limit(1);
  const s = rows[0];
  if (!s) return null;
  // A sessão só pode ser atualizada por quem a criou (ou anonimamente, se foi anônima).
  if ((s.userId ?? null) !== (userId ?? null)) return null;
  const now = Date.now();
  const delta = Math.min(MAX_BEAT_SECONDS, Math.max(0, (now - s.lastBeatAt.getTime()) / 1000));
  await db
    .update(schema.playSessions)
    .set({
      lastBeatAt: new Date(now),
      durationSeconds: sql`${schema.playSessions.durationSeconds} + ${Math.round(delta)}`,
      inputMethod: inputMethod?.slice(0, 20) ?? s.inputMethod,
    })
    .where(eq(schema.playSessions.id, sessionId));
  return { seconds: Math.round(delta), gameId: s.gameId, kind: s.kind };
}

/** Minutos de Cloud Play usados no mês corrente (fuso de São Paulo aproximado por UTC-3). */
export async function cloudMinutesThisMonth(userId: string): Promise<number> {
  const db = await getDb();
  const now = new Date(Date.now() - 3 * 3600_000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3));
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${schema.playSessions.durationSeconds}), 0)::int` })
    .from(schema.playSessions)
    .where(and(eq(schema.playSessions.userId, userId), eq(schema.playSessions.kind, "cloud"), gte(schema.playSessions.startedAt, monthStart)));
  return Math.floor(Number(rows[0]?.total ?? 0) / 60);
}

export async function adminStats() {
  const db = await getDb();
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const [users, activeSubs, plays7, top, byInput] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.users),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.subscriptions).where(sql`${schema.subscriptions.status} in ('active','trialing')`),
    db
      .select({ n: sql<number>`count(*)::int`, seconds: sql<number>`coalesce(sum(${schema.playSessions.durationSeconds}),0)::int` })
      .from(schema.playSessions)
      .where(gte(schema.playSessions.startedAt, since7)),
    db
      .select({ gameId: schema.playSessions.gameId, n: sql<number>`count(*)::int`, seconds: sql<number>`coalesce(sum(${schema.playSessions.durationSeconds}),0)::int` })
      .from(schema.playSessions)
      .where(gte(schema.playSessions.startedAt, since7))
      .groupBy(schema.playSessions.gameId)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({ input: schema.playSessions.inputMethod, n: sql<number>`count(*)::int` })
      .from(schema.playSessions)
      .where(gte(schema.playSessions.startedAt, since7))
      .groupBy(schema.playSessions.inputMethod),
  ]);
  return {
    users: Number(users[0]?.n ?? 0),
    activeSubscriptions: Number(activeSubs[0]?.n ?? 0),
    plays7: Number(plays7[0]?.n ?? 0),
    seconds7: Number(plays7[0]?.seconds ?? 0),
    topGames: top.map((t) => ({ gameId: t.gameId, plays: Number(t.n), seconds: Number(t.seconds) })),
    byInput: byInput.map((b) => ({ input: b.input ?? "desconhecido", plays: Number(b.n) })),
  };
}
