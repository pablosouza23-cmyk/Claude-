import Link from "next/link";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Administração", robots: { index: false } };

const LINKS = [
  ["/admin", "Visão geral"],
  ["/admin/jogos", "Jogos"],
  ["/admin/avisos", "Avisos"],
  ["/admin/usuarios", "Usuários"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="shell py-8">
      <p className="eyebrow">Administração</p>
      <nav aria-label="Administração" className="mt-3 flex gap-1 overflow-x-auto border-b border-line">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-muted hover:text-text">
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
