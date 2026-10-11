# Population raster tiles

The original WorldPop raster is not bundled in this repository. Download the Cambodia 2020 1 km aggregated GeoTIFF from the [official WorldPop dataset page](https://hub.worldpop.org/geodata/summary?id=30532), then run:

```bash
python3 tools/build_population_tiles.py /path/to/khm_ppp_2020_1km_Aggregated.tif
```

The script requires GDAL command-line utilities (`gdalwarp`, `gdaldem`, `gdal2tiles.py` or `gdal2tiles`). It creates `population-tiles/{z}/{x}/{y}.png`.

After the tiles are generated, edit `pages/population-rainfall/page.json` and change `data.populationTilesAvailable` from `false` to `true`. Run `python3 tools/bump_version.py` before publishing.

The raster is a modelled estimate of people per grid cell at approximately 1 km resolution, not a direct census count in each cell. Include the WorldPop attribution and CC BY 4.0 licence when redistributing the data. The tiles are for display; retain the source GeoTIFF for quantitative analysis.
