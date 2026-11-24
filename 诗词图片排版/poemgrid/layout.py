"""按内容算出每个字、横线、高亮底块、小黄标在 1440×1920 上的位置。
非固定使用的可选视觉插件（大字藏锋、水印词序、浅金底衬）由 `poemgrid/plugins.py` 按需构建。

水平：网格排（一字一格、墨迹居中于字格），主左轴 x0 固定按七言 16 字标准行（14 汉字 +“，”+“。”）居中后的左格（93.34 px）；
正文按 body_align 选择每行各自居中（center）或左对齐于主左轴 x0（left）；署名按墨迹绝对居中。
纵向（v2.3 纯网格）：标题区紧贴叠放，其余纵向间距统一以正文单行高 1U（120 px）为模数——副标题至正文首行 1.8U（216 px）、同阕 1.0U（120 px）、上下阕 1.5U（180 px）、正文末行至署名 2.0U（240 px）；近体诗底部预留 1.0U（120 px，等效在 0~1800 px 居中），宋词纯几何居中；移除旧版稿定实测校准补丁。
"""

from . import template as T
from . import plugins as P
from .glyphs import CLOSE, FULL, OPEN, PUNCT, STOP_BEFORE_CLOSE

# ---------------- 文本、小黄标、金句变黄与浅金底衬标记 ----------------

def parse_line(s, return_yellow=False, return_all=False):
    """解析正文行里的标记：
    - 花括号 '{...}'：在字下面加小黄标；
    - 方括号 '[...]'：把字直接改成黄色（#F9C06A，用于整句/金句高亮）；
    - 尖括号 '<...>'：在该段/整句白字下方加浅金底衬 + 底边虚线（v1.9 新增可选项）。
    默认返回 (纯文本, 小黄标列号集合)；
    return_yellow=True 时返回 (纯文本, 小黄标列号集合, 黄字列号集合)；
    return_all=True 时返回 (纯文本, 小黄标列号集合, 黄字列号集合, 浅金底衬列号集合)。
    """
    out, marks, yellow, boxed = [], set(), set(), set()
    in_brace, in_bracket, in_angle = False, False, False
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
        if ch == "<":
            if in_angle:
                raise ValueError(f"尖括号嵌套了：{s}")
            in_angle = True
            continue
        if ch == ">":
            if not in_angle:
                raise ValueError(f"多了一个右尖括号：{s}")
            in_angle = False
            continue
        idx = len(out)
        if in_brace:
            marks.add(idx)
        if in_bracket:
            yellow.add(idx)
        if in_angle:
            boxed.add(idx)
        out.append(ch)
    if in_brace:
        raise ValueError(f"花括号没有闭合：{s}")
    if in_bracket:
        raise ValueError(f"方括号没有闭合：{s}")
    if in_angle:
        raise ValueError(f"尖括号没有闭合：{s}")
    text = "".join(out)
    if return_all:
        return text, marks, yellow, boxed
    if return_yellow:
        return text, marks, yellow
    return text, marks


# ---------------- 一行字的字格 ----------------

