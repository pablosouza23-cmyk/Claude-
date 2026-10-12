"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/guards";
import { getDb, schema } from "@/server/db";
import { CLOUD_GAMES } from "@/modules/catalog/cloud-games";
import { ORIGINALS } from "@/modules/catalog/originals";
import { GENRES, type StreamOption, type StreamService } from "@/modules/catalog/types";
import { validateStreamUrl } from "@/modules/cloud-streaming/services";
import { getAdapter } from "@/modules/providers/adapters";
import { isProviderEnabled } from "@/modules/providers/registry";
import { notifyUser } from "@/modules/notifications/service";
import type { FormState } from "@/server/auth/actions";

const CODE_GAME_IDS = new Set([...CLOUD_GAMES, ...ORIGINALS].map((g) => g.id));

/** Liga/desliga, destaca ou muda o acesso de qualquer jogo (originais, de nuvem ou cadastrados). */
export async function setOverrideAction(form: FormData): Promise<void> {
  await requireAdmin();
  const gameId = String(form.get("gameId") ?? "");
  const field = String(form.get("field") ?? "");
  const value = String(form.get("value") ?? "");
  if (!gameId || gameId.length > 80) return;
  const db = await getDb();
  const patch: { enabled?: boolean; featured?: boolean; access?: "free" | "premium" } = {};
  if (field === "enabled") patch.enabled = value === "true";
  else if (field === "featured") patch.featured = value === "true";
  else if (field === "access" && (value === "free" || value === "premium")) patch.access = value;
  else return;
  await db
    .insert(schema.gameOverrides)
    .values({ gameId, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.gameOverrides.gameId, set: { ...patch, updatedAt: new Date() } });
  revalidatePath("/", "layout");
}

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "Identificador: só letras minúsculas, números e hífen (ex.: rocket-league).");

const ACCESS = ["free", "subscription", "owned", "subscription_or_owned"] as const;
const SERVICES: StreamService[] = ["xbox", "geforcenow", "boosteroid"];

const entrySchema = z.object({
  id: slug,
  title: z.string().trim().min(2, "Informe o título.").max(80),
  description: z.string().trim().min(10, "Escreva uma descrição curta (mínimo de 10 caracteres).").max(400),
  launchType: z.enum(["official_streaming", "authorized_embed", "external_provider"]),
  provider: z.string(),
  developer: z.string().trim().max(80).optional(),
  coverUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https:\/\//.test(v) || v.startsWith("/covers/"), "A capa precisa ser uma URL https ou um arquivo em /covers/."),
  genres: z.array(z.enum(Object.keys(GENRES) as [keyof typeof GENRES, ...(keyof typeof GENRES)[]])).min(1, "Escolha pelo menos um gênero."),
  inputs: z.array(z.enum(["touch", "keyboard", "mouse", "gamepad"])).min(1, "Escolha pelo menos uma forma de controle."),
  devices: z.array(z.enum(["mobile", "tablet", "desktop"])).min(1, "Escolha pelo menos um aparelho."),
  ageRating: z.string().trim().max(4).optional(),
  limitations: z.string().trim().max(1000).optional(),
  permissionNote: z.string().trim().min(5, "Registre de onde vem a permissão (ex.: link oficial público do serviço).").max(500),
});

