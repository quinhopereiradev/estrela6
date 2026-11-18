# Curadoria dos landmarks GTADB (CC BY 4.0)
# Uso: python3 -I curate.py <landmarks.json do GTADB> <saida.json>
# Saída: [id, nome, distrito, área, x, y, inspiração_real, tipo, flags, tier]
import json, sys, math, collections
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))

GENERIC = {"bridge", "bus stop", "parking lot", "train bridge", "prison building", "lake", "lifeguard tower",
           "water tower", "train tunnel", "park", "river", "construction site", "warehouse", "tank", "cell tower",
           "tennis court", "radio tower", "parking garage", "canal", "radio mast", "guard booth", "pier",
           "footbridge", "lock", "tunnel", "turn", "fence", "silo", "guardhouse", "hangar", "sculpture",
           "building", "house", "dock", "shed", "billboard", "sign", "gate", "road", "street", "overpass"}
# (tipo, tags que disparam, tier)
TYPES = [
    ("safehouse", {"#safehouse"}, 1), ("aeroporto", {"#airport"}, 1), ("marina", {"#marina"}, 1),
    ("trem", {"#train", "#metro", "#metromover"}, 2), ("corrida", {"#racetrack"}, 1),
    ("armas", {"#guns"}, 1), ("posto", {"#gas"}, 1), ("marco", {"landmark"}, 1),
    ("hotel", {"hotel"}, 2), ("comida", {"restaurant", "#bar"}, 2),
    ("loja", {"retail", "#supermarket", "#hair", "#vendor", "office"}, 2),
    ("lazer", {"leisure", "events", "#tennis"}, 2), ("natureza", {"natural"}, 2),
    ("servico", {"government", "public", "utilities"}, 2), ("transporte", {"transportation"}, 2),
    ("industria", {"industrial", "construction"}, 3), ("residencia", {"residential"}, 3),
]
stats = collections.Counter()
rows = []
for k, v in d.items():
    if not v[1] or v[1][0] in (None, -8000) or v[1][1] == -8000:
        stats["sem_coordenada"] += 1; continue
    parts = [p.strip() for p in v[0].split(",")]
    raw = parts[0]
    if raw in ("?", ""):
        stats["sem_nome"] += 1; continue
    tags = set(v[6])
    if "demolished" in tags or "//may-not-exist" in tags:
        stats["demolido_ou_incerto"] += 1; continue
    if "#bus" in tags:
        stats["ponto_de_onibus"] += 1; continue
    name = raw.rstrip("?").strip()
    typ, tier = "outros", 2
    for t, trig, tr in TYPES:
        if tags & trig:
            typ, tier = t, tr; break
    if name.lower() in GENERIC and typ not in ("posto", "trem", "aeroporto", "marina"):
        stats["nome_generico"] += 1; continue
    flags = ""
    if "enterable" in tags: flags += "e"
    if "unconfirmed" in tags or raw.endswith("?"): flags += "u"
    if "closed" in tags: flags += "c"
    if "e" in flags and tier == 3: tier = 2          # interiores acessíveis sobem de importância
    rows.append([k, name, parts[1] if len(parts) > 2 else "", parts[-1] if len(parts) > 1 else "",
                 round(v[1][0], 1), round(v[1][1], 1), v[3] or "", typ, flags, tier])

# junta duplicatas: mesmo nome a menos de 400 m
kept, seen = [], collections.defaultdict(list)
for r in rows:
    key = r[1].lower()
    if any(math.hypot(r[4] - x, r[5] - y) < 400 for x, y in seen[key]):
        stats["duplicata"] += 1; continue
    seen[key].append((r[4], r[5])); kept.append(r)

json.dump(kept, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
print("entrada", len(d), "| mantidos", len(kept), "| removidos", dict(stats))
print("por tipo", collections.Counter(r[7] for r in kept).most_common())
print("por tier", collections.Counter(r[9] for r in kept))