def cells(font, text, size, axis=True):
    """每个字的字格（相对行起点）和绘制原点在格内的偏移；返回 (列表, 整行字格总宽)。

    全角字、独立全角标点占 1 em；半角字按自身步进。axis=True 时全角字按墨迹居中于字格，
    开符号靠右、闭符号靠左；连续标点（如 ？” / 。”）前后各占 0.5 em 合占 1.0 em（v2.9）。
    """
    k = size / font.upm
    x, out = 0.0, []
    n = len(text)
    for i, ch in enumerate(text):
        g = font.glyph(ch)
        adv = g["adv"] * k
        full = bool(FULL.search(ch)) or adv > 0.9 * size
        prev_ch = text[i - 1] if i > 0 else ""
        next_ch = text[i + 1] if i + 1 < n else ""

        if axis and STOP_BEFORE_CLOSE.search(ch) and next_ch and CLOSE.search(next_ch):
            c = size * 0.5
            pen = c / 2.0 - (g["xmin"] + g["xmax"]) / 2.0 * k
        elif axis and CLOSE.search(ch) and prev_ch and STOP_BEFORE_CLOSE.search(prev_ch):
            c = size * 0.5
            pen = c / 2.0 - (g["xmin"] + g["xmax"]) / 2.0 * k
        else:
            c = size if full else adv
            if g["blank"] or not axis or not FULL.search(ch):
                pen = (c - adv) / 2
            elif OPEN.search(ch):
                pen = c - adv
            elif CLOSE.search(ch):
                pen = 0.0
            else:
                pen = c / 2 - (g["xmin"] + g["xmax"]) / 2 * k
                if ch in T.OPTICAL_SHIFT:
                    pen += T.OPTICAL_SHIFT[ch] * c
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
    # v2.9 两端对称规则：行首与行尾只要是标点一律按墨迹边界算，汉字取字格外缘
    left = ink_l if PUNCT.search(c0["ch"]) else c0["left"]
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
    """各元素的基线（输出像素，v2.3 纯网格规则）。
    lines_or_n 可传正文文本列表 texts（其中空字符串 "" 按 tpl['empty_line_ratio'] 行高算，默认 0.5U 即 60 px）或整数行数。
    """
    beta = font.beta

    def top_to_base(s, lh):          # 行框上缘到基线
        return lh * s / 2 + beta * s

    stack = [("title",) + tpl["title"]]
    if "rule" in tpl:
        stack.append(("rule",) + tpl["rule"])
    if not tpl.get("sub_inline"):
        stack.append(("sub",) + tpl["sub"])

    bs, bl = tpl["body"]
    line_h = bs * bl                 # 1U = 103.5 (1x) = 120.00 px (输出)
    empty_ratio = tpl.get("empty_line_ratio", 0.5)
    if isinstance(lines_or_n, int):
        factors = [1.0] * lines_or_n
    else:
        factors = [1.0 if t else empty_ratio for t in lines_or_n]

    # 相对主标题行框上缘（y=0）推算各元素基线
    y = 0.0
    base = {}
    for name, s, lh in stack:
        base[name] = y + top_to_base(s, lh)
        y += s * lh

    # 副标题基线 -> 正文首行基线 = sub_to_body_u * 1U（v2.3 固定 1.8U = 216.00 px）
    anchor_base = base["title"] if tpl.get("sub_inline") else base["sub"]
    b0_base = anchor_base + tpl.get("sub_to_body_u", 1.8) * line_h
    body_bases = []
    cur_base = b0_base
    for f in factors:
        body_bases.append(cur_base)
        cur_base += f * line_h
    # 正文末行基线 -> 署名基线 = 2.0U（240.00 px；factors 末项为 1.0，故再加 1.0*line_h）
    sign_base = cur_base + 1.0 * line_h

    # 整体底边 = 署名行框底边 + bottom_u * 1U（近体诗 1.0U = 120 px，宋词 0）
    base_to_bottom = line_h / 2 - beta * bs
    bottom_h = tpl.get("bottom_u", 0.0) * line_h
    total = sign_base + base_to_bottom + bottom_h
    y_off = (T.CANVAS_H_1X - total) / 2.0

    out = {name: (base[name] + y_off) * T.S for name in ("title", "rule", "sub") if name in base}
    out["body"] = [(b + y_off) * T.S for b in body_bases]
    out["sign"] = (sign_base + y_off) * T.S
    out["stack_1x"] = dict(total=total, top=y_off)
    return out


# ---------------- 整张图 ----------------

