"""小红书瀑布流大字金句封面图生成模块（v2.7）。

规范要点：
- 触发逻辑：优先读取配置中的 `quote`（字符串或列表）；未指定时自动提取正文中 `[...]` 标黄金句。
- 画布与底图：1440×1920，统一纯正朱红 `#900202` + 右上角固定 `40×140 px` `40%` 装饰角标（默认 `bamboo_moon`）。
- 排版规则：无署名、保留标点；单行字符串自动按分句标点（，；。？！）拆行；
  基准字号 `144.0 px`、行距 `1.5` 倍（`216.0 px`），若最宽行超出安全宽 `1120.0 px` 则等比微缩字号。
- 水平对齐：沿用网格排混合边界（行首字格左缘，行尾汉字取字格外缘/标点取墨迹右缘）；
  各行等长时整组统一左缘（上下同列严格对齐），不等长时每行各自居中。
- 纵向重心：底部预留 `1U = 120.0 px`（等效在 `0~1800 px` 内垂直居中，重心精确上提 `60.0 px` 防下坠）。
"""

import re

from . import layout as L
from . import plugins as P
from . import template as T

QUOTE = {
    "font_size_px": 144.0,     # 1/10 画布宽；7 字 + 标点有效宽约 1104 px
    "line_height": 1.5,        # 与正文 1.5 倍行距同源（144 × 1.5 = 216 px）
    "max_width_px": 1120.0,    # 左右至少各留 160 px 呼吸余白
    "bottom_u": 1.0,           # 底部预留 1U = 120 px（等效在 0~1800 px 内垂直居中，上提 60 px）
    "color": T.WHITE,
    "default_ornament": "bamboo_moon",
}

# 按中文停顿标点拆分为带尾标点的分句
_SPLIT_CLAUSE = re.compile(r"[^，；。？！]+[，；。？！]?")


def _split_text_to_lines(text):
    """将单段金句按分句标点拆成多行（保留各句末尾标点）。"""
    s = (text or "").strip()
    if not s:
        return []
    # 若用户已用换行显式分行，按换行拆
    if "\n" in s:
        return [ln.strip() for ln in s.splitlines() if ln.strip()]
    parts = [m.group(0).strip() for m in _SPLIT_CLAUSE.finditer(s) if m.group(0).strip()]
    return parts or [s]


def resolve_quote_lines(cfg, lay):
    """解析金句分行列表，返回 (lines, source_desc)。若无金句返回 ([], '')。"""
    raw_q = cfg.get("quote")
    if raw_q:
        if isinstance(raw_q, list):
            lines = [str(x).strip() for x in raw_q if str(x).strip()]
        else:
            lines = _split_text_to_lines(str(raw_q))
        if lines:
            return lines, "按配置中的 quote 字段"

    # 未指定 quote 时，自动提取正文中 [...] 标黄的片段
    yellows = lay.get("yellows") or []
    extracted = []
    for idx, ys in enumerate(yellows):
        if not ys:
            continue
        glyphs = lay["body"][idx]["glyphs"]
        seg = "".join(glyphs[k]["ch"] for k in sorted(ys)).strip()
        if seg:
            extracted.extend(_split_text_to_lines(seg))
    if extracted:
        return extracted, "自动提取正文 [...] 标黄金句"
    return [], ""


def build_quote(cfg, lay, font):
    """构建金句封面图布局；若无有效金句则返回 None。"""
    lines, source = resolve_quote_lines(cfg, lay)
    if not lines:
        return None

    # 1. 确定字号：默认 144 px，若任一行有效宽超出 max_width_px 则等比微缩
    q_size = float(QUOTE["font_size_px"])
    max_w = float(QUOTE["max_width_px"])
    raw_bnds = [L.edges(font, t, q_size, axis=True) for t in lines]
    max_span = max(b[1] - b[0] for b in raw_bnds)
    if max_span > max_w and max_span > 0:
        q_size = q_size * (max_w / max_span)
        raw_bnds = [L.edges(font, t, q_size, axis=True) for t in lines]

    # 2. 纵向定位：0 ~ (1920 - bottom_u * 120) 内垂直居中（默认 0~1800，上提 60 px）
    q_lh = float(QUOTE["line_height"])
    line_h = q_size * q_lh
    body_1u_px = T.SONGCI["body"][0] * T.SONGCI["body"][1] * T.S  # 120.00 px
    bottom_pad = float(QUOTE["bottom_u"]) * body_1u_px
    total_h = len(lines) * line_h
    y_top = (T.OUT_H - bottom_pad - total_h) / 2.0
    top_to_base = line_h / 2.0 + font.beta * q_size
    baselines = [y_top + i * line_h + top_to_base for i in range(len(lines))]

    # 3. 水平对齐：各行字数相同则统一左缘（列对齐），否则每行各自居中
    cx = T.OUT_W / 2.0
    same_len = len({len(t) for t in lines}) == 1
    if same_len:
        common_l = min(b[0] for b in raw_bnds)
        common_r = max(b[1] for b in raw_bnds)
        starts = [cx - (common_l + common_r) / 2.0] * len(lines)
        align_mode = "equal_col"
    else:
        starts = [cx - (b[0] + b[1]) / 2.0 for b in raw_bnds]
        align_mode = "per_line"

    els = [
        L.place(font, t, q_size, starts[i], baselines[i], axis=True, color=QUOTE["color"], role=f"金句第{i + 1}行")
        for i, t in enumerate(lines)
    ]

    # 4. 右上角角标：优先沿用主图角标；若主图未启且未显式关闭，则默认用 40% 瘦竹新月
    pcfg = cfg.get("plugins", {})
    orn_opt = pcfg.get("ornament", cfg.get("ornament", QUOTE["default_ornament"]))
    orn = lay.get("ornament") if lay.get("ornament") is not None else P.build_ornament(orn_opt, lay["x0"])

    return dict(
        bg=lay["bg"],
        source=source,
        lines=lines,
        size=q_size,
        line_height=q_lh,
        baselines=baselines,
        starts=starts,
        align_mode=align_mode,
        elements=els,
        ornament=orn,
    )


def to_quote_svg(qlay, font):
    """将金句封面布局渲染为纯路径 SVG。"""
    W, H = T.OUT_W, T.OUT_H
    p = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        f'<rect width="{W}" height="{H}" fill="{qlay["bg"]}"/>',
    ]
    orn = qlay.get("ornament")
    if orn:
        p.append(f'<g opacity="{orn["opacity"]:.4f}">')
        p.append(f'<path d="{orn["frame_d"]}" fill="none" stroke="{orn["color"]}" stroke-width="{orn["frame_width_px"]:.2f}"/>')
        for sd, sw in orn["strokes"]:
            p.append(f'<path d="{sd}" fill="none" stroke="{orn["color"]}" stroke-width="{sw:.2f}" stroke-linecap="round"/>')
        for fd in orn["fills"]:
            p.append(f'<path d="{fd}" fill="{orn["color"]}"/>')
        p.append("</g>")

    for el in qlay["elements"]:
        k = el["size"] / font.upm
        p.append(f'<g fill="{el["color"]}">')
        for g in el["glyphs"]:
            if g["ink"] is None:
                continue
            d = font.glyph(g["ch"])["path"]
            p.append(f'<path transform="translate({g["x"]:.4f} {g["y"]:.4f}) scale({k:.8f} {-k:.8f})" d="{d}"/>')
        p.append("</g>")
    p.append("</svg>")
    return "\n".join(p)
