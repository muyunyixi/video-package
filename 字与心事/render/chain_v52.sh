#!/usr/bin/env bash
# v5.2: every ink mark that lands on the paper dries pale (scenes/inkheart.ts), from the dense drop to the
# cut, 540–659, from the frozen bundle (render/build_v51.mjs out/bundle_v52.js: v4.5's listing behind the
# ending, as before) into out/full52. Every other frame is v5.1's (out/full51_all). Then render/link_v52.sh.
cd /home/claude/zxs/render
OUT=/home/claude/zxs/out/full52 WATCHDOG_MS=300000 CH=120 bash queue_v44.sh 540 660 ${1:-bundle_v52.js}
echo "CHAIN_V52_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v52.log
