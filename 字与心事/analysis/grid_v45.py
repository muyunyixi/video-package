"""v4.5 grid check: where the layout puts each character (lib/ink, recomputed here from the font table) and
where its ink is on the rendered frame.

usage: python3 grid_v45.py FRAME.jpg SPEC.json
SPEC: {"lines": ["击壤忽然成古史，", "人间灯火灿于星。"], "size": 80, "tracking": 10, "x": 960, "align": "center",
       "ys": [160, 268], "block": true, "gaps": {"0": {"2": 46}}, "scale": 1, "origin": [960, 432]}
  ys     the ink centre of each line (Line.y as the film sets it, before any page scale)
  block  the lines are one stackLines block (one grid); otherwise each line is aligned alone
  gaps   extra px before a glyph, per line (gapBefore)
  scale, origin  a page scale about an origin (the chat sheet: 1.2 about 960, 432)
Prints, for every glyph, its cell, its measured ink (left, right, centre) and the centre the layout gives
it (on the grid every character's ink centre is its cell's axis). Measured the way 《整体制作指南》8.3 says:
luminance; in each column the extreme pixel; the edge where it crosses 50% between the background and
the ink, pixel j sampled at j + 0.5; only the rows the glyph's own ink spans (from the font).
"""
import json
import re
import sys

import numpy as np
from PIL import Image

M = json.load(open("/home/claude/zxs/src/gen/hw_metrics.json"))
UPM, G = M["upm"], M["g"]
FULL = re.compile(r"[—…“”‘’·　-〿㐀-䶿一-鿿豈-﫿＀-｠￠-￦]")
OPEN = re.compile(r"[“‘（《〈「『【〔［｛]")
CLOSE = re.compile(r"[”’）》〉」』】〕］｝]")
MARK = re.compile(r"[　-〿＀-￯!-/:-@\[-`{-~“”‘’—…·]")


def ink(ch, size):
    m = G[ch]
    k = size / UPM
    if len(m) == 1:
        return dict(adv=m[0] * k, l=0, r=0, t=0, b=0)
    return dict(adv=m[0] * k, l=m[1] * k, r=m[3] * k, t=-m[4] * k, b=-m[2] * k)


def cell_of(ch, g, size):
    return size if (FULL.search(ch) or g["adv"] > 0.9 * size) else g["adv"]


def pen_in(ch, cell, g):
    if ch.strip() == "" or not FULL.search(ch):
        return (cell - g["adv"]) / 2
    if OPEN.search(ch):
        return cell - g["adv"]
    if CLOSE.search(ch):
        return 0
    return cell / 2 - (g["l"] + g["r"]) / 2


def line_ink(chars, size, gaps):
    x, xs, cells, boxL, boxR, inkT, inkB = 0, [], [], None, None, 1e9, -1e9
    for i, ch in enumerate(chars):
        x += gaps[i]
        g = ink(ch, size)
        c = cell_of(ch, g, size)
        p = x + pen_in(ch, c, g)
        xs.append(p)
        cells.append((x, x + c))
        if ch.strip():
            inkT, inkB = min(inkT, g["t"]), max(inkB, g["b"])
            edge = not MARK.search(ch)
            if boxL is None:
                boxL = x if edge else p + g["l"]
            boxR = x + c if edge else p + g["r"]
        x += c
    return dict(adv=x, xs=xs, cells=cells, boxL=boxL, boxR=boxR, inkT=inkT, inkB=inkB)


