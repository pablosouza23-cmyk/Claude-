"""Recorta as fotos individuais a partir das duas montagens fornecidas pela MKS.

Uso: python3 tools/prepare_images.py   (requer Pillow)
Fontes: tools/src_pizzas.png  e  tools/src_mix.png
Saida:  images/menu/*.webp  e  images/hero/*.webp (recortes elipticos com transparencia)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "images" / "menu"
HERO = ROOT / "images" / "hero"
OUT.mkdir(parents=True, exist_ok=True)
HERO.mkdir(parents=True, exist_ok=True)

pizzas = Image.open(ROOT / "tools/src_pizzas.png").convert("RGB")
mix = Image.open(ROOT / "tools/src_mix.png").convert("RGB")

COLS = [0, 251, 502, 753, 1004, 1254]
ROWS = [(66, 250), (254, 438), (442, 626), (630, 814), (897, 1048), (1052, 1238)]
PIZZA_NAMES = [
    ["americana", "atum", "bacon", "calabresa", "frango"],
    ["4-queijos", "presunto", "portuguesa", "marguerita", "milho"],
    ["moda-da-casa", "vegetariana", "pepperoni", "napolitana", "strogonoff"],
    ["palmito", "brigadeiro", "romeu-e-julieta", "chocolate", "banana"],
    ["caipira", "camarao", "carne-seca", "alho-e-oleo", "toscana"],
    ["ze-do-pipo", "costela", "lombo", "especial-da-casa", "quatro-estacoes"],
]


def save(img, path):
    img.save(path, "WEBP", quality=86, method=6)


# O titulo "TRADICIONAIS" invade o topo da Americana: cobre o texto com um trecho limpo do fundo ao lado
# (espelhado para nao deixar emenda), sem tocar na pizza.
def _cover(box, src_box):
    x0, y0, x1, y1 = box
    tile = pizzas.crop(src_box)
    mirrored = Image.new("RGB", (tile.width * 2, tile.height))
    mirrored.paste(tile, (0, 0))
    mirrored.paste(tile.transpose(Image.FLIP_LEFT_RIGHT), (tile.width, 0))
    out = Image.new("RGB", (x1 - x0, y1 - y0))
    for x in range(0, out.width, mirrored.width):
        out.paste(mirrored.resize((mirrored.width, out.height), Image.BILINEAR), (x, 0))
    pizzas.paste(out, (x0, y0))


_cover((30, 64, 190, 93), (192, 64, 240, 93))
_cover((36, 93, 86, 103), (192, 90, 240, 96))

for r, names in enumerate(PIZZA_NAMES):
    y0, y1 = ROWS[r]
    for c, name in enumerate(names):
        save(pizzas.crop((COLS[c] + 3, y0, COLS[c + 1] - 3, y1)), OUT / f"pizza-{name}.webp")

# Americana: corta o topo (restos do titulo) logo acima da borda da pizza.
save(pizzas.crop((COLS[0] + 3, 84, COLS[1] - 3, 250)), OUT / "pizza-americana.webp")

burgers = {
    "x-burguer": (30, 68, 285, 245),
    "x-salada": (330, 72, 615, 245),
    "x-bacon": (640, 42, 930, 245),
    "x-frango": (960, 42, 1245, 245),
    "x-egg": (130, 252, 420, 456),
    "x-tudo": (480, 238, 770, 456),
    "x-calabresa": (815, 252, 1115, 456),
}
for name, box in burgers.items():
    save(mix.crop(box), OUT / f"{name}.webp")

portions = {
    "batata-frita": (8, 266), "batata-com-bacon": (274, 515), "batata-com-cheddar-e-bacon": (523, 749),
    "batata-com-queijo": (758, 991), "batata-cheddar": (1002, 1248),
}
for name, (x0, x1) in portions.items():
    save(mix.crop((x0, 523, x1, 697)), OUT / f"{name}.webp")


def cutout(src, cx, cy, rx, ry, name):
    pad = 14
    box = (cx - rx - pad, cy - ry - pad, cx + rx + pad, cy + ry + pad)
    im = src.crop(box).convert("RGBA")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).ellipse((pad - 4, pad - 4, im.width - pad + 4, im.height - pad + 4), fill=255)
    im.putalpha(mask.filter(ImageFilter.GaussianBlur(3)))
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    im.save(HERO / f"{name}.webp", "WEBP", quality=88, method=6)


cutout(pizzas, 880, 142, 120, 68, "calabresa")
cutout(pizzas, 878, 332, 120, 68, "marguerita")
cutout(pizzas, 630, 332, 120, 68, "portuguesa")
