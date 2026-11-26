---
name: partyverse-game-qa
description: Como testar o PARTYVERSE de verdade (typecheck, E2E multiplayer com Playwright, capturas). Use antes de declarar qualquer sistema pronto.
---
# QA do PARTYVERSE
1. `cd partyverse && npm run typecheck`.
2. Servidor de teste: `PV_FAST_TRAIN=1 PV_DEBUG=1 DB_PATH=/tmp/pv.db npx tsx server/src/main.ts` + `npx vite --config client/vite.config.ts`.
3. E2E: `node tests/e2e/train-flow.cjs` (sala→trem→minigame) e `node tests/e2e/mudanca-play.cjs` (jogabilidade). Use `OUT=<pasta>` para as capturas e **olhe as imagens**.
4. O Chromium de teste usa SwiftShader (5–10 FPS): use qualidade baixa e prazos longos; lentidão no teste não é bug do jogo.
5. `PV_DEBUG=1` registra movimentos rejeitados, correções e interações recusadas — use para diagnosticar dessincronização.
