"""Audit drawings and ensure the portable skill cannot silently drift."""
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, "-I", str(ROOT / "art/mascot/src/check.py")], check=True)
for source in sorted((ROOT / "assets").iterdir()):
    if source.is_file():
        target = ROOT / "skills/edu-mascot/assets" / source.name
        if not target.exists() or target.read_bytes() != source.read_bytes():
            sys.exit(f"Skill drift: {source.name}. Run scripts/sync_skill.py")
if (ROOT / "docs/integration.md").read_bytes() != (ROOT / "skills/edu-mascot/references/integration.md").read_bytes():
    sys.exit("Skill guide drift. Run scripts/sync_skill.py")
print("Skill copies match canonical files.")
