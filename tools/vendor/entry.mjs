// Bundled into shared/vendor/libs.mjs by tools/vendor/build.sh.
// Exposes the libraries as globals so the atlas pages stay plain scripts with no build step.
import * as maplibregl from "maplibre-gl";
import { Protocol, PMTiles } from "pmtiles";
import { SwipeControl } from "maplibre-gl-swipe";
window.maplibregl = maplibregl;
window.pmtiles = { Protocol, PMTiles };
window.MaplibreSwipe = { SwipeControl };
