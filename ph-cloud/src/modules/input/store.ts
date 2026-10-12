"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, inputSettingsSchema, type InputSettings } from "./settings";

/*
 * Preferências no navegador (localStorage). Com sessão iniciada, alterações também são enviadas
 * para a conta (PUT /api/me/settings) e baixadas ao abrir o site em outro aparelho.
 */

const KEY = "phc:config";
const listeners = new Set<() => void>();
let state: InputSettings = DEFAULT_SETTINGS;
let loaded = false;
let loggedIn = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function load(): InputSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = inputSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = load();
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = load();
    listeners.forEach((l) => l());
  });
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* modo privado ou cota cheia: segue só em memória */
  }
}

function schedulePush() {
  if (!loggedIn) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    fetch("/api/me/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) }).catch(() => {});
  }, 800);
}

export function getSettings(): InputSettings {
  ensureLoaded();
  return state;
}

export function updateSettings(patch: Partial<InputSettings>) {
  ensureLoaded();
  const parsed = inputSettingsSchema.safeParse({ ...state, ...patch });
  if (!parsed.success) return;
  state = parsed.data;
  persist();
  listeners.forEach((l) => l());
  schedulePush();
}

export function resetSettings() {
  ensureLoaded();
  state = DEFAULT_SETTINGS;
  persist();
  listeners.forEach((l) => l());
  schedulePush();
}

/** Chamado uma vez quando há sessão: baixa as preferências da conta, se existirem. */
export async function attachAccount() {
  if (loggedIn) return;
  loggedIn = true;
  try {
    const res = await fetch("/api/me/settings", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { settings: unknown; updatedAt: string | null };
    if (data.settings && data.updatedAt) {
      const parsed = inputSettingsSchema.safeParse(data.settings);
      if (parsed.success) {
        ensureLoaded();
        state = parsed.data;
        persist();
        listeners.forEach((l) => l());
      }
    } else {
      schedulePush(); // primeira vez nesta conta: envia as preferências locais
    }
  } catch {
    /* sem rede: segue com as preferências locais */
  }
}

function subscribe(fn: () => void) {
  ensureLoaded();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): InputSettings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}
