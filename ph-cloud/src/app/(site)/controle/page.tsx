import type { Metadata } from "next";
import Link from "next/link";
import { GamepadTester } from "@/components/input/GamepadTester";

export const metadata: Metadata = { title: "Testar controle", description: "Veja se o seu controle Bluetooth ou USB funciona no navegador." };

export default function ControllerTestPage() {
  return (
    <div className="shell max-w-5xl py-10">
      <p className="eyebrow">Controle</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">Testar controle</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Confira se o navegador reconhece o seu controle antes de abrir um jogo. Funciona com controles Xbox, PlayStation e outros compatíveis — a compatibilidade
        final depende do navegador e do jogo. Precisa parear? Veja a <Link href="/ajuda#controle" className="text-accent hover:underline">ajuda</Link>.
      </p>
      <div className="mt-8">
        <GamepadTester />
      </div>
    </div>
  );
}
