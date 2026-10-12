import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  read: boolean;
  broadcast: boolean;
};

/** Avisos gerais (userId nulo) e pessoais do usuário, com estado de leitura. */
export async function listNotifications(userId: string | null, limit = 20): Promise<NotificationItem[]> {
  const db = await getDb();
  const n = schema.notifications;
  const r = schema.notificationReads;
  const where = userId ? or(isNull(n.userId), eq(n.userId, userId)) : isNull(n.userId);
  const rows = await db
    .select({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.createdAt,
      userId: n.userId,
      readAt: r.readAt,
    })
    .from(n)
    .leftJoin(r, and(eq(r.notificationId, n.id), userId ? eq(r.userId, userId) : sql`false`))
    .where(where)
    .orderBy(desc(n.createdAt))
    .limit(limit);
  return rows.map((x) => ({
    id: x.id,
    title: x.title,
    body: x.body,
    link: x.link,
    createdAt: x.createdAt.toISOString(),
    read: Boolean(x.readAt),
    broadcast: x.userId === null,
  }));
}

export async function markAllRead(userId: string): Promise<void> {
  const db = await getDb();
  const items = await listNotifications(userId, 100);
  const unread = items.filter((i) => !i.read);
  if (unread.length === 0) return;
  await db
    .insert(schema.notificationReads)
    .values(unread.map((i) => ({ userId, notificationId: i.id })))
    .onConflictDoNothing();
}

export async function notifyUser(userId: string | null, title: string, body: string, link?: string): Promise<void> {
  const db = await getDb();
  await db.insert(schema.notifications).values({ userId, title, body, link: link ?? null });
}