def layout(spec):
    size, tr, X, align = spec["size"], spec.get("tracking", 0), spec["x"], spec.get("align", "center")
    Ls = []
    for li, t in enumerate(spec["lines"]):
        extra = {int(k): v for k, v in spec.get("gaps", {}).get(str(li), {}).items()}
        gaps = [extra.get(i, 0) + (tr if i else 0) for i in range(len(t))]
        Ls.append((line_ink(list(t), size, gaps), gaps))
    if spec.get("block") and len(Ls) > 1:  # Poem.tsx stackLines
        cl = lambda L, gaps: gaps[0]
        x0 = [(-(cl(L, g) + L["adv"]) / 2 if align == "center" else 0 if align == "left" else -L["adv"]) for L, g in Ls]
        Lb = min(x + L["boxL"] for x, (L, _) in zip(x0, Ls))
        Rb = max(x + L["boxR"] for x, (L, _) in zip(x0, Ls))
        d = X - (Lb + Rb) / 2 if align == "center" else X - Lb if align == "left" else X - Rb
        return [(x + d, L) for x, (L, _) in zip(x0, Ls)]
    return [(X - (L["boxL"] + L["boxR"]) / 2 if align == "center" else X - L["boxL"] if align == "left" else X - L["boxR"], L) for L, _ in Ls]


def edges(Y, x_lo, x_hi, y_lo, y_hi):
    W = Y[y_lo:y_hi, x_lo:x_hi]
    lo, hi = np.percentile(W, 3), np.percentile(W, 97)
    dark_ink = np.median(W) > (lo + hi) / 2  # light page, dark ink
    P = (255 - W) if dark_ink else W
    bg, fg = np.percentile(P, 3), np.percentile(P, 99.5)
    T = (bg + fg) / 2
    col = P.max(0)
    on = np.where(col >= T)[0]
    if len(on) == 0:
        return None
    j = on[0]
    left = x_lo + j - 0.5 + (T - col[j - 1]) / (col[j] - col[j - 1]) if j > 0 else None
    j = on[-1]
    right = x_lo + j + 0.5 + (col[j] - T) / (col[j] - col[j + 1]) if j + 1 < len(col) else None
    return left, right


def main():
    frame, spec = sys.argv[1], json.load(open(sys.argv[2])) if not sys.argv[2].lstrip().startswith("{") else json.loads(sys.argv[2])
    rgb = np.asarray(Image.open(frame).convert("RGB")).astype(float)
    Y = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    S = spec.get("scale", 1.0)
    ox, oy = spec.get("origin", [960, 432])
    sx = lambda x: ox + (x - ox) * S
    sy = lambda y: oy + (y - oy) * S
    size = spec["size"]
    lay = layout(spec)
    # ys: the first line's ink centre; the others, when not given, stacked as stackLines does (baseline to
    # baseline `pitch`, default 1.35 × size)
    b0 = spec["ys"][0] - (lay[0][1]["inkT"] + lay[0][1]["inkB"]) / 2
    pitch = spec.get("pitch", 1.35 * size)
    bases = [spec["ys"][i] - (L["inkT"] + L["inkB"]) / 2 if i < len(spec["ys"]) else b0 + i * pitch for i, (_, L) in enumerate(lay)]
    for li, ((x0, L), base) in enumerate(zip(lay, bases)):
        print(f"line {li}: pen origin {sx(x0):.3f}")
        for k, ch in enumerate(spec["lines"][li]):
            if not ch.strip():
                continue
            g = ink(ch, size)
            cl, cr = L["cells"][k]
            want = sx(x0 + L["xs"][k] + (g["l"] + g["r"]) / 2)
            m = edges(Y, int(np.floor(sx(x0 + cl) - 4 * S)), int(np.ceil(sx(x0 + cr) + 4 * S)), int(np.floor(sy(base + g["t"]) - 1)), int(np.ceil(sy(base + g["b"]) + 1)))
            if m is None or None in m:
                print(f"   {ch} cell {sx(x0 + cl):8.2f}  (not measurable)")
                continue
            c = (m[0] + m[1]) / 2
            print(f"   {ch} cell {sx(x0 + cl):8.2f}  ink {m[0]:8.2f} … {m[1]:8.2f}  centre {c:8.2f}  layout {want:8.2f}  Δ {c - want:+.2f}")


if __name__ == "__main__":
    main()
