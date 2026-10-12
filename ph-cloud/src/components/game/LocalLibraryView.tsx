"use client";

import { useEffect, useState } from "react";
import type { PublicGame } from "@/modules/catalog/types";
import { localLibrary, type LocalHistoryItem } from "@/modules/library/local";
import { GameCard } from "./GameCard";
import { HistoryList } from "./HistoryList";

/* Biblioteca de visitantes (sem conta), lida do navegador. */
export function LocalLibraryView({ catalog, only }: { catalog: PublicGame[]; only?: "favorites" }) {
  const [data, setData] = useState<{ history: LocalHistoryItem[]; favorites: string[] } | null>(null);
  useEffect(() => {
    const load = () => setData({ history: localLibrary.history(), favorites: localLibrary.favorites() });
    load();
    return localLibrary.subscribe(load);
  }, []);
  if (!data) return <div className="skeleton mt-6 h-40 rounded-2xl" />;
  const byId = new Map(catalog.map((g) => [g.id, g]));
  const favorites = data.favorites.map((id) => byId.get(id)).filter((g): g is PublicGame => Boolean(g));
  const history = data.history
    .map((h) => ({ game: byId.get(h.gameId), lastPlayedAt: h.lastPlayedAt, seconds: h.seconds, count: h.count }))
    .filter((h): h is { game: PublicGame; lastPlayedAt: string; seconds: number; count: number } => Boolean(h.game));

  return (
    <>
      {only !== "favorites" && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Jogados recentemente</h2>
          <HistoryList items={history} />
        </section>
      )}
      <section className="mt-10">
        {only !== "favorites" && <h2 className="text-xl font-semibold">Favoritos</h2>}
        {favorites.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum favorito ainda. Toque no coração na página de um jogo para guardar aqui.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map((g) => (
              <li key={g.id} className="[&>a]:!w-full">
                <GameCard game={g} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
