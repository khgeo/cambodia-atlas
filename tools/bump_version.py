#!/usr/bin/env python3
"""Update cache-busting tokens for the static, no-build-step atlas."""
from pathlib import Path
from datetime import datetime, timezone
import re

ROOT = Path(__file__).resolve().parents[1]
version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
core = ROOT / "shared" / "atlas.js"
text = core.read_text(encoding="utf-8")
updated, count = re.subn(r'Atlas\.version = "[^"]+";', f'Atlas.version = "{version}";', text, count=1)
if count != 1:
    raise SystemExit('Could not find Atlas.version in shared/atlas.js; no files changed.')
core.write_text(updated, encoding="utf-8")

# Static resources referenced directly by HTML need their own version query too.
assets = ["shared/atlas.css", "shared/vendor/maplibre-gl.css", "shared/vendor/maplibre-gl-swipe.css", "shared/vendor/libs.mjs", "shared/atlas.js"]
for name in ("index.html", "page.html", "explorer.html"):
    path = ROOT / name
    html = path.read_text(encoding="utf-8")
    for asset in assets:
        html = re.sub(re.escape(asset) + r'(?:\?v=[^"\']*)?', asset + "?v=" + version, html)
    path.write_text(html, encoding="utf-8")
print(f"Cambodia Atlas cache version set to {version}")
print("Dynamic JSON, reading fragments and plate modules use this version automatically.")
