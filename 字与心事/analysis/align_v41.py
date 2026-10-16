# v4.1 alignment check at the history's scale (frame at CHAT_S = 1.2): his bubble, the unsent half
# and the receipt under it, all right-aligned on the bubble's edge by their last character's cell.
# usage: python3 align_v41.py FRAME.jpg
# Positions are measured the way 《整体制作指南》8.3 says: luminance, pixel j sampled at j + 0.5,
# the edge where the profile crosses 50% between the two sides. The cells are not visible: the ink's
# edge is measured, and the cell's edge is the ink's plus the glyph's side bearing at that size (from
# the font files, fontTools).
import sys
import numpy as np
from PIL import Image
from fontTools.ttLib import TTFont, TTCollection

S, TX, TY = 1.2, 960 * (1 - 1.2), 432 * (1 - 1.2)  # sheet -> screen
scr_x = lambda x: TX + S * x
scr_y = lambda y: TY + S * y

def glyph_box(font, ch):
    cmap = font.getBestCmap()
    g = cmap[ord(ch)]
    gs = font.getGlyphSet()
    from fontTools.pens.boundsPen import BoundsPen
    bp = BoundsPen(gs)
    gs[g].draw(bp)
    xmin, ymin, xmax, ymax = bp.bounds
    adv = font["hmtx"][g][0]
    return adv, xmin, xmax, font["head"].unitsPerEm

hw = TTFont("/home/claude/zxs/assets/huiwen.otf")
def sc_face(path):
    for f in TTCollection(path).fonts:
        if any("Noto Serif CJK SC" in (n.toUnicode() if hasattr(n, "toUnicode") else str(n)) for n in f["name"].names if n.nameID in (1, 4)):
            return f
    raise SystemExit("no SC face in " + path)
serif_sb = sc_face("/usr/share/fonts/opentype/noto/NotoSerifCJK-SemiBold.ttc")

def hw_margins(ch, size):
    """汇文明朝体 on its axis: the ink centred in the em cell; returns (left, right) blank in px"""
    adv, xmin, xmax, upm = glyph_box(hw, ch)
    w = (xmax - xmin) * size / upm
    return (size - w) / 2, (size - w) / 2

def rsb(font, ch, size):
    adv, xmin, xmax, upm = glyph_box(font, ch)
    return (adv - xmax) * size / upm

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
Y = 0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]
RG = im[..., 0] - im[..., 1]

def cross(profile, x0, inside, outside):
    """first x >= x0 where the profile goes from `inside` level to `outside` level, at 50%"""
    mid = (inside + outside) / 2
    for x in range(x0, len(profile) - 1):
        a, b = profile[x], profile[x + 1]
        if (a - mid) * (b - mid) <= 0 and a != b:
            return x + 0.5 + (mid - a) / (b - a)
    return None

# the bubble's right and left edges, on rows below the text where its sides are straight
# (sheet y 286–294; the text's ink ends at 282, the corners' rounding below 298 on the right, 280 on
# the left — so the left edge is taken through the text rows, scanning only its padding)
yb = int(round(scr_y(290)))
rg = RG[yb - 3 : yb + 4].mean(axis=0)
inside = np.median(rg[1400:1460]); outside = np.median(rg[1520:1600])
bub_r = cross(rg, 1455, inside, outside)
yl = int(round(scr_y(259)))
rgl = RG[yl - 2 : yl + 3].mean(axis=0)
rg_rev = rgl[::-1]
bub_l = len(rgl) - cross(rg_rev, len(rgl) - 780, np.median(rgl[760:780]), np.median(rgl[650:720]))
print(f"bubble: left {bub_l:.2f}  right {bub_r:.2f}  (expected right {scr_x(1400):.2f})")

def ink_right(rows, xa, xb, dark, bgx=None):
    """the right edge of a line's ink between xa and xb: column profile of the darkest (dark=True) or
    lightest pixel in the rows, 50% between the ink level and the background just beyond it (bgx: the
    columns to take the background from; by default the 40 after xb)"""
    band = Y[rows[0] : rows[1]]
    prof = band.min(axis=0) if dark else band.max(axis=0)
    seg = prof[xa:xb]
    ink = np.percentile(seg, 3 if dark else 97)
    bg = np.median(prof[bgx[0] : bgx[1]] if bgx else prof[xb : xb + 40])
    # last crossing scanning from the right
    mid = (ink + bg) / 2
    for x in range(xb, xa, -1):
        a, b = prof[x - 1], prof[x]
        if (a - mid) * (b - mid) <= 0 and a != b:
            return x - 0.5 + (mid - a) / (b - a)
    return None

# 尖 (light on red): its ink right edge, and its cell's
r_jian = ink_right((int(scr_y(214 + 10)), int(scr_y(214 + 80))), int(scr_x(1300)), int(bub_r) - 8, dark=False, bgx=(int(bub_r) - 30, int(bub_r) - 8))
mj = hw_margins("尖", 46 * S)[1]
print(f"尖: ink right {r_jian:.2f}, cell right {r_jian + mj:.2f} (blank {mj:.2f}); bubble right - cell = {bub_r - (r_jian + mj):.2f} (padding expected {32 * S:.2f})")
# 掂: ink left (scan from the left)
band = Y[int(scr_y(214 + 10)) : int(scr_y(214 + 80))].max(axis=0)
xa = int(scr_x(800)); seg = band[xa : xa + 80]
ink = np.percentile(seg, 97); bgl = np.median(band[int(bub_l) + 8 : int(bub_l) + 30]); mid = (ink + bgl) / 2
for x in range(int(bub_l) + 8, xa + 80):
    a, b = band[x], band[x + 1]
    if (a - mid) * (b - mid) <= 0 and a != b:
        l_dian = x + 0.5 + (mid - a) / (b - a); break
ml = hw_margins("掂", 46 * S)[0]
print(f"掂: ink left {l_dian:.2f}, cell left {l_dian - ml:.2f} (blank {ml:.2f}); cell - bubble left = {(l_dian - ml) - bub_l:.2f} (padding expected {32 * S:.2f})")

# 辕 (the unsent half, pale vermilion on paper)
r_yuan = ink_right((int(scr_y(352 - 26)), int(scr_y(352 + 26))), int(scr_x(1300)), int(scr_x(1405)), dark=True)
my = hw_margins("辕", 46 * S)[1]
print(f"辕: ink right {r_yuan:.2f}, cell right {r_yuan + my:.2f} (blank {my:.2f}); vs bubble right {r_yuan + my - bub_r:+.2f}")

# 懂 (receipt, Noto Serif CJK SC SemiBold 27 px on the sheet)
r_dong = ink_right((int(scr_y(404 - 18)), int(scr_y(404 + 18))), int(scr_x(1330)), int(scr_x(1405)), dark=True)
md = rsb(serif_sb, "懂", 27 * S)
print(f"懂: ink right {r_dong:.2f}, cell right {r_dong + md:.2f} (right side bearing {md:.2f}); vs bubble right {r_dong + md - bub_r:+.2f}")
