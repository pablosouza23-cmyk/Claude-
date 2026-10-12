import { eq } from "drizzle-orm";
import { fail, guardMutation, json } from "@/server/api";
import { getCurrentUser } from "@/server/auth/session";
import { getDb, schema } from "@/server/db";
import { inputSettingsSchema } from "@/modules/input/settings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Entre na sua conta para continuar.");
  const db = await getDb();
  const rows = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id)).limit(1);
  const parsed = inputSettingsSchema.safeParse(rows[0]?.input ?? {});
  return json({ settings: parsed.success ? parsed.data : null, updatedAt: rows[0]?.updatedAt ?? null });
}

export async function PUT(req: Request) {
  const g = await guardMutation(req, inputSettingsSchema);
  if (!g.ok) return g.response;
  const db = await getDb();
  const now = new Date();
  await db
    .insert(schema.userSettings)
    .values({ userId: g.user.id, preferredInput: g.body.method, input: g.body, updatedAt: now })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: { preferredInput: g.body.method, input: g.body, updatedAt: now } });
  return json({ ok: true, updatedAt: now });
}
