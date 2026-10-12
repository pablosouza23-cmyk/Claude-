/*
 * Resultado da pesquisa de provedores (out/2026). Exibido no painel administrativo e em
 * docs/PROVEDORES.md. "integrated" = há adaptador no código; os demais NÃO estão conectados.
 */

export type CandidateStatus = "integrated" | "integrated_disabled" | "requires_partnership" | "not_permitted" | "unverified";

export type ProviderCandidate = {
  name: string;
  status: CandidateStatus;
  summary: string;
  source?: string;
};

export const PROVIDER_CANDIDATES: ProviderCandidate[] = [
  {
    name: "Xbox Cloud Gaming",
    status: "integrated",
    summary:
      "Sem API pública nem incorporação em outros sites (só parcerias fechadas com GeForce NOW, Boosteroid e fabricantes de TV). Integrado por links oficiais das páginas de jogo (xbox.com/pt-BR/play/games/…). Fortnite é grátis sem Game Pass; os demais exigem Game Pass ou compra.",
    source: "https://www.fortnite.com/mobile/xbox-cloud-gaming",
  },
  {
    name: "GeForce NOW (NVIDIA / ABYA no Brasil)",
    status: "integrated",
    summary:
      "Deep links oficiais documentados no GeForceNOW-SDK para sites e agregadores (play.geforcenow.com/games?game-id=…&utm_source=…). O jogo abre no player web da NVIDIA; o usuário precisa de conta NVIDIA e, nos jogos pagos, ter o jogo.",
    source: "https://github.com/NVIDIAGameWorks/GeForceNOW-SDK/blob/master/doc/GfnSdk-Deep-Linking.md",
  },
  {
    name: "Boosteroid",
    status: "integrated",
    summary: "Servidores no Brasil desde 2025. Sem API pública ou programa de incorporação encontrado; suportado como link oficial cadastrado pelo administrador.",
  },
  {
    name: "Blacknut (B2B)",
    status: "requires_partnership",
    summary:
      "Único caminho encontrado para jogos rodando dentro do próprio site: oferece white-label, SDK e API a operadoras e empresas de mídia (parceira no Brasil: Telecall). Exige contrato; catálogo com Ubisoft, Square Enix e títulos da Activision. GTA V e Fortnite não constam.",
    source: "https://www.blacknut.com",
  },
  {
    name: "Ubitus GameCloud (B2B)",
    status: "requires_partnership",
    summary: "Nuvem white-label para operadoras e editoras, por contrato corporativo. Sem documentação pública.",
  },
  {
    name: "Xsolla Cloud Gaming",
    status: "requires_partnership",
    summary: "Botão/iframe “Play Now” para o próprio publisher colocar o SEU jogo na nuvem. Não serve para exibir jogos de outras editoras.",
    source: "https://developers.xsolla.com/distribute-game/cloud-gaming/features/play-now-button/",
  },
  {
    name: "Amazon Luna",
    status: "not_permitted",
    summary: "Sem API pública e sem disponibilidade oficial no Brasil.",
  },
  {
    name: "Clientes não oficiais do Xbox (Greenlight, xbox-xcloud-player)",
    status: "not_permitted",
    summary:
      "Usam a API privada da Microsoft com a conta do próprio usuário. Não usados: violam os termos do serviço, expõem as contas dos usuários e quebram a cada atualização.",
  },
  {
    name: "Jogos de parceiros no próprio site (SDK do PH Cloud)",
    status: "integrated_disabled",
    summary: "Estrutura pronta para hospedar jogos HTML5 licenciados por parceiros, com controles na tela e controle via SDK. Nenhum jogo cadastrado.",
  },
  {
    name: "itch.io",
    status: "integrated_disabled",
    summary:
      "Incorporação oficial por jogo (embed-upload), gerada pelo criador. Sem catálogo público via API; cada jogo exige permissão do desenvolvedor. Ative com PROVIDER_ITCHIO_ENABLED=true.",
    source: "https://itch.io/docs/api/overview",
  },
  {
    name: "GameDistribution",
    status: "integrated_disabled",
    summary:
      "Formato oficial de iframe publicado pelo provedor. Exige conta de publisher e aceite dos termos; jogos com anúncios do provedor. Ative com PROVIDER_GAMEDISTRIBUTION_ENABLED=true.",
    source: "https://github.com/GameDistribution/gd-embed-game",
  },
  {
    name: "Google GameSnacks (Partner API)",
    status: "requires_partnership",
    summary:
      "API oficial para parceiros de distribuição (gamesnackspartner.googleapis.com). Acesso só para parceiros aprovados pelo Google; o esquema de resposta não pôde ser lido daqui, então nenhum código foi escrito contra ele.",
    source: "https://developers.google.com/gamesnacks/partner",
  },
  {
    name: "Playgama Partners",
    status: "unverified",
    summary:
      "Programa de parceiros com widget e API de exportação (segundo o blog do próprio provedor). A documentação primária não pôde ser acessada; adaptador não implementado para não inventar endpoints.",
  },
  {
    name: "GamePix / GameMonetize",
    status: "unverified",
    summary: "Programas de distribuição com feed para publishers. Documentação e termos não estavam acessíveis; não integrados.",
  },
  {
    name: "Yandex Games (distribuição)",
    status: "requires_partnership",
    summary: "Catálogo em JSON mediante chave de API solicitada ao provedor. Não integrado.",
  },
  {
    name: "CrazyGames",
    status: "not_permitted",
    summary:
      "O SDK é para desenvolvedores publicarem na própria CrazyGames. Não foi encontrado programa público para incorporar o catálogo em outros sites.",
  },
  {
    name: "Poki",
    status: "not_permitted",
    summary: "Prefere acordos de exclusividade na web com os desenvolvedores. Sem programa de incorporação para terceiros.",
    source: "https://sdk.poki.com/deals",
  },
];
