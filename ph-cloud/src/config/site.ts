/* Identidade e textos gerais do PH Cloud. Seguro para cliente e servidor. */

export const SITE = {
  name: "PH Cloud",
  tagline: "Seus jogos, em qualquer tela.",
  description:
    "PH Cloud é um portal brasileiro de jogos na nuvem: Fortnite, GTA V, EA SPORTS FC e outros pelos serviços oficiais, no celular, tablet ou computador.",
  locale: "pt-BR",
  currency: "BRL",
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/jogos", label: "Jogos", icon: "grid" },
  { href: "/cloud-play", label: "Cloud Play", icon: "cloud" },
  { href: "/biblioteca", label: "Minha biblioteca", icon: "library" },
  { href: "/favoritos", label: "Favoritos", icon: "heart" },
  { href: "/planos", label: "Planos", icon: "star" },
  { href: "/ajuda", label: "Ajuda", icon: "help" },
] as const;

/** Navegação inferior no celular (cinco itens no máximo). */
export const MOBILE_NAV = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/jogos", label: "Jogos", icon: "grid" },
  { href: "/cloud-play", label: "Cloud", icon: "cloud" },
  { href: "/biblioteca", label: "Biblioteca", icon: "library" },
  { href: "/perfil", label: "Perfil", icon: "user" },
] as const;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const intFmt = new Intl.NumberFormat("pt-BR");

export const formatBRL = (cents: number) => brl.format(cents / 100);
export const formatDate = (d: Date | string | number) => dateFmt.format(new Date(d));
export const formatDateTime = (d: Date | string | number) => dateTimeFmt.format(new Date(d));
export const formatInt = (n: number) => intFmt.format(n);

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
