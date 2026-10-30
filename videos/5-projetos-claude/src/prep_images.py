"""Recorta e trata as imagens a partir dos prints do carrossel (fallback offline).
Para usar fotos próprias, basta substituir os arquivos em assets/ mantendo os nomes."""
import sys
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

UP = sys.argv[1]  # pasta com os prints
OUT = sys.argv[2]
crops = {
    # nome: (arquivo, caixa x0,y0,x1,y1) em pixels do print 1080x2340
    "estatua.jpg":    ("b5804021-image.jpg", (0, 560, 1080, 1094)),
    "relogio.jpg":    ("e857f378-image.jpg", (640, 585, 980, 1015)),
    "cerebro.jpg":    ("04eb040e-image.jpg", (390, 610, 1010, 1000)),
    "paleta.jpg":     ("a83a0f25-image.jpg", (520, 990, 980, 1420)),
    "biblioteca.jpg": ("5654e3d2-image.jpg", (0, 560, 1080, 975)),
    "lousa.jpg":      ("d10be708-image.jpg", (0, 1290, 1080, 1600)),
}
for name, (src, box) in crops.items():
    im = Image.open(f"{UP}/{src}").convert("RGB").crop(box)
    w, h = im.size
    k = max(1, 1400 / max(w, h))
    im = im.resize((int(w * k), int(h * k)), Image.LANCZOS)
    im = ImageOps.grayscale(im)
    im = ImageEnhance.Contrast(im).enhance(1.15)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    im.save(f"{OUT}/{name}", quality=93)
    print(name, im.size)
