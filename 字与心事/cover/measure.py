"""Measures the cover's type on the exported PNG (《文案撰写指南》第 12 节: what is visible, not the code's
coordinates), as 《整体制作指南》8.3 measures the film: luminance Y; pixel j is the sample at j + 0.5; an
edge is where the profile (the brightest pixel across the other direction) crosses halfway between the
background and the glyph's own full value, interpolated between pixel centres.
usage: python3 cover/measure.py out/cover/final/clock.png"""
import sys
import numpy as np
from PIL import Image

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
Y = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
RG = im[..., 0] - im[..., 1]  # vermilion stands out from the warm white here


def crossing(p, level, from_start=True):
    """sub-pixel position where profile p first rises through level, from its start (or its end)"""
    idx = range(len(p)) if from_start else range(len(p) - 1, -1, -1)
    prev = None
    for j in idx:
        if p[j] >= level:
            if prev is None:
                return float(j)
            a, b = p[prev], p[j]
            t = (level - a) / (b - a)
            c0, c1 = prev + 0.5, j + 0.5
            return c0 + t * (c1 - c0)
        prev = j
    return None


def box(y0, y1, x0, x1, core, bg):
    sub = Y[y0:y1, x0:x1]
    lev = (bg + core) / 2
    rows, cols = sub.max(axis=1), sub.max(axis=0)
    return (y0 + crossing(rows, lev), y0 + crossing(rows, lev, False),
            x0 + crossing(cols, lev), x0 + crossing(cols, lev, False))


bg = float(np.median(Y[150:350, 20:100]))
# the characters: split the title band by columns that hold no ink
band = Y[120:380]
inkcols = np.where((band > (bg + 120) / 2).any(axis=0))[0]
groups, s, p = [], inkcols[0], inkcols[0]
for c in inkcols[1:]:
    if c - p > 20:
        groups.append((s, p + 1))
        s = c
    p = c
groups.append((s, p + 1))
out = {"bg": round(bg, 1), "chars": []}
for (a, b), ch in zip(groups, "字与心事"):
    core = float(np.percentile(band[:, a:b], 99.5))  # the glyph's own full value
    t, bt, l, r = box(120, 380, a - 6, b + 6, core, bg)
    out["chars"].append((ch, round(t, 1), round(bt, 1), round(l, 1), round(r, 1), round(core)))
T = min(c[1] for c in out["chars"]); B = max(c[2] for c in out["chars"])
L = out["chars"][0][3]; R = out["chars"][-1][4]
out["title"] = dict(top=T, bottom=B, left=L, right=R, width=round(R - L, 1), height=round(B - T, 1), mid=round((L + R) / 2, 2),
                    gaps=[round(out["chars"][i + 1][3] - out["chars"][i][4], 1) for i in range(3)])
# the subtitle: the band under the title
sb = Y[B.__int__() + 20: B.__int__() + 150]
core = float(np.percentile(sb, 99.7))
t, bt, l, r = box(int(B) + 20, int(B) + 150, 100, 980, core, bg)
out["sub"] = dict(top=round(t, 1), bottom=round(bt, 1), left=round(l, 1), right=round(r, 1), width=round(r - l, 1), mid=round((l + r) / 2, 2), core=round(core))
# the rule: vermilion, under the subtitle
ys, xs = np.where(RG[int(bt):int(bt) + 80, 300:780] > 60)
y0, y1, x0, x1 = int(bt) + ys.min() - 3, int(bt) + ys.max() + 4, 300 + xs.min() - 3, 300 + xs.max() + 4
seg = RG[y0:y1, x0:x1]
lev = (float(np.median(RG[y0 - 10:y0 - 4, x0:x1])) + float(seg.max())) / 2
rows, cols = seg.max(axis=1), seg.max(axis=0)
rt, rb = y0 + crossing(rows, lev), y0 + crossing(rows, lev, False)
rl, rr = x0 + crossing(cols, lev), x0 + crossing(cols, lev, False)
out["rule"] = dict(top=round(rt, 1), bottom=round(rb, 1), left=round(rl, 1), right=round(rr, 1), width=round(rr - rl, 1), height=round(rb - rt, 1), mid=round((rl + rr) / 2, 2))
for k, v in out.items():
    print(k, v)
