#!/usr/bin/env bash
# The v4.5 code package: source, score, render and encode scripts, the alignment checks, the cover's
# code (cover/, outside the film's source), docs, the vendor snapshots.
# usage: VENDOR_SNAPSHOT=/home/claude/vendor package_v45.sh OUTDIR   (writes OUTDIR/字与心事_代码包_v4.5.zip)
set -euo pipefail
mkdir -p "$1"
OUT=$(cd "$1" && pwd)  # absolute: the zip is made from inside it
Z=/home/claude/zxs
V=v4.5
P="$OUT/字与心事_代码包_$V"
rm -rf "$P"
mkdir -p "$P"/{src/scenes,src/lib,src/gen,audio,render,analysis,docs,cover,tools}
cp "$Z"/src/{HUD.tsx,Poem.tsx,Root.tsx,Vertical.tsx,Video.tsx,corpus.ts,cues.json} "$P/src/"
cp "$Z"/src/gen/{source.json,hw_metrics.json} "$P/src/gen/"
for f in Chat.tsx Ending.tsx Reply.tsx Rewrite.tsx city.ts clock.ts inkheart.ts moon.ts spring.ts thread.ts title.ts typing.ts; do cp "$Z/src/scenes/$f" "$P/src/scenes/"; done
for f in ThreeLayer.tsx birds.ts branches.ts cityCam.ts drift.tsx glyph.ts ink.ts lattice.ts paint.ts post.ts roofs.ts sdf.ts seep.tsx sparrow.ts textures.ts util.ts woodblock.ts; do cp "$Z/src/lib/$f" "$P/src/lib/"; done
cp "$Z"/audio/{synth.py,sfx2.py,score_v45.py,score_v44.py,score_v41.py,score_v40.py,score_v37.py,score_v36.py,score_v35.py,score_v34.py,score_v33.py,score_v32.py,score_v31.py,score_v3.py,master.sh} "$P/audio/"
cp "$Z"/render/{build.mjs,gen_source.mjs,hw_metrics.py,entry.tsx,index.html,render.mjs,queue_v44.sh,chain_v45.sh,encode_v45.sh,encode_v46.sh,preview_v45.sh,verify_final.py,verify_seam.py,sheet.py,package_v45.sh} "$P/render/"
cp "$Z"/analysis/{align_v41.py,hud_v41.py,search_v41.py,continuity_v41.py,visible_blank.py,grid_v45.py} "$P/analysis/"
# the grid typesetter (《字体处理规范》第六节): any text, laid out by the film's rules, as SVG outlines / PNG
cp "$Z"/tools/{gridtype.py,svg2png.mjs} "$P/tools/"
# the cover (《文案撰写指南》B 章): its own page and scripts, kept out of src/ so the film's code coda is not changed
cp "$Z"/cover/{app.tsx,kit.ts,lines.tsx,listing.ts,build.mjs,clockCover.ts,post.ts,size.ts,index.html,shoot.mjs,finish.py,measure.py,measure_ripple.py,make_clock_copy.py,plate.mjs,make_bundle.py,crop.py,forme_cut.py} "$P/cover/"
# this film's own documents (the scratch files that assembled the version record stay out); the three shared
# specs live once, in the repository's 公共/ and the project's root (2026-10-17: no copies here)
cp "$Z"/docs/{字与心事_项目文档.md,桃子诗词稿件.md,版本迭代与需求变更记录.md} "$P/docs/"
cp "$Z"/README.md "$P/README.md"
# the same vendor snapshots as v2 (Remotion core + player, three.js), as shipped then
cp -r "$VENDOR_SNAPSHOT" "$P/vendor"
# zipped by Python so every entry carries the UTF-8 name flag (Chinese paths read right everywhere)
cd "$OUT" && rm -f "字与心事_代码包_$V.zip" && python3 -c "
import os, zipfile
with zipfile.ZipFile('字与心事_代码包_$V.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dp, dn, fn in os.walk('字与心事_代码包_$V'):
        dn.sort()
        for f in sorted(fn):
            if '__pycache__' not in dp: z.write(os.path.join(dp, f))
"
ls -la "$OUT/字与心事_代码包_$V.zip"
