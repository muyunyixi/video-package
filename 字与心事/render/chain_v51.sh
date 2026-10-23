#!/usr/bin/env bash
# v5.1: only the frames the two changes touch, from the frozen bundle (render/build_v51.mjs) into out/full51:
#   - 雀跃 blooms to 2.0 instead of 4.4, and the dense ink that lands above the line dries pale
#     (scenes/inkheart.ts): from the dense drop to the cut, 540–659
#   - the 灯笼锦 lattice with every bar on its line (lib/lattice.ts): the pavilion's three windows from the
#     frame they come into the picture to the dive's end (1831–1966), and the lattice's shadow on the
#     ending's page (1966–2120: shadeA > 0), whose cross-bars now lie level (scenes/Ending.tsx: the turn
#     cancels the shear; they rose 0.57° to the right)
# The bundle shows v4.5's listing behind the page (as the frames after 2120 do). Every other frame is
# v5.0's (out/full50_all). Encode from out/full51_all (render/link_v51.sh). Resumable: run it again.
cd /home/claude/zxs/render
B=${1:-bundle_v51.js}
export OUT=/home/claude/zxs/out/full51 WATCHDOG_MS=300000
for r in "540 660" "1831 2121"; do
  set -- $r
  CH=120 bash queue_v44.sh $1 $2 $B
done
echo "CHAIN_V51_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v51.log
