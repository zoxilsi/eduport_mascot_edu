"""Refresh the self-contained agent skill from canonical runtime and docs."""
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "skills/edu-mascot"
for source in sorted((ROOT / "assets").iterdir()):
    if source.is_file():
        shutil.copy2(source, DEST / "assets" / source.name)
shutil.copy2(ROOT / "docs/integration.md", DEST / "references/integration.md")
for name in ("LICENSE", "ARTWORK-RIGHTS.md"):
    shutil.copy2(ROOT / name, DEST / name)
print("Skill assets, integration reference and licensing notices synchronized.")
