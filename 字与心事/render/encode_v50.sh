#!/usr/bin/env bash
# v5.0: both deliveries from out/full50_all (render/link_v50.sh): the 高清版 as v4.5 encoded it
# (H.264 CRF 15, split zip), the H.265 single file as v4.6 encoded it (render/encode_v46.sh: the seam window)
set -euo pipefail
FRAMES=/home/claude/zxs/out/full50_all
AUDIO=${AUDIO:-/home/claude/zxs/out/audio/v50_master.wav}
DIR=/home/claude/zxs/out/final50; mkdir -p "$DIR"
HQ="$DIR/字与心事_高清版_v5.0.mp4"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -i "$AUDIO" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -profile:v high -tune film \
  -x264-params "keyint=60:min-keyint=30" -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$HQ"
FRAMES=$FRAMES AUDIO=$AUDIO DIR=$DIR bash /home/claude/zxs/render/encode_v46.sh
mv "$DIR/字与心事_H265_v4.6.mp4" "$DIR/字与心事_H265_v5.0.mp4"
rm -rf "$DIR/hq_zip" && mkdir -p "$DIR/hq_zip"
cd "$DIR" && zip -q -0 -s 27m "$DIR/hq_zip/字与心事_高清版_v5.0.zip" "$(basename "$HQ")"
python3 - "$DIR/hq_zip" <<'PY'
import struct, sys
d = sys.argv[1] + "/字与心事_高清版_v5.0"
b = bytearray(open(d + ".z01", "rb").read(64))
struct.pack_into("<H", b, 10, struct.unpack("<H", b[10:12])[0] | 0x800)
open(d + ".z01", "r+b").write(b)
t = bytearray(open(d + ".zip", "rb").read())
j = t.rfind(b"PK\x01\x02")
struct.pack_into("<H", t, j + 8, struct.unpack("<H", t[j + 8:j + 10])[0] | 0x800)
open(d + ".zip", "wb").write(t)
PY
ls -la "$DIR" "$DIR/hq_zip"
