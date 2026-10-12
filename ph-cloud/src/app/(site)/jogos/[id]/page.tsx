import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/game/FavoriteButton";
import { GameCard } from "@/components/game/GameCard";
import { AccessBadge, AvailabilityBadge, DeviceList, GenreText, InputList } from "@/components/game/badges";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDate } from "@/config/site";
import { getCatalog, getGame } from "@/modules/catalog/repository";
import { INPUT_LABELS, LAUNCH_LABELS, isCloudGame, isLaunchable, playsInside, type InputMethod } from "@/modules/catalog/types";
import { StreamLauncher } from "@/components/cloud/StreamLauncher";
import { STREAM_SERVICES } from "@/modules/cloud-streaming/services";
import { getAdapter } from "@/modules/providers/adapters";
import { getCurrentUser } from "@/server/auth/session";
import { isFavorite } from "@/modules/library/service";
import { getUserPlan } from "@/modules/subscriptions/entitlements";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = await getGame((await params).id);
  return game ? { title: game.title, description: game.description } : { title: "Jogo não encontrado" };
}

const INPUT_ICON: Record<InputMethod, IconName> = { touch: "touch", keyboard: "keyboard", mouse: "mouse", gamepad: "gamepad" };
const ORIENTATION = { landscape: "Horizontal (paisagem)", portrait: "Vertical (retrato)", any: "Qualquer orientação" } as const;
const LICENSE = { owned: "Jogo próprio do PH Cloud", provider_terms: "Termos do provedor", developer_permission: "Permissão do desenvolvedor" } as const;

