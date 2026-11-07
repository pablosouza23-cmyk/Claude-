# Arquitetura

```
Source/UltimateBattleRoyale/
  Rules/        Regras puras C++ (sem Unreal) — combate, tempestade, construção, loot, segurança,
                progressão, inventário, veículos, partida, qualidade, aim assist, mundo. Testadas em
                Tests/RulesTests e usadas pelo código do jogo (fonte única da verdade).
  Core/         Tipos replicáveis (FBRItemStack, FBRGridKey, loadout...), configurações, visuais
                procedurais compartilhados (materiais por cor com cache => batching).
  Characters/   ABRCharacter, movimento predito (UBRCharacterMovementComponent), vida/escudo/DBNO,
                input runtime, AnimInstance, corpo procedural animado.
  Weapons/      ABRWeapon (predição no cliente + validação no servidor), projéteis/explosões,
                compensação de lag, tipos de dano.
  Inventory/    UBRInventoryComponent (servidor-autoritativo, ids replicados).
  Items/        Definições (Data Assets), registro, pickups, contêineres, subsistema de loot.
  Building/     Peças, grade/ocupação/integridade, componente de construção/edição.
  World/        Subsistema de consultas do mundo + gerador procedural (terreno, POIs, vegetação).
  Systems/      Tempestade, ônibus, céu/clima, portas, props, bomba de combustível, plataforma, alvos, log.
  Vehicles/     Veículo com suspensão raycast (5 configurações).
  GameModes/    Modo de jogo (fluxo da partida), GameState, PlayerState, PlayerController, front-end.
  Multiplayer/  GameInstance (falhas de rede, partidas locais).
  Matchmaking/  Sessões OSS/EOS (matchmaking, dedicado, grupos, amigos, convites).
  AI/           Controlador de bot, nós de Behavior Tree, teste EQS.
  UI/           Widgets construídos em C++: HUD, menu principal, touch, base/configurações.
  Progression/  Catálogo cosmético, perfil (SaveGame), loja, passe, desafios.
  Settings/     Configurações do jogador e subsistema de desempenho.
  Security/     Anti-cheat por jogador.
  Audio/        Síntese procedural e reprodução espacial.
  Tests/        Testes de automação Unreal.
```

## Princípios

- **Servidor autoritativo.** Cliente só envia intenções (atirar com direção, construir na célula X,
  equipar slot). O servidor valida com as mesmas regras puras e aplica. Inventário, dano, construção,
  loot, economia da partida, tempestade e fluxo de partida rodam só no servidor.
- **Replicação mínima.** Ids de itens (FName) em vez de ponteiros; tempestade e ônibus replicam só o
  estado (clientes calculam posição pelo relógio do servidor); o mapa inteiro replica uma **seed**;
  vegetação coletada replica uma lista de índices; pickups/portas entram em dormência de rede.
- **Predição onde o jogador sente.** Movimento (flags customizadas no CMC), disparo/recuo/efeitos,
  pré-visualização de construção, plataforma de salto.
- **Sem dependência de assets.** Todo visual/áudio tem fallback procedural e um ponto de troca para
  arte autoral (configurações do projeto ou Data Assets).

## Fluxo da partida (ABRGameMode)

```
WaitingForPlayers (aquecimento: respawn, invulnerável, arsenal de treino)
   └─ ShouldStartMatch (mín. jogadores + tempo) → contagem de 10 s
BusFlight (ônibus cruza o mapa; PULAR = saltar; bots saltam em momentos aleatórios; salto forçado no fim)
Playing (tempestade 9 fases; suprimento a cada encolhimento; eliminações → colocação por equipe)
   └─ 1 equipe viva → EndGame (resultados/XP enviados) → PostMatch (volta ao menu; dedicado reinicia)
```
Modos com respawn (Campo de Tiro, Criativo) pulam ônibus/tempestade.

## Rede de uma ação: tiro

1. Cliente: `ABRWeapon::FireOnce` — direção da câmera + dispersão (semente), traço local, recuo, efeitos.
2. RPC `ServerFire(FBRShotRequest)` com origem, direção, semente, tempo do servidor e acertos alegados.
3. Servidor: cadência (`IsFireRateValid`), rate limit, origem plausível, direção vs. rotação de controle,
   munição; por acerto: alcance, cone máximo da arma, linha de visão, cápsula do alvo **rebobinada**
   (`UBRLagCompensationComponent`) e zona (cabeça/corpo/membro) → `ApplyPointDamage`.
4. Vítima: escudo → vida → DBNO/eliminação → `ABRGameMode::OnCharacterEliminated`.
5. Atirador recebe `ClientConfirmHit` (marcador e número de dano).

## Desempenho mobile

- Geometria estática do mapa agrupada em HISM por (malha, cor): poucas draw calls, culling por instância.
- Distâncias de culling por nível de qualidade; sombras só onde vale; Lumen/Nanite desligados no mobile.
- Resolução dinâmica + limite de FPS por nível; queda de nível automática sob throttling.
- IA pensa a 10 Hz perto de humanos e 0,4 Hz longe; corpos procedurais animam a 10 Hz a distância e
  param fora da tela; áudio/efeitos não rodam no servidor dedicado.
