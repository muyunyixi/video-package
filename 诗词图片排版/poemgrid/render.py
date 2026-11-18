"""出 SVG（每个字都是轮廓路径）并栅格化成 1440×1920 PNG。
支持标准纯色排版及《视觉插件说明.md》中的可选视觉插件图层；栅格化优先使用 resvg_py，无 resvg_py 时自动回退至 pycairo。
"""

import base64
import io
import re
import numpy as np
from PIL import Image

from . import template as T
from . import plugins as P
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


def to_svg(lay, font, with_marks=True, with_bg_plugins=True):
    W, H = T.OUT_W, T.OUT_H
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
    p.append(f'<rect width="{W}" height="{H}" fill="{lay["bg"]}"/>')

    if lay.get("watermark") and with_marks and with_bg_plugins:
        wm = lay["watermark"]
        k_wm = wm["size"] / font.upm
        d_wm = font.glyph(wm["ch"])["path"]
        p.append(f'<path fill="{wm["color"]}" fill-opacity="{wm["opacity"]:.4f}" '
                 f'transform="translate({wm["x"]:.4f} {wm["baseline"]:.4f}) scale({k_wm:.8f} {-k_wm:.8f})" d="{d_wm}"/>')

    if lay.get("ornament") and with_marks and with_bg_plugins:
        orn = lay["ornament"]
        p.append(f'<g opacity="{orn["opacity"]:.4f}">')
        p.append(f'<path d="{orn["frame_d"]}" fill="none" stroke="{orn["color"]}" stroke-width="{orn["frame_width_px"]:.2f}"/>')
        for sd, sw in orn["strokes"]:
            p.append(f'<path d="{sd}" fill="none" stroke="{orn["color"]}" stroke-width="{sw:.2f}" stroke-linecap="round"/>')
        for fd in orn["fills"]:
            p.append(f'<path d="{fd}" fill="{orn["color"]}"/>')
        p.append("</g>")

    if lay.get("marginalia") and with_marks and with_bg_plugins:
        mg = lay["marginalia"]
        k_m = mg["size_px"] / font.upm
        p.append("<g>")
        for col in mg["columns"]:
            lx = col["line_x"] - mg["line_width_px"] / 2.0
            lh = col["line_bot"] - col["line_top"]
            p.append(f'<rect x="{lx:.4f}" y="{col["line_top"]:.4f}" width="{mg["line_width_px"]:.4f}" height="{lh:.4f}" '
                     f'fill="{mg["color"]}" fill-opacity="{mg["line_opacity"]:.4f}"/>')
            for gl in col["glyphs"]:
                d_m = font.glyph(gl["ch"])["path"]
                p.append(f'<path fill="{mg["color"]}" fill-opacity="{mg["text_opacity"]:.4f}" '
                         f'transform="translate({gl["x"]:.4f} {gl["y"]:.4f}) scale({k_m:.8f} {-k_m:.8f})" d="{d_m}"/>')
        p.append("</g>")

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


