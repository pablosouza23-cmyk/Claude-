# Gera cenas/Megacidade.tscn: mapa novo do zero (posições em metros).
# Centro com torre do relógio própria, bairro residencial, zona industrial, porto e base militar,
# ligados por avenidas. Peças: kit de cidade da Kenney (CC0) + caixas e cilindros feitos aqui.
# Rodar: godot --headless --path godot_mapas --script ferramentas/gerar_megacidade.gd
extends SceneTree

const T := 9.0
const PREDIOS := ["building-small-a", "building-small-b", "building-small-c", "building-small-d", "building-small-b", "building-garage"]
var rng := RandomNumberGenerator.new()
var raiz: Node3D
var cache := {}
var mats := {}
var n_id := 0

func _init() -> void:
	rng.seed = 777
	raiz = Node3D.new(); raiz.name = "Megacidade"
	centro(); residencial(Vector3(0, 0, -150)); industrial(Vector3(155, 0, 5)); porto(Vector3(5, 0, 160)); base_militar(Vector3(-155, 0, 0))
	avenida(Vector3(0, 0, -62), Vector3(0, 0, -112)); avenida(Vector3(62, 0, 0), Vector3(118, 0, 0))
	avenida(Vector3(0, 0, 62), Vector3(0, 0, 128)); avenida(Vector3(-62, 0, 0), Vector3(-118, 0, 0))
	for c in raiz.get_children(): _dono(c)
	var cena := PackedScene.new(); cena.pack(raiz)
	print("Megacidade.tscn: ", ResourceSaver.save(cena, "res://cenas/Megacidade.tscn"), " nós: ", n_id)
	quit()

func _dono(n: Node) -> void:
	n.owner = raiz
	if n.scene_file_path == "":
		for c in n.get_children(): _dono(c)

func grupo(nome: String, pos: Vector3, rot := 0.0) -> Node3D:
	var g := Node3D.new(); g.name = nome; g.position = pos; g.rotation.y = rot; raiz.add_child(g); return g

func _mat(cor: Color) -> StandardMaterial3D:
	var k := cor.to_html(false)
	if not mats.has(k):
		var m := StandardMaterial3D.new(); m.albedo_color = cor; mats[k] = m
	return mats[k]

func caixa(p: Node3D, pos: Vector3, tam: Vector3, cor: Color, mat := "plain", solido := true, rot := 0.0, piso := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); n_id += 1; mi.name = "caixa_%d" % n_id
	var bm := BoxMesh.new(); bm.size = tam; mi.mesh = bm; mi.material_override = null; mi.set_surface_override_material(0, _mat(cor))
	mi.position = pos + Vector3(0, tam.y / 2, 0); mi.rotation.y = rot
	mi.set_meta("mat", mat); mi.set_meta("solido", solido); mi.set_meta("piso", piso)
	p.add_child(mi); return mi

func cilindro(p: Node3D, pos: Vector3, r_top: float, r_bot: float, h: float, cor: Color, mat := "plain", solido := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); n_id += 1; mi.name = "cil_%d" % n_id
	var cm := CylinderMesh.new(); cm.top_radius = r_top; cm.bottom_radius = r_bot; cm.height = h; mi.mesh = cm; mi.set_surface_override_material(0, _mat(cor))
	mi.position = pos + Vector3(0, h / 2, 0); mi.set_meta("mat", mat); mi.set_meta("solido", solido)
	p.add_child(mi); return mi

func kenney(p: Node3D, nome: String, pos: Vector3, rot := 0.0) -> void:
	if not cache.has(nome): cache[nome] = load("res://modelos/%s.glb" % nome)
	var n: Node3D = cache[nome].instantiate(); n_id += 1; n.name = "%s_%d" % [nome, n_id]
	n.position = pos; n.rotation.y = rot; n.scale = Vector3.ONE * T
	p.add_child(n)

func predio(p: Node3D, pos: Vector3, andares: int, lx := 4.2, lz := 4.2) -> void:
	var m := Marker3D.new(); n_id += 1; m.name = "predio_%d" % n_id; m.position = pos
	m.set_meta("andares", andares); m.set_meta("largura", lx); m.set_meta("fundo", lz); p.add_child(m)

func loot(p: Node3D, pos: Vector3) -> void:
	var m := Marker3D.new(); n_id += 1; m.name = "loot_%d" % n_id; m.position = pos; p.add_child(m)

