/* Plate 5.1 — population baseline and explicitly hypothetical rainfall/runoff scenario. */
(function () {
  const A = window.Atlas;
  A.addStrings("en", {
    pr_baseline: "Baseline data", pr_scenario: "Hypothetical scenario", pr_obs: "Estimated population · reference year 2020",
    pr_rain: "Storm rainfall total", pr_duration: "Storm duration", pr_cn: "Curve Number (teaching assumption)",
    pr_run: "Estimate runoff", pr_q: "Estimated runoff depth", pr_s: "Potential retention storage", pr_reset: "Reset assumptions",
    pr_satellite: "Satellite imagery", pr_population: "2020 population layer", pr_notready: "Population tiles are not installed yet. Follow the data README to build tiles from the source raster.",
    pr_method: "Method and limitations", pr_method_note: "SCS-CN is a simplified rainfall-runoff estimate. Results depend on the assumed Curve Number and initial abstraction. This is not a flood model or forecast.",
    pr_click: "Click the map to inspect coordinates.", pr_mm: "mm", pr_hours: "hours", pr_intensity: "Mean rainfall rate", pr_disclaimer: "Scenario only — not an observed storm or forecast.", pr_sources: "Data sources and status"
  });
  A.addStrings("km", {
    pr_baseline: "ទិន្នន័យមូលដ្ឋាន", pr_scenario: "សេណារីយ៉ូសន្មត", pr_obs: "ចំនួនប្រជាជនប៉ាន់ស្មាន · ឆ្នាំយោង ២០២០",
    pr_rain: "បរិមាណភ្លៀងសរុប", pr_duration: "រយៈពេលភ្លៀង", pr_cn: "Curve Number (តម្លៃសន្មតសម្រាប់សិក្សា)",
    pr_run: "គណនាទឹកហូរ", pr_q: "ជម្រៅទឹកហូរប៉ាន់ស្មាន", pr_s: "សមត្ថភាពស្តុកទឹកដែលអាចមាន", pr_reset: "កំណត់តម្លៃឡើងវិញ",
    pr_satellite: "រូបភាពផ្កាយរណប", pr_population: "ស្រទាប់ប្រជាជនឆ្នាំ២០២០", pr_notready: "មិនទាន់បានដំឡើងផ្ទាំងទិន្នន័យប្រជាជនទេ។ សូមអនុវត្តតាមឯកសារ README ក្នុងថត data ដើម្បីបង្កើតផ្ទាំងពីរ៉ាស្ទ័រដើម។",
    pr_method: "វិធីសាស្ត្រ និងដែនកំណត់", pr_method_note: "SCS-CN គឺជាការប៉ាន់ស្មានទឹកហូរដ៏សាមញ្ញ។ លទ្ធផលអាស្រ័យលើ Curve Number និងការសន្មតទឹកជ្រាបដំបូង។ វាមិនមែនជាគំរូទឹកជំនន់ ឬការព្យាករណ៍ទេ។",
    pr_click: "ចុចលើផែនទីដើម្បីពិនិត្យកូអរដោនេ។", pr_mm: "មម", pr_hours: "ម៉ោង", pr_intensity: "អត្រាភ្លៀងមធ្យម", pr_disclaimer: "សម្រាប់សេណារីយ៉ូប៉ុណ្ណោះ — មិនមែនជាភ្លៀងដែលបានសង្កេត ឬការព្យាករណ៍ទេ។", pr_sources: "ប្រភពទិន្នន័យ និងស្ថានភាព"
  });

  const S = { map: null, satellite: false, population: false, tileChecked: false };
  const esc = A.esc;
  const fmt = (n, d = 1) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

  async function addLayers(map, ctx) {
    S.map = map;
    // Satellite imagery is an optional raster basemap, kept separate from analytical overlays.
    map.addSource("pr-satellite", { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Imagery © Esri and its suppliers" });
    map.addLayer({ id: "pr-satellite-layer", type: "raster", source: "pr-satellite", layout: { visibility: "visible" }, paint: { "raster-opacity": 1 } }, map.getStyle().layers.find(l => l.type === "symbol")?.id);
    // Population tiles are built locally from a licensed/downloaded source raster; do not invent a fallback layer.
    try {
      const response = await fetch(ctx.base + "data/population/0/0/0.png", { method: "HEAD" });
      if (response.ok) {
        map.addSource("pr-population", { type: "raster", tiles: [ctx.base + "data/population/{z}/{x}/{y}.png"], tileSize: 256, minzoom: 0, maxzoom: 12, attribution: "Population estimates: WorldPop; visualization by Cambodia Atlas" });
        const firstSymbol = map.getStyle().layers.find(l => l.type === "symbol")?.id;
        map.addLayer({ id: "pr-population-layer", type: "raster", source: "pr-population", layout: { visibility: "none" }, paint: { "raster-opacity": 0.78 } }, firstSymbol);
        S.population = true;
      }
    } catch (_) { /* missing tiles are reported in the control panel */ }
    map.on("click", (e) => {
      new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${esc(A.t("pr_click"))}</strong><br>${e.lngLat.lng.toFixed(5)}, ${e.lngLat.lat.toFixed(5)}`).addTo(map);
    });
    return ["pr-satellite-layer", ...(S.population ? ["pr-population-layer"] : [])];
  }

  function runoff(P, CN) {
    const Smm = 25400 / CN - 254;
    const Ia = 0.2 * Smm;
    const Q = P > Ia ? ((P - Ia) ** 2) / (P + 0.8 * Smm) : 0;
    return { Smm, Q };
  }

  async function mountPanel(el, map, ctx) {
    const km = A.lang === "km";
    el.innerHTML = `
      <div class="pr-status"><span class="pr-dot"></span><div><strong>${A.t("pr_baseline")}</strong><small>${A.t("pr_obs")}</small></div></div>
      <section class="pr-control-card">
        <div class="pr-section-head"><span class="pr-icon">◉</span><h3>${A.t("pr_baseline")}</h3></div>
        <label class="pr-switch"><span>${A.t("pr_satellite")}</span><input id="pr-satellite" type="checkbox" checked><span class="pr-switch-ui"></span></label>
        <label class="pr-switch"><span>${A.t("pr_population")}</span><input id="pr-pop" type="checkbox" ${S.population ? "" : "disabled"}><span class="pr-switch-ui"></span></label>
        <p class="pr-small" id="pr-pop-note">${S.population ? (km ? "WorldPop៖ ប៉ាន់ស្មានតាមក្រឡា" : "WorldPop gridded estimates; not direct cell counts.") : A.t("pr_notready")}</p>
      </section>
      <section class="pr-control-card pr-scenario-card">
        <div class="pr-section-head"><span class="pr-icon">⌁</span><h3>${A.t("pr_scenario")}</h3><span class="pr-pill">WHAT-IF</span></div>
        <p class="pr-small">${A.t("pr_disclaimer")}</p>
        <label class="pr-label" for="pr-rain">${A.t("pr_rain")} <output id="pr-rain-out">150 mm</output></label>
        <input class="pr-range" id="pr-rain" type="range" min="25" max="300" step="25" value="150">
        <div class="pr-range-ends"><span>25 mm</span><span>300 mm</span></div>
        <label class="pr-label" for="pr-duration">${A.t("pr_duration")}</label>
        <select id="pr-duration" class="pr-select"><option value="3">3 ${A.t("pr_hours")}</option><option value="6">6 ${A.t("pr_hours")}</option><option value="24" selected>24 ${A.t("pr_hours")}</option><option value="72">72 ${A.t("pr_hours")}</option></select>
        <label class="pr-label" for="pr-cn">${A.t("pr_cn")} <output id="pr-cn-out">75</output></label>
        <input class="pr-range" id="pr-cn" type="range" min="40" max="95" step="5" value="75">
        <div class="pr-range-ends"><span>40 · more infiltration</span><span>95 · more runoff</span></div>
        <div class="pr-results"><div><span>${A.t("pr_q")}</span><strong id="pr-q">— mm</strong></div><div><span>${A.t("pr_s")}</span><strong id="pr-s">— mm</strong></div></div>
        <div class="pr-intensity"><span>${A.t("pr_intensity")}</span><strong id="pr-intensity">6.3 mm/h</strong></div>
        <button id="pr-reset" type="button" class="chip-btn pr-reset">↺ ${A.t("pr_reset")}</button>
      </section>
      <section class="pr-note"><strong>${A.t("pr_method")}</strong><p>${A.t("pr_method_note")}</p></section>
      <p class="pr-small">${A.t("pr_sources")}: <a href="https://hub.worldpop.org/" target="_blank" rel="noopener">WorldPop</a> · <a href="https://www.chc.ucsb.edu/data/chirps" target="_blank" rel="noopener">CHIRPS</a> · <a href="https://dataspace.copernicus.eu/" target="_blank" rel="noopener">Copernicus DEM</a></p>`;

    const $ = (id) => el.querySelector("#" + id);
    const update = () => {
      const P = Number($("pr-rain").value), CN = Number($("pr-cn").value), dur = Number($("pr-duration").value);
      const r = runoff(P, CN);
      $("pr-rain-out").textContent = `${P} mm`; $("pr-cn-out").textContent = CN;
      $("pr-q").textContent = `${fmt(r.Q)} mm`; $("pr-s").textContent = `${fmt(r.Smm)} mm`;
      $("pr-intensity").textContent = `${fmt(P / dur)} mm/h`;
    };
    $("pr-satellite").checked = true;
    $("pr-satellite").addEventListener("change", (e) => map.setLayoutProperty("pr-satellite-layer", "visibility", e.target.checked ? "visible" : "none"));
    if (S.population) $("pr-pop").addEventListener("change", (e) => map.setLayoutProperty("pr-population-layer", "visibility", e.target.checked ? "visible" : "none"));
    ["pr-rain", "pr-cn", "pr-duration"].forEach(id => $(id).addEventListener("input", update));
    $("pr-reset").addEventListener("click", () => { $("pr-rain").value = 150; $("pr-duration").value = 24; $("pr-cn").value = 75; update(); });
    update();
  }

  A.register("population-rainfall", { addLayers, mountPanel });
})();
