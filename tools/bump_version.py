"""
Stamp a new version on the atlas's own CSS/JS links so browsers fetch fresh copies after an update.

GitHub Pages lets browsers cache files for about 10 minutes. Without a version stamp, a visitor can get a
new page.html together with an old cached atlas.js, and the plate fails to load. Run this before each upload:

  python3 tools/bump_version.py            # stamps today's date and time, e.g. 20261011-0430
"""
import datetime, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
v = datetime.datetime.now().strftime("%Y%m%d-%H%M")
pat = re.compile(r'((?:href|src)="shared/(?:atlas\.(?:js|css)|vendor/[\w.-]+\.(?:mjs|css)))(?:\?v=[\w-]+)?"')
for name in ("index.html", "page.html", "explorer.html"):
    p = os.path.join(ROOT, name)
    s = open(p, encoding="utf-8").read()
    s2 = pat.sub(lambda m: f'{m.group(1)}?v={v}"', s)
    s2 = re.sub(r'<meta name="atlas-version" content="[\w-]*">', f'<meta name="atlas-version" content="{v}">', s2)
    open(p, "w", encoding="utf-8").write(s2)
print("atlas version", v)