# ---------- centro: grade de ruas e quarteirões, praça com a torre ----------
func centro() -> void:
	var g := grupo("Centro", Vector3.ZERO)
	var ruas := [-6, -2, 2, 6]
	for i in range(-6, 7):
		for j in range(-6, 7):
			var pos := Vector3(i * T, 0, j * T)
			var ri := ruas.has(i); var rj := ruas.has(j)
			if abs(i) <= 1 and abs(j) <= 1:
				kenney(g, "pavement", pos); continue
			if ri and rj: kenney(g, "road-intersection", pos); continue
			if ri or rj:
				var k := j if ri else i
				kenney(g, "road-straight-lightposts" if k % 2 != 0 else "road-straight", pos, 0.0 if ri else PI / 2); continue
			var bi := posmod(i + 6, 4); var bj := posmod(j + 6, 4)
			if bi == 2 and bj == 2:
				if rng.randf() < 0.6: predio(g, pos, 2 + rng.randi() % 4)
				else:
					kenney(g, "pavement", pos); kenney(g, "pavement-fountain", pos)
				continue
			if rng.randf() < 0.12: kenney(g, "grass-trees", pos); continue
			var face := -PI / 2 if bi == 1 else (PI / 2 if bi == 3 else (PI if bj == 1 else 0.0))
			kenney(g, PREDIOS[rng.randi() % PREDIOS.size()], pos, face)
	torre(g, Vector3.ZERO)

func torre(p: Node3D, c: Vector3) -> void:
	var t := Node3D.new(); t.name = "TorreDoRelogio"; t.position = c; p.add_child(t)
	var pedra := Color("d8cfbf"); var escura := Color("8f8676"); var telhado := Color("3d5a6e")
	caixa(t, Vector3(0, 0, 0), Vector3(9, 1.2, 9), escura, "stone", true, 0.0, true)
	caixa(t, Vector3(0, 1.2, 0), Vector3(6, 20, 6), pedra, "stone")
	for k in 4: caixa(t, Vector3(0, 1.2 + k * 5, 0), Vector3(6.4, 0.5, 6.4), escura, "stone")
	caixa(t, Vector3(0, 21.2, 0), Vector3(7.6, 0.6, 7.6), escura, "stone", true, 0.0, true)
	for k in 4:
		var a := k * PI / 2; var d := Vector3(sin(a), 0, cos(a)) * 3.05
		var face := cilindro(t, d + Vector3(0, 16.2, 0), 1.9, 1.9, 0.2, Color("f4efe2"), "plain", false)
		face.rotation = Vector3(PI / 2, a, 0)
		caixa(t, d * 1.02 + Vector3(0, 17.2, 0), Vector3(0.18, 1.5, 0.12), Color("1d1d1d"), "metal", false, a)
		caixa(t, d * 1.02 + Vector3(0.4 * cos(a), 17.9, -0.4 * sin(a)), Vector3(1.0, 0.16, 0.12), Color("1d1d1d"), "metal", false, a)
	caixa(t, Vector3(0, 21.8, 0), Vector3(5, 4.2, 5), pedra, "stone")
	for s in [Vector3(2.1, 0, 2.1), Vector3(-2.1, 0, 2.1), Vector3(2.1, 0, -2.1), Vector3(-2.1, 0, -2.1)]:
		caixa(t, s + Vector3(0, 21.8, 0), Vector3(0.8, 4.2, 0.8), escura, "stone")
	cilindro(t, Vector3(0, 26, 0), 0.4, 4.2, 5.5, telhado, "roof")
	cilindro(t, Vector3(0, 31.5, 0), 0.05, 0.25, 3, Color("c9a23a"), "metal", false)

# ---------- bairro residencial: duas ruas com casas e quintais ----------
func residencial(c: Vector3) -> void:
	var g := grupo("BairroResidencial", c)
	for i in range(-4, 5):
		kenney(g, "road-straight-lightposts" if i % 2 else "road-straight", Vector3(i * T, 0, -9), PI / 2)
		kenney(g, "road-straight-lightposts" if i % 2 else "road-straight", Vector3(i * T, 0, 18), PI / 2)
	kenney(g, "road-intersection", Vector3(0, 0, -9)); kenney(g, "road-intersection", Vector3(0, 0, 18))
	for j in [0, 9]: kenney(g, "road-straight", Vector3(0, 0, j))
	for i in range(-4, 5):
		if i == 0: continue
		for row in [[-18.0, 0.0], [0.0, PI], [9.0, 0.0], [27.0, PI]]:
			var pos := Vector3(i * T, 0, float(row[0]))
			if rng.randf() < 0.22: kenney(g, "grass-trees" if rng.randf() < 0.6 else "grass", pos)
			elif rng.randf() < 0.18: predio(g, pos, 1 + rng.randi() % 2, 3.6, 3.6)
			else: kenney(g, ["building-small-a", "building-small-d", "building-small-a", "building-garage"][rng.randi() % 4], pos, row[1])
	loot(g, Vector3(0, 0, 4))

