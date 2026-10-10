# Interactive Cambodia Atlas · អាត្លាសអន្តរកម្មកម្ពុជា

A collection of interactive maps ("plates") of Cambodia for the Cartography, GIS, Remote Sensing and Applied GIS & RS textbook series. Each plate has a live map, a short reading in Khmer and English, and links to the matching book chapter.

Plain HTML + JavaScript, no build step. It runs on GitHub Pages.

- `index.html`: cover and plate index (read from `pages/catalog.json`)
- `page.html#<plate-id>`: one plate, with the reading beside the map
- `explorer.html`: every plate's layers together on one map

## Publish on GitHub Pages

1. Create a repository, for example `khgeo/cambodia-atlas`, and push this folder to it.
2. Open the repository **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. After a minute the atlas is at `https://khgeo.github.io/cambodia-atlas/`.

To test locally, serve the folder with a server that supports range requests (needed for `.pmtiles`). Opening `index.html` directly from disk does not work.

```bash
npx http-server -p 8000      # then open http://localhost:8000
```

## Plates

| Plate | Status | Folder |
|---|---|---|
| 1.2 Provinces, districts, communes and villages | live | `pages/admin-units/` |
| 4.1 Phnom Penh City Bus | live | `pages/transport-citybus/` |
| 1.1, 2.1, 2.2, 3.1, 4.2 | planned | listed in `pages/catalog.json` |

## Open in GeoLibre

