import type { StreamOption, StreamService } from "@/modules/catalog/types";

/*
 * Serviços oficiais de cloud gaming. Nenhum deles oferece API pública para incorporar o player
 * em outro site (pesquisa de out/2026, ver docs/PROVEDORES.md). O PH Cloud leva o jogador ao jogo
 * pelo link oficial de cada serviço; a sessão roda na página do próprio serviço.
 */

export type StreamServiceInfo = {
  id: StreamService;
  name: string;
  /** Conta exigida pelo serviço. */
  account: string;
  /** Como funciona o acesso gratuito, quando existe. */
  freeTier: string;
  brazil: string;
  browsers: string;
  controls: string;
  website: string;
  /** Texto do botão. */
  cta: string;
};

export const STREAM_SERVICES: Record<StreamService, StreamServiceInfo> = {
  xbox: {
    id: "xbox",
    name: "Xbox Cloud Gaming",
    account: "Conta Microsoft (gratuita)",
    freeTier:
      "Jogos gratuitos marcados pela Microsoft (como o Fortnite) não exigem assinatura. Os demais exigem Xbox Game Pass com jogos na nuvem ou a compra do jogo.",
    brazil: "Disponível no Brasil.",
    browsers: "Chrome, Edge e Safari (iPhone e iPad) recentes.",
    controls: "Controle Xbox, PlayStation ou compatível; alguns jogos têm controles na tela para celular.",
    website: "https://www.xbox.com/pt-BR/play",
    cta: "Jogar no Xbox Cloud Gaming",
  },
  geforcenow: {
    id: "geforcenow",
    name: "GeForce NOW",
    account: "Conta NVIDIA. No Brasil, o serviço é oferecido pela ABYA, parceira oficial da NVIDIA.",
    freeTier:
      "Plano gratuito com fila de espera e sessões de até 1 hora, para jogos selecionados. Jogos pagos precisam estar na sua biblioteca (Steam, Epic etc.).",
    brazil: "Disponível no Brasil (GeForce NOW powered by ABYA).",
    browsers: "Chrome ou Edge recentes no computador; aplicativo no celular.",
    controls: "Teclado e mouse, controle e, em alguns jogos, toque no celular.",
    website: "https://play.geforcenow.com",
    cta: "Jogar no GeForce NOW",
  },
  boosteroid: {
    id: "boosteroid",
    name: "Boosteroid",
    account: "Conta Boosteroid (assinatura paga)",
    freeTier: "Não tem plano gratuito. Os jogos precisam estar na sua biblioteca da loja correspondente.",
    brazil: "Servidores no Brasil desde 2025.",
    browsers: "Navegadores recentes no computador e no celular.",
    controls: "Teclado e mouse ou controle.",
    website: "https://cloud.boosteroid.com",
    cta: "Jogar no Boosteroid",
  },
};

export const ACCESS_LABELS: Record<StreamOption["access"], string> = {
  free: "Grátis",
  subscription: "Requer assinatura",
  owned: "Precisa ter o jogo",
  subscription_or_owned: "Assinatura ou compra do jogo",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LinkCheck = { ok: true; url: string } | { ok: false; error: string };

/** Valida e normaliza o link oficial de um jogo em cada serviço. */
export function validateStreamUrl(service: StreamService, input: string): LinkCheck {
  const raw = input.trim();
  if (service === "geforcenow") {
    // Aceita o game-id sozinho ou a URL da página do jogo (o game-id fica na barra de endereço).
    let gameId = raw;
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" || u.hostname !== "play.geforcenow.com") return { ok: false, error: "Use um link de play.geforcenow.com." };
      gameId = u.searchParams.get("game-id") ?? "";
    } catch {
      /* não é URL: tratamos como game-id */
    }
    if (!UUID.test(gameId)) return { ok: false, error: "Informe o game-id do GeForce NOW (copie da barra de endereço na página do jogo)." };
    return { ok: true, url: geforceNowDeepLink(gameId.toLowerCase()) };
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "Informe uma URL válida." };
  }
  if (u.protocol !== "https:" || u.username || u.password) return { ok: false, error: "Use um link https." };
  if (service === "xbox") {
    if (u.hostname !== "www.xbox.com" || !/^\/([a-z]{2}-[a-z]{2}\/)?play\/games\/.+/i.test(u.pathname)) {
      return { ok: false, error: "Use o link da página do jogo em www.xbox.com/pt-BR/play/games/…" };
    }
    return { ok: true, url: `https://www.xbox.com${u.pathname}` };
  }
  if (service === "boosteroid") {
    if (u.hostname !== "cloud.boosteroid.com" && u.hostname !== "boosteroid.com") return { ok: false, error: "Use um link de cloud.boosteroid.com." };
    return { ok: true, url: `https://${u.hostname}${u.pathname}${u.search}` };
  }
  return { ok: false, error: "Serviço desconhecido." };
}

/**
 * Deep link oficial do GeForce NOW (NVIDIA GeForceNOW-SDK, doc "GfnSdk-Deep-Linking"):
 * https://play.geforcenow.com/games?game-id=<id>&utm_source=<origem>&utm_campaign=<campanha>
 */
export function geforceNowDeepLink(gameId: string): string {
  const p = new URLSearchParams({ "game-id": gameId, utm_source: "phcloud", utm_campaign: "catalogo", utm_medium: "web" });
  return `https://play.geforcenow.com/games?${p.toString()}`;
}
