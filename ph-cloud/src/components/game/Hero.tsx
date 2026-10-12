import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { hasFreeStream, isCloudGame, isLaunchable, playsInside, type PublicGame } from "@/modules/catalog/types";
import { STREAM_SERVICES } from "@/modules/cloud-streaming/services";
import { AccessBadge, AvailabilityBadge, DeviceList, GenreText, InputList } from "./badges";

export function Hero({ game }: { game: PublicGame }) {
  const launchable = isLaunchable(game);
  const inside = playsInside(game);
  const cloud = isCloudGame(game);
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={game.backgroundUrl ?? game.coverUrl} alt="" className="h-full w-full scale-105 object-cover object-center opacity-70" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/40" />
      </div>
      <div className="shell flex min-h-[min(78vh,640px)] flex-col justify-end pb-12 pt-24 md:pb-16">
        <div className="max-w-xl animate-fade-up">
          <p className="eyebrow">Em destaque</p>
          <h1 id="hero-title" className="mt-3 text-4xl font-bold leading-[1.05] md:text-6xl">
            {game.title}
          </h1>
          <p className="mt-4 text-base text-[#cfd9d6] md:text-lg">{game.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted">
            {cloud ? (
              <>
                {hasFreeStream(game) && <span className="chip chip-accent">Grátis na nuvem</span>}
                {[...new Set(game.streams?.map((s) => s.service))].map((sv) => (
                  <span key={sv} className="chip">
                    <Icon name="cloud" size={12} />
                    {STREAM_SERVICES[sv].name}
                  </span>
                ))}
              </>
            ) : (
              <AvailabilityBadge game={game} />
            )}
            <AccessBadge game={game} />
            <span className="chip">
              <GenreText game={game} />
            </span>
          </div>
          <div className="mt-4 hidden flex-col gap-2 sm:flex">
            <InputList inputs={game.inputs} />
            <DeviceList devices={game.devices} />
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            {launchable && (inside || cloud) && (
              <Link href={`/jogar/${game.id}`} className="btn btn-primary min-h-12 px-6 text-base">
                <Icon name="play" size={18} />
                Jogar agora
              </Link>
            )}
            {launchable && !inside && !cloud && game.launch.url && (
              <a href={game.launch.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-12 px-6 text-base">
                <Icon name="external" size={18} />
                Abrir no site oficial
              </a>
            )}
            <Link href={`/jogos/${game.id}`} className="btn btn-secondary min-h-12 px-6 text-base">
              <Icon name="info" size={18} />
              Ver detalhes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
