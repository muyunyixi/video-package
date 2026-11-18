"""非固定使用的可选视觉插件包（v2.0 独立模块）。

本模块包含两大独立插件功能（默认均关闭，底色固定为纯粹实色，按需在配置中引用启用）：
1. 插件一：背景装帧异化插件（二合一整体方案：大字藏锋右下角对称底字 + 水印词序右上角竖排小字）
2. 插件二：正文选中底衬插件（`<...>` 次重点句“16% 浅金底衬 + 底边虚线”高亮）

详细规范与数学推导见《视觉插件说明.md》。
"""

from . import template as T
from .glyphs import PUNCT

# ==============================================================================
# 插件一：背景装帧异化插件（二合一：大字藏锋对称底字 + 水印词序右上角竖排小字）
# ==============================================================================

# 1.1 「大字藏锋」右下角超大尺度对称核心字暗纹
WATERMARK = {
    "color": "#FFFFFF",
    "opacity": 0.032,           # 3.2% 极低不透明度纯白暗纹
    "size_px": 1080.0,          # 字号 1080 px（占画布宽 1440 px 的 75%，1x 为 931.5）
    "right_margin_px": 8.99,    # 墨迹右缘距画布右边界留白（对应「春」字 x_origin = 390.0 px，墨迹右缘 1431.01 px）
    "bottom_margin_px": 70.75,  # 墨迹下缘距画布底边界留白（对应「春」字 baseline = 1748.0 px，墨迹下缘 1849.25 px）
}

# 1.2 「水印词序」右上角竖排古籍眉批词谱 + 界栏竖线
MARGINALIA = {
    "color": "#F9C06A",
    "text_opacity": 0.215,      # 眉批小字不透明度 21.5%
    "line_opacity": 0.160,      # 界栏竖线不透明度 16.0%（与插件二选中底衬不透明度统一）
    "line_width_px": 1.0,       # 界栏竖线线宽 1.0 px
    "size_1x": 17.25,           # 字号 17.25 (1x) -> 输出图 20.00 px（正文 80 px 的 1/4）
    "step_ratio": 1.36,         # 纵向步进倍数：1.36 * 20.00 = 27.20 px（20 px 字高 + 7.2 px 字距）
    "col_step_px": 40.0,        # 相邻两列文字中轴间距 40.00 px（正文格宽的 1/2），竖线居中在列间 ±20.00 px 处
    "y0_px": 150.0,             # 最右侧第 1 列首字 1 em 字格起始上缘 y0 = 150.00 px（1x 为 129.375）
    "pad_ink_px": 6.0,          # 竖线上下两端超出首、末字实测墨迹的固定外扩量 6.00 px（0.30 * size）
    "cjk_mid_upm": 348.0,       # 常规汉字轮廓中心高度（用于将间隔号“·”在纵向居中）
}

# ==============================================================================
# 插件二：正文选中底衬插件（<...> 次重点句浅金底衬 + 底边虚线）
# ==============================================================================
LINE_BOX = {
    "color": "#F9C06A",
    "opacity": 0.16,            # 16% 浅金底衬（与右上角竖线不透明度统一；置于白字下方，白字保持纯白锐利）
    "pad_x_1x": 8.5,            # 左右边距复用副标题底块的 8.5（1x）= 9.8551 px
    "pad_y_px": 6.0,            # 上下边距（输出像素）：在 1 em 内容框（80 px）上下各扩 6.0 px，总高 92.0 px
    "rx_px": 4.0,               # 圆角半径（输出像素）
    "dash_opacity": 0.65,       # 底边暖金虚线不透明度
    "dash_width_px": 1.6,       # 底边暖金虚线线宽（输出像素）
    "dasharray": "5 5",         # 底边虚线步进（5 px 实线 + 5 px 间隔）
}


def build_line_boxes(font, lines, boxeds, body_size):
    """构建插件二（<...> 次重点句浅金底衬与底边虚线）布局。"""
    lb_cfg = LINE_BOX
    pad_x = lb_cfg["pad_x_1x"] * T.S
    pad_y = lb_cfg["pad_y_px"]
    k_body = body_size / font.upm
    out = []
    for i, (line, bcols) in enumerate(zip(lines, boxeds)):
        if not bcols:
            continue
        cols_sorted = sorted(bcols)
        g_first = line["glyphs"][cols_sorted[0]]
        g_last = line["glyphs"][cols_sorted[-1]]
        left_edge = g_first["cell"][0]
        right_edge = g_last["ink"][2] if (PUNCT.search(g_last["ch"]) and g_last["ink"]) else g_last["cell"][1]
        box_x = left_edge - pad_x
        box_w = (right_edge - left_edge) + 2 * pad_x
        box_y = line["baseline"] - font.ascent * k_body - pad_y
        box_h = (font.ascent - font.descent) * k_body + 2 * pad_y
        out.append(dict(
            row=i, cols=cols_sorted,
            text="".join(line["glyphs"][c]["ch"] for c in cols_sorted),
            x=box_x, y=box_y, w=box_w, h=box_h,
            color=lb_cfg["color"], opacity=lb_cfg["opacity"], rx=lb_cfg["rx_px"],
            dash_opacity=lb_cfg["dash_opacity"], dash_width=lb_cfg["dash_width_px"],
            dasharray=lb_cfg["dasharray"],
        ))
    return out


