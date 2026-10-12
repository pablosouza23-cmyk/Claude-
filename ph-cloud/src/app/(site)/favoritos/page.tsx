import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/game/GameCard";
import { LocalLibraryView } from "@/components/game/LocalLibraryView";
import { getCatalog } from "@/modules/catalog/repository";
import type { PublicGame } from "@/modules/catalog/types";
import { getFavoriteIds } from "@/modules/library/service";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const [user, catalog] = await Promise.all([getCurrentUser(), getCatalog()]);
  const byId = new Map(catalog.map((g) => [g.id, g]));
  const favorites = user ? (await getFavoriteIds(user.id)).map((id) => byId.get(id)).filter((g): g is PublicGame => Boolean(g)) : [];
  return (
    <div className="shell py-10">
      <h1 className="text-3xl font-bold md:text-4xl">Favoritos</h1>
      {!user ? (
        <LocalLibraryView catalog={catalog} only="favorites" />
      ) : favorites.length === 0 ? (
        <div className="card mt-8 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">Nenhum favorito ainda</h2>
          <p className="mt-1 text-sm text-muted">Toque no coração na página de um jogo para guardá-lo aqui.</p>
          <Link href="/jogos" className="btn btn-primary mt-5">
            Explorar jogos
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((g) => (
            <li key={g.id} className="[&>a]:!w-full">
              <GameCard game={g} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
