import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/security/request";

/* Utilitários das rotas de API JSON. */

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (status: number, error: string) => json({ error }, status);

type Guarded<T> = { ok: true; user: SessionUser; body: T } | { ok: false; response: NextResponse };

/** Exige mesma origem (CSRF), sessão válida e corpo JSON no formato esperado. */
export async function guardMutation<T>(req: Request, schema: z.ZodType<T>): Promise<Guarded<T>> {
  if (!isSameOrigin(req)) return { ok: false, response: fail(403, "Origem não permitida.") };
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: fail(401, "Entre na sua conta para continuar.") };
  const body = await readJson(req, schema);
  if (!body.ok) return { ok: false, response: body.response };
  return { ok: true, user, body: body.data };
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 256 * 1024) return { ok: false, response: fail(413, "Conteúdo grande demais.") };
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 256 * 1024) return { ok: false, response: fail(413, "Conteúdo grande demais.") };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: fail(400, "JSON inválido.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: fail(400, parsed.error.issues[0]?.message ?? "Dados inválidos.") };
  return { ok: true, data: parsed.data };
}
