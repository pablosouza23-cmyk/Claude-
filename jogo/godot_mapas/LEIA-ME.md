# Editor de mapas (Godot 4.3)

Mapas: `cenas/Megacidade.tscn` (mapa Megacidade) e `cenas/Cidade.tscn` (cidade da Metrópole).
Exportar a Megacidade: `godot --headless --path godot_mapas --script ferramentas/exportar_mapa.gd -- res://cenas/Megacidade.tscn mapa_megacidade.json`
Gerar a Megacidade do zero: `godot --headless --path godot_mapas --script ferramentas/gerar_megacidade.gd`
Na cena dá para usar caixas (MeshInstance3D + BoxMesh) e cilindros com cor; em Metadados: `solido` (tem colisão), `piso` (dá para subir em cima) e `mat` (stone, metal, wood, plain, roof, fabric). Marcadores `loot_*` viram pontos de item.

A cidade da Metrópole é montada aqui e exportada para o jogo.

## Como editar
1. Baixe o Godot 4.3 em https://godotengine.org e abra esta pasta (`godot_mapas`) como projeto.
2. Abra `cenas/Cidade.tscn`. Cada peça (prédio, rua, praça, fonte) é um nó: arraste, gire, duplique (Ctrl+D) ou apague à vontade.
   - Peças novas: arraste um `.glb` da pasta `modelos/` para a cena.
   - Prédio onde dá para entrar: duplique um nó `predio_entravel_*` (o número de andares fica em Metadados › andares).
   - 1 quadrado da grade = 9 metros no jogo. O meio da cena fica livre para a Torre do Relógio.
3. Salve a cena e exporte para o jogo com:
   `godot --headless --path godot_mapas --script ferramentas/exportar_mapa.gd -- res://cenas/Cidade.tscn mapa_cidade.json`
   Isso grava `assets/mapa_cidade.json`, que o jogo lê ao abrir.

## Gerar a cidade de novo do zero
`godot --headless --path godot_mapas --script ferramentas/gerar_cidade.gd` (apaga as mudanças feitas à mão na cena).

Modelos: kit de cidade da Kenney (CC0), https://github.com/KenneyNL/Starter-Kit-City-Builder
