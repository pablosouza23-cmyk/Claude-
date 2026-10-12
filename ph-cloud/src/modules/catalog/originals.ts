import type { GameRecord } from "./types";

/*
 * Jogos HTML5 próprios, servidos pelo próprio site (pasta games/) e integrados ao SDK do PH Cloud
 * (controles na tela, controle, volume, qualidade). Hoje só há uma demonstração, desativada por padrão.
 */

const OWNED = {
  status: "owned",
  note: "Jogo original do PH Cloud. Código e arte próprios; sem dependências de terceiros.",
} as const;

const SELF_RATED = { value: "L", source: "self" } as const;
const ALL_DEVICES: GameRecord["devices"] = ["mobile", "tablet", "desktop"];

export const ORIGINALS: GameRecord[] = [
  {
    id: "neon-drift",
    title: "Neon Drift",
    description: "Corrida noturna na estrada infinita: desvie do tráfego, pegue energia e use o turbo na hora certa.",
    longDescription:
      "Pilote pela via expressa de neon desviando de carros, colete células de energia para encher o turbo e veja até onde você chega. A velocidade aumenta com a distância.",
    coverUrl: "/covers/neon-drift.svg",
    genres: ["corrida", "arcade"],
    developer: "PH Cloud Originais",
    publisher: "PH Cloud",
    provider: "phcloud",
    launch: { type: "browser_game" },
    sdk: true,
    controls: {
      movement: "stick",
      buttons: [
        { id: "a", label: "Turbo" },
        { id: "b", label: "Frear" },
      ],
      touchOverlay: "recommended",
    },
    howToPlay: {
      keyboard: "Setas ou A/D para virar, Espaço para turbo, S ou Shift para frear, Enter para pausar.",
      gamepad: "Analógico esquerdo ou direcional para virar, A (✕) para turbo, B (○) para frear, Start para pausar.",
      touch: "Use o analógico na tela para virar e os botões Turbo e Frear. Também dá para tocar e segurar nas laterais da pista.",
      mouse: "Segure o botão do mouse no lado esquerdo ou direito da pista para virar.",
    },
    devices: ALL_DEVICES,
    inputs: ["touch", "keyboard", "mouse", "gamepad"],
    orientation: "any",
    pricing: "free",
    access: "free",
    license: OWNED,
    ageRating: SELF_RATED,
    availability: "available",
    limitations: [],
    // Oculto por padrão: o catálogo principal são os jogos de cloud gaming oficiais.
    // Serve como demonstração do SDK e do player; ative no painel administrativo se quiser.
    enabled: false,
    addedAt: "2026-10-12",
    releasedAt: "2026-10-12",
  },
];
