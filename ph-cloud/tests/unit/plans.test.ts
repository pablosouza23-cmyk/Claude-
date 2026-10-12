import { test } from "node:test";
import assert from "node:assert/strict";
import { FREE_PLAN, PLANS, getPlan } from "@/config/plans";
import { DEFAULT_SETTINGS, inputSettingsSchema } from "@/modules/input/settings";

test("planos: ids únicos, gratuito a R$ 0 e pagos com preço no Stripe", () => {
  assert.equal(new Set(PLANS.map((p) => p.id)).size, PLANS.length);
  assert.equal(FREE_PLAN.displayPriceCents, 0);
  for (const p of PLANS.filter((p) => p.id !== "free")) assert.ok(p.stripePriceEnv, `${p.id} sem variável de preço`);
  assert.equal(getPlan("inexistente").id, "free");
});

test("preferências: padrão válido e valores fora da faixa são recusados", () => {
  assert.ok(inputSettingsSchema.safeParse(DEFAULT_SETTINGS).success);
  assert.ok(!inputSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, volume: 5 }).success);
  assert.ok(!inputSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, bindings: { a: ["<script>"] } }).success);
});
