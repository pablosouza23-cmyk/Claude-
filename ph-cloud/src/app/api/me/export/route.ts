import { eq } from "drizzle-orm";
import { fail } from "@/server/api";
import { getCurrentUser } from "@/server/auth/session";
import { getDb, schema } from "@/server/db";

/* Exportação dos dados pessoais (direito de acesso — LGPD, art. 18). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Entre na sua conta para continuar.");
  const db = await getDb();
  const [settings, favorites, history, saves, subscriptions, sessions] = await Promise.all([
    db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id)),
    db.select().from(schema.favorites).where(eq(schema.favorites.userId, user.id)),
    db.select().from(schema.playHistory).where(eq(schema.playHistory.userId, user.id)),
    db.select().from(schema.gameSaves).where(eq(schema.gameSaves.userId, user.id)),
    db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id)),
    db
      .select({ createdAt: schema.sessions.createdAt, lastSeenAt: schema.sessions.lastSeenAt, userAgent: schema.sessions.userAgent })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user.id)),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: user,
    settings: settings[0] ?? null,
    favorites,
    history,
    cloudSaves: saves,
    // O id de cliente do processador de pagamentos é interno e fica de fora.
    subscriptions: subscriptions.map((s) => ({ ...s, providerCustomerId: undefined })),
    sessions,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ph-cloud-meus-dados.json"`,
      "Cache-Control": "no-store",
    },
  });
}
