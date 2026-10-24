"""在图上量：50% 交点法量墨迹边（亚像素），用于小黄标与字的间隙、导出复测、参考图对照。

颜色分离用线性解：背景、白字、小黄标三种纯色两两之间的混合（抗锯齿边）都能分开，
所以量白字时小黄标完全不干扰，量小黄标时白字也不干扰（红底、蓝底都一样）。
"""

import numpy as np
from PIL import Image

from . import template as T
from .layout import text_elements
from .render import MARK_HALF_W

WHITE = (255.0, 255.0, 255.0)


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(float(int(h[i:i + 2], 16)) for i in (0, 2, 4))


MARK_RGB = hex2rgb(T.MARK["color"])


# ---------------- 基础 ----------------

def load_image(path):
    """读图并统一到 1440×1920（稿定 2x 原图、聊天软件压缩过的图都可以；必须是 3:4）。"""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if abs(w / h - 0.75) > 0.004:
        raise SystemExit(f"参考图不是 3:4（{w}×{h}），可能被裁过或带了状态栏，先给完整的原图")
    if (w, h) != (T.OUT_W, T.OUT_H):
        im = im.resize((T.OUT_W, T.OUT_H), Image.Resampling.LANCZOS)
    return np.asarray(im, dtype=float), (w, h)


def border_bg(a):
    return tuple(np.median(np.concatenate([a[:15].reshape(-1, 3), a[-15:].reshape(-1, 3)]), axis=0))


def coverage(a, colors, target):
    """colors：三种纯色；返回第 target 种的覆盖率（另两种及它们的混合为 0）。"""
    A = np.array([list(c) + [1.0] for c in colors])
    t = np.zeros(len(colors))
    t[target] = 1.0
    w = np.linalg.lstsq(A, t, rcond=None)[0]
    return a @ w[:3] + w[3]


def coverage2(a, c0, c1):
    """两种颜色之间的覆盖率：c0 -> 0，c1 -> 1。"""
    c0, c1 = np.array(c0), np.array(c1)
    d = c1 - c0
    return ((a - c0) @ d) / (d @ d)


def cross(p, mid=0.5):
    """一维剖面在 mid 处的首末交点（像素 j 看作 j + 0.5 处的采样，线性插值）。"""
    idx = np.where(p >= mid)[0]
    if len(idx) == 0:
        return None
    i0, i1 = idx[0], idx[-1]
    L = (i0 - 1) + 0.5 + (mid - p[i0 - 1]) / (p[i0] - p[i0 - 1]) if i0 > 0 else i0 + 0.5
    R = i1 + 0.5 + (p[i1] - mid) / (p[i1] - p[i1 + 1]) if i1 < len(p) - 1 else i1 + 0.5
    return float(L), float(R)


def box_extent(cov, r0, r1, c0, c1):
    r0, r1, c0, c1 = max(0, int(r0)), min(cov.shape[0] - 1, int(r1)), max(0, int(c0)), min(cov.shape[1] - 1, int(c1))
    sub = cov[r0:r1 + 1, c0:c1 + 1]
    lr, tb = cross(sub.max(axis=0)), cross(sub.max(axis=1))
    if lr is None or tb is None:
        return None
    return lr[0] + c0, tb[0] + r0, lr[1] + c0, tb[1] + r0


def maps(a, lay):
    bg = hex2rgb(lay["bg"])
    w = coverage(a, [bg, WHITE, MARK_RGB], 1)
    m = coverage(a, [bg, WHITE, MARK_RGB], 2)
    return bg, w, m


def box_rgb(lay):
    """高亮底块叠在底色上之后的实际颜色。"""
    sb = lay["tpl"]["sub_box"]
    bg, c, al = np.array(hex2rgb(lay["bg"])), np.array(hex2rgb(sb["color"])), sb["opacity"]
    return tuple(bg * (1 - al) + c * al)


def sub_dark_map(a, lay, box=None):
    """宋词副标题：高亮底块上和底色同色的字。box 缺省用版式里的位置。"""
    b = box or lay["sub_box"]
    out = np.zeros(a.shape[:2])
    r0, r1 = int(np.ceil(b["y"])) + 1, int(b["y"] + b["h"]) - 1
    c0, c1 = int(np.ceil(b["x"])) + 1, int(b["x"] + b["w"]) - 1
    out[r0:r1 + 1, c0:c1 + 1] = coverage2(a[r0:r1 + 1, c0:c1 + 1], box_rgb(lay),
                                          hex2rgb(lay["tpl"]["sub_box"]["text_color"]))
    return out


def glyph_windows(gl):
    """每个字的量取窗口：自己的墨迹外框外扩 2 px，但不越过与相邻字墨迹的中点。"""
    inks = [(j, g["ink"]) for j, g in enumerate(gl) if g["ink"]]
    out = {}
    for n, (j, (l, t, r, b)) in enumerate(inks):
        wl, wr = l - 2, r + 2
        if n > 0:
            wl = max(wl, (inks[n - 1][1][2] + l) / 2)
        if n < len(inks) - 1:
            wr = min(wr, (r + inks[n + 1][1][0]) / 2)
        out[j] = (wl, t - 2, wr, b + 2)
    return out


