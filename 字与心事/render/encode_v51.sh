#!/usr/bin/env bash
# v5.1: both deliveries from out/full51_all (render/link_v51.sh), both converted to BT.709 and tagged so.
#
# Colour. The frames are JPEGs, whose YCbCr is BT.601 (full range); until v5.0 the encodes kept that matrix
# and tagged it (bt470bg) with the primaries and transfer left unknown. A player or transcoder that honours
# the tag decodes it right; one that ignores it and takes the HD default, BT.709, does not: measured on the
# 子初 seal (frame 640), ΔE 7.5, the reds and the lamp oranges shift (the paper and the ink ΔE < 1). Now the
# frames are converted to BT.709 (limited range) and all three tags are written: right both ways.
#
# 高清版 = the upload version (2026-10-23: 抖音 asks for 1080p, 30 fps, 8–12 Mbps). Until v5.0 it was
# H.264 CRF 15: 20.7 Mbps on average, 67 Mbps at the title (6–7 s), 50 of the 75 seconds over 12 Mbps; the
# paper's grain is what costs. Every platform re-encodes the upload: on the hardest 4 s (frames 150–269,
# CRF 15 needs 47.6 Mbps there) a 12 Mbps upload is 8 dB below CRF 15 (PSNR 36.4 / 44.4) but after a
# simulated platform pass (x265, 3 Mbps) the two are 0.25 dB apart (31.75 / 32.0); on 540–659 they are
# equal. So: two passes, 12 Mbps on average, maxrate 16M with a 16M buffer, key frames every 2 s as before.
# Result: 11.92 Mbps on average, 110.7 MB, the seam ×1.8; the fullest seconds (the grain of the title, the loop seam) reach
# about 26 Mbps. Capping every second at 16 Mbps (maxrate 12M, buffer 4M) was tried and dropped: the loop
# seam then jumps (×2.4, and ×2.2 with the seam frames at QP 18–19): to keep the paper's grain alive from
# frame to frame across the seam the last and first half-second need about 150 KB a frame (36 Mbps, what
# v5.0's CRF 15 spent there), which only a large buffer lets the encoder borrow. The seam is what the viewer
# sees (the film loops); the platforms' advice is about the average.
# H.265 single file: as render/encode_v46.sh (the seam window), with the colour conversion.
set -euo pipefail
FRAMES=${FRAMES:-/home/claude/zxs/out/full51_all}
AUDIO=${AUDIO:-/home/claude/zxs/out/audio/v50_master.wav}
DIR=${DIR:-/home/claude/zxs/out/final51}
V=${V:-v5.1}
mkdir -p "$DIR"
HQ="$DIR/字与心事_高清版_$V.mp4"
H265="$DIR/字与心事_H265_$V.mp4"
n=$(ls "$FRAMES" | wc -l)
if [ "$n" -ne 2230 ]; then echo "frames: $n (expected 2230)"; exit 1; fi
VF="scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p"
TAGS=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
cd "$DIR"

# ---- 高清版 ---- (ONLY=hq or ONLY=h265 encodes just that one)
if [ "${ONLY:-}" != "h265" ]; then
HQ_RATE=(-b:v "${HQ_VB:-12M}" -maxrate "${HQ_MAX:-16M}" -bufsize "${HQ_BUF:-16M}")
X264="keyint=60:min-keyint=30${HQ_ZONES:+:zones=$HQ_ZONES}"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -vf "$VF" "${TAGS[@]}" \
  -c:v libx264 -preset slow -tune film -profile:v high "${HQ_RATE[@]}" -x264-params "$X264" \
  -pass 1 -passlogfile x264_2pass -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -i "$AUDIO" -map 0:v -map 1:a -vf "$VF" "${TAGS[@]}" \
  -c:v libx264 -preset slow -tune film -profile:v high "${HQ_RATE[@]}" -x264-params "$X264" \
  -pass 2 -passlogfile x264_2pass -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$HQ"
rm -f x264_2pass-0.log x264_2pass-0.log.mbtree
fi

# ---- H.265 single file (render/encode_v46.sh's settings) ----
if [ "${ONLY:-}" != "hq" ]; then
VB=${VB:-3050k}; SEAM_Q=${SEAM_Q:-21}; END_ZONE=${END_ZONE:-2212}; FIRST_END=${FIRST_END:-12}; TAIL_Q=${TAIL_Q:-18}; TAIL=${TAIL:-2220}
X265="keyint=60:min-keyint=30:aq-mode=3:psy-rd=2.0:psy-rdoq=1.0:rd=4:no-sao=1:zones=0,$FIRST_END,q=$SEAM_Q/$END_ZONE,$((TAIL - 1)),q=$SEAM_Q/$TAIL,2229,q=$TAIL_Q"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -vf "$VF" "${TAGS[@]}" \
  -c:v libx265 -preset slow -b:v "$VB" -profile:v main \
  -x265-params "$X265:pass=1:stats=x265_2pass.log" -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -i "$AUDIO" -map 0:v -map 1:a -vf "$VF" "${TAGS[@]}" \
  -c:v libx265 -preset slow -b:v "$VB" -profile:v main \
  -x265-params "$X265:pass=2:stats=x265_2pass.log" -tag:v hvc1 \
  -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$H265"
rm -f x265_2pass.log x265_2pass.log.cutree
fi

# ---- the 高清版 in 27 MB volumes (stored, UTF-8 names flagged, as v5.0) ----
rm -rf "$DIR/hq_zip" && mkdir -p "$DIR/hq_zip"
zip -q -0 -s 27m "$DIR/hq_zip/字与心事_高清版_$V.zip" "$(basename "$HQ")"
python3 - "$DIR/hq_zip/字与心事_高清版_$V" <<'PY'
import os, struct, sys
d = sys.argv[1]
if os.path.exists(d + ".z01"):
    b = bytearray(open(d + ".z01", "rb").read(64))
    struct.pack_into("<H", b, 10, struct.unpack("<H", b[10:12])[0] | 0x800)
    open(d + ".z01", "r+b").write(b)
t = bytearray(open(d + ".zip", "rb").read())
j = t.rfind(b"PK\x01\x02")
struct.pack_into("<H", t, j + 8, struct.unpack("<H", t[j + 8:j + 10])[0] | 0x800)
open(d + ".zip", "wb").write(t)
PY
ls -la "$DIR" "$DIR/hq_zip"
# then: VER=5.1 FR=out/full51_all D=out/final51 python3 render/verify_final.py
#       python3 render/verify_seam.py <each film> out/full51_all   (the seam on the decoded file: ≤ ×2)
