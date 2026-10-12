"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { localLibrary } from "@/modules/library/local";

export function FavoriteButton({ gameId, initial, loggedIn, compact = false }: { gameId: string; initial: boolean; loggedIn: boolean; compact?: boolean }) {
  const [serverOn, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localOn = useSyncExternalStore(
    (cb) => localLibrary.subscribe(cb),
    () => localLibrary.isFavorite(gameId),
    () => initial,
  );
  const on = loggedIn ? serverOn : localOn;

  const toggle = async () => {
    const next = !on;
    setError(null);
    if (!loggedIn) {
      localLibrary.setFavorite(gameId, next);
      return;
    }
    setBusy(true);
    setOn(next);
    try {
      const res = await fetch("/api/me/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOn(!next);
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const label = on ? "Remover dos favoritos" : "Adicionar aos favoritos";
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        aria-label={compact ? label : undefined}
        className={`btn btn-secondary ${compact ? "btn-icon" : ""} ${on ? "!border-accent/40 !text-accent" : ""}`}
      >
        <Icon name="heart" size={18} fill={on ? "currentColor" : "none"} />
        {!compact && (on ? "Nos favoritos" : "Favoritar")}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
