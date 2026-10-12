import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { getCatalog } from "@/modules/catalog/repository";
import type { StreamService } from "@/modules/catalog/types";
import { checkBackend } from "@/modules/cloud-streaming/backend";
import { STREAM_SERVICES } from "@/modules/cloud-streaming/services";
import { getUserPlan } from "@/modules/subscriptions/entitlements";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Cloud Play",
  description: "Jogue títulos de PC e console na nuvem pelos serviços oficiais: Xbox Cloud Gaming, GeForce NOW e Boosteroid.",
};

export default async function CloudPlayPage() {
  const [catalog, backend, user] = await Promise.all([getCatalog(), checkBackend(), getCurrentUser()]);
  const plan = await getUserPlan(user);
  const count = (sv: StreamService) => catalog.filter((g) => g.streams?.some((s) => s.service === sv)).length;

  return (
    <div className="shell py-10">
      <p className="eyebrow">Cloud Play</p>
      <h1 className="mt-2 text-3xl font-bold md:text-5xl">Jogos de PC e console na nuvem</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Nos jogos de nuvem, o jogo roda em um computador potente do serviço e chega até você como vídeo. Você joga pelo navegador do celular, tablet ou
        computador, sem instalar nada.
      </p>

      <section className="mt-10" aria-labelledby="servicos">
        <h2 id="servicos" className="text-xl font-semibold">
          Serviços oficiais
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(STREAM_SERVICES) as StreamService[]).map((sv) => {
            const info = STREAM_SERVICES[sv];
            const n = count(sv);
            return (
              <article key={sv} className="card flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent">
                    <Icon name="cloud" />
                  </span>
                  <h3 className="text-lg font-semibold">{info.name}</h3>
                </div>
                <dl className="mt-4 flex-1 space-y-2 text-sm">
                  <div>
                    <dt className="text-muted">Conta</dt>
                    <dd>{info.account}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Grátis?</dt>
                    <dd>{info.freeTier}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">No Brasil</dt>
                    <dd>{info.brazil}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Navegadores</dt>
                    <dd>{info.browsers}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  {n > 0 && (
                    <Link href={`/jogos?servico=${sv}`} className="btn btn-primary btn-sm">
                      {n === 1 ? "1 jogo no catálogo" : `${n} jogos no catálogo`}
                    </Link>
                  )}
                  <a href={info.website} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    Site oficial
                    <Icon name="external" size={14} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2" aria-labelledby="estacao">
        <div className="card p-6">
          <h2 id="estacao" className="text-xl font-semibold">
            Estação PH Cloud (servidor próprio)
          </h2>
          {backend.state === "not_configured" && (
            <>
              <p className="mt-2 text-sm text-muted">
                Nenhum servidor de streaming próprio está conectado a este site. Um site não cria processador, memória ou placa de vídeo sozinho: para isso é preciso
                um servidor com GPU rodando um sistema de streaming, como Selkies ou Neko.
              </p>
              <p className="mt-3 text-sm">
                <span className="chip">Status: não configurado</span>
              </p>
            </>
          )}
          {backend.state === "offline" && (
            <>
              <p className="mt-2 text-sm text-muted">A estação “{backend.name}” está configurada, mas não respondeu ({backend.error}).</p>
              <p className="mt-3">
                <span className="chip chip-danger">Fora do ar</span>
              </p>
            </>
          )}
          {backend.state === "online" && (
            <>
              <p className="mt-2 text-sm text-muted">
                “{backend.name}” está no ar. Tempo de resposta do servidor: {backend.latencyMs} ms (medido pelo site, não é a latência do jogo).
              </p>
              <div className="mt-4">
                {plan.entitlements.cloudPlayMinutesPerMonth > 0 ? (
                  <Link href="/cloud-play/sessao" className="btn btn-primary">
                    <Icon name="play" size={16} />
                    Abrir a estação
                  </Link>
                ) : (
                  <Link href="/planos" className="btn btn-primary">
                    Disponível no plano Ultimate
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
        <div className="card p-6">
          <h2 className="text-xl font-semibold">Por que o jogo abre no site do serviço?</h2>
          <div className="prose-phc mt-2 text-sm">
            <p>
              Xbox Cloud Gaming, GeForce NOW e Boosteroid não oferecem uma forma pública de colocar o player deles dentro de outro site. Por isso o PH Cloud
              mostra o catálogo e leva você direto ao jogo pelo link oficial; a partida acontece na página do serviço, com a sua conta.
            </p>
            <p>
              Para jogos rodando dentro do próprio PH Cloud, o caminho é um contrato com uma plataforma de nuvem para empresas (como a Blacknut, que oferece SDK
              a parceiros) ou servidores próprios com licença dos jogos.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
