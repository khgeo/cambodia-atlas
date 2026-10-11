# Interactive Cambodia Atlas · អាត្លាសអន្តរកម្មកម្ពុជា

A bilingual, no-build-step geospatial atlas for Cambodia. Each atlas plate combines an interactive map, a short reading in Khmer and English, data-source notes, and optional analysis or simulation controls.

**Design direction:** Explore · Analyze · Simulate. The atlas is built for cartography, GIS, remote sensing, geography education and transparent scenario exploration.

## Run locally

Serve the repository root with a static HTTP server. Opening `index.html` directly as a `file://` URL does not work because browser modules, JSON fetches and PMTiles range requests require HTTP.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

For PMTiles, use a server that supports HTTP Range requests. GitHub Pages supports the range requests needed by the administrative-boundary archive.

## Publish on GitHub Pages

1. Commit and push the repository to the `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. The site should publish at `https://khgeo.github.io/cambodia-atlas/`.
5. After changing code or styles, run `python3 tools/bump_version.py`, commit, and push.

## Live plates

| Plate | Module | Notes |
|---|---|---|
| 1.2 | Administrative units | 2024 boundaries, searchable village points and 2014 ↔ 2024 swipe comparison |
| 4.1 | Phnom Penh City Bus | Animated bus movement; stop positions and timetable values include documented approximations |
| 5.1 | Population & heavier-rainfall scenarios | Satellite imagery, 2020 population overlay when tiles are installed, and a teaching-level runoff calculator |

Plates 1.1, 2.1, 2.2, 3.1 and 4.2 remain planned and are listed in `pages/catalog.json`.

## Administrative data and the recovered 2014 file

The administrative-unit plate uses:

- `pages/admin-units/data/admin.pmtiles` — 2024 administrative boundaries and village points.
- `pages/admin-units/data/admin2014.pmtiles` — 2014 district and commune boundaries used by the swipe comparison.
- `pages/admin-units/data/index.json` — names, codes, parent units, areas and counts for search and ranking.
- `pages/admin-units/data/villages.json` — bilingual village search index.

The 2014 PMTiles file is included in this project archive. The admin page metadata references it as `tiles2014`, and the compare control uses the `adm14` vector source. The comparison source is Open Development Cambodia via geoBoundaries (CC BY 4.0); consult the original metadata and source terms before redistribution or derivative publication.

Rebuild scripts:

```bash
python3 tools/build_admin_2014.py <source-folder> <path-to-tippecanoe>
python3 tools/build_admin_2024.py <folder-with-PB_2024-DB_2024-CB_2024-VC_2024> <path-to-tippecanoe>
```

The rebuild scripts require their documented source files and tools; they are not required just to display the bundled PMTiles files.

## Plate 5.1 — population and rainfall scenario

The panel separates three types of information:

- **Baseline estimate:** WorldPop gridded population estimates for reference year 2020. Values are modelled estimates, not direct counts in every cell.
- **Derived result:** the runoff depth calculated from user-selected inputs with the SCS Curve Number equation.
- **Hypothetical scenario:** the rainfall total and duration chosen by the user. It is not an observed storm or forecast.

The population raster tiles are **not bundled**. This avoids redistributing an external dataset without checking its product metadata and license. Follow `pages/population-rainfall/data/README.md` to download, inspect, style and tile the selected WorldPop product. Until the tile pyramid exists, the population overlay remains disabled and the panel displays a notice.

The current runoff calculator uses a generic Curve Number as a teaching assumption. It is **not calibrated to a Cambodian catchment** and does not calculate flood extent, water depth, velocity, flood probability, or exposed-population counts. Do not use it for emergency warnings or operational planning. A later flood module should use spatially varying rainfall, suitable terrain conditioning, soil/land-cover parameters, drainage and river boundary conditions, independent validation, and explicit uncertainty.

## Architecture

- Plain HTML, CSS and JavaScript; no bundler or build step.
- MapLibre GL JS and PMTiles are vendored under `shared/vendor/` with their license files.
- `shared/atlas.js` provides bilingual labels, page loading, basemap setup, PMTiles helpers and cache versioning.
- `pages/catalog.json` controls the plate index and the live/planned state.
- Each `pages/<plate-id>/` folder contains its metadata, reading fragments and page module.

## Credits

MapLibre GL JS (BSD-3), PMTiles (BSD-3), maplibre-gl-swipe (MIT), OpenFreeMap/OpenMapTiles and OpenStreetMap contributors. Satellite imagery is supplied by Esri and its imagery partners when that optional basemap is enabled. Data providers and licensing are listed in the relevant plate metadata and documentation.

Compiled by YAM Sarath (personal project).
