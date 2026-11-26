# PARTYVERSE — regras permanentes do projeto

Jogo multiplayer cooperativo 3D (lobby social + Trem Voador + 6 minigames).
Stack: **TypeScript + Three.js (cliente, Vite)** e **Node.js 22 + ws + SQLite embutido + Rapier (servidor autoritativo)**.

## Comandos
- `npm install` — dependências
- `npm run dev` — servidor (8787, tsx watch) + cliente (Vite 5173, proxy `/ws`)
- `npm run typecheck` — **deve passar antes de qualquer commit**
- `npm run build && npm start` — produção (servidor serve `dist/client` e `/ws`)
- `npm test` — testes unitários (node:test)
- E2E: suba o servidor com `PV_FAST_TRAIN=1 PV_DEBUG=1` e rode `node tests/e2e/train-flow.cjs` / `mudanca-play.cjs`

## Arquitetura (não quebrar)
- `shared/` é a fonte única de verdade de **colisão, layouts de mapa, trem, regras e protocolo**. Cliente e servidor importam os mesmos arquivos. Nunca duplique geometria de colisão só no cliente.
- Movimento do jogador: predito no cliente com `shared/collision.ts` e **validado** no servidor (`World.handleMove`). Ações importantes (pegar, carregar, dirigir, pontuar, vencer) são **sempre decididas no servidor**.
- Trem: a pose vem de `trainPose(schedule, serverNow)` — determinística. Nunca anime o trem só localmente.
- Minigames: servidor implementa `MinigameServer` (`server/src/games/<id>/`), cliente implementa `MinigameClient` (`client/src/games/<id>/client.ts`, carregado sob demanda). Registre em `server/src/games/index.ts` e `client/src/games/index.ts`, e marque `playable: true` em `shared/minigames.ts` só quando estiver jogável de ponta a ponta.
- O plano da missão (escala por nº de jogadores e dificuldade) fica em `shared/games/<id>.ts` e muda o **desenho** da missão, não só a quantidade de inimigos.

## Regras de qualidade
1. Não remover funcionalidades que funcionam. Não criar botões decorativos nem multiplayer falso.
2. Todo texto vindo de jogadores passa por `esc()` antes de ir para HTML.
3. Cosméticos são só visuais — nada pago altera o equilíbrio.
4. Objetos interativos precisam de colisão (adicione no layout compartilhado).
5. Teste antes de declarar pronto: typecheck + E2E relevante + captura de tela revisada.
6. Relate com honestidade o que está pronto e o que falta (`partyverse/README.md`, seção Status).
7. Assets: apenas com licença verificada (Kenney CC0 já importados em `client/public/assets/kenney`). Créditos no README.
8. Pense em celular primeiro: instancing (`Batcher`), partículas proporcionais a `preset.particles`, sem luzes dinâmicas extras.
