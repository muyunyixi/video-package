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
# inside the 月白 letters, against where the ripple puts them. The ripple as cover/lines.tsx draws it: ring k
# is the line where the ring index u = k, u = (r + depth·λ(r)/2π·height·sin φ(r)) / spacing about the drop;
# a line found at a point is off its place by (u − round(u)) / |∇u| px. The parameters are the cover's
# (3:4: drop (540, 950), front 440; 4:3: drop (720, 800), front 1400, stilled behind the type by 0.75 over
# 160 px), or given after the two images as key=value (cy=, front=, decay=, calm=, calmsoft=).
if len(sys.argv) > 2:
    im2 = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(float)
    Y2 = 0.2126 * im2[..., 0] + 0.7152 * im2[..., 1] + 0.0722 * im2[..., 2]
    Hh = im.shape[0]
    P = dict(s=5.0, lam0=20.0, lamK=0.11, depth=0.72, r0=14.0, decay=0.0, calm=0.0, calmsoft=140.0)
    P.update(dict(cy=800.0, front=1400.0, calm=0.75, calmsoft=160.0) if W > Hh else dict(cy=950.0, front=440.0))
    for kv in sys.argv[3:]:
        k, v = kv.split("=")
        P[k] = float(v)
    cx, cy = W / 2, P["cy"]
    print("ripple model:", {k: P[k] for k in ("cy", "front", "decay", "calm", "calmsoft")}, "| drop measured at", (out["drop"]["cx"], out["drop"]["cy"]))
    bx = (min(out["title"]["left"], out["sub"]["left"]), max(out["title"]["right"], out["sub"]["right"]), out["title"]["top"], out["sub"]["bottom"])

    def smooth(a, b, x):
        t = np.clip((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    def u_at(X, Y):
        r = np.hypot(X - cx, Y - cy)
        amp = smooth(P["r0"], P["r0"] + 60, r) * (1 - smooth(P["front"] - 90, P["front"], r))
        if P["decay"] > 0:
            amp = amp * np.where(r > P["r0"] + 60, ((P["r0"] + 60) / np.maximum(r, 1e-9)) ** P["decay"], 1.0)
        dx = np.maximum(np.maximum(bx[0] - X, 0), X - bx[1]); dy = np.maximum(np.maximum(bx[2] - Y, 0), Y - bx[3])
        still = 1 - P["calm"] * (1 - smooth(0, P["calmsoft"], np.hypot(dx, dy)))
        ph = (2 * np.pi / P["lamK"]) * np.log(1 + P["lamK"] * r / P["lam0"])
        u = (r + P["depth"] * (P["lam0"] + P["lamK"] * r) / (2 * np.pi) * amp * still * np.sin(ph)) / P["s"]
        return np.where(r < P["front"], u, r / P["s"])

    def off(X, Y):
        u = u_at(X, Y)
        g = np.hypot((u_at(X + 0.05, Y) - u_at(X - 0.05, Y)) / 0.1, (u_at(X, Y + 0.05) - u_at(X, Y - 0.05)) / 0.1)
        return (u - np.round(u)) / g

    res = {"outside": [], "inside": []}
    for X in np.arange(CX - 389.75, CX + 390, 3.0):   # 150.25–930 on the 3:4 cover: across the title
        xd = int(X * 2); col = Y2[:, xd]
        for yd in range(240, 720):
            a, b, c = col[yd - 1], col[yd], col[yd + 1]
            den = a - 2 * b + c
            o = 0.5 * (a - c) / den if den else 0
            yy = (yd + 0.5 + o) / 2
            if b > a and b >= c and b > a + 3 and col[max(0, yd - 8):yd + 9].max() < 90:
                res["outside"].append(off(X, yy))
            if X < cx and b < a and b <= c and col[yd - 4] > 190 and col[yd + 4] > 190 and b < 150:
                res["inside"].append(off(X, yy))
    for k, d in res.items():
        d = np.array(d)
        print("rings", k, len(d), "mean %+.3f" % d.mean(), "p5..p95 %+.3f..%+.3f" % tuple(np.percentile(d, [5, 95])))

    def lines_along(profile):
        """light hairlines along a profile of the 2x image (device px), in cover px"""
        pk = []
        for j in range(2, len(profile) - 2):
            a, b, c = profile[j - 1], profile[j], profile[j + 1]
            if b > a and b >= c and b > profile[max(0, j - 4):j + 5].min() + 3:
                den = a - 2 * b + c
                pk.append((j + 0.5 + (0.5 * (a - c) / den if den else 0)) / 2)
        return np.array(pk)

    corner = max(np.hypot(x - cx, y - cy) for x in (0, W) for y in (0, Hh))
    if P["front"] < corner:
        # the ripple's extent (《文案撰写指南》9.3: the whole ripple in the frame, in the band under the type):
        # the light hairlines on the axis, above and below the drop. In still water ring k lies at r = 5k
        # (to ±0.05 px, as measured above); counted in from the still water, the outermost ring off its
        # place by more than 0.1 px marks the ripple's edge
        peaks = lines_along(Y2[:, int(round(cx * 2 - 0.5))])
        sub_bottom = out["sub"]["bottom"]
        edge = {}
        for side, sel in (("up", peaks[(peaks > sub_bottom + 4) & (peaks < cy - 15)]), ("down", peaks[peaks > cy + 15])):
            r = np.sort(np.abs(sel - cy))
            k = round(r[-1] / 5.0) - (len(r) - 1 - np.arange(len(r)))   # the outermost ring is in still water
            disp = r - 5.0 * k
            o = np.nonzero(np.abs(disp) > 0.1)[0]
            edge[side] = float(r[o[-1]]) if len(o) else 0.0
            beyond = disp[o[-1] + 1:] if len(o) else disp
            print(f"ripple {side}: {len(r)} lines, edge at r {edge[side]:.1f} (the {len(beyond)} rings beyond it off their place by {np.abs(beyond).max():.3f} px at most)")
        top, bottom = cy - edge["up"], cy + edge["down"]
        print(f"ripple from y {top:.1f} to {bottom:.1f}: {top - sub_bottom:.1f} px under the subtitle's ink, {Hh - bottom:.1f} px above the bottom edge")
    else:
        # the ripple fills the frame (《文案撰写指南》第 7 节, the 横版): how far apart the rings lie behind
        # the type — between the title and the subtitle, across the type's width — against the same distance
        # from the drop away from the type (left of the drop, on its own height)
        # (down a column the rings cross at a slant: each spacing is taken along the radius, Δy·|y − cy| / r)
        gap = []
        for X in np.arange(bx[0] + 0.25, bx[1], 3.0):
            pk = lines_along(Y2[:, int(X * 2)])
            pk = pk[(pk > out["title"]["bottom"] + 6) & (pk < out["sub"]["top"] - 6)]
            mid = (pk[1:] + pk[:-1]) / 2
            gap += list(np.diff(pk) * np.abs(mid - cy) / np.hypot(X - cx, mid - cy))
        gap = np.array(gap)
        rg = cy - (out["title"]["bottom"] + out["sub"]["top"]) / 2
        row = lines_along(Y2[int(cy * 2), :])
        away = np.diff(row[(row > cx - rg - 60) & (row < cx - rg + 60)])
        print(f"rings behind the type (between title and subtitle, r ≈ {rg:.0f}): {len(gap)} spacings, {gap.min():.2f}–{gap.max():.2f} px (p5–p95 {np.percentile(gap, 5):.2f}–{np.percentile(gap, 95):.2f})")
        print(f"rings at the same distance from the drop, away from the type: {away.min():.2f}–{away.max():.2f} px")
