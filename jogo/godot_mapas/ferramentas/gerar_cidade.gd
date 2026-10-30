# Gera a cena da cidade (cenas/Cidade.tscn) com as peças do kit da Kenney (CC0).
# Rodar: godot --headless --path godot_mapas --script ferramentas/gerar_cidade.gd
# Depois é só abrir a cena no editor, mexer à vontade e exportar com exportar_mapa.gd.
extends SceneTree

const N := 8          # a cidade vai de -N a N quadras (1 quadra = 1 unidade; no jogo vira 9 m)
const RUAS := [-8, -3, 3, 8]
const PREDIOS := ["building-small-a", "building-small-b", "building-small-c", "building-small-d", "building-small-b", "building-garage"]

func _init() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2026
	var root := Node3D.new()
	root.name = "Cidade"
	var pecas := {}
	for i in range(-N, N + 1):
		for j in range(-N, N + 1):
			var ri := RUAS.has(i)
			var rj := RUAS.has(j)
			# praça da torre do relógio no meio: fica livre (o jogo monta a torre)
			if abs(i) <= 2 and abs(j) <= 2:
				continue
			if ri and rj:
				_poe(root, pecas, "road-intersection", i, j, 0.0)
			elif ri or rj:
				var k := j if ri else i
				_poe(root, pecas, "road-straight-lightposts" if k % 2 != 0 else "road-straight", i, j, 0.0 if ri else PI / 2)
			else:
				_quarteirao(root, pecas, rng, i, j)
	var cena := PackedScene.new()
	_dono(root, root)
	cena.pack(root)
	var err := ResourceSaver.save(cena, "res://cenas/Cidade.tscn")
	print("Cidade.tscn salva: ", err, " peças: ", root.get_child_count())
	quit()

func _quarteirao(root: Node3D, pecas: Dictionary, rng: RandomNumberGenerator, i: int, j: int) -> void:
	# distância até a rua mais perto em cada eixo
	var di := 99
	var dj := 99
	var si := 0
	var sj := 0
	for r in RUAS:
		if abs(i - r) < di:
			di = abs(i - r); si = sign(r - i)
		if abs(j - r) < dj:
			dj = abs(j - r); sj = sign(r - j)
	if di == 1 or dj == 1:
		# na beira do quarteirão: prédio virado para a rua (às vezes um jardim)
		if rng.randf() < 0.15:
			_poe(root, pecas, "grass-trees" if rng.randf() < 0.5 else "grass", i, j, 0.0)
		else:
			var rot := (PI / 2 * si) if di == 1 else (0.0 if sj > 0 else PI)
			_poe(root, pecas, PREDIOS[rng.randi() % PREDIOS.size()], i, j, rot)
	else:
		# miolo do quarteirão: prédio de entrar (marcador), fonte ou bosque
		var t := rng.randf()
		if t < 0.45:
			var m := Marker3D.new()
			m.name = "predio_entravel_%d_%d" % [i + 20, j + 20]
			m.position = Vector3(i, 0, j)
			m.set_meta("andares", 2 + rng.randi() % 3)
			root.add_child(m)
		else:
			_poe(root, pecas, "pavement", i, j, 0.0)
			_poe(root, pecas, "pavement-fountain" if t < 0.7 else "grass-trees-tall", i, j, 0.0)

func _poe(root: Node3D, pecas: Dictionary, nome: String, i: int, j: int, rot: float) -> void:
	if not pecas.has(nome):
		pecas[nome] = load("res://modelos/%s.glb" % nome)
	var n: Node3D = pecas[nome].instantiate()
	n.name = "%s_%d_%d" % [nome, i + 20, j + 20]
	n.position = Vector3(i, 0, j)
	n.rotation.y = rot
	root.add_child(n)

func _dono(n: Node, root: Node) -> void:
	for c in n.get_children():
		c.owner = root
