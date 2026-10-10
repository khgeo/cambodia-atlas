"""
Build the 2014 boundaries used by plate 1.2's 2014 ↔ 2024 swipe comparison.

Inputs (geoBoundaries, simplified GeoJSON, renamed into one folder):
  ADM1.geojson  geoBoundaries KHM ADM1 (OpenStreetMap, ODbL)       — only used to name provinces
  ADM2.geojson  geoBoundaries KHM ADM2 (Open Development Cambodia, 2014, CC BY 4.0) — districts
  ADM3.geojson  geoBoundaries KHM ADM3 (Open Development Cambodia, 2014, CC BY 4.0) — communes
Provinces are drawn by merging the 2014 districts, so the three levels nest exactly.

Output: pages/admin-units/data/admin2014.pmtiles  (layers: provinces, districts, communes)
Needs Node.js (npx mapshaper) and tippecanoe.
  python3 tools/build_admin_2014.py <folder> path/to/tippecanoe
"""
import json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "pages", "admin-units", "data")
SRC = sys.argv[1] if len(sys.argv) > 1 else "."
TIPPECANOE = sys.argv[2] if len(sys.argv) > 2 else "tippecanoe"
TMP = os.path.join(OUT, "_build2014")
ALIASES = {"Bantey Meanchey": "Banteay Meanchey", "Ratanakiri Province": "Ratanakiri"}

def ms(*args):
    subprocess.run(["npx", "--yes", "mapshaper@0.6.102", "-quiet", *args], check=True)

def main():
    os.makedirs(TMP, exist_ok=True)
    t = lambda n: os.path.join(TMP, n)
    ms("-i", os.path.join(SRC, "ADM2.geojson"), "-clean", "-each", "area_km2=Math.round(this.area/1e5)/10", "-o", t("d.geojson"))
    ms("-i", os.path.join(SRC, "ADM3.geojson"), "-clean", "-each", "area_km2=Math.round(this.area/1e5)/10", "-o", t("c.geojson"))
    ms("-i", t("d.geojson"), "-points", "inner", "-join", os.path.join(SRC, "ADM1.geojson"), "fields=shapeName", "prefix=p_", "-o", t("dp.geojson"))
    parent = {f["properties"]["shapeID"]: ALIASES.get(f["properties"].get("p_shapeName"), f["properties"].get("p_shapeName"))
              for f in json.load(open(t("dp.geojson")))["features"]}
    d = json.load(open(t("d.geojson")))
    for f in d["features"]:
        p = f["properties"]
        f["properties"] = {"name_en": p["shapeName"], "province": parent.get(p["shapeID"]) or "", "area_km2": p["area_km2"], "year": 2014}
    json.dump(d, open(t("districts.geojson"), "w"))
    ms("-i", t("districts.geojson"), "-dissolve", "province", "-each", "area_km2=Math.round(this.area/1e5)/10; name_en=province; year=2014",
       "-filter-fields", "name_en,area_km2,year", "-o", t("provinces.geojson"))
    c = json.load(open(t("c.geojson")))
    for f in c["features"]:
        p = f["properties"]; f["properties"] = {"name_en": p["shapeName"], "area_km2": p["area_km2"], "year": 2014}
    json.dump(c, open(t("communes.geojson"), "w"))
    out = os.path.join(OUT, "admin2014.pmtiles")
    L = lambda n: ["-L", json.dumps({"file": t(f"{n}.geojson"), "layer": n})]
    subprocess.run([TIPPECANOE, "-o", out, "-Z4", "-z12", "--no-feature-limit", "--no-tile-size-limit", "--detect-shared-borders",
                    "--quiet", "--force", "-n", "Cambodia administrative units 2014",
                    "-A", "Districts and communes 2014: Open Development Cambodia (CC BY 4.0) via geoBoundaries",
                    *L("provinces"), *L("districts"), *L("communes")], check=True)
    counts = {n: len(json.load(open(t(f"{n}.geojson")))["features"]) for n in ("provinces", "districts", "communes")}
    shutil.rmtree(TMP)
    print(counts, f"{os.path.getsize(out)/1e6:.1f} MB")

if __name__ == "__main__":
    main()
