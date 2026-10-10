"""
Route every City Bus line along the real road network (MPWT 2014 road lines).

For each line, a few anchor points (terminals and turning points on the roads named in the
2020 brochure) are snapped to the road graph, and consecutive anchors are joined by the
cheapest path. Cost = length × road-class factor, so buses prefer national/provincial roads
and city streets over tracks and footpaths. Where the 2014 data has no road (newer roads
such as Win Win Blvd), the line is drawn straight and marked as a gap.

Stops are then re-spaced along the routed line in brochure order (still approximate
positions; replace with surveyed stops when available).

  python3 tools/route_citybus_on_roads.py <Kh_All_Roads_MPWT2014.geojson clipped to Phnom Penh, WGS84>
Make that input with:
  npx mapshaper -i Kh_All_Roads_MPWT2014.shp encoding=utf8 -proj wgs84 -clip bbox=104.70,11.40,105.12,11.80 \
      -o pp_roads.geojson precision=0.000001
"""
import heapq, json, math, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_approx_citybus as base  # colours, headways, brochure stop lists

OUT = os.path.join(HERE, "..", "pages", "transport-citybus", "data")
FACTOR = {  # (ROAD_TYPE, Type) -> cost factor
    "National Road": 0.7, "Secondary National Road": 0.75, "Provincial Road": 0.85, "City Road": 1.0,
}
TYPE_FACTOR = {"Track": 2.5, "Cycleway, footpath, etc.": 8.0}
SNAP_MAX_KM = 0.6

