/* Plate 1.2 — Provinces, districts, communes and villages (2024 administrative data, vector tiles). */
(function () {
  const A = window.Atlas, t = A.t, esc = A.esc;
  A.addStrings("en", {
    adm_level: "Level", adm_province: "Provinces", adm_district: "Districts", adm_commune: "Communes",
    adm_colour: "Colour by", adm_density: "Population density", adm_pop: "Population (2024)", adm_area: "Area",
    adm_find: "Find a place", adm_find_ph: "Province, district, commune or village, in Khmer or English",
    adm_in: "in", adm_villages: "villages", adm_communes_l: "communes", adm_districts_l: "districts",
    adm_persons_km2: "people/km²", adm_people: "people", adm_km2: "km²", adm_table: "Provinces ranked",
    adm_click: "Click any unit or village on the map to see where it belongs.", adm_rank: "#", adm_value: "Value",
    adm_contains: "Contains", adm_code: "Code", adm_village: "Village", adm_noresult: "No match",
    adm_show_vill: "Show villages (zoom in past level 10)",
    adm_compare: "Compare with 2014", adm_compare_on: "Comparing 2014 ↔ 2024",
    adm_compare_note: "Drag the slider. Left: 2014 boundaries (Open Development Cambodia). Right: 2024. Both are coloured by area, so a unit that was split or merged shows up as a change in colour and shape.",
    adm_2014_counts: "2014: 197 districts, 1,633 communes. 2024: 209 districts, 1,653 communes.",
  });
  A.addStrings("km", {
    adm_level: "កម្រិត", adm_province: "ខេត្ត", adm_district: "ស្រុក", adm_commune: "ឃុំ",
    adm_colour: "ដាក់ពណ៌តាម", adm_density: "ដង់ស៊ីតេប្រជាជន", adm_pop: "ចំនួនប្រជាជន (២០២៤)", adm_area: "ផ្ទៃក្រឡា",
    adm_find: "ស្វែងរកទីកន្លែង", adm_find_ph: "ខេត្ត ស្រុក ឃុំ ឬភូមិ ជាភាសាខ្មែរ ឬអង់គ្លេស",
    adm_in: "ក្នុង", adm_villages: "ភូមិ", adm_communes_l: "ឃុំ/សង្កាត់", adm_districts_l: "ស្រុក/ក្រុង/ខណ្ឌ",
    adm_persons_km2: "នាក់/គ.ម²", adm_people: "នាក់", adm_km2: "គ.ម²", adm_table: "ចំណាត់ថ្នាក់ខេត្ត",
    adm_click: "ចុចលើអង្គភាព ឬភូមិណាមួយនៅលើផែនទី ដើម្បីមើលថាវាស្ថិតនៅក្នុងខេត្ត ឬស្រុកណា។", adm_rank: "#", adm_value: "តម្លៃ",
    adm_contains: "មាន", adm_code: "លេខកូដ", adm_village: "ភូមិ", adm_noresult: "រកមិនឃើញ",
    adm_show_vill: "បង្ហាញភូមិ (ពង្រីកលើសកម្រិត ១០)",
    adm_compare: "ប្រៀបធៀបជាមួយឆ្នាំ២០១៤", adm_compare_on: "កំពុងប្រៀបធៀប ២០១៤ ↔ ២០២៤",
    adm_compare_note: "អូសរបាររំកិល។ ខាងឆ្វេង៖ ព្រំប្រទល់ឆ្នាំ២០១៤ (Open Development Cambodia)។ ខាងស្ដាំ៖ ឆ្នាំ២០២៤។ ទាំងពីរដាក់ពណ៌តាមផ្ទៃក្រឡា ដូច្នេះអង្គភាពដែលត្រូវបានបំបែក ឬបញ្ចូលគ្នា បង្ហាញជាការប្រែប្រួលពណ៌ និងរាង។",
    adm_2014_counts: "ឆ្នាំ២០១៤៖ ស្រុក/ក្រុង/ខណ្ឌ ១៩៧ ឃុំ/សង្កាត់ ១.៦៣៣។ ឆ្នាំ២០២៤៖ ស្រុក/ក្រុង/ខណ្ឌ ២០៩ ឃុំ/សង្កាត់ ១.៦៥៣។",
  });

  const LEVELS = ["province", "district", "commune"];
  const LAYER = { province: "provinces", district: "districts", commune: "communes" };
  const BREAKS = {
    province: { density: [25, 50, 100, 200, 400], pop2024: [150000, 300000, 600000, 900000, 1200000], area_km2: [1000, 3000, 6000, 9000, 12000] },
    district: { area_km2: [100, 250, 500, 1000, 2500] },
    commune: { area_km2: [10, 25, 50, 100, 250] },
  };
  const METRICS = { province: ["density", "pop2024", "area_km2"], district: ["area_km2"], commune: ["area_km2"] };
  const MLABEL = { density: "adm_density", pop2024: "adm_pop", area_km2: "adm_area" };
  const UNIT = { density: "adm_persons_km2", pop2024: "adm_people", area_km2: "adm_km2" };
  const RAMP_LIGHT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#104281"];
  const RAMP_DARK = ["#1b3557", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"];

  const S = { level: "province", metric: "density", index: [], byCode: {}, villages: null, selected: null, labels: { province: [], district: [] }, map: null };
  const nf = (n) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));
  const km = () => A.lang === "km";
  const nm = (p, pre = "name") => (km() && p[`${pre}_km`] ? p[`${pre}_km`] : p[`${pre}_en`]);
  const cls = (p) => (km() ? p.class_km : p.class_en);
  /** Name with its unit type: Khmer puts the type first ("ខេត្ត កណ្ដាល", "ភូមិ កណ្ដាល"); English shows the name only. */
  const fullName = (p, kmClass) => (km() && p.name_km ? `${kmClass || p.class_km || ""} ${p.name_km}`.trim() : p.name_en);
  const VILLAGE_KM = "ភូមិ";
  const isDark = () => {
    const th = document.documentElement.getAttribute("data-theme");
    return th ? th === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  };
  const ramp = () => (isDark() ? RAMP_DARK : RAMP_LIGHT);
  function fillExpr(level, metric) {
    const b = BREAKS[level][metric], r = ramp();
    return ["step", ["coalesce", ["get", metric], -1], A.cssVar("--map-bg"), 0, r[0], b[0], r[1], b[1], r[2], b[2], r[3], b[3], r[4], b[4], r[5]];
  }
  function classLabels(level, metric) {
    const b = BREAKS[level][metric];
    return [`< ${nf(b[0])}`, ...b.slice(0, -1).map((x, i) => `${nf(x)} – ${nf(b[i + 1])}`), `≥ ${nf(b[b.length - 1])}`];
  }

  async function addLayers(map, ctx) {
    S.map = map; S.ctx = ctx;
    S.index = await A.getJSON(ctx.base + ctx.meta.data.index);
    for (const r of S.index) S.byCode[`${r.lvl}:${r.code}`] = r;
    map.addSource("adm", { type: "vector", url: A.pmtilesUrl(ctx.base + ctx.meta.data.tiles),
      promoteId: { provinces: "code", districts: "code", communes: "code", villages: "code" },
      attribution: "Admin boundaries 2024" });
    const surface = A.cssVar("--surface") || "#fff", ink = A.cssVar("--ink") || "#14304a", accent = A.cssVar("--accent") || "#a96d17";
    const op = (on, off) => ["case", ["boolean", ["feature-state", "hover"], false], on, off];
    const ids = [];
    for (const lvl of ["commune", "district", "province"]) {
      const sl = LAYER[lvl], vis = lvl === "province" ? "visible" : "none";
      map.addLayer({ id: `adm-fill-${lvl}`, type: "fill", source: "adm", "source-layer": sl, layout: { visibility: vis },
        paint: { "fill-color": fillExpr(lvl, METRICS[lvl][0]), "fill-opacity": ctx.explorer ? op(0.45, 0.25) : op(0.95, 0.8) } });
      map.addLayer({ id: `adm-line-${lvl}`, type: "line", source: "adm", "source-layer": sl, layout: { visibility: vis, "line-join": "round" },
        paint: { "line-color": surface, "line-width": lvl === "commune" ? ["interpolate", ["linear"], ["zoom"], 6, 0.2, 12, 1] : ["interpolate", ["linear"], ["zoom"], 6, 0.6, 12, 1.6] } });
      ids.push(`adm-fill-${lvl}`, `adm-line-${lvl}`);
    }
    // 2014 boundaries for the swipe comparison (hidden until "Compare with 2014" is on)
    if (ctx.meta.data.tiles2014 && !ctx.explorer) {
      map.addSource("adm14", { type: "vector", url: A.pmtilesUrl(ctx.base + ctx.meta.data.tiles2014), attribution: "2014 boundaries: Open Development Cambodia" });
      for (const lvl of LEVELS) {
        map.addLayer({ id: `adm14-fill-${lvl}`, type: "fill", source: "adm14", "source-layer": LAYER[lvl], layout: { visibility: "none" },
          paint: { "fill-color": fillExpr(lvl, "area_km2"), "fill-opacity": 0.8 } });
        map.addLayer({ id: `adm14-line-${lvl}`, type: "line", source: "adm14", "source-layer": LAYER[lvl], layout: { visibility: "none", "line-join": "round" },
          paint: { "line-color": surface, "line-width": lvl === "commune" ? ["interpolate", ["linear"], ["zoom"], 6, 0.2, 12, 1] : ["interpolate", ["linear"], ["zoom"], 6, 0.6, 12, 1.6] } });
      }
    }
    map.addLayer({ id: "adm-lake", type: "fill", source: "adm", "source-layer": "lake", paint: { "fill-color": A.cssVar("--water") } });
    map.addLayer({ id: "adm-dist-outline", type: "line", source: "adm", "source-layer": "districts", minzoom: 7,
      layout: { visibility: "none", "line-join": "round" }, paint: { "line-color": ink, "line-width": 0.7, "line-opacity": 0.45 } });
    map.addLayer({ id: "adm-prov-outline", type: "line", source: "adm", "source-layer": "provinces", layout: { "line-join": "round" },
      paint: { "line-color": ink, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 11, 2], "line-opacity": 0.6 } });
    for (const lvl of LEVELS) {
      map.addLayer({ id: `adm-sel-${lvl}`, type: "line", source: "adm", "source-layer": LAYER[lvl], filter: ["==", ["get", "code"], "-"],
        layout: { "line-join": "round" }, paint: { "line-color": accent, "line-width": 3.5 } });
    }
    map.addLayer({ id: "adm-villages", type: "circle", source: "adm", "source-layer": "villages", minzoom: 9,
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 1.5, 14, 5], "circle-color": ink,
               "circle-stroke-color": surface, "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 14, 1.5],
               "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.75] } });
    ids.push("adm-lake", "adm-dist-outline", "adm-prov-outline", "adm-sel-province", "adm-sel-district", "adm-sel-commune", "adm-villages");

    // hover tooltip
    let hovered = null;
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "adm-tip" });
    const clearHover = () => { if (hovered) map.setFeatureState(hovered, { hover: false }); hovered = null; };
    const onMove = (layer, sl, html) => {
      map.on("mousemove", layer, (e) => {
        const f = e.features[0]; clearHover();
        hovered = { source: "adm", sourceLayer: sl, id: f.id }; map.setFeatureState(hovered, { hover: true });
        map.getCanvas().style.cursor = "pointer"; tip.setLngLat(e.lngLat).setHTML(html(f.properties)).addTo(map);
      });
      map.on("mouseleave", layer, () => { clearHover(); tip.remove(); map.getCanvas().style.cursor = ""; });
    };
    for (const lvl of LEVELS) {
      onMove(`adm-fill-${lvl}`, LAYER[lvl], (p) => {
        const m = S.level === lvl ? S.metric : "area_km2";
        return `<b>${esc(fullName(p))}</b>${km() ? "" : ` <span class="muted">${esc(cls(p))}</span>`}<br><span class="num">${nf(p[m])}</span> ${t(UNIT[m])}`;
      });
    }
    onMove("adm-villages", "villages", (p) => km() ? `<b>${esc(fullName(p, VILLAGE_KM))}</b>` : `<b>${esc(nm(p))}</b> <span class="muted">${t("adm_village")}</span>`);
    map.on("click", (e) => {
      const v = map.queryRenderedFeatures(e.point, { layers: ["adm-villages"] })[0];
      if (v) return selectVillage(v.properties, false);
      const f = map.queryRenderedFeatures(e.point, { layers: [`adm-fill-${S.level}`] })[0];
      if (f) select(S.level, f.properties.code, false);
    });

    // HTML labels (Khmer shapes correctly in HTML): provinces at z≥6.6, districts at z≥8.6
    for (const r of S.index) {
      if (!r.label || (r.lvl !== "province" && r.lvl !== "district")) continue;
      const m = A.htmlLabel(map, r.label, nm(r), "center");
      if (r.lvl === "district") m.getElement().classList.add("map-label-sm");
      S.labels[r.lvl].push(m);
    }
    const toggleLabels = () => {
      const z = map.getZoom();
      const showP = (S.level === "province" && z >= 6.6) || (S.level !== "province" && z >= 6.6 && z < 8.6);
      const showD = S.level !== "province" && z >= 8.6 && z < 11;
      S.labels.province.forEach((m) => (m.getElement().style.display = showP ? "" : "none"));
      S.labels.district.forEach((m) => (m.getElement().style.display = showD ? "" : "none"));
    };
    map.on("zoom", toggleLabels); S.toggleLabels = toggleLabels; toggleLabels();
    return ids;
  }

  // ---------- 2014 ↔ 2024 swipe (maplibre-gl-swipe) ----------
  function stopCompare() {
    if (S.swipe) { try { S.map.removeControl(S.swipe); } catch (e) {} S.swipe = null; }
    for (const l of LEVELS) for (const k of ["fill", "line"]) S.map.getLayer(`adm14-${k}-${l}`) && S.map.setLayoutProperty(`adm14-${k}-${l}`, "visibility", "none");
    document.querySelectorAll(".adm-year-tag").forEach((e) => e.remove());
    applyLevelVisibility();
  }
  /** The control does not restore what it hid, so the plate re-applies its own layer visibility. */
  function applyLevelVisibility() {
    const map = S.map, set = (id, v) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    for (const l of LEVELS) { set(`adm-fill-${l}`, l === S.level); set(`adm-line-${l}`, l === S.level); set(`adm-sel-${l}`, true); }
    set("adm-dist-outline", S.level === "commune");
    for (const id of ["adm-lake", "adm-prov-outline", "adm-villages"]) set(id, true);
    for (const [id, v] of Object.entries(S.baseVis || {})) map.getLayer(id) && map.setLayoutProperty(id, "visibility", v);
  }
  function startCompare() {
    const map = S.map, lvl = S.level;
    stopCompare();
    if (S.metric !== "area_km2") { S.metric = "area_km2"; map.setPaintProperty(`adm-fill-${lvl}`, "fill-color", fillExpr(lvl, S.metric)); renderControls(); }
    const base = map.getStyle().layers.map((l) => l.id).filter((id) => !id.startsWith("adm"));
    S.baseVis = Object.fromEntries(base.map((id) => [id, map.getLayoutProperty(id, "visibility") || "visible"]));
    const left = [...base, `adm14-fill-${lvl}`, `adm14-line-${lvl}`, "adm-lake"];
    const right = [...base, `adm-fill-${lvl}`, `adm-line-${lvl}`, "adm-lake", "adm-prov-outline", `adm-sel-${lvl}`,
                   ...(lvl === "commune" ? ["adm-dist-outline", "adm-villages"] : [])];
    S.swipe = new MaplibreSwipe.SwipeControl({ orientation: "vertical", position: 50, showPanel: false, leftLayers: left, rightLayers: right });
    map.addControl(S.swipe, "top-left");
    const wrap = map.getContainer().parentElement;
    for (const [side, year] of [["left", "2014"], ["right", "2024"]]) {
      const tag = document.createElement("div"); tag.className = `adm-year-tag ${side}`; tag.textContent = year; wrap.appendChild(tag);
    }
  }
  function setCompare(on) {
    S.compare = on;
    const b = document.getElementById("adm-compare"); if (b) b.setAttribute("aria-pressed", on);
    const n = document.getElementById("adm-compare-note"); if (n) n.hidden = !on;
    on ? startCompare() : stopCompare();
  }

  function setLevel(lvl) {
    const map = S.map; S.level = lvl;
    if (!METRICS[lvl].includes(S.metric)) S.metric = METRICS[lvl][0];
    for (const l of LEVELS) {
      const v = l === lvl ? "visible" : "none";
      map.setLayoutProperty(`adm-fill-${l}`, "visibility", v); map.setLayoutProperty(`adm-line-${l}`, "visibility", v);
    }
    map.setLayoutProperty("adm-dist-outline", "visibility", lvl === "commune" ? "visible" : "none");
    map.setPaintProperty(`adm-fill-${lvl}`, "fill-color", fillExpr(lvl, S.metric));
    S.toggleLabels(); renderControls();
    if (S.compare) startCompare();
  }

  function clearSel() { for (const l of LEVELS) S.map.setFilter(`adm-sel-${l}`, ["==", ["get", "code"], "-"]); }
  function select(lvl, code, fly) {
    const r = S.byCode[`${lvl}:${code}`]; if (!r) return;
    S.selected = { kind: "unit", r }; clearSel();
    S.map.setFilter(`adm-sel-${lvl}`, ["==", ["get", "code"], code]);
    if (fly) { const b = r.bbox; S.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, maxZoom: 12.5, duration: 900 }); }
    renderInfo();
  }
  function selectVillage(v, fly) {
    // v: {code,name_en,name_km,comm?,lon?,lat?}
    const commCode = v.comm || v.code.slice(0, 6);
    S.selected = { kind: "village", v, comm: S.byCode[`commune:${commCode}`] }; clearSel();
    S.map.setFilter("adm-sel-commune", ["==", ["get", "code"], commCode]);
    if (fly) S.map.flyTo({ center: [v.lon, v.lat], zoom: 13, duration: 900 });
    renderInfo();
  }

  function chain(r) {
    const parts = [];
    if (r.dist) { const d = S.byCode[`district:${r.dist}`]; parts.push(esc(d ? fullName(d) : (km() ? r.dist_km : r.dist_en))); }
    if (r.prov) { const p = S.byCode[`province:${r.prov}`]; parts.push(esc(p ? fullName(p) : (km() ? r.prov_km : r.prov_en))); }
    return parts.join(" · ");
  }
  function renderInfo() {
    const el = document.getElementById("adm-info"); if (!el) return;
    const sel = S.selected;
    if (!sel) { el.innerHTML = `<p class="muted" style="margin:0">${t("adm_click")}</p>`; return; }
    if (sel.kind === "village") {
      const v = sel.v, c = sel.comm;
      el.innerHTML = `<div class="eyebrow">${t("adm_village")}</div>
        <div class="adm-name">${esc(fullName(v, VILLAGE_KM))}${km() ? ` <span class="muted">${esc(v.name_en)}</span>` : ` <span class="muted">${esc(v.name_km || "")}</span>`}</div>
        ${c ? `<div class="adm-chain">${esc(fullName(c))} · ${chain(c)}</div>` : ""}
        <dl class="adm-dl"><dt>${t("adm_code")}</dt><dd class="num">${esc(v.code)}</dd></dl>`;
      return;
    }
    const r = sel.r, rows = [];
    if (r.pop2024 != null) rows.push([t("adm_pop"), nf(r.pop2024)]);
    if (r.density != null) rows.push([t("adm_density"), `${nf(r.density)} ${t("adm_persons_km2")}`]);
    rows.push([t("adm_area"), `${nf(r.area_km2)} ${t("adm_km2")}`]);
    const has = [];
    if (r.n_districts != null) has.push(`${r.n_districts} ${t("adm_districts_l")}`);
    if (r.n_communes != null) has.push(`${r.n_communes} ${t("adm_communes_l")}`);
    if (r.n_villages != null) has.push(`${nf(r.n_villages)} ${t("adm_villages")}`);
    if (has.length) rows.push([t("adm_contains"), has.join(", ")]);
    rows.push([t("adm_code"), esc(r.code)]);
    el.innerHTML = `<div class="eyebrow">${esc(cls(r))}</div>
      <div class="adm-name">${esc(fullName(r))} <span class="muted">${esc(km() ? r.name_en : r.name_km)}</span></div>
      ${r.lvl !== "province" ? `<div class="adm-chain">${chain(r)}</div>` : ""}
      <dl class="adm-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd class="num">${v}</dd>`).join("")}</dl>`;
  }

  function renderControls() {
    const lv = document.getElementById("adm-levels"); if (!lv) return;
    lv.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.level === S.level));
    document.getElementById("adm-metric").innerHTML =
      METRICS[S.level].map((m) => `<option value="${m}" ${m === S.metric ? "selected" : ""}>${t(MLABEL[m])}</option>`).join("");
    const r = ramp();
    document.getElementById("adm-legend").innerHTML =
      `<div class="muted adm-unit">${t(MLABEL[S.metric])} (${t(UNIT[S.metric])})</div>` +
      classLabels(S.level, S.metric).map((lab, i) => `<div class="adm-key"><span class="adm-sw" style="background:${r[i]}"></span><span class="num">${lab}</span></div>`).join("");
    const m = S.level === "province" ? S.metric : "density";
    const rows = S.index.filter((x) => x.lvl === "province").sort((a, b) => (b[m] ?? -1) - (a[m] ?? -1));
    const tb = document.getElementById("adm-table");
    tb.innerHTML = `<table><caption class="muted">${t(MLABEL[m])} (${t(UNIT[m])})</caption><thead><tr><th>${t("adm_rank")}</th><th>${t("adm_province")}</th><th class="r">${t("adm_value")}</th></tr></thead><tbody>` +
      rows.map((p, i) => `<tr data-code="${esc(p.code)}"><td class="num">${i + 1}</td><td>${esc(nm(p))}</td><td class="num r">${nf(p[m])}</td></tr>`).join("") + `</tbody></table>`;
    tb.querySelectorAll("tr[data-code]").forEach((tr) => (tr.onclick = () => { if (S.level !== "province") setLevel("province"); select("province", tr.dataset.code, true); }));
  }

  // ---------- search (units from index.json, villages loaded on first search) ----------
  // Khmer subscript ta (្ត) and da (្ដ) are often swapped in spelling (កណ្តាល / កណ្ដាល), so search treats them as one.
  const norm = (s) => (s || "").toLowerCase().normalize("NFC").replace(/\u17D2\u178F/g, "\u17D2\u178A").replace(/\s+/g, " ").trim();
  async function search(q) {
    q = norm(q); if (q.length < 2) return [];
    const out = [];
    const score = (n) => (n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 9);
    for (const r of S.index) {
      const s = Math.min(score(norm(r.name_en)), score(norm(r.name_km)));
      if (s < 9) out.push({ s: s + LEVELS.indexOf(r.lvl) * 0.1, kind: "unit", r });
    }
    if (!S.villages) { try { S.villages = await A.getJSON(S.ctx.base + S.ctx.meta.data.villages); } catch (e) { S.villages = []; } }
    for (const v of S.villages) {
      const s = Math.min(score(norm(v[1])), score(norm(v[2])));
      if (s < 9) out.push({ s: s + 0.5, kind: "village", v: { code: v[0], name_en: v[1], name_km: v[2], lon: v[3], lat: v[4] } });
    }
    return out.sort((a, b) => a.s - b.s).slice(0, 12);
  }
  function resultHTML(x, i) {
    if (x.kind === "unit") {
      const r = x.r;
      return `<button type="button" class="adm-res" data-i="${i}"><b>${esc(fullName(r))}</b> <span class="muted">${km() ? "" : esc(cls(r))}${r.lvl !== "province" ? `${km() ? "" : " · "}${chain(r)}` : ""}</span></button>`;
    }
    const v = x.v, c = S.byCode[`commune:${v.code.slice(0, 6)}`];
    return `<button type="button" class="adm-res" data-i="${i}"><b>${esc(fullName(v, VILLAGE_KM))}</b> <span class="muted">${km() ? "" : `${t("adm_village")} · `}${c ? `${esc(fullName(c))} · ${chain(c)}` : ""}</span></button>`;
  }

  function injectStyles() {
    if (document.getElementById("adm-styles")) return;
    const st = document.createElement("style"); st.id = "adm-styles";
    st.textContent = `
      .adm-seg{display:flex;gap:4px;flex-wrap:wrap}.adm-ctrl{display:grid;gap:6px}.adm-ctrl>label{font-size:13px;color:var(--muted)}
      .adm-ctrl select,.adm-ctrl input{width:100%;padding:7px 9px;border:1px solid var(--rule);border-radius:4px;background:var(--surface)}
      .adm-legend{display:grid;gap:3px;font-size:13px}.adm-key{display:flex;align-items:center;gap:8px}
      .adm-sw{width:22px;height:12px;border-radius:2px;border:1px solid var(--rule)}.adm-unit{font-size:12px;margin-bottom:2px}
      .adm-card{padding:14px;border:1px solid var(--rule);border-radius:6px;background:var(--paper);display:grid;gap:4px}
      .adm-name{font-size:20px;font-weight:600;line-height:1.35}.adm-name .muted{font-size:14px;font-weight:400}.adm-chain{font-size:13px;color:var(--muted)}
      .adm-dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:6px 0 0;font-size:13.5px}.adm-dl dt{color:var(--muted)}.adm-dl dd{margin:0;text-align:right}
      .adm-results{display:grid;border:1px solid var(--rule);border-radius:4px;max-height:280px;overflow:auto;background:var(--surface)}
      .adm-res{all:unset;cursor:pointer;padding:6px 10px;font-size:13.5px;line-height:1.35;border-bottom:1px solid var(--rule)}
      .adm-res:hover,.adm-res:focus-visible{background:var(--paper)}.adm-res .muted{font-size:12.5px}
      .adm-table{max-height:300px;overflow:auto;border:1px solid var(--rule);border-radius:6px}
      .adm-table table{width:100%;border-collapse:collapse;font-size:13px}.adm-table caption{text-align:left;padding:6px 10px;font-size:12px}
      .adm-table th{position:sticky;top:0;background:var(--surface);text-align:left;font-weight:600;padding:5px 10px;border-bottom:1px solid var(--rule)}
      .adm-table td{padding:4px 10px;border-bottom:1px solid var(--rule)}.adm-table tr[data-code]{cursor:pointer}.adm-table tr[data-code]:hover{background:var(--paper)}
      .adm-table .r{text-align:right}.adm-tip .maplibregl-popup-content{padding:6px 10px;font-size:13px}
      .map-label-sm{font-size:11px;font-weight:400;padding:0 4px}
      .adm-compare-btn{justify-self:start;padding:6px 14px;font-weight:600}
      .adm-compare-note{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5}
      .adm-year-tag{position:absolute;top:10px;z-index:5;pointer-events:none;font:600 15px/1 var(--f-data);letter-spacing:.06em;
        background:var(--ink);color:var(--paper);padding:5px 10px;border-radius:4px}
      .adm-year-tag.left{left:10px}.adm-year-tag.right{right:56px}
    `;
    document.head.appendChild(st);
  }

  function mountPanel(el) {
    injectStyles();
    const counts = { province: 0, district: 0, commune: 0 };
    for (const r of S.index) if (r.class_en !== "Island") counts[r.lvl]++;  // island parts belong to a commune already counted
    el.innerHTML = `
      <section class="adm-ctrl"><label for="adm-search">${t("adm_find")}</label>
        <input id="adm-search" type="search" placeholder="${t("adm_find_ph")}" autocomplete="off">
        <div class="adm-results" id="adm-results" hidden></div></section>
      <section class="adm-card" id="adm-info" aria-live="polite"></section>
      <section class="adm-ctrl"><label>${t("adm_level")}</label>
        <div class="adm-seg" id="adm-levels">${LEVELS.map((l) =>
          `<button type="button" class="chip-btn" data-level="${l}">${t("adm_" + l)} <span class="num muted">${nf(counts[l])}</span></button>`).join("")}</div></section>
      ${S.map.getSource("adm14") ? `<section class="adm-ctrl">
        <button type="button" class="chip-btn adm-compare-btn" id="adm-compare" aria-pressed="false">⇆ ${t("adm_compare")}</button>
        <p class="adm-compare-note" id="adm-compare-note" hidden>${t("adm_compare_note")}<br><span class="num">${t("adm_2014_counts")}</span></p></section>` : ""}
      <section class="adm-ctrl"><label for="adm-metric">${t("adm_colour")}</label><select id="adm-metric"></select>
        <div class="adm-legend" id="adm-legend"></div></section>
      <section class="adm-ctrl"><h2>${t("adm_table")}</h2><div class="adm-table" id="adm-table"></div></section>`;
    document.getElementById("adm-levels").querySelectorAll("button").forEach((b) => (b.onclick = () => setLevel(b.dataset.level)));
    const cmp = document.getElementById("adm-compare"); if (cmp) cmp.onclick = () => setCompare(!S.compare);
    document.getElementById("adm-metric").onchange = (e) => { if (S.compare && e.target.value !== "area_km2") setCompare(false); S.metric = e.target.value; S.map.setPaintProperty(`adm-fill-${S.level}`, "fill-color", fillExpr(S.level, S.metric)); renderControls(); };
    const input = document.getElementById("adm-search"), box = document.getElementById("adm-results");
    let seq = 0, results = [];
    input.oninput = async () => {
      const my = ++seq; const r = await search(input.value); if (my !== seq) return;
      results = r;
      box.hidden = !input.value.trim() || input.value.trim().length < 2;
      box.innerHTML = r.length ? r.map(resultHTML).join("") : `<div class="adm-res muted">${t("adm_noresult")}</div>`;
      box.querySelectorAll("button[data-i]").forEach((b) => (b.onclick = () => {
        const x = results[+b.dataset.i]; seq++; box.hidden = true; input.value = x.kind === "unit" ? nm(x.r) : nm(x.v);
        if (x.kind === "unit") { if (S.level !== x.r.lvl) setLevel(x.r.lvl); select(x.r.lvl, x.r.code, true); }
        else { if (S.level !== "commune") setLevel("commune"); selectVillage(x.v, true); }
      }));
    };
    input.onkeydown = (e) => { if (e.key === "Enter") { const b = box.querySelector("button[data-i]"); if (b) b.click(); } };
    renderControls(); renderInfo();
  }

  A.register("admin-units", { addLayers, mountPanel });
})();
