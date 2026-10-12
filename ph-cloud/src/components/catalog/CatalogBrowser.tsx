"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { GameCard } from "@/components/game/GameCard";
import { Icon } from "@/components/ui/Icon";
import { filterGames, genresInCatalog, type CatalogFilters } from "@/modules/catalog/query";
import { DEVICE_LABELS, GENRES, INPUT_LABELS, type Device, type Genre, type InputMethod, type PublicGame, type StreamService } from "@/modules/catalog/types";
import { STREAM_SERVICES } from "@/modules/cloud-streaming/services";

/* Parâmetros da URL em português, para links compartilháveis (ex.: /jogos?genero=corrida). */
const PARAM: Record<keyof CatalogFilters, string> = {
  q: "q",
  genre: "genero",
  pricing: "preco",
  input: "entrada",
  device: "aparelho",
  provider: "provedor",
  service: "servico",
  sort: "ordem",
};

const SORTS: { value: NonNullable<CatalogFilters["sort"]>; label: string }[] = [
  { value: "popular", label: "Mais jogados" },
  { value: "name", label: "Nome (A–Z)" },
  { value: "recent", label: "Adicionados recentemente" },
  { value: "release", label: "Data de lançamento" },
];

export function CatalogBrowser({ games, providers }: { games: PublicGame[]; providers: { id: string; name: string }[] }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const fromUrl = (): CatalogFilters => ({
    q: params.get(PARAM.q) ?? "",
    genre: (params.get(PARAM.genre) ?? "") as Genre | "",
    pricing: (params.get(PARAM.pricing) ?? "") as CatalogFilters["pricing"],
    input: (params.get(PARAM.input) ?? "") as InputMethod | "",
    device: (params.get(PARAM.device) ?? "") as CatalogFilters["device"],
    provider: params.get(PARAM.provider) ?? "",
    service: (params.get(PARAM.service) ?? "") as StreamService | "",
    sort: (params.get(PARAM.sort) ?? undefined) as CatalogFilters["sort"],
  });

  // A URL é a fonte única dos filtros (links compartilháveis e busca do cabeçalho).
  const f = fromUrl();
  const [showFilters, setShowFilters] = useState(false);

  const update = (patch: Partial<CatalogFilters>) => {
    const next = { ...f, ...patch };
    const sp = new URLSearchParams();
    (Object.keys(PARAM) as (keyof CatalogFilters)[]).forEach((k) => {
      const v = next[k];
      if (v) sp.set(PARAM[k], String(v));
    });
    const qs = sp.toString();
    // History API nativa: atualiza a URL sem nova renderização no servidor (integrada ao roteador do Next).
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const results = filterGames(games, f);
  const genres = useMemo(() => genresInCatalog(games), [games]);
  const inputs = useMemo(() => (Object.keys(INPUT_LABELS) as InputMethod[]).filter((i) => games.some((g) => g.inputs.includes(i))), [games]);
  const devices = useMemo(() => (Object.keys(DEVICE_LABELS) as Device[]).filter((d) => games.some((g) => g.devices.includes(d))), [games]);
  const hasPaid = games.some((g) => g.pricing === "paid");
  const services = useMemo(() => (Object.keys(STREAM_SERVICES) as StreamService[]).filter((sv) => games.some((g) => g.streams?.some((x) => x.service === sv))), [games]);
  const activeCount = [f.genre, f.pricing, f.input, f.device, f.provider, f.service].filter(Boolean).length;

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <label htmlFor="catalogo-busca" className="sr-only">
            Buscar por título
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            id="catalogo-busca"
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Buscar por título, gênero ou desenvolvedor"
            className="input !pl-11"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary md:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="filtros">
            <Icon name="filter" size={18} />
            Filtros{activeCount > 0 && ` (${activeCount})`}
          </button>
          <label htmlFor="ordem" className="sr-only">
            Ordenar por
          </label>
          <select id="ordem" className="input md:w-60" value={f.sort ?? (f.q ? "" : "popular")} onChange={(e) => update({ sort: (e.target.value || undefined) as CatalogFilters["sort"] })}>
            {f.q && <option value="">Mais relevantes</option>}
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div id="filtros" className={`${showFilters ? "grid" : "hidden"} mt-3 gap-3 sm:grid-cols-2 md:grid md:grid-cols-3 xl:grid-cols-6`}>
        <Select id="f-servico" label="Serviço de nuvem" value={f.service ?? ""} onChange={(v) => update({ service: v as StreamService | "" })} options={services.map((sv) => [sv, STREAM_SERVICES[sv].name])} />
        <Select id="f-genero" label="Gênero" value={f.genre ?? ""} onChange={(v) => update({ genre: v as Genre | "" })} options={genres.map((g) => [g, GENRES[g]])} />
        <Select
          id="f-preco"
          label="Preço"
          value={f.pricing ?? ""}
          onChange={(v) => update({ pricing: v as CatalogFilters["pricing"] })}
          options={[["free", "Gratuitos"], ...(hasPaid ? [["paid", "Pagos"] as [string, string]] : [])]}
        />
        <Select id="f-entrada" label="Controle" value={f.input ?? ""} onChange={(v) => update({ input: v as InputMethod | "" })} options={inputs.map((i) => [i, INPUT_LABELS[i]])} />
        <Select id="f-aparelho" label="Aparelho" value={f.device ?? ""} onChange={(v) => update({ device: v as CatalogFilters["device"] })} options={devices.map((d) => [d, DEVICE_LABELS[d]])} />
        <Select id="f-provedor" label="Provedor" value={f.provider ?? ""} onChange={(v) => update({ provider: v })} options={providers.map((p) => [p.id, p.name])} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {results.length === 1 ? "1 jogo encontrado" : `${results.length} jogos encontrados`}
        </p>
        {(activeCount > 0 || f.q) && (
          <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => update({ q: "", genre: "", pricing: "", input: "", device: "", provider: "", service: "" })}>
            Limpar filtros
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="card mt-4 flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Icon name="search" size={26} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Nenhum jogo combina com essa busca</h2>
          <p className="mt-1 max-w-md text-sm text-muted">Tente outro termo, remova algum filtro ou veja o catálogo completo.</p>
          <button type="button" className="btn btn-secondary mt-5" onClick={() => update({ q: "", genre: "", pricing: "", input: "", device: "", provider: "", service: "" })}>
            Ver todos os jogos
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((g) => (
            <li key={g.id} className="[&>a]:!w-full">
              <GameCard game={g} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Select({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
