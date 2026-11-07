# Pipeline de conteúdo (trocar o procedural por arte autoral)

Todo sistema funciona sem assets. Para elevar o visual ao nível comercial, substitua por partes:

| O quê | Como plugar |
|---|---|
| Personagem 3D | Malha esquelética (UE5 Mannequin-compatible) + Anim Blueprint com **classe pai `UBRAnimInstance`**. Configure em *Project Settings → Ultimate Battle Royale → CharacterMesh / CharacterAnimClass*. O corpo procedural é desligado automaticamente; a arma prende no soquete `hand_r`. Variáveis prontas: velocidade, direção, inclinação, aim pitch/yaw, estados (agachado, deslizando, paraquedas, natação, derrubado...), offsets de IK de pé. |
| Trajes/skins | `FBRCosmeticDef::Mesh` (malha por traje) e `Montage` (emotes) em `Progression/BRCosmetics.cpp` — ou mova o catálogo para Data Assets. |
| Armas e itens | Crie Data Assets `BRWeaponDefinition` / `BRConsumableDefinition` / `BRItemDefinition` em `Content/Items` (tipo primário `BRItem`): `PickupMesh`, `Icon`, `FireSound`, `ReloadSound`, `FireMontage`, `ReloadMontage`, `MuzzleFX`. Um id igual ao embutido substitui o padrão. |
| VFX | Sistemas Niagara em *Project Settings*: `MuzzleFlashFX`, `ImpactFX`, `ExplosionFX`, `RainFX`. |
| Sons / MetaSounds | `SoundOverrides` (mapa `EBRSfx → Sound`) em *Project Settings*. |
| Tempestade | `StormWallMaterial`: material translúcido, *two-sided*, unlit, aplicado num cilindro escalado. |
| Água | `WaterMaterial` para o plano de água (ou use o plugin Water em mapa autoral). |
| Bots com Behavior Tree | Crie `BT_Bot` + Blackboard (chaves `TargetActor`, `MoveGoal`, `HasTarget`, `InStorm`) usando os nós "BR: ..." e configure `BotBehaviorTree`. |
| Mapa autoral (World Partition) | Crie um mapa WP, coloque um `ABRWorldGenerator` (ou nenhum) e NavMeshBoundsVolume; aponte a URL para o mapa. O modo de jogo usa o gerador existente se houver. |

Assets de terceiros: use apenas conteúdo original ou com licença (ex.: Fab com licença padrão).
Não importe personagens, armas, sons ou logos de outros jogos.
