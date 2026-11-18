# Gera os contornos das 6 regiões oficiais de Leonida a partir do mapa (terra x água) + âncoras
# e anota a região de cada landmark (campo 10).
# Uso: python3 -I regions.py <pasta de tiles 1024px> <landmarks.json curado (é reescrito)> <regions.json de saída>
import json, sys, os, numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure
from shapely.geometry import Polygon, Point, MultiPolygon
from shapely.ops import unary_union
TILES, LANDMARKS, REGIONS_OUT = sys.argv[1], sys.argv[2], sys.argv[3]
Z, MPPX, TS = -2, 4.0, 1024                    # nível 4 m/px
XMIN, XMAX, YMIN, YMAX = -11264, 3776, -9216, 11264
W, H = int((XMAX - XMIN) / MPPX), int((YMAX - YMIN) / MPPX)
img = np.zeros((H, W, 3), np.uint8); img[:] = (44, 103, 164)
span = TS * MPPX
for f in os.listdir(f"{TILES}/{Z}"):
    i, j = map(int, f[:-4].split('_'))
    x0 = i * span; ytop = -j * span                # canto sup. esquerdo em metros
    px, py = int((x0 - XMIN) / MPPX), int((YMAX - ytop) / MPPX)
    t = np.asarray(Image.open(f"{TILES}/{Z}/{f}").convert('RGB'))
    sx0, sy0 = max(0, -px), max(0, -py); dx0, dy0 = max(0, px), max(0, py)
    w = min(TS - sx0, W - dx0); h = min(TS - sy0, H - dy0)
    if w > 0 and h > 0: img[dy0:dy0 + h, dx0:dx0 + w] = t[sy0:sy0 + h, sx0:sx0 + w]
r, g, b = [img[..., k].astype(int) for k in range(3)]
water = (b - r > 60) & (b > g - 5)
land = ~water
# remove a barra de escala do mapa (canto inferior direito)
sx0, sx1 = int((-300 - XMIN) / MPPX), int((3776 - XMIN) / MPPX); sy0, sy1 = int((YMAX + 7500) / MPPX), int((YMAX + 8600) / MPPX)
land[sy0:sy1, sx0:sx1] = False
land = ndimage.binary_opening(land, iterations=2)
land = ndimage.binary_closing(land, iterations=4)
lab, n = ndimage.label(land)
sizes = ndimage.sum(land, lab, range(1, n + 1))
land = np.isin(lab, 1 + np.where(sizes > 120)[0])            # tira ilhotas < ~0,005 km²
land = ndimage.binary_fill_holes(land)                        # lagos internos entram na região
REG = [
  ('vice-city', 'Vice City', 'neon', '#ff007f', [[-961, 101], [1719, 938], [63, 873], [1086, -578], [-2524, -615], [10, 1137], [906, 661], [-783, 1740], [-233, -2158], [630, -2079], [1738, -1355], [-902, 2795], [416, 864]]),
  ('leonida-keys', 'Leonida Keys', 'keys', '#00f0ff', [[-2334, -5585], [-4372, -6818], [-4904, -7184], [-3300, -6400], [-5600, -7100], [-1500, -6100], [-4064, -6496]]),
  ('grassrivers', 'Grassrivers', 'swamp', '#4ade80', [[-3824, -4096], [-2593, -3190], [-4162, -4503], [-4997, -3002], [-1575, -3517], [-6408, -2478], [-3500, -1500], [-4600, -1200]]),
  ('port-gellhorn', 'Port Gellhorn', 'gulf', '#ff5e00', [[-6712, 3892], [-5399, 3684], [-6430, 1956], [-6583, -98], [-7378, 5114], [-5668, 6871], [-7184, 4224]]),
  ('ambrosia', 'Ambrosia', 'kalaga', '#facc15', [[-2843, 4013], [-3086, 3720], [-1016, 4092], [-210, 4126], [-4532, 2679], [-4071, 854], [-3568, 1336], [-1824, 4864]]),
  ('mount-kalaga', 'Mount Kalaga', 'kalaga', '#a3e635', [[-3510, 6975], [-3861, 7273], [-952, 6525], [-3824, 6144], [-2400, 7600]]),
]
# Voronoi das âncoras recortado pela terra (grade de 32 m)
C = 4
gx = np.arange(0, W, C); gy = np.arange(0, H, C)
GX, GY = np.meshgrid(XMIN + (gx + C / 2) * MPPX, YMAX - (gy + C / 2) * MPPX)
best = np.full(GX.shape, np.inf); owner = np.zeros(GX.shape, int)
for k, (_, _, _, _, an) in enumerate(REG):
    for ax, ay in an:
        d = np.hypot(GX - ax, GY - ay); m = d < best; best[m] = d[m]; owner[m] = k
landc = land[::C, ::C][:owner.shape[0], :owner.shape[1]]
out, polys = [], {}
for k, (rid, name, st, col, an) in enumerate(REG):
    mask = (owner == k) & landc
    mask = np.pad(mask, 1)
    parts = []
    for c in measure.find_contours(mask.astype(float), 0.5):
        pts = [(XMIN + (cx - 1 + 0.5) * C * MPPX, YMAX - (cy - 1 + 0.5) * C * MPPX) for cy, cx in c]
        if len(pts) < 4: continue
        p = Polygon(pts).buffer(0)
        if p.area > 40_000: parts.append(p)                  # > 0,04 km²
    geom = unary_union(parts).buffer(80).buffer(-80).simplify(35)
    geoms = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    geoms = [g for g in geoms if g.area > 40_000]
    polys[rid] = MultiPolygon(geoms)
    lab_pt = max(geoms, key=lambda g: g.area).representative_point()
    LABELS = {'vice-city': (300, 700), 'port-gellhorn': (-6800, 2600), 'ambrosia': (-2300, 3200), 'mount-kalaga': (-3100, 6900), 'grassrivers': (-3500, -3600), 'leonida-keys': (-3900, -6650)}
    lab_pt = Point(*LABELS[rid])
    out.append({'id': rid, 'name': name, 'station': st, 'color': col, 'label': [round(lab_pt.x), round(lab_pt.y)],
                'polys': [[[round(x), round(y)] for x, y in g.exterior.coords] for g in geoms],
                'area_km2': round(sum(g.area for g in geoms) / 1e6, 1)})
json.dump(out, open(REGIONS_OUT, 'w'), separators=(',', ':'))
# região de cada landmark
lms = json.load(open(LANDMARKS))
cnt = {}
for lm in lms:
    lm[10:] = []
    pt = Point(lm[4], lm[5]); rid = ''
    dmin = 600
    for k, mp in polys.items():
        if mp.contains(pt): rid = k; break
        d = mp.distance(pt)
        if d < dmin: dmin, rid = d, k
    lm.append(rid); cnt[rid or '—'] = cnt.get(rid or '—', 0) + 1
json.dump(lms, open(LANDMARKS, 'w'), ensure_ascii=False, separators=(',', ':'))
print({o['id']: (o['area_km2'], len(o['polys']), sum(len(p) for p in o['polys'])) for o in out})
print('landmarks por região', cnt, '| regions.json', os.path.getsize(REGIONS_OUT) // 1024, 'KB')
