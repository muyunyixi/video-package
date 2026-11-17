"""按内容算出每个字、横线、高亮底块、小黄标在 1440×1920 上的位置。

水平：网格排（一字一格、墨迹居中于字格），主左轴 x0 固定按七言 16 字标准行（14 汉字 +“，”+“。”）居中后的左格（93.34 px）；
正文按 body_align 选择每行各自居中（center）或左对齐于主左轴 x0（left）；署名按墨迹绝对居中。
纵向：按稿定设计的文本框叠放（字号×行距），宋词上下阕之间的空行按 0.5 行高（60 px，基线差 180 px）算，整组垂直居中，再加实测校准。
"""

from . import template as T
from .glyphs import CLOSE, FULL, OPEN, PUNCT


# ---------------- 文本、小黄标与金句变黄标记 ----------------

def parse_line(s, return_yellow=False):
    """解析正文行里的标记：
    - 花括号 '{...}'：在字下面加小黄标；
    - 方括号 '[...]'：把字直接改成黄色（#F9C06A，用于整句/金句高亮）。
    默认返回 (纯文本, 小黄标列号集合)；return_yellow=True 时返回 (纯文本, 小黄标列号集合, 黄字列号集合)。
    """
    out, marks, yellow = [], set(), set()
    in_brace, in_bracket = False, False
    for ch in s:
        if ch == "{":
            if in_brace:
                raise ValueError(f"花括号嵌套了：{s}")
            in_brace = True
            continue
        if ch == "}":
            if not in_brace:
                raise ValueError(f"多了一个右花括号：{s}")
            in_brace = False
            continue
        if ch == "[":
            if in_bracket:
                raise ValueError(f"方括号嵌套了：{s}")
            in_bracket = True
            continue
        if ch == "]":
            if not in_bracket:
                raise ValueError(f"多了一个右方括号：{s}")
            in_bracket = False
            continue
        idx = len(out)
        if in_brace:
            marks.add(idx)
        if in_bracket:
            yellow.add(idx)
        out.append(ch)
    if in_brace:
        raise ValueError(f"花括号没有闭合：{s}")
    if in_bracket:
        raise ValueError(f"方括号没有闭合：{s}")
    text = "".join(out)
    if return_yellow:
        return text, marks, yellow
    return text, marks


# ---------------- 一行字的字格 ----------------

def cells(font, text, size, axis=True):
    """每个字的字格（相对行起点）和绘制原点在格内的偏移；返回 (列表, 整行字格总宽)。

    全角字、全角标点占 1 em；半角字按自身步进。axis=True 时全角字按墨迹居中于字格，
    开符号靠右、闭符号靠左；半角字按步进原样放。整行边界一律取字格外缘。
    """
    k = size / font.upm
    x, out = 0.0, []
    for ch in text:
        g = font.glyph(ch)
        adv = g["adv"] * k
        full = bool(FULL.search(ch)) or adv > 0.9 * size
        c = size if full else adv
        if g["blank"] or not axis or not FULL.search(ch):
            pen = (c - adv) / 2
        elif OPEN.search(ch):
            pen = c - adv
        elif CLOSE.search(ch):
            pen = 0.0
        else:
            pen = c / 2 - (g["xmin"] + g["xmax"]) / 2 * k
        out.append(dict(ch=ch, left=x, width=c, pen=pen))
        x += c
    return out, x


def edges(font, text, size, axis=True, rule="mixed"):
    """一行的左右边界（相对行起点）。

    rule="mixed"：行首一律取首字字格左缘（含行首标点），行尾是汉字取字格外缘、是标点取墨迹右缘（正文用）；
    rule="ink"：两端都取墨迹（署名用：按看得见的字绝对居中）。
    """
    cs, _ = cells(font, text, size, axis)
    k = size / font.upm
    inked = [(c, font.glyph(c["ch"])) for c in cs if not font.glyph(c["ch"])["blank"]]
    (c0, g0), (c1, g1) = inked[0], inked[-1]
    ink_l = c0["left"] + c0["pen"] + g0["xmin"] * k
    ink_r = c1["left"] + c1["pen"] + g1["xmax"] * k
    if rule == "ink":
        return ink_l, ink_r
    left = c0["left"]
    right = ink_r if PUNCT.search(c1["ch"]) else c1["left"] + c1["width"]
    return left, right


def _normalize_align(val):
    v = str(val).strip().lower()
    if v in ("left", "左对齐", "左"):
        return "left"
    if v in ("center", "居中", "每行居中"):
        return "center"
    raise ValueError(f"不认识的 body_align：{val}（写 center / 居中 或 left / 左对齐）")


