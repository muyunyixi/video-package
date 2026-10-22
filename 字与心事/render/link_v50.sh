#!/usr/bin/env bash
# v5.0: the whole film as links — the frame from out/full50 where there is one, else v4.7's
# (out/full47_all, itself links to v4.5's frames and v4.7's credit frames)
set -euo pipefail
A=/home/claude/zxs/out/full50_all
mkdir -p "$A"
for f in $(seq 0 2229); do
  n=$(printf "f_%05d.jpg" $f)
  if [ -f /home/claude/zxs/out/full50/$n ]; then src=/home/claude/zxs/out/full50/$n; else src=$(readlink -f /home/claude/zxs/out/full47_all/$n); fi
  ln -sfn "$src" "$A/$n"
done
ls "$A" | wc -l
