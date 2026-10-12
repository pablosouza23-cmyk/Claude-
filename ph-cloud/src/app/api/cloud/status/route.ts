import { json } from "@/server/api";
import { checkBackend } from "@/modules/cloud-streaming/backend";

/* Status da estação própria (sem expor a URL interna de verificação). */
export async function GET() {
  const s = await checkBackend();
  if (s.state === "online") return json({ state: s.state, name: s.name, kind: s.kind, latencyMs: s.latencyMs });
  return json(s.state === "offline" ? { state: s.state, name: s.name, error: s.error } : { state: s.state });
}
