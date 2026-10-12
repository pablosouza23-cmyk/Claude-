"use client";

import { useActionState } from "react";
import { postNoticeAction } from "@/modules/admin/actions";
import type { FormState } from "@/server/auth/actions";

export function NoticeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(postNoticeAction, {});
  return (
    <form action={action} className="max-w-xl space-y-4">
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
      <div>
        <label htmlFor="n-title" className="label">
          Título
        </label>
        <input id="n-title" name="title" required maxLength={80} className="input" />
      </div>
      <div>
        <label htmlFor="n-body" className="label">
          Mensagem
        </label>
        <textarea id="n-body" name="body" required maxLength={400} rows={3} className="input" />
      </div>
      <div>
        <label htmlFor="n-link" className="label">
          Link interno (opcional)
        </label>
        <input id="n-link" name="link" placeholder="/jogos/fortnite" className="input" />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Publicando…" : "Publicar para todos"}
      </button>
    </form>
  );
}
