#!/usr/bin/env bash
# Rebuild shared/vendor/ from npm. Needs Node.js. Run from the repo root:  bash tools/vendor/build.sh
# MapLibre 6 ships only ES modules and loads its worker relative to its own file, so it is copied as-is
# and kept external; PMTiles and maplibre-gl-swipe are bundled into libs.mjs, which imports it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
cd "$TMP"
npm init -y >/dev/null
npm i --no-audit --no-fund --legacy-peer-deps maplibre-gl@6.13.0 pmtiles@4.4.1 maplibre-gl-swipe@0.14.0 esbuild@0.25.10 >/dev/null
OUT="$ROOT/shared/vendor"
rm -f "$OUT/maplibre-gl.js" "$OUT/pmtiles.js"
cp node_modules/maplibre-gl/dist/maplibre-gl.mjs node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs \
   node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs node_modules/maplibre-gl/dist/maplibre-gl.css "$OUT/"
cp node_modules/maplibre-gl/LICENSE.txt "$OUT/MAPLIBRE-LICENSE.txt"
cp node_modules/pmtiles/LICENSE "$OUT/PMTILES-LICENSE.txt" 2>/dev/null || true
cp node_modules/maplibre-gl-swipe/LICENSE "$OUT/SWIPE-LICENSE.txt" 2>/dev/null || true
cp node_modules/maplibre-gl-swipe/dist/maplibre-gl-swipe.css "$OUT/"
cp "$ROOT/tools/vendor/entry.mjs" "$TMP/entry.mjs"
npx esbuild "$TMP/entry.mjs" --bundle --format=esm --minify --external:maplibre-gl \
  --outfile="$TMP/libs.mjs" --log-level=warning
# point the external import at the copied file
sed -e 's#from"maplibre-gl"#from"./maplibre-gl.mjs"#g; s#from "maplibre-gl"#from "./maplibre-gl.mjs"#g' "$TMP/libs.mjs" > "$OUT/libs.mjs"
grep -q './maplibre-gl.mjs' "$OUT/libs.mjs"
echo "vendor files written to $OUT"
