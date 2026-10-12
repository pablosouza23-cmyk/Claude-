import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <div className="shell max-w-3xl py-10">
      <h1 className="text-3xl font-bold">Termos de uso</h1>
      <p className="mt-2 text-sm text-faint">Modelo inicial — revise com um advogado antes de publicar.</p>
      <div className="prose-phc mt-6">
        <h2>1. O que é o PH Cloud</h2>
        <p>
          O PH Cloud é um portal de jogos. Ele reúne um catálogo de jogos e leva o usuário aos serviços oficiais de cloud gaming (como Xbox Cloud Gaming e
          GeForce NOW) pelos links oficiais de cada jogo. O PH Cloud não hospeda, não transmite e não vende esses jogos, e não é afiliado às editoras nem aos
          serviços citados.
        </p>
        <h2>2. Contas de terceiros</h2>
        <p>
          Para jogar nos serviços de nuvem você usa a sua própria conta em cada serviço e aceita os termos dele. Assinaturas desses serviços (como Xbox Game
          Pass ou planos do GeForce NOW) são contratadas diretamente com eles.
        </p>
        <h2>3. Sua conta no PH Cloud</h2>
        <p>Você é responsável por manter sua senha em segredo. Podemos suspender contas usadas para fraude, abuso ou violação destes termos.</p>
        <h2>4. Planos pagos</h2>
        <p>
          Os planos do PH Cloud são cobrados mensalmente pelo processador de pagamentos indicado na tela de pagamento. Você pode cancelar a qualquer momento em
          Planos › Gerenciar assinatura; os benefícios seguem até o fim do período pago. O direito de arrependimento do Código de Defesa do Consumidor (7 dias)
          é respeitado.
        </p>
        <h2>5. Disponibilidade</h2>
        <p>
          Os catálogos dos serviços de nuvem mudam sem aviso: um jogo pode sair de um serviço. Mantemos as informações atualizadas, mas a disponibilidade final
          é sempre a do serviço.
        </p>
        <h2>6. Contato</h2>
        <p>Dúvidas sobre estes termos podem ser enviadas pela Central de ajuda.</p>
      </div>
    </div>
  );
}
