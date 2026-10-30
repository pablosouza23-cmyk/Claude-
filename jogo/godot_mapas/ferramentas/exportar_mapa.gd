# Exporta uma cena de mapa para o jogo (JSON em ../assets/).
# Rodar: godot --headless --path godot_mapas --script ferramentas/exportar_mapa.gd -- <cena> <saida.json>
#   padrão: res://cenas/Megacidade.tscn -> ../assets/mapa_megacidade.json
# O que vira peça no jogo (posições em metros, só giro em Y):
#   - modelos .glb da pasta modelos/ (kit da Kenney)  -> {m: nome, x, y, z, r, s}
#   - MeshInstance3D com BoxMesh / CylinderMesh        -> {m: "caixa"|"cilindro", ..., cor, mat, solido}
#   - Marker3D "predio_*" (prédio de entrar)            -> {m: "predio", andares, lx, lz}
#   - Marker3D "loot_*" (ponto de item)                 -> {m: "loot"}
extends SceneTree

var lista := []

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var cena_path := args[0] if args.size() > 0 else "res://cenas/Megacidade.tscn"
	var saida := args[1] if args.size() > 1 else "mapa_megacidade.json"
	var root: Node3D = (load(cena_path) as PackedScene).instantiate()
	_varre(root, Transform3D.IDENTITY)
	var path := ProjectSettings.globalize_path("res://").path_join("../assets/" + saida)
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(JSON.stringify({"versao": 2, "pecas": lista}))
	f.close()
	print(saida, ": ", lista.size(), " peças")
	quit()

# a posição de cada peça é a soma das transformações dos pais (feito na mão: a cena não entra na árvore)
func _base(t: Transform3D) -> Dictionary:
	return {"x": snappedf(t.origin.x, 0.01), "y": snappedf(t.origin.y, 0.01), "z": snappedf(t.origin.z, 0.01), "r": snappedf(t.basis.get_euler().y, 0.0001)}

func _varre(n: Node, pai: Transform3D) -> void:
	for c in n.get_children():
		var xf: Transform3D = pai * (c as Node3D).transform if c is Node3D else pai
		var nome := String(c.name)
		if c is Marker3D:
			var it := _base(xf)
			if nome.begins_with("predio"):
				it["m"] = "predio"; it["andares"] = int(c.get_meta("andares", 3)); it["lx"] = float(c.get_meta("largura", 4.2)); it["lz"] = float(c.get_meta("fundo", 4.2))
				lista.append(it)
			elif nome.begins_with("loot"):
				it["m"] = "loot"; lista.append(it)
			continue
		if c is Node3D and c.scene_file_path != "":
			var it := _base(xf)
			it["m"] = c.scene_file_path.get_file().get_basename(); it["s"] = snappedf(xf.basis.get_scale().x, 0.001)
			lista.append(it)
			continue
		if c is MeshInstance3D and c.mesh != null:
			var it := _base(xf)
			var sc: Vector3 = xf.basis.get_scale()
			var mat := c.get_active_material(0) as StandardMaterial3D
			it["cor"] = "#" + (mat.albedo_color.to_html(false) if mat else "aaaaaa")
			var q := xf.basis.get_rotation_quaternion()
			it["q"] = [snappedf(q.x, 0.0001), snappedf(q.y, 0.0001), snappedf(q.z, 0.0001), snappedf(q.w, 0.0001)]
			it["mat"] = String(c.get_meta("mat", "plain")); it["solido"] = bool(c.get_meta("solido", true)); it["piso"] = bool(c.get_meta("piso", false))
			if c.mesh is BoxMesh:
				var s: Vector3 = (c.mesh as BoxMesh).size * sc
				it["m"] = "caixa"; it["sx"] = snappedf(s.x, 0.01); it["sy"] = snappedf(s.y, 0.01); it["sz"] = snappedf(s.z, 0.01)
				lista.append(it)
			elif c.mesh is CylinderMesh:
				var cm := c.mesh as CylinderMesh
				it["m"] = "cilindro"; it["rt"] = snappedf(cm.top_radius * sc.x, 0.01); it["rb"] = snappedf(cm.bottom_radius * sc.x, 0.01); it["h"] = snappedf(cm.height * sc.y, 0.01)
				lista.append(it)
		_varre(c, xf)
