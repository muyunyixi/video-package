#!/usr/bin/env python3
"""诗词图片排版：按诗词内容生成 1440×1920 的诗词图（近体诗红底、宋词蓝底）。

用法：
  python make_poem.py poems/绝句-春天停下了么.toml
  python make_poem.py poems/绝句-春天停下了么.toml --ref 参考图.jpg

选项：
  --ref 图     参考图（稿定设计导出的原图，或已经重排过的图）：另出一份偏差对照；
               配置里没用花括号标小黄标时，从参考图识别小黄标在哪些字下面
  --out 目录   输出目录，默认 output/
  --font 路径  字体，默认仓库里的 公共/汇文明朝体.otf
  --svg        另存 SVG（每个字都是轮廓）
  --zip        另打一个只装 PNG 的 zip，方便手机下载

配置文件（TOML）见 poems/ 里的例子。
"""

import argparse
import os
import sys
import tomllib
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from poemgrid import template as T                      # noqa: E402
from poemgrid.glyphs import Font                         # noqa: E402
from poemgrid.layout import build, parse_line           # noqa: E402
from poemgrid.measure import analyze_reference, mark_gaps, recheck  # noqa: E402
from poemgrid.render import rasterize, to_svg           # noqa: E402

DEFAULT_FONT = os.path.normpath(os.path.join(HERE, "..", "公共", "汇文明朝体.otf"))
FLAG = 1.0   # 参考图对照里超过这个值（px）的标出来


def load_cfg(path):
    with open(path, "rb") as f:
        cfg = tomllib.load(f)
    for key in ("mode", "title", "body"):
        if key not in cfg:
            raise SystemExit(f"{path} 缺少 {key}")
    if not isinstance(cfg["body"], list) or not any(cfg["body"]):
        raise SystemExit("body 要写成字符串列表，每行一句；宋词上下阕之间写一个空字符串 \"\"")
    return cfg


def fmt(v):
    return f"{v:+.2f}"