def _draw_svg_path_cairo(ctx, d_str):
    tokens = re.findall(r'[MLHVQCAZmlhvqcaz]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', d_str)
    i = 0
    cx, cy = 0.0, 0.0
    sx, sy = 0.0, 0.0
    cmd = None
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
        if cmd == 'M':
            cx, cy = float(tokens[i]), float(tokens[i+1])
            sx, sy = cx, cy
            ctx.move_to(cx, cy)
            i += 2
            cmd = 'L'
        elif cmd == 'L':
            cx, cy = float(tokens[i]), float(tokens[i+1])
            ctx.line_to(cx, cy)
            i += 2
        elif cmd == 'H':
            cx = float(tokens[i])
            ctx.line_to(cx, cy)
            i += 1
        elif cmd == 'V':
            cy = float(tokens[i])
            ctx.line_to(cx, cy)
            i += 1
        elif cmd == 'Q':
            x1, y1, x2, y2 = float(tokens[i]), float(tokens[i+1]), float(tokens[i+2]), float(tokens[i+3])
            cp1x = cx + (2.0 / 3.0) * (x1 - cx)
            cp1y = cy + (2.0 / 3.0) * (y1 - cy)
            cp2x = x2 + (2.0 / 3.0) * (x1 - x2)
            cp2y = y2 + (2.0 / 3.0) * (y1 - y2)
            ctx.curve_to(cp1x, cp1y, cp2x, cp2y, x2, y2)
            cx, cy = x2, y2
            i += 4
        elif cmd == 'A':
            import math
            rx_a, ry_a = float(tokens[i]), float(tokens[i+1])
            x_rot = math.radians(float(tokens[i+2]))
            large_arc = int(float(tokens[i+3]))
            sweep = int(float(tokens[i+4]))
            x2, y2 = float(tokens[i+5]), float(tokens[i+6])
            i += 7
            # Endpoint to center parameterization (W3C SVG 1.1 F.6.5)
            dx2 = (cx - x2) / 2.0
            dy2 = (cy - y2) / 2.0
            x1p = math.cos(x_rot) * dx2 + math.sin(x_rot) * dy2
            y1p = -math.sin(x_rot) * dx2 + math.cos(x_rot) * dy2
            rx_a, ry_a = abs(rx_a), abs(ry_a)
            lam = (x1p**2)/(rx_a**2) + (y1p**2)/(ry_a**2)
            if lam > 1.0:
                rx_a *= math.sqrt(lam)
                ry_a *= math.sqrt(lam)
            num = max(0.0, rx_a**2 * ry_a**2 - rx_a**2 * y1p**2 - ry_a**2 * x1p**2)
            den = rx_a**2 * y1p**2 + ry_a**2 * x1p**2
            coef = math.sqrt(num / den) if den > 1e-12 else 0.0
            if large_arc == sweep:
                coef = -coef
            cxp = coef * (rx_a * y1p / ry_a)
            cyp = coef * -(ry_a * x1p / rx_a)
            acx = math.cos(x_rot)*cxp - math.sin(x_rot)*cyp + (cx + x2)/2.0
            acy = math.sin(x_rot)*cxp + math.cos(x_rot)*cyp + (cy + y2)/2.0
            def vec_ang(ux, uy, vx, vy):
                dot = ux*vx + uy*vy
                mag = math.hypot(ux, uy) * math.hypot(vx, vy)
                ang = math.acos(max(-1.0, min(1.0, dot / mag)))
                if ux*vy - uy*vx < 0:
                    ang = -ang
                return ang
            theta1 = vec_ang(1, 0, (x1p - cxp)/rx_a, (y1p - cyp)/ry_a)
            dtheta = vec_ang((x1p - cxp)/rx_a, (y1p - cyp)/ry_a, (-x1p - cxp)/rx_a, (-y1p - cyp)/ry_a)
            if sweep == 0 and dtheta > 0:
                dtheta -= 2 * math.pi
            elif sweep == 1 and dtheta < 0:
                dtheta += 2 * math.pi
            ctx.save()
            ctx.translate(acx, acy)
            ctx.rotate(x_rot)
            ctx.scale(rx_a, ry_a)
            if sweep == 1:
                ctx.arc(0, 0, 1.0, theta1, theta1 + dtheta)
            else:
                ctx.arc_negative(0, 0, 1.0, theta1, theta1 + dtheta)
            ctx.restore()
            cx, cy = x2, y2
        elif cmd == 'C':
            x1, y1, x2, y2, x3, y3 = [float(tokens[i+k]) for k in range(6)]
            ctx.curve_to(x1, y1, x2, y2, x3, y3)
            cx, cy = x3, y3
            i += 6
        elif cmd in ('Z', 'z'):
            ctx.close_path()
            cx, cy = sx, sy
            cmd = None
        else:
            raise ValueError(f"Unknown SVG path command: {cmd}")


def _hex_to_rgb01(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))


