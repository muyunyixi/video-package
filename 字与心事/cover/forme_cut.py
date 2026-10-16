"""The forme of wooden type (title scene, 186) cut out of its 2x plate, for the 活字 cover: the
paper behind it is light and smooth, the wood dark, so the mask is the wood's darkness, closed and
feathered; the largest piece only.
usage: python3 cover/forme_cut.py PLATE OUT"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(np.float32)
L = a.mean(axis=2)
# the paper's own brightness, smooth: a wide median of the frame's border rows
bg = ndimage.uniform_filter(L, size=301)
dark = (L < bg - 38)
dark = ndimage.binary_closing(dark, structure=np.ones((25, 25)))
dark = ndimage.binary_fill_holes(dark)
lab, n = ndimage.label(dark)
sizes = ndimage.sum(dark, lab, range(1, n + 1))
keep = lab == (1 + int(np.argmax(sizes)))
ys, xs = np.where(keep)
x0, x1, y0, y1 = xs.min() - 8, xs.max() + 8, ys.min() - 8, ys.max() + 8
m = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
rgba = im.copy()
rgba.putalpha(m)
rgba.crop((x0, y0, x1, y1)).save(out)
print(out, (x0, y0, x1, y1), n)
