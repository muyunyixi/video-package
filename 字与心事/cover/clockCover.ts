// 封面 · 漏声长: the film's 更漏 (src/scenes/clock.ts, v4.4) copied for the cover by
// cover/make_clock_copy.py, unchanged but for: the line is the title 字与心事, the frame is the
// cover's 3:4 (cover/size.ts; its focal length for the same 30° field of view), the camera is set by
// the cover (window.__coverCam), the post is at the cover's size. The film's file is untouched.
// Scene F1 · 昔人多恨漏声长， (26–29 s) — v4.0 「漏声长」
// No props this time (v4.0's first try painted the vessels, a lamp and a bamboo arrow, and they
// read as a cartoon). The camera has shrunk and sunk into the 受水壶 of a water clock at night:
// black water like a mirror, the bronze wall of the vessel curving away in the dark, and the line
// standing on the water in light, its reflection under it. Before the words there is only their
// light, a warm band lying on the water; then they write themselves in.
// Drops fall out of the dark above, one on every drip of the score — clear water — and land just in
// front of the line: each throws up a little column, which pinches off a droplet that rises and
// falls back in, and sends rings out through the reflection, which breaks and slowly closes again.
// The sound of the clock, seen, and long.
// One drop at a time: each shows only once the one before it has landed, so each is seen for one
// beat, falling while the last one's splash plays out (a splash is over in ten frames). The seventh
// comes after the sixth has landed, out of the dark and quick (it has fallen from higher up), and
// never lands: its fall runs down and it stops in the air right in front of the line, a breath above
// the water — the rings, everything stops with it; the sixth's splash has just ended, so only rings
// are left — and the camera comes down to the water and into it, until it fills the middle of the
// frame (radius 128, where the chat's first "typing" dot begins: match cut), the line behind it gone
// soft, and inside it, sharp and upside down, the line.
// v4.1: the pool dissolves in over 南北 (25.8–26.0 s), and the first drop is seen for a beat in the
// air before it lands on the first drip, at 26.5 s (v4.0 cut in on the drip itself, at 26.0 s: one heard
// a drop land that one had not seen fall). To make room, one beat was inserted into the film here: the
// chord that ends 南北 rings a beat longer, and everything from the first drip on is 0.5 s later. Round the vessel's wall, just above the water, a band of 云雷纹
// cast in the bronze, which only the line's light finds; and the water is never quite still.
// v4.3: a drop is round. The user: a falling drop is near enough a sphere, or a little flattened
// underneath — were these drawn long for looks? They were drawn long for speed: v4.0 and v4.1
// stretched each drop (and each droplet) along its fall by the distance it fell in three quarters
// of a frame, to stand for a shutter's blur — but as a solid, clear-edged, fully refracting
// ellipsoid, which reads as a long drop: no drop is that shape, and no camera sees one so. A drop
// this size (a water clock's, some 4 mm across) is held round by its surface tension; the air
// flattens drops only at speed (raindrops at 6.5–9 m/s); this one, fallen some 9 cm and meeting the
// water at about 1.4 m/s, by about 2%: under a pixel. So they are spheres, and the blur is now a
// shutter's, every moving thing seen across the exposure, each pixel taking it for the share of the
// exposure it was behind it ("the falling water", in the shader); and the shutter is short, as slow
// motion is shot (SHUTTER), so a drop is seen round.
// The wobble a drop keeps from breaking away (some 43 times a second at this size, for a second or
// two) is a pixel or two here, inside the blur, and is left out; the seventh, which stops and
// fills the frame, stops at an instant it is round. And the water, a mirror for the line, now has
// the drops in it as well: each one's reflection comes up out of the water to meet it.
// v4.4: what a ray leaving a drop sees. Until now a ray that left a drop going down was taken
// straight to the water, past the line standing in front of it. A drop shows the line upside down,
// so the line's lower half, which belongs in the drop's upper half, was missing there: a dark cap of
// water over a level edge. And a ray all but level met the water out beyond the vessel's wall and
// showed the sky there: a thin blue line across the drop's middle. Dark above, bright below, a
// horizon between: a ball of metal (the user, of the cover: "like an iron bead"). Now a ray leaving
// a drop sees what the camera's own rays see (main): the water only where the wall is not in front
// of it, the line in front of the water beyond it; and the reflection off a drop sees the water too.
//
// Everything is ray-traced in one fragment shader: the water's reflections bent by the rings, the
// drops' refraction (two surfaces, n = 1.33), the wall, the line (汇文明朝体, written in with the
// same noise seep as every line of the film); depth of field is the line's mip level.
import * as THREE from "three";
import cues from "../src/cues.json";
import { makePost } from "./post";
import { makeCanvas } from "../src/lib/glyph";
import { lineInk, glyphInk } from "../src/lib/ink";
import { HW, prog, smooth, easeInOutCubic, clamp } from "../src/lib/util";
import { W, H } from "./size";
import type { SceneHandle } from "../src/lib/ThreeLayer";

const K = cues.clock;
// v4.1: the pool dissolves in over 南北's last frames, done on the beat at 26.0 s (K.start), as the first
// drop comes into the top of the frame; it lands a beat later, on the first drip (26.5 s): a beat was
// inserted here, so 南北 keeps all its length and the drop is seen falling before it is heard
export const CLOCK_IN: [number, number] = [K.start - 6, K.start];
export const CLOCK_PREROLL = 7; // the layer is up this many frames before the pool is in (one before the dissolve)

