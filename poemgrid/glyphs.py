"""读汇文明朝体：每个字的步进、轮廓外框、SVG 轮廓路径。"""

import re

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

# 全角：汉字、全角标点、破折号、引号等，一律占 1 em 字格
FULL = re.compile(r"[—-‧‰-※⺀-鿿豈-﫿︰-﹯！-｠￠-￯]")
# 标点：行首、行尾是标点时，整行边界按它的墨迹算（汉字按字格外缘）
PUNCT = re.compile(r"[，。、；：？！…—·《》〈〉“”‘’（）「」『』【】〔〕〖〗,.;:?!'\"()\[\]]")
OPEN = re.compile(r"[“‘《〈『「（〔【〖]")    # 开符号：靠字格右边
CLOSE = re.compile(r"[”’》〉』」）〕】〗]")   # 闭符号：靠字格左边


class Font:
    def __init__(self, path):
        self.path = path
        self.tt = TTFont(path)
        self.upm = self.tt["head"].unitsPerEm
        self.cmap = self.tt.getBestCmap()
        self.gs = self.tt.getGlyphSet()
        self.hmtx = self.tt["hmtx"]
        head = self.tt["head"]
        # 稿定设计把字体外框（head 的 yMin…yMax）放在行框里上下居中：
        # 行框上缘到基线 = 行距×字号/2 + beta×字号
        self.beta = (head.yMax + head.yMin) / 2 / self.upm
        # 字的内容框（宋词副标题高亮底块按它加）：hhea 的上下界，汇文明朝体是 864 / −160，正好 1 em
        self.ascent = self.tt["hhea"].ascent
        self.descent = self.tt["hhea"].descent
        self._cache = {}

    def glyph(self, ch):
        g = self._cache.get(ch)
        if g is not None:
            return g
        name = self.cmap.get(ord(ch))
        if name is None:
            raise SystemExit(f"字体里没有“{ch}”（U+{ord(ch):04X}）")
        bp = BoundsPen(self.gs)
        self.gs[name].draw(bp)
        pp = SVGPathPen(self.gs)
        self.gs[name].draw(pp)
        adv = self.hmtx[name][0]
        b = bp.bounds
        if b is None:
            g = dict(adv=adv, xmin=adv / 2, ymin=0.0, xmax=adv / 2, ymax=0.0, path="", blank=True)
        else:
            g = dict(adv=adv, xmin=b[0], ymin=b[1], xmax=b[2], ymax=b[3], path=pp.getCommands(), blank=False)
        self._cache[ch] = g
        return g
