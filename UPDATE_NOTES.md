# Update notes — Cambodia Atlas interface and data recovery

## Included

- Preserved the existing 2024 administrative PMTiles and recovered/preserved `pages/admin-units/data/admin2014.pmtiles` from the supplied archive.
- Confirmed the administrative-unit metadata points to `data/admin2014.pmtiles`; the existing 2014 ↔ 2024 swipe control remains in `pages/admin-units/page.js`.
- Refreshed the atlas index with a dark geospatial hero, modern teal accent system, searchable plate library, status filters, responsive cards, and clearer Explore / Analyze / Simulate framing.
- Added Plate 5.1, `population-rainfall`, with satellite imagery, an optional 2020 population raster overlay, explicit data-status labels, and a simplified SCS-CN runoff calculator.
- Added population raster build instructions and `tools/build_population_tiles.py` for a user-supplied WorldPop GeoTIFF.
- Added `tools/bump_version.py` to update cache-busting tokens for GitHub Pages.
- Updated README and bilingual plate text to distinguish estimated population, derived runoff, and hypothetical rainfall assumptions.

## Important limitations

- WorldPop raster tiles are not included; the user must download the selected source product, verify its license and metadata, then build tiles.
- The runoff calculator is an educational estimate with generic assumptions, not a calibrated flood simulation or forecast.
- The 2014 boundary archive is preserved in the ZIP, but a browser test against the live GitHub Pages deployment was not possible in this build environment.
- The update is packaged locally. It has not been pushed directly to GitHub.