// ---------- the world (units: the line's type size is 0.24) ----------
const LINE = "字与心事"; // the cover: the title written in light on the water
const LINE_AT = K.line1; // the first character; then one every 4 frames, punctuation in 2
const EM = 0.24;
const ZT = -5.0; // the line stands on the water here, centred on x = 0
const TB = 0.035; // its ink's foot, just clear of the water
const YF = TB + EM * 0.5; // the middle of the line's height: where the seventh stops
const ZD = -4.65; // the drops fall here, in front of the line's middle
const YS = 1.6; // where they let go (above the frame)
const FALLF = 18; // frames from letting go to the water
const G = (2 * YS) / (FALLF * FALLF);
const RD = 0.034, RD7 = 0.036; // a drop; the seventh, whose radius at the end is the chat dot's 128 px
const WALL = { cz: -3.0, r: 5.5, top: 7.0 };
// v4.1: the 云雷纹 band on the wall (heights; brightness of its hollows and of its raised lines)
const LEI = { y0: 0.2, y1: 0.44, hollow: 0.72, ridge: 1.8 };
const SWELL = 1.0; // v4.1: how much the water moves between the drops (1 = slopes of ~0.004)
// v4.3: the camera's shutter, centred on the frame's moment: open for an eighth of each frame (45°).
// The fall is slowed some 4.3 times (at the scale of a 4 mm drop its gravity is 0.52 m/s² of film
// time), so this is 1/1000 s of the real fall: short, as slow motion of falling water is shot, so a
// drop is seen as it is, round, and at its fastest a third of itself soft. (Tried first: cinema's
// usual half frame, 180° — from halfway down the drops were streaks, their glints drawn into lines.)
const SHUTTER = 1 / 8, SH = SHUTTER / 2;
const FOCAL = H / 2 / Math.tan((15 * Math.PI) / 180); // px, for a 30° vertical field of view (at the cover's height)

// ---------- the drops ----------
const IMPACTS = K.drips.slice(0, 6); // 26.0, 26.5 … 28.5 s
const L6 = IMPACTS[5];
// The seventh falls freely until three frames after the sixth lands, then its own clock runs down on
// a cosine over seven frames, so it eases to a stop at the line's middle (no jolt). v4.0 second draft:
// it no longer lets go early beside the sixth (the first draft had it in the frame from 28.3 s, with
// the sixth still falling: one drop too many, the user saw at once). It lets go from higher up
// instead, 24 frames of free fall before it slows, so it is above the frame until the sixth has
// landed (it shows from frame 857, 28.57 s) and comes in quicker than the others, 0.23 a frame.
const S7 = L6 + 3, SLOW7 = 7, STOP7 = S7 + SLOW7;
const TF7 = 24;
const R7 = S7 - TF7;
const YS7 = YF + 0.5 * G * (TF7 + SLOW7 / 2) ** 2; // 3.89, out of the frame
const t7 = (f: number) => {
  const u = f - R7;
  if (u <= 0) return 0;
  if (f <= S7) return u;
  const w = Math.min(SLOW7, f - S7);
  return S7 - R7 + 0.5 * w + (SLOW7 / (2 * Math.PI)) * Math.sin((Math.PI * w) / SLOW7);
};
const y7 = (f: number) => YS7 - 0.5 * G * t7(f) ** 2;
// time stops with it: the rings, the columns, the falling droplets hold where they are
const still = (f: number) => (f < STOP7 ? f : STOP7 + (f - STOP7) * 0.04);

// ---------- a splash (v4.1) ----------
// Over in ten frames, at the drops' own gravity (v4.0's droplet flew at a third of it and was still
// in the air 19 frames on, so when time stopped the sixth's droplet and column stood right under the
// seventh, as if hanging from it). The crater (0–6 frames after landing); the column, up 1–3 and down
// 3–5.5; the droplet it pinches off at 3, which rises to 5 and falls back in at 9, with a small ring of
// its own. The next drop is falling all the while (they land 15 frames apart); time stops 10 frames
// after the sixth landed, when only rings are left.
const HJ = 0.068, RJ = 0.0105; // the column's height, its radius
const RDP = 0.013; // the droplet
const T_PINCH = 3, T_APEX = 5, T_DOWN = 5.5;
const V0 = G * (T_APEX - T_PINCH); // per frame
const YP = HJ - RDP * 0.8; // it pinches off the column's tip
const T_BACK = T_APEX + Math.sqrt((2 * (YP + (V0 * V0) / (2 * G))) / G); // its centre meets the water: 9.0
// the column's height and the droplet's, at an age in (still) frames after the landing
const colH = (age: number) =>
  age < 1 || age >= T_DOWN
    ? 0
    : age < T_PINCH
      ? HJ * Math.sin(((Math.PI / 2) * (age - 1)) / (T_PINCH - 1))
      : HJ * Math.cos(((Math.PI / 2) * (age - T_PINCH)) / (T_DOWN - T_PINCH));
const dropletY = (age: number) => YP + V0 * (age - T_PINCH) - 0.5 * G * (age - T_PINCH) ** 2;

// ---------- the camera ----------
const P0 = new THREE.Vector3(-0.22, 1.08, 0.55), L0 = new THREE.Vector3(0, 0.15, ZT);
const P1 = new THREE.Vector3(0.06, 0.95, -0.35), L1 = new THREE.Vector3(0, 0.16, ZT);
const DIVE0 = L6 + 3; // the camera sets off after the seventh as it starts to slow
const PEND = new THREE.Vector3(0, YF, ZD + (RD7 * FOCAL) / 128); // its radius is 128 px from here

function cameraAt(f: number) {
  const e = easeInOutCubic(prog(f, K.start - CLOCK_PREROLL, DIVE0 + 4));
  const pos = P0.clone().lerp(P1, e);
  const look = L0.clone().lerp(L1, e);
  if (f > DIVE0) {
    // down to the water and into the stopped drop; the eye is on it before the camera arrives
    const d = prog(f, DIVE0, K.match - 1);
    look.lerp(new THREE.Vector3(0, y7(f), ZD), smooth(clamp(d * 1.5)));
    pos.lerp(PEND, easeInOutCubic(d));
  }
  return { pos, look };
}

