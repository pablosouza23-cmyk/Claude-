import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { getCatalog } from "@/modules/catalog/repository";
import { getAdapter } from "@/modules/providers/adapters";

export const metadata: Metadata = { title: "Jogos", description: "Catálogo completo do PH Cloud: busque por título e filtre por gênero, controle e aparelho." };

export default async function GamesPage() {
  const games = await getCatalog();
  const providers = [...new Set(games.map((g) => g.provider))].map((id) => ({ id, name: getAdapter(id)?.name ?? id }));
  return (
    <div className="shell py-10">
      <p className="eyebrow">Catálogo</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">Todos os jogos</h1>
      <p className="mt-2 max-w-2xl text-muted">Jogos que rodam na nuvem pelos serviços oficiais. Filtre pelo serviço, pelo gênero ou pelo que você tem em mãos: celular, teclado ou controle.</p>
      <div className="mt-8">
        <Suspense>
          <CatalogBrowser games={games} providers={providers} />
        </Suspense>
      </div>
    </div>
  );
}
