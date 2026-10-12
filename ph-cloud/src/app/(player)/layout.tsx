/* Layout mínimo do player: sem cabeçalho nem rodapé, o jogo é o foco. */
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh bg-black">{children}</main>;
}
