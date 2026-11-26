---
name: partyverse-game-optimization
description: Diretrizes de desempenho mobile do PARTYVERSE (qualidade Baixa/Média/Alta, instancing, partículas, memória). Use ao adicionar cenários, efeitos ou modelos.
---
# Otimização
- Presets em `client/src/core/Renderer.ts` (pixel ratio, sombras, distância, partículas, env map). Resolução dinâmica reduz a escala abaixo de ~48 FPS.
- Objetos repetidos → `Batcher` (InstancedMesh). Materiais via `mat()` (cache), geometrias via `rbox()` (cache).
- Partículas sempre multiplicadas por `renderer.preset.particles`.
- Minigames são chunks dinâmicos; ao sair da partida `View.dispose()` remove tudo. Não carregue dois mapas ao mesmo tempo.
- Evite PointLights extras; prefira emissive.
