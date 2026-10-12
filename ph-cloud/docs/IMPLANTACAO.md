# Publicação do PH Cloud

## Opção 1 — Vercel + PostgreSQL gerenciado (mais simples)

1. Crie um banco PostgreSQL (Neon, Supabase ou outro) e copie a URL de conexão com `sslmode=require`.
2. Importe o repositório na Vercel e defina **Root Directory = `ph-cloud`**.
3. Variáveis de ambiente (veja `.env.example`):
   - `APP_URL` = `https://seu-dominio.com.br`
   - `APP_SECRET` = resultado de `openssl rand -base64 48`
   - `DATABASE_URL` = URL do banco
   - `ADMIN_EMAILS` = seu e-mail
   - `SUPPORT_EMAIL` = e-mail de suporte
4. Deploy. As migrações rodam sozinhas na primeira requisição (com trava no banco para várias instâncias). Se preferir, defina `DB_AUTO_MIGRATE=false` e rode `npm run db:migrate` no deploy.
5. Cadastre-se com o e-mail de `ADMIN_EMAILS` para acessar `/admin`.

> Não use o banco embutido (PGlite) na Vercel: o disco de funções serverless não persiste.

## Opção 2 — Servidor próprio (VPS)

```bash
cd ph-cloud
npm ci
npm run build
APP_URL=https://seu-dominio.com.br APP_SECRET=... DATABASE_URL=... npm start   # porta 3000
```

Coloque atrás de um proxy reverso com HTTPS (Caddy ou Nginx) que repasse `X-Forwarded-For`, `X-Forwarded-Host` e `X-Forwarded-Proto`. Num único servidor dá para usar o PGlite (sem `DATABASE_URL`), com backup da pasta `PGLITE_DATA_DIR`.

## Stripe (assinaturas)

1. No painel do Stripe, crie um **Produto** para cada plano pago com **preço recorrente mensal em BRL**. Copie os IDs `price_…` para `STRIPE_PRICE_PLUS_MONTHLY` e `STRIPE_PRICE_ULTIMATE_MONTHLY`. O valor exibido no site é lido do Stripe.
2. Ative os meios de pagamento desejados (cartão; Pix Automático para recorrência, se disponível na sua conta).
3. Configure o **Portal do cliente** (cancelar, trocar cartão).
4. Crie um endpoint de webhook para `https://seu-dominio.com.br/api/billing/webhook` com os eventos:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.payment_failed`.
5. Defina `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`.
6. Teste em modo de teste antes de usar chaves reais. O plano Ultimate só aparece quando há uma estação de streaming própria configurada.

## Manter o catálogo de jogos atualizado

- **Admin › Jogos › Adicionar jogo**: escolha "Serviço de nuvem oficial" e cole o link da página do jogo:
  - Xbox: abra `xbox.com/pt-BR/play`, entre no jogo e copie o endereço (`…/play/games/…`).
  - GeForce NOW: abra a página do jogo em `play.geforcenow.com` e copie o endereço (o `game-id` vai junto).
- Os links são validados (só domínios oficiais).
- Para desativar um jogo que saiu de um serviço, use o botão **Ativo**.

## Estação de streaming própria (opcional)

Para o Cloud Play rodar dentro do site é preciso um servidor com GPU e um sistema de streaming com cliente web (por exemplo Selkies-GStreamer ou Neko). Defina `CLOUD_STREAM_URL` (e `CLOUD_STREAM_HEALTH_URL`, se houver). O PH Cloud verifica se responde e mostra o status em Cloud Play e no painel. Proteja a estação com autenticação própria, e só transmita jogos cuja licença permita esse uso.
