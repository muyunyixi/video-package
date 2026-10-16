#!/usr/bin/env bash
# Two-pass loudness master: glue compression, then -14 LUFS / -1.2 dBTP.
# MEASURE=file (v4.4): take the first pass's loudness measurements from that file instead of IN — the
# premaster of the version before — so a small local change (v4.4: the code coda's sounds) does not
# shift the level of the whole master; everywhere else the master comes out as it did.
set -euo pipefail
IN="$1"; OUT="$2"
MEASURE=${MEASURE:-$IN}
PRE="equalizer=f=3000:t=q:w=1.2:g=2.5,highshelf=f=4200:g=6.5,lowshelf=f=55:g=2,acompressor=threshold=-21dB:ratio=2.2:attack=12:release=160:knee=6:makeup=1.5"
J=$(ffmpeg -hide_banner -nostats -i "$MEASURE" -af "$PRE,loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
MI=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_i'])")
MTP=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_tp'])")
MLRA=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_lra'])")
MTH=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_thresh'])")
OFF=$(echo "$J" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['target_offset'])")
ffmpeg -hide_banner -loglevel error -y -i "$IN" -af "$PRE,loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:offset=$OFF:linear=true,alimiter=limit=0.87:attack=3:release=50:level=false,aresample=48000" -c:a pcm_s16le "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|LRA:|Peak:" | tail -4
