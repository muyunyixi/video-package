#!/usr/bin/env bash
# v5.0: only the frames the two changes touch, from a frozen bundle into out/full50:
#   - the credits lose their halo (it only ever showed in the light style): every frame where a credit
#     is on screen in the light style or fading out of it — 186–190, 277–455, 531–657, 885–972,
#     1534–1634 (lightAmt > 0 and the credit's opacity > 0; HUD.tsx)
#   - the pavilion's upstairs: three windows of one lattice, lit together by the last thread
#     (scenes/city.ts) — from the frame it comes into the picture to the dive's end, 1831–1964
# Every other frame is v4.7's (out/full47_all: v4.5's frames, the credit frames of v4.7); the frames
# that show the source (1965–2229) are left as they were. Encode from out/full50_all
# (render/link_v50.sh). Resumable: run it again after an interruption.
cd /home/claude/zxs/render
B=${1:-bundle_v50.js}
export OUT=/home/claude/zxs/out/full50 WATCHDOG_MS=300000
for r in "186 191" "277 456" "531 658" "885 973" "1534 1635" "1831 1965"; do
  set -- $r
  CH=120 bash queue_v44.sh $1 $2 $B
done
echo "CHAIN_V50_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v50.log
