"""Scales the 2x shots to the cover's 1080×1440 and makes a card-size proof (180 px wide, as on a
phone's two-column feed). usage: python3 cover/finish.py IN_2X OUT [CARD]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
im.resize((1080, 1440), Image.LANCZOS).save(sys.argv[2])
if len(sys.argv) > 3:
    im.resize((180, 240), Image.LANCZOS).save(sys.argv[3])
print(sys.argv[2])
