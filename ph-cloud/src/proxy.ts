import { NextResponse, type NextRequest } from "next/server";
import { env, originOf } from "@/config/env";
import { enabledFrameOrigins, enabledImageOrigins } from "@/modules/providers/registry";
import { buildAppCsp } from "@/server/security/csp";

/* Gera um nonce por requisição e aplica a CSP das páginas do app. */
export function proxy(request: NextRequest) {
  const e = env();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cloudOrigin = originOf(e.CLOUD_STREAM_URL);
  const csp = buildAppCsp({
    nonce,
    dev: e.NODE_ENV === "development",
    frameOrigins: [...enabledFrameOrigins(), originOf(e.GAMES_ORIGIN) ?? "", cloudOrigin ?? ""],
    imageOrigins: enabledImageOrigins(),
    connectOrigins: [originOf(e.CLOUD_STREAM_HEALTH_URL) ?? cloudOrigin ?? ""],
  });

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Fora: arquivos estáticos, jogos (/g/ tem CSP própria) e APIs JSON.
      source: "/((?!api/|g/|_next/static|_next/image|favicon.ico|icons/|covers/|avatars/|brand/|manifest.webmanifest|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
