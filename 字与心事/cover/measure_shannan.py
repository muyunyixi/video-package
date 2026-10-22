"""「山南海北」 cover: the type's ink measured on the exported PNG (《文案撰写指南》8.3: 50 % crossings, sub-pixel),
and the sky's lines inside the title against the lines outside it (they are the same lines: 6 px apart,
centred on y = 6k + 3). usage: python3 cover/measure_shannan.py COVER.png"""
import sys
import numpy as np
from PIL import Image

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
H, W = im.shape[:2]
L = im.mean(axis=2)
RG = im[..., 0] - im[..., 1]


def edges(profile, lo, hi):
    """first and last 50 % crossings of a profile between its background lo and full value hi"""
    mid = (lo + hi) / 2
    idx = np.nonzero(profile >= mid)[0]
    a, b = idx[0], idx[-1]
    fa = a - 1 + (mid - profile[a - 1]) / (profile[a] - profile[a - 1])
    fb = b + (profile[b] - mid) / (profile[b] - profile[b + 1])
    return fa + 0.5, fb + 0.5


def ink(y0, y1, x0, x1, chan):
    reg = chan[y0:y1, x0:x1]
    bg = np.median(chan[y0:y1, max(0, x0 - 40):x0])
    full = np.percentile(reg, 99.5)
    t, b = edges(reg.max(axis=1), bg, full)
    l, r = edges(reg.max(axis=0), bg, full)
    return y0 + t, y0 + b, x0 + l, x0 + r


cx = W / 2
# the title: 字与 are moon-white (luminance), 心事 vermilion (R − G, the lines are white: R − G ≈ 0)
tw = ink(140, 360, int(cx - 400), int(cx), L)
tr = ink(140, 360, int(cx), int(cx + 400), RG)
print("title  字与 ink y %.2f–%.2f x %.2f–%.2f" % tw)
print("title  心事 ink y %.2f–%.2f x %.2f–%.2f" % tr)
print("title  ink top %.2f bottom %.2f left %.2f right %.2f (centre %.2f, picture centre %.1f)" % (min(tw[0], tr[0]), max(tw[1], tr[1]), tw[2], tr[3], (tw[2] + tr[3]) / 2, cx))
s = ink(380, 480, int(cx - 400), int(cx + 400), L)
print("subtitle ink y %.2f–%.2f x %.2f–%.2f, gap to the title %.2f" % (s + (s[0] - max(tw[1], tr[1]),)))
# the lines: centres of the light lines in the sky beside the title, and of the dark lines in 字 and 事
def centres(col_x0, col_x1, y0, y1, dark):
    p = L[y0:y1, col_x0:col_x1].mean(axis=1)
    p = (p.max() - p) if dark else (p - p.min())
    out = []
    for i in range(1, len(p) - 1):
        if p[i] >= p[i - 1] and p[i] > p[i + 1] and p[i] > 0.5 * p.max():
            a, b, c = p[i - 1], p[i], p[i + 1]
            out.append(y0 + i + 0.5 + 0.5 * (a - c) / (a - 2 * b + c))
    return np.array(out)
sky = centres(40, 120, 180, 320, dark=False)
inside = centres(int(tw[2]) + 20, int(tw[2]) + 34, 196, 214, dark=True)
print("sky lines (y):", np.round(sky[:6], 2), "… offset from 6k + 3:", np.round(((sky - 3) / 6 - np.round((sky - 3) / 6)) * 6, 2)[:6])
print("dark lines in 字 (y):", np.round(inside, 2), "offset from 6k + 3:", np.round(((inside - 3) / 6 - np.round((inside - 3) / 6)) * 6, 2))
