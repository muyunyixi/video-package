"""Makes cover/clockCover.ts and cover/post.ts from the film's own files (src/scenes/clock.ts,
src/lib/post.ts): the same code with the title for its line, the cover's size and camera. Run again
if the film's 更漏 changes. usage: python3 cover/make_clock_copy.py"""
Z = "/home/claude/zxs"

post = open(f"{Z}/src/lib/post.ts", encoding="utf-8").read()
post = post.replace('import { W, H } from "./util";', 'import { W, H } from "./size";')
post = "// The film's post-processing (src/lib/post.ts), at the cover's size (cover/size.ts) instead of 1920×1080.\n" + post
open(f"{Z}/cover/post.ts", "w", encoding="utf-8").write(post)

s = open(f"{Z}/src/scenes/clock.ts", encoding="utf-8").read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep('import cues from "../cues.json";', 'import cues from "../src/cues.json";')
rep('import { makePost } from "../lib/post";', 'import { makePost } from "./post";')
rep('import { makeCanvas } from "../lib/glyph";', 'import { makeCanvas } from "../src/lib/glyph";')
rep('import { lineInk, glyphInk } from "../lib/ink";', 'import { lineInk, glyphInk } from "../src/lib/ink";')
rep('import { HW, W, H, prog, smooth, easeInOutCubic, clamp } from "../lib/util";',
    'import { HW, prog, smooth, easeInOutCubic, clamp } from "../src/lib/util";\nimport { W, H } from "./size";')
rep('import type { SceneHandle } from "../lib/ThreeLayer";', 'import type { SceneHandle } from "../src/lib/ThreeLayer";')
rep('const LINE = "昔人多恨漏声长，";', 'const LINE = "字与心事"; // the cover: the title written in light on the water')
rep('const FOCAL = 540 / Math.tan((15 * Math.PI) / 180); // px, for a 30° vertical field of view',
    "const FOCAL = H / 2 / Math.tan((15 * Math.PI) / 180); // px, for a 30° vertical field of view (at the cover's height)")
rep("export function createClock(renderer: THREE.WebGLRenderer): SceneHandle {",
    "export function createClockCover(renderer: THREE.WebGLRenderer): SceneHandle {")
rep("      const { pos, look } = cameraAt(f);",
    "      // the cover sets its own camera ([x, y, z] position and look-at, world units)\n"
    "      const CC = (globalThis as any).__coverCam;\n"
    "      const { pos, look } = CC ? { pos: new THREE.Vector3(...CC.pos), look: new THREE.Vector3(...CC.look) } : cameraAt(f);")
hdr = ("// 封面 · 漏声长: the film's 更漏 (src/scenes/clock.ts, v4.4) copied for the cover by\n"
       "// cover/make_clock_copy.py, unchanged but for: the line is the title 字与心事, the frame is the\n"
       "// cover's 3:4 (cover/size.ts; its focal length for the same 30° field of view), the camera is set by\n"
       "// the cover (window.__coverCam), the post is at the cover's size. The film's file is untouched.\n")
open(f"{Z}/cover/clockCover.ts", "w", encoding="utf-8").write(hdr + s)
print("ok")
