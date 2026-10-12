import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/game/GameCard";
import { HistoryList } from "@/components/game/HistoryList";
import { LocalLibraryView } from "@/components/game/LocalLibraryView";
import { getCatalog } from "@/modules/catalog/repository";
import type { PublicGame } from "@/modules/catalog/types";
import { getFavoriteIds, getHistory } from "@/modules/library/service";
import { getUserPlan } from "@/modules/subscriptions/entitlements";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Minha biblioteca" };

export default async function LibraryPage() {
  const [user, catalog] = await Promise.all([getCurrentUser(), getCatalog()]);
  return (
    <div className="shell py-10">
      <h1 className="text-3xl font-bold md:text-4xl">Minha biblioteca</h1>
      {user ? <AccountLibrary userId={user.id} catalog={catalog} user={user} /> : <Guest catalog={catalog} />}
    </div>
  );
}

async function AccountLibrary({ userId, catalog, user }: { userId: string; catalog: PublicGame[]; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }) {
  const plan = await getUserPlan(user);
  const [history, favIds] = await Promise.all([getHistory(userId, plan.entitlements.historyLimit), getFavoriteIds(userId)]);
  const byId = new Map(catalog.map((g) => [g.id, g]));
  const items = history.flatMap((h) => {
    const game = byId.get(h.gameId);
    return game ? [{ game, lastPlayedAt: h.lastPlayedAt, seconds: h.totalSeconds, count: h.playCount }] : [];
  });
  const favorites = favIds.map((id) => byId.get(id)).filter((g): g is PublicGame => Boolean(g));
  return (
    <>
      <p className="mt-2 text-muted">Histórico e favoritos salvos na sua conta, em todos os aparelhos.</p>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Jogados recentemente</h2>
        <HistoryList items={items} />
        {plan.entitlements.historyLimit < 100 && items.length >= plan.entitlements.historyLimit && (
          <p className="mt-2 text-xs text-faint">
            O plano {plan.plan.name} guarda os últimos {plan.entitlements.historyLimit} jogos.{" "}
            <Link href="/planos" className="text-accent hover:underline">
              Histórico completo no Plus
            </Link>
            .
          </p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Favoritos</h2>
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

function Guest({ catalog }: { catalog: PublicGame[] }) {
  return (
    <>
      <div className="notice notice-info mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>Sem conta, sua biblioteca fica só neste navegador. Crie uma conta grátis para levá-la a qualquer aparelho.</p>
        <Link href="/cadastrar?next=/biblioteca" className="btn btn-primary btn-sm shrink-0">
          Criar conta
        </Link>
      </div>
      <LocalLibraryView catalog={catalog} />
    </>
  );
}