# ---------- zona industrial: galpões de entrar, contêineres, silos e chaminé ----------
func industrial(c: Vector3) -> void:
	var g := grupo("ZonaIndustrial", c)
	caixa(g, Vector3(0, -0.15, 0), Vector3(84, 0.3, 74), Color("8a8d90"), "stone", false, 0.0, true)
	for k in 3:
		galpao(g, Vector3(-26 + k * 26, 0, -20), Color(["9aa4ab", "b46a3c", "6f8f9a"][k]))
	var cores := [Color("c0392b"), Color("2e6fb5"), Color("3fa36b"), Color("e67e22"), Color("e8c11c"), Color("7d3c98")]
	for i in 6:
		for j in 2:
			var pos := Vector3(-30 + i * 7.5, 0, 8 + j * 9)
			caixa(g, pos, Vector3(6.1, 2.6, 2.45), cores[(i + j) % 6], "metal", true, 0.0, true)
			if rng.randf() < 0.5: caixa(g, pos + Vector3(0, 2.6, 0), Vector3(6.1, 2.6, 2.45), cores[(i * 3 + j) % 6], "metal", true, 0.0, true)
	for k in 3: cilindro(g, Vector3(22 + k * 7, 0, 22), 3, 3, 15, Color("c8ccd0"), "metal")
	cilindro(g, Vector3(34, 0, -2), 1.1, 1.6, 26, Color("8b5a4a"), "stone")
	loot(g, Vector3(0, 0, 4)); loot(g, Vector3(20, 0, 10))

func galpao(p: Node3D, c: Vector3, cor: Color) -> void:
	var g := Node3D.new(); g.name = "Galpao"; g.position = c; p.add_child(g)
	var W := 20.0; var D := 14.0; var H := 7.0
	caixa(g, Vector3(0, 0, -D / 2), Vector3(W, H, 0.4), cor, "metal")
	caixa(g, Vector3(-W / 2, 0, 0), Vector3(0.4, H, D), cor, "metal"); caixa(g, Vector3(W / 2, 0, 0), Vector3(0.4, H, D), cor, "metal")
	caixa(g, Vector3(-6.5, 0, D / 2), Vector3(7, H, 0.4), cor, "metal"); caixa(g, Vector3(6.5, 0, D / 2), Vector3(7, H, 0.4), cor, "metal")
	caixa(g, Vector3(0, 4.5, D / 2), Vector3(6, H - 4.5, 0.4), cor, "metal")
	caixa(g, Vector3(0, H, 0), Vector3(W + 1, 0.4, D + 1), cor.darkened(0.35), "metal", true, 0.0, true)
	for k in 3: caixa(g, Vector3(-6 + k * 6, 0, -2), Vector3(2.2, 1.6, 1.6), Color("a86f3c"), "wood", true, 0.0, true)
	loot(g, Vector3(0, 0, 2)); loot(g, Vector3(-6, 0, 3))

# ---------- porto: píer, guindaste, contêineres e um navio atracado ----------
func porto(c: Vector3) -> void:
	var g := grupo("Porto", c)
	caixa(g, Vector3(0, -0.2, 0), Vector3(70, 0.4, 30), Color("9a9fa4"), "stone", false, 0.0, true)
	caixa(g, Vector3(0, -0.6, 32), Vector3(60, 0.9, 34), Color("8a6a48"), "wood", true, 0.0, true)
	for i in 8: cilindro(g, Vector3(-28 + i * 8, -4, 48.5), 0.4, 0.4, 4.6, Color("5b4430"), "wood")
	var am := Color("e8b51c")
	for s in [Vector3(-6, 0, 22), Vector3(6, 0, 22), Vector3(-6, 0, 30), Vector3(6, 0, 30)]: caixa(g, s, Vector3(0.9, 18, 0.9), am, "metal")
	caixa(g, Vector3(0, 18, 26), Vector3(13, 1.4, 9.5), am, "metal", true, 0.0, true)
	caixa(g, Vector3(0, 19.4, 34), Vector3(2.2, 1.2, 34), am, "metal")
	caixa(g, Vector3(0, 19.4, 24), Vector3(4, 3, 4), Color("2c3e50"), "metal")
	var cores := [Color("c0392b"), Color("2e6fb5"), Color("3fa36b"), Color("e67e22")]
	for i in 5:
		caixa(g, Vector3(-26 + i * 6.8, 0, -6), Vector3(6.1, 2.6, 2.45), cores[i % 4], "metal", true, 0.0, true)
		caixa(g, Vector3(-26 + i * 6.8, 2.6, -6), Vector3(6.1, 2.6, 2.45), cores[(i + 1) % 4], "metal", true, 0.0, true)
	var navio := Node3D.new(); navio.name = "Navio"; navio.position = Vector3(10, 0, 60); g.add_child(navio)
	caixa(navio, Vector3(0, -3, 0), Vector3(46, 7, 12), Color("7a2a24"), "metal", true, 0.0, true)
	caixa(navio, Vector3(0, 4, 0), Vector3(44, 0.4, 11), Color("6f7b80"), "metal", true, 0.0, true)
	caixa(navio, Vector3(-16, 4.4, 0), Vector3(9, 7, 9), Color("e8e8e8"), "metal")
	caixa(navio, Vector3(-16, 11.4, 0), Vector3(10, 0.4, 10), Color("cfcfcf"), "metal", true, 0.0, true)
	for i in 4: caixa(navio, Vector3(-4 + i * 6.8, 4.4, 0), Vector3(6.1, 2.6, 2.45), cores[i % 4], "metal", true, 0.0, true)
	loot(g, Vector3(0, 0, 4)); loot(navio, Vector3(-16, 4.5, 0)); loot(g, Vector3(0, 19.5, 26))

