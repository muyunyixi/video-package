# v4.1 search box check (the history's search, at the chat's scale): is the magnifier, by its whole box
# (handle and all), and the picked 月, by its ink, on the box's middle line (《整体制作指南》8.1)? And,
# while the pinyin is typed, does the cursor stand right after the last letter (8.1, the cursor rule)?
# Edges are 50% crossings of luminance, pixel j sampled at j + 0.5 (8.3).
# usage: python3 search_v41.py FRAME_WITH_月.jpg [FRAME_WITH_PINYIN.jpg]
import sys
import numpy as np
from PIL import Image


def lum(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(float)
    return 0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]


def crossing(prof, i0, i1, mid):
    """first 50% crossing walking from i0 towards i1 (sub-pixel)"""
    step = 1 if i1 > i0 else -1
    for i in range(i0, i1, step):
        a, b = prof[i], prof[i + step]
        if (a - mid) * (b - mid) <= 0 and a != b:
            t = (mid - a) / (b - a)
            return i + 0.5 + step * t
    return None


Y = lum(sys.argv[1])
H, W = Y.shape
# the box: a light pill over the darker page near the top; find its rows in a column through it
cols = [x for x in range(300, W - 300, 4) if Y[100:160, x].mean() > 235]
x_mid = int(np.median(cols)) if cols else W // 2
prof = Y[40:220, x_mid]
page = np.median(Y[40:60, x_mid])
inside = np.median(Y[115:140, x_mid])
mid = (page + inside) / 2
top = 40 + crossing(prof, 0, 90, mid)
bot = 40 + crossing(prof, len(prof) - 1, 90, mid)
print(f"box rows {top:.1f}–{bot:.1f}, middle {(top + bot) / 2:.2f} (column {x_mid})")
box_mid = (top + bot) / 2


def ink_rows(x0, x1, dark=True, red=False):
    """the ink's top and bottom (50% crossings) of a glyph inside the box, between columns x0 and x1"""
    band = Y[int(top) + 4:int(bot) - 4, x0:x1]
    prof = band.min(axis=1)
    bg = np.percentile(band, 90)
    ink = prof.min()
    m = (bg + ink) / 2
    n = len(prof)
    t = crossing(prof, 0, n - 1, m)
    b = crossing(prof, n - 1, 0, m)
    return int(top) + 4 + t, int(top) + 4 + b


# find the magnifier and the glyph: dark columns inside the box, left to right
row = Y[int(top) + 6:int(bot) - 6].min(axis=0)
dark = np.where(row < np.percentile(row, 50) - 40)[0]
groups = np.split(dark, np.where(np.diff(dark) > 6)[0] + 1) if len(dark) else []
groups = [g for g in groups if len(g) > 4]
for name, g in zip(("magnifier", "月"), groups[:2]):
    t, b = ink_rows(g[0] - 2, g[-1] + 3)
    print(f"{name}: columns {g[0]}–{g[-1]}, ink {t:.1f}–{b:.1f}, middle {(t + b) / 2:.2f} ({(t + b) / 2 - box_mid:+.2f} px from the box's)")

if len(sys.argv) > 2:
    Y = lum(sys.argv[2])
    # the cursor: the vermilion bar right of the pinyin; the pinyin's last letter: the dark ink before it
    im = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(float)
    red = (im[..., 0] - im[..., 1])[int(top) + 6:int(bot) - 6]
    rc = np.where(red.max(axis=0) > 60)[0]
    rc = rc[rc > 200]
    if len(rc):
        cl = rc[0]
        prof = red.max(axis=0)
        cur_l = crossing(prof, cl - 4, cl + 4, prof[cl:cl + 3].max() / 2)
        # the letters' own rows: the pinyin's underline runs on under the last letter, so keep above it
        rows = slice(int(top) + 10, int(top) + 38)
        lr = Y[rows, :cl - 1].min(axis=0)
        bg = np.percentile(Y[rows, cl - 40:cl - 1], 95)
        ink = lr[cl - 30:cl - 1].min()
        ink_r = crossing(lr, cl - 2, cl - 30, (ink + bg) / 2)
        print(f"cursor left edge {cur_l:.2f}; last letter's ink right edge {ink_r:.2f}; gap {cur_l - ink_r:.2f} px")
