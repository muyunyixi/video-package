#!/usr/bin/env bash
# v5.5: the moon scene's houses (lib/roofs.ts: no far town; her side a row of hutong houses as high as the
# south's, both houses' windows one big lattice window each, mirrored about the crease; the gates lifted,
# the caps of both halves as tiles) — 1115–1474, from the frozen bundle (render/build_v51.mjs
# out/bundle_v55.js) into out/full55. Every other frame is v5.2's (out/full52_all). Then render/link_v55.sh.
#
# The chunks must be the original ones, each rendered straight through from its first frame (1115, 1235,
# 1355): the moon's forming and breath (about 1185–1230) come out as in the film only when the scene has
# run from 1115 (rendered alone, or from 1190, they come out brighter; see 整体制作指南 第七节). So after the
# render, check 1115–1216 against the film frame by frame; a chunk resumed part-way (a watchdog retry)
# has to be rendered again from its first frame.
cd /home/claude/zxs/render
OUT=/home/claude/zxs/out/full55 WATCHDOG_MS=300000 CH=120 bash queue_v44.sh 1115 1475 ${1:-bundle_v55.js}
echo "CHAIN_V55_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v55.log
