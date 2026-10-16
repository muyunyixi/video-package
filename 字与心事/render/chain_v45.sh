#!/usr/bin/env bash
# v4.5: all 2230 frames from a frozen copy of the bundle into out/full45, one browser at a time
# (SwiftShader takes both cores). First the moon (1115–1475: its forming has to come out of one browser
# that starts at 1115, README), then the rest of the film, and last the frames that show the source
# (1965–2185: the listing through the page, the coda) and the loop (2185–2229, one browser: its page lets
# go over the listing), which any change to the code would change. Resumable: frames already on disk
# are skipped; after an interruption run it again.
# usage: chain_v45.sh bundle_v45.js   (a frozen copy of out/bundle.js, in out/)
cd /home/claude/zxs/render
B=${1:-bundle_v45.js}
export OUT=/home/claude/zxs/out/full45 WATCHDOG_MS=300000
for r in "1115 1475" "0 1115" "1475 1965" "1965 2185"; do
  set -- $r
  CH=120 bash queue_v44.sh $1 $2 $B
done
CH=45 bash queue_v44.sh 2185 2230 $B
echo "CHAIN_V45_DONE $(date +%T)" >> /home/claude/zxs/out/chain_v45.log
