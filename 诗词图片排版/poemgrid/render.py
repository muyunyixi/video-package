"""出 SVG（每个字都是轮廓路径）并栅格化成 1440×1920 PNG。"""

import io

from PIL import Image

from . import template as T
from .layout import text_elements
from .mark_path import INK_BOX, MARK_D

MARK_SCALE = (40 / 69) * (T.MARK["font_size"] / 36)  # 2x 图（字号 36）像素 -> 按 MARK["font_size"] 换到输出像素
MARK_HALF_W = (INK_BOX[2] - INK_BOX[0]) / 2 * MARK_SCALE
MARK_INK_CX = (INK_BOX[0] + INK_BOX[2]) / 2


def mark_transform(m):
    """小黄标墨迹的左右中心放在字格中轴上，墨迹上缘放在 m['top']。"""
    tx = m["cx"] - MARK_INK_CX * MARK_SCALE
    ty = m["top"] - INK_BOX[1] * MARK_SCALE
    return tx, ty


def to_svg(lay, font, with_marks=True):
    W, H = T.OUT_W, T.OUT_H
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         f'<rect width="{W}" height="{H}" fill="{lay["bg"]}"/>']
    if lay["sub_box"]:
        b = lay["sub_box"]
        p.append(f'<rect x="{b["x"]:.4f}" y="{b["y"]:.4f}" width="{b["w"]:.4f}" height="{b["h"]:.4f}" '
                 f'fill="{b["color"]}" fill-opacity="{b["opacity"]}"/>')
    if lay.get("line_boxes"):
        p.append("<g>")
        for lb in lay["line_boxes"]:
            y_bot = lb["y"] + lb["h"]
            p.append(f'<rect x="{lb["x"]:.4f}" y="{lb["y"]:.4f}" width="{lb["w"]:.4f}" height="{lb["h"]:.4f}" '
                     f'rx="{lb["rx"]:.2f}" fill="{lb["color"]}" fill-opacity="{lb["opacity"]}"/>')
            p.append(f'<line x1="{lb["x"]:.4f}" y1="{y_bot:.4f}" x2="{lb["x"] + lb["w"]:.4f}" y2="{y_bot:.4f}" '
                     f'stroke="{lb["color"]}" stroke-width="{lb["dash_width"]:.2f}" '
                     f'stroke-opacity="{lb["dash_opacity"]}" stroke-dasharray="{lb["dasharray"]}"/>')
        p.append("</g>")
    if with_marks and lay["marks"]:
        p.append(f'<g fill="{T.MARK["color"]}" fill-rule="evenodd">')
        for m in lay["marks"]:
            tx, ty = mark_transform(m)
            p.append(f'<path transform="translate({tx:.4f} {ty:.4f}) scale({MARK_SCALE:.8f})" d="{MARK_D}"/>')
        p.append("</g>")
    for el in text_elements(lay):
        k = el["size"] / font.upm
        p.append(f'<g fill="{el["color"]}">')
        for g in el["glyphs"]:
            if g["ink"] is None:
                continue
            d = font.glyph(g["ch"])["path"]
            fill_attr = f' fill="{g["color"]}"' if g.get("color") and g["color"] != el["color"] else ""
            p.append(f'<path{fill_attr} transform="translate({g["x"]:.4f} {g["y"]:.4f}) scale({k:.8f} {-k:.8f})" d="{d}"/>')
        p.append("</g>")
    p.append("</svg>")
    return "\n".join(p)


def rasterize(svg):
    import resvg_py
    png = resvg_py.svg_to_bytes(svg_string=svg)
    return Image.open(io.BytesIO(bytes(png))).convert("RGB")
