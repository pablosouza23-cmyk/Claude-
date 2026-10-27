# Ilha de Fogo — Battle Royale (protótipo)

Jogo de tiro 3D no navegador (PC e celular), estilo battle royale: 20 jogadores, queda de paraquedas, loot, zona que fecha, escudo implantável e minimapa.

## Rodar
```bash
cd jogo && python3 -m http.server 8000   # abra http://localhost:8000
```
Precisa de internet (three.js e o personagem vêm do CDN jsDelivr).

## Colocar as armas do seu pack (weapon+pack_001.rar do Drive)
1. Extraia o .rar e abra cada arma no Blender (grátis): File > Import (FBX/OBJ) > File > Export > glTF 2.0 (.glb).
2. Salve em `jogo/assets/armas/` com estes nomes: `pistola.glb`, `smg.glb`, `fuzil.glb`, `escopeta.glb`, `sniper.glb`.
3. Recarregue o jogo. Arma sem arquivo continua com o modelo procedural.

## Trocar o personagem
Salve um .glb rigado com animações `Idle` e `Run` em `jogo/assets/personagem.glb`.

## Assets 3D gratuitos (uso comercial liberado)
- Quaternius — quaternius.com (personagens animados, armas, cenários, CC0)
- Kenney — kenney.nl (cidades, props, armas, CC0)
- Poly Pizza — poly.pizza (milhares de modelos low-poly)
- Mixamo — mixamo.com (personagens e animações grátis, conta Adobe)
- Sketchfab — filtre por "Downloadable" + licença CC0/CC-BY

> Skins, HUD, nomes e mapas são originais. Copiar arte, personagens ou marcas do Free Fire/Blood Strike (Garena/NetEase) não é permitido para publicar.
