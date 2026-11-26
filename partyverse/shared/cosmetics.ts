/**
 * Catálogo de cosméticos. Todos os itens são APENAS visuais — nenhum altera
 * velocidade, força ou qualquer regra de jogo (sem pay-to-win).
 */
export type Slot = 'hair' | 'hat' | 'top' | 'bottom' | 'shoes' | 'face' | 'acc';

export interface CosmeticItem {
  id: string;
  slot: Slot;
  name: string;
  price: number;
  /** nível mínimo para comprar */
  level?: number;
  /** desbloqueado por conquista */
  achievement?: string;
  /** estilo (interpretação no avatar) */
  style: string;
  /** cor principal sugerida */
  color?: string;
}

export const COSMETICS: CosmeticItem[] = [
  // cabelos
  { id: 'hair-short', slot: 'hair', name: 'Curto', price: 0, style: 'short' },
  { id: 'hair-spiky', slot: 'hair', name: 'Espetado', price: 0, style: 'spiky' },
  { id: 'hair-long', slot: 'hair', name: 'Longo', price: 0, style: 'long' },
  { id: 'hair-bun', slot: 'hair', name: 'Coque', price: 120, style: 'bun' },
  { id: 'hair-mohawk', slot: 'hair', name: 'Moicano', price: 200, level: 3, style: 'mohawk' },
  { id: 'hair-afro', slot: 'hair', name: 'Black Power', price: 180, style: 'afro' },
  { id: 'hair-pigtails', slot: 'hair', name: 'Maria-chiquinha', price: 160, style: 'pigtails' },
  { id: 'hair-none', slot: 'hair', name: 'Careca', price: 0, style: 'none' },
  // chapéus
  { id: 'hat-none', slot: 'hat', name: 'Nenhum', price: 0, style: 'none' },
  { id: 'hat-cap', slot: 'hat', name: 'Boné', price: 0, style: 'cap', color: '#e64545' },
  { id: 'hat-beanie', slot: 'hat', name: 'Gorro', price: 90, style: 'beanie', color: '#3a7bd5' },
  { id: 'hat-party', slot: 'hat', name: 'Chapéu de Festa', price: 150, style: 'party', color: '#ff4fa3' },
  { id: 'hat-cowboy', slot: 'hat', name: 'Caubói', price: 260, level: 4, style: 'cowboy', color: '#8a5a32' },
  { id: 'hat-headphones', slot: 'hat', name: 'Fones', price: 220, style: 'headphones', color: '#222831' },
  { id: 'hat-crown', slot: 'hat', name: 'Coroa', price: 900, level: 10, style: 'crown', color: '#ffc93c' },
  { id: 'hat-helmet', slot: 'hat', name: 'Capacete de Obra', price: 0, achievement: 'first-move', style: 'hardhat', color: '#ffb400' },
  { id: 'hat-astro', slot: 'hat', name: 'Antena Espacial', price: 400, level: 6, style: 'antenna', color: '#7c5cff' },
  // tops
  { id: 'top-tee', slot: 'top', name: 'Camiseta', price: 0, style: 'tee' },
  { id: 'top-hoodie', slot: 'top', name: 'Moletom', price: 140, style: 'hoodie' },
  { id: 'top-jacket', slot: 'top', name: 'Jaqueta', price: 240, level: 2, style: 'jacket' },
  { id: 'top-overall', slot: 'top', name: 'Macacão de Mecânico', price: 0, achievement: 'first-workshop', style: 'overall' },
  { id: 'top-suit', slot: 'top', name: 'Terno de Espião', price: 520, level: 5, style: 'suit' },
  { id: 'top-space', slot: 'top', name: 'Traje Espacial', price: 700, level: 8, style: 'space' },
  // calças
  { id: 'bottom-jeans', slot: 'bottom', name: 'Jeans', price: 0, style: 'pants', color: '#3d5a99' },
  { id: 'bottom-shorts', slot: 'bottom', name: 'Bermuda', price: 0, style: 'shorts', color: '#5b6b48' },
  { id: 'bottom-cargo', slot: 'bottom', name: 'Cargo', price: 110, style: 'pants', color: '#6f6248' },
  // sapatos
  { id: 'shoes-sneaker', slot: 'shoes', name: 'Tênis', price: 0, style: 'sneaker', color: '#f4f4f4' },
  { id: 'shoes-boots', slot: 'shoes', name: 'Botas', price: 90, style: 'boots', color: '#4a3426' },
  { id: 'shoes-neon', slot: 'shoes', name: 'Tênis Neon', price: 180, style: 'sneaker', color: '#39ff88' },
  // rostos
  { id: 'face-happy', slot: 'face', name: 'Feliz', price: 0, style: 'happy' },
  { id: 'face-cool', slot: 'face', name: 'Confiante', price: 0, style: 'cool' },
  { id: 'face-cute', slot: 'face', name: 'Fofo', price: 80, style: 'cute' },
  { id: 'face-wink', slot: 'face', name: 'Piscadinha', price: 120, style: 'wink' },
  { id: 'face-surprised', slot: 'face', name: 'Surpreso', price: 120, style: 'surprised' },
  // acessórios
  { id: 'acc-none', slot: 'acc', name: 'Nenhum', price: 0, style: 'none' },
  { id: 'acc-glasses', slot: 'acc', name: 'Óculos', price: 70, style: 'glasses' },
  { id: 'acc-shades', slot: 'acc', name: 'Óculos Escuros', price: 160, style: 'shades' },
  { id: 'acc-backpack', slot: 'acc', name: 'Mochila', price: 200, style: 'backpack', color: '#ff8a3d' },
  { id: 'acc-scarf', slot: 'acc', name: 'Cachecol', price: 130, style: 'scarf', color: '#d7263d' },
  { id: 'acc-jetpack', slot: 'acc', name: 'Jetpack (visual)', price: 650, level: 7, style: 'jetpack', color: '#9aa5b1' },
  { id: 'acc-friend-badge', slot: 'acc', name: 'Broche da Amizade', price: 0, achievement: 'squad-goals', style: 'badge', color: '#ff4fa3' },
];

