import Link from "next/link";
import type { PublicGame } from "@/modules/catalog/types";
import { Icon } from "@/components/ui/Icon";
import { ServiceChips } from "@/components/cloud/StreamLauncher";
import { AccessBadge, GenreText, InputIcons } from "./badges";

export function GameCard({ game, size = "md", priority = false }: { game: PublicGame; size?: "md" | "lg"; priority?: boolean }) {
  return (
    <Link
      href={`/jogos/${game.id}`}
      className={`group relative block overflow-hidden rounded-[var(--radius-card)] border border-white/[0.07] bg-surface outline-offset-4 transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out-soft)] hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-glow)] focus-visible:-translate-y-1 ${
        size === "lg" ? "w-[min(82vw,420px)]" : "w-[min(70vw,300px)]"
      }`}
    >
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverUrl}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 [transition-timing-function:var(--ease-out-soft)] group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute bottom-3 right-3 grid h-10 w-10 translate-y-2 place-items-center rounded-full bg-accent text-accent-ink opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <Icon name="play" size={18} />
        </span>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pr-3">
          <AccessBadge game={game} />
          <ServiceChips streams={game.streams} />
          {game.multiplayer === "local" && <span className="chip bg-black/50 backdrop-blur">2 jogadores</span>}
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[1.02rem] font-semibold">{game.title}</h3>
          <p className="mt-0.5 truncate text-xs text-muted">
            <GenreText game={game} />
          </p>
        </div>
        <InputIcons inputs={game.inputs} size={15} className="mt-1 shrink-0" />
      </div>
    </Link>
  );
}
