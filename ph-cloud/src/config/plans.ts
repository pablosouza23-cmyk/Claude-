/*
 * Planos de assinatura — fonte única de preços exibidos, benefícios e limites.
 *
 * O valor COBRADO é sempre o do preço configurado no Stripe (STRIPE_PRICE_*); quando o Stripe
 * está configurado, a página de planos exibe o valor lido do próprio Stripe. `displayPriceCents`
 * só é usado enquanto os pagamentos não estão ativos, e deve ser mantido igual ao preço do Stripe.
 */

export type PlanId = "free" | "plus" | "ultimate";

export type Entitlements = {
  /** Pode abrir jogos marcados como "premium" no catálogo. */
  premiumGames: boolean;
  /** Salvamentos de jogo e preferências sincronizados na conta (entre aparelhos). */
  cloudSaves: boolean;
  /** Minutos mensais no Cloud Play (backend de streaming próprio). 0 = sem acesso. */
  cloudPlayMinutesPerMonth: number;
  /** Quantos jogos ficam no histórico "Continuar jogando". */
  historyLimit: number;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  displayPriceCents: number;
  interval: "month";
  /** Variável de ambiente com o ID do preço no Stripe (price_...). */
  stripePriceEnv?: "STRIPE_PRICE_PLUS_MONTHLY" | "STRIPE_PRICE_ULTIMATE_MONTHLY";
  /** O plano só aparece se o recurso existir de verdade. */
  requires?: "cloud";
  highlight?: boolean;
  benefits: string[];
  entitlements: Entitlements;
};

export const PLANS: readonly PlanDefinition[] = [
  {
    id: "free",
    name: "Gratuito",
    description: "Para jogar no navegador sem pagar nada.",
    displayPriceCents: 0,
    interval: "month",
    benefits: [
      "Catálogo completo com links oficiais para jogar na nuvem",
      "Favoritos e histórico dos últimos 20 jogos",
      "Preferências de controle salvas na conta",
      "Teste de controle Bluetooth/USB",
    ],
    entitlements: { premiumGames: false, cloudSaves: false, cloudPlayMinutesPerMonth: 0, historyLimit: 20 },
  },
  {
    id: "plus",
    name: "Plus",
    description: "Histórico completo e benefícios dos jogos que rodam dentro do PH Cloud.",
    displayPriceCents: 1490,
    interval: "month",
    stripePriceEnv: "STRIPE_PRICE_PLUS_MONTHLY",
    highlight: true,
    benefits: [
      "Tudo do plano Gratuito",
      "Histórico completo de jogos",
      "Jogos marcados como premium no catálogo, quando houver",
      "Salvamento na nuvem nos jogos que rodam dentro do PH Cloud",
    ],
    entitlements: { premiumGames: true, cloudSaves: true, cloudPlayMinutesPerMonth: 0, historyLimit: 500 },
  },
  {
    id: "ultimate",
    name: "Ultimate",
    description: "Inclui sessões no Cloud Play, rodando em servidor remoto.",
    displayPriceCents: 3990,
    interval: "month",
    stripePriceEnv: "STRIPE_PRICE_ULTIMATE_MONTHLY",
    requires: "cloud",
    benefits: [
      "Tudo do plano Plus",
      "Cloud Play: 10 horas por mês em servidor remoto",
      "Jogue títulos de PC pelo navegador, conforme o catálogo do servidor",
    ],
    entitlements: { premiumGames: true, cloudSaves: true, cloudPlayMinutesPerMonth: 600, historyLimit: 500 },
  },
];

export const FREE_PLAN = PLANS[0]!;

export function getPlan(id: string | null | undefined): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? FREE_PLAN;
}

/** Status de assinatura que dão direito aos benefícios. */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
