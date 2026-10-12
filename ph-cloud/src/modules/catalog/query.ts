import { GENRES, hasFreeStream, playsInside, type Genre, type InputMethod, type PublicGame, type StreamService } from "./types";

/* Busca, filtros, ordenação e categorias — funções puras usadas no servidor e no navegador. */

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type CatalogFilters = {
  q?: string;
  genre?: Genre | "";
  pricing?: "free" | "paid" | "";
  input?: InputMethod | "";
  device?: "mobile" | "tablet" | "desktop" | "";
  provider?: string;
  service?: StreamService | "";
  sort?: "popular" | "name" | "recent" | "release";
};

export function searchScore(g: PublicGame, q: string): number {
  const nq = normalize(q);
  if (!nq) return 1;
  const title = normalize(g.title);
  if (title === nq) return 100;
  if (title.startsWith(nq)) return 80;
  if (title.includes(nq)) return 60;
  const words = nq.split(" ");
  const hay = normalize([g.title, g.description, g.developer ?? "", ...g.genres.map((x) => GENRES[x])].join(" "));
  return words.every((w) => hay.includes(w)) ? 30 : 0;
}

export function filterGames(games: PublicGame[], f: CatalogFilters): PublicGame[] {
  const q = f.q?.trim() ?? "";
  let out = games.filter((g) => {
    if (f.genre && !g.genres.includes(f.genre)) return false;
    if (f.pricing && g.pricing !== f.pricing) return false;
    if (f.input && !g.inputs.includes(f.input)) return false;
    if (f.device && !g.devices.includes(f.device)) return false;
    if (f.provider && g.provider !== f.provider) return false;
    if (f.service && !g.streams?.some((x) => x.service === f.service)) return false;
    if (q && searchScore(g, q) === 0) return false;
    return true;
  });
  out = sortGames(out, f.sort ?? (q ? undefined : "popular"));
  if (q && !f.sort) out.sort((a, b) => searchScore(b, q) - searchScore(a, q));
  return out;
}

export function sortGames(games: PublicGame[], sort: CatalogFilters["sort"]): PublicGame[] {
  const out = [...games];
  const byName = (a: PublicGame, b: PublicGame) => a.title.localeCompare(b.title, "pt-BR");
  switch (sort) {
    case "name":
      return out.sort(byName);
    case "recent":
      return out.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || byName(a, b));
    case "release":
      return out.sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "") || byName(a, b));
    case "popular":
      return out.sort((a, b) => b.popularity - a.popularity || Number(!!b.featured) - Number(!!a.featured) || byName(a, b));
    default:
      return out;
  }
}

export type CategoryRow = { id: string; title: string; games: PublicGame[]; href?: string };

/**
 * Monta as fileiras da página inicial só com categorias que têm jogos de verdade.
 * Fileiras de atributo que repetiriam o catálogo inteiro são omitidas (viram um aviso geral).
 */
export function buildCategoryRows(games: PublicGame[]): { rows: CategoryRow[]; universal: InputMethod[]; allInBrowser: boolean } {
  const rows: CategoryRow[] = [];
  const total = games.length;
  const seen = new Set<string>();
  const add = (id: string, title: string, list: PublicGame[], href?: string, skipIfAll = false) => {
    if (list.length === 0) return;
    if (skipIfAll && list.length === total && total > 0) return;
    // Não repete uma fileira com exatamente os mesmos jogos de outra já exibida.
    const key = list.map((g) => g.id).sort().join(",");
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ id, title, games: list, href });
  };

  const popular = sortGames(games, "popular");
  add("destaque", "Em destaque", popular.filter((g) => g.featured));
  add("gratis-nuvem", "Grátis para jogar na nuvem", popular.filter((g) => hasFreeStream(g)), undefined, true);
  add("xbox", "No Xbox Cloud Gaming", popular.filter((g) => g.streams?.some((x) => x.service === "xbox")), "/jogos?servico=xbox", true);
  add("geforcenow", "No GeForce NOW", popular.filter((g) => g.streams?.some((x) => x.service === "geforcenow")), "/jogos?servico=geforcenow", true);
  add("boosteroid", "No Boosteroid", popular.filter((g) => g.streams?.some((x) => x.service === "boosteroid")), "/jogos?servico=boosteroid", true);
  add("gratuitos", "Jogos gratuitos", popular.filter((g) => g.pricing === "free" && g.access === "free"), "/jogos?preco=free", true);
  add("navegador", "Jogue aqui no site", popular.filter((g) => playsInside(g)), undefined, true);

  const genreOrder: Genre[] = ["acao", "aventura", "corrida", "esportes", "estrategia", "puzzle", "arcade", "plataforma", "indie", "casual"];
  for (const genre of genreOrder) {
    add(`genero-${genre}`, GENRES[genre], popular.filter((g) => g.genres.includes(genre)), `/jogos?genero=${genre}`);
  }

  add("multiplayer", "Multijogador", popular.filter((g) => g.multiplayer));
  add("celular", "Jogos para celular", popular.filter((g) => g.devices.includes("mobile") && g.inputs.includes("touch")), "/jogos?aparelho=mobile", true);
  add("controle", "Compatíveis com controle", popular.filter((g) => g.inputs.includes("gamepad")), "/jogos?entrada=gamepad", true);
  add(
    "teclado-mouse",
    "Compatíveis com teclado e mouse",
    popular.filter((g) => g.inputs.includes("keyboard") || g.inputs.includes("mouse")),
    "/jogos?entrada=keyboard",
    true,
  );
  add("recentes", "Adicionados recentemente", sortGames(games, "recent").slice(0, 12), "/jogos?ordem=recent", true);

  const universal = (["touch", "keyboard", "mouse", "gamepad"] as InputMethod[]).filter((i) => total > 0 && games.every((g) => g.inputs.includes(i)));
  const allInBrowser = total > 0 && games.every(playsInside);
  return { rows, universal, allInBrowser };
}

export function genresInCatalog(games: PublicGame[]): Genre[] {
  const set = new Set<Genre>();
  for (const g of games) for (const x of g.genres) set.add(x);
  return (Object.keys(GENRES) as Genre[]).filter((k) => set.has(k));
}
