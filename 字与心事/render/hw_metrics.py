#!/usr/bin/env python3
"""汇文明朝体's exact metrics, read from the font file, for lib/ink (v4.5).

The browser's measureText rounds a glyph's ink box out to whole pixels (掂 at 80 px: 4 … 77, where
its outline runs from 4.53 to 76.33), so a character centred in its cell by that box can sit up to
half a pixel off. This table holds, for every character the film's source contains (its texts and the
listing of the code coda alike), the advance and the outline's bounds in font units (1 em = 1024), so
glyphInk can scale them to any size exactly. run by render/build.mjs before every bundle.
"""
import json
import os
import re
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets", "huiwen.otf")
OUT = os.path.join(ROOT, "src", "gen", "hw_metrics.json")


def chars_in_source():
    seen = set()
    for base in ("src", "cover"):
        for d, _, files in os.walk(os.path.join(ROOT, base)):
            if os.path.relpath(d, ROOT).startswith(os.path.join("src", "gen")):
                continue
            for fn in files:
                if fn.endswith((".ts", ".tsx", ".json")):
                    with open(os.path.join(d, fn), encoding="utf8") as fh:
                        seen.update(fh.read())
    return sorted(c for c in seen if c >= " " and c != "\x7f")


def main():
    font = TTFont(FONT)
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    table = {}
    for ch in chars_in_source():
        name = cmap.get(ord(ch))
        if name is None:
            continue  # not in the font: the browser falls back to another, and glyphInk measures that
        adv = hmtx[name][0]
        pen = BoundsPen(gs)
        gs[name].draw(pen)
        b = pen.bounds
        table[ch] = [adv] if b is None else [adv, *(round(v, 3) for v in b)]  # adv, xMin, yMin, xMax, yMax
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    text = json.dumps({"upm": upm, "g": table}, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    old = open(OUT, encoding="utf8").read() if os.path.exists(OUT) else None
    if old != text:  # only rewrite when changed (keeps rebuilds stable)
        with open(OUT, "w", encoding="utf8") as fh:
            fh.write(text)
    print(f"hw metrics: {len(table)} glyphs", file=sys.stderr)


if __name__ == "__main__":
    main()
