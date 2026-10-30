# Lê cenas/Cidade.tscn e grava ../assets/mapa_cidade.json, que o jogo usa para montar a cidade da Metrópole.
# Rodar: godot --headless --path godot_mapas --script ferramentas/exportar_mapa.gd
# Cada filho da cena vira {m: modelo, x, z, r: giro, s: escala}; marcadores "predio_entravel_*" viram prédios de entrar.
extends SceneTree

func _init() -> void:
	var cena: PackedScene = load("res://cenas/Cidade.tscn")
	var root := cena.instantiate()
	var lista := []
	for c in root.get_children():
		var n := c as Node3D
		if n == null:
			continue
		var nome := String(n.name)
		var item := {"x": snappedf(n.position.x, 0.001), "z": snappedf(n.position.z, 0.001), "r": snappedf(n.rotation.y, 0.0001), "s": snappedf(n.scale.x, 0.001)}
		if nome.begins_with("predio_entravel"):
			item["m"] = "predio"
			item["andares"] = int(n.get_meta("andares", 3))
		elif n.scene_file_path != "":
			item["m"] = n.scene_file_path.get_file().get_basename()
		else:
			continue
		lista.append(item)
	var f := FileAccess.open("res://../assets/mapa_cidade.json", FileAccess.WRITE)
	if f == null:
		f = FileAccess.open(ProjectSettings.globalize_path("res://").path_join("../assets/mapa_cidade.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify({"versao": 1, "quadra": 9, "pecas": lista}))
	f.close()
	print("mapa_cidade.json: ", lista.size(), " peças")
	quit()
