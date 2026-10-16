#!/usr/bin/env python3
"""网格排字工具（《字体处理规范》第三、六节）：按本系列的排字规则，把一段中文排好，输出 SVG（字已转成轮廓，
不依赖字体文件，任何软件都能导入），附一份每个字位置的报告；`--png` 另出透明底 PNG（用 Chromium 栅格化，
与影片里的字同一种抗锯齿）。

usage: python3 tools/gridtype.py SPEC.json OUT.svg [--png OUT.png] [--report OUT.json]

SPEC（JSON）：
  lines     ["击壤忽然成古史，", "人间灯火灿于星。"]  一行一个字符串
  font      字体文件，默认 assets/huiwen.otf（汇文明朝体）；.ttc 用 "path#序号"
  size      字号（px，字身 1 em 的高）
  tracking  加在相邻两格之间的字距（px），默认 0
  leading   行距（基线到基线，字号的倍数），默认 1.35
  align     "center" | "left" | "right"，默认 center
  x         对齐线：居中时是整组两端边界的中点，左对齐时是左边界，右对齐时是右边界
  y         第一行墨迹的上下中点（与影片的 Line.y 相同）
  block     几行共用一张网格（默认 true）；false 时每行各自对齐
  axis      全角字按墨迹居中在字格中轴上（默认：汇文明朝体是，其他字体按字体原样）
  color     填充色，默认 "#161519"
  canvas    [宽, 高]，默认按墨迹外框加 pad 留白
  pad       默认 0.25 × 字号

规则与影片的 src/lib/ink.ts 一致：每个全角字（汉字、全角标点）占一个 1 em 的字格，一格接一格；字在格里按墨迹
左右居中（开引号、开括号靠右，闭的靠左）；半角字按自己的步进；整行按两端边界对齐（字按字格，行首行尾的标点按
墨迹）；一组的几行先按字格相互对齐，再整组对齐。字形尺寸取字体文件里的轮廓，不经浏览器取整。
"""
import json
import os
import re
import subprocess
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTCollection, TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = re.compile(r"[—…“”‘’·　-〿㐀-䶿一-鿿豈-﫿＀-｠￠-￦]")
OPEN = re.compile(r"[“‘（《〈「『【〔［｛]")
CLOSE = re.compile(r"[”’）》〉」』】〕］｝]")
MARK = re.compile(r"[　-〿＀-￯!-/:-@\[-`{-~“”‘’—…·]")


def load_font(spec):
    path = spec.get("font", os.path.join(ROOT, "assets", "huiwen.otf"))
    idx = 0
    if "#" in path:
        path, idx = path.rsplit("#", 1)
        idx = int(idx)
    font = TTCollection(path).fonts[idx] if path.lower().endswith(".ttc") else TTFont(path)
    return font, os.path.basename(path).lower().startswith("huiwen")


class Glyphs:
    def __init__(self, font, size):
        self.font, self.size = font, size
        self.upm = font["head"].unitsPerEm
        self.k = size / self.upm
        self.cmap = font.getBestCmap()
        self.gs = font.getGlyphSet()
        self.hmtx = font["hmtx"]
        self.cache = {}

    def __call__(self, ch):
        if ch in self.cache:
            return self.cache[ch]
        name = self.cmap.get(ord(ch))
        if name is None:
            raise SystemExit(f"字体里没有“{ch}”（U+{ord(ch):04X}）")
        adv = self.hmtx[name][0]
        bp = BoundsPen(self.gs)
        self.gs[name].draw(bp)
        pp = SVGPathPen(self.gs)
        self.gs[name].draw(pp)
        k = self.k
        b = bp.bounds
        g = dict(name=name, adv=adv * k, path=pp.getCommands())
        if b is None:  # a space
            g.update(l=adv * k / 2, r=adv * k / 2, t=0.0, b=0.0, blank=True)
        else:
            g.update(l=b[0] * k, r=b[2] * k, t=-b[3] * k, b=-b[1] * k, blank=False)
        self.cache[ch] = g
        return g


def cell_of(ch, g, size):
    return size if (FULL.search(ch) or g["adv"] > 0.9 * size) else g["adv"]


def pen_in(ch, cell, g, axis):
    if g["blank"] or not FULL.search(ch) or not axis:
        return (cell - g["adv"]) / 2
    if OPEN.search(ch):
        return cell - g["adv"]
    if CLOSE.search(ch):
        return 0.0
    return cell / 2 - (g["l"] + g["r"]) / 2


