#!/usr/bin/env python3
"""Build a transparent Web-Mercator PNG tile overlay from a WorldPop count GeoTIFF.

Requires GDAL command-line tools: gdalinfo, gdalwarp, gdaldem and gdal2tiles.py.
Output is written to pages/population-rainfall/data/population/{z}/{x}/{y}.png.
"""
from pathlib import Path
import argparse
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "pages" / "population-rainfall" / "data" / "population"
RAMP = ROOT / "tools" / "population-ramp.txt"
TOOLS = ("gdalinfo", "gdalwarp", "gdaldem")

def run(args):
    print("+", " ".join(map(str, args)))
    subprocess.run(list(map(str, args)), check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_tif", type=Path, help="WorldPop population-count GeoTIFF")
    parser.add_argument("--max-zoom", type=int, default=12)
    parser.add_argument("--min-zoom", type=int, default=0)
    parser.add_argument("--keep-existing", action="store_true", help="Do not delete existing output tiles before building")
    args = parser.parse_args()
    src = args.input_tif.expanduser().resolve()
    if not src.is_file():
        parser.error(f"Input raster not found: {src}")
    if args.min_zoom < 0 or args.max_zoom < args.min_zoom or args.max_zoom > 18:
        parser.error("Zooms must satisfy 0 <= min-zoom <= max-zoom <= 18")
    missing = [x for x in TOOLS if not shutil.which(x)]
    tiles_cmd = shutil.which("gdal2tiles.py") or shutil.which("gdal2tiles")
    if missing or not tiles_cmd:
        parser.error("Missing GDAL tools: " + ", ".join(missing + ([] if tiles_cmd else ["gdal2tiles.py or gdal2tiles"])))
    print("Inspecting source raster metadata:")
    run(["gdalinfo", src])
    if not args.keep_existing and OUT.exists():
        shutil.rmtree(OUT)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="atlas-pop-") as td:
        td = Path(td)
        warped = td / "population_3857.tif"
        styled = td / "population_rgba.tif"
        # Nearest-neighbour preserves the count grid rather than smoothing people between cells.
        run(["gdalwarp", "-overwrite", "-t_srs", "EPSG:3857", "-r", "near", "-dstalpha", "-multi", "-co", "COMPRESS=DEFLATE", src, warped])
        run(["gdaldem", "color-relief", "-alpha", warped, RAMP, styled, "-co", "COMPRESS=DEFLATE"])
        run([tiles_cmd, "--xyz", "-z", f"{args.min_zoom}-{args.max_zoom}", "-w", "none", "--processes=2", styled, OUT])
    print(f"\nTiles created: {OUT}")
    print("Check the output against the source in QGIS and record the exact WorldPop product/version and license.")
    print("For GitHub Pages, confirm repository size and hosting limits before committing the tile pyramid.")

if __name__ == "__main__":
    main()
