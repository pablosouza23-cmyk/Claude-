/* Utilidades da Gamepad API (mapeamento padrão W3C), compartilhadas pelo teste de controle e pelo player. */

export type PadFamily = "playstation" | "xbox" | "nintendo" | "generic";

export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(s)) return "playstation";
  if (/045e|xbox|xinput/.test(s)) return "xbox";
  if (/057e|nintendo|pro controller|joy-con/.test(s)) return "nintendo";
  return "generic";
}

export const FAMILY_LABEL: Record<PadFamily, string> = {
  playstation: "Controle PlayStation",
  xbox: "Controle Xbox",
  nintendo: "Controle Nintendo",
  generic: "Controle",
};

/** Nomes dos botões no mapeamento "standard", por família. */
export function buttonNames(family: PadFamily): string[] {
  const face =
    family === "playstation" ? ["✕", "○", "□", "△"] : family === "nintendo" ? ["B", "A", "Y", "X"] : ["A", "B", "X", "Y"];
  const shoulders = family === "playstation" ? ["L1", "R1", "L2", "R2"] : family === "nintendo" ? ["L", "R", "ZL", "ZR"] : ["LB", "RB", "LT", "RT"];
  const mid = family === "playstation" ? ["Create", "Options"] : family === "nintendo" ? ["−", "+"] : ["View", "Menu"];
  return [...face, ...shoulders, ...mid, "L3", "R3", "↑", "↓", "←", "→", family === "playstation" ? "PS" : family === "xbox" ? "Xbox" : "Home", "Touchpad"];
}

/** Nome curto e legível a partir do id informado pelo navegador. */
export function padDisplayName(id: string): string {
  const cleaned = id.replace(/\(.*?(Vendor|STANDARD GAMEPAD).*?\)/gi, "").replace(/\s+/g, " ").trim();
  return cleaned || FAMILY_LABEL[padFamily(id)];
}

export function connectedPads(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  try {
    return Array.from(navigator.getGamepads()).filter((p): p is Gamepad => Boolean(p && p.connected));
  } catch {
    return [];
  }
}

export async function rumble(pad: Gamepad, ms = 300, strong = 0.8, weak = 0.4): Promise<boolean> {
  const act = (pad as Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }).vibrationActuator;
  if (!act?.playEffect) return false;
  try {
    await act.playEffect("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
    return true;
  } catch {
    return false;
  }
}
