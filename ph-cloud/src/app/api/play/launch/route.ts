import { z } from "zod";
import { fail, json, readJson } from "@/server/api";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/security/request";
import { getGame } from "@/modules/catalog/repository";
import { recordPlayStart } from "@/modules/library/service";
import { startPlaySession } from "@/modules/analytics/service";

const body = z.object({ gameId: z.string().min(1).max(80), service: z.enum(["xbox", "geforcenow", "boosteroid"]) });

/* Registra que o jogador foi levado a um serviço oficial de cloud gaming (histórico e popularidade). */
export async function POST(req: Request) {
  // sendBeacon envia Origin nas requisições do mesmo site; mantém a proteção contra CSRF.
  if (!isSameOrigin(req)) return fail(403, "Origem não permitida.");
  const parsed = await readJson(req, body);
  if (!parsed.ok) return parsed.response;
  const game = await getGame(parsed.data.gameId);
  if (!game || !game.streams?.some((s) => s.service === parsed.data.service)) return fail(404, "Jogo não encontrado.");
  const user = await getCurrentUser();
  await startPlaySession({ userId: user?.id ?? null, gameId: game.id, kind: "external", inputMethod: `servico:${parsed.data.service}` });
  if (user) await recordPlayStart(user.id, game.id);
  return json({ ok: true });
}