def report(cfg, lay, out_png, rows, marks, ref, mark_source):
    tpl = lay["tpl"]
    L = []
    n_lines = len(lay["body"])
    longest = max(len(l["text"]) for l in lay["body"])
    title = cfg["title"] + (f"·{cfg['subtitle']}" if cfg.get("subtitle") else "")
    L.append(f"《{title}》 {tpl['name']}  正文 {n_lines} 行（含空行），最长一行 {longest} 字")
    L.append(f"输出：{out_png}（{T.OUT_W}×{T.OUT_H}）")
    L.append("")
    L.append("一、版式（输出像素）")
    L.append(f"  主左轴 x0 = {lay['x0']:.2f}（最宽一行字格宽 {lay['wmax']:.2f}；按汉字字格、标点墨迹的两端边界居中）；"
             f"正文{'各行左对齐、整块居中' if lay['align'] == 'left' else '每行各自居中'}")
    offs = lay["ink_offset"]
    warn = "  ← 偏右超过 4 px，首字左边留白大，看看要不要处理" if max(offs) > 4 else ""
    L.append("  看得见的正文墨迹中心离画布中线：" + "、".join(fmt(o) for o in offs) + " px（总是略偏右，是首字左留白的一半）" + warn)
    s = [g for g in lay["sign"]["glyphs"] if g["ink"]]
    if s:
        L.append(f"  署名墨迹中心 {(s[0]['ink'][0] + s[-1]['ink'][2]) / 2:.2f}（按墨迹绝对居中）")
    v = lay["vertical"]
    parts = [f"主标题 {v['title']:.2f}"]
    if "rule" in v:
        parts.append(f"横线 {v['rule']:.2f}")
    parts.append(f"副标题 {v['sub']:.2f}")
    parts.append("正文 " + " / ".join(f"{b:.2f}" for b, l in zip(v["body"], lay["body"]) if l["text"]))
    parts.append(f"署名 {v['sign']:.2f}")
    L.append("  基线：" + "，".join(parts))
    if lay["sub_box"]:
        b = lay["sub_box"]
        L.append(f"  副标题底块：x {b['x']:.2f}–{b['x'] + b['w']:.2f}，y {b['y']:.2f}–{b['y'] + b['h']:.2f}")
    L.append("")
    L.append(f"二、小黄标（{mark_source}）")
    if not lay["marks"]:
        L.append("  无")
    heavy = T.MARK["heavy_overlap_px"]
    for m in lay["marks"]:
        gap, note = m.get("gap"), ""
        if gap is not None and gap < -heavy:
            note = f"  ← 字压进标 {-gap:.2f} px，超过 {heavy:g} px"
        elif gap is not None and gap < 0:
            note = "（贴上）"
        gtxt = "" if gap is None else f"，与上方墨迹间隙 {fmt(gap)}"
        L.append(f"  第{m['row'] + 1}行第{m['col'] + 1}列「{m['ch']}」：中心 x {m['cx']:.2f}，"
                 f"顶 {m['top']:.2f}（基线 +{m['top'] - lay['body'][m['row']]['baseline']:.2f}）{gtxt}{note}")
    L.append("")
    L.append("三、导出复测（在导出的 PNG 上逐字量墨迹中心，与算出的位置比）")
    if rows:
        dx = max(rows, key=lambda r: abs(r["dx"]))
        dy = max(rows, key=lambda r: abs(r["dy"]))
        bad = [r for r in rows if abs(r["dx"]) > 0.5]
        L.append(f"  {len(rows)} 个字：水平最大 {fmt(dx['dx'])}（{dx['el']}「{dx['ch']}」），"
                 f"竖直最大 {fmt(dy['dy'])}（{dy['el']}「{dy['ch']}」）")
        L.append("  水平超出 ±0.5 px：" + ("无" if not bad else "、".join(f"{r['el']}「{r['ch']}」{fmt(r['dx'])}" for r in bad)))
    if marks:
        L.append(f"  小黄标 {len(marks)} 个：水平最大 {fmt(max((m['dx'] for m in marks), key=abs))}，"
                 f"竖直最大 {fmt(max((m['dy'] for m in marks), key=abs))}")
    if ref:
        L.append("")
        w0, h0 = ref["size"]
        L.append(f"四、参考图对照（参考图 {w0}×{h0}，统一到 {T.OUT_W}×{T.OUT_H} 比；正数 = 参考图偏下/偏右）")
        L.append("  注：稿定里排的图按字格居中（“。”右边的空白也算进行宽），水平方向普遍比本规则偏左约 12 px，"
                 "署名偏左约 2 px，这是规则不同，不是错；看纵向和小黄标的偏差即可。")
        for w in ref["warnings"]:
            L.append(f"  ！{w}")
        L.append("  元素          基线Δy    左边Δx    右边Δx    字号（标准）")
        for e in ref["elements"]:
            flag = " ←" if max(abs(e["dy"]), abs(e["dL"]), abs(e["dR"])) > FLAG else ""
            size = "—" if e["role"] == "横线" else f"{e['size']:.1f}（{e['size_std']:.1f}）"  # 横线太细，量不出字号
            L.append(f"  {e['role']:<10}{fmt(e['dy']):>9} {fmt(e['dL']):>9} {fmt(e['dR']):>9}    {size}{flag}")
        if ref["sub_box"]:
            b = ref["sub_box"]
            L.append(f"  副标题底块    左 {fmt(b['dx'])}  上 {fmt(b['dy'])}  宽 {fmt(b['dw'])}  高 {fmt(b['dh'])}")
        if ref["marks"]:
            L.append("  小黄标（Δx：标中心 − 字的墨迹中心；顶距基线标准 "
                     f"{T.MARK['top_below_baseline_px']:.2f}）")
            for mk in sorted(ref["marks"], key=lambda d: (d["row"], d["col"])):
                flag = " ←" if max(abs(mk["dx"]), abs(mk["dy"])) > FLAG else ""
                L.append(f"    第{mk['row'] + 1}行第{mk['col'] + 1}列「{mk['ch']}」 Δx {fmt(mk['dx'])}  "
                         f"顶距基线 {mk['top_below_base']:.2f}（Δy {fmt(mk['dy'])}）{flag}")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description="诗词图片排版")
    ap.add_argument("config")
    ap.add_argument("--ref")
    ap.add_argument("--out", default=os.path.join(HERE, "output"))
    ap.add_argument("--font", default=DEFAULT_FONT)
    ap.add_argument("--svg", action="store_true")
    ap.add_argument("--zip", action="store_true")
    args = ap.parse_args()

    cfg = load_cfg(args.config)
    if not os.path.exists(args.font):
        raise SystemExit(f"找不到字体：{args.font}（用 --font 指定汇文明朝体.otf）")
    font = Font(args.font)
    stem = os.path.splitext(os.path.basename(args.config))[0]
    os.makedirs(args.out, exist_ok=True)

    has_braces = any(parse_line(s)[1] for s in cfg["body"])
    lay = build(cfg, font)
    ref = None
    mark_source = "按配置里的花括号" if has_braces else "无"
    if args.ref:
        ref = analyze_reference(args.ref, lay, font)
        if not has_braces and ref["detected"]:
            lay = build(cfg, font, marks_override=ref["detected"])
            mark_source = "从参考图识别"
        elif has_braces and ref["detected"]:
            want = {(i, k) for i, s in enumerate(cfg["body"]) for k in parse_line(s)[1]}
            got = {(i, k) for i, ks in ref["detected"].items() for k in ks}
            if want != got:
                ref["warnings"].append("配置里标的小黄标和参考图上的不一样，按配置出图")

    if lay["marks"]:
        mark_gaps(lay, rasterize(to_svg(lay, font, with_marks=False)))
    svg = to_svg(lay, font)
    img = rasterize(svg)
    out_png = os.path.join(args.out, f"{stem}.png")
    img.save(out_png, optimize=False, compress_level=6)
    if args.svg:
        with open(os.path.join(args.out, f"{stem}.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
    if args.zip:
        with zipfile.ZipFile(os.path.join(args.out, f"{stem}.zip"), "w", zipfile.ZIP_STORED) as z:
            z.write(out_png, os.path.basename(out_png))

    rows, marks = recheck(img, lay)
    text = report(cfg, lay, out_png, rows, marks, ref, mark_source)
    with open(os.path.join(args.out, f"{stem}_报告.txt"), "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