# ---------- base militar: muralha, portão, torres de vigia, bunkers, heliponto e alojamentos ----------
func base_militar(c: Vector3) -> void:
	var g := grupo("BaseMilitar", c)
	var L := 64.0; var H := 3.4; var muro := Color("8e8a7c")
	caixa(g, Vector3(0, -0.15, 0), Vector3(L, 0.3, L), Color("7f7660"), "stone", false, 0.0, true)
	caixa(g, Vector3(0, 0, -L / 2), Vector3(L, H, 0.8), muro, "stone"); caixa(g, Vector3(-L / 2, 0, 0), Vector3(0.8, H, L), muro, "stone")
	caixa(g, Vector3(0, 0, L / 2), Vector3(L, H, 0.8), muro, "stone")
	caixa(g, Vector3(L / 2, 0, -19), Vector3(0.8, H, 26), muro, "stone"); caixa(g, Vector3(L / 2, 0, 19), Vector3(0.8, H, 26), muro, "stone")
	for s in [Vector3(-1, 0, -1), Vector3(1, 0, -1), Vector3(-1, 0, 1), Vector3(1, 0, 1)]:
		var tp: Vector3 = s * (L / 2 - 3)
		for q in [Vector3(-1.4, 0, -1.4), Vector3(1.4, 0, -1.4), Vector3(-1.4, 0, 1.4), Vector3(1.4, 0, 1.4)]: caixa(g, tp + q, Vector3(0.35, 7, 0.35), Color("5b4430"), "wood")
		caixa(g, tp + Vector3(0, 7, 0), Vector3(4, 0.3, 4), Color("6b4a2a"), "wood", true, 0.0, true)
		caixa(g, tp + Vector3(0, 10, 0), Vector3(4.4, 0.3, 4.4), Color("3a4a2a"), "fabric", false)
		loot(g, tp + Vector3(0, 7.3, 0))
	for k in 2: predio(g, Vector3(-14 + k * 28, 0, -16), 1, 6.0, 4.0)
	for k in 3: caixa(g, Vector3(-16 + k * 16, 0, 12), Vector3(5, 2.2, 4), Color("6f6a55"), "stone", true, 0.0, true)
	cilindro(g, Vector3(14, 0, 14), 6, 6, 0.15, Color("4a4f55"), "stone", false)
	caixa(g, Vector3(12.6, 0.15, 14), Vector3(0.6, 0.05, 4), Color("f0f0f0"), "plain", false); caixa(g, Vector3(15.4, 0.15, 14), Vector3(0.6, 0.05, 4), Color("f0f0f0"), "plain", false)
	caixa(g, Vector3(14, 0.15, 14), Vector3(2.4, 0.05, 0.6), Color("f0f0f0"), "plain", false)
	for i in 6: caixa(g, Vector3(22 + (i % 2) * 2.5, 0, -8 + i * 3), Vector3(2.2, 1.1, 0.9), Color("b59f74"), "fabric", true, 0.4)
	loot(g, Vector3(0, 0, 0)); loot(g, Vector3(-16, 0, 12))

# ---------- avenida reta de um ponto a outro (só em linha com os eixos) ----------
func avenida(a: Vector3, b: Vector3) -> void:
	var g := grupo("Avenida", Vector3.ZERO)
	var d := b - a; var n := int(round(d.length() / T)); var rot := 0.0 if abs(d.z) > abs(d.x) else PI / 2
	for k in n + 1: kenney(g, "road-straight-lightposts" if k % 3 == 1 else "road-straight", a + d.normalized() * k * T, rot)
