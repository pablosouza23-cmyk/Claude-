"use client";

/*
 * Biblioteca local (visitantes sem conta): favoritos e histórico ficam só neste navegador.
 * Ao entrar na conta, os dados são enviados para o servidor (veja /api/me/library/import).
 */

const FAV_KEY = "phc:favoritos";
const HIST_KEY = "phc:historico";
const EVENT = "phc:library-change";

export type LocalHistoryItem = { gameId: string; lastPlayedAt: string; seconds: number; count: number };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* armazenamento indisponível (modo privado, cota) */
  }
}

export const localLibrary = {
  favorites(): string[] {
    const v = read<unknown>(FAV_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  },
  isFavorite(id: string) {
    return this.favorites().includes(id);
  },
  setFavorite(id: string, on: boolean) {
    const list = this.favorites().filter((x) => x !== id);
    write(FAV_KEY, on ? [id, ...list] : list);
  },
  history(): LocalHistoryItem[] {
    const v = read<unknown>(HIST_KEY, []);
    return Array.isArray(v) ? (v as LocalHistoryItem[]).filter((x) => x && typeof x.gameId === "string").slice(0, 50) : [];
  },
  recordPlay(gameId: string, seconds: number) {
    const list = this.history();
    const prev = list.find((x) => x.gameId === gameId);
    const item: LocalHistoryItem = {
      gameId,
      lastPlayedAt: new Date().toISOString(),
      seconds: (prev?.seconds ?? 0) + Math.max(0, Math.round(seconds)),
      count: (prev?.count ?? 0) + (seconds === 0 ? 1 : 0),
    };
    write(HIST_KEY, [item, ...list.filter((x) => x.gameId !== gameId)].slice(0, 20));
  },
  clear() {
    write(FAV_KEY, []);
    write(HIST_KEY, []);
  },
  subscribe(fn: () => void) {
    const h = () => fn();
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  },
};
