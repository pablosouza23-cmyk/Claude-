import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { env, isCloudConfigured, isStripeConfigured } from "@/config/env";
import { PLANS, type PlanDefinition, type PlanId } from "@/config/plans";
import { getDb, schema } from "@/server/db";
import { notifyUser } from "@/modules/notifications/service";

/*
 * Cobrança recorrente com Stripe Checkout (modo assinatura) + Portal do cliente + webhooks.
 * Os meios de pagamento (cartão, Pix Automático etc.) seguem o que estiver ativado no painel do
 * Stripe: não fixamos payment_method_types aqui.
 */

const g = globalThis as unknown as { __phcStripe?: Stripe; __phcPriceCache?: { at: number; data: Map<PlanId, PlanPrice> } };

export type PlanPrice = { amountCents: number; currency: string; interval: string };

export function getStripe(): Stripe | null {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) return null;
  g.__phcStripe ??= new Stripe(key, { appInfo: { name: "PH Cloud" }, maxNetworkRetries: 2 });
  return g.__phcStripe;
}

export function priceIdFor(plan: PlanDefinition): string | undefined {
  return plan.stripePriceEnv ? env()[plan.stripePriceEnv] : undefined;
}

export function planForPriceId(priceId: string | undefined | null): PlanDefinition | undefined {
  if (!priceId) return undefined;
  return PLANS.find((p) => priceIdFor(p) === priceId);
}

/** Planos que podem ser exibidos: o Ultimate só existe se houver backend de Cloud Play. */
export function visiblePlans(): PlanDefinition[] {
  return PLANS.filter((p) => p.requires !== "cloud" || isCloudConfigured());
}

/** O plano pode ser assinado agora? (Stripe configurado e preço definido.) */
export function isPlanPurchasable(plan: PlanDefinition): boolean {
  return plan.id !== "free" && isStripeConfigured() && Boolean(priceIdFor(plan));
}

/** Preços lidos do próprio Stripe (cache de 10 minutos), para exibir exatamente o valor cobrado. */
export async function getStripePrices(): Promise<Map<PlanId, PlanPrice>> {
  const stripe = getStripe();
  if (!stripe) return new Map();
  if (g.__phcPriceCache && Date.now() - g.__phcPriceCache.at < 10 * 60_000) return g.__phcPriceCache.data;
  const data = new Map<PlanId, PlanPrice>();
  await Promise.all(
    PLANS.map(async (plan) => {
      const id = priceIdFor(plan);
      if (!id) return;
      try {
        const price = await stripe.prices.retrieve(id);
        if (price.unit_amount != null) {
          data.set(plan.id, { amountCents: price.unit_amount, currency: price.currency, interval: price.recurring?.interval ?? "month" });
        }
      } catch (err) {
        console.error(`[stripe] não foi possível ler o preço ${id}:`, (err as Error).message);
      }
    }),
  );
  g.__phcPriceCache = { at: Date.now(), data };
  return data;
}

async function ensureCustomer(stripe: Stripe, user: { id: string; email: string; name: string }): Promise<string> {
  const db = await getDb();
  const rows = await db.select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, user.id)).limit(1);
  if (rows[0]) return rows[0].providerCustomerId;
  const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
  await db.insert(schema.billingCustomers).values({ userId: user.id, providerCustomerId: customer.id }).onConflictDoNothing();
  const again = await db.select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, user.id)).limit(1);
  return again[0]?.providerCustomerId ?? customer.id;
}

export async function createCheckoutUrl(user: { id: string; email: string; name: string }, plan: PlanDefinition, origin: string): Promise<string> {
  const stripe = getStripe();
  const price = priceIdFor(plan);
  if (!stripe || !price) throw new Error("Pagamentos não configurados.");
  const customer = await ensureCustomer(stripe, user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, planId: plan.id },
    subscription_data: { metadata: { userId: user.id, planId: plan.id } },
    locale: "pt-BR",
    allow_promotion_codes: true,
    success_url: `${origin}/planos?status=sucesso`,
    cancel_url: `${origin}/planos?status=cancelado`,
  });
  if (!session.url) throw new Error("O Stripe não retornou a URL de pagamento.");
  return session.url;
}

