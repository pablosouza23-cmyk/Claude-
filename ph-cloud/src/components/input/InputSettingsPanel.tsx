"use client";

import { useEffect, useState } from "react";
import { ACTION_LABELS, ACTIONS, keyLabel, QUALITY_LABELS, RESERVED_CODES, type Action, type InputSettings } from "@/modules/input/settings";
import { resetSettings, updateSettings, useSettings } from "@/modules/input/store";
import { connectedPads, padDisplayName } from "@/modules/input/gamepad";

/* Painel de preferências de entrada, áudio e vídeo (página de configurações e barra do player). */
export function InputSettingsPanel({ compact = false }: { compact?: boolean }) {
  const s = useSettings();
  const [rebinding, setRebinding] = useState<Action | null>(null);
  const [pads, setPads] = useState<{ index: number; name: string }[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const refresh = () => setPads(connectedPads().map((p) => ({ index: p.index, name: padDisplayName(p.id) })));
    refresh();
    window.addEventListener("gamepadconnected", refresh);
    window.addEventListener("gamepaddisconnected", refresh);
    const t = setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("gamepadconnected", refresh);
      window.removeEventListener("gamepaddisconnected", refresh);
      clearInterval(t);
    };
  }, []);

  // Captura a próxima tecla para o atalho escolhido (sem atrapalhar campos de texto).
  useEffect(() => {
    if (!rebinding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") return setRebinding(null);
      if (RESERVED_CODES.has(e.code)) return;
      const bindings = { ...s.bindings } as Record<Action, string[]>;
      for (const a of ACTIONS) bindings[a] = bindings[a].filter((c) => c !== e.code);
      bindings[rebinding] = [e.code, ...bindings[rebinding]].slice(0, 2);
      updateSettings({ bindings });
      setRebinding(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [rebinding, s.bindings]);

  const set = <K extends keyof InputSettings>(k: K, v: InputSettings[K]) => updateSettings({ [k]: v } as Partial<InputSettings>);

  return (
    <div className="space-y-6">
      <Group title="Método de controle">
        <Segmented
          name="metodo"
          value={s.method}
          onChange={(v) => set("method", v as InputSettings["method"])}
          options={[
            ["auto", "Automático"],
            ["touch", "Toque"],
            ["keyboard", "Teclado e mouse"],
            ["gamepad", "Controle"],
          ]}
        />
        <p className="mt-2 text-xs text-muted">No automático, o PH Cloud usa o último tipo de entrada que você tocou.</p>
      </Group>

      <Group title="Controles na tela (toque)">
        <Segmented
          name="toque"
          value={s.touchControls}
          onChange={(v) => set("touchControls", v as InputSettings["touchControls"])}
          options={[
            ["auto", "Automático"],
            ["always", "Sempre mostrar"],
            ["never", "Nunca mostrar"],
          ]}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Range id="tamanho" label="Tamanho dos botões" value={s.buttonScale} min={0.7} max={1.5} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("buttonScale", v)} />
          <Range id="opacidade" label="Opacidade dos controles" value={s.opacity} min={0.2} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("opacity", v)} />
        </div>
        <div className="mt-4">
          <span className="label">Layout do controle virtual</span>
          <Segmented
            name="layout"
            value={s.layout}
            onChange={(v) => set("layout", v as InputSettings["layout"])}
            options={[
              ["default", "Padrão"],
              ["lefty", "Canhoto"],
              ["compact", "Compacto"],
            ]}
          />
        </div>
      </Group>

      <Group title="Sensibilidade e vibração">
        <Range id="sensibilidade" label="Sensibilidade (mira e direção)" value={s.sensitivity} min={0.2} max={3} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => set("sensitivity", v)} />
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={s.vibration} onChange={(e) => set("vibration", e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
          Vibração, quando o controle ou o celular permitir
        </label>
      </Group>

      <Group title="Controle principal">
        {pads.length === 0 ? (
          <p className="text-sm text-muted">Nenhum controle detectado. Conecte e aperte um botão.</p>
        ) : (
          <select className="input max-w-md" value={s.gamepadIndex ?? ""} onChange={(e) => set("gamepadIndex", e.target.value === "" ? null : Number(e.target.value))} aria-label="Controle principal">
            <option value="">Automático (primeiro conectado)</option>
            {pads.map((p) => (
              <option key={p.index} value={p.index}>
                {p.index + 1}. {p.name}
              </option>
            ))}
          </select>
        )}
      </Group>

      {!compact && (
        <Group title="Teclas">
          <p className="mb-3 text-xs text-muted">Clique em uma ação e aperte a nova tecla. Esc cancela. Atalhos reservados pelo navegador (como F5, F11 e Tab) não podem ser usados.</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {ACTIONS.map((a) => (
              <li key={a} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm">{ACTION_LABELS[a]}</span>
                <button type="button" onClick={() => setRebinding(a)} className={`btn btn-sm ${rebinding === a ? "btn-primary" : "btn-secondary"}`} aria-label={`Alterar tecla de ${ACTION_LABELS[a]}`}>
                  {rebinding === a ? "Aperte uma tecla…" : s.bindings[a].map(keyLabel).join(" / ") || "—"}
                </button>
              </li>
            ))}
          </ul>
        </Group>
      )}

      <Group title="Áudio">
        <Range id="volume" label="Volume" value={s.volume} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("volume", v)} />
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={s.muted} onChange={(e) => set("muted", e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
          Sem som
        </label>
      </Group>

      <Group title="Qualidade de vídeo">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(QUALITY_LABELS) as InputSettings["quality"][]).map((q) => (
            <label key={q} className={`card flex cursor-pointer gap-3 p-3 ${s.quality === q ? "border-accent/60" : ""}`}>
              <input type="radio" name="qualidade" checked={s.quality === q} onChange={() => set("quality", q)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
              <span>
                <span className="block text-sm font-semibold">{QUALITY_LABELS[q].label}</span>
                <span className="block text-xs text-muted">{QUALITY_LABELS[q].detail}</span>
              </span>
            </label>
          ))}
        </div>
      </Group>

      <p className="text-xs text-muted">
        Estas preferências valem para os jogos que rodam dentro do PH Cloud. Nos serviços de nuvem (Xbox Cloud Gaming, GeForce NOW), controles, som e
        qualidade são ajustados no próprio serviço.
      </p>

      <div>
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Voltar tudo ao padrão?</span>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                resetSettings();
                setConfirmReset(false);
              }}
            >
              Restaurar
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmReset(true)}>
            Restaurar configurações padrão
          </button>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Segmented({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-bg-2 p-1">
      {options.map(([v, l]) => (
        <label key={v} className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${value === v ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
          {l}
        </label>
      ))}
    </div>
  );
}

function Range({ id, label, value, min, max, step, format, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="label !mb-1">
          {label}
        </label>
        <span className="text-sm tabular-nums text-muted">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
    </div>
  );
}
