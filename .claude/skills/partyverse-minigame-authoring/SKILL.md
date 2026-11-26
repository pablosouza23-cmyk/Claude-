---
name: partyverse-minigame-authoring
description: Criar ou completar um minigame do PARTYVERSE (servidor autoritativo + cliente + plano por nº de jogadores). Use ao implementar Roubo Perfeito, Loja em Caos, Hotel Estranho, Oficina Impossível, Nave em Perigo ou ao alterar a Mudança Maluca.
---
# Criando um minigame do PARTYVERSE

Use a Mudança Maluca como referência completa (`shared/games/mudanca.ts`, `server/src/games/mudanca/`, `client/src/games/mudanca/`).

1. **Compartilhado** `partyverse/shared/games/<id>.ts`: `plan<Id>(players, difficulty)` que muda o *desenho* da missão por nº de jogadores (layout, funções, tarefas simultâneas), mapa com colisores (`Collider[]`), pose de chegada do trem (`Pose`, piso em y=0.4 ao lado de uma plataforma +Z) e `lines` para a UI da sala. Adicione o caso em `shared/plans.ts`.
2. **Servidor** `server/src/games/<id>/<Id>Server.ts` implementando `MinigameServer` (`server/src/games/types.ts`): `state()` completo, `delta()` só com mudanças, toda regra de pontuação/vitória/derrota aqui. Registre em `server/src/games/index.ts`.
3. **Cliente** `client/src/games/<id>/client.ts` exportando `default` factory de `MinigameClient`: constrói o mapa a partir dos MESMOS dados do compartilhado, HUD (`.mhud`, `.objectives`, `.hint`), `interactables()` e `actionButtons()` (aparecem em touch e PC). Registre em `client/src/games/index.ts` (import dinâmico).
4. Marque `playable: true` em `shared/minigames.ts`.
5. Teste: typecheck, E2E com dois clientes (`tests/e2e/helpers.cjs`), capturas revisadas.