# Anchor points (lon, lat) per line, in travel order. Placed on the roads the brochure names;
# the router fills in the road geometry between them.
P = {
    "depot": (104.857, 11.666), "prekpnov_w": (104.862, 11.660), "km9": (104.897, 11.634), "nr5_mid": (104.918, 11.605),
    "oldstadium": (104.9195, 11.5866), "freedom": (104.9205, 11.5755), "central": (104.9215, 11.5695),
    "riverside": (104.9300, 11.5720), "monivong_n": (104.9175, 11.5800), "monivong_mid": (104.9180, 11.5550),
    "monivong_s": (104.9195, 11.5330), "monivong_br": (104.9330, 11.5315), "chbarampov": (104.9420, 11.5330),
    "nr1_e": (104.9700, 11.5390), "boengchhuk": (104.9930, 11.5340), "kienvay": (105.0300, 11.5180),
    "princemanor": (105.0580, 11.5070),
    "norodom_n": (104.9270, 11.5730), "indep": (104.9280, 11.5560), "norodom_s": (104.9290, 11.5370),
    "nr2_a": (104.9370, 11.5100), "takhmao": (104.9440, 11.4850), "preksamrong": (104.9320, 11.4580),
    "russian_e": (104.9150, 11.5720), "russian_mid": (104.8900, 11.5675), "century": (104.8700, 11.5630),
    "airport": (104.8450, 11.5550), "chaomchau": (104.8300, 11.5350), "nr3_s": (104.8220, 11.5150), "bsp2": (104.8180, 11.5000),
    "cdg_ne": (104.9180, 11.5650), "olympic": (104.9120, 11.5560), "monireth_mid": (104.8980, 11.5440),
    "sm_int": (104.8860, 11.5320), "vengsreng_mid": (104.8600, 11.5320), "tuolpongro": (104.8550, 11.5250),
    "nr4_w": (104.8000, 11.5250), "tradecity": (104.7750, 11.5200),
    "chamkardoung": (104.8925, 11.5000), "chamkardoung_s": (104.8880, 11.4700), "prekkampues": (104.9050, 11.4460),
    "aeonsensok": (104.8870, 11.6020), "camko": (104.8980, 11.5920), "itc": (104.8960, 11.5680),
    "mao_w": (104.8990, 11.5480), "mao_mid": (104.9180, 11.5470), "aeonmall": (104.9320, 11.5480),
    "st271_n": (104.8930, 11.5600), "st271_s": (104.8900, 11.5400), "st271_e": (104.9080, 11.5330),
    "st2004": (104.8660, 11.5600), "sola": (104.8712, 11.5515),
    "sleng": (104.8350, 11.4980), "preysor": (104.8600, 11.5000),
    "station": (104.9150, 11.5760), "nehru_s": (104.9110, 11.5460), "st360_e": (104.9260, 11.5450), "trasak": (104.9240, 11.5620),
    "czech": (104.9135, 11.5600), "st163": (104.9140, 11.5470), "deumthkov": (104.9150, 11.5380),
    "vattanac": (104.8050, 11.4600), "ppsez": (104.7800, 11.4900),
    "nr6_bridge": (104.9285, 11.5900), "nr6_a": (104.9230, 11.6300), "nr6_b": (104.9140, 11.6600),
    "nr6_c": (104.9300, 11.6990), "winwin_e": (104.9050, 11.7150), "safari": (104.8800, 11.7050),
    "st70": (104.9050, 11.5885), "mongrithy_w": (104.8680, 11.5920), "tryheng": (104.8660, 11.5700),
}
ROUTES = {
    "1A": ["boengchhuk", "nr1_e", "chbarampov", "monivong_br", "monivong_s", "monivong_mid", "monivong_n", "oldstadium", "nr5_mid", "km9", "prekpnov_w", "depot"],
    "1B": ["boengchhuk", "kienvay", "princemanor"],
    "2": ["oldstadium", "norodom_n", "indep", "norodom_s", "nr2_a", "takhmao", "preksamrong"],
    "3": ["freedom", "riverside", "central", "russian_e", "russian_mid", "century", "airport", "chaomchau", "nr3_s", "bsp2"],
    "4A": ["freedom", "oldstadium", "central", "cdg_ne", "olympic", "monireth_mid", "sm_int", "tuolpongro", "nr3_s", "bsp2"],
    "4B": ["freedom", "oldstadium", "central", "cdg_ne", "olympic", "monireth_mid", "sm_int", "vengsreng_mid", "chaomchau", "nr4_w", "tradecity"],
    "4C": ["freedom", "oldstadium", "central", "cdg_ne", "olympic", "monireth_mid", "sm_int", "chamkardoung", "chamkardoung_s", "prekkampues"],
    "5A": ["depot", "aeonsensok"],
    "5B": ["aeonsensok", "camko", "itc", "mao_w", "mao_mid", "aeonmall"],
    "6": ["oldstadium", "nr6_bridge", "nr6_a", "nr6_b", "nr6_c", "winwin_e", "safari", "depot"],
    "7": ["km9", "camko", "itc", "st271_n", "st271_s", "st271_e", "monivong_s", "monivong_br", "chbarampov", "nr1_e", "boengchhuk"],
    "8": ["oldstadium", "st70", "mongrithy_w", "tryheng", "st2004"],
    "9": ["bsp2", "vattanac", "ppsez", "tradecity"],
    "10": ["st2004", "sola", "sm_int", "st271_e", "monivong_s", "monivong_br", "chbarampov"],
    "11": ["sleng", "preysor", "chamkardoung", "sm_int"],
    "12": ["station", "nehru_s", "st360_e", "trasak", "station"],
    "13": ["station", "czech", "st163", "deumthkov"],
}

def hav(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))

