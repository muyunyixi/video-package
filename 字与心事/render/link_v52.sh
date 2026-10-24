#!/usr/bin/env bash
# v5.2: the whole film as links — the frame from out/full52 where there is one, else v5.1's
# (out/full51_all)
set -euo pipefail
A=/home/claude/zxs/out/full52_all
mkdir -p "$A"
for f in $(seq 0 2229); do
  n=$(printf "f_%05d.jpg" $f)
  if [ -f /home/claude/zxs/out/full52/$n ]; then src=/home/claude/zxs/out/full52/$n; else src=$(readlink -f /home/claude/zxs/out/full51_all/$n); fi
  ln -sfn "$src" "$A/$n"
done
ls "$A" | wc -l