export default async function GameDetailsPage({ params }: Props) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  const user = await getCurrentUser();
  const [plan, fav, catalog] = await Promise.all([getUserPlan(user), user ? isFavorite(user.id, game.id) : Promise.resolve(false), getCatalog()]);

  const launchable = isLaunchable(game);
  const inside = playsInside(game);
  const cloud = isCloudGame(game);
  const locked = game.access === "premium" && !plan.entitlements.premiumGames;
  const related = catalog.filter((g) => g.id !== game.id && g.genres.some((x) => game.genres.includes(x))).slice(0, 8);
  const provider = getAdapter(game.provider);

  const facts: [string, React.ReactNode][] = [
    ["Desenvolvedor", game.developer ?? "Não informado"],
    ["Provedor", provider?.name ?? game.provider],
    ["Como abre", LAUNCH_LABELS[game.launch.type]],
    ["Orientação", ORIENTATION[game.orientation]],
    ["Multijogador", game.multiplayer === "local" ? "Local (mesmo aparelho)" : game.multiplayer === "online" ? "Online" : "Não"],
    ["Preço do jogo", game.pricing === "free" ? "Gratuito" : "Pago"],
    ["Acesso no PH Cloud", game.access === "premium" ? "Planos Plus e Ultimate" : "Todos os planos"],
    [
      "Classificação indicativa",
      game.ageRating ? `${game.ageRating.value === "L" ? "Livre" : `${game.ageRating.value} anos`}${game.ageRating.source === "self" ? " (autoavaliação; classificação oficial pendente)" : ""}` : "Não informada",
    ],
    ["Licença", `${LICENSE[game.license.status]}. ${game.license.note}`],
    ["Conta externa", game.requiresExternalAccount ?? "Não precisa"],
    ...(game.releasedAt ? ([["Lançamento", formatDate(game.releasedAt + "T12:00:00")]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <article>
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.backgroundUrl ?? game.coverUrl} alt="" className="h-full w-full object-cover opacity-40 blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/30" />
        </div>
        <div className="shell grid gap-8 pb-10 pt-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-end md:pt-16">
          <div className="order-2 md:order-1">
            <nav aria-label="Trilha" className="text-sm text-muted">
              <Link href="/jogos" className="hover:text-text">
                Jogos
              </Link>{" "}
              / <span className="text-text">{game.title}</span>
            </nav>
            <h1 className="mt-3 text-4xl font-bold md:text-5xl">{game.title}</h1>
            <p className="mt-2 text-sm text-muted">
              <GenreText game={game} />
              {game.developer && ` · ${game.developer}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <AvailabilityBadge game={game} />
              <AccessBadge game={game} />
            </div>
            <p className="mt-5 max-w-2xl text-[#cfd9d6]">{game.longDescription ?? game.description}</p>

            <div className="mt-6 flex flex-wrap items-start gap-3">
              {launchable && inside && !locked && (
                <Link href={`/jogar/${game.id}`} className="btn btn-primary min-h-12 px-7 text-base">
                  <Icon name="play" size={18} />
                  Jogar agora
                </Link>
              )}
              {launchable && inside && locked && (
                <Link href="/planos" className="btn btn-primary min-h-12 px-7 text-base">
                  <Icon name="lock" size={18} />
                  Disponível no plano Plus
                </Link>
              )}
              {launchable && cloud && (
                <a href="#onde-jogar" className="btn btn-primary min-h-12 px-7 text-base">
                  <Icon name="play" size={18} />
                  Jogar na nuvem
                </a>
              )}
              {launchable && !inside && !cloud && game.launch.url && (
                <a href={game.launch.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-12 px-7 text-base">
                  <Icon name="external" size={18} />
                  Abrir no site oficial
                </a>
              )}
              {!launchable && (
                <span className="btn btn-secondary min-h-12 px-7 text-base" aria-disabled="true">
                  Indisponível no momento
                </span>
              )}
              <FavoriteButton gameId={game.id} initial={fav} loggedIn={Boolean(user)} />
            </div>
            {launchable && !inside && !cloud && (
              <p className="mt-3 max-w-xl text-sm text-muted">Este jogo abre no site oficial do provedor, em uma nova aba. O provedor não permite incorporá-lo aqui.</p>
            )}
          </div>
          <div className="order-1 md:order-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={game.coverUrl} alt={`Arte de ${game.title}`} className="aspect-video w-full rounded-2xl border border-white/10 object-cover shadow-2xl" />
          </div>
        </div>
      </div>

      {cloud && (
        <section id="onde-jogar" className="shell mb-6 scroll-mt-24" aria-labelledby="onde-jogar-titulo">
          <div className="card p-5 md:p-6">
            <h2 id="onde-jogar-titulo" className="text-lg font-semibold">
              Onde jogar
            </h2>
            <p className="mt-1 text-sm text-muted">
              O jogo roda nos servidores do serviço escolhido e abre na página oficial dele, em uma nova aba. Entre com a sua conta do serviço para começar.
            </p>
            <div className="mt-4">
              <StreamLauncher gameId={game.id} gameTitle={game.title} streams={game.streams ?? []} loggedIn={Boolean(user)} />
            </div>
          </div>
        </section>
      )}

      <div className="shell grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {game.howToPlay && (
            <section className="card p-5 md:p-6" aria-labelledby="como-jogar">
              <h2 id="como-jogar" className="text-lg font-semibold">
                Como jogar
              </h2>
              <dl className="mt-4 space-y-4">
                {(Object.keys(game.howToPlay) as InputMethod[]).map((k) => (
                  <div key={k} className="flex gap-3">
                    <dt className="flex w-28 shrink-0 items-start gap-2 pt-0.5 text-sm font-semibold">
                      <Icon name={INPUT_ICON[k]} size={18} className="text-accent" />
                      {INPUT_LABELS[k]}
                    </dt>
                    <dd className="text-sm text-[#cfd9d6]">{game.howToPlay![k]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="card p-5 md:p-6" aria-labelledby="compat">
            <h2 id="compat" className="text-lg font-semibold">
              Compatibilidade
            </h2>
            <h3 className="mt-4 text-sm font-semibold text-muted">Entradas</h3>
            <div className="mt-2">
              <InputList inputs={game.inputs} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-muted">Aparelhos</h3>
            <div className="mt-2">
              <DeviceList devices={game.devices} />
            </div>
            {cloud ? (
              <p className="mt-4 text-sm text-muted">
                Os controles, a qualidade de imagem e a conexão são do próprio serviço de nuvem.{" "}
                {(game.streams ?? []).map((st) => `${STREAM_SERVICES[st.service].name}: ${STREAM_SERVICES[st.service].browsers}`).join(" ")}
              </p>
            ) : game.sdk ? (
              <p className="mt-4 text-sm text-muted">
                Integrado ao PH Cloud: controles na tela, controle Bluetooth/USB, volume e qualidade de imagem funcionam pela barra do jogador.
              </p>
            ) : inside ? (
              <p className="mt-4 text-sm text-muted">
                Jogo incorporado de outro provedor: os controles são os do próprio jogo. Controles na tela, volume e qualidade do PH Cloud não se aplicam a ele.
              </p>
            ) : null}
            {game.limitations.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-muted">Limitações conhecidas</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#cfd9d6]">
                  {game.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
        <aside className="card h-fit p-5 md:p-6" aria-labelledby="ficha">
          <h2 id="ficha" className="text-lg font-semibold">
            Ficha técnica
          </h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9.5rem_1fr] gap-3 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="shell mt-12" aria-labelledby="relacionados">
          <h2 id="relacionados" className="mb-3 text-xl font-semibold">
            Você também pode gostar
          </h2>
          <ul className="scroller">
            {related.map((g) => (
              <li key={g.id}>
                <GameCard game={g} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