def densify(c, step_km=0.04):
    """Insert points every ~40 m so anchors can snap anywhere along a road, not only at its vertices."""
    out = [c[0]]
    for a, b in zip(c, c[1:]):
        n = int(hav(a, b) / step_km)
        for i in range(1, n + 1):
            t = i / (n + 1); out.append([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        out.append(b)
    return out

def drop_spurs(coords):
    """Remove out-and-back detours (A→B→…→B→A) created when an anchor snaps onto a side street."""
    out = []
    for c in coords:
        out.append(c)
        while len(out) >= 3 and out[-1] == out[-3]:
            out.pop(); out.pop()
    return out

def build_graph(fc):
    key = lambda c: (round(c[0], 6), round(c[1], 6))
    adj = defaultdict(dict)
    good = set()
    for f in fc["features"]:
        p = f["properties"]
        fac = TYPE_FACTOR.get(p.get("Type"), FACTOR.get(p.get("ROAD_TYPE"), 1.3))
        g = f["geometry"]
        for c in ([g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]):
            c = densify(c)
            for a, b in zip(c, c[1:]):
                ka, kb = key(a), key(b)
                if ka == kb: continue
                w = hav(ka, kb) * fac
                if w < adj[ka].get(kb, 1e9):
                    adj[ka][kb] = w; adj[kb][ka] = w
                if fac <= 1.3: good.update((ka, kb))
    return adj, good

def nearest(nodes, p):
    best, bd = None, 1e9
    for n in nodes:
        d = (n[0] - p[0]) ** 2 + (n[1] - p[1]) ** 2
        if d < bd: best, bd = n, d
    return best, hav(best, p)

def dijkstra(adj, s, t):
    dist, prev, pq = {s: 0.0}, {}, [(0.0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t: break
        if d > dist.get(u, 1e18): continue
        for v, w in adj[u].items():
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    if t not in dist: return None
    path = [t]
    while path[-1] != s: path.append(prev[path[-1]])
    return path[::-1]

def cumdist(path):
    d = [0.0]
    for a, b in zip(path, path[1:]): d.append(d[-1] + hav(a, b))
    return d

def main(roads_path):
    fc = json.load(open(roads_path, encoding="utf-8"))
    adj, good = build_graph(fc)
    good = list(good)
    snaps = {}
    for k, p in P.items():
        n, d = nearest(good, p)
        snaps[k] = (n, d)
        if d > SNAP_MAX_KM: print(f"  anchor {k} is {d*1000:.0f} m from a road")
    lines_out, stops_out, report = [], [], []
    meta = {L["id"]: L for L in base.LINES}
    for lid, anchors in ROUTES.items():
        coords, gaps = [], []
        for a, b in zip(anchors, anchors[1:]):
            (na, da), (nb, db) = snaps[a], snaps[b]
            path = dijkstra(adj, na, nb) if da <= SNAP_MAX_KM and db <= SNAP_MAX_KM else None
            straight = hav(na, nb)
            if path and cumdist(path)[-1] <= max(3.0 * straight, straight + 1.5):
                seg = path
            else:  # no road in the 2014 data: draw straight, remember the gap
                seg = [P[a], P[b]]; gaps.append(f"{a}→{b}")
            coords.extend(seg if not coords else seg[1:])
        coords = drop_spurs(coords)
        L = meta[lid]; cd = cumdist(coords); total = cd[-1]
        names = [n.strip() for n in base.STOPS[lid].split("|")]
        lines_out.append({"type": "Feature", "properties": {
            "line": lid, "color": L["color"], "from_en": L["from_en"], "to_en": L["to_en"], "via": L["via"],
            "headway_min": list(L["headway"]), "loop": bool(L.get("loop")), "length_km": round(total, 2),
            "n_stops": len(names), "geometry_quality": "routed on MPWT 2014 roads" + (" (with gaps)" if gaps else ""),
            "gaps": gaps}, "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in coords]}})
        for i, nm in enumerate(names):
            s = total * i / (len(names) - 1)
            x, y = base.point_at(coords, cd, s)
            stops_out.append({"type": "Feature", "properties": {
                "id": f"{lid}-{i+1:02d}", "line": lid, "seq": i + 1, "name_en": nm, "name_km": "",
                "dist_km": round(s, 3), "position_quality": "approximate"},
                "geometry": {"type": "Point", "coordinates": [round(x, 6), round(y, 6)]}})
        report.append(f"Line {lid:>3}: {total:5.1f} km, {len(names):2d} stops" + (f", gaps: {', '.join(gaps)}" if gaps else ""))
    for name, feats in (("lines", lines_out), ("stops", stops_out)):
        with open(os.path.join(OUT, f"{name}.geojson"), "w", encoding="utf-8") as fh:
            json.dump({"type": "FeatureCollection", "features": feats}, fh, ensure_ascii=False, separators=(",", ":"))
    print("\n".join(report))

if __name__ == "__main__":
    main(sys.argv[1])