// ---------- the line, as light: R = the characters, G = their glow ----------
function lineTexture() {
  const S = 200, TR = Math.round(S * 0.12);
  const chars = [...LINE];
  const L = lineInk(chars, S, chars.map((_, i) => (i ? TR : 0)));
  const TW = 2048, TH = 512;
  const c = makeCanvas(TW, TH);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, TW, TH);
  const x0 = TW / 2 - (L.boxL + L.boxR) / 2; // centred by its cells, the comma's blank trimmed (lib/ink)
  const base = TH / 2 - (L.inkT + L.inkB) / 2;
  ctx.font = `400 ${S}px ${HW}`;
  ctx.textBaseline = "alphabetic";
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "blur(14px)";
  ctx.fillStyle = "rgb(0,255,0)";
  chars.forEach((ch, i) => ctx.fillText(ch, x0 + L.xs[i], base));
  ctx.filter = "none";
  ctx.fillStyle = "rgb(255,0,0)";
  chars.forEach((ch, i) => ctx.fillText(ch, x0 + L.xs[i], base));
  // where each character's cell is (for its own moment of writing): midway between ink centres
  const mids = chars.map((ch, i) => {
    const g = glyphInk(ch, S);
    return (x0 + L.xs[i] + (g.l + g.r) / 2) / TW;
  });
  const bounds = [0, ...mids.slice(0, -1).map((m, i) => (m + mids[i + 1]) / 2), 1];
  const ats: number[] = [];
  let t = LINE_AT;
  chars.forEach((ch, i) => {
    if (i > 0) t += /[，。、]/.test(ch) ? 2 : 4;
    ats.push(t);
  });
  const scale = EM / S; // world units per texel
  const inkH = (L.inkB - L.inkT) * scale;
  const inkW = (L.boxR - L.boxL) * scale;
  return { canvas: c, w: TW * scale, h: TH * scale, yc: TB + inkH / 2, inkW, bounds, ats };
}

const N_DROPS = 7, N_IMP = 6, N_SPH = N_DROPS + N_IMP;

// v4.3 · the falling water, across the exposure. pickFalling: of the drops, the droplets and the
// columns, the one most in this ray's way while the shutter is open (B, its motion v, the span sp of
// the exposure to look at it in, whether it is a column), and the share of the exposure the falling
// water was in the ray's way (returned). A sphere moving by v while the shutter is open is in the
// ray's way for a part of it, found exactly (sweepSpan); a column, which grows and shrinks, is looked
// at KC moments across the exposure. tmax: where the ray meets the water (under it nothing is seen).
// Then (fallingWater) that one is shaded at up to KS moments across its span and averaged: a fast
// drop is a smear of all of itself, as a shutter sees it. Only the bodies alive this frame are in
// the arrays (uNCol, uNSph), and every costly loop is one a pixel can leave at once: SwiftShader runs
// both sides of an if for every pixel, but stops a loop once all the pixels it runs have left it
const KC = 12, KS = 8;
const pickFalling = /* glsl */ `
      float pickFalling(vec3 ro, vec3 rd, float tmax, out vec4 bB, out vec3 bV, out vec2 bSp, out float bCol){
        float best = 0.0, miss = 1.0;
        float jit = ign();
        bB = vec4(0.0); bV = vec3(0.0); bSp = vec2(0.0); bCol = 0.0;
        for (int i = 0; i < ${N_IMP}; i++){
          if (i >= uNCol) break;
          vec4 B = uCol[i];
          float hm = max(B.x, B.y);
          vec3 bc = vec3(0.0, 0.5 * hm, ZD) - ro; // a sphere round the tallest it is
          float bb = dot(bc, rd), br = max(0.5 * hm, B.z) + 0.002;
          int nk = dot(bc, bc) - bb * bb > br * br ? 0 : ${KC};
          float m = 0.0, s0 = -1.0, s1 = -1.0;
          for (int k = 0; k < ${KC}; k++){
            if (k >= nk) break;
            float s = (float(k) + jit) / ${KC}.0;
            float h = mix(B.x, B.y, s);
            vec3 n; float tf;
            float t = h < 0.002 ? -1.0 : hitEll(ro, rd, vec3(0.0, 0.5 * h, ZD), vec3(B.z, max(0.004, 0.5 * h), B.z), n, tf);
            if (t > 0.0 && t < tmax){ m += 1.0; if (s0 < 0.0) s0 = s; s1 = s; }
          }
          if (m <= 0.0) continue;
          float cov = m / ${KC}.0;
          miss *= 1.0 - cov;
          if (cov > best){ best = cov; bB = B; bV = vec3(0.0); bSp = vec2(s0, s1); bCol = 1.0; }
        }
        for (int i = 0; i < ${N_SPH}; i++){
          if (i >= uNSph) break;
          vec4 S = uSph[i];
          vec3 v = uSphV[i];
          vec2 sp = sweepSpan(ro, rd, S, v);
          if (sp.y <= sp.x) continue;
          vec3 n; float tf;
          float t = hitEll(ro, rd, S.xyz + v * (0.5 * (sp.x + sp.y)), vec3(S.w), n, tf);
          if (t <= 0.0 || t >= tmax) continue;
          float cov = sp.y - sp.x;
          miss *= 1.0 - cov;
          if (cov > best){ best = cov; bB = S; bV = v; bSp = sp; bCol = 0.0; }
        }
        return best > 0.0 ? 1.0 - miss : 0.0;
      }`;
