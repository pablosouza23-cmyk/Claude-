/* Modelo de dados do catálogo. Seguro para cliente e servidor. */

export type LaunchType = "browser_game" | "authorized_embed" | "official_streaming" | "external_provider" | "unavailable";
export type InputMethod = "touch" | "keyboard" | "mouse" | "gamepad";
export type Device = "mobile" | "tablet" | "desktop";
export type Orientation = "landscape" | "portrait" | "any";
export type Availability = "available" | "coming_soon" | "maintenance" | "unavailable";
export type Access = "free" | "premium";
export type ProviderId = "phcloud" | "itchio" | "gamedistribution" | "external" | "cloud";

/** Serviços oficiais de cloud gaming para onde o PH Cloud leva o jogador (links oficiais). */
export type StreamService = "xbox" | "geforcenow" | "boosteroid";

export type StreamOption = {
  service: StreamService;
  /** Link oficial do jogo no serviço (validado por serviço). */
  url: string;
  /** O que a pessoa precisa para jogar por este serviço. */
  access: "free" | "subscription" | "owned" | "subscription_or_owned";
  /** Detalhe exibido ao jogador (ex.: "Requer Xbox Game Pass Ultimate"). */
  note?: string;
};

export const GENRES = {
  acao: "Ação",
  aventura: "Aventura",
  corrida: "Corrida",
  esportes: "Esportes",
  estrategia: "Estratégia",
  puzzle: "Puzzle",
  arcade: "Arcade",
  plataforma: "Plataforma",
  indie: "Indie",
  casual: "Casual",
} as const;
export type Genre = keyof typeof GENRES;

export const INPUT_LABELS: Record<InputMethod, string> = {
  touch: "Toque",
  keyboard: "Teclado",
  mouse: "Mouse",
  gamepad: "Controle",
};

export const DEVICE_LABELS: Record<Device, string> = {
  mobile: "Celular",
  tablet: "Tablet",
  desktop: "Computador",
};

export const LAUNCH_LABELS: Record<LaunchType, string> = {
  browser_game: "Jogo de navegador",
  authorized_embed: "Incorporação autorizada",
  official_streaming: "Streaming oficial",
  external_provider: "Site do provedor",
  unavailable: "Indisponível",
};

/** Ações do controle virtual do PH Cloud (protocolo de entrada). */
export type ButtonAction = "a" | "b" | "x" | "y" | "start";

export type ControlScheme = {
  /** Controle de movimento exibido no toque: analógico, direcional ou nenhum. */
  movement: "stick" | "dpad" | "none";
  /** O jogo usa o analógico direito (mira). */
  aim?: boolean;
  buttons: { id: ButtonAction; label: string }[];
  /** Quando os controles na tela aparecem por padrão no toque. */
  touchOverlay: "recommended" | "optional" | "none";
};

export type LicenseInfo = {
  status: "owned" | "provider_terms" | "developer_permission";
  note: string;
};

export type GameRecord = {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  coverUrl: string;
  backgroundUrl?: string;
  genres: Genre[];
  developer?: string;
  publisher?: string;
  provider: ProviderId;
  launch: {
    type: LaunchType;
    /** URL de incorporação ou página oficial (para tipos externos). */
    url?: string;
  };
  /** Recebe o protocolo de entrada do PH Cloud (controles na tela, controle, volume, qualidade). */
  sdk: boolean;
  /** Para jogos de cloud gaming: serviços oficiais onde o jogo pode ser jogado. */
  streams?: StreamOption[];
  controls?: ControlScheme;
  howToPlay?: Partial<Record<InputMethod, string>>;
  devices: Device[];
  inputs: InputMethod[];
  orientation: Orientation;
  multiplayer?: "local" | "online";
  pricing: "free" | "paid";
  access: Access;
  license: LicenseInfo;
  ageRating?: { value: string; source: "official" | "self" };
  availability: Availability;
  requiresExternalAccount?: string;
  limitations: string[];
  featured?: boolean;
  enabled: boolean;
  addedAt: string;
  releasedAt?: string;
};

/** Versão enviada ao navegador (sem campos internos). */
export type PublicGame = GameRecord & { popularity: number };

export function isLaunchable(g: Pick<GameRecord, "availability" | "launch" | "enabled"> & { streams?: StreamOption[] }): boolean {
  if (!g.enabled || g.availability !== "available" || g.launch.type === "unavailable") return false;
  if (g.launch.type === "official_streaming") return Boolean(g.streams?.length);
  return true;
}

export function isCloudGame(g: Pick<GameRecord, "launch">): boolean {
  return g.launch.type === "official_streaming";
}

export function hasFreeStream(g: { streams?: StreamOption[] }): boolean {
  return Boolean(g.streams?.some((s) => s.access === "free"));
}

/** O jogo abre dentro do player do PH Cloud (e não em outro site). */
export function playsInside(g: Pick<GameRecord, "launch">): boolean {
  return g.launch.type === "browser_game" || g.launch.type === "authorized_embed";
}