# ---------------- 小黄标与字的间隙 ----------------

def mark_gaps(lay, text_only_img):
    """在只有字的图上量每个标正上方（标的宽度范围内）那个字的墨迹底边，算出间隙。
    只报告，不挪标：负数表示字的底边压进了标里。"""
    a = np.asarray(text_only_img, dtype=float)
    _, w, _ = maps(a, lay)
    for m in lay["marks"]:
        base = lay["body"][m["row"]]["baseline"]
        r0, r1 = int(base - 60), int(base + 40)
        c0, c1 = int(np.floor(m["cx"] - MARK_HALF_W)), int(np.ceil(m["cx"] + MARK_HALF_W))
        cr = cross(w[r0:r1 + 1, c0:c1 + 1].max(axis=1))
        m["gap"] = None if cr is None else m["top"] - (cr[1] + r0)


# ---------------- 导出复测 ----------------

def detect_marks(mcov, min_area=60):
    import scipy.ndimage as nd
    lab, n = nd.label(mcov > 0.5)
    out = []
    for j in range(1, n + 1):
        ys, xs = np.where(lab == j)
        if len(ys) < min_area:
            continue
        e = box_extent(mcov, ys.min() - 3, ys.max() + 3, xs.min() - 3, xs.max() + 3)
        if e:
            out.append(dict(L=e[0], T=e[1], R=e[2], B=e[3], cx=(e[0] + e[2]) / 2))
    return out


def recheck(img, lay):
    """在导出的 PNG 上逐字量墨迹中心，与算出的位置比。"""
    a = np.asarray(img, dtype=float)
    _, w, m = maps(a, lay)
    dark = sub_dark_map(a, lay) if lay["sub_box"] else None
    rows = []
    for el in text_elements(lay):
        if el is lay["rule"]:
            continue
        cov = dark if (dark is not None and el is lay["sub"]) else w
        wins = glyph_windows(el["glyphs"])
        for j, g in enumerate(el["glyphs"]):
            if j not in wins:
                continue
            l, t, r, b = g["ink"]
            e = box_extent(cov, *[wins[j][1], wins[j][3], wins[j][0], wins[j][2]])
            if e is None:
                continue
            rows.append(dict(el=el["role"], ch=g["ch"], dx=(e[0] + e[2]) / 2 - (l + r) / 2,
                             dy=(e[1] + e[3]) / 2 - (t + b) / 2))
    marks = []
    found = detect_marks(m)
    for mk in lay["marks"]:
        if not found:
            break
        f = min(found, key=lambda d: abs(d["cx"] - mk["cx"]) + abs(d["T"] - mk["top"]))
        marks.append(dict(row=mk["row"], col=mk["col"], ch=mk["ch"], dx=f["cx"] - mk["cx"], dy=f["T"] - mk["top"]))
    return rows, marks


# ---------------- 参考图对照 ----------------

def _bands(cov, thr=0.5, min_h=3):
    act = (cov > thr).any(axis=1)
    out, inb = [], False
    for r, v in enumerate(act):
        if v and not inb:
            r0, inb = r, True
        elif not v and inb:
            if r - r0 >= min_h:
                out.append((r0, r - 1))
            inb = False
    return out


def _find_sub_box(a, lay):
    """宋词：找高亮底块的四边。底块是白色 66% 不透明度，用白的覆盖率除以不透明度，底块里是 1；
    底块上的字和底色一样（0），上方主标题的白字 > 1，它们在一行、一列里都占少数，
    所以取中位数做剖面，再在 50% 处求交点。"""
    b = lay["sub_box"]
    al = b["opacity"]
    w = coverage(a, [hex2rgb(lay["bg"]), WHITE, MARK_RGB], 1) / al
    r0, r1 = max(0, int(b["y"] - 40)), int(b["y"] + b["h"] + 40)
    c0, c1 = max(0, int(b["x"] - 40)), min(a.shape[1] - 1, int(b["x"] + b["w"] + 40))
    rows = np.median(w[r0:r1 + 1, int(b["x"] + 10):int(b["x"] + b["w"] - 10)], axis=1)
    tb = cross(rows)
    if tb is None:
        return None
    y0, y1 = tb[0] + r0, tb[1] + r0
    cols = np.median(w[int(y0 + 4):int(y1 - 4), c0:c1 + 1], axis=0)
    lr = cross(cols)
    if lr is None:
        return None
    return dict(x=lr[0] + c0, y=y0, w=lr[1] - lr[0], h=y1 - y0, color=b["color"], opacity=al)


