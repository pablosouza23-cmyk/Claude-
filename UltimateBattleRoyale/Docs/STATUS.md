# Status real do projeto

Este documento separa o que **está implementado em código**, o que **foi verificado** e o que **depende
de trabalho que não é possível fazer sem o editor Unreal, artistas ou infraestrutura**.

## Como foi verificado

| Verificação | Resultado |
|---|---|
| Regras puras (`Rules/*.h`) compiladas com g++ 13 e clang, `-Wall -Wextra -Werror` | ✅ 37 casos, ~15 800 verificações, 0 falhas |
| Layout do mapa (mini-mapa ASCII gerado pelas regras) | ✅ ilha, rio, lago, montanhas, cidades e praia nos lugares certos |
| Código UE5 (C++ / UHT) | ⚠️ **não compilado** — o ambiente de desenvolvimento não tinha Unreal Engine. Revisado manualmente e com checagem automática de includes/símbolos; espere ajustes no primeiro build. |
| Testes de automação UE (`Tests/BRAutomationTests.cpp`) | ⚠️ escritos, não executados (precisam do editor) |
| Desempenho em celulares | ⚠️ arquitetura e ajustes implementados, **não medidos em aparelhos** |

## Por seção do pedido

| # | Pedido | Situação |
|---|---|---|
| 1 | UE5, C++, Enhanced Input, replicação, servidores dedicados, Niagara, MetaSounds, UMG | ✅ em código. Enhanced Input criado em runtime. Niagara/MetaSounds são opcionais (há fallback procedural). **GAS não usado** por decisão: componentes próprios são mais leves no mobile e o estado é simples (vida/escudo/munição). World Partition só se aplica a mapas autorais (o mapa procedural é gerado em runtime). Lumen/Nanite só no PC em qualidade Alta. |
| 2 | Mapa 8–12 km² | ✅ 9 km² procedural determinístico, 19 locais nomeados, interiores com escadas/janelas/portas funcionais, pontes, túneis, área secreta, props destrutíveis. ⚠️ Visual estilizado com formas básicas, não arte AAA. |
| 3 | Construção | ✅ 4 peças × 3 materiais, vida crescente durante construção, edição (portas, janelas, arco, meia parede, por bloco), rotação, cancelamento, limite de materiais, colisão, destruição e colapso estrutural, replicado. |
| 4 | Personagens | ✅ 12 trajes originais + corpo masculino/feminino, 3 estilos corporais, 5 cabelos, capacetes/máscaras, variações de cor, mochilas, picaretas, planadores, raridades. ⚠️ **Sem modelos 3D esculpidos/texturas PBR/rig facial**: o corpo é um boneco estilizado de formas básicas. A malha esquelética autoral é suportada via `UBRSettings::CharacterMesh` + ABP filho de `UBRAnimInstance`. |
| 5 | Animações | ✅ procedurais (andar/correr/sprint com fase por distância — sem deslizar, pulo, agachar, deslizar, queda, paraquedas, planador, natação, mira, recarga, coleta, rastejar derrubado, eliminação, vitória/emotes, piscar). `UBRAnimInstance` expõe tudo para Blend Spaces/Montages/IK de pés. ⚠️ Sem animações de captura de movimento. |
| 6 | Armas | ✅ 10 armas originais (pistola, SMG, 2 rifles, precisão, 2 escopetas, LMG, lança-foguetes, rifle de energia) + 2 granadas, 6 raridades, recuo, bloom, dispersão, alcance/queda de dano, cadência, munição, sons e efeitos. ⚠️ Modelos de arma são montagens de formas básicas. |
| 7 | Combate | ✅ mira/quadril, headshot, membros, queda por distância, hitscan e projéteis, marcadores, indicadores de dano, eliminação, espectador, reanimação (DBNO), equipes, validação no servidor + compensação de lag. |
| 8 | Início de partida | ✅ lobby/aquecimento → ônibus → salto → queda livre → planador (manual/automático) → pouso. |
| 9 | Tempestade | ✅ 9 fases, próximo círculo visível, dano progressivo, timers, sincronizada (só estado replica). ⚠️ Parede translúcida precisa de material autoral; sem ele: anel de feixes + tinta roxa na câmera. |
| 10 | Veículos | ✅ 5 tipos com física própria (suspensão raycast), combustível, dano, assentos, entrada/saída, câmera, som de motor. ⚠️ Bots não dirigem. |
| 11 | Loot | ✅ chão, baús, caixas de munição, suprimentos aéreos, lhamas, raridades, coleta por proximidade (munição/materiais), descarte, troca, mochila. |
| 12 | Modos | ✅ Solo, Duplas, Esquadrões, Construção, Sem Construção, Treinamento, Campo de Tiro, Criativo (salvar/carregar ilhas). |
| 13 | Multiplayer | ✅ server-authoritative, sessões/matchmaking, servidor dedicado, partida privada, grupos, amigos, convites, chat de texto, pings, reconexão. ⚠️ Online real exige configurar EOS (credenciais) e hospedar servidores; voz depende do VoIP do OSS/EOS. Ver `ONLINE.md`. Bots nunca são apresentados como jogadores (nome "[BOT]", só no Treinamento ou com `?Bots=`). |
| 14 | IA | ✅ percepção (visão, audição, dano), lootear, curar, construir cobertura, lutar, recuar, reanimar, respeitar a tempestade; nós de BT + teste EQS. ⚠️ O mundo procedural não tem NavMeshBoundsVolume: bots usam direção direta com desvio de obstáculos quando não há navmesh. |
| 15 | Interface | ✅ menu (Jogar, Modos, Personagem, Loja, Passe, Inventário, Amigos, Configurações), lobby 3D, HUD completo. |
| 16 | Loja e progressão | ✅ loja diária, passe (grátis + premium), desafios diários/semanais, XP, níveis, estatísticas. ⚠️ Perfil salvo localmente; moedas só são ganhas jogando — **compras com dinheiro real não implementadas** (exigem backend + lojas Google/Apple). |
| 17 | Visual | ✅ céu dinâmico, dia/noite, clima, sombras dinâmicas, água, vegetação, explosões. ⚠️ Materiais PBR/texturas de alta resolução dependem de arte autoral. |
| 18 | Áudio | ✅ sintetizado e espacializado (todas as categorias pedidas, inclusive músicas de lobby e vitória). Substituível por MetaSounds. |
| 19 | Otimização mobile | ✅ detecção de aparelho + benchmark, níveis Baixa/Média/Alta, metas 30/45/60 FPS, resolução dinâmica, rebaixamento automático por throttling, LOD/culling (HISM), instancing, distância de desenho por nível, partículas reduzidas, sombras limitadas, pool de texturas, ASTC, LOD de IA e animação, dormência de rede. ⚠️ Não medido em aparelhos. |
| 20 | Controles mobile | ✅ joystick flutuante, câmera por arraste, todos os botões, layout editável e redimensionável, sensibilidade, assistência de mira, giroscópio, vibração. |
| 21 | Anti-cheat | ✅ validação de tiro, dano, cadência, distância de construção, movimento/teleporte, rate limit de RPCs, inventário só no servidor, anti-duplicação, log de partida, denúncias. |
| 22 | Testes | ✅ regras testadas e executadas; testes de automação UE escritos; checklist manual em `TESTING.md`. |

## Próximos passos recomendados (em ordem)

1. Compilar no UE 5.4 e corrigir eventuais erros de compilação.
2. Rodar `Automation RunTests BR.` e o checklist de `TESTING.md` no editor (PIE com 2+ clientes).
3. Medir FPS em 3 aparelhos Android reais (entrada/médio/topo) e um iPhone; ajustar `DefaultDeviceProfiles.ini`.
4. Configurar EOS e um servidor dedicado de teste (`ONLINE.md`).
5. Substituir progressivamente os visuais procedurais por arte autoral (`CONTENT_PIPELINE.md`).
