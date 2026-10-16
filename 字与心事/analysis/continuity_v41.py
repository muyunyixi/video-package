# v4.1 continuity check over the rendered frames: the mean difference between each frame and the next,
# on a small grey copy; a step much larger than the steps either side of it (outside the film's own
# cuts) is a jump — e.g. a stretch rendered in another session that came out differently.
# usage: python3 continuity_v41.py FRAMES_DIR [N]
import os, sys
import numpy as np
from PIL import Image

D = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 2230
prev = None
steps = []
for f in range(N):
    im = Image.open(os.path.join(D, f"f_{f:05d}.jpg")).convert("L").resize((240, 135), Image.BILINEAR)
    a = np.asarray(im).astype(float)
    if prev is not None:
        steps.append(np.abs(a - prev).mean())
    prev = a
s = np.array(steps)  # s[i] = step from frame i to i + 1
flag = []
for i in range(len(s)):
    around = np.concatenate([s[max(0, i - 4):i], s[i + 1:i + 5]])
    base = np.median(around) if len(around) else 0
    if s[i] > 3 * base + 1.5:
        flag.append((i, i + 1, round(float(s[i]), 2), round(float(base), 2)))
print(f"{len(s)} steps; median {np.median(s):.2f}; flagged {len(flag)}")
for x in flag:
    print("  %d→%d  step %.2f  (around %.2f)" % x)
