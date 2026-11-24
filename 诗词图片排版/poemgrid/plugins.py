"""非固定使用的可选视觉插件包（v2.5 独立模块）。

本模块包含两大独立插件功能（默认均关闭，底色固定为纯粹实色，按需在配置中引用启用）：
1. 插件一：背景装帧异化插件（二合一整体方案：大字藏锋右下角对称底字 + 右上角固定 40×140 px 装饰角标，默认 bamboo_moon 瘦竹新月）
2. 插件二：正文选中底衬插件（`<...>` 宋词次重点短句“18% 浅金底衬 + 70% 底边虚线”高亮）

详细规范与精确矢量坐标见《视觉插件说明.md》。
"""

from . import template as T
from .glyphs import PUNCT

# ==============================================================================
# 插件一：背景装帧异化插件（二合一：大字藏锋对称底字 + 右上角固定角标/眉批）
# ==============================================================================

# 1.1 「大字藏锋」右下角超大尺度对称核心字暗纹
WATERMARK = {
    "color": "#FFFFFF",
    "opacity": 0.040,           # 4.0% 极低不透明度纯白暗纹
    "size_px": 1080.0,          # 字号 1080 px（占画布宽 1440 px 的 75%，1x 为 931.5）
    "right_margin_px": 8.99,    # 墨迹右缘距画布右边界留白（对应「春」字 x_origin = 390.0 px，墨迹右缘 1431.01 px）
    "bottom_margin_px": 70.75,  # 墨迹下缘距画布底边界留白（对应「春」字 baseline = 1748.0 px，墨迹下缘 1849.25 px）
}

# 1.2 右上角固定尺寸纯装饰角标（v2.2 固定 40×140 px 槽位，默认 bamboo_moon 瘦竹新月）
ORNAMENT = {
    "style": "bamboo_moon",     # 默认风格：瘦竹新月（可选：bamboo_moon / willow）
    "width_px": 40.0,           # 固定槽位宽度 40.00 px
    "height_px": 140.0,         # 固定槽位高度 140.00 px
    "color": "#F9C06A",         # 全图唯一暖金色值
    "opacity": 0.400,           # 统一不透明度 40.0%（v2.5 由 35.0% 微调至 40.0%，兼顾红底清晰度与克制感）
    "frame_width_px": 1.0,      # 直角外框线宽 1.0 px
    # 位置固定：右缘对齐主右轴 x_right = 1440 - x0 = 1346.66 px，顶缘对齐 y_top = x0 = 93.34 px
}

# 1.3 「水印词序」右上角竖排古籍眉批词谱 + 界栏竖线（兼容保留）
MARGINALIA = {
    "color": "#F9C06A",
    "text_opacity": 0.250,
    "line_opacity": 0.250,
    "line_width_px": 1.0,
    "size_px": 25.0,
    "size_1x": 21.5625,
    "step_ratio": 1.36,
    "col_step_px": 40.0,
    "y0_px": 150.0,
    "pad_ink_px": 6.0,
    "cjk_mid_upm": 348.0,
}

