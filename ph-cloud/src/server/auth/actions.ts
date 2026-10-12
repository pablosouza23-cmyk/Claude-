"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminEmails } from "@/config/env";
import { getDb, schema } from "@/server/db";
import { clientIp, ipKey } from "@/server/security/request";
import { getDummyHash, hashPassword, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from "./password";
import { limiters } from "./rate-limit";
import { createSession } from "./session";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string };

/** Só aceita caminhos internos como destino após o login. */
export async function safeNext(raw: FormDataEntryValue | null | undefined): Promise<string> {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`)
  .max(PASSWORD_MAX, `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`);

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome (mínimo de 2 letras).").max(60, "Nome muito longo."),
  email: emailSchema,
  password: passwordSchema,
  terms: z.literal("on", { error: "É preciso aceitar os Termos de uso e a Política de privacidade." }),
});

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const limit = limiters.register.hit(`reg:${ipKey(await clientIp())}`);
  if (!limit.allowed) return { error: "Muitos cadastros a partir desta rede. Tente novamente mais tarde." };

  const parsed = registerSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
    terms: form.get("terms"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { name, email, password } = parsed.data;

  const db = await getDb();
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(sql`lower(${schema.users.email})`, email)).limit(1);
  if (existing.length) return { fieldErrors: { email: "Já existe uma conta com este e-mail. Tente entrar." } };

  const passwordHash = await hashPassword(password);
  const role = adminEmails().has(email) ? "admin" : "user";
  let userId: string;
  try {
    const rows = await db.insert(schema.users).values({ name, email, passwordHash, role }).returning({ id: schema.users.id });
    userId = rows[0]!.id;
  } catch {
    // Corrida entre dois cadastros com o mesmo e-mail: o índice único barra o segundo.
    return { fieldErrors: { email: "Já existe uma conta com este e-mail. Tente entrar." } };
  }
  await db.insert(schema.userSettings).values({ userId }).onConflictDoNothing();
  await createSession(userId);
  redirect(await safeNext(form.get("next")));
}

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Informe a senha.").max(PASSWORD_MAX) });

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  const ip = ipKey(await clientIp());
  const byIp = limiters.loginIp.hit(`ip:${ip}`);
  const byAccount = limiters.loginAccount.hit(`acc:${email}`);
  if (!byIp.allowed || !byAccount.allowed) {
    const wait = Math.ceil(Math.max(byIp.retryAfterSeconds, byAccount.retryAfterSeconds) / 60);
    return { error: `Muitas tentativas. Aguarde ${wait} min e tente de novo.` };
  }

  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash, role: schema.users.role })
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.email})`, email))
    .limit(1);
  const user = rows[0];
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) return { error: "E-mail ou senha incorretos." };

  limiters.loginAccount.reset(`acc:${email}`);
  // Promove a administrador quem estiver em ADMIN_EMAILS (nunca rebaixa automaticamente).
  if (user.role !== "admin" && adminEmails().has(email)) {
    await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, user.id));
  }
  await createSession(user.id);
  redirect(await safeNext(form.get("next")));
}
