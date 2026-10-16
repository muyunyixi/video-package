# v4.1: the HUD's three lines right-aligned on one line (screen x 1824) by their last character's cell
# (the seal by its box). Measures each line's ink right edge (50% crossing, luminance) and adds the
# glyph's right side bearing at its size (fontTools) to get the cell's edge.
# usage: python3 hud_v41.py FRAME.jpg [light|dark]
import sys
import numpy as np
from PIL import Image
from fontTools.ttLib import TTCollection
from fontTools.pens.boundsPen import BoundsPen

def sc_face(path):
    for f in TTCollection(path).fonts:
        if any("Noto Serif CJK SC" in n.toUnicode() for n in f["name"].names if n.nameID in (1, 4)):
            return f

reg = sc_face("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc")
def rsb(font, ch, size):
    g = font.getBestCmap()[ord(ch)]
    gs = font.getGlyphSet(); bp = BoundsPen(gs); gs[g].draw(bp)
    return (font["hmtx"][g][0] - bp.bounds[2]) * size / font["head"].unitsPerEm

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
Y = 0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]
RG = im[..., 0] - im[..., 1]
dark_ink = (sys.argv[2] if len(sys.argv) > 2 else "light") == "light"  # light scene: dark ink

def right_edge(prof, xa, xb, ink, bg):
    mid = (ink + bg) / 2
    for x in range(xb, xa, -1):
        a, b = prof[x - 1], prof[x]
        if (a - mid) * (b - mid) <= 0 and a != b:
            return x - 0.5 + (mid - a) / (b - a)

# the seal: its red box, rows through its middle
rows = RG[55:82]
p = rows.mean(axis=0)
seal = right_edge(p, 1780, 1860, np.median(p[1790:1815]), np.median(p[1835:1860]))
print(f"seal box right {seal:.2f}")
for name, (y0, y1, ch, size) in {"已读懂": (96, 124, "懂", 23), "km": (136, 160, "m", 23)}.items():
    band = Y[y0:y1]
    prof = band.min(axis=0) if dark_ink else band.max(axis=0)
    seg = prof[1760:1830]
    ink = np.percentile(seg, 2 if dark_ink else 98)
    bg = np.median(prof[1830:1860])
    e = right_edge(prof, 1760, 1835, ink, bg)
    b = rsb(reg, ch, size)
    print(f"{name}: ink right {e:.2f} + side bearing {b:.2f} = cell right {e + b:.2f}")
