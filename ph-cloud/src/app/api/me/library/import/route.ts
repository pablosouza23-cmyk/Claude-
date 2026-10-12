import { z } from "zod";
import { guardMutation, json } from "@/server/api";
import { importLocalLibrary } from "@/modules/library/service";
import { getFullCatalog } from "@/modules/catalog/repository";

const body = z.object({
  favorites: z.array(z.string().max(80)).max(500).default([]),
  history: z
    .array(z.object({ gameId: z.string().max(80), lastPlayedAt: z.string().max(40), seconds: z.number().min(0).max(1e7) }))
    .max(100)
    .default([]),
});

export async function POST(req: Request) {
  const g = await guardMutation(req, body);
  if (!g.ok) return g.response;
  const ids = new Set((await getFullCatalog()).map((x) => x.id));
  await importLocalLibrary(g.user.id, g.body, ids);
  return json({ ok: true });
}
