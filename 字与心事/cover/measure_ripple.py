"""Measures the 涟漪 cover on the exported PNG (《文案撰写指南》第 12 节: what is visible, not the code's
coordinates), as 《整体制作指南》8.3 measures the film: pixel j is the sample at j + 0.5; an edge is where
the profile (the extreme pixel across the other direction) crosses halfway between the ground and the
glyph's own full value, interpolated between pixel centres. On this cover the ground carries hairlines, so
each signal is chosen to leave them out: 月白 letters and the subtitle by luminance (the hairlines reach
about a quarter of the letters' value near the type), the vermilion letters and the drop by R − G (the
hairlines are 月白, R − G ≈ 0).
Also: where the rings run, outside the letters and through them (the radius of each ring is k × spacing
about the drop), and the ripple's extent.
usage: python3 cover/measure_ripple.py out/cover/ripple/字与心事_封面.png [the 2x render for the rings]"""
import sys
import numpy as np
from PIL import Image

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
Y = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
RG = im[..., 0] - im[..., 1]


def crossing(p, level, from_start=True):
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


def box(S, y0, y1, x0, x1, bg):
    sub = S[y0:y1, x0:x1]
    core = float(np.percentile(sub, 99.7))
    lev = (bg + core) / 2
    rows, cols = sub.max(axis=1), sub.max(axis=0)
    return dict(top=round(y0 + crossing(rows, lev), 2), bottom=round(y0 + crossing(rows, lev, False), 2),
                left=round(x0 + crossing(cols, lev), 2), right=round(x0 + crossing(cols, lev, False), 2), core=round(core, 1))


out = {}
W = im.shape[1]
CX = W / 2   # the axis: 540 on the 3:4 cover, 720 on the 4:3
bgY = float(np.median(Y[60:110, int(CX) - 240:int(CX) + 240]))   # the ground above the title, hairlines and all
bgR = float(np.median(RG[60:110, int(CX) - 240:int(CX) + 240]))
out["ground"] = dict(Y=round(bgY, 1), RG=round(bgR, 1))
# the four letters, each looked for in its own cell (178 px, 20 px between cells, the row centred on
# the axis: 《文案撰写指南》8.3) widened by 10 px: 心 is four separate strokes, so gaps between columns of
# ink do not mark the letters
cells = [(CX - 386 + i * 198, CX - 386 + i * 198 + 178) for i in range(4)]
chars = []
for (a, b), ch in zip(cells, "字与心事"):
    S, bg = (Y, bgY) if ch in "字与" else (RG, bgR)
    bx = box(S, 130, 360, int(a) - 10, int(b) + 10, bg)
    chars.append((ch, bx))
out["chars"] = chars
T = min(c[1]["top"] for c in chars); B = max(c[1]["bottom"] for c in chars)
L = chars[0][1]["left"]; R = chars[-1][1]["right"]
out["title"] = dict(top=T, bottom=B, height=round(B - T, 2), left=L, right=R, width=round(R - L, 2), mid=round((L + R) / 2, 2),
                    gaps=[round(chars[i + 1][1]["left"] - chars[i][1]["right"], 2) for i in range(3)])
sb = box(Y, int(B) + 20, int(B) + 150, 100, W - 100, bgY)
out["sub"] = dict(sb, width=round(sb["right"] - sb["left"], 2), mid=round((sb["left"] + sb["right"]) / 2, 2), gap_to_title=round(sb["top"] - B, 2))
# the drop: the vermilion below the type (the rings near it are tinted far less), its centroid and extent
ys, xs = np.nonzero(RG[500:, :] > 60)
w = RG[500:, :][ys, xs] - bgR
dx, dy = 0.5 + (xs * w).sum() / w.sum(), 500 + 0.5 + (ys * w).sum() / w.sum()
out["drop"] = dict(cx=round(dx, 2), cy=round(dy, 2), d=box(RG, int(dy) - 50, int(dy) + 50, int(dx) - 50, int(dx) + 50, bgR))
for k, v in out.items():
    print(k, v)


# the grid (《字体处理规范》三 1–2, 5): every character in a 1 em cell, its ink centred on the cell's axis,
# the row centred on the axis by its cells' outer edges. Each character's ink measured in its own cell
# (widened by 8 px), against the axis the layout gives it
def grid(text, size, track, y0, y1, red=lambda i: False):
    tr = round(size * track)
    n = len(text)
    width = n * size + (n - 1) * tr
    x0 = CX - width / 2
    print(f"grid {text}: {size} px cells, {tr} px between, cells {x0:.2f}–{x0 + width:.2f} (centre {x0 + width / 2:.2f})")
    worst = 0
    for i, ch in enumerate(text):
        cl = x0 + i * (size + tr)
        S, bg = (RG, bgR) if red(i) else (Y, bgY)
        bx = box(S, y0, y1, int(cl) - 8, int(cl + size) + 8, bg)
        c = (bx["left"] + bx["right"]) / 2
        worst = max(worst, abs(c - (cl + size / 2)))
        print(f"   {ch} axis {cl + size / 2:7.2f}  ink {bx['left']:7.2f}–{bx['right']:7.2f}  centre {c:7.2f}  Δ {c - (cl + size / 2):+.2f}")
    print(f"   max |Δ| {worst:.2f}")


grid("字与心事", 178, 36 / 320, 150, 345, red=lambda i: i >= 2)
grid("从落笔，到有人读懂", 60, 34 / 120, int(B) + 60, int(B) + 132)

# the rings, on the 2x render: positions of the light hairlines above the title and of the dark hairlines
# inside the 月白 letters, against r = k × spacing about the drop
if len(sys.argv) > 2:
    im2 = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(float)
    Y2 = 0.2126 * im2[..., 0] + 0.7152 * im2[..., 1] + 0.0722 * im2[..., 2]
    cx, cy, sp = out["drop"]["cx"], out["drop"]["cy"], 5.0
    def pred(x, y):
        r = np.hypot(x - cx, y - cy); k = round(r / sp)
        return cy - np.sqrt((k * sp) ** 2 - (x - cx) ** 2)
    res = {"outside": [], "inside": []}
    for X in np.arange(150.25, 930, 3.0):
        xd = int(X * 2); col = Y2[:, xd]
        for yd in range(240, 720):
            a, b, c = col[yd - 1], col[yd], col[yd + 1]
            den = a - 2 * b + c
            off = 0.5 * (a - c) / den if den else 0
            yy = (yd + 0.5 + off) / 2
            if b > a and b >= c and b > a + 3 and col[max(0, yd - 8):yd + 9].max() < 90:
                res["outside"].append(yy - pred(X, yy))
            if X < cx and b < a and b <= c and col[yd - 4] > 190 and col[yd + 4] > 190 and b < 150:
                res["inside"].append(yy - pred(X, yy))
    for k, d in res.items():
        d = np.array(d)
        print("rings", k, len(d), "mean %+.3f" % d.mean(), "p5..p95 %+.3f..%+.3f" % tuple(np.percentile(d, [5, 95])))
