# Ultimate Battle Royale (Unreal Engine 5)

Battle royale multiplayer original para **Android, iOS e Windows**, escrito em **C++ para Unreal Engine 5.4**.
O jogo inteiro (mapa de 9 km², personagens, armas, construção, veículos, UI, áudio e lobby) é gerado
por código a partir de formas básicas do motor, então **o projeto roda sem nenhum asset `.uasset`
autoral** — e cada parte aceita arte autoral quando ela existir (ver `Docs/CONTENT_PIPELINE.md`).

> **Status honesto:** o código foi escrito e revisado contra a API do UE 5.4, mas **não foi compilado
> neste ambiente** (não há Unreal Engine aqui). As regras de jogo puras (`Source/.../Rules`) são
> compiladas e testadas (38 casos, ~15 mil verificações), e o backend de perfil tem 23 testes. Espere uma rodada de ajustes de compilação no
> primeiro build. Detalhes em [`Docs/STATUS.md`](Docs/STATUS.md).

## Começo rápido

```bash
# 1. Testes das regras e do backend (não precisam do Unreal)
Tests/RulesTests/run_tests.sh
(cd Backend && python3 -m unittest discover -s tests -t .)

# 2. Gerar arquivos de projeto e compilar (Windows, UE 5.4 instalado)
"<UE>/Engine/Build/BatchFiles/Build.bat" UltimateBattleRoyaleEditor Win64 Development -Project="%CD%/UltimateBattleRoyale.uproject"

# 3. Jogar: abre o menu principal (lobby 3D). Partida local direto:
UnrealEditor.exe UltimateBattleRoyale.uproject /Engine/Maps/Entry?game=BR?Mode=Training -game
```

Modos pela URL: `Mode=Solo|Duos|Squads|Build|ZeroBuild|Training|Range|Creative`, opções `Bots=N`, `MaxPlayers=N`, `Seed=N`.

## O que existe

| Sistema | Onde |
|---|---|
| Regras puras testadas (combate, tempestade, construção, loot, anti-cheat, progressão, veículos, qualidade mobile, mundo) | `Source/UltimateBattleRoyale/Rules` |
| Personagem, movimento predito (sprint, deslize, paraquedismo, planador, natação, escalada), câmera, interação, reanimação | `Characters/` |
| Armas (10 modelos × raridades), granadas, projéteis, recuo, bloom, validação de tiro no servidor com compensação de lag | `Weapons/` |
| Inventório (5 slots + munição + materiais), itens, baús, caixas, suprimentos, lhamas, loot aleatório | `Inventory/`, `Items/` |
| Construção (parede/piso/rampa/telhado × madeira/pedra/metal), edição (porta/janela/arco), integridade estrutural | `Building/` |
| Mapa procedural determinístico de 9 km²: cidades com prédios de vários andares, vilas, fazenda, base militar, indústria, postos, torres, bunker secreto, rio, lago, pontes, túneis, florestas | `World/` |
| Tempestade com 9 fases, ônibus voador, céu dia/noite, chuva/neblina, portas, props destrutíveis, bombas de combustível, plataformas de salto | `Systems/` |
| Veículos (carro esportivo, caminhonete, moto, utilitário, barco) com física, combustível, dano | `Vehicles/` |
| Fluxo de partida server-authoritative, 8 modos, equipes, DBNO, espectador, reconexão, chat, pings, denúncias | `GameModes/` |
| Sessões online (OSS/EOS): matchmaking, servidor dedicado, grupos, amigos, convites | `Matchmaking/`, `Multiplayer/` |
| Bots (só em Treinamento/opcional): percepção, cérebro utilitário, nós de Behavior Tree, teste EQS | `AI/` |
| HUD, menu principal com lobby 3D, loja, passe, desafios, armário, configurações, controles touch | `UI/`, `Progression/` |
| Desempenho mobile: níveis Baixa/Média/Alta, resolução dinâmica, FPS alvo 30/45/60, LOD de IA e animação | `Settings/` |
| Anti-cheat e log de partida | `Security/`, `Systems/BRMatchLogger` |
| Backend autoritativo de perfil/economia (Python, testado, Docker) + cliente HTTP no jogo | `Backend/`, `Multiplayer/BRBackendClient`, `Deploy/` |
| Áudio sintetizado e espacial (armas, passos, motores, clima, música) | `Audio/` |

Documentação: [`Docs/ARCHITECTURE.md`](Docs/ARCHITECTURE.md) · [`Docs/STATUS.md`](Docs/STATUS.md) ·
[`Docs/BUILD_AND_RUN.md`](Docs/BUILD_AND_RUN.md) · [`Docs/ONLINE.md`](Docs/ONLINE.md) ·
[`Docs/CONTENT_PIPELINE.md`](Docs/CONTENT_PIPELINE.md) · [`Docs/TESTING.md`](Docs/TESTING.md) · [`Docs/CONTROLS.md`](Docs/CONTROLS.md)
