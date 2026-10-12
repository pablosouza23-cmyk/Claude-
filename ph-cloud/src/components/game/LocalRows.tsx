"use client";

import { useEffect, useState } from "react";
import type { PublicGame } from "@/modules/catalog/types";
import { localLibrary } from "@/modules/library/local";
import { GameCard } from "./GameCard";
import { GameRow } from "./GameRow";

/* "Continuar jogando" e "Favoritos" para visitantes, lidos do navegador. */
export function LocalRows({ catalog }: { catalog: PublicGame[] }) {
  const [state, setState] = useState<{ history: PublicGame[]; favorites: PublicGame[] }>({ history: [], favorites: [] });

  useEffect(() => {
    const byId = new Map(catalog.map((g) => [g.id, g]));
    const load = () =>
      setState({
        history: localLibrary
          .history()
          .map((h) => byId.get(h.gameId))
          .filter((g): g is PublicGame => Boolean(g)),
        favorites: localLibrary
          .favorites()
          .map((id) => byId.get(id))
          .filter((g): g is PublicGame => Boolean(g)),
      });
    load();
    return localLibrary.subscribe(load);
  }, [catalog]);

  return (
    <>
      {state.history.length > 0 && (
        <GameRow id="continuar" title="Continuar jogando" count={state.history.length} href="/biblioteca">
          {state.history.map((g) => (
            <div role="listitem" key={g.id}>
              <GameCard game={g} />
            </div>
          ))}
        </GameRow>
      )}
      {state.favorites.length > 0 && (
        <GameRow id="favoritos" title="Favoritos" count={state.favorites.length} href="/favoritos">
          {state.favorites.map((g) => (
            <div role="listitem" key={g.id}>
              <GameCard game={g} />
            </div>
          ))}
        </GameRow>
      )}
    </>
  );
}
