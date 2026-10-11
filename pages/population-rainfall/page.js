/* Plate 5.1 — 2020 population context + explicitly hypothetical rainfall/runoff calculator.
 * This first release does NOT claim to calculate flood extent or exposed population.
 */
(function () {
  const A = window.Atlas;
  const DATA_URL = "https://hub.worldpop.org/geodata/summary?id=30532";
  const SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const CN = { dry: 60, normal: 75, wet: 90 }; // teaching assumptions only; not Cambodia-calibrated

  A.register("population-rainfall", {
    async addLayers(map, ctx) {
      // Satellite imagery is a selectable background. Keep the existing vector basemap for labels.
      map.addSource("poprain-satellite-src", { type: "raster", tiles: [SAT_URL], tileSize: 256, attribution: "Imagery © Esri and its contributors" });
      const belowLabels = (map.getStyle().layers || []).find((layer) => layer.type !== "background")?.id;
      map.addLayer({ id: "poprain-satellite", type: "raster", source: "poprain-satellite-src", layout: { visibility: "visible" }, paint: { "raster-opacity": 1 } }, belowLabels);

      // Population tiles are only activated after the owner downloads and processes the licensed source raster.
      // This avoids silently showing a missing layer or fabricated values in the published atlas.
      const available = Boolean(ctx.meta.data?.populationTilesAvailable);
      if (available) {
        map.addSource("poprain-population-src", { type: "raster", tiles: [ctx.base + ctx.meta.data.populationTiles], tileSize: 256, minzoom: 4, maxzoom: 12, attribution: "Population estimates © WorldPop (CC BY 4.0)" });
        const firstSymbol = (map.getStyle().layers || []).find((layer) => layer.type === "symbol")?.id;
        map.addLayer({ id: "poprain-population", type: "raster", source: "poprain-population-src", layout: { visibility: "visible" }, paint: { "raster-opacity": 0.72 } }, firstSymbol);
      }
      map.addSource("poprain-selected-point-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "poprain-selected-point", type: "circle", source: "poprain-selected-point-src", paint: { "circle-radius": 6, "circle-color": "#f59e0b", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      return ["poprain-satellite", ...(available ? ["poprain-population"] : []), "poprain-selected-point"];
    },

    async mountPanel(el, map, ctx) {
      const available = Boolean(ctx.meta.data?.populationTilesAvailable);
      const style = document.createElement("style");
      style.textContent = `
        .pr-section{border-top:1px solid var(--rule);padding-top:14px;display:grid;gap:10px}
        .pr-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}
        .pr-row label,.pr-field label{font-weight:600}
        .pr-field{display:grid;gap:5px;font-size:13px}
        .pr-field input[type=range]{width:100%;accent-color:var(--accent)}
        .pr-field select,.pr-field input[type=number]{width:100%;border:1px solid var(--rule);border-radius:5px;background:var(--paper);padding:8px}
        .pr-switch{display:flex;align-items:center;gap:8px;font-size:13px}
        .pr-switch input{accent-color:var(--accent)}
        .pr-btn{border:0;border-radius:5px;padding:10px 12px;background:var(--ink);color:var(--paper);font-weight:600;cursor:pointer}
        .pr-btn.secondary{background:var(--surface);border:1px solid var(--rule);color:var(--ink)}
        .pr-badge{display:inline-block;border-radius:4px;padding:3px 6px;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
        .pr-observed{background:#dcefe6;color:#145c43}.pr-derived{background:#e4eafe;color:#2948a0}.pr-hypo{background:#fff0d2;color:#8b4d00}
        .pr-card{border:1px solid var(--rule);border-radius:7px;padding:11px;display:grid;gap:7px}
        .pr-metric{font:600 25px/1 var(--f-data);letter-spacing:-.03em}
        .pr-small{font-size:12px;line-height:1.45;color:var(--muted)}
        .pr-legend{display:flex;gap:8px;flex-wrap:wrap}
      `;
      el.appendChild(style);
      el.innerHTML += `
        <section class="pr-section">
          <h2>View and layers</h2>
          <label class="pr-switch"><input id="pr-satellite" type="checkbox" checked> Satellite imagery</label>
          <label class="pr-switch"><input id="pr-population" type="checkbox" ${available ? "checked" : "disabled"}> 2020 population estimates</label>
          ${available ? "" : `<div class="note">Population layer is not installed yet. No population values are being fabricated. Download the WorldPop source and build the map tiles using the included tool.</div><a href="${DATA_URL}" target="_blank" rel="noopener">Open WorldPop 2020 dataset ↗</a>`}
          <div class="pr-small">The basemap imagery date can differ from the population reference year.</div>
        </section>
        <section class="pr-section">
          <h2>Heavier-rainfall scenario</h2>
          <span class="pr-badge pr-hypo">Hypothetical input</span>
          <div class="pr-field"><div class="pr-row"><label for="pr-rain">Storm total</label><strong id="pr-rain-label">150 mm</strong></div><input id="pr-rain" type="range" min="25" max="300" step="25" value="150"></div>
          <div class="pr-field"><label for="pr-duration">Storm duration</label><select id="pr-duration"><option value="3">3 hours</option><option value="6">6 hours</option><option value="24" selected>24 hours</option><option value="72">72 hours</option></select></div>
          <div class="pr-field"><label for="pr-soil">Initial soil condition (assumed)</label><select id="pr-soil"><option value="dry">Relatively dry</option><option value="normal">Normal</option><option value="wet" selected>Wet / saturated</option></select></div>
          <button class="pr-btn" id="pr-run">Calculate illustrative runoff</button>
          <div class="pr-small">This is a simplified SCS Curve Number teaching calculation with generic assumed parameters. It is not calibrated to a Cambodian catchment and does not map flood extent.</div>
        </section>
        <section class="pr-section">
          <h2>Scenario result</h2>
          <div class="pr-card" aria-live="polite">
            <span class="pr-badge pr-derived">Derived from assumptions</span>
            <div class="pr-row"><span>Mean rainfall intensity</span><strong id="pr-intensity">6.3 mm/h</strong></div>
            <div class="pr-row"><span>Assumed curve number</span><strong id="pr-cn">90</strong></div>
            <div><div class="pr-metric" id="pr-runoff">— mm</div><div class="pr-small">Illustrative direct-runoff depth</div></div>
            <div class="pr-small" id="pr-result-note">Select “Calculate” to update this estimate.</div>
          </div>
          <div class="pr-legend"><span class="pr-badge pr-observed">Observed / estimated input</span><span class="pr-badge pr-derived">Derived analysis</span><span class="pr-badge pr-hypo">Hypothetical scenario</span></div>
        </section>
        <section class="pr-section">
          <h2>Inspect a location</h2>
          <p class="pr-small">Click anywhere on the map to record coordinates for the scenario. The same uniform rainfall assumption applies at every location in this first prototype.</p>
          <div class="pr-card"><div class="pr-row"><span>Longitude</span><strong id="pr-lon">—</strong></div><div class="pr-row"><span>Latitude</span><strong id="pr-lat">—</strong></div><button class="pr-btn secondary" id="pr-copy" disabled>Copy scenario summary</button></div>
        </section>
        <section class="pr-section">
          <h2>Data status</h2>
          <div class="pr-small"><strong>Population:</strong> ${available ? "WorldPop 2020 raster tiles installed." : "Source identified; local raster tiles not yet installed."}</div>
          <div class="pr-small"><strong>Rainfall:</strong> user-defined hypothetical total, not an observed storm.</div>
          <div class="pr-small"><strong>Flood model:</strong> not connected. No flood extent, water depth, velocity, or exposed-population result is produced.</div>
        </section>`;

      const $ = (id) => el.querySelector(`#${id}`);
      const rain = $("pr-rain"), duration = $("pr-duration"), soil = $("pr-soil");
      const state = { lon: null, lat: null, runoff: null, intensity: null, cn: CN[soil.value] };
      function compute() {
        const P = Number(rain.value), hours = Number(duration.value), cn = CN[soil.value];
        const S = 25400 / cn - 254;
        const Ia = 0.2 * S;
        const Q = P > Ia ? ((P - Ia) ** 2) / (P + 0.8 * S) : 0;
        state.runoff = Q; state.intensity = P / hours; state.cn = cn;
        $("pr-rain-label").textContent = `${P} mm`;
        $("pr-intensity").textContent = `${(P / hours).toFixed(1)} mm/h`;
        $("pr-cn").textContent = String(cn);
        $("pr-runoff").textContent = `${Q.toFixed(1)} mm`;
        $("pr-result-note").textContent = `Assumes a uniform ${P} mm storm over ${hours} hours and generic curve number ${cn}. This is not spatially resolved or catchment-calibrated.`;
      }
      $("pr-satellite").addEventListener("change", (e) => map.setLayoutProperty("poprain-satellite", "visibility", e.target.checked ? "visible" : "none"));
      if (available) $("pr-population").addEventListener("change", (e) => map.setLayoutProperty("poprain-population", "visibility", e.target.checked ? "visible" : "none"));
      $("pr-run").addEventListener("click", compute);
      rain.addEventListener("input", () => { $("pr-rain-label").textContent = `${rain.value} mm`; });
      map.on("click", (e) => {
        state.lon = e.lngLat.lng; state.lat = e.lngLat.lat;
        $("pr-lon").textContent = state.lon.toFixed(5); $("pr-lat").textContent = state.lat.toFixed(5);
        map.getSource("poprain-selected-point-src").setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [state.lon, state.lat] } }] });
        $("pr-copy").disabled = false;
      });
      $("pr-copy").addEventListener("click", () => {
        if (state.lon == null) return;
        const summary = `Cambodia Atlas — hypothetical rainfall scenario\nCoordinates: ${state.lon.toFixed(5)}, ${state.lat.toFixed(5)}\nRainfall: ${rain.value} mm over ${duration.value} hours\nMean intensity: ${state.intensity.toFixed(1)} mm/h\nInitial soil condition: ${soil.options[soil.selectedIndex].text}\nAssumed curve number: ${state.cn}\nIllustrative runoff depth: ${state.runoff.toFixed(1)} mm\nStatus: hypothetical scenario; not a flood forecast; no flood extent calculated.`;
        navigator.clipboard?.writeText(summary).then(() => { $("pr-copy").textContent = "Copied"; }).catch(() => window.prompt("Copy scenario summary:", summary));
      });
      compute();
    }
  });
})();
