# The visible blank between a glyph's cell and its ink, as the eye (and a 50% crossing) sees it: the
# glyph is rasterised at the film's size with 8x supersampling, set on its cell's axis as lib/ink sets
# 汇文明朝体 (ink centred in the em), and its column coverage is crossed at 50%. Tapered stroke ends
# (a 捺, a 点's tip) sit well inside the outline's bounds, so the outline's side bearing is not what
# shows. usage: python3 visible_blank.py SIZE_PX CHARS
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

size = float(sys.argv[1]); chars = sys.argv[2]
SS = 8
f = ImageFont.truetype("/home/claude/zxs/assets/huiwen.otf", int(round(size * SS)))
for ch in chars:
    W = int(size * 3) * SS
    im = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(im)
    d.text((size * SS, size * SS * 0.5), ch, font=f, fill=255)
    a = np.asarray(im).astype(float) / 255
    cols = np.nonzero(a.max(axis=0) > 0)[0]
    l, r = cols.min(), cols.max() + 1          # outline bounds (supersampled px)
    cx = (l + r) / 2                            # on its axis: this is the cell's centre
    cell_l, cell_r = cx - size * SS / 2, cx + size * SS / 2
    # downsample columns to film pixels around the cell, then the per-column max coverage
    def edge(side):
        # coverage of each film-pixel column = max over rows of the box-filtered coverage
        rows = a.reshape(a.shape[0] // SS, SS, a.shape[1]).mean(axis=1)  # rows to film px
        x0 = int(cell_l) - SS * 4
        n = (int(cell_r) + SS * 4 - x0) // SS
        prof = np.array([rows[:, x0 + k * SS : x0 + (k + 1) * SS].mean(axis=1).max() for k in range(n)])
        ink = prof.max()
        mid = ink / 2
        xs = range(n - 1) if side == "l" else range(n - 2, -1, -1)
        for k in xs:
            p, q = prof[k], prof[k + 1]
            if (p - mid) * (q - mid) <= 0 and p != q:
                xk = k + 0.5 + (mid - p) / (q - p)   # film px from x0
                return x0 / SS + xk
    el, er = edge("l"), edge("r")
    print(f"{ch}: visible blank left {el - cell_l / SS:.2f}, right {cell_r / SS - er:.2f}  (outline bearings {(l - cell_l) / SS:.2f}, {(cell_r - r) / SS:.2f})")
