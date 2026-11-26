---
name: partyverse-multiplayer-networking
description: Regras de rede do PARTYVERSE — protocolo, autoridade do servidor, snapshots, interpolação, reconexão. Use ao mexer em shared/protocol.ts, server/src/Game.ts, worlds/*, client/src/net ou sincronização.
---
# Rede no PARTYVERSE
- Protocolo JSON tipado em `shared/protocol.ts` (`C2S`/`S2C`). Mudou o formato? Suba `PROTOCOL_VERSION`.
- Servidor a 30 Hz, snapshots a 20 Hz (`World.snapshot`, campo `w` = delta do mundo). Cliente envia `move` a 20 Hz; servidor valida velocidade e paredes e responde `correct`.
- Remotos renderizam com atraso `INTERP_DELAY` (Remote.ts). Objetos carregados são posicionados localmente a partir dos avatares para não ter atraso.
- Relógio: `net.now()` (mediana de ping/pong). Tudo que é temporizado usa hora do servidor.
- Reconexão: a sessão vive `RECONNECT_GRACE_MS`; ao voltar, `World.join` reenvia o estado (`world`). Correções que chegam durante o carregamento ficam em `pendingCorrect`.
- Ações importantes nunca são decididas no cliente.