Each plate can list data files under `"geolibre"` in its `page.json`. The plate then shows an **Open the data in GeoLibre** button, which opens those files in [GeoLibre](https://web.geolibre.app/) (free, MIT, browser-based GIS from opengeos) for analysis. The link uses GeoLibre's `data=` parameter. It works once the atlas is on GitHub Pages; GeoLibre cannot read files from a local test server.

## Add a new plate

1. Make a folder `pages/<plate-id>/` (lowercase letters, numbers and hyphens).
2. Add `page.json`. Copy the bus plate's file and change the title, plate number, centre/zoom and text files.
3. Add `text.en.html` and `text.km.html`. These are short HTML fragments (paragraphs only).
4. Add `page.js` that registers the plate:

```js
Atlas.register("<plate-id>", {
  async addLayers(map, ctx) {           // ctx.base = "pages/<plate-id>/", ctx.meta = page.json
    map.addSource("my-src", { type: "geojson", data: ctx.base + "data/my.geojson" });
    map.addLayer({ id: "my-layer", type: "fill", source: "my-src", paint: { "fill-color": "#3a7fc4" } });
    return ["my-layer"];                // layer ids, used by the Explorer
  },
  mountPanel(el, map, ctx) { /* optional controls under the reading */ },
});
```

5. Register the layers that belong in the legend. The atlas reads each layer's live colour rules and draws the legend itself: `step` becomes classes, `match` becomes categories, `interpolate` becomes a colour ramp, and a plain colour becomes one entry. It updates automatically when the plate changes a colour with `setPaintProperty`.

```js
Atlas.legend(map, "my-layer", {
  title: { en: "Population density", km: "ដង់ស៊ីតេប្រជាជន" },  // or a function, for titles that change
  unit: "people/km²",
  labels: { "1A": { en: "Line 1A", km: "ខ្សែ 1A" } },        // optional names for match categories
  visible: () => true,                                          // optional; default follows layer visibility
  order: 1,
});
```

6. In `pages/catalog.json`, set the plate's `status` to `"live"`.
7. Run `python3 tools/bump_version.py` before uploading, so browsers fetch the new files instead of cached ones.

Large rasters (land cover, flood extents) should be stored as PMTiles or Cloud-Optimized GeoTIFF rather than GeoJSON. Both can be served straight from GitHub Pages or a release asset.

## The admin units plate: data

- **Source:** the 2024 administrative dataset (PB/DB/CB/VC shapefiles, WGS 84 / UTM 48N): 25 provinces, 209 districts, 1,653 communes (plus 49 island parts) and 14,578 village points, with Khmer and English names.
- **Format:** served at full detail as vector tiles in one file, `pages/admin-units/data/admin.pmtiles` (14 MB; GitHub Pages supports the HTTP range requests PMTiles needs). `index.json` holds names, codes, parents, areas and counts for search and the ranked table. `villages.json` is loaded only when someone searches.
- **Areas:** computed in UTM 48N, without the Tonle Sap lake.
- **Population:** province totals from the Cambodia Inter-censal Population Survey 2024 (NIS), as tabulated on Wikipedia's *Provinces of Cambodia*. Check them against the NIS report before you cite them.
- **2014 ↔ 2024 swipe:** `admin2014.pmtiles` holds the 2014 districts and communes from Open Development Cambodia (via geoBoundaries, CC BY 4.0), with provinces made by merging districts. Rebuild it with `python3 tools/build_admin_2014.py <folder> path/to/tippecanoe`.
- **Rebuild:** `python3 tools/build_admin_2024.py <folder with PB_2024/ DB_2024/ CB_2024/ VC_2024/> path/to/tippecanoe`. This needs Node.js for mapshaper and [tippecanoe](https://github.com/felt/tippecanoe).

## The City Bus plate: data and what is estimated

**Taken from the 2020 City Bus brochure** (Phnom Penh Capital Hall / JICA):
- 17 line variants and the order and names of their 434 stops
- route colours and the roads each route uses
- operating hours: first bus 05:30, last arrival 20:30
- headways: every 10–15 min (1A, 2, 3, 4B), 15–20 min (5B, 6, 9) and 20–30 min (others)

**Routed on real roads:**
- Each line follows the MPWT 2014 road network (`Kh_All_Roads_MPWT2014`) through anchor points on the roads named in the brochure. The cheapest path between anchors prefers national, provincial and city roads over tracks.
- Line 6's return along Win Win Blvd is newer than the 2014 roads, so that part is a straight segment. It is listed in the line's `gaps` field.
- To re-route after moving anchors in `tools/route_citybus_on_roads.py`, run `python3 tools/route_citybus_on_roads.py pp_roads.geojson`. The script header shows how to make `pp_roads.geojson`.

**Still approximate:**
- Stops are in brochure order but spaced evenly along each route. Every stop is tagged `position_quality: "approximate"`.

**Estimated:**
- Times at each stop = distance along the line ÷ average speed (default 16 km/h), plus a stop of 20 s at each bus stop.
- Buses leave both terminals at the midpoint of the headway range.

Both assumptions can be changed in the page.

### Improve the bus data

- **From OpenStreetMap:** `python3 tools/build_citybus_osm.py --dry-run` shows which lines OSM has. Run it without `--dry-run` to replace those lines with OSM geometry and stops. It keeps a `.bak` copy of the old files.
- **From Open Development Cambodia:** the *Public transportation* dataset and the *Maps of 13 Phnom Penh city bus routes* (874 stops, 2018) can be loaded in QGIS, matched to the stop names, and exported to `data/stops.geojson` with the same fields.
- **Real timetables:** if City Bus GPS logs or a GTFS feed become available, convert them to the same per-line schedule. Then the "Estimated" label can come off.
- To regenerate the approximate data: `python3 tools/make_approx_citybus.py`.

## Credits

MapLibre GL JS 6 (BSD-3), PMTiles 4 (BSD-3) and maplibre-gl-swipe (MIT, opengeos), vendored in `shared/vendor/`. Rebuild them with `bash tools/vendor/build.sh`. MapLibre 6 ships only as ES modules, so the pages load `shared/vendor/libs.mjs` as a module, and it sets the `maplibregl`, `pmtiles` and `MaplibreSwipe` globals the plates use. Online base map from OpenFreeMap / OpenMapTiles, © OpenStreetMap contributors. If the base map cannot be reached, the atlas falls back to a plain background with the main rivers. Fonts: Kantumruy Pro, Moul, Barlow Condensed (Google Fonts).

Compiled by YAM Sarath (personal project).
