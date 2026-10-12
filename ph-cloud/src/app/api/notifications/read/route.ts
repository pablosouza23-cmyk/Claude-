import { fail, json } from "@/server/api";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/security/request";
import { markAllRead } from "@/modules/notifications/service";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Origem não permitida.");
  const user = await getCurrentUser();
  if (!user) return fail(401, "Entre na sua conta para continuar.");
  await markAllRead(user.id);
  return json({ ok: true });
}
