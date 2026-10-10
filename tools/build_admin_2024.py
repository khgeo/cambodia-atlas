"""
Build plate 1.2 data from the 2024 administrative shapefiles (PB / DB / CB / VC, WGS 84 / UTM 48N).

  PB_2024  provinces (KHET_CODE; code 99 = Tonle Sap lake)
  DB_2024  districts (SROK_CODE)  — srok / krong / khan
  CB_2024  communes  (KHUM_CODE)  — khum / sangkat; class "កោះ" marks island parts
  VC_2024  villages, points (PHUM_CODE)

Outputs (pages/admin-units/data/):
  admin.pmtiles   vector tiles, layers: provinces, districts, communes, villages, lake — full detail at high zoom
  index.json      provinces/districts/communes: code, names, class, parents, area, counts, bbox (for search + table)
  villages.json   [code, name_en, name_km, lon, lat] (loaded only when someone searches)

Needs Node.js (npx mapshaper) and tippecanoe (https://github.com/felt/tippecanoe).
  python3 tools/build_admin_2024.py <folder with PB_2024/ DB_2024/ CB_2024/ VC_2024/> [path/to/tippecanoe]
"""
import json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "pages", "admin-units", "data")
SRC = sys.argv[1] if len(sys.argv) > 1 else "."
TIPPECANOE = sys.argv[2] if len(sys.argv) > 2 else "tippecanoe"
TMP = os.path.join(OUT, "_build")

# Population: Cambodia Inter-censal Population Survey 2024 (NIS), via Wikipedia "Provinces of Cambodia".
POP2024 = {"01": 898484, "02": 1132017, "03": 1062914, "04": 604895, "05": 924175, "06": 807254, "07": 682987,
           "08": 1352198, "09": 140962, "10": 441078, "11": 93657, "12": 2352851, "13": 249973, "14": 1277867,
           "15": 516072, "16": 235852, "17": 1099825, "18": 234702, "19": 176488, "20": 613159, "21": 1097243,
           "22": 267703, "23": 48772, "24": 79445, "25": 889970}
# English province names in the atlas' usual spelling (the source uses upper case and older forms)
PROV_EN = {"01": "Banteay Meanchey", "02": "Battambang", "03": "Kampong Cham", "04": "Kampong Chhnang", "05": "Kampong Speu",
           "06": "Kampong Thom", "07": "Kampot", "08": "Kandal", "09": "Koh Kong", "10": "Kratie", "11": "Mondulkiri",
           "12": "Phnom Penh", "13": "Preah Vihear", "14": "Prey Veng", "15": "Pursat", "16": "Ratanakiri", "17": "Siem Reap",
           "18": "Preah Sihanouk", "19": "Stung Treng", "20": "Svay Rieng", "21": "Takeo", "22": "Oddar Meanchey", "23": "Kep",
           "24": "Pailin", "25": "Tbong Khmum"}
# class labels (the source fields are truncated by the DBF width)
CLASS = {
    "province": {"ខេត្ត": ("Province", "ខេត្ត"), "រាជធាន": ("Capital", "រាជធានី")},
    "district": {"ស្រុក": ("District", "ស្រុក"), "ក្រុង": ("Municipality", "ក្រុង"), "ខណ្ឌ": ("Khan", "ខណ្ឌ")},
    "commune": {"ឃុំ": ("Commune", "ឃុំ"), "សង្កាត": ("Sangkat", "សង្កាត់"), "កោះ": ("Island", "កោះ")},
}

def ms(*args):
    subprocess.run(["npx", "--yes", "mapshaper@0.6.102", "-quiet", *args], check=True)

def load(name):
    return json.load(open(os.path.join(TMP, name), encoding="utf-8"))

def bbox(geom):
    xs, ys = [], []
    def walk(c):
        if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
        else:
            for x in c: walk(x)
    walk(geom["coordinates"])
    return [round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)]

