#!/usr/bin/env bash
# v5.1: the whole film as links — the frame from out/full51 where there is one, else v5.0's
# (out/full50_all, itself links to v5.0's, v4.7's and v4.5's frames)
set -euo pipefail
A=/home/claude/zxs/out/full51_all
mkdir -p "$A"
for f in $(seq 0 2229); do
  n=$(printf "f_%05d.jpg" $f)
  if [ -f /home/claude/zxs/out/full51/$n ]; then src=/home/claude/zxs/out/full51/$n; else src=$(readlink -f /home/claude/zxs/out/full50_all/$n); fi
  ln -sfn "$src" "$A/$n"
done
ls "$A" | wc -l
