import type { GameRecord, LaunchType, ProviderId } from "@/modules/catalog/types";

export type ProviderState = "active" | "disabled" | "requires_credentials" | "requires_partnership";

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

export type EmbedContext = {
  /** URL pública da página do jogo no PH Cloud (alguns provedores exigem para atribuição). */
  pageUrl: string;
};

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  /** Como os jogos deste provedor abrem. */
  launchTypes: LaunchType[];
  /** Origens que precisam entrar no frame-src da CSP quando o provedor está ativo. */
  frameOrigins: string[];
  /** Origens de imagens de capa aceitas para este provedor. */
  imageOrigins: string[];
  /** Exigências para usar o provedor, mostradas no painel administrativo. */
  requirements: string[];
  docsUrl?: string;
  /** Valida e normaliza a URL de lançamento informada pelo administrador. */
  validateLaunchUrl(input: string, launchType: LaunchType): UrlCheck;
  /** URL do iframe para jogos incorporados. */
  embedSrc?(game: GameRecord, ctx: EmbedContext): string;
  /** Atributos de segurança do iframe. */
  iframe?: { sandbox: string; allow: string };
}

/** Extrai o src quando o administrador cola o código <iframe> inteiro. */
export function extractIframeSrc(input: string): string {
  const trimmed = input.trim();
  const m = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(trimmed);
  return (m ? m[1]! : trimmed).replace(/&amp;/g, "&");
}

export function parseHttpsUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}