export async function createPortalUrl(userId: string, origin: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const db = await getDb();
  const rows = await db.select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, userId)).limit(1);
  if (!rows[0]) return null;
  const portal = await stripe.billingPortal.sessions.create({ customer: rows[0].providerCustomerId, return_url: `${origin}/planos`, locale: "pt-BR" });
  return portal.url;
}

/** Cancela imediatamente (usado ao excluir a conta). */
export async function cancelSubscriptionNow(subscriptionId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    // Já cancelada no Stripe: pode seguir.
    return code === "resource_missing";
  }
}

const customerIdOf = (c: string | Stripe.Customer | Stripe.DeletedCustomer) => (typeof c === "string" ? c : c.id);

/** Grava/atualiza a assinatura local a partir do objeto do Stripe. */
export async function syncSubscription(sub: Stripe.Subscription): Promise<{ userId: string; planId: string; status: string } | null> {
  const db = await getDb();
  const item = sub.items.data[0];
  const plan = planForPriceId(item?.price.id) ?? PLANS.find((p) => p.id === sub.metadata?.planId);
  let userId = sub.metadata?.userId;
  if (!userId) {
    const rows = await db.select().from(schema.billingCustomers).where(eq(schema.billingCustomers.providerCustomerId, customerIdOf(sub.customer))).limit(1);
    userId = rows[0]?.userId;
  }
  if (!userId || !plan) {
    console.error(`[stripe] assinatura ${sub.id} sem usuário ou plano reconhecido.`);
    return null;
  }
  const exists = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!exists[0]) return null;
  const values = {
    userId,
    provider: "stripe",
    providerCustomerId: customerIdOf(sub.customer),
    providerSubscriptionId: sub.id,
    planId: plan.id,
    status: sub.status,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: schema.subscriptions.providerSubscriptionId, set: values });
  return { userId, planId: plan.id, status: sub.status };
}

/** Processa um webhook já verificado. Cada evento é aplicado uma única vez. */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  const db = await getDb();
  const inserted = await db.insert(schema.billingEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: schema.billingEvents.id });
  if (inserted.length === 0) return "duplicate";
  const stripe = getStripe()!;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) return "ignored";
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const res = await syncSubscription(await stripe.subscriptions.retrieve(subId));
        if (res && (res.status === "active" || res.status === "trialing")) {
          const plan = PLANS.find((p) => p.id === res.planId);
          await notifyUser(res.userId, `Plano ${plan?.name ?? ""} ativado`, "Obrigado por assinar o PH Cloud! Seus benefícios já estão liberados.", "/planos");
        }
        return "processed";
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        // Busca a versão atual: eventos podem chegar fora de ordem.
        const current = await stripe.subscriptions.retrieve(event.data.object.id);
        const res = await syncSubscription(current);
        if (res && event.type === "customer.subscription.deleted") {
          await notifyUser(res.userId, "Assinatura encerrada", "Sua assinatura terminou. Você continua com o plano Gratuito.", "/planos");
        }
        return "processed";
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customer = invoice.customer ? customerIdOf(invoice.customer) : null;
        if (!customer) return "ignored";
        const rows = await db.select().from(schema.billingCustomers).where(eq(schema.billingCustomers.providerCustomerId, customer)).limit(1);
        if (rows[0]) {
          await notifyUser(rows[0].userId, "Pagamento não aprovado", "Não conseguimos cobrar sua assinatura. Atualize a forma de pagamento para manter os benefícios.", "/planos");
        }
        return "processed";
      }
      default:
        return "ignored";
    }
  } catch (err) {
    // Libera o evento para o Stripe reenviar.
    await db.delete(schema.billingEvents).where(eq(schema.billingEvents.id, event.id));
    throw err;
  }
}
