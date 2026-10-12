import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StreamLauncher } from "@/components/cloud/StreamLauncher";
import { LogoMark } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { getGame } from "@/modules/catalog/repository";
import { isCloudGame, isLaunchable } from "@/modules/catalog/types";
import { getCurrentUser } from "@/server/auth/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = await getGame((await params).id);
  return { title: game ? `Jogar ${game.title}` : "Jogo não encontrado", robots: { index: false } };
}

export default async function PlayPage({ params }: Props) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game || !isLaunchable(game)) notFound();
  const user = await getCurrentUser();

  if (isCloudGame(game)) {
    return (
      <div className="relative isolate min-h-dvh overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.backgroundUrl ?? game.coverUrl} alt="" className="h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
        </div>
        <div className="mx-auto flex min-h-dvh w-[min(880px,100%-2rem)] flex-col py-6">
          <div className="flex items-center justify-between">
            <Link href={`/jogos/${game.id}`} className="btn btn-secondary btn-sm">
              <Icon name="arrowLeft" size={16} />
              Voltar
            </Link>
            <Link href="/" aria-label="PH Cloud — início">
              <LogoMark size={32} />
            </Link>
          </div>
          <div className="my-auto py-10">
            <p className="eyebrow">Jogar na nuvem</p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">{game.title}</h1>
            <p className="mt-3 max-w-2xl text-[#cfd9d6]">
              Escolha o serviço. O jogo roda nos servidores dele e abre na página oficial, em uma nova aba — entre com a sua conta do serviço e jogue.
            </p>
            <div className="mt-8">
              <StreamLauncher gameId={game.id} gameTitle={game.title} streams={game.streams ?? []} loggedIn={Boolean(user)} />
            </div>
            <ul className="mt-8 grid gap-3 text-sm text-muted sm:grid-cols-3">
              <li className="flex gap-2">
                <Icon name="gamepad" size={18} className="shrink-0 text-accent" />
                Conecte o controle antes de abrir o jogo. Teste em <Link href="/controle" className="text-accent hover:underline">Testar controle</Link>.
              </li>
              <li className="flex gap-2">
                <Icon name="wifi" size={18} className="shrink-0 text-accent" />
                Use Wi-Fi de 5 GHz ou cabo. Os serviços recomendam pelo menos 15 a 20 Mbps.
              </li>
              <li className="flex gap-2">
                <Icon name="phone" size={18} className="shrink-0 text-accent" />
                No celular, jogue com o aparelho na horizontal.
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Jogos que rodam dentro do PH Cloud (SDK / incorporação autorizada).
  const { GamePlayerPage } = await import("@/components/player/GamePlayerPage");
  return <GamePlayerPage game={game} />;
}
