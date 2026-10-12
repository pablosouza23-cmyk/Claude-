"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appOrigin } from "@/config/env";
import { getPlan } from "@/config/plans";
import { getCurrentUser } from "@/server/auth/session";
import { getActiveSubscription } from "./entitlements";
import { createCheckoutUrl, createPortalUrl, isPlanPurchasable } from "./stripe";

async function origin() {
  const h = await headers();
  return appOrigin(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"));
}

export async function checkoutAction(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  const planId = String(form.get("plan") ?? "");
  if (!user) redirect(`/entrar?next=${encodeURIComponent("/planos")}`);
  const plan = getPlan(planId);
  if (plan.id !== planId || !isPlanPurchasable(plan)) redirect("/planos?status=indisponivel");
  if (await getActiveSubscription(user.id)) redirect("/planos?status=ja-assinante");
  let url: string;
  try {
    url = await createCheckoutUrl(user, plan, await origin());
  } catch (err) {
    console.error("[stripe] falha ao criar checkout:", (err as Error).message);
    redirect("/planos?status=erro");
  }
  redirect(url);
}

export async function portalAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/planos");
  let url: string | null = null;
  try {
    url = await createPortalUrl(user.id, await origin());
  } catch (err) {
    console.error("[stripe] falha ao abrir portal:", (err as Error).message);
  }
  redirect(url ?? "/planos?status=erro");
}