def place(font, text, size, x_left, baseline, axis=True, color=T.WHITE, role="", yellow_cols=None):
    cs, width = cells(font, text, size, axis)
    k = size / font.upm
    yellow_cols = yellow_cols or set()
    glyphs = []
    for idx, c in enumerate(cs):
        g = font.glyph(c["ch"])
        px = x_left + c["left"] + c["pen"]
        g_color = T.MARK["color"] if idx in yellow_cols else color
        glyphs.append(dict(
            ch=c["ch"], size=size, x=px, y=baseline, color=g_color, axis=axis and bool(FULL.search(c["ch"])),
            cell=(x_left + c["left"], x_left + c["left"] + c["width"]),
            ink=None if g["blank"] else (px + g["xmin"] * k, baseline - g["ymax"] * k,
                                         px + g["xmax"] * k, baseline - g["ymin"] * k),
        ))
    return dict(role=role, text=text, size=size, x_left=x_left, width=width,
                baseline=baseline, color=color, glyphs=glyphs)


# ---------------- 纵向 ----------------

def vertical(font, tpl, lines_or_n):
    """各元素的基线（输出像素）。
    lines_or_n 可传正文文本列表 texts（其中空字符串 "" 按 tpl['empty_line_ratio'] 行高算，默认 0.5 行即 60 px）或整数行数。
    """
    beta = font.beta

    def top_to_base(s, lh):          # 行框上缘到基线
        return lh * s / 2 + beta * s

    stack = [("title",) + tpl["title"]]
    if "rule" in tpl:
        stack.append(("rule",) + tpl["rule"])
    stack += [("sub",) + tpl["sub"], ("spacer",) + tpl["spacer"]]
    bs, bl = tpl["body"]
    line_h = bs * bl
    empty_ratio = tpl.get("empty_line_ratio", 0.5)
    if isinstance(lines_or_n, int):
        factors = [1.0] * lines_or_n
    else:
        factors = [1.0 if t else empty_ratio for t in lines_or_n]
    body_box_h = (sum(factors) + 2.0) * line_h   # 正文各行（含空行系数）+ 空一行 + 署名行
    bottom_h = tpl["bottom"][0] * tpl["bottom"][1] if tpl["bottom"] else 0.0
    total = sum(s * lh for _, s, lh in stack) + body_box_h + bottom_h

    y = (T.CANVAS_H_1X - total) / 2
    base, tops = {}, {}
    for name, s, lh in stack:
        tops[name] = y
        base[name] = y + top_to_base(s, lh)
        y += s * lh
    body = []
    cur_y = y
    for f in factors:
        body.append(cur_y + top_to_base(bs, bl))
        cur_y += f * line_h
    sign = cur_y + 1.0 * line_h + top_to_base(bs, bl)

    cal = tpl["calib_dy_px"]
    out = {name: base[name] * T.S + cal.get(name, 0.0) for name in ("title", "rule", "sub") if name in base}
    out["body"] = [b * T.S + cal["body"] for b in body]
    out["sign"] = sign * T.S + cal["sign"]
    out["stack_1x"] = dict(total=total, top=(T.CANVAS_H_1X - total) / 2)
    return out


# ---------------- 整张图 ----------------

