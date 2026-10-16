"""Cuts a 3:4 window out of a plate and scales it to the cover's 1080×1440.
usage: python3 cover/crop.py PLATE X Y W OUT   (box W wide, W*4/3 tall, from (X, Y) in plate pixels)"""
import sys
from PIL import Image

plate, x, y, w, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
h = round(w * 4 / 3)
im = Image.open(plate).convert("RGB")
assert x >= 0 and y >= 0 and x + w <= im.width and y + h <= im.height, (im.size, x, y, w, h)
im.crop((x, y, x + w, y + h)).resize((1080, 1440), Image.LANCZOS).save(out)
print(out, (x, y, w, h))
