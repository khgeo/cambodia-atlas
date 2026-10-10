/* Interactive Cambodia Atlas — shared core (no build step; plain browser JS).
 *
 * Page module contract — each plate in pages/<id>/ provides:
 *   page.json   metadata (title_en/km, chapter, plate number, books, center/zoom, text files)
 *   page.js     registers  Atlas.register("<id>", { addLayers(map, ctx), mountPanel?(el, map, ctx), legend? })
 *               addLayers() must return the list of MapLibre layer ids it created (used by the Explorer).
 */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  const pages = {};

  // ---------------- language ----------------
  const STR = {
    en: { atlas: "Interactive Cambodia Atlas", contents: "Contents", explorer: "Explorer", plate: "Plate",
          live: "Live", planned: "Planned", prev: "Previous", next: "Next", back: "All plates",
          offlineBasemap: "The online base map could not load, so only the atlas layers are shown.",
          layers: "Layers", loading: "Loading…", books: "Book",
          geolibre: "Open the data in GeoLibre", geolibreNote: "Analyse these layers in GeoLibre, a free GIS that runs in the browser: buffers, overlays, statistics and 1,000+ more tools. Nothing to install.",
          geolibreLocal: "Works once the atlas is online (GitHub Pages); GeoLibre can't read files from this computer's local server." },
    km: { atlas: "អាត្លាសអន្តរកម្មកម្ពុជា", contents: "មាតិកា", explorer: "រុករកស្រទាប់", plate: "ផែនទីទី",
          live: "ដំណើរការ", planned: "គ្រោងនឹងធ្វើ", prev: "មុន", next: "បន្ទាប់", back: "ផែនទីទាំងអស់",
          offlineBasemap: "មិនអាចផ្ទុកផែនទីមូលដ្ឋានតាមអ៊ីនធឺណិតបានទេ ដូច្នេះបង្ហាញតែស្រទាប់របស់អាត្លាស។",
          layers: "ស្រទាប់", loading: "កំពុងផ្ទុក…", books: "សៀវភៅ",
          geolibre: "បើកទិន្នន័យក្នុង GeoLibre", geolibreNote: "វិភាគស្រទាប់ទាំងនេះក្នុង GeoLibre ដែលជាកម្មវិធី GIS ឥតគិតថ្លៃ ដំណើរការក្នុងកម្មវិធីរុករក៖ buffer, overlay, ស្ថិតិ និងឧបករណ៍ជាង ១.០០០ ទៀត។ មិនចាំបាច់ដំឡើងទេ។",
          geolibreLocal: "ដំណើរការនៅពេលអាត្លាសនៅលើបណ្ដាញ (GitHub Pages)។ GeoLibre មិនអាចអានឯកសារពីម៉ាស៊ីនមេក្នុងកុំព្យូទ័រនេះបានទេ។" },
  };
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  Atlas.lang = safeGet("atlas.lang") === "km" ? "km" : "en";
  Atlas.t = (key) => (STR[Atlas.lang] && STR[Atlas.lang][key]) || STR.en[key] || key;
  Atlas.pick = (obj, field) => (obj && (obj[`${field}_${Atlas.lang}`] || obj[`${field}_en`])) || "";
  Atlas.addStrings = (lang, dict) => Object.assign(STR[lang] = STR[lang] || {}, dict);
  Atlas.setLang = (lang) => { safeSet("atlas.lang", lang); location.reload(); };

  /** Builds the shared top bar. `extra` is an optional element placed before the language toggle. */
  Atlas.renderBar = function (el, extra) {
    document.documentElement.lang = Atlas.lang;
    el.innerHTML = `
      <a class="brand" href="index.html">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--ink)"/>
          <path d="M6 22 L12 12 L17 18 L21 13 L26 22 Z" fill="var(--paper)"/>
          <circle cx="22" cy="9" r="2.4" fill="var(--accent)"/>
        </svg>
        <span class="brand-name">${Atlas.t("atlas")}</span>
      </a>
      <span class="spacer"></span>
      <nav class="nav-links">
        <a class="chip-btn" href="index.html">${Atlas.t("contents")}</a>
        <a class="chip-btn" href="explorer.html">${Atlas.t("explorer")}</a>
      </nav>
      <span class="slot"></span>
      <button class="chip-btn" id="lang-toggle" type="button" aria-label="Switch language">${Atlas.lang === "km" ? "EN" : "ខ្មែរ"}</button>`;
    if (extra) el.querySelector(".slot").replaceWith(extra);
    el.querySelector("#lang-toggle").onclick = () => Atlas.setLang(Atlas.lang === "km" ? "en" : "km");
  };

  // ---------------- data ----------------
  Atlas.getJSON = async (url) => { const r = await fetch(url + (/\?/.test(url) ? "" : Atlas.versionQuery())); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };
  Atlas.getText = async (url) => { const r = await fetch(url + (/\?/.test(url) ? "" : Atlas.versionQuery())); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.text(); };
  Atlas.catalog = () => Atlas.getJSON("pages/catalog.json");

  /** "?v=…" from the page's <meta name="atlas-version">, so plate scripts and data skip stale browser caches. */
  Atlas.versionQuery = () => {
    const v = document.querySelector('meta[name="atlas-version"]')?.content;
    return v ? `?v=${encodeURIComponent(v)}` : "";
  };
  Atlas.register = (id, mod) => { pages[id] = mod; };
  /** Loads pages/<id>/page.json and page.js; resolves to { meta, mod, base }. */
  Atlas.loadPage = async function (id) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Bad page id");
    const base = `pages/${id}/`;
    const meta = await Atlas.getJSON(base + "page.json");
    if (!pages[id]) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = base + "page.js" + Atlas.versionQuery(); s.onload = res; s.onerror = () => rej(new Error("page.js failed to load"));
        document.head.appendChild(s);
      });
    }
    return { meta, mod: pages[id], base };
  };

  // ---------------- map ----------------
  // Online basemap (OpenFreeMap, free, no key). If it can't be reached — offline, or a sandbox that blocks
  // other hosts — the atlas falls back to a plain style with its own river context layer.
  Atlas.BASEMAP_URL = "https://tiles.openfreemap.org/styles/positron";

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  Atlas.cssVar = cssVar;

  function offlineStyle() {
    return { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": cssVar("--map-bg") } }] };
  }

  async function onlineStyle(timeoutMs = 4000) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try { const r = await fetch(Atlas.BASEMAP_URL, { signal: ctl.signal }); if (!r.ok) throw 0; return await r.json(); }
    finally { clearTimeout(timer); }
  }

  /** Creates the map. Resolves once the style is ready. map.atlasOffline tells which basemap is in use. */
  Atlas.createMap = async function (container, { center = [104.92, 11.56], zoom = 11.3, contextUrl } = {}) {
    let style, offline = false;
    try { style = await onlineStyle(); } catch (e) { style = offlineStyle(); offline = true; }
    const map = new maplibregl.Map({ container, style, center, zoom, attributionControl: { compact: true }, maxPitch: 60 });
    map.atlasOffline = offline;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    await new Promise((res) => (map.loaded() ? res() : map.once("load", res)));
    if (offline) {
      if (contextUrl) {
      map.addSource("context", { type: "geojson", data: contextUrl });
      map.addLayer({ id: "context-river", type: "line", source: "context", filter: ["==", ["get", "kind"], "river"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cssVar("--water"),
          "line-width": ["interpolate", ["exponential", 2], ["zoom"], 9, ["*", 4, ["get", "w"]], 14, ["*", 90, ["get", "w"]]] } });
      }
      const note = document.createElement("div");
      note.className = "basemap-note"; note.textContent = Atlas.t("offlineBasemap");
      container.parentElement.appendChild(note);
    }
    return map;
  };

  /** Registers the pmtiles:// protocol once and returns the tile URL for a .pmtiles file next to the page. */
  let pmReady = false;
  Atlas.pmtilesUrl = (path) => {
    if (!pmReady) { const p = new pmtiles.Protocol(); maplibregl.addProtocol("pmtiles", p.tile); pmReady = true; }
    return "pmtiles://" + new URL(path, location.href).href;
  };

  /** Adds an HTML label (used for Khmer text, which MapLibre glyph rendering cannot shape). */
  Atlas.htmlLabel = (map, lngLat, text, anchor = "left") => {
    const el = document.createElement("div"); el.className = "map-label"; el.textContent = text;
    return new maplibregl.Marker({ element: el, anchor, offset: anchor === "left" ? [8, 0] : [0, 0] }).setLngLat(lngLat).addTo(map);
  };

  // ---------------- legend built from layer styling ----------------
  // A plate registers the layers that belong in the legend; the legend reads each layer's live paint
  // (step → classes, match → categories, interpolate → colour ramp, plain colour → one entry), so it
  // always matches what is drawn, including after setPaintProperty. Inspired by GeoLibre's symbology-derived legends.
  //   Atlas.legend(map, layerId, { title: {en, km} | string | () => string, unit, labels: {value: {en, km}}, visible: () => bool,
  //                                 shape: "fill" | "line" | "circle", order })
  const LEG = new WeakMap();
  const tr = (v) => (v == null ? "" : typeof v === "function" ? v() : typeof v === "object" ? (v[Atlas.lang] || v.en || "") : String(v));
  const nfmt = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("en-US") : String(+(+n).toFixed(2)));
  Atlas.addStrings("en", { legend: "Legend", noData: "No data" });
  Atlas.addStrings("km", { legend: "គំនូសតាង", noData: "គ្មានទិន្នន័យ" });

  const isColor = (v) => typeof v === "string";
  function colorItems(expr, info) {
    if (isColor(expr)) return { kind: "single", items: [{ color: expr }] };
    if (!Array.isArray(expr)) return null;
    const op = expr[0];
    if (op === "step") {
      const input = expr[1], items = [];
      const noDataInput = Array.isArray(input) && input[0] === "coalesce";
      const stops = []; for (let i = 3; i < expr.length; i += 2) stops.push([expr[i], expr[i + 1]]);
      if (noDataInput && stops.length && stops[0][0] === 0) items.push({ color: expr[2], label: Atlas.t("noData"), noData: true });
      else items.push({ color: expr[2], label: stops.length ? `< ${nfmt(stops[0][0])}` : "" });
      stops.forEach(([v, c], i) => {
        const next = stops[i + 1];
        const lower = v === 0 && noDataInput ? null : v;
        items.push({ color: c, label: next ? (lower == null ? `< ${nfmt(next[0])}` : `${nfmt(lower)} – ${nfmt(next[0])}`) : `≥ ${nfmt(v)}` });
      });
      return { kind: "classes", items: info.hideNoData ? items.filter((x) => !x.noData) : items };
    }
    if (op === "match") {
      const items = [];
      for (let i = 2; i < expr.length - 1; i += 2) {
        const vals = Array.isArray(expr[i]) ? expr[i] : [expr[i]];
        const lab = vals.map((v) => tr(info.labels && info.labels[v]) || String(v)).join(", ");
        items.push({ color: expr[i + 1], label: lab });
      }
      return { kind: "categories", items };
    }
    if (op === "interpolate" || op === "interpolate-hcl" || op === "interpolate-lab") {
      const stops = []; for (let i = 3; i < expr.length; i += 2) if (isColor(expr[i + 1])) stops.push([expr[i], expr[i + 1]]);
      if (!stops.length) return null;
      return { kind: "ramp", items: stops.map(([v, c]) => ({ color: c, label: nfmt(v) })) };
    }
    if (op === "case") return colorItems(expr[expr.length - 1], info);
    return null;
  }

  function legendEntry(map, id, info) {
    const layer = map.getLayer(id); if (!layer) return null;
    const type = layer.type, shape = info.shape || (type === "fill" ? "fill" : type === "line" ? "line" : "circle");
    const prop = info.colorProp || { fill: "fill-color", line: "line-color", circle: "circle-color" }[type];
    let expr = prop && map.getPaintProperty(id, prop);
    if (shape === "circle" && type === "circle" && info.useStroke) expr = map.getPaintProperty(id, "circle-stroke-color");
    const parsed = (info.items && { kind: "categories", items: info.items.map((x) => ({ color: x.color, stroke: x.stroke, label: tr(x.label) })) }) || colorItems(expr, info);
    if (!parsed) return null;
    const stroke = type === "circle" ? map.getPaintProperty(id, "circle-stroke-color") : null;
    return { id, title: tr(info.title), unit: tr(info.unit), shape, stroke: isColor(stroke) ? stroke : null, ...parsed };
  }

  function swatch(e, color, stroke) {
    const s = e.shape; if (stroke) e = { ...e, stroke };
    if (s === "line") return `<span class="lg-sw lg-line" style="--c:${color}"></span>`;
    if (s === "circle") return `<span class="lg-sw lg-circle" style="--c:${color};--s:${e.stroke || "transparent"}"></span>`;
    return `<span class="lg-sw lg-fill" style="--c:${color}"></span>`;
  }

  function renderLegend(map) {
    const st = LEG.get(map); if (!st) return;
    const entries = [];
    for (const [id, info] of st.layers) {
      const layer = map.getLayer(id); if (!layer) continue;
      const shown = info.visible ? info.visible() : map.getLayoutProperty(id, "visibility") !== "none";
      if (!shown) continue;
      const z = map.getZoom();
      if ((layer.minzoom != null && z < layer.minzoom - 0.01 && !info.ignoreZoom)) continue;
      const e = legendEntry(map, id, info); if (e) entries.push([info.order ?? 0, e]);
    }
    entries.sort((a, b) => a[0] - b[0]);
    const body = entries.map(([, e]) => {
      const head = e.title ? `<div class="lg-title">${Atlas.esc(e.title)}${e.unit ? ` <span class="lg-unit">(${Atlas.esc(e.unit)})</span>` : ""}</div>` : "";
      if (e.kind === "ramp") {
        const grad = e.items.map((x) => x.color).join(",");
        return `<div class="lg-entry">${head}<div class="lg-ramp" style="background:linear-gradient(90deg,${grad})"></div>
          <div class="lg-ramp-lab num"><span>${Atlas.esc(e.items[0].label)}</span><span>${Atlas.esc(e.items[e.items.length - 1].label)}</span></div></div>`;
      }
      if (e.kind === "single" && e.title) return `<div class="lg-entry lg-row">${swatch(e, e.items[0].color)}<span>${Atlas.esc(e.title)}</span></div>`;
      const cols = e.kind === "categories" && e.items.length > 8 ? " lg-cols" : "";
      return `<div class="lg-entry">${head}<div class="lg-items${cols}">${e.items.map((x) =>
        `<div class="lg-row">${swatch(e, x.color, x.stroke)}<span class="${e.kind === "classes" ? "num" : ""}">${Atlas.esc(x.label || "")}</span></div>`).join("")}</div></div>`;
    }).join("");
    st.el.hidden = !entries.length;
    st.body.innerHTML = body;
  }

  class LegendControl {
    constructor(map) { this.map = map; }
    onAdd() {
      const el = document.createElement("div"); el.className = "maplibregl-ctrl atlas-legend";
      let collapsed = window.matchMedia && window.matchMedia("(max-width: 860px)").matches;
      try { const v = localStorage.getItem("atlas.legend.collapsed"); if (v != null) collapsed = v === "1"; } catch (e) {}
      el.innerHTML = `<button type="button" class="lg-toggle" aria-expanded="${!collapsed}">${Atlas.t("legend")}<span class="lg-chev" aria-hidden="true">▾</span></button><div class="lg-body"></div>`;
      const btn = el.querySelector(".lg-toggle"), body = el.querySelector(".lg-body");
      body.hidden = collapsed;
      btn.onclick = () => { const c = !body.hidden; body.hidden = c; btn.setAttribute("aria-expanded", !c); try { localStorage.setItem("atlas.legend.collapsed", c ? "1" : "0"); } catch (e) {} };
      this.el = el; this.body = body; return el;
    }
    onRemove() { this.el.remove(); }
  }

  /** Register (or update) a layer's legend entry. Creates the legend control on first use. */
  Atlas.legend = (map, layerId, info = {}) => {
    let st = LEG.get(map);
    if (!st) {
      const ctl = new LegendControl(map);
      map.addControl(ctl, "bottom-left");
      st = { layers: new Map(), el: ctl.el, body: ctl.body, timer: 0 };
      LEG.set(map, st);
      const schedule = () => { clearTimeout(st.timer); st.timer = setTimeout(() => renderLegend(map), 60); };
      map.on("styledata", schedule); map.on("zoomend", schedule);
      st.schedule = schedule;
    }
    st.layers.set(layerId, info);
    st.schedule();
  };
  /** Re-render now (after a plate changes state that a `visible` or `title` callback reads). */
  Atlas.refreshLegend = (map) => { const st = LEG.get(map); if (st) st.schedule(); };

  /** "Open in GeoLibre" link for a plate's data files (https://web.geolibre.app, MIT, opengeos/GeoLibre). */
  Atlas.GEOLIBRE_WEB = "https://web.geolibre.app/";
  Atlas.geolibreUrl = (base, files) => {
    const q = new URLSearchParams();
    for (const f of files) q.append("data", new URL(base + f, location.href).href);
    if (Atlas.lang === "km") q.set("theme", "light");
    return Atlas.GEOLIBRE_WEB + "?" + q.toString();
  };

  Atlas.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();
