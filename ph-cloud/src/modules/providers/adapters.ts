import { extractIframeSrc, parseHttpsUrl, type ProviderAdapter } from "./types";

/*
 * Adaptadores de provedores de jogos. Cada um sabe validar as URLs que aceita e montar o iframe
 * pelo método oficial do provedor. Nenhum deles busca catálogos por raspagem de páginas.
 */

/** Jogos próprios, servidos pela rota /g/ com token assinado. */
export const phcloudAdapter: ProviderAdapter = {
  id: "phcloud",
  name: "PH Cloud Originais",
  launchTypes: ["browser_game"],
  frameOrigins: [],
  imageOrigins: [],
  requirements: ["Nenhuma: jogos próprios incluídos no projeto (pasta games/)."],
  validateLaunchUrl: () => ({ ok: false, error: "Jogos próprios são cadastrados no código (src/modules/catalog/originals.ts)." }),
  iframe: {
    // Sem allow-same-origin: o jogo roda com origem opaca e só conversa com o PH Cloud por postMessage.
    sandbox: "allow-scripts allow-pointer-lock",
    allow: "autoplay; fullscreen; gamepad",
  },
};

/**
 * itch.io — incorporação oficial de jogos HTML5 (código gerado pelo criador em "Embed game"
 * ou pelo link "Embed" da página do jogo). Formato aceito: https://itch.io/embed-upload/<id>.
 * O widget de compra (https://itch.io/embed/<id>) não é um jogo e é recusado.
 */
export const itchioAdapter: ProviderAdapter = {
  id: "itchio",
  name: "itch.io",
  launchTypes: ["authorized_embed", "external_provider"],
  frameOrigins: ["https://itch.io"],
  imageOrigins: ["https://img.itch.zone"],
  requirements: [
    "Código de incorporação oficial gerado no itch.io para o jogo (Embed game).",
    "Permissão do desenvolvedor para exibir o jogo no PH Cloud — e por escrito se o jogo fizer parte de um plano pago.",
    "Sem chave de API: a API do itch.io só gerencia a sua própria conta, não oferece catálogo público.",
  ],
  docsUrl: "https://itch.io/docs/api/overview",
  validateLaunchUrl(input, launchType) {
    const u = parseHttpsUrl(extractIframeSrc(input));
    if (!u) return { ok: false, error: "Informe uma URL https válida." };
    if (launchType === "external_provider") {
      if (/^[a-z0-9-]+\.itch\.io$/.test(u.hostname) && /^\/[a-z0-9_-]+\/?$/i.test(u.pathname)) {
        return { ok: true, url: `https://${u.hostname}${u.pathname.replace(/\/$/, "")}` };
      }
      return { ok: false, error: "Para abrir no itch.io, use a página do jogo: https://<criador>.itch.io/<jogo>." };
    }
    if (launchType !== "authorized_embed") return { ok: false, error: "Tipo de lançamento não suportado para o itch.io." };
    if (u.hostname === "itch.io" && /^\/embed-upload\/\d+\/?$/.test(u.pathname)) {
      const clean = new URL(`https://itch.io${u.pathname.replace(/\/$/, "")}`);
      const color = u.searchParams.get("color");
      if (color && /^[0-9a-fA-F]{6}$/.test(color)) clean.searchParams.set("color", color);
      return { ok: true, url: clean.toString() };
    }
    if (u.hostname === "itch.io" && u.pathname.startsWith("/embed/")) {
      return { ok: false, error: "Esse é o widget de compra do itch.io, não o jogo. Use o código de 'Embed game' (embed-upload)." };
    }
    return { ok: false, error: "Para incorporar, use o código de 'Embed game' do itch.io: https://itch.io/embed-upload/<id>." };
  },
  embedSrc: (game) => game.launch.url ?? "",
  iframe: {
    sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-forms",
    allow: "autoplay; fullscreen; gamepad",
  },
};

/**
 * GameDistribution — formato oficial publicado em github.com/GameDistribution/gd-embed-game:
 * https://embed.gamedistribution.com/?url=<URL do jogo>&width=&height=&language=&gdpr-*=&gd_sdk_referrer_url=<página>
 * Os jogos exibem anúncios do próprio provedor.
 */
