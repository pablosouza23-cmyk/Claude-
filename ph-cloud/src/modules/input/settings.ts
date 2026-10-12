import { z } from "zod";

/* Preferências de entrada, áudio e vídeo. Validadas igual no navegador e no servidor. */

export const ACTIONS = ["up", "down", "left", "right", "a", "b", "x", "y", "start"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  up: "Cima",
  down: "Baixo",
  left: "Esquerda",
  right: "Direita",
  a: "Botão A / ✕",
  b: "Botão B / ○",
  x: "Botão X / □",
  y: "Botão Y / △",
  start: "Start / Pausa",
};

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  a: ["Space", "KeyJ"],
  b: ["ShiftLeft", "KeyK"],
  x: ["KeyL"],
  y: ["KeyI"],
  start: ["Enter", "KeyP"],
};

/** Teclas que o navegador ou o sistema reservam e que não aceitamos como atalho. */
export const RESERVED_CODES = new Set(["Escape", "F5", "F11", "F12", "Tab", "MetaLeft", "MetaRight", "ContextMenu"]);

const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const code = z.string().regex(/^[A-Za-z0-9]{1,24}$/);

export const inputSettingsSchema = z.object({
  method: z.enum(["auto", "touch", "keyboard", "gamepad"]).default("auto"),
  sensitivity: z.number().min(0.2).max(3).default(1),
  buttonScale: z.number().min(0.7).max(1.5).default(1),
  opacity: z.number().min(0.2).max(1).default(0.6),
  vibration: z.boolean().default(true),
  layout: z.enum(["default", "lefty", "compact"]).default("default"),
  positions: z.object({ stick: point.optional(), buttons: point.optional() }).default({}),
  touchControls: z.enum(["auto", "always", "never"]).default("auto"),
  bindings: z
    .record(z.enum(ACTIONS), z.array(code).max(3))
    .default(DEFAULT_BINDINGS)
    .transform((b) => ({ ...DEFAULT_BINDINGS, ...b }) as Record<Action, string[]>),
  gamepadIndex: z.number().int().min(0).max(7).nullable().default(null),
  volume: z.number().min(0).max(1).default(0.8),
  muted: z.boolean().default(false),
  quality: z.enum(["auto", "economy", "balanced", "high"]).default("auto"),
});

export type InputSettings = z.output<typeof inputSettingsSchema>;

export const DEFAULT_SETTINGS: InputSettings = inputSettingsSchema.parse({});

export const QUALITY_LABELS: Record<InputSettings["quality"], { label: string; detail: string }> = {
  auto: { label: "Automática", detail: "Ajusta a resolução de renderização conforme o desempenho medido." },
  economy: { label: "Econômica", detail: "Metade da resolução e 30 quadros por segundo. Poupa bateria." },
  balanced: { label: "Equilibrada", detail: "Resolução padrão da tela, até 60 quadros por segundo." },
  high: { label: "Alta", detail: "Resolução máxima da tela (telas de alta densidade), sem limite de quadros." },
};

/** Nome legível de uma tecla (KeyboardEvent.code). */
export function keyLabel(c: string): string {
  if (c.startsWith("Key")) return c.slice(3);
  if (c.startsWith("Digit")) return c.slice(5);
  const map: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: "Espaço",
    Enter: "Enter",
    ShiftLeft: "Shift esq.",
    ShiftRight: "Shift dir.",
    ControlLeft: "Ctrl esq.",
    ControlRight: "Ctrl dir.",
    AltLeft: "Alt",
    Backspace: "Backspace",
  };
  return map[c] ?? c;
}
