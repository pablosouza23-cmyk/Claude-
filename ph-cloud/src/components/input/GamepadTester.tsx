"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { buttonNames, connectedPads, FAMILY_LABEL, padDisplayName, padFamily, rumble } from "@/modules/input/gamepad";
import { updateSettings, useSettings } from "@/modules/input/store";

type Snapshot = { index: number; id: string; mapping: string; buttons: number[]; axes: number[]; vibration: boolean };

export function GamepadTester() {
  const supported = useSyncExternalStore(
    () => () => {},
    () => "getGamepads" in navigator,
    () => true,
  );
  const [pads, setPads] = useState<Snapshot[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [rumbleMsg, setRumbleMsg] = useState<string | null>(null);
  const settings = useSettings();
  const raf = useRef(0);

  useEffect(() => {
    if (!("getGamepads" in navigator)) return;
    const add = (msg: string) => setLog((l) => [`${new Date().toLocaleTimeString("pt-BR")} — ${msg}`, ...l].slice(0, 8));
    const onConnect = (e: GamepadEvent) => add(`Conectado: ${padDisplayName(e.gamepad.id)} (posição ${e.gamepad.index + 1})`);
    const onDisconnect = (e: GamepadEvent) => add(`Desconectado: ${padDisplayName(e.gamepad.id)}`);
    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);
    const loop = () => {
      setPads(
        connectedPads().map((p) => ({
          index: p.index,
          id: p.id,
          mapping: p.mapping,
          buttons: p.buttons.map((b) => (b.pressed ? Math.max(b.value, 1) : b.value)),
          axes: [...p.axes],
          vibration: Boolean((p as Gamepad & { vibrationActuator?: unknown }).vibrationActuator),
        })),
      );
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, []);

  const testRumble = async (index: number) => {
    const pad = connectedPads().find((p) => p.index === index);
    const ok = pad ? await rumble(pad) : false;
    setRumbleMsg(ok ? "Vibração enviada." : "Este controle ou navegador não permite vibração pela web.");
  };

  if (!supported) {
    return <p className="notice notice-warning">Este navegador não oferece suporte a controles (Gamepad API). Tente Chrome, Edge, Firefox ou Safari atualizados.</p>;
  }

  return (
    <div className="space-y-6">
      {pads.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-accent">
            <Icon name="gamepad" size={32} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Nenhum controle detectado</h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Conecte o controle por Bluetooth ou USB e <strong>aperte qualquer botão</strong>: por privacidade, o navegador só mostra o controle depois do primeiro
            toque em um botão.
          </p>
        </div>
      ) : (
        pads.map((p) => {
          const family = padFamily(p.id);
          const names = buttonNames(family);
          const active = settings.gamepadIndex === null ? pads[0]?.index === p.index : settings.gamepadIndex === p.index;
          return (
            <section key={p.index} className="card p-5" aria-label={`Controle ${p.index + 1}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">
                    Posição {p.index + 1} · {FAMILY_LABEL[family]}
                  </p>
                  <h2 className="font-semibold">{padDisplayName(p.id)}</h2>
                  {p.mapping !== "standard" && (
                    <p className="mt-1 text-xs text-warning">Mapeamento não padrão: alguns botões podem aparecer em posições diferentes ou não funcionar nos jogos.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`} onClick={() => updateSettings({ gamepadIndex: p.index })} aria-pressed={active}>
                    {active ? "Controle principal" : "Usar como principal"}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => testRumble(p.index)} disabled={!p.vibration}>
                    Testar vibração
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr]">
                <div className="flex gap-6">
                  <Stick label="Analógico esquerdo" x={p.axes[0] ?? 0} y={p.axes[1] ?? 0} pressed={(p.buttons[10] ?? 0) > 0.5} />
                  <Stick label="Analógico direito" x={p.axes[2] ?? 0} y={p.axes[3] ?? 0} pressed={(p.buttons[11] ?? 0) > 0.5} />
                </div>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-9">
                  {p.buttons.map((v, i) => (
                    <li
                      key={i}
                      className={`flex h-12 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                        v > 0.05 ? "border-accent bg-accent/20 text-accent-strong" : "border-line bg-bg-2 text-muted"
                      }`}
                    >
                      <span>{names[i] ?? `B${i}`}</span>
                      {v > 0.05 && v < 1 && <span className="text-[10px] opacity-80">{Math.round(v * 100)}%</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })
      )}
      {rumbleMsg && (
        <p role="status" className="text-sm text-muted">
          {rumbleMsg}
        </p>
      )}
      {log.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Eventos</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted" aria-live="polite">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stick({ label, x, y, pressed }: { label: string; x: number; y: number; pressed: boolean }) {
  return (
    <figure className="text-center">
      <div className={`relative h-24 w-24 rounded-full border-2 ${pressed ? "border-accent" : "border-line-2"} bg-bg-2`}>
        <span
          className="absolute h-7 w-7 rounded-full bg-accent shadow-[0_0_12px_rgba(62,232,135,.6)]"
          style={{ left: `calc(50% + ${x * 34}px - 14px)`, top: `calc(50% + ${y * 34}px - 14px)` }}
        />
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        {label}
        <br />
        <span className="tabular-nums">
          {x.toFixed(2)}, {y.toFixed(2)}
        </span>
      </figcaption>
    </figure>
  );
}
