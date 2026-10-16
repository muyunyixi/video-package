#!/usr/bin/env bash
# a preview clip of frames [FROM, TO) of the v4.5 render, with the mastered score under it
# usage: preview_v45.sh NAME FROM TO   (SRC= frames folder, AUDIO= mastered score)
set -euo pipefail
NAME=$1; A=$2; Z=$3
SRC=${SRC:-/home/claude/zxs/out/full45}
AUDIO=${AUDIO:-/home/claude/zxs/out/audio/v45_master.wav}
mkdir -p /home/claude/zxs/out/preview45
OUT=/home/claude/zxs/out/preview45/$NAME.mp4
N=$((Z - A))
SS=$(python3 -c "print(f'{$A/30:.6f}')"); T=$(python3 -c "print(f'{$N/30:.6f}')")
ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number $A -i "$SRC/f_%05d.jpg" -ss $SS -t $T -i "$AUDIO" \
  -frames:v $N -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest "$OUT"
ls -la "$OUT"
