"use client";

import { useActionState, useState } from "react";
import { saveEntryAction } from "@/modules/admin/actions";
import type { FormState } from "@/server/auth/actions";
import { GENRES, INPUT_LABELS, DEVICE_LABELS, type StreamService } from "@/modules/catalog/types";
import { ACCESS_LABELS, STREAM_SERVICES } from "@/modules/cloud-streaming/services";

export type EntryInitial = {
  id: string;
  title: string;
  description: string;
  launchType: string;
  provider: string;
  launchUrl: string;
  developer: string;
  coverUrl: string;
  genres: string[];
  inputs: string[];
  devices: string[];
  ageRating: string;
  limitations: string;
  permissionNote: string;
  streams: { service: string; url: string; access: string; note?: string }[];
};

const HINTS: Record<StreamService, string> = {
  xbox: "Link da página “Jogar” do jogo: https://www.xbox.com/pt-BR/play/games/…",
  geforcenow: "Cole o link da página do jogo em play.geforcenow.com ou só o game-id.",
  boosteroid: "Link da página do jogo em cloud.boosteroid.com.",
};

export function EntryForm({ initial, embedProviders }: { initial?: EntryInitial; embedProviders: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntryAction, {});
  const [launchType, setLaunchType] = useState(initial?.launchType ?? "official_streaming");
  const stream = (sv: string) => initial?.streams.find((s) => s.service === sv);

  return (
    <form action={action} className="space-y-5">
      {initial && <input type="hidden" name="editing" value="1" />}
      {state.error && (
        <p role="alert" className="notice notice-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="notice notice-success">
          {state.message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título" name="title" defaultValue={initial?.title} required />
        <Field label="Identificador (endereço da página)" name="id" defaultValue={initial?.id} readOnly={Boolean(initial)} required hint="Ex.: apex-legends → /jogos/apex-legends" />
      </div>
      <div>
        <label className="label" htmlFor="description">
          Descrição
        </label>
        <textarea id="description" name="description" defaultValue={initial?.description} required rows={3} maxLength={400} className="input" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Desenvolvedor / editora" name="developer" defaultValue={initial?.developer} />
        <Field label="Classificação indicativa" name="ageRating" defaultValue={initial?.ageRating} hint="L, 10, 12, 14, 16 ou 18" />
        <Field label="Capa (opcional)" name="coverUrl" defaultValue={initial?.coverUrl} hint="URL https. Use arte oficial só com permissão." />
      </div>

      <fieldset>
        <legend className="label">Como o jogo abre</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["official_streaming", "Serviço de nuvem oficial"],
            ...(embedProviders.length ? [["authorized_embed", "Incorporado no site (provedor autorizado)"]] : []),
            ["external_provider", "Link para o site do jogo"],
          ].map(([v, l]) => (
            <label key={v} className={`chip cursor-pointer !px-3 !py-1.5 !text-sm ${launchType === v ? "chip-accent" : ""}`}>
              <input type="radio" name="launchType" value={v} checked={launchType === v} onChange={() => setLaunchType(v!)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      {launchType === "official_streaming" ? (
        <div className="space-y-4">
          {(Object.keys(STREAM_SERVICES) as StreamService[]).map((sv) => (
            <div key={sv} className="rounded-xl border border-line p-4">
              <p className="font-semibold">{STREAM_SERVICES[sv].name}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
                <Field label="Link oficial (deixe vazio se o jogo não está neste serviço)" name={`stream_${sv}_url`} defaultValue={stream(sv)?.url} hint={HINTS[sv]} />
                <div>
                  <label className="label" htmlFor={`stream_${sv}_access`}>
                    O que precisa
                  </label>
                  <select id={`stream_${sv}_access`} name={`stream_${sv}_access`} defaultValue={stream(sv)?.access ?? "free"} className="input">
                    {Object.entries(ACCESS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <Field label="Observação para o jogador" name={`stream_${sv}_note`} defaultValue={stream(sv)?.note} hint="Ex.: Requer Xbox Game Pass Ultimate." />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div>
            <label className="label" htmlFor="provider">
              Provedor
            </label>
            <select id="provider" name="provider" defaultValue={initial?.provider ?? (launchType === "external_provider" ? "external" : embedProviders[0]?.id)} className="input">
              {launchType === "external_provider" && <option value="external">Site oficial</option>}
              {embedProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Field label={launchType === "authorized_embed" ? "Código ou URL de incorporação oficial" : "Link oficial"} name="launchUrl" defaultValue={initial?.launchUrl} required />
        </div>
      )}

      <CheckGroup legend="Gêneros" name="genres" options={Object.entries(GENRES)} selected={initial?.genres ?? []} />
      <CheckGroup legend="Controles" name="inputs" options={Object.entries(INPUT_LABELS)} selected={initial?.inputs ?? ["gamepad"]} />
      <CheckGroup legend="Aparelhos" name="devices" options={Object.entries(DEVICE_LABELS)} selected={initial?.devices ?? ["mobile", "tablet", "desktop"]} />

      <div>
        <label className="label" htmlFor="limitations">
          Limitações conhecidas (uma por linha)
        </label>
        <textarea id="limitations" name="limitations" defaultValue={initial?.limitations} rows={2} className="input" />
      </div>
      <Field
        label="Origem da permissão"
        name="permissionNote"
        defaultValue={initial?.permissionNote ?? "Link oficial público do serviço de nuvem; o jogo roda no serviço."}
        required
        hint="Registro interno: por que o PH Cloud pode exibir este jogo."
      />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar jogo"}
      </button>
    </form>
  );
}

function Field({ label, name, defaultValue, required, readOnly, hint }: { label: string; name: string; defaultValue?: string; required?: boolean; readOnly?: boolean; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} defaultValue={defaultValue} required={required} readOnly={readOnly} className="input" autoComplete="off" />
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

function CheckGroup({ legend, name, options, selected }: { legend: string; name: string; options: [string, string][]; selected: string[] }) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm">
            <input type="checkbox" name={name} value={v} defaultChecked={selected.includes(v)} className="h-4 w-4 accent-[var(--color-accent)]" />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
