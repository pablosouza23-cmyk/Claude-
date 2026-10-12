import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatDateTime, formatDuration } from "@/config/site";
import type { PublicGame } from "@/modules/catalog/types";

export function HistoryList({ items }: { items: { game: PublicGame; lastPlayedAt: string | Date; seconds: number; count: number }[] }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-muted">Você ainda não jogou nada por aqui. Que tal começar pelo catálogo?</p>;
  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map(({ game, lastPlayedAt, seconds, count }) => (
        <li key={game.id} className="flex items-center gap-4 p-3 pr-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.coverUrl} alt="" className="aspect-video w-28 shrink-0 rounded-lg object-cover sm:w-36" />
          <div className="min-w-0 flex-1">
            <Link href={`/jogos/${game.id}`} className="font-semibold hover:text-accent">
              {game.title}
            </Link>
            <p className="mt-0.5 text-xs text-muted">
              Última vez: {formatDateTime(lastPlayedAt)}
              {seconds > 0 && ` · ${formatDuration(seconds)} jogados`}
              {count > 1 && ` · ${count} partidas`}
            </p>
          </div>
          <Link href={`/jogar/${game.id}`} className="btn btn-primary btn-sm shrink-0" aria-label={`Jogar ${game.title}`}>
            <Icon name="play" size={14} />
            <span className="hidden sm:inline">Jogar</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
