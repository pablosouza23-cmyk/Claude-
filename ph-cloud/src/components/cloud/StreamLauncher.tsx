"use client";

import { Icon } from "@/components/ui/Icon";
import type { StreamOption } from "@/modules/catalog/types";
import { ACCESS_LABELS, STREAM_SERVICES } from "@/modules/cloud-streaming/services";
import { localLibrary } from "@/modules/library/local";

/** Registra a ida ao serviço (histórico e popularidade). Não bloqueia a abertura do link. */
function track(gameId: string, service: string, loggedIn: boolean) {
  const body = JSON.stringify({ gameId, service });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/play/launch", new Blob([body], { type: "application/json" }));
    else fetch("/api/play/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* sem métricas, segue */
  }
  if (!loggedIn) localLibrary.recordPlay(gameId, 0);
}

export function StreamLauncher({ gameId, gameTitle, streams, loggedIn, variant = "cards" }: { gameId: string; gameTitle: string; streams: StreamOption[]; loggedIn: boolean; variant?: "cards" | "compact" }) {
  if (streams.length === 0) return <p className="text-sm text-muted">Este jogo não está disponível em nenhum serviço de nuvem no momento.</p>;
  return (
    <ul className={variant === "cards" ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
      {streams.map((s) => {
        const info = STREAM_SERVICES[s.service];
        return (
          <li key={s.service + s.url} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{info.name}</p>
                <p className="mt-0.5 text-xs text-muted">{info.account}</p>
              </div>
              <span className={`chip ${s.access === "free" ? "chip-accent" : "chip-warning"}`}>{ACCESS_LABELS[s.access]}</span>
            </div>
            {s.note && <p className="text-sm text-[#cfd9d6]">{s.note}</p>}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(gameId, s.service, loggedIn)}
              className="btn btn-primary mt-auto"
              aria-label={`${info.cta}: ${gameTitle} (abre em nova aba)`}
            >
              <Icon name="play" size={16} />
              {info.cta}
              <Icon name="external" size={15} className="opacity-70" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function ServiceChips({ streams }: { streams?: StreamOption[] }) {
  if (!streams?.length) return null;
  const free = streams.some((s) => s.access === "free");
  return (
    <span className="flex flex-wrap gap-1.5">
      {free && <span className="chip chip-accent">Grátis</span>}
      {[...new Set(streams.map((s) => s.service))].map((sv) => (
        <span key={sv} className="chip bg-black/55 backdrop-blur">
          {STREAM_SERVICES[sv].name}
        </span>
      ))}
    </span>
  );
}
