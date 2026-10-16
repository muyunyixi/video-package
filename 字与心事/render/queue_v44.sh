#!/usr/bin/env bash
# v4.4: renders [FROM, TO) with a frozen copy of the bundle, resumable: fresh browser per chunk, frames
# already on disk are skipped, a chunk whose browser stalls exits through the watchdog and is retried.
# usage: OUT=dir CH=frames-per-chunk queue_v44.sh FROM TO BUNDLE
cd /home/claude/zxs/render
OUT=${OUT:-/home/claude/zxs/out/r44}
CH=${CH:-120}
A=$1; Z=$2; B=$3
TAG="q44_${A}_${Z}"
LOG=/home/claude/zxs/out/render_v44_${A}_${Z}.log
mkdir -p "$OUT"
for a in $(seq $A $CH $((Z - 1))); do
  b=$((a + CH)); [ $b -gt $Z ] && b=$Z
  for attempt in 1 2 3 4 5 6; do
    have=$(for f in $(seq $a $((b - 1))); do [ -f "$OUT/f_$(printf %05d $f).jpg" ] && echo x; done | wc -l)
    [ "$have" -ge $((b - a)) ] && break
    echo "== chunk $a-$b try $attempt (have $have) $(date +%T)" >> "$LOG"
    timeout 1500 node render.mjs --from $a --to $b --out "$OUT" --q 95 --skip 1 --bundle "$B" --tag "$TAG" >> "$LOG" 2>&1
    # only this queue's browser, found by its tag, never anyone else's
    ps -eo pid,args | grep -F -- "--zxs-tag=$TAG" | grep -v grep | awk '{print $1}' | xargs -r kill -9 2>/dev/null
  done
done
echo "RANGE_DONE $A $Z $(date +%T)" >> "$LOG"
