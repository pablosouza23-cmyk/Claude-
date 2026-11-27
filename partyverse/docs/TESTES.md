# Lista de testes antes da publicação

Resultados reais da última execução (27/11/2026). Ambiente: Chromium headless com
renderização por software (SwiftShader), servidor local. ✅ = executado e aprovado;
⚠️ = executado parcialmente; ❌ = não executado/sem suporte; ➖ = não se aplica ainda.

| # | Teste | Como | Resultado |
|---|---|---|---|
| 1 | Cadastro de conta | `tests/e2e/social.mjs` | ✅ usuário+senha (hash scrypt) e código de recuperação |
| 2 | Login e logout | `social.mjs` + painel Perfil → Conta | ✅ login em outro "dispositivo" entra na mesma conta; senha errada recusada; logout implementado (⚠️ sem E2E do botão) |
| 3 | Recuperação de conta | `social.mjs` | ✅ código errado recusado; correto redefine senha, gera novo código e invalida sessões antigas |
| 4 | Salvamento do progresso | `stability.cjs` | ✅ XP/moedas/histórico persistem no SQLite (3 partidas no histórico) |
| 5 | Entrada no lobby | todos os E2E + capturas | ✅ |
| 6 | Criar e entrar em salas | `train-flow.cjs`, `social.mjs` | ✅ pública, privada (fora da lista), por código, votação, pronto |
| 7 | Convidar amigos | `social.mjs` | ✅ pedido, aceite, convite, entrada pela aceitação |
| 8 | Multiplayer com jogadores reais | 2–4 navegadores reais em todos os E2E | ✅ sem jogadores falsos |
| 9 | Microfone e permissão | `voice.cjs` (microfone simulado do Chromium) | ✅ permissão, estados ligado/só ouvir; tela explicativa antes de pedir |
| 10 | Redução de ruído e qualidade | `voice.cjs` | ✅ eco/ruído/ganho nativos ativos; tom constante é removido; fala sintética atravessa a cadeia (nível 0,17). ⚠️ qualidade subjetiva com voz humana real precisa de teste com pessoas |
| 11 | Áudio por proximidade | `voice.cjs` | ✅ perto = volume 1,0; ~40 m = 0; silenciar jogador e o próprio microfone |
| 12 | Voz no lobby e nos minigames | `voice.cjs` | ✅ lobby e partida; sem mistura entre mundos |
| 13 | Trem voador | `train-flow.cjs` | ✅ embarque a pé, assentos, voo sincronizado entre clientes, chegada, desembarque |
| 14 | Todos os seis minigames | `mudanca-play.cjs` | ⚠️ Mudança Maluca ✅; Loja em Caos e Nave em Perigo em desenvolvimento; Roubo, Hotel e Oficina ❌ não implementados |
| 15 | Vitória, derrota e recompensas | `mudanca-play.cjs`, `stability.cjs` | ✅ derrota por tempo/meta, estrelas, XP, moedas, conquistas; ⚠️ vitória completa não automatizada (exige entregar 55%+ dos itens) |
| 16 | Reconexão | `social.mjs`, `stability.cjs` | ✅ volta à mesma sala e à mesma partida sem recarregar o mapa; estado reaplicado |
| 17 | Celular e computador | capturas Pixel 7 retrato/paisagem, iPhone SE paisagem, desktop | ✅ layout e controles touch; ❌ aparelho físico Android/iOS não testado aqui |
| 18 | Erros no console | todos os E2E + `mobile` | ✅ nenhum erro de página nos últimos testes |
| 19 | Segurança do banco | revisão + `social.mjs` | ✅ senhas/códigos só em hash, tokens em hash, ranking sem dados privados, origem WebSocket restringível, limitador de tentativas, validação de visual/compra no servidor |
| 20 | Desempenho e carregamento | `stability.cjs`, build | ✅ memória de GPU estável entre partidas; 218 KB gz iniciais, minigame sob demanda. ⚠️ FPS medido só em software (SwiftShader); medir em Android intermediário real |

## Comandos
```bash
npm run typecheck && npm test
PV_FAST_TRAIN=1 PV_DEBUG=1 DB_PATH=/tmp/pv.db npx tsx server/src/main.ts &
npx vite --config client/vite.config.ts &
node tests/e2e/train-flow.cjs
node tests/e2e/mudanca-play.cjs
node tests/e2e/voice.cjs
node tests/e2e/stability.cjs
PV_WS=ws://localhost:8787/ws node tests/e2e/social.mjs
```
