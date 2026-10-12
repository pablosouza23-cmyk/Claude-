import { env } from "@/config/env";
import { fail, json } from "@/server/api";
import { getStripe, handleStripeEvent } from "@/modules/subscriptions/stripe";

/* Webhook do Stripe. A assinatura do evento é verificada com STRIPE_WEBHOOK_SECRET sobre o corpo bruto. */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return fail(503, "Pagamentos não configurados.");
  const signature = req.headers.get("stripe-signature");
  if (!signature) return fail(400, "Assinatura ausente.");
  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return fail(400, "Assinatura do webhook inválida.");
  }
  try {
    const result = await handleStripeEvent(event);
    return json({ received: true, result });
  } catch (err) {
    console.error("[stripe] falha ao processar evento", event.id, err);
    return fail(500, "Falha ao processar o evento.");
  }
}
