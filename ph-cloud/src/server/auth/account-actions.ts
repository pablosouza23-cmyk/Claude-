"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isAvatarId } from "@/config/avatars";
import { getDb, schema } from "@/server/db";
import { cancelSubscriptionNow } from "@/modules/subscriptions/stripe";
import { getActiveSubscription } from "@/modules/subscriptions/entitlements";
import type { FormState } from "./actions";
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from "./password";
import { limiters } from "./rate-limit";
import { destroyCurrentSession, destroyOtherSessions, getSession } from "./session";

async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/entrar?next=/perfil");
  return s;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome (mínimo de 2 letras).").max(60, "Nome muito longo."),
  avatar: z.string().refine(isAvatarId, "Avatar inválido."),
});

export async function updateProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const parsed = profileSchema.safeParse({ name: form.get("name"), avatar: form.get("avatar") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = await getDb();
  await db.update(schema.users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil atualizado." };
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, sessionId } = await requireSession();
  if (!limiters.sensitive.hit(`pwd:${user.id}`).allowed) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) return { error: `A nova senha precisa ter entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres.` };
  const db = await getDb();
  const rows = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
  if (!rows[0] || !(await verifyPassword(current, rows[0].hash))) return { error: "A senha atual está incorreta." };
  await db.update(schema.users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  // Troca de senha encerra as outras sessões (ex.: um aparelho perdido).
  await destroyOtherSessions(user.id, sessionId);
  return { ok: true, message: "Senha alterada. As outras sessões foram encerradas." };
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const { user, sessionId } = await requireSession();
  await destroyOtherSessions(user.id, sessionId);
  revalidatePath("/perfil");
}

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  if (!limiters.sensitive.hit(`del:${user.id}`).allowed) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") return { error: 'Digite EXCLUIR para confirmar.' };
  const db = await getDb();
  const rows = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
  if (!rows[0] || !(await verifyPassword(String(form.get("password") ?? ""), rows[0].hash))) return { error: "Senha incorreta." };

  // Cancela a cobrança antes de apagar a conta, para não continuar cobrando.
  const sub = await getActiveSubscription(user.id);
  if (sub) {
    const cancelled = await cancelSubscriptionNow(sub.providerSubscriptionId);
    if (!cancelled) return { error: "Não foi possível cancelar sua assinatura agora. Cancele em Planos › Gerenciar assinatura e tente de novo." };
  }
  await destroyCurrentSession();
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  redirect("/?conta=excluida");
}