def lay_line(text, G, size, tracking, axis):
    x, out, boxL, boxR, inkT, inkB = 0.0, [], None, None, 1e9, -1e9
    for i, ch in enumerate(text):
        if i:
            x += tracking
        g = G(ch)
        c = cell_of(ch, g, size)
        p = x + pen_in(ch, c, g, axis)
        out.append(dict(ch=ch, cell=[x, x + c], pen=p, ink=None if g["blank"] else [p + g["l"], p + g["r"]]))
        if not g["blank"]:
            inkT, inkB = min(inkT, g["t"]), max(inkB, g["b"])
            edge = not MARK.search(ch)
            if boxL is None:
                boxL = x if edge else p + g["l"]
            boxR = x + c if edge else p + g["r"]
        x += c
    return dict(glyphs=out, adv=x, boxL=boxL, boxR=boxR, inkT=inkT, inkB=inkB)


def layout(spec):
    font, is_hw = load_font(spec)
    size = float(spec["size"])
    tracking = float(spec.get("tracking", 0))
    axis = spec.get("axis", is_hw)
    align = spec.get("align", "center")
    G = Glyphs(font, size)
    Ls = [lay_line(t, G, size, tracking, axis) for t in spec["lines"]]
    X = float(spec.get("x", 0))
    if spec.get("block", True) and len(Ls) > 1:
        x0 = [(-L["adv"] / 2 if align == "center" else 0.0 if align == "left" else -L["adv"]) for L in Ls]
        Lb = min(x + L["boxL"] for x, L in zip(x0, Ls))
        Rb = max(x + L["boxR"] for x, L in zip(x0, Ls))
        d = X - (Lb + Rb) / 2 if align == "center" else X - Lb if align == "left" else X - Rb
        x0 = [x + d for x in x0]
    else:
        x0 = [X - (L["boxL"] + L["boxR"]) / 2 if align == "center" else X - L["boxL"] if align == "left" else X - L["boxR"] for L in Ls]
    lead = float(spec.get("leading", 1.35)) * size
    b0 = float(spec.get("y", 0)) - (Ls[0]["inkT"] + Ls[0]["inkB"]) / 2
    for i, (x, L) in enumerate(zip(x0, Ls)):
        L["x0"], L["baseline"] = x, b0 + i * lead
    return G, Ls


def to_svg(spec, G, Ls):
    size = float(spec["size"])
    color = spec.get("color", "#161519")
    xs = [L["x0"] + g["ink"][0] for L in Ls for g in L["glyphs"] if g["ink"]] + [L["x0"] + g["ink"][1] for L in Ls for g in L["glyphs"] if g["ink"]]
    ys = [L["baseline"] + L["inkT"] for L in Ls] + [L["baseline"] + L["inkB"] for L in Ls]
    if "canvas" in spec:
        ox, oy, (W, H) = 0.0, 0.0, spec["canvas"]
    else:
        pad = float(spec.get("pad", 0.25 * size))
        ox, oy = min(xs) - pad, min(ys) - pad
        W, H = max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad
    k = G.k
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:g}" height="{H:g}" viewBox="0 0 {W:g} {H:g}">', f'<g fill="{color}">']
    report = []
    for li, L in enumerate(Ls):
        for g in L["glyphs"]:
            gx, gy = L["x0"] + g["pen"] - ox, L["baseline"] - oy
            if g["ink"]:
                cmd = G(g["ch"])["path"]
                parts.append(f'<path transform="translate({gx:.4f} {gy:.4f}) scale({k:.8f} {-k:.8f})" d="{cmd}"/>')
            report.append(dict(line=li, ch=g["ch"], cell=[round(L["x0"] + c - ox, 4) for c in g["cell"]], pen=round(gx, 4),
                               ink=None if not g["ink"] else [round(L["x0"] + v - ox, 4) for v in g["ink"]], baseline=round(gy, 4)))
    parts.append("</g></svg>")
    return "\n".join(parts), report, (W, H)


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    spec = json.load(open(sys.argv[1], encoding="utf8"))
    out = sys.argv[2]
    G, Ls = layout(spec)
    svg, report, (W, H) = to_svg(spec, G, Ls)
    open(out, "w", encoding="utf8").write(svg)
    args = sys.argv[3:]
    if "--report" in args:
        json.dump(report, open(args[args.index("--report") + 1], "w", encoding="utf8"), ensure_ascii=False, indent=1)
    if "--png" in args:
        png = args[args.index("--png") + 1]
        subprocess.run(["node", os.path.join(ROOT, "tools", "svg2png.mjs"), out, png, str(W), str(H)], check=True)
    for L in Ls:
        print(f"行 {''.join(g['ch'] for g in L['glyphs'])}：起点 {L['x0']:.3f}，基线 {L['baseline']:.3f}，两端边界 {L['x0'] + L['boxL']:.3f} … {L['x0'] + L['boxR']:.3f}")


if __name__ == "__main__":
    main()
