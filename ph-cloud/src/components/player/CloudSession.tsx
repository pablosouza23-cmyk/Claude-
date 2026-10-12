"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/* Sessão na estação própria: cliente web oficial do backend em iframe + tela cheia + contagem de tempo. */
export function CloudSession({ url, name, sessionId, mic, minutesLeft }: { url: string; name: string; sessionId: string; mic: boolean; minutesLeft: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(minutesLeft);
  const [stopped, setStopped] = useState(false);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const beat = async () => {
      try {
        const r = await fetch("/api/play/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
        const d = (await r.json()) as { minutesLeft?: number; stop?: boolean };
        if (typeof d.minutesLeft === "number") setLeft(d.minutesLeft);
        if (d.stop) setStopped(true);
      } catch {
        /* rede instável: tenta no próximo batimento */
      }
    };
    const t = setInterval(beat, 30_000);
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      clearInterval(t);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [sessionId]);

  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await box.current?.requestFullscreen();
    } catch {
      alert("Este navegador não permitiu a tela cheia. No iPhone, adicione o PH Cloud à Tela de Início.");
    }
  };

  return (
    <div ref={box} className="relative flex h-dvh flex-col bg-black">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-sm">
        <Link href="/cloud-play" className="btn btn-ghost btn-sm">
          <Icon name="arrowLeft" size={16} />
          Sair
        </Link>
        <span className="truncate text-muted">
          {name} · {left} min restantes neste mês
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleFs} aria-label={fs ? "Sair da tela cheia" : "Tela cheia"}>
          <Icon name={fs ? "exitFullscreen" : "fullscreen"} size={18} />
        </button>
      </div>
      {stopped ? (
        <div className="m-auto max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold">Seus minutos do mês acabaram</h1>
          <p className="mt-2 text-sm text-muted">O limite do seu plano foi atingido. Ele renova no início do próximo mês.</p>
          <Link href="/planos" className="btn btn-primary mt-5">
            Ver planos
          </Link>
        </div>
      ) : (
        <iframe
          src={url}
          title={`Estação ${name}`}
          className="w-full flex-1 border-0"
          allow={`autoplay; fullscreen; gamepad; clipboard-read; clipboard-write${mic ? "; microphone" : ""}`}
          allowFullScreen
        />
      )}
    </div>
  );
}
