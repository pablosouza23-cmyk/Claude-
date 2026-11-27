# Publicação do PARTYVERSE

O jogo tem duas partes:

| Parte | O que é | Onde hospedar |
|---|---|---|
| Cliente | site estático (HTML/JS/CSS/modelos) | **Netlify** (ou o próprio servidor) |
| Servidor | Node 22 com WebSocket persistente, física e banco SQLite | host com processo contínuo e disco persistente |

> O Netlify **não executa** servidores WebSocket persistentes (funções são de curta duração). Por isso o servidor precisa de um host de Node.

## Opção A — tudo num servidor só (mais simples)
`docker build -t partyverse . && docker run -p 8787:8787 -v pv-data:/data partyverse`
O servidor já entrega o cliente e o `/ws`. Use HTTPS na frente (o microfone exige HTTPS).

## Opção B — cliente no Netlify + servidor separado
1. Suba o servidor (Dockerfile) em um host Node com volume persistente em `/data`.
2. Variáveis do servidor:
   - `PORT` (padrão 8787), `DB_PATH` (padrão `/data/partyverse.db` no Docker)
   - `PV_ALLOWED_ORIGINS=https://SEU-SITE.netlify.app` (bloqueia conexões de outros sites)
   - `PV_ICE_SERVERS` (opcional, JSON) — para adicionar um servidor TURN ao chat de voz
3. No Netlify: *Base directory* = `partyverse`; variável `VITE_SERVER_URL=wss://SEU-SERVIDOR/ws`. O `netlify.toml` já define build, rotas e cabeçalhos.

Nunca use `PV_DEBUG`, `PV_FAST_TRAIN` ou `PV_GAME_TIME` em produção (são só para testes).

## Custos que exigem sua autorização
- **Host do servidor**: necessário para o multiplayer. Alguns têm camada gratuita com limitações (hibernação derruba partidas); para lançamento público, um plano pago pequeno é o recomendado.
- **Servidor TURN** (voz em redes muito restritivas, ~10–20% dos usuários): pode ser próprio (coturn numa VPS) ou serviço pago. Sem TURN, a voz funciona na maioria das redes via STUN gratuito.
- Nenhum desses foi contratado.

## Checklist antes de publicar
- [ ] `npm run typecheck && npm test && npm run build` sem erros
- [ ] E2E: `train-flow.cjs`, `mudanca-play.cjs`, `voice.cjs`, `social.mjs`
- [ ] HTTPS ativo (obrigatório para microfone)
- [ ] `PV_ALLOWED_ORIGINS` configurado
- [ ] Backup do volume `/data`
