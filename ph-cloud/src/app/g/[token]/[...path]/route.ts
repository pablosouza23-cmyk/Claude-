import { readFile, stat } from "node:fs/promises";
import { appOrigin, env, originOf } from "@/config/env";
import { contentTypeFor, resolveGameFile } from "@/server/games/files";
import { verifyGameToken } from "@/server/games/token";
import { buildGameCsp } from "@/server/security/csp";

/* Serve os arquivos dos jogos próprios. Exige token válido no caminho; aplica CSP restrita. */

export async function GET(req: Request, ctx: { params: Promise<{ token: string; path: string[] }> }) {
  const { token, path: segments } = await ctx.params;
  const e = env();
  const payload = verifyGameToken(token, e.appSecret);
  if (!payload) return new Response("Sessão de jogo expirada. Volte e abra o jogo novamente.", { status: 403 });

  const file = resolveGameFile(segments, payload.g);
  if (!file) return new Response("Arquivo não encontrado.", { status: 404 });
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Arquivo não encontrado.", { status: 404 });
  } catch {
    return new Response("Arquivo não encontrado.", { status: 404 });
  }

  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const self = originOf(e.GAMES_ORIGIN) ?? appOrigin(host, proto);
  const parent = appOrigin(host, proto);

  const body = await readFile(file);
  const type = contentTypeFor(file)!;
  const headers = new Headers({
    "Content-Type": type,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (type.startsWith("text/html")) headers.set("Content-Security-Policy", buildGameCsp(self, [parent]));
  return new Response(body, { headers });
}
