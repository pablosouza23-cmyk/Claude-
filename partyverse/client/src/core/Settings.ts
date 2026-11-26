/** Preferências locais do jogador (por dispositivo). */
export type Quality = 'low' | 'medium' | 'high';

export interface SettingsData {
  quality: Quality;
  autoResolution: boolean;
  renderScale: number; // 0.5..1
  sensitivity: number; // 0.2..3
  invertY: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  showFps: boolean;
  uiScale: number;
  keys: Record<string, string>;
  touchControls: 'auto' | 'on' | 'off';
}

export const DEFAULT_KEYS: Record<string, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft', interact: 'KeyE', action: 'KeyF', emote: 'KeyG', chat: 'Enter', map: 'KeyM',
};

export const KEY_LABELS: Record<string, string> = {
  forward: 'Frente', back: 'Trás', left: 'Esquerda', right: 'Direita', jump: 'Pular', sprint: 'Correr',
  interact: 'Interagir', action: 'Ação do minigame', emote: 'Acenar', chat: 'Chat', map: 'Mapa',
};

function detectQuality(): Quality {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  if (mobile) return mem >= 6 ? 'medium' : 'low';
  return 'high';
}

const KEY = 'pv.settings.v1';

class SettingsStore {
  data: SettingsData;
  private subs = new Set<(d: SettingsData) => void>();
  constructor() {
    let saved: Partial<SettingsData> = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* */ }
    this.data = {
      quality: detectQuality(), autoResolution: true, renderScale: 1, sensitivity: 1, invertY: false,
      masterVolume: 0.8, musicVolume: 0.45, sfxVolume: 0.9, showFps: false, uiScale: 1, touchControls: 'auto',
      ...saved,
      keys: { ...DEFAULT_KEYS, ...(saved.keys ?? {}) },
    };
  }
  set<K extends keyof SettingsData>(k: K, v: SettingsData[K]): void {
    this.data[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* */ }
    for (const s of this.subs) s(this.data);
  }
  on(fn: (d: SettingsData) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
}

export const settings = new SettingsStore();

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
export const useTouch = () => settings.data.touchControls === 'on' || (settings.data.touchControls === 'auto' && isTouchDevice());
