# Arquitetura

```
 Celular (navegador / PWA)                 Servidor PHSWK (Node.js)
 ┌──────────────────────────┐   HTTP/JSON  ┌───────────────────────────────┐
 │ client/app.js            │─────────────▶│ server.js  rotas /api/*        │
 │  carregamento → login    │              │   accounts.js  sessão/convidado│
 │  lobby / loja / ranking  │              │   economy.js   diamantes+ledger│
 │  fila → partida → result.│  WebSocket   │   progression.js ranking       │
 │  joysticks de toque      │◀────────────▶│ /ws  matchmaker.js  fila+bots  │
 └──────────────────────────┘   /ws JSON   │      match.js  simulação 20 Hz │
                                           │ store.js  arquivo JSON atômico │
                                           └───────────────────────────────┘
```

| Camada | Implementação | Observação |
|---|---|---|
| Autenticação/sessão | convidado + token aleatório de 192 bits; só o hash SHA-256 é salvo | Google/Facebook exigem registrar um app próprio (OAuth) |
| Lobby | `/api/me`, `/api/catalog`, `/api/equip` | personagem, arma e roupa equipados |
| Itens e diamantes | `catalog.js`, `economy.js` | conteúdo original; diamantes **virtuais**, sem dinheiro real |
| Formação de partidas | `matchmaker.js` | humanos primeiro; depois de `BOT_FILL_MS`, completa com `BOT …` |
| Rede | WebSocket JSON, servidor manda estado 20×/s | sem predição no cliente (limitação conhecida) |
| Estado da partida | `match.js` autoritativo | cliente envia só intenção; velocidade, dano e acerto são do servidor |
| Persistência | `store.js` (JSON com escrita atômica) | interface simples para trocar por SQLite/Postgres |
| Visual | canvas 2D desenhado em código | sem assets da Garena |

## Protocolo WebSocket (próprio)

Cliente → servidor:

| Mensagem | Função |
|---|---|
| `{t:'auth', token}` | autenticação, sempre a primeira mensagem |
| `{t:'queue', mode:'cs'\|'br'}` | entra na fila |
| `{t:'cancel'}` | sai da fila |
| `{t:'input', mx, my, aim, fire}` | intenção do jogador: `mx`/`my` vão de -1 a 1, `aim` é em radianos |

Servidor → cliente:

| Mensagem | Quando |
|---|---|
| `hello` | depois do login |
| `queued` | entrou na fila |
| `cancelled` | saiu da fila |
| `match_found` | partida formada (inclui o mapa) |
| `state` | snapshot + eventos `shot`/`kill`/`round` |
| `end` | resultado, variação de classificação e diamantes, conta atualizada |
| `error` | erro |

Códigos de fechamento:
- `4001`: token inválido;
- `4002`: a mesma conta conectou em outro lugar.

## Por que não usar o cliente original

Conectar o APK oficial a este servidor exigiria três coisas:
1. Implementar o protocolo proprietário dele: protobuf + AES com chave extraída do binário.
2. Desviar os domínios oficiais, o que pede um APK modificado e reassinado ou interceptação de TLS.
3. Redistribuir assets proprietários.

Os três esbarram nas regras do projeto: não contornar segurança e não usar conteúdo proprietário sem autorização.
