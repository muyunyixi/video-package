#!/usr/bin/env bash
# v5.5: the whole film as links — the frame from out/full55 where there is one (1115–1474), else v5.2's
# (out/full52_all)
set -euo pipefail
A=/home/claude/zxs/out/full55_all
mkdir -p "$A"
for f in $(seq 0 2229); do
  n=$(printf "f_%05d.jpg" $f)
  if [ -f /home/claude/zxs/out/full55/$n ]; then src=/home/claude/zxs/out/full55/$n; else src=$(readlink -f /home/claude/zxs/out/full52_all/$n); fi
  ln -sfn "$src" "$A/$n"
done
ls "$A" | wc -l
