import { z } from "zod";
import { fail, guardMutation, json } from "@/server/api";
import { getCurrentUser } from "@/server/auth/session";
import { getFavoriteIds, setFavorite } from "@/modules/library/service";
import { getFullCatalog } from "@/modules/catalog/repository";

const body = z.object({ gameId: z.string().min(1).max(80) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Entre na sua conta para continuar.");
  return json({ favorites: await getFavoriteIds(user.id) });
}

async function change(req: Request, on: boolean) {
  const g = await guardMutation(req, body);
  if (!g.ok) return g.response;
  const exists = (await getFullCatalog()).some((x) => x.id === g.body.gameId);
  if (on && !exists) return fail(404, "Jogo não encontrado.");
  await setFavorite(g.user.id, g.body.gameId, on);
  return json({ ok: true, favorite: on });
}

export const POST = (req: Request) => change(req, true);
export const DELETE = (req: Request) => change(req, false);
