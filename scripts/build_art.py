"""Rebuild only Edu's runtime artwork; no app/logo dependencies."""
from pathlib import Path
import json
import re
import subprocess
import sys
ROOT = Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, "-I", str(ROOT / "art/mascot/src/check.py")], check=True)
art = {}
for source in sorted((ROOT / "art/mascot").glob("*.svg")):
    svg = re.sub(r"<\?xml[^>]*>|<!--.*?-->", "", source.read_text(), flags=re.S)
    svg = re.sub(r">\s+<", "><", svg.strip())
    art[source.stem] = re.sub(r"\s{2,}", " ", svg)
(ROOT / "assets/mascot-art.js").write_text("// Edu artwork and embedded SVG data: all rights reserved. See ARTWORK-RIGHTS.md.\n// Generated from art/mascot/*.svg by scripts/build_art.py.\nexport const ART = " + json.dumps(art, indent=2) + ";\n")
subprocess.run([sys.executable, str(ROOT / "scripts/sync_skill.py")], check=True)
