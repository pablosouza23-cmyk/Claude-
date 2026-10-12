import Link from "next/link";
import { Hero } from "@/components/game/Hero";
import { GameCard } from "@/components/game/GameCard";
import { GameRow } from "@/components/game/GameRow";
import { LocalRows } from "@/components/game/LocalRows";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getCatalog } from "@/modules/catalog/repository";
import { buildCategoryRows, sortGames } from "@/modules/catalog/query";
import { INPUT_LABELS, isCloudGame, type InputMethod, type PublicGame } from "@/modules/catalog/types";
import { getCurrentUser } from "@/server/auth/session";
import { getFavoriteIds, getHistory } from "@/modules/library/service";
import { getUserPlan } from "@/modules/subscriptions/entitlements";
import { isCloudConfigured } from "@/config/env";

const INPUT_ICON: Record<InputMethod, IconName> = { touch: "touch", keyboard: "keyboard", mouse: "mouse", gamepad: "gamepad" };

export default async function HomePage() {
  const user = await getCurrentUser();
  const catalog = await getCatalog();

  if (catalog.length === 0) {
    return (
      <div className="shell py-24 text-center">
        <h1 className="text-3xl font-bold">Nenhum jogo disponível</h1>
        <p className="mt-3 text-muted">O catálogo está vazio no momento. Volte em breve.</p>
      </div>
    );
  }

  const byId = new Map(catalog.map((g) => [g.id, g]));
  const featured = sortGames(catalog.filter((g) => g.featured), "popular")[0] ?? sortGames(catalog, "popular")[0]!;
  const { rows, universal, allInBrowser } = buildCategoryRows(catalog);

  let history: PublicGame[] = [];
  let favorites: PublicGame[] = [];
  if (user) {
    const plan = await getUserPlan(user);
    const [h, f] = await Promise.all([getHistory(user.id, plan.entitlements.historyLimit), getFavoriteIds(user.id)]);
    history = h.map((x) => byId.get(x.gameId)).filter((g): g is PublicGame => Boolean(g));
    favorites = f.map((id) => byId.get(id)).filter((g): g is PublicGame => Boolean(g));
  }

  return (
    <>
      <Hero game={featured} />
      <div className="shell relative">
        {catalog.some(isCloudGame) && (
          <div className="card mb-10 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[#cfd9d6]">
              <Icon name="cloud" size={16} className="mr-1.5 inline align-[-3px] text-accent" />
              Os jogos rodam nos serviços oficiais de nuvem (Xbox Cloud Gaming e GeForce NOW): toque em Jogar, entre com a conta do serviço e jogue no navegador, sem instalar.
            </p>
            <Link href="/ajuda#nuvem" className="btn btn-secondary btn-sm shrink-0">
              Como funciona
            </Link>
          </div>
        )}

        {!catalog.some(isCloudGame) && (universal.length > 0 || allInBrowser) && (
          <div className="card mb-10 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[#cfd9d6]">
              {allInBrowser ? "Todos os jogos do catálogo abrem direto no navegador, sem instalar nada." : "Jogos compatíveis com:"}
              {universal.length > 0 && allInBrowser && " Todos aceitam:"}
            </p>
            <ul className="flex flex-wrap gap-2">
              {universal.map((i) => (
                <li key={i} className="chip">
                  <Icon name={INPUT_ICON[i]} size={14} />
                  {INPUT_LABELS[i]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {user ? (
          <>
            {history.length > 0 && (
              <GameRow id="continuar" title="Continuar jogando" count={history.length} href="/biblioteca">
                {history.map((g) => (
                  <div role="listitem" key={g.id}>
                    <GameCard game={g} />
                  </div>
                ))}
              </GameRow>
            )}
            {favorites.length > 0 && (
              <GameRow id="favoritos" title="Favoritos" count={favorites.length} href="/favoritos">
                {favorites.map((g) => (
                  <div role="listitem" key={g.id}>
                    <GameCard game={g} />
                  </div>
                ))}
              </GameRow>
            )}
          </>
        ) : (
          <LocalRows catalog={catalog} />
        )}

        {rows.map((row, i) => (
          <GameRow key={row.id} id={row.id} title={row.title} href={row.href} count={row.games.length}>
            {row.games.map((g, j) => (
              <div role="listitem" key={g.id}>
                <GameCard game={g} size={i === 0 ? "lg" : "md"} priority={i === 0 && j < 2} />
              </div>
            ))}
          </GameRow>
        ))}

        <section className="mt-14 grid gap-4 md:grid-cols-2">
          <PromoCard
            icon="cloud"
            title="Cloud Play"
            body={
              isCloudConfigured()
                ? "Jogue títulos de PC rodando em um servidor remoto, direto no navegador."
                : "Veja como funciona o streaming de jogos e os serviços oficiais disponíveis."
            }
            href="/cloud-play"
            cta="Conhecer o Cloud Play"
          />
          <PromoCard icon="gamepad" title="Teste seu controle" body="Conecte um controle Bluetooth ou USB e veja cada botão e analógico respondendo em tempo real." href="/controle" cta="Abrir o teste" />
        </section>
      </div>
    </>
  );
}

function PromoCard({ icon, title, body, href, cta }: { icon: IconName; title: string; body: string; href: string; cta: string }) {
  return (
    <Link href={href} className="card group relative overflow-hidden p-6 transition-colors hover:border-accent/40">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition-opacity group-hover:opacity-100" />
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
        {cta}
        <Icon name="chevronRight" size={16} />
      </span>
    </Link>
  );
}
