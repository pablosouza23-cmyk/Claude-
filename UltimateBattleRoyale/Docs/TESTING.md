# Testes

## 1. Regras (sem Unreal) — executados
```
Tests/RulesTests/run_tests.sh        # g++
CXX=clang++ Tests/RulesTests/run_tests.sh
```
37 casos: RNG/ruído, queda de dano, headshots, escudo, curas, bloom/dispersão, recuo, validação de cadência,
de origem e de acerto com cápsula, explosões e queda, círculos da tempestade e linha do tempo, normalização
da grade, posicionamento por mira, materiais, máscaras de edição, adjacência, pesos de loot, raridades,
validação de movimento, token bucket, níveis/XP/passe, pilhas de inventário, física de veículo, fluxo de
partida, rota do ônibus, níveis de aparelho, convergência da resolução dinâmica, aim assist e modelo de
mundo (POIs secos e planos, rio/lago/mar, determinismo e continuidade).

## 1b. Backend — executados
```
cd Backend && python3 -m unittest discover -s tests -t . -v
```
23 testes: verificação cruzada com o C++ (curva de XP, recompensas, passe, desafios, rotação da loja),
catálogo sincronizado com `BRCosmetics.cpp`, regras de compra/passe/loadout/limite, resultados idempotentes e
plausíveis, API HTTP real (autenticação, assinatura HMAC, expiração), validação de JWT RS256 do EOS e o vetor de
assinatura compartilhado com o teste `BR.Backend.Signature` do Unreal.

## 2. Automação Unreal — escritos
```
UnrealEditor-Cmd UltimateBattleRoyale.uproject -ExecCmds="Automation RunTests BR.;Quit" -unattended -nullrhi -log
```
`BR.Items.Registry`, `BR.Inventory.Stacking`, `BR.Modes.Rules`, `BR.Progression.Cosmetics`,
`BR.Audio.Synth`, `BR.Building.Geometry`, `BR.Backend.Signature`, `BR.Functional.MatchBoots` (sobe uma partida real).

## 3. Checklist manual (PIE, 1 servidor + 2 clientes)
- [ ] Menu: todas as abas abrem; trocar traje/cabelo atualiza o lobby 3D; compra com moedas; resgate do passe.
- [ ] Aquecimento: respawn, invulnerável, contagem inicia com 2 jogadores.
- [ ] Ônibus: câmera, salto, queda livre, planador automático ~50 m, pouso sem dano.
- [ ] Movimento: sprint, deslize, agachar, pular, escalar borda 2 m, nadar no rio/lago.
- [ ] Armas: cada categoria dispara, recarrega, recuo, headshot amarelo, número de dano, munição do inventário.
- [ ] Granadas explodem/empurram; foguete destrói construção.
- [ ] Inventário: 5 slots, troca ao pegar com cheio, largar, munição/materiais automáticos, curas com tempo.
- [ ] Baú, caixa de munição, suprimento caindo, lhama no bunker.
- [ ] Construção: 4 peças × 3 materiais, giro, turbo, edição porta/janela, colapso ao quebrar base.
- [ ] Veículos: entrar/sair, dirigir, combustível, abastecer no posto, barco no lago, dano por colisão.
- [ ] Tempestade: fases, dano fora, aviso no HUD, círculos no mapa.
- [ ] Duplas: derrubar, rastejar, reanimar; equipe toda derrubada = eliminada.
- [ ] Espectador após eliminação; vitória e tela de resultado; XP aplicado no perfil.
- [ ] Chat, ping, denúncia (verificar `Saved/MatchLogs/*.jsonl`).
- [ ] Reconexão: fechar cliente no meio da partida e reconectar em < 2 min.
- [ ] Mobile: controles touch, editor de layout, giroscópio, vibração, qualidade automática, FPS alvo.
