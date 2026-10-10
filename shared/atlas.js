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
          offlineBasemap: "Offline base map: roads and labels appear when the site is online (GitHub Pages).",
          layers: "Layers", loading: "Loading…", books: "Book" },
    km: { atlas: "អាត្លាសអន្តរកម្មកម្ពុជា", contents: "មាតិកា", explorer: "រុករកស្រទាប់", plate: "ផែនទីទី",
          live: "ដំណើរការ", planned: "គ្រោងនឹងធ្វើ", prev: "មុន", next: "បន្ទាប់", back: "ផែនទីទាំងអស់",
          offlineBasemap: "ផែនទីមូលដ្ឋានក្រៅបណ្ដាញ៖ ផ្លូវ និងឈ្មោះទីកន្លែងនឹងបង្ហាញពេលគេហទំព័រនៅលើបណ្ដាញ។",
          layers: "ស្រទាប់", loading: "កំពុងផ្ទុក…", books: "សៀវភៅ" },
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
  Atlas.getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };
  Atlas.getText = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.text(); };
  Atlas.catalog = () => Atlas.getJSON("pages/catalog.json");

  Atlas.register = (id, mod) => { pages[id] = mod; };
  /** Loads pages/<id>/page.json and page.js; resolves to { meta, mod, base }. */
  Atlas.loadPage = async function (id) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Bad page id");
    const base = `pages/${id}/`;
    const meta = await Atlas.getJSON(base + "page.json");
    if (!pages[id]) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = base + "page.js"; s.onload = res; s.onerror = () => rej(new Error("page.js failed to load"));
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
    if (offline && contextUrl) {
      map.addSource("context", { type: "geojson", data: contextUrl });
      map.addLayer({ id: "context-river", type: "line", source: "context", filter: ["==", ["get", "kind"], "river"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cssVar("--water"),
          "line-width": ["interpolate", ["exponential", 2], ["zoom"], 9, ["*", 4, ["get", "w"]], 14, ["*", 90, ["get", "w"]]] } });
      const note = document.createElement("div");
      note.className = "basemap-note"; note.textContent = Atlas.t("offlineBasemap");
      container.parentElement.appendChild(note);
    }
    return map;
  };

  /** Adds an HTML label (used for Khmer text, which MapLibre glyph rendering cannot shape). */
  Atlas.htmlLabel = (map, lngLat, text, anchor = "left") => {
    const el = document.createElement("div"); el.className = "map-label"; el.textContent = text;
    return new maplibregl.Marker({ element: el, anchor, offset: anchor === "left" ? [8, 0] : [0, 0] }).setLngLat(lngLat).addTo(map);
  };

  Atlas.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();
