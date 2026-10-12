"use client";

import { useActionState, useState } from "react";
import { AVATARS, avatarUrl } from "@/config/avatars";
import type { FormState } from "@/server/auth/actions";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "@/server/auth/account-actions";

function Status({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="notice notice-danger">
        {state.error}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="notice notice-success">
        {state.message}
      </p>
    );
  return null;
}

export function ProfileForm({ name, avatar }: { name: string; avatar: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  const [selected, setSelected] = useState(avatar);
  return (
    <form action={action} className="space-y-5">
      <Status state={state} />
      <fieldset>
        <legend className="label">Avatar</legend>
        <div className="mt-2 grid max-w-lg grid-cols-4 gap-3 sm:grid-cols-8">
          {AVATARS.map((a) => (
            <label key={a.id} className="relative cursor-pointer">
              <input type="radio" name="avatar" value={a.id} checked={selected === a.id} onChange={() => setSelected(a.id)} className="peer sr-only" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl(a.id)} alt={a.label} width={64} height={64} className="aspect-square w-full rounded-full ring-2 ring-transparent transition peer-checked:ring-accent peer-focus-visible:ring-accent/60" />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="max-w-sm">
        <label htmlFor="name" className="label">
          Nome exibido
        </label>
        <input id="name" name="name" defaultValue={name} required maxLength={60} className="input" autoComplete="nickname" />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar perfil"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="max-w-sm space-y-4">
      <Status state={state} />
      <div>
        <label htmlFor="current" className="label">
          Senha atual
        </label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label htmlFor="next-password" className="label">
          Nova senha
        </label>
        <input id="next-password" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <button className="btn btn-secondary" disabled={pending}>
        {pending ? "Alterando…" : "Alterar senha"}
      </button>
    </form>
  );
}

export function DeleteAccountForm({ hasSubscription }: { hasSubscription: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, {});
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn btn-danger self-start" onClick={() => setOpen(true)}>
        Excluir minha conta
      </button>
    );
  return (
    <form action={action} className="max-w-sm space-y-4">
      <p className="text-sm text-muted">
        Isso apaga sua conta, favoritos, histórico, preferências e salvamentos na nuvem. Não dá para desfazer.
        {hasSubscription && " Sua assinatura será cancelada na hora."}
      </p>
      <Status state={state} />
      <div>
        <label htmlFor="del-password" className="label">
          Sua senha
        </label>
        <input id="del-password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Digite EXCLUIR para confirmar
        </label>
        <input id="confirm" name="confirm" required className="input" autoComplete="off" />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-danger" disabled={pending}>
          {pending ? "Excluindo…" : "Excluir definitivamente"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
