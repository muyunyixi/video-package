#!/usr/bin/env bash
# v5.6: one red, 朱砂 (#c0302c), as the film shows it — the thread of 一线 (one silk thread all the way, its
# running lights kept), 心事 and the rule and the thread in the title, the send button, the bubbles, 红笺小字,
# 懂, the moon's 月 chips, the listing's Chinese strings and the cards that carry them home — and the fold
# no longer flares at 不同 (scenes/spring.ts). From the frozen bundle (render/build_v51.mjs
# out/bundle_v56.js) into out/full56; every other frame is v5.5's (out/full55_all). Then render/link_v56.sh.
# The moon's chunk (1115–1234) is rendered straight through from 1115, as the film was (see 整体制作指南
# 第七节).
cd /home/claude/zxs/render
Q() { OUT=/home/claude/zxs/out/full56 WATCHDOG_MS=300000 CH=120 bash queue_v44.sh "$1" "$2" ${B:-bundle_v56.js}; }
Q 0 270        # typing (the send button), the title
Q 270 540      # 一线, and her phone after it
Q 712 780      # 南北: the fold
Q 886 1115     # 更漏 into 往事: the bubbles
Q 1115 1235    # the moon's chips (straight from 1115)
Q 1467 1965    # 读懂 and 灯火: the bubble, 懂
Q 2110 2230    # the listing's strings, the cards home
echo "CHAIN_V56_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v56.log