def build_watermark(font, wm_cfg):
    """构建插件一之「大字藏锋」右下角超大尺度对称核心字暗纹布局。"""
    if not wm_cfg:
        return None
    if isinstance(wm_cfg, str):
        ch = wm_cfg.strip()
        cfg = WATERMARK
    elif isinstance(wm_cfg, dict):
        ch = str(wm_cfg.get("char", "")).strip()
        cfg = {**WATERMARK, **wm_cfg}
    else:
        return None
    if not ch:
        return None
    size = float(cfg["size_px"])
    k = size / font.upm
    g = font.glyph(ch)
    if "x_px" in cfg and "baseline_px" in cfg:
        x_orig = float(cfg["x_px"])
        base_y = float(cfg["baseline_px"])
    else:
        ink_right_target = T.OUT_W - float(cfg["right_margin_px"])
        ink_bot_target = T.OUT_H - float(cfg["bottom_margin_px"])
        x_orig = ink_right_target - g["xmax"] * k
        base_y = ink_bot_target + g["ymin"] * k
    return dict(
        ch=ch, size=size, x=x_orig, baseline=base_y,
        color=cfg["color"], opacity=float(cfg["opacity"]),
        ink=(x_orig + g["xmin"] * k, base_y - g["ymax"] * k,
             x_orig + g["xmax"] * k, base_y - g["ymin"] * k),
    )


def build_marginalia(font, marg_cfg, x0):
    """构建插件一之「水印词序」右上角竖排词谱眉批 + 界栏竖线布局。
    水平：最右侧第 1 条界栏竖线固定对齐主右轴 x_right = OUT_W - x0 = 1346.66 px（即 16 字标准行句号墨迹右缘）；
    纵向：以最右侧第 1 列首字的实测墨迹上缘 y_ref_top 为绝对参照值，左侧各列首字墨迹上缘对齐 y_ref_top，
          竖线上下两端超出首、末字实测墨迹严格均为 pad_ink_px = 6.00 px。
    """
    if not marg_cfg:
        return None
    if isinstance(marg_cfg, list):
        cols_text = [str(c) for c in marg_cfg if str(c).strip()]
        cfg = MARGINALIA
    elif isinstance(marg_cfg, dict):
        cols_text = [str(c) for c in marg_cfg.get("columns", []) if str(c).strip()]
        cfg = {**MARGINALIA, **marg_cfg}
    else:
        return None
    if not cols_text:
        return None

    size_px = float(cfg.get("size_px", cfg["size_1x"] * T.S))
    step_px = float(cfg.get("step_px", size_px * cfg["step_ratio"]))
    col_step_px = float(cfg["col_step_px"])
    y0_px = float(cfg["y0_px"])
    pad_ink_px = float(cfg["pad_ink_px"])
    x_right = float(cfg.get("x_right_px", T.OUT_W - x0))

    k = size_px / font.upm
    g00 = font.glyph(cols_text[0][0])
    base_0 = y0_px + font.ascent * k
    y_ref_top = base_0 - g00["ymax"] * k
    std_cjk_mid = float(cfg["cjk_mid_upm"]) * k

    columns_data = []
    for m, text in enumerate(cols_text):
        line_x = x_right - m * col_step_px
        col_cx = line_x - (col_step_px / 2.0)
        gm0 = font.glyph(text[0])
        base_m0 = y_ref_top + gm0["ymax"] * k

        glyphs = []
        for i, ch in enumerate(text):
            g = font.glyph(ch)
            base_i = base_m0 + i * step_px
            gx = col_cx - (g["xmin"] + g["xmax"]) / 2.0 * k
            if ch == "·":
                gy = (base_i - std_cjk_mid) + (g["ymin"] + g["ymax"]) / 2.0 * k
            else:
                gy = base_i
            ink_top_i = gy - g["ymax"] * k
            ink_bot_i = gy - g["ymin"] * k
            glyphs.append(dict(
                ch=ch, x=gx, y=gy, size=size_px,
                ink_top=ink_top_i, ink_bot=ink_bot_i,
                ink_left=gx + g["xmin"] * k, ink_right=gx + g["xmax"] * k,
            ))

        col_ink_top = glyphs[0]["ink_top"]
        col_ink_bot = glyphs[-1]["ink_bot"]
        line_top = col_ink_top - pad_ink_px
        line_bot = col_ink_bot + pad_ink_px
        columns_data.append(dict(
            index=m + 1, text=text, cx=col_cx, line_x=line_x,
            ink_top=col_ink_top, ink_bot=col_ink_bot,
            line_top=line_top, line_bot=line_bot,
            top_overhang=col_ink_top - line_top,
            bot_overhang=line_bot - col_ink_bot,
            glyphs=glyphs,
        ))

    return dict(
        x_right=x_right, y_ref_top=y_ref_top,
        size_px=size_px, step_px=step_px, col_step_px=col_step_px, pad_ink_px=pad_ink_px,
        color=cfg["color"], text_opacity=float(cfg["text_opacity"]),
        line_opacity=float(cfg["line_opacity"]), line_width_px=float(cfg["line_width_px"]),
        columns=columns_data,
    )
