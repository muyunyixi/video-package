import glob, os, sys
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
w = int(sys.argv[4]) if len(sys.argv) > 4 else 640
h = w * 9 // 16
files = sorted(glob.glob(os.path.join(src, "*.jpg")))
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (30, 30, 30))
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
for i, f in enumerate(files):
    im = Image.open(f).resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 74, y + 26], fill=(0, 0, 0))
    d.text((x + 4, y + 2), os.path.basename(f)[2:7], fill=(255, 255, 0), font=font)
sheet.save(out, quality=90)
print(out, len(files))
