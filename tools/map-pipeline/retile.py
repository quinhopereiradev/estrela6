# Converte os tiles 256px do GTADB em tiles 1024px para Leaflet (L.CRS.Simple): tiles/{Z}/{x}_{y}.jpg
# Uso: python3 -I retile.py <pasta maps/tiles/6/yanis,NN> <pasta de saída> [--preview prévia.jpg] [--xmax 3776]
# --xmax: limite leste em metros. Tudo a leste é cortado (no v17 é o painel de legenda com miniaturas da Rockstar).
#         Se a versão nova do mapa mudar o layout, confira a prévia e ajuste este valor.
import os, sys, argparse
from PIL import Image, ImageStat
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--preview', default=None); ap.add_argument('--xmax', type=float, default=3776.0)
args = ap.parse_args()
SRC, OUT = args.src, args.out
OCEAN = (44, 103, 164)
TS = 1024
X_MAX = args.xmax          # metros: tudo a leste disso é o painel/legenda (fora)
Y_MIN, Y_MAX, X_MIN = -9216.0, 11264.0, -11264.0
stats = {}
for zs, Z in [(1, -4), (2, -3), (3, -2), (4, -1), (5, 0)]:
    mppx = 32 / 2 ** zs
    span = TS * mppx                       # metros por tile 512
    off = int(round(16384 / (TS * mppx)))             # deslocamento em tiles 512
    os.makedirs(f"{OUT}/{Z}", exist_ok=True)
    i0, i1 = int(X_MIN // span), int((X_MAX - 1e-6) // span)
    j0, j1 = int(-Y_MAX // span), int((-Y_MIN - 1e-6) // span)
    n = skipped = 0
    for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
            tile = Image.new("RGB", (TS, TS), OCEAN)
            any_src = False
            k = TS // 256
            for dy in range(k):
                for dx in range(k):
                    xs, ys = k * (i + off) + dx, k * (j + off) + dy
                    f = f"{SRC}/{zs}/{zs},{ys},{xs}.jpg"
                    if os.path.exists(f):
                        tile.paste(Image.open(f).convert("RGB"), (dx * 256, dy * 256)); any_src = True
            # mascara o que estiver a leste de X_MAX (painel com miniaturas)
            cut = (X_MAX - i * span) / mppx
            if cut < TS:
                tile.paste(OCEAN, (max(0, int(cut)), 0, TS, TS))
            st = ImageStat.Stat(tile)
            if not any_src or max(st.stddev) < 7:
                skipped += 1; continue
            tile.save(f"{OUT}/{Z}/{i}_{j}.jpg", quality=76, optimize=True, progressive=True)
            n += 1
    stats[Z] = (n, skipped)
Image.new("RGB", (TS, TS), OCEAN).save(f"{OUT}/ocean.jpg", quality=80)
print(stats)
# prévia (nível -3) para conferir o recorte antes de publicar
if args.preview:
    Z, d = -3, f"{OUT}/-3"
    fs = [f for f in os.listdir(d) if f.endswith('.jpg')]
    ij = [tuple(map(int, f[:-4].split('_'))) for f in fs]
    i0, i1 = min(i for i, _ in ij), max(i for i, _ in ij); j0, j1 = min(j for _, j in ij), max(j for _, j in ij)
    prev = Image.new("RGB", ((i1 - i0 + 1) * TS, (j1 - j0 + 1) * TS), OCEAN)
    for f, (i, j) in zip(fs, ij): prev.paste(Image.open(f"{d}/{f}"), ((i - i0) * TS, (j - j0) * TS))
    prev.thumbnail((1200, 1200)); prev.save(args.preview, quality=82)
