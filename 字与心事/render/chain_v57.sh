#!/usr/bin/env bash
# v5.7: the north's ridge ends lift a little from the roof's own top edge, snow on them, and the snow along the
# ridges and the wall caps lies as snow (thinning to the ends, uneven, soft underneath) — lib/roofs.ts.
# 1115–1474 from the frozen bundle (render/build_v51.mjs out/bundle_v57.js) into out/full57, in the original
# chunks from their first frames (the moon's forming needs the run from 1115, see 整体制作指南 第七节).
# Every other frame is v5.6's (out/full56_all). Then render/link_v57.sh.
cd /home/claude/zxs/render
OUT=/home/claude/zxs/out/full57 WATCHDOG_MS=300000 CH=120 bash queue_v44.sh 1115 1475 ${1:-bundle_v57.js}
echo "CHAIN_V57_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v57.log
