#!/usr/bin/env bash
# v4.7: only the frames the credit change touches, from a frozen bundle into out/full47: every frame with
# a credit (150–190, 276–505, 530–657, 675–777, 807–972, 1357–1448, 1533–1634, 1695–1900: all of them at
# 85% now, the pale ones as well as the dark). The frames that show the source (1965–2229) are left as
# v4.5 rendered them (the user: only the credits are to change), so the code seen there has HUD.tsx's
# old values in its two credit lines. Every other frame is v4.5's (out/full45);
# encode from out/full47_all (render/link_v47.sh). Resumable: run it again after an interruption.
cd /home/claude/zxs/render
B=${1:-bundle_v47.js}
export OUT=/home/claude/zxs/out/full47 WATCHDOG_MS=300000
for r in "150 192" "276 507" "530 659" "675 779" "807 974" "1357 1450" "1533 1636" "1695 1902"; do
  set -- $r
  CH=120 bash queue_v44.sh $1 $2 $B
done
echo "CHAIN_V47_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v47.log