/** Cadastra ou atualiza um jogo externo (nuvem oficial, incorporação autorizada ou link). */
export async function saveEntryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const launchType = String(form.get("launchType") ?? "");
  const parsed = entrySchema.safeParse({
    id: form.get("id"),
    title: form.get("title"),
    description: form.get("description"),
    launchType,
    provider: launchType === "official_streaming" ? "cloud" : String(form.get("provider") ?? ""),
    developer: form.get("developer") || undefined,
    coverUrl: form.get("coverUrl") || undefined,
    genres: form.getAll("genres"),
    inputs: form.getAll("inputs"),
    devices: form.getAll("devices"),
    ageRating: form.get("ageRating") || undefined,
    limitations: form.get("limitations") || undefined,
    permissionNote: form.get("permissionNote"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const editing = form.get("editing") === "1";
  if (CODE_GAME_IDS.has(d.id)) return { error: "Esse identificador já é usado por um jogo do código. Escolha outro." };

  let launchUrl = "";
  const streams: StreamOption[] = [];
  if (d.launchType === "official_streaming") {
    for (const sv of SERVICES) {
      const raw = String(form.get(`stream_${sv}_url`) ?? "").trim();
      if (!raw) continue;
      const check = validateStreamUrl(sv, raw);
      if (!check.ok) return { error: `${sv === "xbox" ? "Xbox" : sv === "geforcenow" ? "GeForce NOW" : "Boosteroid"}: ${check.error}` };
      const access = String(form.get(`stream_${sv}_access`) ?? "free");
      const note = String(form.get(`stream_${sv}_note`) ?? "").trim().slice(0, 240);
      streams.push({ service: sv, url: check.url, access: (ACCESS as readonly string[]).includes(access) ? (access as StreamOption["access"]) : "free", note: note || undefined });
    }
    if (streams.length === 0) return { error: "Informe o link oficial em pelo menos um serviço." };
  } else {
    const adapter = getAdapter(d.provider);
    if (!adapter || d.provider === "phcloud" || d.provider === "cloud") return { error: "Escolha o provedor." };
    if (!isProviderEnabled(d.provider)) return { error: `O provedor ${adapter.name} está desativado nas variáveis de ambiente.` };
    if (!adapter.launchTypes.includes(d.launchType)) return { error: `${adapter.name} não oferece esse tipo de lançamento.` };
    const check = adapter.validateLaunchUrl(String(form.get("launchUrl") ?? ""), d.launchType);
    if (!check.ok) return { error: check.error };
    launchUrl = check.url;
  }

  const db = await getDb();
  const values = {
    id: d.id,
    title: d.title,
    description: d.description,
    provider: d.provider,
    launchType: d.launchType,
    launchUrl,
    streams,
    coverUrl: d.coverUrl ?? null,
    developer: d.developer ?? null,
    genres: d.genres,
    inputs: d.inputs,
    devices: d.devices,
    orientation: "landscape",
    ageRating: d.ageRating ?? null,
    limitations: d.limitations ?? null,
    permissionNote: d.permissionNote,
    permissionConfirmedBy: admin.id,
    updatedAt: new Date(),
  };
  if (editing) {
    await db.update(schema.catalogEntries).set(values).where(eq(schema.catalogEntries.id, d.id));
  } else {
    const exists = await db.select({ id: schema.catalogEntries.id }).from(schema.catalogEntries).where(eq(schema.catalogEntries.id, d.id)).limit(1);
    if (exists[0]) return { error: "Já existe um jogo com esse identificador." };
    await db.insert(schema.catalogEntries).values(values);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: editing ? "Jogo atualizado." : "Jogo cadastrado. Ele já aparece no catálogo." };
}

export async function deleteEntryAction(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const db = await getDb();
  await db.delete(schema.catalogEntries).where(eq(schema.catalogEntries.id, id));
  await db.delete(schema.gameOverrides).where(eq(schema.gameOverrides.gameId, id));
  revalidatePath("/", "layout");
}

const noticeSchema = z.object({
  title: z.string().trim().min(3, "Informe o título.").max(80),
  body: z.string().trim().min(3, "Escreva a mensagem.").max(400),
  link: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || (v.startsWith("/") && !v.startsWith("//")), "O link precisa ser um caminho interno, como /jogos/fortnite."),
});

export async function postNoticeAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = noticeSchema.safeParse({ title: form.get("title"), body: form.get("body"), link: form.get("link") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await notifyUser(null, parsed.data.title, parsed.data.body, parsed.data.link);
  revalidatePath("/", "layout");
  return { ok: true, message: "Aviso publicado para todos." };
}
