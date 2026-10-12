import { env, isStripeConfigured } from "@/config/env";
import { formatDuration, formatInt } from "@/config/site";
import { getDbKind } from "@/server/db";
import { adminStats } from "@/modules/analytics/service";
import { getFullCatalog } from "@/modules/catalog/repository";
import { checkBackend } from "@/modules/cloud-streaming/backend";
import { PROVIDER_CANDIDATES } from "@/modules/providers/candidates";
import { ADAPTERS, isProviderEnabled } from "@/modules/providers/registry";

const CANDIDATE_LABEL = {
  integrated: ["Integrado", "chip-accent"],
  integrated_disabled: ["Integrado, desativado", "chip-warning"],
  requires_partnership: ["Exige contrato", "chip-warning"],
  not_permitted: ["Não permitido / não usado", "chip-danger"],
  unverified: ["Não verificado", ""],
} as const;

export default async function AdminHome() {
  const e = env();
  const [stats, kind, backend, catalog] = await Promise.all([adminStats(), getDbKind(), checkBackend(), getFullCatalog()]);
  const names = new Map(catalog.map((g) => [g.id, g.title]));
  const checks: [string, boolean, string][] = [
    ["Banco de dados", kind === "postgres", kind === "postgres" ? "PostgreSQL (DATABASE_URL)" : "PGlite embutido — só para desenvolvimento ou um único servidor"],
    ["Segredo da aplicação", !e.appSecretIsEphemeral, e.appSecretIsEphemeral ? "APP_SECRET não definido (usando segredo local de desenvolvimento)" : "APP_SECRET definido"],
    ["URL pública", Boolean(e.APP_URL), e.APP_URL ?? "APP_URL não definido"],
    ["Pagamentos (Stripe)", isStripeConfigured(), isStripeConfigured() ? "Chave e segredo do webhook definidos" : "STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET ausentes: assinaturas desativadas"],
    ["Preço do Plus", Boolean(e.STRIPE_PRICE_PLUS_MONTHLY), e.STRIPE_PRICE_PLUS_MONTHLY ?? "STRIPE_PRICE_PLUS_MONTHLY ausente"],
    [
      "Estação de streaming própria",
      backend.state === "online",
      backend.state === "not_configured" ? "CLOUD_STREAM_URL não definido" : backend.state === "online" ? `No ar (${backend.latencyMs} ms)` : `Fora do ar: ${backend.error}`,
    ],
    ["E-mail de suporte", Boolean(e.SUPPORT_EMAIL), e.SUPPORT_EMAIL ?? "SUPPORT_EMAIL não definido"],
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="numeros">
        <h1 id="numeros" className="text-2xl font-bold">
          Visão geral
        </h1>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Usuários" value={formatInt(stats.users)} />
          <Stat label="Assinaturas ativas" value={formatInt(stats.activeSubscriptions)} />
          <Stat label="Jogos abertos (7 dias)" value={formatInt(stats.plays7)} />
          <Stat label="Tempo no player (7 dias)" value={formatDuration(stats.seconds7)} hint="Só jogos que rodam no site; idas a serviços de nuvem não têm duração." />
        </dl>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Mais abertos (7 dias)</h2>
          {stats.topGames.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Ainda sem dados.</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {stats.topGames.map((t) => (
                <li key={t.gameId} className="flex justify-between gap-3">
                  <span>{names.get(t.gameId) ?? t.gameId}</span>
                  <span className="tabular-nums text-muted">{formatInt(t.plays)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Como os jogos foram abertos (7 dias)</h2>
          {stats.byInput.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Ainda sem dados.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {stats.byInput.map((b) => (
                <li key={b.input} className="flex justify-between gap-3">
                  <span>{b.input.startsWith("servico:") ? `Serviço: ${b.input.slice(8)}` : b.input}</span>
                  <span className="tabular-nums text-muted">{formatInt(b.plays)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card p-5" aria-labelledby="integracoes">
        <h2 id="integracoes" className="font-semibold">
          Estado das integrações
        </h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {checks.map(([name, ok, detail]) => (
            <li key={name} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">{name}</span>
              <span className="flex items-center gap-2 text-muted">
                <span className={`h-2 w-2 rounded-full ${ok ? "bg-accent" : "bg-warning"}`} aria-hidden />
                {detail}
              </span>
            </li>
          ))}
          {ADAPTERS.filter((a) => a.id === "itchio" || a.id === "gamedistribution").map((a) => (
            <li key={a.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">Provedor {a.name}</span>
              <span className="text-muted">{isProviderEnabled(a.id) ? "Ativo" : "Desativado"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5" aria-labelledby="pesquisa">
        <h2 id="pesquisa" className="font-semibold">
          Provedores pesquisados
        </h2>
        <p className="mt-1 text-sm text-muted">Resultado da pesquisa de APIs e programas de parceiros (detalhes em docs/PROVEDORES.md).</p>
        <ul className="mt-4 space-y-3">
          {PROVIDER_CANDIDATES.map((c) => {
            const [label, cls] = CANDIDATE_LABEL[c.status];
            return (
              <li key={c.name} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className={`chip ${cls}`}>{label}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{c.summary}</p>
                {c.source && (
                  <a href={c.source} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-accent hover:underline">
                    Fonte
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4" title={hint}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
    </div>
  );
}
