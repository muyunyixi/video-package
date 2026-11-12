"""出 SVG（每个字都是轮廓路径）并栅格化成 1440×1920 PNG。"""

import io

from PIL import Image

from . import template as T
from .layout import text_elements
from .mark_path import INK_BOX, MARK_D

MARK_SCALE = 40 / 69          # 小黄标轮廓的单位是 2x 图像素 -> 输出像素
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
            p.append(f'<path transform="translate({g["x"]:.4f} {g["y"]:.4f}) scale({k:.8f} {-k:.8f})" d="{d}"/>')
        p.append("</g>")
    p.append("</svg>")
    return "\n".join(p)


def rasterize(svg):
    import resvg_py
    png = resvg_py.svg_to_bytes(svg_string=svg)
    return Image.open(io.BytesIO(bytes(png))).convert("RGB")
