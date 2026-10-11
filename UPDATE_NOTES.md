# Update notes — Cambodia Atlas

## Added plate 5.1
- New `pages/population-rainfall/` plate registered in the atlas catalog.
- Satellite imagery toggle (Esri World Imagery tiles) while retaining the vector basemap for context labels.
- 2020 population layer wiring for a local WorldPop raster tile set; disabled until tiles are generated so the site does not show invented population values.
- Click-to-inspect coordinates and copyable scenario summary.
- Hypothetical rainfall controls and a simplified SCS Curve Number runoff-depth calculator.
- English and Khmer explanatory text, source links, and data-status labels.
- GDAL helper at `tools/build_population_tiles.py` to make display tiles from the official WorldPop GeoTIFF.

## Important limitations
- The WorldPop source raster is not bundled. Download it from https://hub.worldpop.org/geodata/summary?id=30532 and follow `pages/population-rainfall/data/README.md`.
- The runoff calculator uses generic teaching assumptions and is not calibrated for a Cambodian catchment.
- No flood extent, water depth, velocity, flood probability, or population exposure is computed yet.
- The prototype is not an operational flood forecast or an emergency decision-support product.

## Publish
1. Unzip this updated repository copy.
2. To enable population display, build the population tiles and set `data.populationTilesAvailable` to `true` in `pages/population-rainfall/page.json`.
3. Run `python3 tools/bump_version.py` before publishing.
4. Push the repository contents to the existing GitHub repository and verify the GitHub Pages deployment.
