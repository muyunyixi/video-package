#!/usr/bin/env bash
# v5.7: the whole film as links — the frame from out/full57 where there is one, else
# v5.6's (out/full56_all)
set -euo pipefail
A=/home/claude/zxs/out/full57_all
mkdir -p "$A"
for f in $(seq 0 2229); do
  n=$(printf "f_%05d.jpg" $f)
  if [ -f /home/claude/zxs/out/full57/$n ]; then src=/home/claude/zxs/out/full57/$n; else src=$(readlink -f /home/claude/zxs/out/full56_all/$n); fi
  ln -sfn "$src" "$A/$n"
done
ls "$A" | wc -l