def main():
    os.makedirs(TMP, exist_ok=True)
    shp = lambda n: os.path.join(SRC, f"{n}_2024", f"{n}_2024.shp")
    # Merge each unit's parts by code (islands, multipart records); area in km² from UTM 48N; then to WGS 84.
    ms("-i", shp("PB"), "encoding=utf8", "-dissolve", "KHET_CODE", "copy-fields=KHET_NAME_,KHET_CLA_1",
       "-each", "area_km2=Math.round(this.area/1e5)/10", "-proj", "wgs84", "-o", os.path.join(TMP, "pb.geojson"), "precision=0.000001")
    ms("-i", shp("DB"), "encoding=utf8", "-dissolve", "SROK_CODE", "copy-fields=KHET_CODE,SROK_NAME_,SROK_NAME1,SROK_CLASS",
       "-each", "area_km2=Math.round(this.area/1e5)/10", "-proj", "wgs84", "-o", os.path.join(TMP, "db.geojson"), "precision=0.000001")
    # put the main (non-island) record of a commune first so its name and class are the ones kept
    ms("-i", shp("CB"), "encoding=utf8", "-each", "isl = KHUM_CLASS == 'កោះ' ? 1 : 0", "-sort", "isl",
       "-dissolve", "KHUM_CODE", "copy-fields=KHET_CODE,SROK_CODE,KHUM_NAME_,KHUM_NAME1,KHUM_CLASS",
       "-each", "area_km2=Math.round(this.area/1e5)/10", "-proj", "wgs84", "-o", os.path.join(TMP, "cb.geojson"), "precision=0.000001")
    ms("-i", shp("VC"), "encoding=utf8", "-proj", "wgs84", "-o", os.path.join(TMP, "vc.geojson"), "precision=0.000001")

    # label points (inside each polygon) for province and district names
    for n in ("pb", "db"):
        ms("-i", os.path.join(TMP, f"{n}.geojson"), "-points", "inner", "-o", os.path.join(TMP, f"{n}_pts.geojson"), "precision=0.0001")
    label = {}
    for n, key in (("pb", "KHET_CODE"), ("db", "SROK_CODE")):
        for f in load(f"{n}_pts.geojson")["features"]:
            if f["geometry"]: label[(n, f["properties"][key])] = f["geometry"]["coordinates"]
    pb, db, cb, vc = load("pb.geojson"), load("db.geojson"), load("cb.geojson"), load("vc.geojson")
    villages_in = {}
    for f in vc["features"]:
        k = f["properties"]["KHUM_CODE"]; villages_in[k] = villages_in.get(k, 0) + 1

    lake = {"type": "FeatureCollection", "features": []}
    prov, dist, comm, index = {}, {}, {}, []
    for f in pb["features"]:
        p = f["properties"]; code = p["KHET_CODE"]
        if code == "99":
            f["properties"] = {"name_en": "Tonle Sap", "name_km": "ទន្លេសាប"}; lake["features"].append(f); continue
        en, km = CLASS["province"].get(p["KHET_CLA_1"], ("Province", "ខេត្ត"))
        pop = POP2024.get(code)
        f["properties"] = {"code": code, "name_en": PROV_EN[code], "name_km": p["KHET_NAME_"], "class_en": en, "class_km": km,
                           "area_km2": p["area_km2"], "pop2024": pop, "density": round(pop / p["area_km2"], 1) if pop else None}
        prov[code] = f
    for f in db["features"]:
        p = f["properties"]; code = p["SROK_CODE"]
        if not code or code.startswith("99") or p["KHET_CODE"] == "99":
            continue
        en, km = CLASS["district"].get(p["SROK_CLASS"], ("District", "ស្រុក"))
        f["properties"] = {"code": code, "prov": p["KHET_CODE"], "name_en": p["SROK_NAME_"], "name_km": p["SROK_NAME1"],
                           "class_en": en, "class_km": km, "area_km2": p["area_km2"]}
        dist[code] = f
    for f in cb["features"]:
        p = f["properties"]; code = p["KHUM_CODE"]
        if code == "99" or p["KHET_CODE"] == "99":
            continue
        en, km = CLASS["commune"].get(p["KHUM_CLASS"], ("Commune", "ឃុំ"))
        f["properties"] = {"code": code, "prov": p["KHET_CODE"], "dist": p["SROK_CODE"], "name_en": p["KHUM_NAME_"],
                           "name_km": p["KHUM_NAME1"], "class_en": en, "class_km": km, "area_km2": p["area_km2"],
                           "n_villages": villages_in.get(code, 0)}
        comm[code] = f
    # counts and parent names
    for c, f in dist.items():
        pr = f["properties"]
        pr["n_communes"] = sum(1 for x in comm.values() if x["properties"]["dist"] == c)
        pr["n_villages"] = sum(x["properties"]["n_villages"] for x in comm.values() if x["properties"]["dist"] == c)
        pr["prov_en"] = prov[pr["prov"]]["properties"]["name_en"]; pr["prov_km"] = prov[pr["prov"]]["properties"]["name_km"]
    for c, f in comm.items():
        pr = f["properties"]
        d = dist.get(pr["dist"]); pp = prov.get(pr["prov"])
        pr["dist_en"] = d["properties"]["name_en"] if d else ""; pr["dist_km"] = d["properties"]["name_km"] if d else ""
        pr["prov_en"] = pp["properties"]["name_en"] if pp else ""; pr["prov_km"] = pp["properties"]["name_km"] if pp else ""
    for c, f in prov.items():
        pr = f["properties"]
        pr["n_districts"] = sum(1 for x in dist.values() if x["properties"]["prov"] == c)
        pr["n_communes"] = sum(1 for x in comm.values() if x["properties"]["prov"] == c and x["properties"]["class_en"] != "Island")
        pr["n_villages"] = sum(x["properties"]["n_villages"] for x in comm.values() if x["properties"]["prov"] == c)

    for lvl, d in (("province", prov), ("district", dist), ("commune", comm)):
        for f in d.values():
            p = f["properties"]
            row = {"lvl": lvl, "bbox": bbox(f["geometry"]), **p}
            lp = label.get(({"province": "pb", "district": "db"}.get(lvl), p["code"]))
            if lp: row["label"] = lp
            index.append(row)

    vfc = {"type": "FeatureCollection", "features": []}
    vlist = []
    for f in vc["features"]:
        p = f["properties"]; x, y = f["geometry"]["coordinates"]
        vfc["features"].append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "code": p["PHUM_CODE"], "name_en": p["PHUM_NAME_"], "name_km": p["PHUM_NAME1"], "comm": p["KHUM_CODE"]}})
        vlist.append([p["PHUM_CODE"], p["PHUM_NAME_"], p["PHUM_NAME1"], round(x, 5), round(y, 5)])

    def dump(name, fc):
        with open(os.path.join(TMP, name), "w", encoding="utf-8") as fh:
            json.dump(fc, fh, ensure_ascii=False, separators=(",", ":"))
    fc = lambda d: {"type": "FeatureCollection", "features": list(d.values())}
    dump("provinces.geojson", fc(prov)); dump("districts.geojson", fc(dist)); dump("communes.geojson", fc(comm))
    dump("villages.geojson", vfc); dump("lake.geojson", lake)

    out = os.path.join(OUT, "admin.pmtiles")
    if os.path.exists(out): os.remove(out)
    L = lambda n, f, lo, hi: ["-L", json.dumps({"file": os.path.join(TMP, f), "layer": n, "minzoom": lo, "maxzoom": hi})]
    subprocess.run([TIPPECANOE, "-o", out, "-Z4", "-z13", "--no-feature-limit", "--no-tile-size-limit",
                    "--detect-shared-borders", "--simplification=4", "--quiet", "--force",
                    "-n", "Cambodia administrative units 2024", "-A", "Administrative boundaries 2024 (compiled by YAM Sarath)",
                    *L("provinces", "provinces.geojson", 4, 13), *L("districts", "districts.geojson", 4, 13),
                    *L("communes", "communes.geojson", 4, 13), *L("lake", "lake.geojson", 4, 13),
                    *L("villages", "villages.geojson", 9, 13)], check=True)

    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "villages.json"), "w", encoding="utf-8") as fh:
        json.dump(vlist, fh, ensure_ascii=False, separators=(",", ":"))
    shutil.rmtree(TMP)
    print(f"provinces {len(prov)}, districts {len(dist)}, communes {len(comm)}, villages {len(vlist)}; "
          f"area {sum(f['properties']['area_km2'] for f in prov.values()):,.0f} km²; "
          f"pmtiles {os.path.getsize(out)/1e6:.1f} MB")

if __name__ == "__main__":
    main()