export const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export const SKIN_TONES = ['#ffe0c4', '#f6c9a0', '#e3a878', '#c68652', '#9c6339', '#6b4227'];
export const PALETTE = [
  '#e64545', '#ff8a3d', '#ffc93c', '#7bd389', '#2bb3a3', '#3a7bd5', '#7c5cff', '#ff4fa3',
  '#f4f4f4', '#9aa5b1', '#3b4252', '#1f2330', '#8a5a32', '#c49a6c', '#3d5a99', '#5b6b48',
];
export const HAIR_COLORS = ['#2b1d14', '#5a3a22', '#a0662b', '#e3c16f', '#d94f2b', '#e9e9e9', '#3a7bd5', '#ff4fa3'];

export interface Outfit {
  skin: number; // índice em SKIN_TONES
  hair: string; hairColor: string;
  hat: string; hatColor: string;
  top: string; topColor: string;
  bottom: string; bottomColor: string;
  shoes: string; shoesColor: string;
  face: string;
  acc: string; accColor: string;
}

export const DEFAULT_OWNED = COSMETICS.filter((c) => c.price === 0 && !c.achievement && !c.level).map((c) => c.id);

export function randomOutfit(seed = Math.random()): Outfit {
  let s = Math.floor(seed * 1e9) || 1;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length) % a.length];
  return {
    skin: Math.floor(rnd() * SKIN_TONES.length),
    hair: pick(['hair-short', 'hair-spiky', 'hair-long']),
    hairColor: pick(HAIR_COLORS.slice(0, 6)),
    hat: pick(['hat-none', 'hat-none', 'hat-cap']),
    hatColor: pick(PALETTE),
    top: 'top-tee',
    topColor: pick(PALETTE.slice(0, 8)),
    bottom: pick(['bottom-jeans', 'bottom-shorts']),
    bottomColor: pick(['#3d5a99', '#3b4252', '#5b6b48', '#8a5a32']),
    shoes: 'shoes-sneaker',
    shoesColor: pick(['#f4f4f4', '#1f2330', '#e64545']),
    face: pick(['face-happy', 'face-cool']),
    acc: 'acc-none',
    accColor: pick(PALETTE),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Valida um visual contra os itens possuídos. Itens não possuídos voltam ao padrão. */
export function validateOutfit(o: unknown, owned: Set<string>, fallback: Outfit): Outfit {
  const src = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const out: Outfit = { ...fallback };
  const slots: [keyof Outfit, Slot][] = [['hair', 'hair'], ['hat', 'hat'], ['top', 'top'], ['bottom', 'bottom'], ['shoes', 'shoes'], ['face', 'face'], ['acc', 'acc']];
  for (const [k, slot] of slots) {
    const v = src[k];
    if (typeof v === 'string' && owned.has(v) && COSMETIC_BY_ID.get(v)?.slot === slot) (out[k] as string) = v;
  }
  for (const k of ['hairColor', 'hatColor', 'topColor', 'bottomColor', 'shoesColor', 'accColor'] as const) {
    const v = src[k];
    if (typeof v === 'string' && HEX.test(v)) out[k] = v.toLowerCase();
  }
  if (typeof src.skin === 'number' && src.skin >= 0 && src.skin < SKIN_TONES.length) out.skin = Math.floor(src.skin);
  return out;
}
