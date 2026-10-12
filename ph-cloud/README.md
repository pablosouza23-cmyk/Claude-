# PH Cloud

Portal brasileiro de jogos na nuvem. O catálogo reúne jogos como **Fortnite, GTA V, EA SPORTS FC 26, Forza Horizon 5, Marvel Rivals, Rocket League, Counter-Strike 2 e Genshin Impact**. O botão **Jogar** leva o jogador direto ao jogo no serviço oficial onde ele roda (Xbox Cloud Gaming ou GeForce NOW), pelo link oficial de cada serviço.

Interface toda em português (pt-BR), valores em R$, datas no formato brasileiro.

## Como funciona (e o limite que não dá para contornar)

| O que | Como está |
|---|---|
| Jogos famosos (Fortnite, GTA V, FC…) | Rodam nos servidores do **Xbox Cloud Gaming** ou do **GeForce NOW**. O PH Cloud mostra o catálogo, explica o que é preciso (grátis, Game Pass, ter o jogo) e abre o jogo pelo link oficial, em nova aba. |
| Jogo rodando *dentro* da página do PH Cloud | **Nenhum serviço oferece API pública para isso.** Pesquisa completa em [`docs/PROVEDORES.md`](docs/PROVEDORES.md). O único caminho oficial é um contrato B2B (ex.: Blacknut, que oferece SDK a parceiros) ou servidores próprios com licença dos jogos. |
| Clientes não oficiais (API privada do Xbox) | **Não usados**: violam os termos da Microsoft, expõem as contas dos usuários e quebram a cada atualização. |

## Rodar localmente

Requisitos: Node.js 20.9+ (testado no 22).

```bash
cd ph-cloud
npm install
cp .env.example .env.local     # opcional: sem DATABASE_URL usa o banco embutido (PGlite)
npm run dev                    # http://localhost:3000
```

Sem nenhuma configuração o site funciona com banco embutido em `.data/` (contas, favoritos, histórico, painel). Para virar administrador, coloque seu e-mail em `ADMIN_EMAILS` e cadastre-se. Depois de mudar variáveis de ambiente, reinicie o servidor.

> O banco embutido (PGlite) é só para desenvolvimento ou um único servidor: encerre o servidor normalmente (Ctrl+C), pois matar o processo à força pode corromper os arquivos. Em produção, use PostgreSQL.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build && npm start` | Build e servidor de produção |
| `npm test` | Testes unitários (Node test runner) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Aplica migrações (também rodam sozinhas ao iniciar) |
| `npm run db:generate` | Gera migração após mudar `src/server/db/schema.ts` |

## O que está implementado

- **Catálogo** com busca (sem acento), filtros por serviço de nuvem, gênero, preço, controle, aparelho e provedor; ordenação por mais jogados (dados reais), nome, recentes e lançamento. Fileiras da página inicial montadas só com categorias que têm jogos.
- **Página do jogo** com "Onde jogar" (cada serviço, o que precisa, link oficial), ficha técnica, compatibilidade e limitações.
- **Contas**: cadastro, login, sair, perfil com avatar, troca de senha, sessões ativas (encerrar as outras), exportar dados e excluir conta (LGPD). Senhas com scrypt; sessões no servidor com cookie `HttpOnly`; limite de tentativas.
- **Biblioteca, favoritos e "Continuar jogando"**: na conta (todos os aparelhos) ou no navegador para visitantes; ao entrar, os dados locais vão para a conta.
- **Planos** configuráveis (`src/config/plans.ts`) com Stripe Checkout, Portal do cliente e webhooks idempotentes. Preço exibido é lido do próprio Stripe. Sem chaves do Stripe, a página mostra "Assinaturas em breve".
- **Cloud Play**: serviços oficiais e status de uma estação de streaming própria (Selkies/Neko), se configurada.
- **Teste de controle** (Gamepad API): botões e analógicos ao vivo, rótulos Xbox/PlayStation, vários controles, vibração.
- **Configurações** de entrada, áudio e vídeo, salvas no navegador e na conta.
- **Painel administrativo**: números reais, estado das integrações, pesquisa de provedores, ativar/destacar jogos, **cadastrar jogos de nuvem** com validação dos links oficiais, avisos (sino de notificações) e usuários.
- **Segurança**: CSP com nonce, cabeçalhos de segurança, verificação de origem nas APIs, segredos só no servidor.
- **SDK para jogos de parceiros** (`games/_sdk`) com protocolo `postMessage`, servido por rota com token assinado e CSP própria — pronto para quando houver jogos licenciados para rodar no site. Nenhum jogo foi criado pelo PH Cloud: o catálogo é só de jogos reais dos serviços oficiais.

## O que depende de você (credenciais, contratos, decisões)

1. **Banco PostgreSQL** em produção (`DATABASE_URL`).
2. **Stripe**: chave, segredo do webhook e IDs dos preços em BRL.
3. **Revisar os links** dos jogos periodicamente: os catálogos dos serviços mudam (ex.: GTA V entra e sai do Game Pass).
4. **Arte oficial** dos jogos só com permissão das editoras. As capas atuais são artes próprias, sem logotipos.
5. **Termos e privacidade**: os textos são modelos iniciais e precisam de revisão jurídica.
6. **E-mail transacional** (recuperação de senha automática) ainda não está integrado.
7. **Jogos rodando dentro do site**: só com contrato B2B ou servidores próprios licenciados.

Guia de publicação: [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/app/(site)` | Páginas do site (início, jogos, Cloud Play, biblioteca, planos, ajuda, perfil, admin…) |
| `src/app/(player)/jogar/[id]` | Tela de "Jogar" (escolha do serviço de nuvem) |
| `src/app/api` | APIs JSON (favoritos, preferências, webhook do Stripe, métricas…) |
| `src/app/g/[token]/[...path]` | Arquivos dos jogos próprios (token assinado + CSP) |
| `src/modules/catalog` | Modelo do catálogo, jogos de nuvem (`cloud-games.ts`), busca e categorias |
| `src/modules/cloud-streaming` | Serviços oficiais, validação de links e deep links do GeForce NOW |
| `src/modules/providers` | Adaptadores (nuvem, itch.io, GameDistribution, links) e resultado da pesquisa |
| `src/modules/subscriptions` | Planos, direitos, Stripe |
| `src/server` | Banco (Drizzle), autenticação, segurança |
| `games/` | Jogos próprios e SDK do PH Cloud |
| `drizzle/` | Migrações SQL |
| `tests/unit` | Testes |
