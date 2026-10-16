#!/usr/bin/env bash
# v4.5 deliveries from the 2230 rendered frames (out/full45: the whole film rendered again by
# render/chain_v45.sh from bundle_v45.js) and the mastered score (score_v45.py, mastered with
# MEASURE=v44_premaster.wav: v4.4's level):
#   1) 高清版 — H.264 High, CRF 15 (the archive master), packed as a split zip (<28 MiB per part)
#   2) 单文件版 — H.265 Main (8-bit, hvc1), two-pass, sized to stay under 29.5 MiB
set -euo pipefail
FRAMES=${FRAMES:-/home/claude/zxs/out/full45}  # render/chain_v45.sh writes them there
AUDIO=${AUDIO:-/home/claude/zxs/out/audio/v45_master.wav}  # the mastered score (score_v45.py, mastered with MEASURE=v44_premaster.wav)
DIR=/home/claude/zxs/out/final45
mkdir -p "$DIR"
HQ="$DIR/字与心事_高清版_v4.5.mp4"
H265="$DIR/字与心事_H265_v4.5.mp4"
VB=${VB:-3100k}  # v4.4: 74.3 s at 3100k came to 28.94 MiB

n=$(ls "$FRAMES" | wc -l)
if [ "$n" -ne 2230 ]; then echo "frames: $n (expected 2230)"; exit 1; fi

ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -i "$AUDIO" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -profile:v high -tune film \
  -x264-params "keyint=60:min-keyint=30" -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$HQ"

cd "$DIR"
X265="keyint=60:min-keyint=30:aq-mode=3:psy-rd=2.0:psy-rdoq=1.0:rd=4:no-sao=1"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" \
  -c:v libx265 -preset slow -b:v "$VB" -pix_fmt yuv420p -profile:v main \
  -x265-params "$X265:pass=1:stats=x265_2pass.log" -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -i "$AUDIO" \
  -map 0:v -map 1:a -c:v libx265 -preset slow -b:v "$VB" -pix_fmt yuv420p -profile:v main \
  -x265-params "$X265:pass=2:stats=x265_2pass.log" -tag:v hvc1 \
  -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$H265"
rm -f x265_2pass.log x265_2pass.log.cutree

for f in "$HQ" "$H265"; do
  ffprobe -v error -show_entries format=duration,size,bit_rate -of compact "$f"
done

# 高清版 as a split zip: volumes of 27 MiB (.z01 … and .zip), the MP4 stored, not recompressed
rm -rf "$DIR/hq_zip" && mkdir -p "$DIR/hq_zip"
cd "$DIR" && zip -q -0 -s 27m "$DIR/hq_zip/字与心事_高清版_v4.5.zip" "$(basename "$HQ")"
# mark the entry name as UTF-8 (general-purpose bit 11) so unzip tools on any system show the
# Chinese file name correctly (Info-ZIP 3.0 in a POSIX locale leaves the bit unset)
python3 - "$DIR/hq_zip" <<'PY'
import struct, sys
d = sys.argv[1] + "/字与心事_高清版_v4.5"
b = bytearray(open(d + ".z01", "rb").read(64))
struct.pack_into("<H", b, 10, struct.unpack("<H", b[10:12])[0] | 0x800)
open(d + ".z01", "r+b").write(b)
t = bytearray(open(d + ".zip", "rb").read())
j = t.rfind(b"PK\x01\x02")
struct.pack_into("<H", t, j + 8, struct.unpack("<H", t[j + 8:j + 10])[0] | 0x800)
open(d + ".zip", "wb").write(t)
PY
ls -la "$DIR/hq_zip"
