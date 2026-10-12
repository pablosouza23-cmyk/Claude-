import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <div className="shell max-w-3xl py-10">
      <h1 className="text-3xl font-bold">Política de privacidade (LGPD)</h1>
      <p className="mt-2 text-sm text-faint">Modelo inicial — revise com um advogado e indique o controlador e o encarregado (DPO) antes de publicar.</p>
      <div className="prose-phc mt-6">
        <h2>Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Conta:</strong> nome, e-mail e senha (guardada só como hash criptográfico, nunca em texto).
          </li>
          <li>
            <strong>Uso:</strong> favoritos, histórico de jogos, preferências de controle e registros de uso (qual jogo foi aberto, duração e tipo de entrada).
            Não guardamos o seu endereço IP nesses registros.
          </li>
          <li>
            <strong>Sessões:</strong> data de acesso e o navegador/aparelho, para você ver e encerrar sessões no perfil.
          </li>
          <li>
            <strong>Pagamentos:</strong> processados pelo Stripe. O PH Cloud não recebe nem armazena dados de cartão; guardamos só o status da assinatura.
          </li>
        </ul>
        <h2>Para que usamos</h2>
        <p>Para manter sua conta, mostrar sua biblioteca, ordenar o catálogo pelos jogos mais abertos e cobrar planos pagos (execução de contrato).</p>
        <h2>Cookies</h2>
        <p>
          Usamos apenas um cookie essencial de sessão (para manter você conectado). Não usamos cookies de publicidade nem ferramentas de rastreamento de
          terceiros. Preferências de visitantes ficam no armazenamento local do navegador.
        </p>
        <h2>Serviços de terceiros</h2>
        <p>
          Ao clicar em “Jogar” você vai para o site do serviço de nuvem escolhido (Microsoft, NVIDIA/ABYA, Boosteroid), que tem a própria política de
          privacidade.
        </p>
        <h2>Seus direitos</h2>
        <p>
          Você pode acessar, corrigir, baixar e excluir seus dados a qualquer momento em <Link href="/perfil">Meu perfil</Link>. A exclusão da conta apaga
          favoritos, histórico, preferências e salvamentos, e cancela assinaturas ativas.
        </p>
      </div>
    </div>
  );
}
