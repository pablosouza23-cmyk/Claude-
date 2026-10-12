import type { PublicGame } from "@/modules/catalog/types";

/* Provisório: substituído pelo player completo (barra flutuante, controles na tela etc.). */
export function GamePlayerPage({ game }: { game: PublicGame }) {
  return <p className="p-8 text-muted">Player de {game.title} em construção.</p>;
}
