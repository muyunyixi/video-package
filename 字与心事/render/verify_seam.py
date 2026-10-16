"""The loop seam, measured on the decoded deliverable (《整体制作指南》8.8: the platforms loop the film,
so frame 2229 is followed by frame 0; the check is made on what the viewer gets, after compression, not
only on the rendered frames).

For every pair of neighbouring frames: the mean |ΔY| (8-bit luma) over the whole picture. The seam is the
pair (last frame, frame 0). It should be no larger, against the steps around it, than at the film's other
key frames: an encoder keeps or drops the per-frame grain group by group, and frame 0 always starts a group,
so a group at the end coded at another quality shows as a jump in the picture's texture when it loops.
Also the detail (mean |Laplacian|) on both sides of the seam, and the sizes of the key frames there.

usage: python3 render/verify_seam.py out/final46/字与心事_H265_v4.6.mp4 [out/full45]
       (with the rendered frames: the same measures on them, and the cuts left out of the key-frame list)"""
import os
import subprocess
import sys
import tempfile

import numpy as np

mp4 = sys.argv[1]
frames_dir = sys.argv[2] if len(sys.argv) > 2 else None
tmp = tempfile.mkdtemp(prefix="seam_")


def probe(args):
    return subprocess.run(["ffprobe", "-v", "error", *args], capture_output=True, text=True, check=True).stdout


W, H = (int(v) for v in probe(["-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", mp4]).strip().split(","))
types = [l.strip().strip(",") for l in probe(["-select_streams", "v:0", "-show_entries", "frame=pict_type", "-of", "csv=p=0", mp4]).splitlines() if l.strip()]
N = len(types)
keys = [i for i, t in enumerate(types) if t == "I"]


def steps(inp):
    """mean |ΔY| between frames i and i + 1, i = 0 … N − 2"""
    out = os.path.join(tmp, "s.txt")
    subprocess.run(["ffmpeg", "-v", "error", *inp, "-vf",
                    f"format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file={out}",
                    "-f", "null", "-"], check=True)
    return np.array([float(l.split("=")[1]) for l in open(out) if "YAVG" in l])


def gray(inp, pick):
    """luma planes of the frames in pick (stream order)"""
    out = os.path.join(tmp, "g.y")
    sel = "+".join(f"eq(n\\,{f})" for f in pick)
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inp, "-vf", f"select='{sel}',format=gray", "-vsync", "0", "-f", "rawvideo", out], check=True)
    a = np.fromfile(out, dtype=np.uint8).reshape(-1, H, W).astype(float)
    return dict(zip(sorted(pick), a))


def lap(y):
    return np.abs(4 * y[1:-1, 1:-1] - y[:-2, 1:-1] - y[2:, 1:-1] - y[1:-1, :-2] - y[1:-1, 2:]).mean()


def report(name, inp):
    st = steps(inp)
    last = N - 1
    fr = gray(inp, [0, 1, 2, 3, 4, last - 4, last - 3, last - 2, last - 1, last])
    seam = np.abs(fr[0] - fr[last]).mean()
    around = np.concatenate([st[last - 7:last], st[0:6]])
    loc = np.median(around)
    print(f"{name}: {N} frames; seam {last} → 0: {seam:.2f} against {loc:.2f} around it (×{seam / loc:.1f}); "
          f"steps just before and after: {st[last - 1]:.2f}, {st[0]:.2f}")
    print(f"   detail (mean |Laplacian|): frames {last - 4}–{last} {np.mean([lap(fr[f]) for f in range(last - 4, last + 1)]):.2f}, "
          f"frames 0–4 {np.mean([lap(fr[f]) for f in range(5)]):.2f}")
    return st, seam, loc


st, seam, loc = report("decoded", ["-i", mp4])
src = None
if frames_dir:
    src, sseam, sloc = report("rendered", ["-framerate", "30", "-start_number", "0", "-i", os.path.join(frames_dir, "f_%05d.jpg")])

# the film's other key frames: the step into each against the steps round it (a cut in the picture
# itself — the rendered step large against its own surroundings — is left out)
rows = []
for k in keys[1:]:
    s = k - 1
    win = [j for j in range(s - 6, s + 7) if 0 <= j < len(st) and j != s]
    if src is not None:
        if src[s] > 3 * max(np.median(src[win]), 0.5):
            continue
    elif st[s] > 10:   # without the rendered frames: a step this large is the picture's own cut
        continue
    rows.append((k, st[s] / max(np.median(st[win]), 1e-3)))
worst = max(rows, key=lambda r: r[1])
print(f"other key frames ({len(rows)}, cuts left out): step against the steps round it at most ×{worst[1]:.1f} (frame {worst[0]})")
pk = [l.split(",") for l in probe(["-select_streams", "v:0", "-show_entries", "packet=pts_time,size", "-of", "csv=p=0", mp4]).splitlines() if l.strip()]
size = {round(float(t) * 30): int(z) for t, z in pk}
print(f"key frame sizes: frame 0 {size[0]} B, last key frame {keys[-1]} {size[keys[-1]]} B")
# the bar: ×2 (v4.5's single file: the seam ×7.7, its other key frames at most ×1.7 where the picture is still)
ok = seam / loc <= 2.0
print(f"seam: ×{seam / loc:.1f}", "OK (≤ ×2)" if ok else "JUMP (> ×2): the two sides were coded at different qualities")
