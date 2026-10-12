import "server-only";
import { env } from "@/config/env";

/*
 * Estação própria de streaming (ex.: Selkies-GStreamer ou Neko em um servidor com GPU).
 * O PH Cloud não cria hardware: só verifica se o backend configurado responde e abre o cliente web
 * oficial do backend dentro do player.
 */

export type BackendStatus =
  | { state: "not_configured" }
  | { state: "online"; name: string; kind: string; latencyMs: number; url: string; mic: boolean }
  | { state: "offline"; name: string; kind: string; error: string };

export async function checkBackend(): Promise<BackendStatus> {
  const e = env();
  if (!e.CLOUD_STREAM_URL) return { state: "not_configured" };
  const target = e.CLOUD_STREAM_HEALTH_URL ?? e.CLOUD_STREAM_URL;
  const started = Date.now();
  try {
    const res = await fetch(target, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(4000), redirect: "manual" });
    if (res.status >= 500) return { state: "offline", name: e.CLOUD_STREAM_NAME, kind: e.CLOUD_STREAM_KIND, error: `HTTP ${res.status}` };
    return { state: "online", name: e.CLOUD_STREAM_NAME, kind: e.CLOUD_STREAM_KIND, latencyMs: Date.now() - started, url: e.CLOUD_STREAM_URL, mic: e.CLOUD_STREAM_MIC };
  } catch (err) {
    return { state: "offline", name: e.CLOUD_STREAM_NAME, kind: e.CLOUD_STREAM_KIND, error: (err as Error).name === "TimeoutError" ? "sem resposta em 4 s" : "não foi possível conectar" };
  }
}
