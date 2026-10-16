"""Copy of the film's frozen bundle whose WebGL renderers take window.__dpr as their pixel ratio, for
cover/plate.mjs (the film renders at a pixel ratio of 1). usage: python3 cover/make_bundle.py bundle_v43a.js"""
import sys
Z = "/home/claude/zxs/out"
s = open(f"{Z}/{sys.argv[1]}", encoding="utf-8").read()
n = s.count("setPixelRatio(1)")
open(f"{Z}/bundle_cover.js", "w", encoding="utf-8").write(s.replace("setPixelRatio(1)", "setPixelRatio(window.__dpr||1)"))
print("bundle_cover.js:", n, "renderers")
