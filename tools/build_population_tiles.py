#!/usr/bin/env python3
"""Build transparent XYZ population raster tiles from the WorldPop Cambodia 2020 GeoTIFF.

Requires GDAL command-line utilities: gdalwarp, gdaldem, and gdal2tiles.py (or gdal2tiles).
Download the WorldPop Cambodia 2020 1 km aggregated GeoTIFF from:
https://hub.worldpop.org/geodata/summary?id=30532

Usage:
  python3 tools/build_population_tiles.py /path/to/khm_ppp_2020_1km_Aggregated.tif

Output:
  pages/population-rainfall/data/population-tiles/{z}/{x}/{y}.png

This script creates a visual tile layer; the original raster remains the authoritative analysis source.
"""
from pathlib import Path
import shutil, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "pages/population-rainfall/data"
TILES = OUT / "population-tiles"
WORK = OUT / "_population_build"
PALETTE = OUT / "population-colors.txt"

COLORS = """nv 0 0 0 0
0 0 0 0
1 255 245 204 180
10 255 214 102 190
50 255 153 51 205
100 240 91 53 220
250 190 40 55 230
500 130 20 70 235
1000 76 16 94 240
5000 35 5 55 245
"""

def run(args):
    print("+", " ".join(map(str, args)))
    subprocess.run(list(map(str, args)), check=True)

def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"Input raster not found: {src}")
    for tool in ("gdalwarp", "gdaldem"):
        if not shutil.which(tool):
            raise SystemExit(f"Required GDAL command not found: {tool}")
    tile_cmd = shutil.which("gdal2tiles.py") or shutil.which("gdal2tiles")
    if not tile_cmd:
        raise SystemExit("Required GDAL command not found: gdal2tiles.py (or gdal2tiles)")
    WORK.mkdir(parents=True, exist_ok=True)
    PALETTE.write_text(COLORS, encoding="utf-8")
    warped = WORK / "population_3857.tif"
    rgba = WORK / "population_rgba.tif"
    run(["gdalwarp", "-overwrite", "-t_srs", "EPSG:3857", "-r", "bilinear", "-dstalpha", "-multi", src, warped])
    run(["gdaldem", "color-relief", warped, PALETTE, rgba, "-alpha", "-nearest_color_entry"])
    if TILES.exists():
        shutil.rmtree(TILES)
    TILES.parent.mkdir(parents=True, exist_ok=True)
    run([tile_cmd, "--xyz", "--zoom=4-12", "--processes=2", "-w", "none", rgba, TILES])
    print("\nTiles created:", TILES)
    print("Next: set data.populationTilesAvailable=true in pages/population-rainfall/page.json")
    print("Then run: python3 tools/bump_version.py")

if __name__ == "__main__":
    main()
