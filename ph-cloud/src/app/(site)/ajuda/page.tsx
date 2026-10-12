import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/config/env";

export const metadata: Metadata = { title: "Ajuda", description: "Como jogar na nuvem, conectar controle, planos e conta no PH Cloud." };

export default function HelpPage() {
  const support = env().SUPPORT_EMAIL;
  const items: { id: string; q: string; a: React.ReactNode }[] = [
    {
      id: "nuvem",
      q: "Como funcionam os jogos na nuvem (Fortnite, GTA V, EA SPORTS FC…)?",
      a: (
        <>
          <p>
            Esses jogos rodam nos servidores dos serviços oficiais — Xbox Cloud Gaming, GeForce NOW ou Boosteroid. No PH Cloud você escolhe o jogo e toca em
            <strong> Jogar</strong>; o jogo abre na página do serviço, em uma nova aba, e você entra com a conta dele (Microsoft, NVIDIA etc.).
          </p>
          <p>
            Alguns são gratuitos (como o Fortnite). Outros exigem a assinatura do serviço, como o Xbox Game Pass Ultimate, ou a compra do jogo. A página de cada
            jogo mostra o que é preciso.
          </p>
        </>
      ),
    },
    {
      id: "dentro",
      q: "Por que o jogo não roda dentro da página do PH Cloud?",
      a: (
        <p>
          Os serviços de nuvem não oferecem uma forma pública e autorizada de colocar o player deles dentro de outro site, e os jogos pertencem às editoras.
          Usar acessos não oficiais violaria os termos dos serviços e colocaria a sua conta em risco. Por isso levamos você ao link oficial.
        </p>
      ),
    },
    {
      id: "controle",
      q: "Como conecto um controle Bluetooth ou USB?",
      a: (
        <>
          <ul>
            <li>
              <strong>Android:</strong> Configurações › Dispositivos conectados › Parear novo dispositivo. Coloque o controle em modo de pareamento (Xbox: segure
              o botão de parear; DualSense/DualShock: segure Share + PS).
            </li>
            <li>
              <strong>iPhone e iPad:</strong> Ajustes › Bluetooth, com o controle em modo de pareamento.
            </li>
            <li>
              <strong>Windows e Mac:</strong> pareie pelo Bluetooth do sistema ou conecte pelo cabo USB.
            </li>
          </ul>
          <p>
            Depois, abra <Link href="/controle">Testar controle</Link> e aperte qualquer botão: o navegador só mostra o controle depois do primeiro toque em um
            botão. A compatibilidade depende do navegador e do jogo.
          </p>
        </>
      ),
    },
    {
      id: "conexao",
      q: "Qual internet preciso para jogar na nuvem?",
      a: <p>Os serviços recomendam de 15 a 20 Mbps ou mais, de preferência Wi-Fi de 5 GHz ou cabo. Quanto mais perto do roteador, melhor.</p>,
    },
    {
      id: "iphone",
      q: "Como jogar em tela cheia no iPhone?",
      a: (
        <p>
          O Safari do iPhone não permite tela cheia para páginas comuns. Toque em Compartilhar › Adicionar à Tela de Início: o PH Cloud abre como aplicativo,
          sem a barra do navegador. Os serviços de nuvem têm instruções próprias para isso.
        </p>
      ),
    },
    {
      id: "planos",
      q: "O plano do PH Cloud inclui Game Pass ou GeForce NOW?",
      a: (
        <p>
          Não. Os planos do PH Cloud são deste site. As assinaturas dos serviços de nuvem são contratadas diretamente com cada serviço. Veja os{" "}
          <Link href="/planos">planos</Link>.
        </p>
      ),
    },
    {
      id: "senha",
      q: "Esqueci minha senha. E agora?",
      a: support ? (
        <p>
          Escreva para <a href={`mailto:${support}`}>{support}</a> a partir do e-mail da sua conta e ajudamos a recuperar o acesso.
        </p>
      ) : (
        <p>A recuperação automática de senha por e-mail ainda não está disponível. Entre em contato com o responsável pelo site para recuperar o acesso.</p>
      ),
    },
    {
      id: "dados",
      q: "Como baixo ou apago meus dados?",
      a: (
        <p>
          Em <Link href="/perfil">Meu perfil</Link> › Seus dados (LGPD) você baixa uma cópia dos seus dados ou exclui a conta. Mais detalhes na{" "}
          <Link href="/privacidade">Política de privacidade</Link>.
        </p>
      ),
    },
  ];

  return (
    <div className="shell max-w-3xl py-10">
      <p className="eyebrow">Central de ajuda</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">Como podemos ajudar?</h1>
      <div className="mt-8 space-y-3">
        {items.map((i) => (
          <details key={i.id} id={i.id} className="card group scroll-mt-24 p-0 open:border-accent/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold">
              {i.q}
              <span aria-hidden className="text-accent transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="prose-phc px-5 pb-5 text-sm">{i.a}</div>
          </details>
        ))}
      </div>
      {support && (
        <p className="mt-8 text-sm text-muted">
          Não achou a resposta? Escreva para <a href={`mailto:${support}`} className="text-accent hover:underline">{support}</a>.
        </p>
      )}
    </div>
  );
}
