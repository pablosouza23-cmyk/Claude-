import path from "node:path";

/* Resolução segura de arquivos dos jogos (pasta games/), sem permitir sair da pasta. */

export const GAMES_DIR = path.join(process.cwd(), "games");

/** Pastas compartilhadas por todos os jogos (SDK e utilitários). */
export const SHARED_DIRS = new Set(["_sdk"]);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
};

export function contentTypeFor(file: string): string | null {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? null;
}

/**
 * Valida os segmentos pedidos e devolve o caminho absoluto, ou null.
 * Regras: o primeiro segmento é o jogo autorizado pelo token ou uma pasta compartilhada;
 * nenhum segmento pode ser vazio, começar com ponto ou conter barras/caracteres estranhos.
 */
export function resolveGameFile(segments: string[], allowedGameId: string): string | null {
  if (segments.length < 2 || segments.length > 6) return null;
  const [root] = segments;
  if (root !== allowedGameId && !SHARED_DIRS.has(root!)) return null;
  for (const s of segments) {
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,80}$/.test(s) || s.includes("..")) return null;
  }
  const full = path.resolve(GAMES_DIR, ...segments);
  if (!full.startsWith(GAMES_DIR + path.sep)) return null;
  if (!contentTypeFor(full)) return null;
  return full;
}