# ==============================================================================
# 插件二：正文选中底衬插件（<...> 次重点句浅金底衬 + 底边虚线）
# ==============================================================================
LINE_BOX = {
    "color": "#F9C06A",
    "opacity": 0.180,           # 18.0% 浅金底衬（v2.2 适配统一红底 #900202，置于白字下方，白字保持纯白锐利）
    "pad_x_1x": 8.5,            # 左右边距复用副标题底块的 8.5（1x）= 9.8551 px
    "pad_y_px": 6.0,            # 上下边距（输出像素）：在 1 em 内容框（80 px）上下各扩 6.0 px，总高 92.0 px
    "rx_px": 4.0,               # 圆角半径（输出像素）
    "dash_opacity": 0.700,      # 底边暖金虚线不透明度 70.0%（与宋词副标题底块 70% 统一）
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


def build_ornament(orn_cfg, x0):
    """构建插件一之右上角固定 40×140 px 纯装饰角标（v2.2）。
    槽位位置恒定：x in [x_right - 40, x_right] (1306.66..1346.66 px), y in [y_top, y_top + 140] (93.34..233.34 px)。
    内置矢量路径完全确定，保证每次出图像素级一致。
    """
    if not orn_cfg:
        return None
    if isinstance(orn_cfg, bool):
        cfg = ORNAMENT
    elif isinstance(orn_cfg, str):
        cfg = {**ORNAMENT, "style": orn_cfg.strip().lower()}
    elif isinstance(orn_cfg, dict):
        cfg = {**ORNAMENT, **orn_cfg}
    else:
        return None

    style = cfg["style"]
    w = float(cfg["width_px"])
    h = float(cfg["height_px"])
    xr = T.OUT_W - x0   # 1346.6602 px
    yt = x0             # 93.3398 px
    xl = xr - w         # 1306.6602 px
    yb = yt + h         # 233.3398 px

    # 外框直角 L 线：从 (xl, yt) -> (xr, yt) -> (xr, yb)
    frame_d = f"M {xl:.4f} {yt:.4f} L {xr:.4f} {yt:.4f} L {xr:.4f} {yb:.4f}"
    strokes = []
    fills = []

    if style == "bamboo_moon":
        # 1. 三节微斜瘦竹竿（自右上微斜向左下，总斜移 4.5 px；三节比例 32 : 35 : 35）
        bx = xr - 10.1
        strokes.append((
            f"M {bx:.4f} {yt + 22.0:.4f} L {bx - 1.4:.4f} {yt + 54.0:.4f} "
            f"M {bx - 1.4:.4f} {yt + 57.0:.4f} L {bx - 2.9:.4f} {yt + 92.0:.4f} "
            f"M {bx - 2.9:.4f} {yt + 95.0:.4f} L {bx - 4.5:.4f} {yb - 10.0:.4f}",
            1.20,
        ))
        # 2. 两道竹节横刻
        strokes.append((
            f"M {bx - 3.9:.4f} {yt + 55.5:.4f} L {bx + 1.1:.4f} {yt + 55.5:.4f} "
            f"M {bx - 5.4:.4f} {yt + 93.5:.4f} L {bx - 0.4:.4f} {yt + 93.5:.4f}",
            1.10,
        ))
        # 3. 偏心双弧透视弦月（外弧 r=8.5, 内弧 r=7.2 向右上偏移 (3.8, -2.2)）
        mx, my = xl + 12.9, yt + 22.0
        # 用精确 SVG 圆弧指令 (A rx ry x_rot large_arc sweep x y) 还原 Cairo arc/arc_negative
        # 外弧：-0.35*pi (-63°) 到 +0.75*pi (+135°), 顺时针 sweep=1, large_arc=1 (198° > 180°)
        # 起点 (mx + 8.5*cos(-63°), my + 8.5*sin(-63°)), 终点 (mx + 8.5*cos(135°), my + 8.5*sin(135°))
        import math
        o_r = 8.5
        i_r = 7.2
        imx, imy = mx + 3.8, my - 2.2
        ox0, oy0 = mx + o_r * math.cos(-0.35 * math.pi), my + o_r * math.sin(-0.35 * math.pi)
        ox1, oy1 = mx + o_r * math.cos(0.75 * math.pi), my + o_r * math.sin(0.75 * math.pi)
        ix0, iy0 = imx + i_r * math.cos(0.72 * math.pi), imy + i_r * math.sin(0.72 * math.pi)
        ix1, iy1 = imx + i_r * math.cos(-0.32 * math.pi), imy + i_r * math.sin(-0.32 * math.pi)
        moon_d = (
            f"M {ox0:.4f} {oy0:.4f} "
            f"A {o_r:.4f} {o_r:.4f} 0 1 1 {ox1:.4f} {oy1:.4f} "
            f"L {ix0:.4f} {iy0:.4f} "
            f"A {i_r:.4f} {i_r:.4f} 0 1 0 {ix1:.4f} {iy1:.4f} Z"
        )
        fills.append(moon_d)
        # 4. 两片竹节尖叶
        fills.append(
            f"M {bx - 1.9:.4f} {yt + 55.5:.4f} "
            f"C {bx - 13.9:.4f} {yt + 52.0:.4f} {bx - 21.9:.4f} {yt + 59.0:.4f} {bx - 27.9:.4f} {yt + 70.0:.4f} "
            f"C {bx - 17.9:.4f} {yt + 64.0:.4f} {bx - 9.9:.4f} {yt + 59.0:.4f} {bx - 1.9:.4f} {yt + 55.5:.4f} Z"
        )
        fills.append(
            f"M {bx - 3.5:.4f} {yt + 93.5:.4f} "
            f"C {bx - 15.0:.4f} {yt + 91.0:.4f} {bx - 22.0:.4f} {yt + 99.0:.4f} {bx - 26.0:.4f} {yt + 111.0:.4f} "
            f"C {bx - 17.0:.4f} {yt + 104.0:.4f} {bx - 10.0:.4f} {yt + 98.0:.4f} {bx - 3.5:.4f} {yt + 93.5:.4f} Z"
        )
    elif style == "willow":
        strokes.append((
            f"M {xr - 8.5:.4f} {yt + 12.0:.4f} "
            f"C {xr - 11.5:.4f} {yt + 44.0:.4f} {xr - 16.5:.4f} {yt + 82.0:.4f} {xr - 24.5:.4f} {yt + 122.0:.4f}",
            1.20,
        ))
        fills.extend([
            (f"M {xr - 10.8:.4f} {yt + 28.0:.4f} "
             f"C {xr - 19.0:.4f} {yt + 31.0:.4f} {xr - 24.5:.4f} {yt + 39.5:.4f} {xr - 28.5:.4f} {yt + 50.0:.4f} "
             f"C {xr - 21.5:.4f} {yt + 43.0:.4f} {xr - 15.5:.4f} {yt + 35.5:.4f} {xr - 10.8:.4f} {yt + 28.0:.4f} Z"),
            (f"M {xr - 13.6:.4f} {yt + 48.0:.4f} "
             f"C {xr - 23.5:.4f} {yt + 53.0:.4f} {xr - 30.5:.4f} {yt + 66.0:.4f} {xr - 35.5:.4f} {yt + 82.0:.4f} "
             f"C {xr - 27.0:.4f} {yt + 71.0:.4f} {xr - 19.5:.4f} {yt + 59.0:.4f} {xr - 13.6:.4f} {yt + 48.0:.4f} Z"),
            (f"M {xr - 17.5:.4f} {yt + 72.0:.4f} "
             f"C {xr - 21.0:.4f} {yt + 84.0:.4f} {xr - 21.5:.4f} {yt + 98.0:.4f} {xr - 19.0:.4f} {yt + 114.0:.4f} "
             f"C {xr - 16.0:.4f} {yt + 100.0:.4f} {xr - 15.8:.4f} {yt + 85.0:.4f} {xr - 17.5:.4f} {yt + 72.0:.4f} Z"),
            (f"M {xr - 20.5:.4f} {yt + 90.0:.4f} "
             f"C {xr - 28.5:.4f} {yt + 98.0:.4f} {xr - 33.0:.4f} {yt + 113.0:.4f} {xr - 35.0:.4f} {yt + 130.0:.4f} "
             f"C {xr - 28.5:.4f} {yt + 117.0:.4f} {xr - 23.5:.4f} {yt + 103.0:.4f} {xr - 20.5:.4f} {yt + 90.0:.4f} Z"),
        ])
    else:
        raise ValueError(f"不认识的装饰角标风格：{style}（支持 bamboo_moon / willow）")

    return dict(
        style=style, x=xl, y=yt, w=w, h=h, x_right=xr, y_bot=yb,
        color=cfg["color"], opacity=float(cfg["opacity"]),
        frame_width_px=float(cfg["frame_width_px"]),
        frame_d=frame_d, strokes=strokes, fills=fills,
    )


def build_marginalia(font, marg_cfg, x0):
    """构建右上角「水印词序」竖排词谱眉批 + 界栏竖线布局（兼容保留）。"""
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
