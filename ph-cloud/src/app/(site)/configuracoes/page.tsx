import type { Metadata } from "next";
import Link from "next/link";
import { InputSettingsPanel } from "@/components/input/InputSettingsPanel";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  return (
    <div className="shell max-w-3xl py-10">
      <h1 className="text-3xl font-bold md:text-4xl">Configurações</h1>
      <p className="mt-2 text-sm text-muted">
        {user ? "Salvas neste aparelho e na sua conta." : (
          <>
            Salvas só neste aparelho. <Link href="/entrar?next=/configuracoes" className="text-accent hover:underline">Entre na conta</Link> para levá-las a outros aparelhos.
          </>
        )}
      </p>
      <div className="card mt-6 p-5 md:p-6">
        <InputSettingsPanel />
      </div>
    </div>
  );
}