def build(cfg, font, marks_override=None):
    """cfg：title / subtitle / body（列表）/ sign / mode / body_align（可选：center 或 left）。
    marks_override：{行号: {列号,…}}，用参考图识别出的小黄标代替正文里的花括号。"""
    tpl = T.template_for(cfg["mode"])
    S = T.S
    parsed = [parse_line(s, return_all=True) for s in cfg["body"]]
    texts = [p[0] for p in parsed]
    marks = [p[1] for p in parsed]
    yellows = [p[2] for p in parsed]
    boxeds = [p[3] for p in parsed]
    if marks_override is not None:
        marks = [set(marks_override.get(i, ())) for i in range(len(texts))]
    n = len(texts)
    v = vertical(font, tpl, texts)

    # 水平（v1.8）：主左轴 x0 固定为七言 16 字标准行（14 汉字 +“，”+“。”）居中后的左格（93.34 px）。
    # body_align = "center"（近体诗与宋词均默认）：正文每行按“行首取字格左缘、行尾汉字取字格外缘/标点取墨迹右缘”各自在画布中线 720 居中；
    # body_align = "left"（可选）：正文每行第一个字格左缘直接对齐 x0 = 93.34 px。
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
               vertical=v, rule=None, divider=None, sub_box=None, marks=[], yellows=yellows, line_boxes=[])
    lines = []
    for i, t in enumerate(texts):
        lines.append(place(font, t, body_size, starts[i], v["body"][i], role=f"正文第{i + 1}行", yellow_cols=yellows[i]))
    lay["body"] = lines
    # v2.9 版心红线校验：正文任何一行有效边界严禁越过 [x0, x_right]（16 字标准行版心）
    x_right = T.OUT_W - x0
    overflow_lines = []
    for i, (t, b) in enumerate(zip(texts, bnds)):
        if not t or b is None:
            continue
        eff_l = starts[i] + b[0]
        eff_r = starts[i] + b[1]
        if eff_l < x0 - 0.5 or eff_r > x_right + 0.5:
            overflow_lines.append(dict(row=i, text=t, left=eff_l, right=eff_r, x0=x0, x_right=x_right))
    lay["overflow_lines"] = overflow_lines

    # 视觉插件（v2.7：仅保留右上角固定装饰角标 ornament；大字藏锋/水印词序/正文选中底衬已封存，代码保留在 plugins.py 中不再调用）
    pcfg = cfg.get("plugins", {})
    orn_opt = pcfg.get("ornament", cfg.get("ornament", None))
    lay["line_boxes"] = []
    lay["watermark"] = None
    lay["ornament"] = P.build_ornament(orn_opt, x0)
    lay["marginalia"] = None

    # 看得见的墨迹中心离画布中线多少（按上面的规则总是略偏右：首字左边那点留白的一半）
    inked = [l for l in lines if l["text"]]

    def ink_c(ls):
        gl = [g for l in ls for g in l["glyphs"] if g["ink"]]
        return (min(g["ink"][0] for g in gl) + max(g["ink"][2] for g in gl)) / 2 - cx
    lay["ink_offset"] = [ink_c(inked)] if align == "left" else [ink_c([l]) for l in inked]
    # v2.10 大标题视觉左齐：整行按网格排好后，整体左移使主标题最左一笔墨迹精确贴齐主左轴 x0（与书签条暖金竖线共线）
    title_el = place(font, cfg["title"], tpl["title"][0] * S, x0, v["title"], role="主标题")
    t_inks = [g["ink"][0] for g in title_el["glyphs"] if g["ink"]]
    if t_inks:
        t_dx = x0 - min(t_inks)
        title_el["x_left"] += t_dx
        for g in title_el["glyphs"]:
            g["x"] += t_dx
            g["cell"] = (g["cell"][0] + t_dx, g["cell"][1] + t_dx)
            if g["ink"]:
                g["ink"] = (g["ink"][0] + t_dx, g["ink"][1], g["ink"][2] + t_dx, g["ink"][3])
    lay["title"] = title_el

    sub_text = cfg.get("subtitle", "")
    sub_size = tpl["sub"][0] * S
    sub_w = cells(font, sub_text, sub_size)[1] if sub_text else 0.0
    if tpl.get("sub_inline"):
        if sub_text:
            title_inks = [g["ink"] for g in lay["title"]["glyphs"] if g["ink"]]
            title_ink_bot = max(b[3] for b in title_inks) if title_inks else v["title"]
            tmp_sub = place(font, sub_text, sub_size, 0.0, 0.0, role="副标题")
            sub_inks = [g["ink"] for g in tmp_sub["glyphs"] if g["ink"]]
            sub_ink_below = max(b[3] for b in sub_inks) if sub_inks else 0.0
            sub_base = title_ink_bot - sub_ink_below
            v["sub"] = sub_base
            dcfg = tpl["divider"]
            gap = float(dcfg["gap_px"])
            x_div = x0 + lay["title"]["width"] + gap
            x_sub = x_div + gap
            lay["sub"] = place(font, sub_text, sub_size, x_sub, sub_base, role="副标题")
            k = sub_size / font.upm
            lay["divider"] = dict(
                x=x_div,
                y1=sub_base - font.ascent * k,
                y2=sub_base - font.descent * k,
                width=float(dcfg["width_px"]),
                color=dcfg["color"],
                opacity=float(dcfg["opacity"]),
            )
        else:
            v["sub"] = v["title"]
            lay["sub"] = place(font, "", sub_size, x0, v["title"], role="副标题")
    elif "rule" in tpl:
        rs = tpl["rule"][0] * S
        lay["rule"] = place(font, "—" * tpl["rule_dashes"], rs, x0, v["rule"], role="横线")
        rule_right = x0 + tpl["rule_dashes"] * rs
        lay["sub"] = place(font, sub_text, sub_size, rule_right - sub_w, v["sub"], role="副标题")
    else:
        # v2.7 统一「书签条」副标题：12% 轻透白底 + 100% 暖金左竖杠 + 100% 白字，左缘对齐 x0
        box = tpl["sub_box"]
        pad_y = box["padding_1x"] * S
        bar_w = float(box.get("bar_width_px", 0.0))
        pad_l = float(box.get("pad_left_px", pad_y))
        pad_r = float(box.get("pad_right_px", pad_y))
        k = sub_size / font.upm
        if sub_text:
            lay["sub"] = place(font, sub_text, sub_size, x0 + bar_w + pad_l, v["sub"], color=box["text_color"], role="副标题")
            top = v["sub"] - font.ascent * k - pad_y
            lay["sub_box"] = dict(
                x=x0, y=top, w=bar_w + pad_l + sub_w + pad_r, h=(font.ascent - font.descent) * k + 2 * pad_y,
                color=box["color"], opacity=box["opacity"],
                bar_color=box.get("bar_color"), bar_opacity=box.get("bar_opacity", 1.00), bar_width=bar_w,
            )
        else:
            lay["sub"] = place(font, "", sub_size, x0, v["sub"], color=box["text_color"], role="副标题")

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
    if lay["sub"]["text"]:
        els.append(lay["sub"])
    els += [l for l in lay["body"] if l["text"]]
    if lay["sign"]["text"]:
        els.append(lay["sign"])
    return els
