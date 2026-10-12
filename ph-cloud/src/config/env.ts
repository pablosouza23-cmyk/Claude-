import "server-only";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/*
 * Configuração do servidor. Tudo vem de variáveis de ambiente (veja .env.example).
 * Nada aqui pode ser importado por componentes de cliente.
 */

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim().replace(/\/+$/, "") : undefined))
  .refine((v) => v === undefined || /^https?:\/\//.test(v), "precisa começar com http:// ou https://");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: optionalUrl,
  DATABASE_URL: z.string().optional().transform((v) => v?.trim() || undefined),
  PGLITE_DATA_DIR: z.string().default(".data/pglite"),
  APP_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().default(""),
  SUPPORT_EMAIL: z.string().optional().transform((v) => v?.trim() || undefined),

  STRIPE_SECRET_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
  STRIPE_WEBHOOK_SECRET: z.string().optional().transform((v) => v?.trim() || undefined),
  STRIPE_PRICE_PLUS_MONTHLY: z.string().optional().transform((v) => v?.trim() || undefined),
  STRIPE_PRICE_ULTIMATE_MONTHLY: z.string().optional().transform((v) => v?.trim() || undefined),

  PROVIDER_ITCHIO_ENABLED: bool,
  PROVIDER_GAMEDISTRIBUTION_ENABLED: bool,

  GAMES_ORIGIN: optionalUrl,

  CLOUD_STREAM_URL: optionalUrl,
  CLOUD_STREAM_HEALTH_URL: optionalUrl,
  CLOUD_STREAM_KIND: z.enum(["selkies", "neko", "generic"]).default("generic"),
  CLOUD_STREAM_NAME: z.string().default("Estação PH Cloud"),
  CLOUD_STREAM_MIC: bool,
});

export type ServerEnv = z.infer<typeof schema> & { appSecret: string; appSecretIsEphemeral: boolean };

const g = globalThis as unknown as { __phcEnv?: ServerEnv };

/** Desenvolvimento sem APP_SECRET: guarda um segredo local em .data/ para sobreviver a reinícios. */
function devSecret(): string {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "dev-secret");
  try {
    if (existsSync(file)) {
      const s = readFileSync(file, "utf8").trim();
      if (s.length >= 32) return s;
    }
    mkdirSync(dir, { recursive: true });
    const s = randomBytes(48).toString("base64url");
    writeFileSync(file, s, { mode: 0o600 });
    return s;
  } catch {
    return randomBytes(48).toString("base64url");
  }
}

export function env(): ServerEnv {
  if (g.__phcEnv) return g.__phcEnv;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida: ${issues}`);
  }
  const e = parsed.data;
  let appSecret = e.APP_SECRET?.trim() ?? "";
  let appSecretIsEphemeral = false;
  if (appSecret.length < 32) {
    if (e.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("APP_SECRET é obrigatório em produção (mínimo de 32 caracteres).");
    }
    appSecret = devSecret();
    appSecretIsEphemeral = true;
  }
  g.__phcEnv = { ...e, appSecret, appSecretIsEphemeral };
  return g.__phcEnv;
}

export function adminEmails(): Set<string> {
  return new Set(
    env()
      .ADMIN_EMAILS.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isStripeConfigured(): boolean {
  const e = env();
  return Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET);
}

export function isCloudConfigured(): boolean {
  return Boolean(env().CLOUD_STREAM_URL);
}

/** Origem pública do site. Usa APP_URL quando definido; senão, o host da requisição. */
export function appOrigin(requestHost?: string | null, proto?: string | null): string {
  const e = env();
  if (e.APP_URL) return new URL(e.APP_URL).origin;
  if (requestHost) return `${proto === "https" ? "https" : "http"}://${requestHost}`;
  return "http://localhost:3000";
}

export function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
