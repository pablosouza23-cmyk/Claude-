"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, registerAction, type FormState } from "@/server/auth/actions";
import { Icon } from "@/components/ui/Icon";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger">
      {msg}
    </p>
  );
}

function PasswordInput({ id, name, autoComplete, invalid, describedBy }: { id: string; name: string; autoComplete: string; invalid: boolean; describedBy?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        className="input pr-12"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-text"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
      >
        <Icon name={show ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p role="alert" className="notice notice-danger">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" aria-invalid={!!fe.email || undefined} aria-describedby={fe.email ? "email-erro" : undefined} />
        <FieldError id="email-erro" msg={fe.email} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">
            Senha
          </label>
          <Link href="/ajuda#senha" className="mb-1.5 text-xs font-medium text-muted hover:text-accent">
            Esqueci minha senha
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" invalid={!!fe.password} describedBy={fe.password ? "senha-erro" : undefined} />
        <FieldError id="senha-erro" msg={fe.password} />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p role="alert" className="notice notice-danger">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="name" className="label">
          Nome
        </label>
        <input id="name" name="name" autoComplete="nickname" required maxLength={60} className="input" aria-invalid={!!fe.name || undefined} aria-describedby={fe.name ? "nome-erro" : undefined} />
        <FieldError id="nome-erro" msg={fe.name} />
      </div>
      <div>
        <label htmlFor="email" className="label">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" aria-invalid={!!fe.email || undefined} aria-describedby={fe.email ? "email-erro" : undefined} />
        <FieldError id="email-erro" msg={fe.email} />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Senha
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fe.password} describedBy={fe.password ? "senha-erro" : "senha-dica"} />
        {fe.password ? <FieldError id="senha-erro" msg={fe.password} /> : <p id="senha-dica" className="mt-1.5 text-xs text-faint">Mínimo de 8 caracteres.</p>}
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="terms" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]" aria-invalid={!!fe.terms || undefined} aria-describedby={fe.terms ? "termos-erro" : undefined} />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" className="font-medium text-accent hover:underline" target="_blank">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="font-medium text-accent hover:underline" target="_blank">
              Política de privacidade
            </Link>
            .
          </span>
        </label>
        <FieldError id="termos-erro" msg={fe.terms} />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </button>
    </form>
  );
}
