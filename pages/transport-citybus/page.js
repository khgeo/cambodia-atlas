/* Plate 4.1 — Phnom Penh City Bus: lines, stops and an estimated-timetable simulation. */
(function () {
  // ===================== pure timetable model (no DOM; testable in Node) =====================
  const R = 6371.0088;
  const rad = (d) => (d * Math.PI) / 180;
  function hav(a, b) {
    const dla = rad(b[1] - a[1]), dlo = rad(b[0] - a[0]);
    const h = Math.sin(dla / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const fmt = (min) => { const m = Math.round(min); return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

  /** Distance (km) along a polyline of the point on it nearest to p. Planar approx is fine at city scale. */
  function project(coords, cum, p) {
    const kx = Math.cos(rad(p[1]));
    let best = { d2: Infinity, s: 0 };
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i];
      const ax = a[0] * kx, ay = a[1], bx = b[0] * kx, by = b[1], px = p[0] * kx, py = p[1];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const qx = ax + t * dx, qy = ay + t * dy, d2 = (px - qx) ** 2 + (py - qy) ** 2;
      if (d2 < best.d2) best = { d2, s: cum[i - 1] + t * (cum[i] - cum[i - 1]) };
    }
    return best.s;
  }
  function pointAt(coords, cum, s) {
    if (s <= 0) return coords[0];
    for (let i = 1; i < coords.length; i++) {
      if (cum[i] >= s) {
        const t = cum[i] === cum[i - 1] ? 0 : (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
        const a = coords[i - 1], b = coords[i];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
    }
    return coords[coords.length - 1];
  }

  /** Builds line objects from GeoJSON: geometry, cumulative km, ordered stops with distances along the line. */
  function prepare(linesFC, stopsFC) {
    const lines = linesFC.features.map((f) => {
      const coords = f.geometry.coordinates, cum = [0];
      for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + hav(coords[i - 1], coords[i]));
      return { id: f.properties.line, props: f.properties, coords, cum, L: cum[cum.length - 1], stops: [] };
    });
    const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
    for (const f of stopsFC.features) {
      const l = byId[f.properties.line]; if (!l) continue;
      l.stops.push({ ...f.properties, coord: f.geometry.coordinates });
    }
    for (const l of lines) {
      l.stops.sort((a, b) => a.seq - b.seq);
      let prev = 0;
      l.stops.forEach((s, i) => {
        let d = i === 0 ? 0 : project(l.coords, l.cum, s.coord);
        if (i === l.stops.length - 1 && !l.props.loop) d = Math.max(d, l.L * 0.98);
        if (i === l.stops.length - 1 && l.props.loop) d = l.L;
        s.d = Math.max(prev, d); prev = s.d;   // stops must advance along the line
      });
    }
    return { lines, byId };
  }

  /** Estimated timetable for one line. Times are minutes after midnight. */
  function schedule(line, { first = "05:30", last = "20:30", speed = 16, dwellS = 20 } = {}) {
    const v = speed / 60, dw = dwellS / 60;                       // km per minute, minutes
    const h = (line.props.headway_min[0] + line.props.headway_min[1]) / 2;
    const n = line.stops.length;
    const mk = (dists) => {
      const arr = dists.map((s, i) => s / v + i * dw);            // arrival offset at each stop
      return { dists, arr, T: arr[n - 1] };
    };
    const fwd = mk(line.stops.map((s) => s.d));
    const dirs = [{ dir: 0, toStop: line.stops[n - 1], ...fwd }];
    if (!line.props.loop) dirs.push({ dir: 1, toStop: line.stops[0], ...mk(line.stops.map((s) => line.L - s.d).reverse()) });
    const t0 = toMin(first), tEnd = toMin(last);
    for (const d of dirs) {
      d.deps = [];
      for (let t = t0; t + d.T <= tEnd || d.deps.length === 0; t += h) d.deps.push(t);
    }
    return { headway: h, dirs, tripMin: fwd.T };
  }

  /** Distance along the drawn line of a bus that departed at `dep`, at time t (null if not running). */
  function busDistance(line, d, dep, t, dwellS) {
    const e = t - dep, dw = dwellS / 60;
    if (e < 0 || e > d.T) return null;
    const { arr, dists } = d;
    let i = 0; while (i < arr.length - 1 && arr[i + 1] <= e) i++;
    let s;
    if (i === arr.length - 1 || e <= arr[i] + dw) s = dists[i];
    else s = Math.min(dists[i + 1], dists[i] + (e - arr[i] - dw) * ((dists[i + 1] - dists[i]) / Math.max(1e-6, arr[i + 1] - arr[i] - dw)));
    return d.dir === 0 ? s : line.L - s;
  }

  /** Next arrivals at stop index k (in forward order) after time t, per direction. */
  function nextArrivals(line, sch, k, t, count = 3) {
    const n = line.stops.length;
    return sch.dirs.map((d) => {
      const idx = d.dir === 0 ? k : n - 1 - k;
      if (idx === d.arr.length - 1) return { dir: d.dir, to: d.toStop, times: [], terminal: true };
      const times = [];
      for (const dep of d.deps) { const a = dep + d.arr[idx]; if (a >= t) { times.push(a); if (times.length === count) break; } }
      return { dir: d.dir, to: d.toStop, times };
    });
  }

  const Model = { hav, project, pointAt, prepare, schedule, busDistance, nextArrivals, toMin, fmt };
  if (typeof module !== "undefined" && module.exports) { module.exports = Model; return; }

  // ===================== browser page =====================
  const A = window.Atlas;
  A.addStrings("en", {
    bus_line: "Line", bus_now: "buses running", bus_play: "Play", bus_pause: "Pause", bus_speed: "Average speed",
    bus_dwell: "Stop at each bus stop", bus_lines: "Lines", bus_all: "All", bus_none: "None", bus_every: "every",
    bus_min: "min", bus_trip: "end to end", bus_stops: "stops", bus_to: "to", bus_in: "in", bus_change: "Change here to",
    bus_terminal: "Terminal for this direction", bus_none_left: "No more buses today", bus_est: "Estimated times",
    bus_clock: "Simulated time", bus_rate: "Playback speed", bus_assume: "Timetable assumptions", bus_sources: "Sources",
    bus_approx: "Approximate position", bus_running: "running",
  });
  A.addStrings("km", {
    bus_line: "ខ្សែទី", bus_now: "រថយន្តកំពុងដំណើរការ", bus_play: "ចាក់", bus_pause: "ផ្អាក", bus_speed: "ល្បឿនមធ្យម",
    bus_dwell: "រយៈពេលឈប់នៅចំណតនីមួយៗ", bus_lines: "ខ្សែរថយន្ត", bus_all: "ទាំងអស់", bus_none: "លាក់ទាំងអស់", bus_every: "រៀងរាល់",
    bus_min: "នាទី", bus_trip: "ពីចុងដល់ចុង", bus_stops: "ចំណត", bus_to: "ទៅ", bus_in: "ក្នុងរយៈពេល", bus_change: "អាចប្ដូរទៅ",
    bus_terminal: "ចំណតចុងក្រោយសម្រាប់ទិសនេះ", bus_none_left: "អស់រថយន្តសម្រាប់ថ្ងៃនេះ", bus_est: "ពេលវេលាប៉ាន់ស្មាន",
    bus_clock: "ម៉ោងក្លែងធ្វើ", bus_rate: "ល្បឿនចាក់", bus_assume: "ការសន្មតនៃតារាងពេលវេលា", bus_sources: "ប្រភព",
    bus_approx: "ទីតាំងប៉ាន់ស្មាន", bus_running: "កំពុងរត់",
  });
  const t = A.t, esc = A.esc;
  const OFFSET = { "3": -3, "4A": -3.5, "4C": 3.5, "7": -3, "10": 3, "5A": -2 };

  const S = { model: null, sch: {}, time: toMin("07:30"), playing: false, rate: 60, speed: 16, dwell: 20,
              hidden: new Set(), popup: null, popupStop: null, cfg: null };

  function rebuildSchedules() {
    for (const l of S.model.lines) S.sch[l.id] = schedule(l, { first: S.cfg.first_departure, last: S.cfg.last_arrival, speed: S.speed, dwellS: S.dwell });
  }

  function busesFC() {
    const feats = []; const counts = {};
    for (const l of S.model.lines) {
      counts[l.id] = 0;
      if (S.hidden.has(l.id)) continue;
      for (const d of S.sch[l.id].dirs) for (const dep of d.deps) {
        const s = busDistance(l, d, dep, S.time, S.dwell);
        if (s == null) continue;
        counts[l.id]++;
        feats.push({ type: "Feature", properties: { line: l.id, color: l.props.color }, geometry: { type: "Point", coordinates: pointAt(l.coords, l.cum, s) } });
      }
    }
    return { fc: { type: "FeatureCollection", features: feats }, counts };
  }

  function chip(l) { return `<span class="bus-chip" style="--c:${l.props.color}">${esc(l.id)}</span>`; }

  function stopPopupHTML(stop) {
    const l = S.model.byId[stop.line];
    const k = l.stops.findIndex((s) => s.id === stop.id);
    const near = [];
    for (const o of S.model.lines) {
      if (o.id === l.id) continue;
      if (o.stops.some((s) => hav(s.coord, stop.coord) < 0.25)) near.push(o);
    }
    let html = `<div class="pop-title">${chip(l)} <b>${esc(stop.name_km && A.lang === "km" ? stop.name_km : stop.name_en)}</b></div>`;
    if (stop.position_quality === "approximate") html += `<div class="pop-sub">${t("bus_approx")}</div>`;
    if (S.sch[l.id]) {
      html += `<div class="pop-sub">${t("bus_est")} · ${fmt(S.time)}</div><div class="pop-arr">`;
      for (const r of nextArrivals(l, S.sch[l.id], k, S.time)) {
        const dest = esc(A.lang === "km" && r.to.name_km ? r.to.name_km : r.to.name_en);
        if (r.terminal) { html += `<div class="arr-row"><span class="muted">${t("bus_terminal")}</span></div>`; continue; }
        const times = r.times.length
          ? r.times.map((x, i) => `<span class="num arr-t">${fmt(x)}</span>${i === 0 ? ` <span class="muted">(${t("bus_in")} ${Math.max(0, Math.round(x - S.time))} ${t("bus_min")})</span>` : ""}`).join(" · ")
          : `<span class="muted">${t("bus_none_left")}</span>`;
        html += `<div class="arr-row"><span class="arr-dest">→ ${t("bus_to")} ${dest}</span><div>${times}</div></div>`;
      }
      html += `</div>`;
    }
    if (near.length) html += `<div class="pop-sub">${t("bus_change")}: ${near.map(chip).join(" ")}</div>`;
    return html;
  }

  function openStop(map, stop, lngLat) {
    if (S.popup) S.popup.remove();
    S.popupStop = stop;
    S.popup = new maplibregl.Popup({ maxWidth: "320px", offset: 8 }).setLngLat(lngLat).setHTML(stopPopupHTML(stop)).addTo(map);
    S.popup.on("close", () => { S.popupStop = null; });
  }

  function injectStyles() {
    if (document.getElementById("bus-styles")) return;
    const st = document.createElement("style"); st.id = "bus-styles";
    st.textContent = `
      .bus-chip{display:inline-block;min-width:28px;text-align:center;font:600 12px/18px var(--f-data);color:#fff;background:var(--c);border-radius:3px;padding:0 4px;text-shadow:0 0 2px rgba(0,0,0,.35)}
      .pop-title{display:flex;gap:8px;align-items:center;margin-bottom:2px}.pop-sub{font-size:12px;color:var(--muted);margin-top:6px}
      .pop-arr{display:grid;gap:6px;margin-top:4px}.arr-row{display:grid;gap:1px}.arr-dest{font-size:12.5px}.arr-t{font-size:15px;font-weight:600}
      .clock{display:grid;gap:10px;padding:14px;border:1px solid var(--rule);border-radius:6px;background:var(--paper)}
      .clock-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .clock-time{font:600 44px/1 var(--f-data);font-variant-numeric:tabular-nums;letter-spacing:.02em}
      .clock-meta{font-size:13px;color:var(--muted);line-height:1.3}.clock-meta b{color:var(--ink);font:600 18px var(--f-data)}
      .play{margin-left:auto;border:0;background:var(--ink);color:var(--paper);border-radius:999px;padding:8px 16px;font-weight:600;cursor:pointer}
      .clock input[type=range]{width:100%;accent-color:var(--accent)}
      .ticks{display:flex;justify-content:space-between;font:500 11px var(--f-data);color:var(--muted)}
      .ctrl{display:grid;gap:4px;font-size:13px}.ctrl-row{display:flex;justify-content:space-between;gap:8px}
      .ctrl input{width:100%;accent-color:var(--accent)} .rates{display:flex;gap:4px;flex-wrap:wrap}
      .line-list{display:grid;gap:2px}.line-row{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:8px;align-items:start;padding:6px 4px;border-radius:4px;cursor:pointer}
      .line-row:hover,.line-row[data-hi]{background:var(--paper)}.line-row input{margin-top:3px;accent-color:var(--accent)}
      .line-name{font-size:13.5px;line-height:1.35}.line-facts{font-size:12px;color:var(--muted)}
      .row-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
      .src{font-size:12.5px;color:var(--muted);display:grid;gap:4px;padding-left:1em;margin:0}
    `;
    document.head.appendChild(st);
  }

  async function addLayers(map, ctx) {
    injectStyles();
    S.cfg = ctx.meta.timetable; S.speed = S.cfg.avg_speed_kmh; S.dwell = S.cfg.dwell_s;
    const [lines, stops] = await Promise.all([A.getJSON(ctx.base + ctx.meta.data.lines), A.getJSON(ctx.base + ctx.meta.data.stops)]);
    S.model = prepare(lines, stops);
    rebuildSchedules();
    lines.features.forEach((f) => { f.properties.offset = OFFSET[f.properties.line] || 0; });
    const halo = A.cssVar("--surface") || "#fff";
    map.addSource("bus-lines", { type: "geojson", data: lines });
    map.addSource("bus-stops", { type: "geojson", data: stops });
    map.addSource("buses", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const lineIds = ["bus-line-casing", "bus-line", "bus-line-hi", "bus-stop", "bus-bus"];
    map.addLayer({ id: "bus-line-casing", type: "line", source: "bus-lines", layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": halo, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 10], "line-offset": ["get", "offset"] } });
    map.addLayer({ id: "bus-line", type: "line", source: "bus-lines", layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 15, 6], "line-offset": ["get", "offset"] } });
    map.addLayer({ id: "bus-line-hi", type: "line", source: "bus-lines", filter: ["==", ["get", "line"], ""], layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 15, 12], "line-offset": ["get", "offset"], "line-opacity": 0.9 } });
    const colorExpr = ["match", ["get", "line"], ...lines.features.flatMap((f) => [f.properties.line, f.properties.color]), "#888"];
    map.addLayer({ id: "bus-stop", type: "circle", source: "bus-stops", minzoom: 11.5,
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 11.5, 1.8, 15, 5.5], "circle-color": halo,
               "circle-stroke-color": colorExpr, "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11.5, 1, 15, 2.5] } });
    map.addLayer({ id: "bus-bus", type: "circle", source: "buses",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 15, 8], "circle-color": ["get", "color"],
               "circle-stroke-color": A.cssVar("--ink") || "#14304a", "circle-stroke-width": 1.5 } });

    map.on("click", "bus-stop", (e) => {
      const f = e.features[0]; const l = S.model.byId[f.properties.line];
      const stop = l.stops.find((s) => s.id === f.properties.id); if (stop) openStop(map, stop, f.geometry.coordinates);
    });
    for (const id of ["bus-stop", "bus-line", "bus-bus"]) {
      map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("click", "bus-line", (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ["bus-stop"] }).length) return;
      highlight(map, e.features[0].properties.line);
    });
    // terminal labels in HTML (keeps Khmer shaping correct and font consistent)
    const seen = [];
    const labels = [];
    for (const l of S.model.lines) for (const s of [l.stops[0], l.stops[l.stops.length - 1]]) {
      if (seen.some((p) => hav(p, s.coord) < 0.6)) continue; seen.push(s.coord);
      labels.push(A.htmlLabel(map, s.coord, A.lang === "km" && s.name_km ? s.name_km : s.name_en));
    }
    const toggleLabels = () => { const show = map.getZoom() >= 12; labels.forEach((m) => (m.getElement().style.display = show ? "" : "none")); };
    map.on("zoom", toggleLabels); toggleLabels();
    tick(map); // draw buses once
    return lineIds;
  }

  function highlight(map, id) {
    map.setFilter("bus-line-hi", ["==", ["get", "line"], id || ""]);
    document.querySelectorAll(".line-row").forEach((r) => r.toggleAttribute("data-hi", r.dataset.line === id));
  }

  function applyVisibility(map) {
    const vis = ["!", ["in", ["get", "line"], ["literal", [...S.hidden]]]];
    for (const id of ["bus-line-casing", "bus-line", "bus-stop"]) map.setFilter(id, vis);
  }

  let lastPopup = 0;
  function tick(map) {
    const { fc, counts } = busesFC();
    const src = map.getSource("buses"); if (src) src.setData(fc);
    const el = document.getElementById("bus-clock"); if (el) el.textContent = fmt(S.time);
    const slider = document.getElementById("bus-time"); if (slider && document.activeElement !== slider) slider.value = Math.round(S.time);
    const total = document.getElementById("bus-total"); if (total) total.textContent = fc.features.length;
    for (const [id, n] of Object.entries(counts)) { const c = document.getElementById(`bus-n-${id}`); if (c) c.textContent = n; }
    const now = performance.now();
    if (S.popup && S.popupStop && now - lastPopup > 500) { S.popup.setHTML(stopPopupHTML(S.popupStop)); lastPopup = now; }
  }

  function mountPanel(el, map) {
    const rates = [30, 60, 120, 300];
    const lineRows = S.model.lines.map((l) => {
      const s = S.sch[l.id], p = l.props;
      return `<label class="line-row" data-line="${esc(l.id)}">
        <input type="checkbox" id="bus-show-${esc(l.id)}" checked>
        ${chip(l)}
        <span><span class="line-name">${esc(p.from_en)} – ${esc(p.to_en)}</span>
        <span class="line-facts num" id="bus-facts-${esc(l.id)}"></span></span>
      </label>`;
    }).join("");
    el.innerHTML = `
      <section class="clock" aria-label="${t("bus_clock")}">
        <div class="clock-top">
          <div><div class="eyebrow">${t("bus_clock")}</div><div class="clock-time" id="bus-clock">--:--</div></div>
          <div class="clock-meta"><b id="bus-total" class="num">0</b><br>${t("bus_now")}</div>
          <button class="play" id="bus-play" type="button">${t("bus_play")}</button>
        </div>
        <input type="range" id="bus-time" min="300" max="1260" step="1" aria-label="${t("bus_clock")}">
        <div class="ticks num"><span>05:00</span><span>09:00</span><span>13:00</span><span>17:00</span><span>21:00</span></div>
        <div class="ctrl"><span class="muted">${t("bus_rate")}</span>
          <div class="rates">${rates.map((r) => `<button type="button" class="chip-btn" data-rate="${r}" aria-pressed="${r === S.rate}">×${r}</button>`).join("")}</div></div>
      </section>
      <section class="ctrl" style="gap:10px">
        <h2>${t("bus_assume")}</h2>
        <label class="ctrl"><span class="ctrl-row"><span>${t("bus_speed")}</span><b class="num" id="bus-speed-v"></b></span>
          <input type="range" id="bus-speed" min="8" max="30" step="1" value="${S.speed}"></label>
        <label class="ctrl"><span class="ctrl-row"><span>${t("bus_dwell")}</span><b class="num" id="bus-dwell-v"></b></span>
          <input type="range" id="bus-dwell" min="0" max="90" step="5" value="${S.dwell}"></label>
      </section>
      <section style="display:grid;gap:6px">
        <div class="row-head"><h2>${t("bus_lines")}</h2>
          <span><button type="button" class="chip-btn" id="bus-all">${t("bus_all")}</button> <button type="button" class="chip-btn" id="bus-none">${t("bus_none")}</button></span></div>
        <div class="line-list">${lineRows}</div>
      </section>`;

    const facts = () => {
      document.getElementById("bus-speed-v").textContent = `${S.speed} km/h`;
      document.getElementById("bus-dwell-v").textContent = `${S.dwell} s`;
      for (const l of S.model.lines) {
        const s = S.sch[l.id], p = l.props;
        document.getElementById(`bus-facts-${l.id}`).innerHTML =
          `${l.L.toFixed(1)} km · ${l.stops.length} ${t("bus_stops")} · ${t("bus_every")} ${p.headway_min[0]}–${p.headway_min[1]} ${t("bus_min")} · ~${Math.round(s.tripMin)} ${t("bus_min")} ${t("bus_trip")} · <span id="bus-n-${l.id}">0</span> ${t("bus_running")}`;
      }
    };
    facts();

    const playBtn = document.getElementById("bus-play");
    const setPlaying = (p) => { S.playing = p; playBtn.textContent = p ? t("bus_pause") : t("bus_play"); };
    playBtn.onclick = () => setPlaying(!S.playing);
    document.getElementById("bus-time").oninput = (e) => { S.time = +e.target.value; tick(map); };
    el.querySelectorAll("[data-rate]").forEach((b) => (b.onclick = () => {
      S.rate = +b.dataset.rate; el.querySelectorAll("[data-rate]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    const onAssume = () => {
      S.speed = +document.getElementById("bus-speed").value; S.dwell = +document.getElementById("bus-dwell").value;
      rebuildSchedules(); facts(); tick(map);
    };
    document.getElementById("bus-speed").oninput = onAssume;
    document.getElementById("bus-dwell").oninput = onAssume;
    for (const l of S.model.lines) {
      const cb = document.getElementById(`bus-show-${l.id}`);
      cb.onchange = () => { cb.checked ? S.hidden.delete(l.id) : S.hidden.add(l.id); applyVisibility(map); tick(map); };
      const row = cb.closest(".line-row");
      row.onmouseenter = () => highlight(map, l.id); row.onmouseleave = () => highlight(map, null);
    }
    const setAll = (show) => { for (const l of S.model.lines) { document.getElementById(`bus-show-${l.id}`).checked = show; show ? S.hidden.delete(l.id) : S.hidden.add(l.id); } applyVisibility(map); tick(map); };
    document.getElementById("bus-all").onclick = () => setAll(true);
    document.getElementById("bus-none").onclick = () => setAll(false);

    // animation loop: real seconds × rate = simulated seconds
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      if (S.playing) { S.time += (dt * S.rate) / 60; if (S.time > 1260) S.time = 300; tick(map); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    tick(map);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(!reduce);
  }

  A.register("transport-citybus", {
    addLayers: (map, ctx) => { A._meta = ctx.meta; return addLayers(map, ctx); },
    mountPanel,
  });
})();
