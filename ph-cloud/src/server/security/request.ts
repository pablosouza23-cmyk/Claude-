import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { appOrigin, env } from "@/config/env";

/*
 * Proteção CSRF para rotas de API que alteram dados: o cabeçalho Origin precisa ser o do próprio site.
 * (Server Actions já têm essa verificação embutida no Next.js.) Cookies usam SameSite=Lax.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const appUrl = env().APP_URL;
  if (appUrl && new URL(appUrl).origin === origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** IP do cliente para limitar tentativas. Confia no primeiro X-Forwarded-For (proxy da hospedagem). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "local";
}

/** Identificador não reversível do IP, para chaves de limite (não é armazenado em banco). */
export const ipKey = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 32);

/** URL absoluta no domínio público do site (respeita APP_URL e proxies). */
export function absoluteUrl(req: Request, path: string): URL {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return new URL(path, appOrigin(host, proto));
}