def build(cfg, font, marks_override=None):
    """cfg：title / subtitle / body（列表）/ sign / mode / body_align（可选：center 或 left）。
    marks_override：{行号: {列号,…}}，用参考图识别出的小黄标代替正文里的花括号。"""
    tpl = T.template_for(cfg["mode"])
    S = T.S
    parsed = [parse_line(s, return_yellow=True) for s in cfg["body"]]
    texts = [p[0] for p in parsed]
    marks = [p[1] for p in parsed]
    yellows = [p[2] for p in parsed]
    if marks_override is not None:
        marks = [set(marks_override.get(i, ())) for i in range(len(texts))]
    n = len(texts)
    v = vertical(font, tpl, texts)

    # 水平（v1.6）：主左轴 x0 固定为七言 16 字标准行（14 汉字 +“，”+“。”）居中后的左格（93.34 px）。
    # body_align = "left"（默认：近体诗，或宋词方块排）：正文每行第一个字格左缘直接对齐 x0 = 93.34 px；
    # body_align = "center"（默认：宋词常规排）：正文每行按“行首取字格左缘、行尾汉字取字格外缘/标点取墨迹右缘”各自在画布中线 720 居中。
    body_size = tpl["body"][0] * S
    widths = [cells(font, t, body_size)[1] if t else 0.0 for t in texts]
    wmax = max(widths)
    align = _normalize_align(cfg.get("body_align", tpl["body_align"]))
    bnds = [edges(font, t, body_size) if t else None for t in texts]
    cx = T.OUT_W / 2
    std_l, std_r = edges(font, "一" * 7 + "，" + "一" * 7 + "。", body_size)
    x0 = cx - (std_l + std_r) / 2
    if align == "left":                            # 左对齐：每行第 1 个字格左缘固定在 x0（93.34 px）
        starts = [x0] * n
    else:                                          # 居中：每行各自在画布中线 720 居中
        starts = [cx - (b[0] + b[1]) / 2 if b else cx for b in bnds]

    lay = dict(mode=tpl["name"], tpl=tpl, bg=tpl["bg"], x0=x0, wmax=wmax, align=align,
               vertical=v, rule=None, sub_box=None, marks=[], yellows=yellows)
    lines = []
    for i, t in enumerate(texts):
        lines.append(place(font, t, body_size, starts[i], v["body"][i], role=f"正文第{i + 1}行", yellow_cols=yellows[i]))
    lay["body"] = lines
    # 看得见的墨迹中心离画布中线多少（按上面的规则总是略偏右：首字左边那点留白的一半）
    inked = [l for l in lines if l["text"]]

    def ink_c(ls):
        gl = [g for l in ls for g in l["glyphs"] if g["ink"]]
        return (min(g["ink"][0] for g in gl) + max(g["ink"][2] for g in gl)) / 2 - cx
    lay["ink_offset"] = [ink_c(inked)] if align == "left" else [ink_c([l]) for l in inked]
    lay["title"] = place(font, cfg["title"], tpl["title"][0] * S, x0, v["title"], role="主标题")

    sub_text = cfg.get("subtitle", "")
    sub_size = tpl["sub"][0] * S
    sub_w = cells(font, sub_text, sub_size)[1] if sub_text else 0.0
    if "rule" in tpl:
        rs = tpl["rule"][0] * S
        lay["rule"] = place(font, "—" * tpl["rule_dashes"], rs, x0, v["rule"], role="横线")
        rule_right = x0 + tpl["rule_dashes"] * rs
        lay["sub"] = place(font, sub_text, sub_size, rule_right - sub_w, v["sub"], role="副标题")
    else:
        # 高亮底块 = 字的内容框（宽：字格总宽；高：hhea 上下界）四周各加 padding；左缘对齐 x0
        box = tpl["sub_box"]
        pad = box["padding_1x"] * S
        k = sub_size / font.upm
        lay["sub"] = place(font, sub_text, sub_size, x0 + pad, v["sub"], color=box["text_color"], role="副标题")
        top = v["sub"] - font.ascent * k - pad
        lay["sub_box"] = dict(x=x0, y=top, w=sub_w + 2 * pad, h=(font.ascent - font.descent) * k + 2 * pad,
                              color=box["color"], opacity=box["opacity"])

    # 署名：全角字一字一格且格内按墨迹居中、半角字按步进，整行按墨迹（最左一笔到最右一笔）在画布中线绝对居中
    sign = cfg.get("sign", "")
    sign_size = tpl["sign_size"] * S
    sl, sr = edges(font, sign, sign_size, axis=True, rule="ink") if sign.strip() else (0.0, 0.0)
    lay["sign"] = place(font, sign, sign_size, cx - (sl + sr) / 2, v["sign"], axis=True, role="署名")

    for i, (line, ms) in enumerate(zip(lines, marks)):
        for k in sorted(ms):
            if k >= len(line["glyphs"]):
                raise ValueError(f"小黄标的列号超出第{i + 1}行：{k + 1}")
            g = line["glyphs"][k]
            lay["marks"].append(dict(row=i, col=k, ch=g["ch"], cx=(g["cell"][0] + g["cell"][1]) / 2,
                                     top=line["baseline"] + T.MARK["top_below_baseline_px"]))
    return lay


def text_elements(lay):
    """按从上到下的顺序列出所有文字元素。"""
    els = [lay["title"]]
    if lay["rule"]:
        els.append(lay["rule"])
    els.append(lay["sub"])
    els += [l for l in lay["body"] if l["text"]]
    if lay["sign"]["text"]:
        els.append(lay["sign"])
    return els
