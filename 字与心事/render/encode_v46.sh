#!/usr/bin/env bash
# v4.6 · the H.265 single file encoded again from v4.5's frames (out/full45, unchanged) so that the loop
# seam holds after compression (2026-10-17: on 抖音 and 小红书, played end to start, the film "闪一下" at
# the seam).
#
# What v4.5's two-pass encode did there: the rate control coded the film's last groups of pictures (key
# frames at 2123 and 2183) finer than the first (the I-frames 170 KB, 135 KB and 56 KB; the other frames
# 28 KB, 16 KB and 2.3 KB a frame), so the film's last second kept its per-frame grain and frame 0 came out
# smooth. Played end to start, the whole picture's texture changed at once: the step 2229 → 0 was 1.18
# (mean |ΔY|) against 0.15 on either side, 7.7 times, and the detail (mean |Laplacian|) fell from 3.87 to
# 2.57; the rendered frames step 1.77 → 1.77 → 1.77 across it and keep 5.73 on both sides (《整体制作指南》
# 8.8). render/verify_seam.py measures it on the decoded file.
#
# What does not fix it (tried on a 100-frame clip across the seam, 2190–2229 + 0–59, and once on the whole
# film, 2026-10-17): one fixed QP on both sides (the whole film with QP 26 from a key frame forced at 2190
# and on 0–59: ×5.1, the detail now even, 3.77 and 3.66; on the clip QP 26 ×4.3, 30 ×14.8, 33 ×18.9),
# less psy (×3.9–4.0), a temporal denoiser before the encoder (×10–14), even a near-still source (tmedian,
# the rendered frames stepping 0.15: ×39). It is not the grain alone: frame 0 is an I-frame, coded fresh,
# while the frames before the seam carry what the P-frames made of the motion before them (the characters
# going home); at any coarse QP the two textures differ.
# What does: coding the frames round the seam finely enough that the picture there follows the rendered
# frames (the grain alive from frame to frame, as in the 高清版), so that frame 0 meets a picture already
# close to itself: on the clip QP 19 ×1.2, QP 22 ×1.8–1.9.
# So: a fine window over the last 18 frames (2212–2229: it begins while the camera is still moving, steps
# 8–12, where the change of texture cannot be seen) and the first 13 (0–12: after it the grain stills again
# gradually, steps 1.0 → 0.3), QP 21. On the whole film that gave ×1.7, but the last five frames came out
# calmer than the first ones (steps 0.26–0.38 against 1.0–1.4: at the end of the stream they are B-frames
# with nothing after them to lean on, and a B-frame's two references average the grain away), so the
# grain still started moving at the seam; the film's last ten frames (2220–2229, the still ones) get QP 18.
# The rest of the film as before: two passes, the same x265 settings, the average rate 3050k instead of
# 3100k so that the window's extra bits keep the file under 29.5 MiB.
# Result (2026-10-17, measured on the decoded file): the seam 1.69 against 1.15 round it, ×1.5 (the last
# five steps 0.63–1.26, the first five 1.08–1.23); the detail 4.82 and 5.20 on the two sides; the film's
# other key frames at most ×1.8; 30,777,076 bytes (29.35 MiB).
# The 高清版 is not encoded again: H.264 CRF 15 keeps the grain alive everywhere (its seam 1.82 against
# 1.26 round it, ×1.4; its other key frames mostly ×1.1).
set -euo pipefail
FRAMES=${FRAMES:-/home/claude/zxs/out/full45}
AUDIO=${AUDIO:-/home/claude/zxs/out/audio/v45_master.wav}
DIR=${DIR:-/home/claude/zxs/out/final46}
mkdir -p "$DIR"
H265="$DIR/字与心事_H265_v4.6.mp4"
VB=${VB:-3050k}
SEAM_Q=${SEAM_Q:-21}       # the window's QP
END_ZONE=${END_ZONE:-2212} # the window: from here to the last frame …
FIRST_END=${FIRST_END:-12} # … and from frame 0 to here
TAIL_Q=${TAIL_Q:-18}       # the film's still last frames, finer still
TAIL=${TAIL:-2220}

n=$(ls "$FRAMES" | wc -l)
if [ "$n" -ne 2230 ]; then echo "frames: $n (expected 2230)"; exit 1; fi

cd "$DIR"
X265="keyint=60:min-keyint=30:aq-mode=3:psy-rd=2.0:psy-rdoq=1.0:rd=4:no-sao=1:zones=0,$FIRST_END,q=$SEAM_Q/$END_ZONE,$((TAIL - 1)),q=$SEAM_Q/$TAIL,2229,q=$TAIL_Q"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" \
  -c:v libx265 -preset slow -b:v "$VB" -pix_fmt yuv420p -profile:v main \
  -x265-params "$X265:pass=1:stats=x265_2pass.log" -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -i "$AUDIO" \
  -map 0:v -map 1:a -c:v libx265 -preset slow -b:v "$VB" -pix_fmt yuv420p -profile:v main \
  -x265-params "$X265:pass=2:stats=x265_2pass.log" -tag:v hvc1 \
  -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$H265"
rm -f x265_2pass.log x265_2pass.log.cutree
ffprobe -v error -show_entries format=duration,size,bit_rate -of compact "$H265"
# then: python3 render/verify_seam.py "$H265" "$FRAMES" (the seam measured on the decoded file: ≤ ×2)
