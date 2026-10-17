#!/usr/bin/env bash
# v4.7: the film's 2230 frames for encoding, as links: the re-rendered frame from out/full47 where there
# is one, v4.5's from out/full45 otherwise
set -euo pipefail
A=/home/claude/zxs/out/full47_all; mkdir -p "$A"
for f in $(seq 0 2229); do
  n=f_$(printf %05d $f).jpg
  if [ -f /home/claude/zxs/out/full47/$n ]; then ln -sf /home/claude/zxs/out/full47/$n "$A/$n"; else ln -sf /home/claude/zxs/out/full45/$n "$A/$n"; fi
done
echo "linked $(ls "$A" | wc -l) frames, $(ls /home/claude/zxs/out/full47 | wc -l) re-rendered"
