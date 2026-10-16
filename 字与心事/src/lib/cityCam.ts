// The lights are a painted handscroll seen through a pinhole camera (every layer at z = 1:
// it is one flat painting, the camera pulls back from his window and travels along it).
// Every layer is authored in the pixels of the wide shot (camera CW), so a point
// (X, Y) of a layer at depth z lands on screen at
//   960 + (X − 960)·a + bx,  540 + (Y − 540)·a + by
// with a = (z − CW.z)/(z − c.z), bx = (CW.x − c.x)/(z − c.z), by = (CW.y − c.y)/(z − c.z).
// The DOM letter of the reply scene shares this camera, so the receding sheet
// stays locked to his window until it becomes the window.
import cues from "../cues.json";
import { lerp, prog, smooth, easeInOutCubic } from "./util";

export type Cam = { x: number; y: number; z: number };

const CY = cues.city;
const R = cues.reply;

export const CW: Cam = { x: -330, y: -515, z: -0.32 }; // the wide shot
export const PAN = { dx: 4300, dy: 0, dz: 0.11 }; // the camera travels the scroll, left to right
export const HERO = { X: 1210, Y: 930, w: 19.8, h: 11.1375, z: 1 }; // his window (16:9, the letter's shape)
export const DIVE = { X: 4260, Y: 822, w: 15, h: 21, z: 1 }; // a window upstairs in the lakeside pavilion

// keyframes of the pull-out, in log magnification of his window (v4.1: frames one beat later than
// in v4.0, for the beat inserted at 26.0 s)
const A0 = 1920 / HERO.w;
const OUT = [
  [R.pull, Math.log(A0)],
  [1675, Math.log(8.4)],
  [1693, Math.log(5.3)],
  [1739, 0],
] as const;
export const PAN0 = 1707;

export function view(z: number, c: Cam) {
  const d = z - c.z;
  return { a: (z - CW.z) / d, bx: (CW.x - c.x) / d, by: (CW.y - c.y) / d, d };
}
export function toScreen(z: number, X: number, Y: number, c: Cam) {
  const v = view(z, c);
  return { x: 960 + (X - 960) * v.a + v.bx, y: 540 + (Y - 540) * v.a + v.by, a: v.a };
}
/** The camera that puts layer point (X, Y) at screen (px, py) with relative magnification a. */
export function lockCam(z: number, X: number, Y: number, px: number, py: number, a: number): Cam {
  const d = (z - CW.z) / a;
  return { z: z - d, x: CW.x - (px - 960 - (X - 960) * a) * d, y: CW.y - (py - 540 - (Y - 540) * a) * d };
}

/** Monotone cubic through keyframes, flat at both ends. */
function monotone(keys: readonly (readonly [number, number])[], x: number) {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  const d = keys.slice(0, -1).map((k, i) => (keys[i + 1][1] - k[1]) / (keys[i + 1][0] - k[0]));
  const m = keys.map((_, i) => (i === 0 || i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const al = m[i] / d[i], be = m[i + 1] / d[i];
    const s = al * al + be * be;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * al * d[i];
      m[i + 1] = t * be * d[i];
    }
  }
  let i = 0;
  while (x > keys[i + 1][0]) i++;
  const [x0, y0] = keys[i], [x1, y1] = keys[i + 1];
  const h = x1 - x0, t = (x - x0) / h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1];
}

// v4.0: the letter waits a moment after 54.43 s (R.pull), lifting a little towards the lens, and
// flies into his window on the downbeat at 55.0 s (frame 1650). It meets v3.1's pull-out at frame
// 1675 (55.83 s) at the same size and the same speed, so from there on — the windows lighting on
// the beat, the two lines — every frame is what it was; the music is not touched.
// (v4.1: times and frames one beat later than in v4.0, for the beat inserted at 26.0 s.)
export const FLY = 1650;
const JOIN = 1675, LIFT = 1.025;
const hermite = (y0: number, m0: number, y1: number, m1: number, t: number, h: number) => {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
};
let JOIN_SLOPE: number | null = null; // v3.1's speed at the join (log-magnification per frame)
function pullLA(f: number) {
  if (f >= JOIN) return monotone(OUT, f);
  if (JOIN_SLOPE === null) JOIN_SLOPE = (monotone(OUT, JOIN + 0.001) - monotone(OUT, JOIN)) / 0.001;
  const la0 = Math.log(A0), laL = la0 + Math.log(LIFT), la1 = Math.log(8.4);
  if (f <= FLY) return hermite(la0, 0, laL, 0, prog(f, R.pull, FLY), FLY - R.pull);
  return hermite(laL, 0, la1, JOIN_SLOPE, prog(f, FLY, JOIN), JOIN - FLY);
}

function scrollCam(f: number): Cam {
  const la = pullLA(f);
  const a = Math.exp(la);
  // the window stays centred while it is still the letter, then settles into the street
  const pe = smooth(prog(la, Math.log(8.4), 0));
  const c = lockCam(HERO.z, HERO.X, HERO.Y, lerp(960, HERO.X, pe), lerp(540, HERO.Y, pe), a);
  const p = smooth(prog(f, PAN0, CY.dive));
  return { x: c.x + PAN.dx * p, y: c.y + PAN.dy * p, z: c.z + PAN.dz * p };
}

/** The city camera at absolute frame f. */
export function cityCam(f: number): Cam {
  if (f <= CY.dive) return scrollCam(f);
  // the dive: hover, then fall into one lit window of the old town
  const c0 = scrollCam(CY.dive);
  const s0 = toScreen(DIVE.z, DIVE.X, DIVE.Y, c0);
  const t = prog(f, CY.dive, CY.end);
  const aEnd = (2200 / DIVE.w);
  const la = lerp(Math.log(s0.a), Math.log(aEnd), Math.pow(t, 2.3));
  const pp = easeInOutCubic(prog(f, CY.dive, CY.end - 16));
  return lockCam(DIVE.z, DIVE.X, DIVE.Y, lerp(s0.x, 960, pp), lerp(s0.y, 540, pp), Math.exp(la));
}

/** Her window on screen: centre and size. Before the pull it fills the frame. */
export function heroRect(f: number) {
  if (f <= R.pull) return { x: 960, y: 540, w: 1920, h: 1080 };
  const s = toScreen(HERO.z, HERO.X, HERO.Y, cityCam(f));
  return { x: s.x, y: s.y, w: HERO.w * s.a, h: HERO.h * s.a };
}
