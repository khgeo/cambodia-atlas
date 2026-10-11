# Population raster setup — Plate 5.1

The plate intentionally does not ship with a population raster or display synthetic population values. Obtain a Cambodia 2020 population-count GeoTIFF from WorldPop and review the exact product metadata, license, grid, and units.

To enable the map overlay, create a web tile pyramid under this folder:

```text
data/population/{z}/{x}/{y}.png
```

One practical workflow is to use GDAL to reproject the raster to Web Mercator, style it with a documented color ramp, and generate PNG tiles with `gdal2tiles.py`. The plate checks for `data/population/0/0/0.png`; if the tiles are absent, it disables the overlay and displays an explanatory notice.

Recommended workflow:

1. Download the Cambodia 2020 population-count raster from https://hub.worldpop.org/.
2. Inspect CRS, NoData, pixel values, resolution, and units with `gdalinfo`.
3. Reproject to EPSG:3857 using nearest-neighbour resampling for count data; document any aggregation/resampling decision.
4. Apply a transparent, sequential colour ramp that distinguishes zero/no-data from positive counts.
5. Generate PNG tiles and verify them against the source raster in QGIS.
6. Keep source citation, product ID, version, license, processing commands, and checksum with the data release.

The rainfall panel is a simplified SCS Curve Number teaching calculator. It is not a calibrated flood model and should not be used for operational warnings or to estimate exposed population.
