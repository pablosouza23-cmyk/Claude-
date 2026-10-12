import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { isStripeConfigured } from "@/config/env";
import { formatBRL, formatDate } from "@/config/site";
import { getCurrentUser } from "@/server/auth/session";
import { getUserPlan } from "@/modules/subscriptions/entitlements";
import { getStripePrices, isPlanPurchasable, visiblePlans } from "@/modules/subscriptions/stripe";
import { checkoutAction, portalAction } from "@/modules/subscriptions/actions";

export const metadata: Metadata = { title: "Planos", description: "Planos do PH Cloud em reais. Comece grátis." };

const STATUS: Record<string, { kind: "success" | "warning" | "danger"; text: string }> = {
  sucesso: { kind: "success", text: "Pagamento recebido! Assim que o Stripe confirmar, seu plano é ativado — você receberá uma notificação." },
  cancelado: { kind: "warning", text: "Pagamento cancelado. Nada foi cobrado." },
  indisponivel: { kind: "warning", text: "Este plano não está disponível para assinatura no momento." },
  "ja-assinante": { kind: "warning", text: "Você já tem uma assinatura ativa. Use “Gerenciar assinatura” para trocar de plano." },
  erro: { kind: "danger", text: "Não foi possível falar com o sistema de pagamentos. Tente de novo em instantes." },
  limite: { kind: "warning", text: "Você usou todos os minutos de Cloud Play do mês. Eles renovam no início do próximo mês." },
};

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const user = await getCurrentUser();
  const [current, prices] = await Promise.all([getUserPlan(user), getStripePrices()]);
  const payments = isStripeConfigured();
  const plans = visiblePlans();
  const notice = status ? STATUS[status] : undefined;

  return (
    <div className="shell py-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Planos</p>
        <h1 className="mt-2 text-3xl font-bold md:text-5xl">Comece grátis</h1>
        <p className="mt-3 text-muted">Preços em reais, cobrança mensal e cancelamento quando quiser.</p>
      </div>

      {notice && (
        <p role="status" className={`notice notice-${notice.kind} mx-auto mt-8 max-w-2xl`}>
          {notice.text}
        </p>
      )}

      <div className="notice notice-info mx-auto mt-8 max-w-3xl">
        <strong>Importante:</strong> os planos do PH Cloud não incluem Xbox Game Pass, GeForce NOW nem outros serviços de nuvem. Jogos como GTA V e EA SPORTS FC
        exigem a assinatura do próprio serviço, contratada diretamente com ele.
      </div>

      <div className={`mx-auto mt-10 grid max-w-5xl gap-5 ${plans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {plans.map((plan) => {
          const stripePrice = prices.get(plan.id);
          const cents = stripePrice?.amountCents ?? plan.displayPriceCents;
          const isCurrent = Boolean(user) && current.plan.id === plan.id && (plan.id === "free" ? !current.subscription : Boolean(current.subscription));
          const purchasable = isPlanPurchasable(plan);
          return (
            <section
              key={plan.id}
              aria-labelledby={`plano-${plan.id}`}
              className={`card relative flex flex-col p-6 ${plan.highlight ? "border-accent/50 shadow-[var(--shadow-glow)]" : ""}`}
            >
              {plan.highlight && <span className="chip chip-accent absolute -top-3 left-6">Mais escolhido</span>}
              <h2 id={`plano-${plan.id}`} className="text-xl font-bold">
                {plan.name}
              </h2>
              <p className="mt-1 text-sm text-muted">{plan.description}</p>
              <p className="mt-5">
                <span className="font-display text-4xl font-bold">{cents === 0 ? "R$ 0" : formatBRL(cents)}</span>
                {cents > 0 && <span className="text-muted">/mês</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  current.subscription ? (
                    <form action={portalAction}>
                      <button className="btn btn-secondary w-full">Gerenciar assinatura</button>
                      {current.subscription.currentPeriodEnd && (
                        <p className="mt-2 text-center text-xs text-muted">
                          {current.subscription.cancelAtPeriodEnd ? "Termina em " : "Renova em "}
                          {formatDate(current.subscription.currentPeriodEnd)}
                        </p>
                      )}
                    </form>
                  ) : (
                    <span className="btn btn-secondary w-full" aria-disabled="true">
                      Seu plano atual
                    </span>
                  )
                ) : plan.id === "free" ? (
                  user ? null : (
                    <Link href="/cadastrar" className="btn btn-secondary w-full">
                      Criar conta grátis
                    </Link>
                  )
                ) : purchasable ? (
                  <form action={checkoutAction}>
                    <input type="hidden" name="plan" value={plan.id} />
                    <button className={`btn w-full ${plan.highlight ? "btn-primary" : "btn-secondary"}`}>{user ? `Assinar ${plan.name}` : "Entrar para assinar"}</button>
                  </form>
                ) : (
                  <>
                    <span className="btn btn-secondary w-full" aria-disabled="true">
                      Assinaturas em breve
                    </span>
                    <p className="mt-2 text-center text-xs text-muted">Os pagamentos ainda não foram ativados neste site.</p>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-3xl space-y-2 text-center text-xs text-faint">
        {payments ? (
          <p>Pagamento processado pelo Stripe. Os meios disponíveis (cartão, Pix etc.) aparecem na tela de pagamento. O PH Cloud não armazena dados de cartão.</p>
        ) : (
          <p>Valores de referência: o preço final aparece na tela de pagamento quando as assinaturas forem ativadas.</p>
        )}
        <p>
          Dúvidas? Veja a <Link href="/ajuda#planos" className="text-accent hover:underline">Central de ajuda</Link>.
        </p>
      </div>
    </div>
  );
}