def _measure_element(cov, el, font, rows):
    """量一个文字元素：基线（由墨迹上下边和字体外框推出）、左右墨迹边、字号、逐字水平位置。"""
    gl = [g for g in el["glyphs"] if g["ink"]]
    k = el["size"] / font.upm
    exp_L = min(g["ink"][0] for g in gl)
    exp_R = max(g["ink"][2] for g in gl)
    exp_T = min(g["ink"][1] for g in gl)
    exp_B = max(g["ink"][3] for g in gl)
    r0, r1 = rows
    e = box_extent(cov, r0, r1, exp_L - 80, exp_R + 80)
    if e is None:
        return None
    L, Tm, R, B = e
    gs = [font.glyph(g["ch"]) for g in gl]
    ymax, ymin = max(g["ymax"] for g in gs), min(g["ymin"] for g in gs)
    base = ((Tm + ymax * k) + (B + ymin * k)) / 2
    res = dict(role=el["role"], dy=base - el["baseline"], dL=L - exp_L, dR=R - exp_R,
               size=el["size"] * (B - Tm) / (exp_B - exp_T), size_std=el["size"], base=base, chars=[])
    # 逐字：窗口按预计位置整体平移 dL
    shift = L - exp_L
    wins = glyph_windows(el["glyphs"])
    for j, g in enumerate(el["glyphs"]):
        if j not in wins:
            continue
        wl, wt, wr, wb = wins[j]
        ee = box_extent(cov, wt + (base - el["baseline"]), wb + (base - el["baseline"]), wl + shift, wr + shift)
        if ee is None:
            continue
        cx = (ee[0] + ee[2]) / 2
        res["chars"].append(dict(col=j, ch=g["ch"], cx=cx, dx=cx - (g["ink"][0] + g["ink"][2]) / 2))
    if res["chars"]:
        dxs = np.array([c["dx"] for c in res["chars"]])
        res["dx_mean"], res["dx_sd"] = float(dxs.mean()), float(dxs.std())
    return res


def analyze_reference(path, lay, font):
    a, size0 = load_image(path)
    bg, w, m = maps(a, lay)
    rep = dict(size=size0, elements=[], marks=[], detected={}, warnings=[], sub_box=None)
    seen_bg = border_bg(a)
    if max(abs(x - y) for x, y in zip(seen_bg, hex2rgb(lay["bg"]))) > 25:
        rep["warnings"].append(f"参考图底色 {tuple(round(x) for x in seen_bg)} 与{lay['mode']}模板 {lay['bg']} 不符")

    bands = _bands(w)
    els = text_elements(lay)
    for el in els:
        gl = [g for g in el["glyphs"] if g["ink"]]
        if not gl:
            continue
        if el is lay["sub"] and lay["sub_box"]:
            box = _find_sub_box(a, lay)
            if box is None:
                rep["warnings"].append("没找到副标题的高亮底块")
                continue
            exp = lay["sub_box"]
            rep["sub_box"] = dict(dx=box["x"] - exp["x"], dy=box["y"] - exp["y"],
                                  dw=box["w"] - exp["w"], dh=box["h"] - exp["h"])
            cov = sub_dark_map(a, lay, box)
            res = _measure_element(cov, el, font, (box["y"], box["y"] + box["h"]))
        else:
            et, eb = min(g["ink"][1] for g in gl), max(g["ink"][3] for g in gl)
            t, b = et - 30, eb + 30
            # 预计位置上下 30 px 内的墨迹带里，取中心离预计中心最近、高度最接近的一条
            cand = [(abs((b0 + b1) / 2 - (et + eb) / 2) + abs((b1 - b0) - (eb - et)), b0, b1)
                    for b0, b1 in bands if min(b, b1) > max(t, b0)]
            if not cand:
                rep["warnings"].append(f"{el['role']}：在预计位置附近没找到字")
                continue
            _, b0, b1 = min(cand)
            res = _measure_element(w, el, font, (b0 - 3, b1 + 3))
        if res:
            rep["elements"].append(res)

    # 小黄标：所属行 = 标顶上方最近的正文行；所属列 = 该行实测字中心最近的字
    found = detect_marks(m)
    body_res = {r["role"]: r for r in rep["elements"]}
    for f in found:
        cands = [(i, l) for i, l in enumerate(lay["body"]) if l["text"] and -20 < f["T"] - l["baseline"] < 50]
        if not cands:
            rep["warnings"].append(f"有一个小黄标（x≈{f['cx']:.0f}, y≈{f['T']:.0f}）找不到所属的正文行")
            continue
        i, line = min(cands, key=lambda c: abs(f["T"] - c[1]["baseline"]))
        r = body_res.get(line["role"])
        chars = r["chars"] if r else [dict(col=j, ch=g["ch"], cx=(g["cell"][0] + g["cell"][1]) / 2)
                                      for j, g in enumerate(line["glyphs"]) if g["ink"]]
        c = min(chars, key=lambda c: abs(c["cx"] - f["cx"]))
        base = r["base"] if r else line["baseline"]
        rep["marks"].append(dict(row=i, col=c["col"], ch=c["ch"], dx=f["cx"] - c["cx"],
                                 top_below_base=f["T"] - base,
                                 dy=f["T"] - base - T.MARK["top_below_baseline_px"]))
        rep["detected"].setdefault(i, set()).add(c["col"])
    return rep
