import Link from "next/link";
import { eq } from "drizzle-orm";
import { EntryForm, type EntryInitial } from "@/components/admin/EntryForm";
import { deleteEntryAction, setOverrideAction } from "@/modules/admin/actions";
import { getFullCatalog } from "@/modules/catalog/repository";
import { LAUNCH_LABELS } from "@/modules/catalog/types";
import { STREAM_SERVICES } from "@/modules/cloud-streaming/services";
import { enabledAdapters } from "@/modules/providers/registry";
import { getDb, schema } from "@/server/db";

export default async function AdminGamesPage({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const db = await getDb();
  const [catalog, entries] = await Promise.all([getFullCatalog(), db.select({ id: schema.catalogEntries.id }).from(schema.catalogEntries)]);
  const dbIds = new Set(entries.map((e) => e.id));
  const embedProviders = enabledAdapters()
    .filter((a) => a.launchTypes.includes("authorized_embed") && a.id !== "phcloud")
    .map((a) => ({ id: a.id, name: a.name }));

  let initial: EntryInitial | undefined;
  if (editar && dbIds.has(editar)) {
    const row = (await db.select().from(schema.catalogEntries).where(eq(schema.catalogEntries.id, editar)).limit(1))[0];
    if (row) {
      initial = {
        id: row.id,
        title: row.title,
        description: row.description,
        launchType: row.launchType,
        provider: row.provider,
        launchUrl: row.launchUrl,
        developer: row.developer ?? "",
        coverUrl: row.coverUrl ?? "",
        genres: row.genres,
        inputs: row.inputs,
        devices: row.devices,
        ageRating: row.ageRating ?? "",
        limitations: row.limitations ?? "",
        permissionNote: row.permissionNote,
        streams: row.streams,
      };
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Jogos ({catalog.length})</h1>
        <p className="mt-1 text-sm text-muted">
          Os jogos do código (como Fortnite e GTA V) podem ser ativados, desativados e destacados aqui. Jogos cadastrados por você também podem ser editados ou
          removidos. Os catálogos dos serviços mudam: revise os links de tempos em tempos.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Jogo</th>
                <th className="px-3 py-2.5 font-medium">Como abre</th>
                <th className="px-3 py-2.5 font-medium">Ativo</th>
                <th className="px-3 py-2.5 font-medium">Destaque</th>
                <th className="px-3 py-2.5 font-medium">Acesso no PH Cloud</th>
                <th className="px-3 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {catalog.map((g) => (
                <tr key={g.id} className={g.enabled ? "" : "opacity-60"}>
                  <td className="px-3 py-2.5">
                    <Link href={`/jogos/${g.id}`} className="font-medium hover:text-accent">
                      {g.title}
                    </Link>
                    <span className="block text-xs text-faint">
                      {g.id} · {dbIds.has(g.id) ? "cadastrado no painel" : "do código"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {g.streams?.length ? g.streams.map((s) => STREAM_SERVICES[s.service].name).join(", ") : LAUNCH_LABELS[g.launch.type]}
                  </td>
                  <td className="px-3 py-2.5">
                    <Toggle gameId={g.id} field="enabled" on={g.enabled} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Toggle gameId={g.id} field="featured" on={Boolean(g.featured)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <form action={setOverrideAction} className="flex items-center gap-2">
                      <input type="hidden" name="gameId" value={g.id} />
                      <input type="hidden" name="field" value="access" />
                      <input type="hidden" name="value" value={g.access === "premium" ? "free" : "premium"} />
                      <span className={`chip ${g.access === "premium" ? "chip-warning" : ""}`}>{g.access === "premium" ? "Premium" : "Todos"}</span>
                      <button className="text-xs text-accent hover:underline">Trocar</button>
                    </form>
                  </td>
                  <td className="px-3 py-2.5">
                    {dbIds.has(g.id) ? (
                      <div className="flex gap-3">
                        <Link href={`/admin/jogos?editar=${g.id}#formulario`} className="text-xs text-accent hover:underline">
                          Editar
                        </Link>
                        <form action={deleteEntryAction}>
                          <input type="hidden" name="id" value={g.id} />
                          <button className="text-xs text-danger hover:underline">Remover</button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="formulario" className="card scroll-mt-24 p-5 md:p-6">
        <h2 className="text-lg font-semibold">{initial ? `Editar ${initial.title}` : "Adicionar jogo"}</h2>
        <p className="mt-1 text-sm text-muted">
          Para jogos de nuvem, cole o link oficial da página do jogo em cada serviço. O PH Cloud valida o endereço e só aceita domínios oficiais.
        </p>
        <div className="mt-5">
          <EntryForm key={initial?.id ?? "novo"} initial={initial} embedProviders={embedProviders} />
        </div>
      </section>
    </div>
  );
}

function Toggle({ gameId, field, on }: { gameId: string; field: "enabled" | "featured"; on: boolean }) {
  return (
    <form action={setOverrideAction}>
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={on ? "false" : "true"} />
      <button
        role="switch"
        aria-checked={on}
        aria-label={`${field === "enabled" ? "Ativo" : "Destaque"}: ${on ? "sim" : "não"}`}
        className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-3"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </form>
  );
}
