import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ACTIVE_SUBSCRIPTION_STATUSES, FREE_PLAN, getPlan, PLANS, type Entitlements, type PlanDefinition } from "@/config/plans";
import { getDb, schema } from "@/server/db";
import type { Subscription } from "@/server/db/schema";
import type { SessionUser } from "@/server/auth/session";

export type UserPlan = {
  plan: PlanDefinition;
  subscription: Subscription | null;
  entitlements: Entitlements;
  /** Administradores recebem todos os benefícios para testar o site. */
  adminOverride: boolean;
};

export async function getLatestSubscription(userId: string): Promise<Subscription | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.userId, userId), inArray(schema.subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES])))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserPlan(user: SessionUser | null): Promise<UserPlan> {
  if (!user) return { plan: FREE_PLAN, subscription: null, entitlements: FREE_PLAN.entitlements, adminOverride: false };
  const subscription = await getActiveSubscription(user.id);
  const plan = subscription ? getPlan(subscription.planId) : FREE_PLAN;
  if (user.role === "admin") {
    const top = PLANS[PLANS.length - 1]!;
    return { plan, subscription, entitlements: top.entitlements, adminOverride: true };
  }
  return { plan, subscription, entitlements: plan.entitlements, adminOverride: false };
}
