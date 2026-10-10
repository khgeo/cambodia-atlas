"""
Replace the approximate City Bus data with real geometry and stop positions from OpenStreetMap.

What it does
  1. Downloads every bus route relation (route=bus) in the Phnom Penh area from the Overpass API.
  2. Keeps relations whose `ref` matches a City Bus line (1A, 1B, 2, 3, 4A ... 13).
     A line often has two relations (one per direction); the first (or the one you pick in
     PREFERRED_RELATION) is used for the line geometry and stop order.
  3. Joins the route's ways into one LineString and reads its stops (members with role
     stop / platform, in order).
  4. Fills missing English names by fuzzy-matching against the brochure stop list
     (tools/make_approx_citybus.py) and flags each stop with match quality.
  5. Writes pages/transport-citybus/data/lines.geojson and stops.geojson in the same schema
     the atlas page reads, with position_quality = "osm".

Lines that are not in OSM keep their approximate data, so you can improve the map one line at a time.
You can also skip OSM and digitise lines/stops yourself in QGIS: export as GeoJSON (EPSG:4326) with the
same property names (line, color, headway_min, loop / line, seq, name_en, name_km).

Run on your own computer (needs internet):
  pip install requests
  python3 tools/build_citybus_osm.py            # writes data, keeps a backup of the old files
  python3 tools/build_citybus_osm.py --dry-run  # report what OSM has, write nothing
"""
import argparse, difflib, json, os, shutil, sys, time

try:
    import requests
except ImportError:
    sys.exit("Install requests first:  pip install requests")

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_approx_citybus as approx  # brochure stop lists, colours, headways

DATA = os.path.join(HERE, "..", "pages", "transport-citybus", "data")
OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = (11.40, 104.70, 11.80, 105.10)  # south, west, north, east
PREFERRED_RELATION = {}  # e.g. {"1A": 1234567} to force a specific OSM relation id for a line

QUERY = f"""
[out:json][timeout:120];
relation["route"="bus"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
(._; >;);
out body;
"""

def fetch():
    for attempt in range(3):
        r = requests.post(OVERPASS, data={"data": QUERY}, timeout=180)
        if r.ok:
            return r.json()
        print(f"Overpass returned {r.status_code}, retrying…"); time.sleep(10)
    r.raise_for_status()

def norm_ref(ref):
    return (ref or "").upper().replace("LINE", "").replace(" ", "").strip()

def join_ways(way_ids, ways, nodes):
    """Chain member ways into one coordinate list, flipping ways as needed."""
    chain = []
    for wid in way_ids:
        w = ways.get(wid)
        if not w:
            continue
        seg = [nodes[n] for n in w["nodes"] if n in nodes]
        if not seg:
            continue
        if not chain:
            chain = seg[:]
            continue
        # orient the new segment (and the first one, if needed) so the ends meet
        candidates = [(chain[-1], seg[0], False, False), (chain[-1], seg[-1], False, True),
                      (chain[0], seg[0], True, False), (chain[0], seg[-1], True, True)]
        best = min(candidates, key=lambda c: approx.hav(c[0], c[1]))
        if best[2]:
            chain.reverse()
        if best[3]:
            seg = seg[::-1]
        chain.extend(seg[1:] if approx.hav(chain[-1], seg[0]) < 0.01 else seg)
    return chain

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    osm = fetch()
    nodes, ways, rels = {}, {}, []
    for el in osm["elements"]:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lon"], el["lat"], el.get("tags", {}))
        elif el["type"] == "way":
            ways[el["id"]] = el
        elif el["type"] == "relation":
            rels.append(el)
    coords = {k: (v[0], v[1]) for k, v in nodes.items()}

    wanted = {L["id"]: L for L in approx.LINES}
    by_line = {}
    for r in rels:
        ref = norm_ref(r.get("tags", {}).get("ref"))
        if ref in wanted:
            by_line.setdefault(ref, []).append(r)

    print("OSM bus relations matching City Bus lines:")
    for lid in wanted:
        found = by_line.get(lid, [])
        print(f"  {lid:>3}: {len(found)} relation(s) {[r['id'] for r in found]}")
    if args.dry_run:
        return

    old_lines = json.load(open(os.path.join(DATA, "lines.geojson"), encoding="utf-8"))
    old_stops = json.load(open(os.path.join(DATA, "stops.geojson"), encoding="utf-8"))
    lines_out = {f["properties"]["line"]: f for f in old_lines["features"]}
    stops_out = {}
    for f in old_stops["features"]:
        stops_out.setdefault(f["properties"]["line"], []).append(f)

    for lid, L in wanted.items():
        cands = by_line.get(lid)
        if not cands:
            continue
        rel = next((r for r in cands if r["id"] == PREFERRED_RELATION.get(lid)), cands[0])
        way_ids = [m["ref"] for m in rel["members"] if m["type"] == "way" and m.get("role", "") in ("", "forward", "backward")]
        geom = join_ways(way_ids, ways, coords)
        stop_members = [m["ref"] for m in rel["members"] if m["type"] == "node" and m.get("role", "").startswith(("stop", "platform"))]
        # keep one node per physical stop (platform + stop_position pairs are often both listed)
        stop_nodes = []
        for n in stop_members:
            if n in nodes and not any(approx.hav(coords[n], coords[m]) < 0.03 for m in stop_nodes):
                stop_nodes.append(n)
        if len(geom) < 2 or len(stop_nodes) < 2:
            print(f"  {lid}: relation {rel['id']} is incomplete, keeping approximate data"); continue

        brochure = [s.strip() for s in approx.STOPS[lid].split("|")]
        cd = approx.cumdist(geom)
        lines_out[lid] = {"type": "Feature", "properties": {
            "line": lid, "color": L["color"], "from_en": L["from_en"], "to_en": L["to_en"], "via": L["via"],
            "headway_min": list(L["headway"]), "loop": bool(L.get("loop")), "length_km": round(cd[-1], 2),
            "n_stops": len(stop_nodes), "geometry_quality": "osm", "osm_relation": rel["id"]},
            "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in geom]}}
        feats = []
        for i, n in enumerate(stop_nodes):
            tags = nodes[n][2]
            osm_name = tags.get("name:en") or tags.get("name") or ""
            match = difflib.get_close_matches(osm_name, brochure, n=1, cutoff=0.6) if osm_name else []
            name_en = match[0] if match else (osm_name or (brochure[i] if i < len(brochure) else f"Stop {i+1}"))
            feats.append({"type": "Feature", "properties": {
                "id": f"{lid}-{i+1:02d}", "line": lid, "seq": i + 1, "name_en": name_en,
                "name_km": tags.get("name:km", ""), "osm_node": n,
                "position_quality": "osm", "name_match": "brochure" if match else ("osm" if osm_name else "guessed")},
                "geometry": {"type": "Point", "coordinates": [round(coords[n][0], 6), round(coords[n][1], 6)]}})
        stops_out[lid] = feats
        print(f"  {lid}: {len(geom)} vertices, {len(feats)} stops from OSM relation {rel['id']}")

    for name in ("lines", "stops"):
        p = os.path.join(DATA, f"{name}.geojson")
        shutil.copy(p, p + ".bak")
    with open(os.path.join(DATA, "lines.geojson"), "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": list(lines_out.values())}, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(DATA, "stops.geojson"), "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": [s for v in stops_out.values() for s in v]}, f, ensure_ascii=False, separators=(",", ":"))
    print("Done. Previous files saved as *.geojson.bak")

if __name__ == "__main__":
    main()
