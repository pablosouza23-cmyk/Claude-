import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line pb-24 pt-10 md:pb-10">
      <div className="shell grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display font-bold">PH Cloud</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted">
            Portal brasileiro de jogos na nuvem. Os jogos rodam nos serviços oficiais (Xbox Cloud Gaming, GeForce NOW): o PH Cloud leva você ao link oficial de cada um.
          </p>
        </div>
        <FooterCol title="Explorar" links={[["/jogos", "Todos os jogos"], ["/cloud-play", "Cloud Play"], ["/planos", "Planos"]]} />
        <FooterCol title="Ajuda" links={[["/ajuda", "Central de ajuda"], ["/controle", "Testar controle"], ["/configuracoes", "Configurações"]]} />
        <FooterCol title="Legal" links={[["/termos", "Termos de uso"], ["/privacidade", "Privacidade (LGPD)"]]} />
      </div>
      <div className="shell mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-faint md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} PH Cloud. Todos os direitos reservados.</p>
        <p>Xbox, PlayStation, GeForce NOW e demais marcas citadas pertencem aos seus donos. O PH Cloud não é afiliado a elas.</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-text">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
