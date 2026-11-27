# PARTYVERSE

Jogo multiplayer cooperativo 3D: lobby social, Trem Voador e experiências cooperativas para 2 a 10 jogadores.

## Tecnologia

O ambiente não tem Unity nem Godot. Por isso escolhi uma stack que roda, compila e é testável aqui, e que publica para todas as plataformas pedidas:

| Camada | Tecnologia |
|---|---|
| Cliente 3D | TypeScript + **Three.js 0.187** (PBR, sombras, ACES, PMREM), Vite 8 |
| Servidor | **Node.js 22** + `ws`, servidor **autoritativo** a 30 Hz, snapshots a 20 Hz |
| Física | **Rapier 3D** (WASM) no servidor; controlador de personagem determinístico compartilhado |
| Banco | SQLite embutido do Node (`node:sqlite`): contas, amigos, histórico |
| Plataformas | Navegador (Android/iOS/PC) hoje; empacotamento nativo: Capacitor (Android/iOS) e Electron (Windows) — **ainda não gerado** (ver Status) |

```
shared/   regras e dados compartilhados: colisão, protocolo, trem, mapas, minigames, progressão, cosméticos
server/   servidor autoritativo (sessões, lobby, salas, partidas, amigos, progressão, minigames)
client/   jogo (render, avatar, câmera, entrada PC/touch, UI, mundos, minigames carregados sob demanda)
tests/    unitários (node:test) e E2E multiplayer (Playwright, 2 clientes reais)
```

## Como rodar

```bash
cd partyverse
npm install
npm run dev          # servidor :8787 + cliente :5173  → abra http://localhost:5173
npm run typecheck
npm test             # testes unitários
npm run build && npm start   # produção: http://localhost:8787
```

Para testar o multiplayer no mesmo PC, abra duas abas com perfis diferentes: `?profile=a` e `?profile=b`.

Para os testes E2E, suba o servidor com `PV_FAST_TRAIN=1 PV_DEBUG=1` (viagem curta e logs de diagnóstico) e rode `node tests/e2e/train-flow.cjs` ou `node tests/e2e/mudanca-play.cjs`.

## Controles

- **PC:** WASD mover • Shift correr • Espaço pular • E interagir • F ação do minigame • G acenar • Enter chat • Tab salas • Esc pausa • arraste o mouse para girar a câmera e use a roda para o zoom. As teclas são reconfiguráveis.
- **Celular:** joystick virtual, botões de interagir, pular, correr e acenar, além de até dois botões contextuais do minigame. Arraste para girar a câmera e use pinça para o zoom.

## Status (honesto)

| Sistema | Estado | Testado |
|---|---|---|
| Lobby 3D (praça, estação, loja, galeria, palco, ilha flutuante) | ✅ pronto | captura + 2 clientes |
| Avatar personalizável (cabelo, chapéu, roupa, calça, sapato, rosto, acessório, pele) + 32 animações | ✅ pronto | captura |
| Câmera 3ª pessoa com colisão, controles PC e touch | ✅ pronto | E2E (joystick virtual) |
| Contas: convidado + cadastro usuário/senha (scrypt), login em vários dispositivos, logout, recuperação por código, anti força bruta | ✅ | protocolo (social.mjs) |
| **Chat de voz por proximidade** (WebRTC P2P, sinalização isolada por mundo, eco/ruído/ganho nativos + filtros, noise gate, compressor/limitador, oclusão por paredes, pan estéreo, silenciar a si e a outros, indicador de quem fala) | ✅ | E2E 2–4 navegadores (voice.cjs) |
| Tutorial de primeira vez, ranking, política de privacidade, tela de manutenção | ✅ | capturas |
| Publicação: build, Netlify (cliente), Dockerfile (servidor), DEPLOY.md | ✅ pronto para configurar | build local; ❌ não publicado (requer host do servidor) |
| Salas públicas/privadas, código, votação, dificuldade, pronto, expulsar, partida rápida | ✅ | E2E |
| Amigos (código, pedidos, aceitar, convites, status online, entrar na sala do amigo) | ✅ | protocolo (social.mjs) |
| Reconexão (90 s; volta à mesma sala/partida com estado reaplicado) | ✅ | social.mjs + stability.cjs |
| Trem Voador: embarque a pé, interior caminhável, assentos, cabine (buzina/luzes), portas, propulsores, voo e chegada sincronizados | ✅ pronto | E2E 2 clientes |
| **Mudança Maluca** (física, móveis 1/2 pessoas, quebra, caminhão dirigível, viagens, cômodos, cronômetro, estrelas, vitória/derrota, jogar de novo) | ✅ jogável | E2E: pegar, carregar, dirigir, descarregar, entregar, resultados |
| Progressão: XP, níveis, moedas, 16 conquistas, histórico, recordes, bônus com amigos | ✅ | parcial (recompensa exibida no E2E) |
| Loja e guarda-roupa com prévia 3D (só cosméticos, validado no servidor) | ✅ | protocolo (compra, nível mínimo, item não comprado) |
| Qualidade Baixa/Média/Alta, resolução dinâmica, instancing, partículas limitadas, minigames sob demanda | ✅ | parcial |
| Roubo Perfeito, Loja em Caos, Hotel Estranho, Oficina Impossível, Nave em Perigo | ❌ **não implementados** (aparecem como "EM BREVE" e não podem ser iniciados) | — |
| APK Android / app iOS / instalador Windows | ❌ não gerados (sem Android SDK/Xcode neste ambiente) | — |
| Login social (Google/e-mail), moderação de chat, servidor TURN para voz | ❌ | — |

Lista completa de testes e resultados: `docs/TESTES.md`. Publicação: `DEPLOY.md`.

## Créditos e licenças

- Modelos 3D, sons e texturas: **Kenney** (www.kenney.nl), licença **CC0**. Origem: repositórios oficiais KenneyNL Starter Kits (Mini Arena, City Builder, Racing, 3D Platformer). Veja `client/public/assets/kenney/LICENSE-Kenney-CC0.txt`.
- Fonte: **Lilita One** (SIL Open Font License), incluída no kit Kenney.
- Avatares, trem, móveis, casas e ambientes complementares: modelados proceduralmente no código deste projeto.
- Música: gerada proceduralmente em tempo real (WebAudio).
