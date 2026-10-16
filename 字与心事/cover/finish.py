"""Scales the 2x shots to the cover's size and makes a card-size proof (1/6: 180 px wide for the 3:4 cover, as on
a phone's two-column feed; 240 px wide for the 4:3 one). usage: python3 cover/finish.py IN_2X OUT [CARD]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
wide = im.width > im.height
im.resize((1440, 1080) if wide else (1080, 1440), Image.LANCZOS).save(sys.argv[2])
if len(sys.argv) > 3:
    im.resize((240, 180) if wide else (180, 240), Image.LANCZOS).save(sys.argv[3])
print(sys.argv[2])
