"""Encode browser-captured PNG frames. Usage: python3 scripts/make_gif.py /path/to/frames

Requires Pillow. Capture docs/record.html at Frame 0..29, crop (0, 0, 1000, 440),
and name frames 000.png..029.png. Uses the actual mascot runtime wave timeline.
"""
from pathlib import Path
import sys
from PIL import Image
root = Path(__file__).resolve().parent.parent
paths = sorted(Path(sys.argv[1]).glob('[0-9][0-9][0-9].png'))
if len(paths) < 2:
    sys.exit('Need at least two numbered PNG frames.')
frames = [Image.open(p).convert('RGB').resize((880, 387), Image.Resampling.LANCZOS) for p in paths]
# One shared palette keeps the stationary background from flickering.
atlas = Image.new('RGB', (880, 387 * 3))
for i, index in enumerate([0, len(frames)//2, len(frames)-1]):
    atlas.paste(frames[index], (0, 387*i))
palette = atlas.quantize(colors=256)
indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
indexed[0].save(root / 'docs/edu.gif', save_all=True, append_images=indexed[1:],
                duration=[80]*(len(indexed)-1)+[1000], loop=0, optimize=True, disposal=1)
print(f'GIF: {(root / "docs/edu.gif").stat().st_size:,} bytes')
