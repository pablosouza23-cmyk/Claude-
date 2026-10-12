"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { attachAccount } from "@/modules/input/store";
import { localLibrary } from "@/modules/library/local";

/* Com sessão iniciada: sincroniza preferências e envia para a conta a biblioteca guardada no navegador. */
export function AccountSync({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!loggedIn) return;
    void attachAccount();
    const favorites = localLibrary.favorites();
    const history = localLibrary.history();
    if (favorites.length === 0 && history.length === 0) return;
    fetch("/api/me/library/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorites, history: history.map((h) => ({ gameId: h.gameId, lastPlayedAt: h.lastPlayedAt, seconds: h.seconds })) }),
    })
      .then((r) => {
        if (r.ok) {
          localLibrary.clear();
          router.refresh();
        }
      })
      .catch(() => {});
  }, [loggedIn, router]);
  return null;
}