const fallingWater = (name: string, shade: string) => /* glsl */ `
      vec3 ${name}(vec3 ro, vec3 rd, float tmax, vec3 bg, float path){
        vec4 B; vec3 v; vec2 sp; float isCol;
        float cover = pickFalling(ro, rd, tmax, B, v, sp, isCol);
        // still (or as good as): once, at its middle
        bool once = isCol < 0.5 && (sp.y - sp.x) * length(v) < 0.02 * B.w;
        int ns = cover <= 0.0 ? 0 : (once ? 1 : ${KS});
        float jit = ign();
        vec3 acc = vec3(0.0); float m = 0.0;
        for (int k = 0; k < ${KS}; k++){
          if (k >= ns) break;
          float s = ns == 1 ? 0.5 * (sp.x + sp.y) : mix(sp.x, sp.y, (float(k) + jit) / ${KS}.0);
          float h = mix(B.x, B.y, s);
          vec3 c = isCol > 0.5 ? vec3(0.0, 0.5 * h, ZD) : B.xyz + v * s;
          vec3 sc = isCol > 0.5 ? vec3(B.z, max(0.004, 0.5 * h), B.z) : vec3(B.w);
          vec3 n; float tf;
          float t = isCol > 0.5 && h < 0.002 ? -1.0 : hitEll(ro, rd, c, sc, n, tf);
          if (t > 0.0 && t < tmax){ acc += ${shade}(ro, rd, n, c, sc, t, path); m += 1.0; }
        }
        return m > 0.0 ? mix(bg, acc / m, cover) : bg;
      }`;

// a drop, a droplet or a column of clear water (an ellipsoid: centre c, semi-axes sc), hit at t:
// reflection and two refractions. path: how far the ray had come before (for the line's mip).
// As the camera sees it, what it shows of the water under it is the water (without the falling
// water's own reflections); in the water's mirror, plainer: that water as a dimmer mirror
// what a ray leaving the falling water sees, as the camera's own rays see it (main), less the falling
// water itself: the water where the wall is not in front of it, the line in front of the water beyond
// it; or, with no water ahead, the line, the wall, the sky (env). plain: the water as a flat, dimmer
// mirror (for the drops seen in the water's own mirror)
const seenFn = (name: string, plain: boolean) => /* glsl */ `
      vec3 ${name}(vec3 ro, vec3 rd, float path){
        float tw = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
        float twall = hitWall(ro, rd);
        if (twall > 0.0 && twall < tw) tw = 1e9;
        if (tw >= 1e8) return env(ro, rd, 0.0, path);
        vec3 col;${
          plain
            ? `
        vec3 w2 = vec3(rd.x, -rd.y, rd.z);
        float F2 = 0.02 + 0.98 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 5.0);
        col = vec3(0.004, 0.005, 0.007) + env(ro + rd * tw, w2, 0.0, path + tw) * (0.22 + 0.9 * F2);`
            : `
        col = waterShade0(ro + rd * tw, rd, path + tw, 0.0);`
        }
        vec4 ln = lineAt(ro, rd, 0.0, path);
        float tl = (uLineBox.w - ro.z) / rd.z;
        if (ln.a > 0.0 && tl > 0.0 && tl < tw) col = col * (1.0 - min(1.0, ln.a)) + ln.rgb;
        return col;
      }`;
const clearWater = (name: string, mirror: boolean) => /* glsl */ `
      vec3 ${name}(vec3 ro, vec3 rd, vec3 n, vec3 c, vec3 sc, float t, float path){
        vec3 p = ro + rd * t;
        float cosi = clamp(dot(-rd, n), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
        vec3 rf = reflect(rd, n);
        vec3 refl = ${mirror ? "env(p + n * 1e-3, rf, 0.0, path + t)" : "seen(p + n * 1e-3, rf, path + t)"};
        vec3 r1 = refract(rd, n, 1.0 / 1.33);
        vec3 n2; float tf;
        float dummy = hitEll(p + r1 * 1e-3, r1, c, sc, n2, tf);
        vec3 q = p + r1 * max(tf, 0.0);
        vec3 nq = normalize((q - c) / (sc * sc));
        vec3 r2 = refract(r1, -nq, 1.33);
        if (dot(r2, r2) < 0.5) r2 = reflect(r1, -nq);
        vec3 through = ${mirror ? "seenR" : "seen"}(q, r2, path + t);
        vec3 col = mix(through * vec3(0.93, 0.96, 0.98), refl, F);
        col += vec3(0.85, 0.9, 1.0) * pow(max(dot(rf, MOON), 0.0), 300.0) * 3.2;
        // the line's light, caught on the near side
        vec3 tol = normalize(vec3(0.0, uLineBox.z, uLineBox.w) - p);
        col += WARM * pow(max(dot(rf, tol), 0.0), 18.0) * 0.5;
        return col;
      }`;

