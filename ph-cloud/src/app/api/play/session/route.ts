import { z } from "zod";
import { fail, json, readJson } from "@/server/api";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/security/request";
import { beatPlaySession, cloudMinutesThisMonth } from "@/modules/analytics/service";
import { addPlayTime } from "@/modules/library/service";
import { getUserPlan } from "@/modules/subscriptions/entitlements";

const body = z.object({ sessionId: z.string().uuid(), inputMethod: z.string().max(20).optional() });

/* Batimento de sessão (a cada ~30 s): soma o tempo jogado e informa se o limite do Cloud Play acabou. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Origem não permitida.");
  const parsed = await readJson(req, body);
  if (!parsed.ok) return parsed.response;
  const user = await getCurrentUser();
  const res = await beatPlaySession(parsed.data.sessionId, user?.id ?? null, parsed.data.inputMethod);
  if (!res) return fail(404, "Sessão não encontrada.");
  if (user && res.kind === "game") await addPlayTime(user.id, res.gameId, res.seconds);
  if (res.kind === "cloud" && user) {
    const plan = await getUserPlan(user);
    const used = await cloudMinutesThisMonth(user.id);
    const left = plan.entitlements.cloudPlayMinutesPerMonth - used;
    return json({ ok: true, minutesLeft: Math.max(0, left), stop: left <= 0 });
  }
  return json({ ok: true });
}