def _rasterize_cairo(svg):
    import cairo
    import xml.etree.ElementTree as ET
    root = ET.fromstring(svg)
    W = int(root.attrib.get("width", T.OUT_W))
    H = int(root.attrib.get("height", T.OUT_H))
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)

    def render_node(node, inherited_fill=None, inherited_rule="nonzero", inherited_op=1.0):
        tag = node.tag.split("}")[-1]
        fill = node.attrib.get("fill", inherited_fill)
        fill_rule = node.attrib.get("fill-rule", inherited_rule)
        grp_op = inherited_op * float(node.attrib.get("opacity", "1.0"))
        fill_op = grp_op * float(node.attrib.get("fill-opacity", "1.0"))
        stroke = node.attrib.get("stroke", "none")
        stroke_op = grp_op * float(node.attrib.get("stroke-opacity", "1.0"))
        stroke_w = float(node.attrib.get("stroke-width", "1.0"))
        tf = node.attrib.get("transform", "")

        ctx.save()
        if tf:
            for m in re.finditer(r'(translate|scale)\(([^)]+)\)', tf):
                op, args = m.group(1), [float(x) for x in m.group(2).replace(",", " ").split()]
                if op == "translate":
                    ctx.translate(args[0], args[1] if len(args) > 1 else 0.0)
                elif op == "scale":
                    ctx.scale(args[0], args[1] if len(args) > 1 else args[0])

        if tag == "image":
            href = node.attrib.get("href", "")
            if href.startswith("data:image/png;base64,"):
                raw = base64.b64decode(href.split(",", 1)[1])
                im_bg = np.array(Image.open(io.BytesIO(raw)).convert("RGB"))
                buf = np.frombuffer(surf.get_data(), dtype=np.uint8).reshape((H, W, 4))
                buf[:, :, 0] = im_bg[:, :, 2]
                buf[:, :, 1] = im_bg[:, :, 1]
                buf[:, :, 2] = im_bg[:, :, 0]
                buf[:, :, 3] = 255
                surf.mark_dirty()
        elif tag == "rect":
            x = float(node.attrib.get("x", "0"))
            y = float(node.attrib.get("y", "0"))
            w = float(node.attrib["width"])
            h = float(node.attrib["height"])
            rx = float(node.attrib.get("rx", "0"))
            ctx.new_path()
            if rx > 0:
                ctx.arc(x + w - rx, y + rx, rx, -np.pi / 2, 0)
                ctx.arc(x + w - rx, y + h - rx, rx, 0, np.pi / 2)
                ctx.arc(x + rx, y + h - rx, rx, np.pi / 2, np.pi)
                ctx.arc(x + rx, y + rx, rx, np.pi, 3 * np.pi / 2)
                ctx.close_path()
            else:
                ctx.rectangle(x, y, w, h)
            if fill and fill != "none":
                r, g, b = _hex_to_rgb01(fill)
                ctx.set_source_rgba(r, g, b, fill_op)
                ctx.fill()
        elif tag == "line":
            x1, y1 = float(node.attrib["x1"]), float(node.attrib["y1"])
            x2, y2 = float(node.attrib["x2"]), float(node.attrib["y2"])
            stroke = node.attrib.get("stroke", "#FFFFFF")
            sw = float(node.attrib.get("stroke-width", "1.0"))
            sop = float(node.attrib.get("stroke-opacity", "1.0"))
            da = node.attrib.get("stroke-dasharray", "")
            ctx.new_path()
            if da:
                ctx.set_dash([float(v) for v in da.replace(",", " ").split()], 0)
            ctx.set_line_width(sw)
            ctx.move_to(x1, y1)
            ctx.line_to(x2, y2)
            r, g, b = _hex_to_rgb01(stroke)
            ctx.set_source_rgba(r, g, b, sop)
            ctx.stroke()
        elif tag == "path":
            d = node.attrib.get("d", "")
            if d:
                if fill and fill != "none":
                    ctx.new_path()
                    ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD if fill_rule == "evenodd" else cairo.FILL_RULE_WINDING)
                    _draw_svg_path_cairo(ctx, d)
                    r, g, b = _hex_to_rgb01(fill)
                    ctx.set_source_rgba(r, g, b, fill_op)
                    ctx.fill()
                if stroke and stroke != "none":
                    ctx.new_path()
                    _draw_svg_path_cairo(ctx, d)
                    ctx.set_line_width(stroke_w)
                    if node.attrib.get("stroke-linecap") == "round":
                        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
                    sr, sg, sb = _hex_to_rgb01(stroke)
                    ctx.set_source_rgba(sr, sg, sb, stroke_op)
                    ctx.stroke()

        for child in node:
            render_node(child, inherited_fill=fill, inherited_rule=fill_rule, inherited_op=grp_op)
        ctx.restore()

    render_node(root)
    surf.flush()
    out_buf = np.frombuffer(surf.get_data(), dtype=np.uint8).reshape((H, W, 4))
    return Image.fromarray(out_buf[:, :, [2, 1, 0]], "RGB")


def rasterize(svg):
    try:
        import resvg_py
        png = resvg_py.svg_to_bytes(svg_string=svg)
        return Image.open(io.BytesIO(bytes(png))).convert("RGB")
    except ImportError:
        return _rasterize_cairo(svg)