export function createClockCover(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tx = lineTexture();
  const ltex = new THREE.CanvasTexture(tx.canvas);
  ltex.colorSpace = THREE.NoColorSpace;
  ltex.generateMipmaps = true;
  ltex.minFilter = THREE.LinearMipmapLinearFilter;
  ltex.anisotropy = 8;

  const uniforms = {
    uRes: { value: new THREE.Vector2(W, H) },
    uCam: { value: new THREE.Vector3() },
    uFwd: { value: new THREE.Vector3() },
    uRight: { value: new THREE.Vector3() },
    uUp: { value: new THREE.Vector3() },
    uFocal: { value: FOCAL },
    // v4.3: the falling drops (0–6) and the droplet each landing throws up (7–12), all spheres: (centre
    // at the frame's moment, radius), and how far each moves while the shutter is open
    uSph: { value: Array.from({ length: N_SPH }, () => new THREE.Vector4(0, -10, 0, 0)) },
    uSphV: { value: Array.from({ length: N_SPH }, () => new THREE.Vector3()) },
    // each landing's column: (its height as the shutter opens, as it closes, its radius, -)
    uCol: { value: Array.from({ length: N_IMP }, () => new THREE.Vector4(0, 0, 0, 0)) },
    // how many of each are in the air this frame (they come first in the arrays)
    uNSph: { value: 0 },
    uNCol: { value: 0 },
    // (age in frames, strength, age of the droplet's fall back into the water)
    uImp: { value: Array.from({ length: N_IMP }, () => new THREE.Vector3(-1, 1, -1)) },
    uLine: { value: ltex },
    uLineBox: { value: new THREE.Vector4(tx.w, tx.h, tx.yc, ZT) },
    uInkW: { value: tx.inkW },
    uBounds: { value: tx.bounds },
    uReveal: { value: new Array(8).fill(0) },
    uAura: { value: 0 },
    uDof: { value: 0 },
    uSeed: { value: 3.7 },
    uTime: { value: 0 }, // still time, for the swell
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    depthTest: false,
    transparent: true,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec2 uRes; uniform vec3 uCam, uFwd, uRight, uUp; uniform float uFocal;
      uniform vec4 uSph[${N_SPH}]; uniform vec3 uSphV[${N_SPH}]; uniform vec4 uCol[${N_IMP}]; uniform int uNSph, uNCol;
      uniform vec3 uImp[${N_IMP}];
      uniform float uAura, uDof, uSeed, uTime, uInkW;
      uniform sampler2D uLine; uniform vec4 uLineBox; uniform float uBounds[9]; uniform float uReveal[8];
      varying vec2 vUv;

      const float ZD = ${ZD.toFixed(3)};
      const vec3 WARM = vec3(1.0, 0.82, 0.6);
      const vec3 MOON = normalize(vec3(0.1, 0.95, -1.0)); // towards the cold light over the far rim

      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ return 0.5*vn(p) + 0.27*vn(p*2.07+3.1) + 0.15*vn(p*4.13+7.7) + 0.08*vn(p*8.3+1.9); }

      // ---------- intersections ----------
      // an ellipsoid (centre c, semi-axes sc); returns t (or -1), the normal, and where the ray leaves it
      float hitEll(vec3 ro, vec3 rd, vec3 c, vec3 sc, out vec3 n, out float tFar){
        vec3 o = (ro - c) / sc, v = rd / sc;
        float a = dot(v, v), b = dot(o, v), cc = dot(o, o) - 1.0;
        float disc = b*b - a*cc;
        tFar = -1.0;
        n = vec3(0.0, 1.0, 0.0);
        if (disc < 0.0) return -1.0;
        float q = sqrt(disc);
        float t0 = (-b - q) / a, t1 = (-b + q) / a;
        tFar = t1;
        float t = t0 > 1e-4 ? t0 : (t1 > 1e-4 ? t1 : -1.0);
        if (t < 0.0) return -1.0;
        vec3 p = ro + rd * t - c;
        n = normalize(p / (sc * sc));
        return t;
      }
      // v4.3: a sphere S (centre, radius) whose centre is at S.xyz + s v for s across the exposure
      // (-1/2 … 1/2): the part of the exposure in which the ray (rd of unit length) goes through it.
      // Its distance from the ray's line is a quadratic in s; empty when y <= x
      vec2 sweepSpan(vec3 ro, vec3 rd, vec4 S, vec3 v){
        vec3 e = S.xyz - ro;
        float ed = dot(e, rd), vd = dot(v, rd);
        float A = dot(v, v) - vd * vd;
        float B = dot(e, v) - ed * vd;
        float C = dot(e, e) - ed * ed - S.w * S.w;
        if (A < 1e-12) return C <= 0.0 ? vec2(-0.5, 0.5) : vec2(1.0, -1.0);
        float disc = B * B - A * C;
        if (disc < 0.0) return vec2(1.0, -1.0);
        float q = sqrt(disc);
        return vec2(max(-0.5, (-B - q) / A), min(0.5, (-B + q) / A));
      }
      // where across the exposure a pixel's looks fall (interleaved gradient noise: no two
      // neighbours alike, so a fast drop's few looks blend into a smear, not a row of ghosts)
      float ign(){ return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }
      // the line: a vertical plane z = uLineBox.w; returns its light (rgb) and coverage. blur is a mip
      // bias: the camera's depth of field, or the softening of a reflection far off
      vec4 lineAt(vec3 ro, vec3 rd, float blur, float path){
        if (abs(rd.z) < 1e-5) return vec4(0.0);
        float t = (uLineBox.w - ro.z) / rd.z;
        if (t <= 0.0) return vec4(0.0);
        vec3 p = ro + rd * t;
        vec2 uv = vec2(p.x / uLineBox.x + 0.5, 0.5 + (p.y - uLineBox.z) / uLineBox.y);
        // the light before the words: a soft warm glow on the water where they will stand
        float aura = uAura * exp(-pow((p.y - uLineBox.z) / 0.2, 2.0)) * exp(-pow(p.x / (0.5 * uInkW + 0.4), 2.0)) * step(-0.02, p.y);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(WARM * aura, aura * 0.5);
        // the texel footprint of one pixel along this ray's whole path picks the mip. blur is the
        // camera's circle of confusion on the line, in texels: a disc of taps on a coarser level
        float lod = log2(max(1e-3, (path + t) / uFocal / ${(EM / 200).toFixed(5)}));
        vec4 tx;
        // (v4.3: the taps in a loop left at once without blur: SwiftShader runs both sides of an if,
        // but stops a loop all of whose pixels have left it — the same picture, in less time)
        if (blur > 1.0) {
          float L = max(log2(blur / 2.5), lod);
          vec2 rad = blur / vec2(2048.0, 512.0);
          tx = vec4(0.0);
          for (int k = 0; k < 16; k++) {
            if (blur <= 1.0) break;
            float a = float(k) * 2.39996;
            float r = sqrt((float(k) + 0.5) / 16.0);
            tx += textureLod(uLine, uv + vec2(cos(a), sin(a)) * r * rad, L);
          }
          tx /= 16.0;
        } else tx = textureLod(uLine, uv, max(lod, 0.0));
        // each character writes itself in at its own moment: light arrives in blots and closes up
        float rv = 0.0;
        for (int i = 0; i < 8; i++) if (uv.x >= uBounds[i] && uv.x < uBounds[i + 1]) rv = uReveal[i];
        float n = fbm(uv * vec2(140.0, 36.0) + uSeed);
        float thr = 0.9 - 0.85 * rv;
        float m = smoothstep(thr - 0.05, thr + 0.05, n) * step(0.001, rv);
        m = max(m, step(0.999, rv));
        float a = tx.r * m;
        float glow = tx.g * smoothstep(0.0, 1.0, rv);
        vec3 c = WARM * (a * 1.18 + glow * 0.16 + aura);
        return vec4(c, max(max(a, glow * 0.4), aura * 0.5));
      }
      // the inside of the bronze vessel (we are inside it: the far root)
      float hitWall(vec3 ro, vec3 rd){
        vec2 o = ro.xz - vec2(0.0, ${WALL.cz.toFixed(2)});
        vec2 v = rd.xz;
        float a = dot(v, v), b = dot(o, v), c = dot(o, o) - ${(WALL.r * WALL.r).toFixed(3)};
        float disc = b*b - a*c;
        if (disc < 0.0 || a < 1e-8) return -1.0;
        return (-b + sqrt(disc)) / a;
      }
      // v4.1 · 云雷纹: a band of square spirals cast round the inside of the vessel, just above the
      // water, between two raised bowstring lines (弦纹); alternate spirals turn the other way.
      // uv = (arc length, height); fp = one pixel's footprint there (world units). Returns the relief:
      // 1 on the raised lines, 0 in the hollows; -1 outside the band
      const float LB0 = ${LEI.y0.toFixed(3)}, LB1 = ${LEI.y1.toFixed(3)};
      float leiwen(vec2 uv, float fp){
        if (uv.y < LB0 - 0.06 || uv.y > LB1 + 0.06) return -1.0;
        float aa = fp * 0.7;
        const float WL = 0.0065;
        float m = 1.0 - smoothstep(WL - aa, WL + aa, abs(uv.y - (LB1 + 0.03)));
        m = max(m, 1.0 - smoothstep(WL - aa, WL + aa, abs(uv.y - (LB0 - 0.03))));
        const float S = LB1 - LB0; // square cells, as tall as the band
        if (uv.y > LB0 && uv.y < LB1) {
          float cx = floor(uv.x / S);
          vec2 q = (vec2(fract(uv.x / S), (uv.y - LB0) / S) * 2.0 - 1.0) * 1.16;
          if (mod(cx, 2.0) > 0.5) q.x = -q.x;
          float r = max(abs(q.x), abs(q.y));
          if (r < 1.0 && r > 0.05) {
            // how far round its square ring the point is (0..4, anticlockwise from the right side's foot)
            float pp;
            if (q.x >= abs(q.y)) pp = (q.y + r) / (2.0 * r);
            else if (q.y >= abs(q.x)) pp = 1.0 + (r - q.x) / (2.0 * r);
            else if (-q.x >= abs(q.y)) pp = 2.0 + (r - q.y) / (2.0 * r);
            else pp = 3.0 + (q.x + r) / (2.0 * r);
            const float NT = 3.0; // turns
            float d = abs(fract(r * NT - pp * 0.25) - 0.5); // across the arm, in pitches
            float pitch = S / (2.0 * 1.16 * NT);
            float ap = aa / pitch;
            float arm = 1.0 - smoothstep(0.23 - ap, 0.23 + ap, d);
            arm *= smoothstep(0.12, 0.26, r); // the eye
            arm = mix(arm, 0.46, smoothstep(0.3, 0.7, fp / pitch)); // finer than a pixel: its mean
            m = max(m, arm);
          }
        }
        return m;
      }
      vec3 wallShade(vec3 p, float fp, float blur){
        float ang = atan(p.x, -(p.z - ${WALL.cz.toFixed(2)}));
        vec2 uv = vec2(ang * ${WALL.r.toFixed(2)}, p.y);
        // dark bronze, its casting and patina barely there
        float pat = fbm(uv * vec2(1.6, 2.2) + 11.0);
        vec3 c = mix(vec3(0.03, 0.026, 0.022), vec3(0.06, 0.05, 0.038), pat);
        c = mix(c, vec3(0.028, 0.04, 0.036), smoothstep(0.55, 0.8, fbm(uv * 3.1 + 4.0)) * 0.6);
        // light: the line's, warm and close to the water; the night's, cold and faint from above
        float d = length(p - vec3(0.0, uLineBox.z, uLineBox.w));
        float warm = 0.55 / (1.0 + d * d * 0.5);
        float cool = 0.3 + 0.35 * smoothstep(0.0, 3.0, p.y);
        // the band: relief shows only in the line's light, which comes in low and close and rakes
        // across it (the night's light is too faint and too diffuse to model it): so it is there
        // behind the words and gone towards the sides. The worn high points take that light, the
        // hollows keep their patina; the casting is worn smooth in places (most of it, in fact);
        // out of focus (the dive) it softens to its mean
        float relief = 1.0;
        float lw = leiwen(uv, fp);
        if (lw >= 0.0) {
          lw = mix(lw, 0.46, smoothstep(2.0, 14.0, blur));
          float worn = smoothstep(0.38, 0.72, fbm(uv * vec2(1.3, 3.0) + 21.0));
          relief = mix(1.0, ${LEI.hollow.toFixed(2)} + ${(LEI.ridge - LEI.hollow).toFixed(2)} * lw, worn);
        }
        return c * (0.85 * cool + 2.2 * warm * relief);
      }
      vec3 sky(vec3 rd){
        // the opening of the vessel, far above: a cold, dim night
        return vec3(0.03, 0.04, 0.06) + vec3(0.06, 0.07, 0.09) * smoothstep(0.6, 1.0, rd.y);
      }

      // ---------- the water ----------
      // every landing sends a packet of rings out (two trains, the slower one finer), and leaves a
      // crater for a few frames; heights are tiny, slopes are what bend the reflections
      // v4.1 · the water is never quite still: low swells crossing it, the rings of earlier drops
      // coming back off the vessel's wall (each a circle from a point out by the wall: centre, k, height)
      vec2 swell(vec2 xz){
        vec2 gr = vec2(0.0);
        vec2 v; float L;
        v = xz - vec2(-6.0, -6.5); L = length(v); gr += -0.000045 * 30.0 * sin(30.0 * L - 0.18 * uTime + 0.7) * v / L;
        v = xz - vec2(5.5, -7.5);  L = length(v); gr += -0.00003 * 44.0 * sin(44.0 * L - 0.22 * uTime + 2.1) * v / L;
        v = xz - vec2(2.0, 3.0);   L = length(v); gr += -0.00005 * 23.0 * sin(23.0 * L - 0.16 * uTime + 4.0) * v / L;
        v = xz - vec2(-4.0, 1.5);  L = length(v); gr += -0.00002 * 61.0 * sin(61.0 * L - 0.24 * uTime + 5.3) * v / L;
        return gr * ${SWELL.toFixed(2)};
      }
      vec3 waterNormal(vec2 xz){
        vec2 d = xz - vec2(0.0, ZD);
        float r = max(length(d), 1e-4);
        float g = 0.0;
        for (int i = 0; i < ${N_IMP}; i++){
          float age = uImp[i].x;
          if (age < 0.0) continue;
          float A = 0.0034 * uImp[i].y * exp(-age / 50.0) / sqrt(1.0 + r / 0.12);
          for (int k = 0; k < 2; k++){
            float c = k == 0 ? 0.021 : 0.013;
            float kk = k == 0 ? 74.0 : 118.0;
            float w = (k == 0 ? 0.05 : 0.035) + 0.0035 * age;
            float s = r - c * age;
            float e = exp(-(s * s) / (w * w));
            float amp = A * (k == 0 ? 1.0 : 0.55);
            g += amp * (-2.0 * s / (w * w) * e * cos(kk * s) - e * kk * sin(kk * s));
          }
          // the crater, for a moment (v4.1: six frames; the column rises out of it)
          float cr = exp(-r * r / 0.0009) * sin(3.14159 * clamp(age / 6.0, 0.0, 1.0)) * 0.012 * uImp[i].y;
          g += cr * (-2.0 * r / 0.0009);
          // v4.1: the droplet falls back in: a small crater and a ring of its own
          float a2 = uImp[i].z;
          if (a2 >= 0.0) {
            float A2 = 0.0034 * 0.22 * exp(-a2 / 30.0) / sqrt(1.0 + r / 0.12);
            float w2 = 0.03 + 0.003 * a2;
            float s2 = r - 0.013 * a2;
            float e2 = exp(-(s2 * s2) / (w2 * w2));
            g += A2 * (-2.0 * s2 / (w2 * w2) * e2 * cos(118.0 * s2) - e2 * 118.0 * sin(118.0 * s2));
            float cr2 = exp(-r * r / 0.0003) * sin(3.14159 * clamp(a2 / 4.0, 0.0, 1.0)) * 0.004;
            g += cr2 * (-2.0 * r / 0.0003);
          }
        }
        vec2 grad = g * d / r + swell(xz);
        return normalize(vec3(-grad.x, 1.0, -grad.y));
      }

      // ---------- tracing ----------
      // what a ray sees with no water in its way: the line, the wall, the sky
      vec3 env(vec3 ro, vec3 rd, float blur, float path){
        vec3 col;
        float tw = hitWall(ro, rd);
        vec3 pw = ro + rd * tw;
        // a pixel's footprint on the wall, by the ray's whole length (its slant ignored)
        if (tw > 0.0 && pw.y < ${WALL.top.toFixed(1)} && pw.y > -0.5) col = wallShade(pw, (path + tw) / uFocal, blur);
        else col = sky(rd);
        vec4 ln = lineAt(ro, rd, blur, path);
        float tl = (uLineBox.w - ro.z) / rd.z;
        if (ln.a > 0.0 && (tw < 0.0 || tl < tw)) col = col * (1.0 - min(1.0, ln.a)) + ln.rgb;
        return col;
      }
      // the water seen at p from direction rd; v4.3: the falling water in its mirror too (refl over
      // the line, the wall and the sky), but not where the water is seen through a drop
      vec3 waterLit(vec3 p, vec3 rd, float t, vec3 n, vec3 rr, vec3 refl){
        float cosi = clamp(dot(-rd, n), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
        vec3 col = vec3(0.004, 0.005, 0.007);
        col += refl * (0.22 + 0.9 * F);
        // the night's light glinting on the rings
        float sp = pow(max(dot(rr, MOON), 0.0), 160.0);
        col += vec3(0.75, 0.82, 0.95) * sp * 1.8;
        return col;
      }
      vec3 waterShade0(vec3 p, vec3 rd, float t, float dof){
        vec3 n = waterNormal(p.xz);
        vec3 rr = reflect(rd, n);
        if (rr.y < 0.002) rr.y = 0.002;
        return waterLit(p, rd, t, n, rr, env(p + n * 1e-3, rr, dof, t));
      }
${seenFn("seenR", true)}
${seenFn("seen", false)}
${pickFalling}
${clearWater("clearWaterR", true)}
${fallingWater("fallingWaterR", "clearWaterR")}
      vec3 waterShade(vec3 p, vec3 rd, float t, float dof){
        vec3 n = waterNormal(p.xz);
        vec3 rr = reflect(rd, n);
        if (rr.y < 0.002) rr.y = 0.002;
        vec3 refl = env(p + n * 1e-3, rr, dof, t);
        refl = fallingWaterR(p + n * 1e-3, normalize(rr), 1e9, refl, t);
        return waterLit(p, rd, t, n, rr, refl);
      }
${clearWater("clearWater", false)}
${fallingWater("fallingWater", "clearWater")}

      void main(){
        vec2 px = (vUv - 0.5) * uRes;
        vec3 rd = normalize(uFwd * uFocal + uRight * px.x + uUp * px.y);
        vec3 ro = uCam;
        vec3 col;
        float tw = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
        float twall = hitWall(ro, rd);
        if (twall > 0.0 && twall < tw) tw = 1e9; // the wall stands in front of that water
        if (tw < 1e8) {
          // the line is in front of the water beyond it
          vec4 ln = lineAt(ro, rd, uDof, 0.0);
          float tl = (uLineBox.w - ro.z) / rd.z;
          col = waterShade(ro + rd * tw, rd, tw, uDof);
          if (ln.a > 0.0 && tl > 0.0 && tl < tw) col = col * (1.0 - min(1.0, ln.a)) + ln.rgb;
        } else col = env(ro, rd, uDof, 0.0);
        // the drops, the columns and the droplets, in front of all of it (v4.3: across the exposure)
        col = fallingWater(ro, rd, tw, col, 0.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);

  const post = makePost(renderer, scene, camera, { bloom: [0.45, 0.5, 0.86] });
  post.finish.uniforms.uVignette.value = 0.42;
  post.finish.uniforms.uGrain.value = 0.022;
  post.finish.uniforms.uCA.value = 0.0006;

  return {
    render(f: number) {
      // the cover sets its own camera ([x, y, z] position and look-at, world units)
      const CC = (globalThis as any).__coverCam;
      const { pos, look } = CC ? { pos: new THREE.Vector3(...CC.pos), look: new THREE.Vector3(...CC.look) } : cameraAt(f);
      const fwd = look.clone().sub(pos).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
      uniforms.uCam.value.copy(pos);
      uniforms.uFwd.value.copy(fwd);
      uniforms.uRight.value.copy(right);
      uniforms.uUp.value.copy(up);
      const ts = still(f);

      // the six drops, and the seventh — one at a time: a drop is not drawn before the one ahead of it
      // has landed (the second and third would otherwise show a sliver at the top edge a frame or two
      // early, while the camera is still high). v4.3: spheres, each with where it is at the frame's
      // moment and how far it falls while the shutter is open (the shader blurs it by that); only
      // those in the air are passed, first in the arrays
      let nS = 0, nC = 0;
      const sphere = (x: number, y: number, r: number, dy: number) => {
        uniforms.uSph.value[nS].set(x, y, ZD, r);
        uniforms.uSphV.value[nS].set(0, dy, 0);
        nS++;
      };
      IMPACTS.forEach((at, k) => {
        const r0 = at - FALLF;
        if (f < r0 || f >= at || (k > 0 && f < IMPACTS[k - 1])) return;
        const yAt = (g: number) => YS - 0.5 * G * (g - r0) ** 2;
        sphere(0, yAt(f), RD, yAt(f + SH) - yAt(f - SH));
      });
      // (once it has stopped, it moves by nothing)
      if (f >= R7 && f > L6 && f < K.match) sphere(0, y7(f), RD7, y7(f + SH) - y7(f - SH));
      // the rings (in still time), the columns and the droplets they throw up (v4.1: see "a splash");
      // v4.3: the column's height and the droplet's place as the shutter opens and as it closes
      uniforms.uTime.value = ts;
      const tsA = still(f - SH), tsB = still(f + SH);
      IMPACTS.forEach((at, k) => {
        const age = ts - at;
        uniforms.uImp.value[k].set(age, 1, age - T_BACK);
        const hA = colH(tsA - at), hB = colH(tsB - at);
        if (hA > 0 || hB > 0) uniforms.uCol.value[nC++].set(hA, hB, RJ, 0);
        const y = dropletY(age);
        if (age >= T_PINCH && age < T_BACK + 1 && y > -RDP) sphere(0, y, RDP, dropletY(tsB - at) - dropletY(tsA - at));
      });
      uniforms.uNSph.value = nS;
      uniforms.uNCol.value = nC;
      // the line writes itself in light; before it, its light lies on the water
      tx.ats.forEach((at, i) => (uniforms.uReveal.value[i] = clamp((f - at) / 12)));
      uniforms.uAura.value = 0.035 + 0.05 * (1 - smooth(prog(f, LINE_AT, LINE_AT + 30)));
      // the camera's depth of field closes on the drop as it dives
      // (its circle of confusion on the line, in texels of the 200 px characters)
      uniforms.uDof.value = 46 * smooth(prog(f, DIVE0 + 1, K.match - 1));
      // v4.1: the pool dissolves in over 南北 (this canvas lies over 南北's)
      renderer.domElement.style.opacity = smooth(prog(f, CLOCK_IN[0], CLOCK_IN[1])).toFixed(4);
      post.finish.uniforms.uSeed.value = f;
      post.composer.render();
    },
    dispose() {
      post.composer.dispose();
    },
  };
}