export const gameDistributionAdapter: ProviderAdapter = {
  id: "gamedistribution",
  name: "GameDistribution",
  launchTypes: ["authorized_embed"],
  frameOrigins: ["https://embed.gamedistribution.com"],
  imageOrigins: ["https://img.gamedistribution.com"],
  requirements: [
    "Conta de publisher e aceite dos termos da GameDistribution (Azerion).",
    "Os jogos exibem anúncios do provedor; não podem ser vendidos como 'sem anúncios'.",
    "Confirme nos termos atuais se o uso em um site com planos pagos é permitido.",
  ],
  docsUrl: "https://github.com/GameDistribution/gd-embed-game",
  validateLaunchUrl(input, launchType) {
    if (launchType !== "authorized_embed") return { ok: false, error: "A GameDistribution só oferece incorporação." };
    const raw = extractIframeSrc(input);
    const u = parseHttpsUrl(raw);
    if (!u) return { ok: false, error: "Informe uma URL https válida." };
    // Aceita o código de incorporação completo (extrai o parâmetro url) ou a URL do jogo.
    const inner = u.hostname === "embed.gamedistribution.com" ? parseHttpsUrl(u.searchParams.get("url") ?? "") : u;
    if (!inner || inner.hostname !== "html5.gamedistribution.com" || !/^\/[0-9a-f]{32}\/?$/.test(inner.pathname)) {
      return { ok: false, error: "Use a URL do jogo no formato https://html5.gamedistribution.com/<id de 32 caracteres>/" };
    }
    return { ok: true, url: `https://html5.gamedistribution.com${inner.pathname.replace(/\/?$/, "/")}` };
  },
  embedSrc(game, ctx) {
    const p = new URLSearchParams({
      url: game.launch.url ?? "",
      width: "1280",
      height: "720",
      language: "pt",
      // Sem plataforma de consentimento (LGPD) configurada, desligamos rastreamento e segmentação.
      "gdpr-tracking": "0",
      "gdpr-targeting": "0",
      "gdpr-third-party": "0",
      gd_sdk_referrer_url: ctx.pageUrl,
    });
    return `https://embed.gamedistribution.com/?${p.toString()}`;
  },
  iframe: {
    sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-pointer-lock",
    allow: "autoplay; fullscreen; gamepad",
  },
};

/** Página oficial de um jogo/serviço em outro site, aberta em nova aba. */
export const externalAdapter: ProviderAdapter = {
  id: "external",
  name: "Site oficial do provedor",
  launchTypes: ["external_provider", "official_streaming"],
  frameOrigins: [],
  imageOrigins: [],
  requirements: ["Apenas link para a página oficial. Nada é incorporado no PH Cloud."],
  validateLaunchUrl(input, launchType) {
    if (launchType !== "external_provider" && launchType !== "official_streaming") {
      return { ok: false, error: "Links externos só podem abrir em nova aba." };
    }
    const u = parseHttpsUrl(input.trim());
    if (!u) return { ok: false, error: "Informe uma URL https válida." };
    return { ok: true, url: u.toString() };
  },
};

/**
 * Cloud gaming oficial (Xbox Cloud Gaming, GeForce NOW, Boosteroid). O jogo roda no serviço; o PH Cloud
 * guarda os links oficiais por serviço (campo streams), validados em modules/cloud-streaming/services.ts.
 */
export const cloudAdapter: ProviderAdapter = {
  id: "cloud",
  name: "Cloud gaming oficial",
  launchTypes: ["official_streaming"],
  frameOrigins: [],
  imageOrigins: [],
  requirements: [
    "Link oficial da página do jogo em cada serviço (xbox.com/pt-BR/play, play.geforcenow.com ou cloud.boosteroid.com).",
    "Nenhum desses serviços oferece API pública para incorporar o player: o jogo abre na página do serviço.",
  ],
  docsUrl: "https://github.com/NVIDIAGameWorks/GeForceNOW-SDK/blob/master/doc/GfnSdk-Deep-Linking.md",
  validateLaunchUrl: () => ({ ok: false, error: "Cadastre os links por serviço (Xbox, GeForce NOW, Boosteroid)." }),
};

export const ADAPTERS = [cloudAdapter, phcloudAdapter, itchioAdapter, gameDistributionAdapter, externalAdapter] as const;

export function getAdapter(id: string): ProviderAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}
