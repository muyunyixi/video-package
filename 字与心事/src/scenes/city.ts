// Scene K · 击壤忽然成古史，人间灯火灿于星。 (53.9–65 s)
// 灯火长卷. The reply recedes into his lit window and the camera pulls back from a night
// handscroll painted the way the Song painters showed a city — from high up and in front, roof
// beyond roof into the mist (清明上河图), the lake and its hills as in the West Lake scrolls:
// dark silk, ink line, washes, a few pale pigments where the moon catches tile and stone. It
// travels along it, left to right: his canal lane and the town climbing away behind it with its
// streets of lanterns, the river and the timber rainbow bridge crowded with people, the city
// wall and its gate, and out over West Lake under the moon — pagodas on the hills, the
// causeway, the three stone lanterns, pleasure boats, a pavilion standing in the water. On
// every beat threads of light leave lit windows and wake others, always a little ahead of the
// camera, and the glow of the town rises into the mist as it wakes; the last thread from his
// window lands in the dark upstairs window of the pavilion, and the camera falls into it.
//
// The scroll is one flat painting (every layer at z = 1). It is painted back to front: the
// ground (silk, sky, hills, land, water), then everything standing on it in order of depth, so
// what is nearer covers what is further — and covers its lights too: every stroke is laid a
// second time, in black, into the light map.
import * as THREE from "three";
import cues from "../cues.json";
import { makePost } from "../lib/post";
import { glowCanvas, toTex } from "../lib/textures";
import { makeCanvas } from "../lib/glyph";
import { lanternLattice } from "../lib/lattice";
import { HW, lerp, prog, smooth, clamp, mulberry32, easeInOutCubic } from "../lib/util";
import { HERO, DIVE, cityCam, view, toScreen, type Cam } from "../lib/cityCam";
import type { SceneHandle } from "../lib/ThreeLayer";

const CY = cues.city;
const RP = cues.reply;
// the scroll wakes on these beats (the reply scene's last downbeat is 1665; v4.1: all one beat later
// than in v4.0, for the beat inserted at 26.0 s)
export const BEATS = Array.from({ length: 13 }, (_, k) => 1680 + k * 15);
export const LAST_THREAD = CY.dive - 15; // the last thread lands in the pavilion window, one beat before the dive
const W0 = 0.04, STEP = 0.96 / BEATS.length;
export function waveAt(f: number) {
  return W0 + BEATS.reduce((s, b) => s + smooth(prog(f, b, b + 7)), 0) * STEP;
}
const beatRank = (k: number, frac = 0.5) => W0 + (k + frac) * STEP;
const landAt = (k: number) => BEATS[k] + 3.5; // the wave crosses beatRank(k, .5) here

// When does a light at scroll position X wake? Near his window, in the first beats while the
// camera pulls back; further along, as the travelling camera brings it to the right of the
// frame — so lights are always coming on just ahead of where we are going.
const AHEAD = 720;
let CENTRES: { f: number; x: number }[] | null = null;
const centreX = (f: number) => {
  const v = view(1, cityCam(f));
  return 960 - v.bx / v.a;
};
function wakeRank(X: number, Y: number, r: () => number, spread = 0.03) {
  if (!CENTRES) {
    CENTRES = [];
    for (let f = BEATS[0] - 5; f <= CY.dive; f++) CENTRES.push({ f, x: centreX(f) });
  }
  let wf: number;
  if (X < 1700) wf = BEATS[0] + clamp(Math.hypot(X - HERO.X, (Y - HERO.Y) * 0.6) / 1000, 0, 1) * 40;
  else {
    const hit = CENTRES.find((c) => c.x + AHEAD >= X);
    wf = hit ? Math.max(BEATS[0] + 30, hit.f) : BEATS[BEATS.length - 1] + 4;
  }
  const last = BEATS[BEATS.length - 1] + 6;
  const t = clamp((wf - BEATS[0]) / (last - BEATS[0]), 0, 1);
  return clamp(W0 + 0.006 + t * 0.95 + (r() - 0.5) * spread, W0 + 0.006, 0.996);
}

// ------------------------------------------------------------------ the scroll's geography
const SX0 = -520, SX1 = 5440; // its length, in wide-shot px
const FAR = 345; // where the town meets the foot of the hills
const CANAL = 1032; // his canal's water line
const HOUSE_FOOT = 1030;
/** how big things are at depth Y: tiny far up the scroll, large at its foot */
const sAt = (Y: number) => 0.27 + 1.9 * Math.pow(clamp((Y - FAR) / 505, 0, 1.5), 1.8);
// the river, coming out of the mist and down across the town to the foot of the scroll
const RV_TOP = 432;
const rvC = (y: number) => (y >= 560 ? lerp(2150, 3000, (y - 560) / 520) : 2150 - Math.pow((560 - y) / 130, 2) * 170);
const rvW = (y: number) => (y >= 560 ? lerp(110, 400, (y - 560) / 520) : 110 * (1 - ((560 - y) / 130) * 0.72));
const rvL = (y: number) => rvC(y) - rvW(y) / 2;
const rvR = (y: number) => rvC(y) + rvW(y) / 2;
// the city wall, running away from us between the town and the lake
const WALL = { y0: 372, y1: 1080, x0: 3610, x1: 3290 };
const wallX = (y: number) => lerp(WALL.x0, WALL.x1, (y - WALL.y0) / (WALL.y1 - WALL.y0));
const shoreY = (x: number) => 404 + 8 * Math.sin(x / 170) + 5 * Math.sin(x / 61 + 1.3); // the far shore of the lake
const causeY = (x: number) => lerp(520, 482, (x - 3700) / (SX1 - 3700)); // the Su causeway
const MOON = { X: 4700, Y: 150, R: 30 };
const GATE = { X: 3445, base: 742 }; // 涌金门
const GATE_PF = GATE.base - 50, GATE_PN = GATE.base + 22; // the gate platform (城台) along the wall: its far and near ends
// outside the wall a lakeside bank (湖滨) runs between the wall's foot and the water, wider at the
// gate where a landing comes out from the gateway; widths in the wall's own units (its half-width is 10)
const bankW = (Y: number) => 14 + 22 * Math.exp(-Math.pow((Y - GATE.base) / 30, 2));
const footY = (Y: number) => Y + 26 * sAt(Y); // the wall's foot on the lake side, under walkway depth Y
const bankEdge = (Y: number) => wallX(Y) + (10 + bankW(Y)) * sAt(Y); // where the bank meets the water
/** the bank's edge at screen height y (the bank lies at the wall's foot, which hangs below its walk) */
const bankAtY = (y: number) => {
  let lo = WALL.y0, hi = WALL.y1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (footY(m) < y) lo = m;
    else hi = m;
  }
  return bankEdge((lo + hi) / 2);
};
// v3.1: the far shore and the Su causeway reach the bank under the wall (in v3 they stopped 40 and
// 130 px out, leaving open water at the wall); a few px in, so no sliver of water shows at the joint
const FS0 = Math.round(bankAtY(shoreY(3600))) - 2;
const CX0 = Math.round(bankAtY(causeY(3560))) - 3;
const BRIDGE = { X: 2560, half: 172, foot: 810, crest: 734 }; // the rainbow bridge
const PAV = { X: DIVE.X, wl: 975 }; // the pavilion standing in the lake
// v5.0: its upstairs windows, one in each bay (the middle one is the one the camera falls into)
const PAV_WINS = [DIVE.X - 49.5, DIVE.X, DIVE.X + 49.5];
const SIDE = { X: 420, top: 700 }; // a side canal running up into the town under the arch bridge
const sideX = (y: number) => SIDE.X + (CANAL - y) * 0.2;
const sideW = (y: number) => 24 + 104 * clamp((y - SIDE.top) / (CANAL - SIDE.top));
type Street = { pts: [number, number][]; w: number; busy: number };
const STREETS: Street[] = [
  { pts: [[-560, 830], [400, 722], [1200, 604], [1800, 516], [2000, 486]], w: 9, busy: 1 }, // the imperial way, climbing away to the right
  { pts: [[-560, 652], [300, 644], [900, 628], [1500, 618], [1990, 606]], w: 7, busy: 0.75 }, // the cross street
  { pts: [[240, 396], [700, 522], [1100, 650], [1430, 786]], w: 7, busy: 0.6 }, // a lane coming down the hill
  { pts: [[BRIDGE.X + BRIDGE.half - 8, BRIDGE.foot - 4], [3000, 800], [3300, 790], [GATE.X - 40, 786]], w: 8, busy: 1 }, // from the bridge to the gate
  { pts: [[2200, 522], [2700, 502], [3200, 472], [3560, 454]], w: 6, busy: 0.6 }, // across the river, far off
];
const distSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const distPoly = (px: number, py: number, pts: [number, number][]) => {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
};
/** how far (x, y) is from the edge of the nearest street (negative: on it) */
const streetClear = (x: number, y: number) => {
  let m = 1e9;
  for (const st of STREETS) m = Math.min(m, distPoly(x, y, st.pts) - (st.w * sAt(y)) / 2);
  return m;
};
/** walk a polyline, calling fn every step(y) px */
const walk = (pts: [number, number][], step: (y: number) => number, fn: (x: number, y: number, nx: number, ny: number) => void) => {
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
    let t = carry;
    while (t < L) {
      const x = ax + ux * t, y = ay + uy * t;
      fn(x, y, -uy, ux);
      t += step(y);
    }
    carry = t - L;
  }
};

// ------------------------------------------------------------------ layers
type Rec = { X: number; Y: number; w: number; h: number; tint: number; b: number; shape: "rect" | "oval"; lat?: [number, number, number] };
type Spec = { z: number; X0: number; X1: number; Y0: number; Y1: number; q: number; win?: boolean; gain?: number; edges?: [number, number, number, number] };
type Layer = Spec & { ink: CanvasRenderingContext2D; wctx: CanvasRenderingContext2D | null; wet: CanvasRenderingContext2D; recs: Rec[] };
type Anchor = { z: number; X: number; Y: number };

// software canvases: thousands of small strokes go much faster on the CPU than through the
// emulated GPU, and they never run the GPU out of canvas memory mid-painting
const SOFT = { willReadFrequently: true } as const;
function layer(s: Spec): Layer {
  const cw = Math.round((s.X1 - s.X0) * s.q), ch = Math.round((s.Y1 - s.Y0) * s.q);
  const ink = makeCanvas(cw, ch).getContext("2d", SOFT)!;
  ink.setTransform(s.q, 0, 0, s.q, -s.X0 * s.q, -s.Y0 * s.q);
  let wctx: CanvasRenderingContext2D | null = null;
  if (s.win) {
    wctx = makeCanvas(cw, ch).getContext("2d", SOFT)!;
    wctx.fillStyle = "#000";
    wctx.fillRect(0, 0, cw, ch);
    wctx.setTransform(s.q, 0, 0, s.q, -s.X0 * s.q, -s.Y0 * s.q);
  }
  // where the water is (white): lights there tremble and are dimmer, being reflections
  const wq = 0.5;
  const wet = makeCanvas(Math.max(2, Math.round((s.X1 - s.X0) * wq)), Math.max(2, Math.round((s.Y1 - s.Y0) * wq))).getContext("2d", SOFT)!;
  wet.fillStyle = "#000";
  wet.fillRect(0, 0, wet.canvas.width, wet.canvas.height);
  wet.setTransform(wq, 0, 0, wq, -s.X0 * wq, -s.Y0 * wq);
  return { ...s, ink, wctx, wet, recs: [] };
}
/** A light in the layer's light map: coverage in R, rank·coverage in G, tint·coverage in B (0 warm, .5 cool, 1 red). */
function light(L: Layer, X: number, Y: number, w: number, h: number, rank: number, tint = 0, b = 1, shape: "rect" | "oval" = "rect", lat?: [number, number, number], refl = false) {
  const c = L.wctx!;
  c.fillStyle = `rgb(${Math.round(255 * b)},${Math.round(255 * rank * b)},${Math.round(255 * tint * b)})`;
  if (shape === "oval") {
    c.beginPath();
    c.ellipse(X, Y, w / 2, h / 2, 0, 0, Math.PI * 2);
    c.fill();
  } else c.fillRect(X - w / 2, Y - h / 2, w, h);
  if (lat) {
    const [nx, ny, bar] = lat;
    c.fillStyle = "#000";
    for (let i = 1; i < nx; i++) c.fillRect(X - w / 2 + (w * i) / nx - bar / 2, Y - h / 2, bar, h);
    for (let j = 1; j < ny; j++) c.fillRect(X - w / 2, Y - h / 2 + (h * j) / ny - bar / 2, w, bar);
  }
  if (!refl) L.recs.push({ X, Y, w, h, tint, b, shape, lat });
}

const LAYER_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LAYER_FS = /* glsl */ `
  uniform sampler2D tInk; uniform sampler2D tWin; uniform sampler2D tWet; uniform sampler2D tGlow;
  uniform float uHasWin, uWave, uBeat, uF, uGain, uGlow;
  uniform vec4 uRect, uEdges;
  uniform vec3 uHazeC;
  varying vec2 vUv;
  float h1(float x){ return fract(sin(x * 127.1 + 1.7) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    float ty = 1.0 - uv.y;
    vec4 ink = texture2D(tInk, uv);
    vec3 col = ink.rgb;
    float a = ink.a;
    float wet = texture2D(tWet, uv).r;
    col += uHazeC * (0.6 + 1.2 * wet);
    // the glow of the lit town, rising in the air over it as each part of it wakes
    vec2 S = vec2(mix(uRect.x, uRect.y, uv.x), mix(uRect.w, uRect.z, uv.y));
    vec4 gt = texture2D(tGlow, vec2((S.x - (${SX0.toFixed(1)})) / ${(SX1 - SX0).toFixed(1)}, S.y / 1080.0));
    float gAw = smoothstep(gt.g - 0.004, gt.g + 0.07, uWave);
    col += vec3(1.0, 0.52, 0.22) * (gt.r * gt.r) * uGlow * gAw * (1.0 + 0.6 * wet);
    if (uHasWin > 0.5) {
      vec2 wuv = uv;
      if (wet > 0.5) wuv.x += (sin(ty * 1500.0 + uF * 0.27) * 0.6 + sin(ty * 3300.0 - uF * 0.41) * 0.4) * 0.00042;
      vec3 w = texture2D(tWin, wuv).rgb;
      float cov = w.r;
      if (cov > 0.003) {
        float rank = clamp(w.g / cov, 0.0, 1.0);
        float tint = clamp(w.b / cov, 0.0, 1.0);
        float id = floor(rank * 4000.0);
        float awake = smoothstep(rank - 0.004, rank + 0.004, uWave);
        float fresh = awake * (1.0 - smoothstep(0.0, 0.1, uWave - rank));
        float flick = 0.9 + 0.1 * sin(uF * (0.04 + 0.1 * h1(id)) + h1(id + 3.0) * 40.0);
        vec3 warm = mix(vec3(1.0, 0.34, 0.08), vec3(1.0, 0.6, 0.25), h1(id + 1.0));
        vec3 cool = vec3(0.56, 0.68, 1.0);
        vec3 red = vec3(1.0, 0.07, 0.025);
        vec3 lc = tint < 0.5 ? mix(warm, cool, tint * 2.0) : mix(cool, red, tint * 2.0 - 1.0);
        float lit = cov * awake * flick * (1.0 + 1.3 * fresh * uBeat) * uGain;
        if (wet > 0.5) lit *= 0.72;
        col += lc * lit;
        a = max(a, clamp(lit, 0.0, 1.0));
      }
    }
    // a finer patch fades into the tile under it, so its sharper lights (and their bloom) never make a seam
    float fe = 1.0;
    if (uEdges.x > 0.0) fe *= smoothstep(0.0, uEdges.x, S.x - uRect.x);
    if (uEdges.y > 0.0) fe *= smoothstep(0.0, uEdges.y, uRect.y - S.x);
    if (uEdges.z > 0.0) fe *= smoothstep(0.0, uEdges.z, S.y - uRect.z);
    if (uEdges.w > 0.0) fe *= smoothstep(0.0, uEdges.w, uRect.w - S.y);
    gl_FragColor = vec4(col, a * fe);
  }`;

// a lit window with its own artwork (his window, the poem windows, the pavilion window)
const PANE_FS = /* glsl */ `
  uniform sampler2D tMap; uniform float uOn, uGain, uFlare;
  varying vec2 vUv;
  void main(){
    vec4 t = texture2D(tMap, vUv);
    vec3 lit = t.rgb * uGain * (1.0 + uFlare);
    vec3 off = t.rgb * 0.035;
    gl_FragColor = vec4(mix(off, lit, uOn), t.a);
  }`;

// threads of light between windows
const THREAD_VS = /* glsl */ `
  attribute float aT; varying float vT;
  void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const THREAD_FS = /* glsl */ `
  uniform float uO; varying float vT;
  void main(){
    vec3 c = mix(vec3(1.0, 0.13, 0.05), vec3(1.0, 0.72, 0.38), vT * vT);
    gl_FragColor = vec4(c * (0.6 + 1.4 * vT) * uO * pow(vT, 1.5), 1.0);
  }`;

// ------------------------------------------------------------------ the painter's hand
type C2 = CanvasRenderingContext2D;
type R = () => number;
// a night scroll: dark silk, ink, a few pale pigments for walls, stone and water
const SKY0 = [12, 15, 27], SKY1 = [24, 28, 44], SKY2 = [52, 53, 68];
const LANDF = [47, 48, 61], LANDN = [27, 28, 37];
const MISTc = [94, 100, 124];
const INKc = [11, 12, 17], ROOFc = [20, 22, 30], WALLc = [74, 77, 92];
const INK = "11,12,17";
const INK2 = "22,24,32";
const STONE = "70,72,86";
const PALE = "176,182,204";
const WOOD = "60,48,44";
const WOOD_D = "40,32,31";
const PAPER_D = "36,27,23";
const rgbS = (a: number[]) => a.join(",");
const mixc = (a: number[], b: number[], t: number) => `${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))}`;
// while a stroke is being laid into the light map, every colour is black (keeping its alpha)
let MASK = false;
const C = (rgb: string, a = 1) => (MASK ? `rgba(0,0,0,${a})` : `rgba(${rgb},${a})`);
const fogAt = (s: number) => clamp((1.1 - s) * 0.75, 0, 0.62);

/** A curved roof in the 界画 manner: ridge, sweeping slopes, upturned eaves, rows of tiles
 *  as fine strokes, a pale line where the moon catches the ridge and the eave. */
function roof(c: C2, cx: number, ridgeY: number, eaveY: number, hw: number, o: { oh?: number; lift?: number; thick?: number; inset?: number; fill: string; rim?: string; tiles?: string }) {
  const oh = o.oh ?? hw * 0.12, lift = o.lift ?? (eaveY - ridgeY) * 0.28, thick = o.thick ?? (eaveY - ridgeY) * 0.16;
  const inset = o.inset ?? hw * 0.22;
  const L = cx - hw - oh, R = cx + hw + oh, rl = cx - hw + inset, rr = cx + hw - inset;
  const dh = eaveY - ridgeY;
  const outline = () => {
    c.beginPath();
    c.moveTo(rl, ridgeY);
    c.lineTo(rr, ridgeY);
    c.quadraticCurveTo(rr + (R - rr) * 0.42, eaveY - dh * 0.06, R, eaveY - lift);
    c.lineTo(R - oh * 0.3, eaveY - lift + thick * 0.9);
    c.quadraticCurveTo(cx + hw * 0.75, eaveY + thick, cx, eaveY + thick);
    c.quadraticCurveTo(cx - hw * 0.75, eaveY + thick, L + oh * 0.3, eaveY - lift + thick * 0.9);
    c.lineTo(L, eaveY - lift);
    c.quadraticCurveTo(rl - (rl - L) * 0.42, eaveY - dh * 0.06, rl, ridgeY);
    c.closePath();
  };
  c.fillStyle = o.fill;
  outline();
  c.fill();
  if (o.tiles && dh > 4) {
    c.save();
    outline();
    c.clip();
    c.strokeStyle = o.tiles;
    c.lineWidth = Math.max(0.3, hw * 0.006);
    const step = Math.max(1.3, hw * 0.026);
    for (let x = L; x < R; x += step) {
      const t = (x - cx) / (hw + oh);
      c.beginPath();
      c.moveTo(cx + t * (rr - cx) * 1.02, ridgeY);
      c.lineTo(x, eaveY + thick);
      c.stroke();
    }
    c.restore();
  }
  const rb = Math.max(0.5, dh * 0.12);
  c.fillStyle = o.fill;
  c.fillRect(rl, ridgeY - rb * 0.6, rr - rl, rb * 1.2);
  if (dh > 6)
    for (const s of [-1, 1]) {
      const x = s < 0 ? rl : rr;
      c.beginPath();
      c.moveTo(x - s * rb * 0.2, ridgeY + rb * 0.6);
      c.quadraticCurveTo(x - s * rb * 1.6, ridgeY - rb * 2.2, x + s * rb * 0.5, ridgeY - rb * 2.6);
      c.lineTo(x + s * rb * 1.1, ridgeY + rb * 0.6);
      c.closePath();
      c.fill();
    }
  if (o.rim) {
    c.strokeStyle = o.rim;
    c.lineWidth = Math.max(0.4, dh * 0.035);
    c.beginPath();
    c.moveTo(L, eaveY - lift);
    c.quadraticCurveTo(rl - (rl - L) * 0.42, eaveY - dh * 0.06, rl, ridgeY - rb * 0.6);
    c.lineTo(rr, ridgeY - rb * 0.6);
    c.quadraticCurveTo(rr + (R - rr) * 0.42, eaveY - dh * 0.06, R, eaveY - lift);
    c.stroke();
    c.beginPath();
    c.moveTo(L + oh * 0.3, eaveY - lift + thick * 0.9);
    c.quadraticCurveTo(cx - hw * 0.75, eaveY + thick, cx, eaveY + thick);
    c.quadraticCurveTo(cx + hw * 0.75, eaveY + thick, R - oh * 0.3, eaveY - lift + thick * 0.9);
    c.stroke();
  }
  return { L, R, under: eaveY + thick, tipY: eaveY - lift };
}

function ridgeLine(r: R, X0: number, X1: number, base: number, peaks: [number, number, number][], rough: number, step = 4) {
  const pts: [number, number][] = [];
  let y = 0;
  for (let x = X0; x <= X1; x += step) {
    y += (r() - 0.5) * rough;
    y *= 0.96;
    let p = 0;
    for (const [px, ph, pw] of peaks) p += ph * Math.exp(-Math.pow((x - px) / pw, 2));
    pts.push([x, base - p + y + Math.sin(x * 0.013) * rough * 0.8]);
  }
  return pts;
}

/** A willow in ink: a leaning trunk, a few long boughs, the twigs hanging in thin strokes
 *  set with small slanting leaves. */
function inkWillow(c: C2, r: R, x: number, base: number, h: number, w: number, col: string, strands = 26, sw = 0.8) {
  c.save();
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineCap = "round";
  const lean = (r() - 0.5) * w * 0.3;
  const tx = x + lean, ty = base - h * 0.55;
  c.lineWidth = Math.max(0.6, w * 0.05);
  c.beginPath();
  c.moveTo(x, base);
  c.bezierCurveTo(x - w * 0.04, base - h * 0.2, tx + w * 0.04, base - h * 0.4, tx, ty);
  c.stroke();
  const boughs: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const side = (i / 4) * 2 - 1 + (r() - 0.5) * 0.25;
    const ex = tx + side * w * (0.42 + r() * 0.1), ey = base - h * (0.82 - Math.abs(side) * 0.2);
    const cx = tx + side * w * 0.15, cy = base - h * (1.02 + r() * 0.04);
    boughs.push([tx, ty, cx, cy, ex, ey]);
    c.lineWidth = Math.max(0.4, w * 0.02);
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(cx, cy, ex, ey);
    c.stroke();
  }
  for (let i = 0; i < strands; i++) {
    const [x0, y0, cx, cy, ex, ey] = boughs[i % boughs.length];
    const t = 0.3 + r() * 0.7, u = 1 - t;
    const sx = u * u * x0 + 2 * u * t * cx + t * t * ex, sy = u * u * y0 + 2 * u * t * cy + t * t * ey;
    const out = Math.abs(sx - tx) / (w * 0.5);
    const len = h * (0.25 + out * 0.4 + r() * 0.18);
    const sway = (r() - 0.5) * w * 0.05;
    c.globalAlpha = 0.6 + r() * 0.4;
    c.lineWidth = sw;
    c.beginPath();
    c.moveTo(sx, sy);
    c.quadraticCurveTo(sx + sway, sy + len * 0.5, sx + sway * 1.4, sy + len);
    c.stroke();
    const nl = Math.min(14, Math.floor(len / Math.max(2.5, h * 0.035)));
    for (let k = 1; k < nl; k++) {
      const s = k / nl;
      const lx = sx + sway * 1.4 * s * s, ly = sy + len * s;
      c.save();
      c.translate(lx, ly);
      c.rotate((k % 2 ? -1 : 1) * (0.45 + r() * 0.3));
      c.beginPath();
      c.ellipse(0, h * 0.012, Math.max(0.3, sw * 0.6), Math.max(0.7, h * 0.016), 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
  c.globalAlpha = 1;
  c.restore();
}
/** A broad-leaved tree in the 点叶 manner: a twisting trunk and clusters of ink dots. */
function dotTree(c: C2, r: R, x: number, base: number, h: number, w: number, col: string, dark = 0.9) {
  c.save();
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineCap = "round";
  c.lineWidth = Math.max(0.5, w * 0.05);
  const tx = x + (r() - 0.5) * w * 0.2;
  c.beginPath();
  c.moveTo(x, base);
  c.quadraticCurveTo(x + (r() - 0.5) * w * 0.2, base - h * 0.3, tx, base - h * 0.55);
  c.stroke();
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k - 1) * 0.8;
    c.lineWidth = Math.max(0.4, w * 0.03);
    c.beginPath();
    c.moveTo(tx, base - h * 0.5);
    c.lineTo(tx + Math.cos(a) * w * 0.3, base - h * 0.55 + Math.sin(a) * h * 0.25);
    c.stroke();
  }
  const clusters = 5 + Math.floor(r() * 3);
  const dots = w > 14 ? 24 : 12;
  for (let k = 0; k < clusters; k++) {
    const ccx = tx + (r() - 0.5) * w * 0.8, ccy = base - h * (0.62 + r() * 0.3);
    for (let i = 0; i < dots; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      c.globalAlpha = dark * (0.5 + r() * 0.5);
      c.beginPath();
      c.ellipse(ccx + Math.cos(a) * d * w * 0.22, ccy + Math.sin(a) * d * h * 0.13, Math.max(0.5, w * 0.035), Math.max(0.4, h * 0.022), r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = 1;
  c.restore();
}
/** A pine: a leaning trunk and flat shelves of needles. */
function pine(c: C2, r: R, x: number, base: number, h: number, w: number, col: string) {
  c.save();
  c.strokeStyle = col;
  c.lineCap = "round";
  const lean = (r() - 0.5) * w * 0.5;
  c.lineWidth = Math.max(0.6, w * 0.06);
  c.beginPath();
  c.moveTo(x, base);
  c.bezierCurveTo(x + lean * 0.3, base - h * 0.4, x + lean * 0.8, base - h * 0.7, x + lean, base - h);
  c.stroke();
  for (let k = 0; k < 5; k++) {
    const t = 0.35 + k * 0.15;
    const px = x + lean * t, py = base - h * t;
    const side = k % 2 ? 1 : -1;
    const len = w * (0.5 - k * 0.06);
    c.lineWidth = Math.max(0.4, w * 0.025);
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + side * len, py - h * 0.03);
    c.stroke();
    for (let i = 0; i < 14; i++) {
      const u = r();
      const nx = px + side * len * u + (r() - 0.5) * w * 0.12, ny = py - h * 0.03 * u - r() * h * 0.06;
      c.globalAlpha = 0.6 + r() * 0.4;
      c.lineWidth = Math.max(0.3, w * 0.012);
      c.beginPath();
      c.moveTo(nx - w * 0.05, ny + h * 0.01);
      c.lineTo(nx, ny - h * 0.02);
      c.lineTo(nx + w * 0.05, ny + h * 0.01);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  c.restore();
}
/** Water in the Song manner: fine, close, trembling lines, closer and paler far off. */
function waterLines(c: C2, r: R, X0: number, X1: number, Y0: number, Y1: number, density = 1) {
  c.save();
  c.lineCap = "round";
  for (let y = Y0 + 1; y < Y1; ) {
    const s = sAt(y);
    const gap = 1.2 + s * 2.8;
    c.strokeStyle = `rgba(${PALE},${(0.05 + 0.07 * clamp(1.2 - s * 0.5)) * density})`;
    c.lineWidth = 0.35 + s * 0.3;
    const amp = 0.3 + s * 0.9, wl = 10 + s * 22;
    let x = X0 + r() * 20;
    while (x < X1) {
      const len = (20 + r() * 110) * Math.max(0.5, s);
      c.beginPath();
      for (let k = 0; k <= len; k += 4) {
        const yy = y + Math.sin((x + k) / wl + y) * amp;
        if (k === 0) c.moveTo(x + k, yy);
        else c.lineTo(x + k, yy);
      }
      c.stroke();
      x += len + (6 + r() * 40) * Math.max(0.5, s);
    }
    y += gap * (0.8 + r() * 0.4);
  }
  c.restore();
}
/** a tiny figure, as the Song painters put them in: a dark gown, a head, sometimes a hat */
function figure(c: C2, x: number, base: number, s: number, dir = 1) {
  c.fillStyle = C(INK, 1);
  c.beginPath();
  c.moveTo(x - 2.4 * s, base);
  c.lineTo(x - 1.4 * s, base - 8 * s);
  c.lineTo(x + 1.4 * s, base - 8 * s);
  c.lineTo(x + 2.4 * s, base);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(x + 0.2 * dir * s, base - 9.6 * s, 1.5 * s, 0, Math.PI * 2);
  c.fill();
  c.fillRect(x - 2 * s, base - 11 * s, 4 * s, 0.8 * s);
}

// ------------------------------------------------------------------ what is on the scroll
// the poems in the windows next to his, and when each wakes
const POEMS = [
  { X: HERO.X - 116, text: "相思渐与柳丝长", beat: 1 },
  { X: HERO.X - 60, text: "几行诗里关河月", beat: 0 },
  { X: HERO.X + 60, text: "无数人间燕子楼", beat: 0 },
  { X: HERO.X + 116, text: "一春唯有我多情", beat: 1 },
];
const PW = 10, PH = 42;

export function createCity(renderer: THREE.WebGLRenderer): SceneHandle {
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(`rgb(${rgbS(LANDN)})`);
  const camera = new THREE.OrthographicCamera(0, 1920, 0, -1080, -10, 10);
  camera.position.z = 5;
  const uF = { value: 0 }, uWave = { value: W0 }, uBeat = { value: 0 }, uGlow = { value: 0.36 };
  const uHazeC = { value: new THREE.Color(0, 0, 0) };
  const A: Record<string, Anchor> = {
    hero: { z: 1, X: HERO.X, Y: HERO.Y },
    dive: { z: 1, X: DIVE.X, Y: DIVE.Y },
  };
  POEMS.forEach((p, i) => (A[`p${i}`] = { z: 1, X: p.X, Y: HERO.Y }));

  // the glow of the town: a coarse grid over the whole scroll, summed from every light
  const GQ = 0.25, GW = Math.round((SX1 - SX0) * GQ), GH = Math.round(1080 * GQ);
  const glowF = new Float32Array(GW * GH);
  const glowAt = (X: number, Y: number, r: number, amt: number) => {
    const gx = (X - SX0) * GQ, gy = Y * GQ, gr = Math.max(0.7, r * GQ);
    const x0 = Math.max(0, Math.floor(gx - 2.3 * gr)), x1 = Math.min(GW - 1, Math.ceil(gx + 2.3 * gr));
    const y0 = Math.max(0, Math.floor(gy - 2.3 * gr)), y1 = Math.min(GH - 1, Math.ceil(gy + 2.3 * gr));
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const dx = (i + 0.5 - gx) / gr, dy = (j + 0.5 - gy) / gr;
        const d2 = dx * dx + dy * dy;
        if (d2 < 5.3) glowF[j * GW + i] += amt * Math.exp(-d2);
      }
  };
  const glowData = new Uint8Array(GW * GH * 4);
  const glowTex = new THREE.DataTexture(glowData, GW, GH, THREE.RGBAFormat, THREE.UnsignedByteType);
  glowTex.magFilter = THREE.LinearFilter;
  glowTex.minFilter = THREE.LinearFilter;

  let order = 1;
  const placed: { mesh: THREE.Mesh; z: number; X0: number; X1: number; Y0: number; Y1: number }[] = [];
  const put = (mesh: THREE.Mesh, z: number, X0: number, X1: number, Y0: number, Y1: number) => {
    mesh.renderOrder = order++;
    mesh.frustumCulled = false;
    scene.add(mesh);
    placed.push({ mesh, z, X0, X1, Y0, Y1 });
    return mesh;
  };
  const finish = (L: Layer) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tInk: { value: toTex(L.ink.canvas as HTMLCanvasElement) },
        tWin: { value: L.wctx ? toTex(L.wctx.canvas as HTMLCanvasElement, false) : null },
        tWet: { value: toTex(L.wet.canvas as HTMLCanvasElement, false) },
        tGlow: { value: glowTex },
        uRect: { value: new THREE.Vector4(L.X0, L.X1, L.Y0, L.Y1) },
        uEdges: { value: new THREE.Vector4(...(L.edges ?? [0, 0, 0, 0])) },
        uHasWin: { value: L.wctx ? 1 : 0 },
        uWave,
        uBeat,
        uF,
        uHazeC,
        uGlow,
        uGain: { value: L.gain ?? 1 },
      },
      vertexShader: LAYER_VS,
      fragmentShader: LAYER_FS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    return put(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat), L.z, L.X0, L.X1, L.Y0, L.Y1);
  };
  const pane = (X: number, Y: number, w: number, h: number, q: number, draw: (c: C2, w: number, h: number) => void, gain = 1) => {
    const cv = makeCanvas(w * q, h * q);
    const c = cv.getContext("2d")!;
    c.scale(q, q);
    draw(c, w, h);
    const mat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: toTex(cv) }, uOn: { value: 0 }, uGain: { value: gain }, uFlare: { value: 0 } },
      vertexShader: LAYER_VS,
      fragmentShader: PANE_FS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    return put(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat), 1, X - w / 2, X + w / 2, Y - h / 2, Y + h / 2);
  };
  const paper = (c: C2, w: number, h: number, inner: string, outer: string) => {
    const g = c.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  };

  // ---------------------------------------------------------------- the scroll and its detail patches
  // The scroll is painted once, in tiles; where the camera comes close (his lane as it pulls
  // back, the pavilion it falls into) the same strokes are laid again at a finer grain.
  const TILES: Layer[] = [];
  for (let x = SX0; x < SX1; x += 2000) TILES.push(layer({ z: 1, X0: x, X1: Math.min(SX1, x + 2000), Y0: 0, Y1: 1080, q: 1, win: true, gain: 1.1 }));
  const DETAIL = [
    // (canvases stay within 4096 px a side: past that the browser falls back to a very slow path)
    layer({ z: 1, X0: 480, X1: 1940, Y0: 360, Y1: 1080, q: 2.75, win: true, gain: 1.1, edges: [150, 150, 110, 0] }),
    layer({ z: 1, X0: DIVE.X - 260, X1: DIVE.X + 260, Y0: DIVE.Y - 170, Y1: DIVE.Y + 230, q: 5, win: true, gain: 1.1, edges: [60, 60, 60, 60] }),
    layer({ z: 1, X0: DIVE.X - 64, X1: DIVE.X + 64, Y0: DIVE.Y - 60, Y1: DIVE.Y + 72, q: 14, win: true, gain: 1.1, edges: [18, 18, 18, 18] }),
  ];
  const ALL = [...TILES, ...DETAIL];
  type Painter = (c: C2, rr: R) => void;
  /** paint the same strokes into every layer the shape touches — and again, in black, into
   *  the light map (so it hides the lights behind it) and the water mask */
  const paint = (seed: number, x0: number, x1: number, fn: Painter, o: { mask?: boolean; wet?: boolean } = {}) => {
    for (const L of ALL) {
      if (L.X1 <= x0 || L.X0 >= x1) continue;
      L.ink.save();
      fn(L.ink, mulberry32(seed));
      L.ink.restore();
      if (o.mask === false) continue;
      MASK = true;
      if (L.wctx) {
        L.wctx.save();
        fn(L.wctx, mulberry32(seed));
        L.wctx.restore();
      }
      if (o.wet !== false) {
        L.wet.save();
        fn(L.wet, mulberry32(seed));
        L.wet.restore();
      }
      MASK = false;
    }
  };
  /** the ground: painted first, under everything, into the ink only */
  const ground = (seed: number, fn: Painter) => {
    for (const L of ALL) {
      L.ink.save();
      fn(L.ink, mulberry32(seed));
      L.ink.restore();
    }
  };
  // where the water is, for the shaders (per layer) and for the reflections (one coarse map)
  const waterCv = makeCanvas(GW, GH);
  const wqc = waterCv.getContext("2d", SOFT)!;
  wqc.fillStyle = "#000";
  wqc.fillRect(0, 0, GW, GH);
  wqc.setTransform(GQ, 0, 0, GQ, -SX0 * GQ, 0);
  let waterData: Uint8ClampedArray | null = null;
  const waterAt = (X: number, Y: number) => {
    if (!waterData) return false;
    const i = Math.floor((X - SX0) * GQ), j = Math.floor(Y * GQ);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return false;
    return waterData[(j * GW + i) * 4] > 127;
  };
  const wetArea = (x0: number, x1: number, fn: (c: C2) => void) => {
    for (const L of ALL)
      if (L.X1 > x0 && L.X0 < x1) {
        L.wet.save();
        L.wet.fillStyle = "#fff";
        fn(L.wet);
        L.wet.restore();
      }
    wqc.save();
    wqc.fillStyle = "#fff";
    fn(wqc);
    wqc.restore();
  };
  /** a light, in every layer that shows it; registered (for the threads) in its main tile only */
  const lamp = (X: number, Y: number, w: number, h: number, rank: number, tint = 0, b = 1, shape: "rect" | "oval" = "rect", lat?: [number, number, number], refl = false) => {
    for (const L of ALL) {
      if (X + w / 2 + 2 < L.X0 || X - w / 2 - 2 > L.X1 || Y + h / 2 + 2 < L.Y0 || Y - h / 2 - 2 > L.Y1) continue;
      const home = TILES.includes(L) && X >= L.X0 && X < L.X1;
      light(L, X, Y, w, h, rank, tint, b, shape, lat, refl || !home);
    }
    if (!refl) {
      // the haze over the town comes from its far and middle distance; near windows have the bloom
      const sy = sAt(Y);
      const k = clamp((1.7 - sy) / 0.8, 0.12, 1);
      glowAt(X, Y, Math.min(5 + 1.8 * Math.max(w, h), 22 + 18 * Math.min(1, sy)), (0.07 + 0.3 * Math.min(1, (w * h) / 220)) * b * k);
    }
  };
  /** a light's reflection: mirrored about the water line, drawn out towards us in
   *  ripple-broken streaks, only where there is water */
  const reflect = (X: number, Y: number, w: number, h: number, wl: number, rank: number, tint: number, b: number, rr: R, len?: number) => {
    const s = sAt(wl);
    const st = 0.9 + 1.5 * Math.min(1.2, s);
    const total = len ?? clamp((wl - Y) * 1.3 + 16, 12, 140);
    const n = Math.max(3, Math.round(total / st));
    const y0 = 2 * wl - Y;
    for (let k = 0; k < n; k++) {
      const yy = y0 - h / 2 + k * st + rr() * 0.6 * st;
      if (yy < wl + 0.6) continue;
      if (yy > 1082) break;
      const xx = X + (rr() - 0.5) * w * 0.5;
      if (!waterAt(xx, yy)) break;
      if (rr() < 0.3) continue; // broken by the ripples
      const fade = Math.pow(1 - k / (n + 2), 1.25);
      lamp(xx, yy, w * (0.45 + rr() * 1.15), 0.45 + 0.6 * Math.min(1.2, s), rank, tint, b * fade, "rect", undefined, true);
    }
  };
  /** re-time the light nearest (X, Y) so it wakes at `rank`; returns where it is */
  const retarget = (X: number, Y: number, rank: number, minW = 3): Anchor => {
    let best: Rec | null = null, bd = 1e9;
    for (const L of TILES)
      for (const rc of L.recs) {
        if (rc.w < minW || rc.tint > 0.6) continue;
        const d = Math.hypot(rc.X - X, rc.Y - Y);
        if (d < bd) (bd = d), (best = rc);
      }
    if (!best) return { z: 1, X, Y };
    lamp(best.X, best.Y, best.w, best.h, rank, best.tint, Math.max(best.b, 0.9), best.shape, best.lat, true);
    return { z: 1, X: best.X, Y: best.Y };
  };
  /** a window: dark frame and paper, lit with upright bars (直棂), and its reflection if water is below */
  const win = (rr: R, X: number, Y: number, w: number, h: number, wl?: number, b = 0.85, tint = 0, lat?: [number, number]) => {
    const seed = Math.floor(rr() * 1e6);
    paint(seed, X - w, X + w, (c) => {
      c.fillStyle = C(INK, 1);
      c.fillRect(X - w / 2 - 1.3, Y - h / 2 - 1.3, w + 2.6, h + 2.6);
      c.fillStyle = C(PAPER_D, 1);
      c.fillRect(X - w / 2, Y - h / 2, w, h);
    });
    const rk = wakeRank(X, Y, rr);
    lamp(X, Y, w, h, rk, tint, b, "rect", [lat ? lat[0] : Math.max(2, Math.round(w / 3)), lat ? lat[1] : 1, Math.max(0.4, w * 0.05)]);
    if (wl !== undefined) reflect(X, Y, w, h, wl, rk, tint, b * 0.85, rr);
    return rk;
  };
  /** a lantern hanging on a cord; unlit it is a dark red paper ball */
  const lantern = (rr: R, X: number, top: number, Y: number, s: number, tint = 1, wl?: number) => {
    const seed = Math.floor(rr() * 1e6);
    paint(seed, X - 6 * s, X + 6 * s, (c) => {
      c.strokeStyle = C(INK, 1);
      c.lineWidth = Math.max(0.4, 0.5 * s);
      c.beginPath();
      c.moveTo(X, top);
      c.lineTo(X, Y - 3.4 * s);
      c.stroke();
      c.fillStyle = C(tint > 0.5 ? "74,26,22" : "70,52,30", 1);
      c.beginPath();
      c.ellipse(X, Y, 2.6 * s, 3.3 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = C(INK, 1);
      c.fillRect(X - 1.4 * s, Y - 3.6 * s, 2.8 * s, 0.8 * s);
      c.fillRect(X - 1.4 * s, Y + 2.9 * s, 2.8 * s, 0.8 * s);
    });
    const rk = wakeRank(X, Y, rr);
    lamp(X, Y, 5 * s, 6.4 * s, rk, tint, 1, "oval");
    if (wl !== undefined) reflect(X, Y, 5 * s, 6.4 * s, wl, rk, tint, 0.85, rr, 80 * s);
    return rk;
  };

  // everything standing on the ground, painted far to near
  const ITEMS: { d: number; n: number; draw: () => void }[] = [];
  const item = (d: number, draw: () => void) => ITEMS.push({ d, n: ITEMS.length, draw });
  const RESERVE: [number, number, number, number][] = [];

  // ================================================================ the ground
  const weave = makeCanvas(64, 64);
  {
    const w = weave.getContext("2d")!;
    const r = mulberry32(5);
    for (let y = 0; y < 64; y += 2) {
      w.fillStyle = `rgba(255,255,255,${0.01 + r() * 0.018})`;
      w.fillRect(0, y, 64, 1);
    }
    for (let x = 0; x < 64; x += 2) {
      w.fillStyle = `rgba(0,0,0,${0.016 + r() * 0.022})`;
      w.fillRect(x, 0, 1, 64);
    }
  }
  ground(11, (c, rr) => {
    const g = c.createLinearGradient(0, 0, 0, FAR + 20);
    g.addColorStop(0, `rgb(${rgbS(SKY0)})`);
    g.addColorStop(0.6, `rgb(${rgbS(SKY1)})`);
    g.addColorStop(1, `rgb(${rgbS(SKY2)})`);
    c.fillStyle = g;
    c.fillRect(SX0, 0, SX1 - SX0, FAR + 20);
    const lg = c.createLinearGradient(0, FAR - 20, 0, 1080);
    lg.addColorStop(0, `rgb(${rgbS(LANDF)})`);
    lg.addColorStop(1, `rgb(${rgbS(LANDN)})`);
    c.fillStyle = lg;
    c.fillRect(SX0, FAR - 20, SX1 - SX0, 1100 - FAR);
    // age: soft stains in the silk
    for (let i = 0; i < 110; i++) {
      const x = SX0 + rr() * (SX1 - SX0), y = rr() * 1080, rad = 60 + rr() * 280;
      const sg = c.createRadialGradient(x, y, 0, x, y, rad);
      const warm = rr() < 0.6;
      sg.addColorStop(0, warm ? `rgba(84,68,52,${0.04 + rr() * 0.05})` : `rgba(22,24,36,${0.05 + rr() * 0.07})`);
      sg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sg;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  // stars, faint, high up; the town's lights will outshine them
  ground(12, (c, rr) => {
    for (let i = 0; i < 1100; i++) {
      const x = SX0 + rr() * (SX1 - SX0), y = 4 + rr() * rr() * 250;
      if (Math.hypot(x - MOON.X, y - MOON.Y) < 110) continue;
      const a = 0.1 + rr() * rr() * 0.55, rad = 0.4 + rr() * 0.7;
      c.fillStyle = `rgba(220,226,240,${a})`;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
    // thin cloud, washed in, paler where the moon lights it
    for (let i = 0; i < 30; i++) {
      const x = SX0 + rr() * (SX1 - SX0), y = 40 + rr() * 190, w = 220 + rr() * 560, h = 5 + rr() * 13;
      const near = Math.exp(-Math.pow((x - MOON.X) / 650, 2));
      const col = near > 0.25 ? "122,128,148" : "38,42,60";
      const g = c.createRadialGradient(x, y, 0, x, y, w / 2);
      g.addColorStop(0, `rgba(${col},${0.12 + 0.12 * near})`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.save();
      c.translate(x, y);
      c.scale(1, h / w);
      c.translate(-x, -y);
      c.fillStyle = g;
      c.fillRect(x - w / 2, y - w / 2, w, w);
      c.restore();
    }
    // the moon
    const mg = c.createRadialGradient(MOON.X, MOON.Y, MOON.R * 0.6, MOON.X, MOON.Y, MOON.R * 5);
    mg.addColorStop(0, "rgba(220,224,232,0.3)");
    mg.addColorStop(1, "rgba(200,206,220,0)");
    c.fillStyle = mg;
    c.fillRect(MOON.X - MOON.R * 5, MOON.Y - MOON.R * 5, MOON.R * 10, MOON.R * 10);
    const d = c.createRadialGradient(MOON.X - 6, MOON.Y - 6, 4, MOON.X, MOON.Y, MOON.R);
    d.addColorStop(0, "rgba(242,242,238,1)");
    d.addColorStop(1, "rgba(214,218,226,1)");
    c.fillStyle = d;
    c.beginPath();
    c.arc(MOON.X, MOON.Y, MOON.R, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(MOON.X, MOON.Y, MOON.R - 1, 0, Math.PI * 2);
    c.clip();
    for (let i = 0; i < 7; i++) {
      c.fillStyle = `rgba(150,158,172,${0.12 + rr() * 0.12})`;
      c.beginPath();
      c.arc(MOON.X + (rr() - 0.5) * 34, MOON.Y + (rr() - 0.5) * 34, 3 + rr() * 8, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  });
  // hills: the far blue range all along, nearer hills over the town and round the lake
  const hillBand = (seed: number, base: number, peaks: [number, number, number][], rough: number, top: string, foot: string, cun: number, x0 = SX0, x1 = SX1, mist = "72,78,100") =>
    ground(seed, (c, rr) => {
      const pts = ridgeLine(rr, x0, x1, base, peaks, rough, 5);
      const hi = Math.min(...pts.map((p) => p[1]));
      const g = c.createLinearGradient(0, hi, 0, base + 40);
      g.addColorStop(0, top);
      g.addColorStop(1, foot);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x0, base + 40);
      for (const [x, y] of pts) c.lineTo(x, y);
      c.lineTo(x1, base + 40);
      c.closePath();
      c.fill();
      // 披麻皴: long soft strokes running down the slopes
      c.save();
      c.clip();
      c.lineCap = "round";
      for (let i = 0; i < cun; i++) {
        // each stroke runs down the slope it starts on, steep, a little curved
        const idx = 1 + Math.floor(rr() * (pts.length - 2));
        const [x, y] = pts[idx];
        const slope = (pts[idx + 1][1] - pts[idx - 1][1]) / (pts[idx + 1][0] - pts[idx - 1][0]);
        const dirX = slope > 0.02 ? 1 : slope < -0.02 ? -1 : rr() < 0.5 ? 1 : -1;
        const ang = 0.95 + rr() * 0.35, len = 12 + rr() * 36;
        const dx = Math.cos(ang) * dirX * len, dy = Math.sin(ang) * len;
        const y0 = y + 2 + rr() * 22;
        c.strokeStyle = rr() < 0.62 ? `rgba(${INK},${0.06 + rr() * 0.1})` : `rgba(${PALE},${0.02 + rr() * 0.035})`;
        c.lineWidth = 0.5 + rr() * 0.9;
        c.beginPath();
        c.moveTo(x, y0);
        c.quadraticCurveTo(x + dx * 0.4 + dirX * 3, y0 + dy * 0.55, x + dx, y0 + dy);
        c.stroke();
      }
      c.restore();
      const mg = c.createLinearGradient(0, base - 40, 0, base + 26);
      mg.addColorStop(0, `rgba(${mist},0)`);
      mg.addColorStop(1, `rgba(${mist},0.62)`);
      c.fillStyle = mg;
      c.fillRect(x0, base - 40, x1 - x0, 66);
    });
  hillBand(21, 330, [[-300, 120, 260], [300, 100, 240], [900, 160, 300], [1500, 90, 260], [2100, 140, 280], [2800, 100, 260], [3500, 150, 300], [4200, 190, 320], [4900, 210, 300], [5400, 150, 260]], 3, "rgba(46,51,72,1)", "rgba(56,60,80,1)", 1800);
  hillBand(22, 352, [[-200, 40, 200], [620, 78, 230], [1500, 36, 220], [2600, 46, 260], [3200, 30, 200]], 3.2, "rgba(30,33,47,1)", "rgba(44,46,60,1)", 1600, SX0, 3560);
  hillBand(23, 410, [[3600, 40, 160], [3850, 118, 190], [4300, 64, 220], [4700, 44, 200], [5060, 94, 230], [5420, 60, 200]], 3.4, "rgba(28,31,45,1)", "rgba(42,45,60,1)", 1700, 3460, SX1, "70,76,98");
  // pines along the near ridges
  ground(24, (c, rr) => {
    for (let i = 0; i < 70; i++) {
      const x = 3560 + rr() * 1880;
      const y = 410 - 40 * Math.exp(-Math.pow((x - 3600) / 160, 2)) - 118 * Math.exp(-Math.pow((x - 3850) / 190, 2)) - 64 * Math.exp(-Math.pow((x - 4300) / 220, 2)) - 94 * Math.exp(-Math.pow((x - 5060) / 230, 2)) + 4 + rr() * 30;
      pine(c, rr, x, y, 10 + rr() * 9, 9 + rr() * 6, `rgba(${INK},0.85)`);
    }
    for (let i = 0; i < 50; i++) {
      const x = 300 + rr() * 700;
      const y = 352 - 78 * Math.exp(-Math.pow((x - 620) / 230, 2)) + 4 + rr() * 24;
      pine(c, rr, x, y, 9 + rr() * 8, 8 + rr() * 6, `rgba(${INK},0.8)`);
    }
  });
  // the streets: a paler line of trodden ground between the houses
  ground(25, (c) => {
    for (const st of STREETS) {
      walk(st.pts, () => 6, (x, y) => {
        const s = sAt(y);
        c.fillStyle = `rgba(66,66,76,0.55)`;
        c.beginPath();
        c.arc(x, y - 2 * s, (st.w * s) / 2, 0, Math.PI * 2);
        c.fill();
      });
    }
  });

  // ---- the water: his canal, the side canal, the river, the lake
  const canalPath = (c: C2) => {
    c.beginPath();
    c.rect(SX0, CANAL, 2880 - SX0, 1090 - CANAL);
  };
  const sidePath = (c: C2) => {
    c.beginPath();
    for (let y = SIDE.top; y <= CANAL + 2; y += 8) c.lineTo(sideX(y) - sideW(y) / 2, y);
    for (let y = CANAL + 2; y >= SIDE.top; y -= 8) c.lineTo(sideX(y) + sideW(y) / 2, y);
    c.closePath();
  };
  const riverPath = (c: C2) => {
    c.beginPath();
    for (let y = RV_TOP; y <= 1090; y += 6) c.lineTo(rvL(y), y);
    for (let y = 1090; y >= RV_TOP; y -= 6) c.lineTo(rvR(y), y);
    c.closePath();
  };
  const lakePath = (c: C2) => {
    c.beginPath();
    c.moveTo(bankEdge(1090), footY(1090));
    for (let Y = 1090; Y >= WALL.y0 + 20; Y -= 6) {
      const x = bankEdge(Y), y = footY(Y);
      if (y < shoreY(x)) break;
      c.lineTo(x, y);
    }
    for (let x = wallX(430) + 14; x <= SX1; x += 8) c.lineTo(x, shoreY(x));
    c.lineTo(SX1, 1090);
    c.closePath();
  };
  const waterBody = (seed: number, x0: number, x1: number, y0: number, path: (c: C2) => void, den = 1) => {
    ground(seed, (c, rr) => {
      const g = c.createLinearGradient(0, y0, 0, 1080);
      g.addColorStop(0, "rgba(46,50,68,1)");
      g.addColorStop(0.3, "rgba(34,38,54,1)");
      g.addColorStop(1, "rgba(17,20,31,1)");
      c.fillStyle = g;
      path(c);
      c.fill();
      c.save();
      path(c);
      c.clip();
      waterLines(c, rr, x0, x1, y0, 1084, den);
      c.restore();
    });
    wetArea(x0, x1, (c) => {
      path(c);
      c.fill();
    });
  };
  waterBody(31, SX0, 2880, CANAL, canalPath, 1.4);
  waterBody(32, 260, 620, SIDE.top, sidePath, 1.2);
  waterBody(33, 1900, 3200, RV_TOP, riverPath, 1.25);
  waterBody(34, 3280, SX1, 380, lakePath, 1.2);
  // the sky lies pale in the lake round the moon's reflection
  ground(35, (c) => {
    c.save();
    lakePath(c);
    c.clip();
    const g = c.createRadialGradient(MOON.X, 700, 0, MOON.X, 700, 520);
    g.addColorStop(0, "rgba(140,148,170,0.2)");
    g.addColorStop(1, "rgba(140,148,170,0)");
    c.fillStyle = g;
    c.fillRect(MOON.X - 520, 380, 1040, 700);
    c.restore();
  });
  // the river's banks: dressed stone, a pale lip where the moon catches it
  ground(36, (c) => {
    for (const side of [-1, 1]) {
      const bx = (y: number) => (side < 0 ? rvL(y) : rvR(y));
      c.strokeStyle = `rgba(${STONE},1)`;
      c.lineWidth = 2.4;
      c.beginPath();
      for (let y = 470; y <= 1080; y += 6) c.lineTo(bx(y) + side * 1.2, y);
      c.stroke();
      c.strokeStyle = `rgba(${PALE},0.3)`;
      c.lineWidth = 0.7;
      c.beginPath();
      for (let y = 470; y <= 1080; y += 6) c.lineTo(bx(y) + side * 2.4, y - 1);
      c.stroke();
    }
  });
  // the lakeside bank: packed earth with a dressed-stone lip; at the gate a paved landing steps
  // down to the water
  ground(39, (c) => {
    c.fillStyle = `rgba(${mixc(INKc, MISTc, 0.3)},1)`;
    c.beginPath();
    for (let Y = 1090; Y >= WALL.y0 + 20; Y -= 6) c.lineTo(wallX(Y) + 8 * sAt(Y), footY(Y));
    for (let Y = WALL.y0 + 20; Y <= 1090; Y += 6) c.lineTo(bankEdge(Y), footY(Y));
    c.closePath();
    c.fill();
    const W0 = (Y: number, a: number): [number, number] => [wallX(Y) + a * sAt(Y), footY(Y)];
    const g0 = GATE.base - 17, g1 = GATE.base + 17, a1 = 10 + bankW(GATE.base) - 3;
    c.fillStyle = `rgba(${STONE},1)`;
    c.beginPath();
    for (const [Y, a] of [[g0, 19], [g0, a1], [g1, a1], [g1, 19]] as const) c.lineTo(...W0(Y, a));
    c.closePath();
    c.fill();
    c.strokeStyle = `rgba(${PALE},0.22)`;
    c.lineWidth = 0.6;
    for (let k = 0; k < 4; k++) {
      // the steps down to the water, their edges catching the moon
      const a = a1 - 1.6 - k * 2.4;
      c.beginPath();
      c.moveTo(...W0(g0 + 2, a));
      c.lineTo(...W0(g1 - 2, a));
      c.stroke();
    }
    c.strokeStyle = `rgba(${STONE},1)`;
    c.lineWidth = 2.2;
    c.beginPath();
    for (let Y = WALL.y0 + 26; Y <= 1090; Y += 6) c.lineTo(bankEdge(Y) - 0.8, footY(Y));
    c.stroke();
    c.strokeStyle = `rgba(${PALE},0.3)`;
    c.lineWidth = 0.7;
    c.beginPath();
    for (let Y = WALL.y0 + 26; Y <= 1090; Y += 6) c.lineTo(bankEdge(Y) + 0.6, footY(Y) - 0.6);
    c.stroke();
  });
  waterData = wqc.getImageData(0, 0, GW, GH).data;

  // ================================================================ the town
  // ---- a house of the town, seen from high up and in front: the tiled roof (most of what
  // you see from up here), a strip of wall under the eave, its windows; a hall has a second
  // roof, a shop a lit open front, some a lantern at the eave
  const cHouse = (seed: number, x: number, base: number, w: number, s: number, kind: number, shop: boolean) => {
    const rr = mulberry32(seed);
    const storeys = kind === 1 ? 2 : 1;
    const wallH = (6.5 + rr() * 5) * s * (storeys === 2 ? 1.7 : 1);
    const roofH = (8 + rr() * 5) * s * (kind === 2 ? 1.25 : 1);
    const top = base - wallH, ridge = top - roofH;
    const fog = fogAt(s);
    const wj = 0.86 + rr() * 0.24, rj = 0.8 + rr() * 0.4;
    const wallC = mixc(WALLc.map((v) => v * wj), MISTc, fog * 0.7), roofC = mixc(ROOFc.map((v) => v * rj), MISTc, fog * 0.55), postC = mixc(INKc, MISTc, fog * 0.5);
    const rimA = (rr() < 0.3 ? 0.45 : 0.75 + rr() * 0.5) * (0.13 + 0.12 * Math.min(1, s));
    const inset = w * (0.1 + rr() * 0.14);
    paint(seed, x - 6 * s, x + w + 6 * s, (c) => {
      c.fillStyle = C(wallC);
      c.fillRect(x, top, w, wallH + 0.5);
      if (s > 0.4) {
        c.fillStyle = C(postC, 0.8);
        const pw = Math.max(0.6, 1.1 * s);
        c.fillRect(x, top, pw, wallH);
        c.fillRect(x + w - pw, top, pw, wallH);
        if (storeys === 2) c.fillRect(x, top + wallH * 0.48, w, Math.max(0.5, 0.9 * s));
        if (s > 1.1) for (let px = x + 14 * s; px < x + w - 8 * s; px += 14 * s) c.fillRect(px, top, pw * 0.8, wallH);
      }
      roof(c, x + w / 2, ridge, top + 0.6 * s, w / 2 + 1.6 * s, { oh: 2.8 * s, lift: 2 * s, thick: 1.3 * s, inset, fill: C(roofC), rim: C(PALE, rimA), tiles: s > 0.55 ? C(PALE, 0.06 + 0.02 * Math.min(1, s)) : undefined });
      if (kind === 2) roof(c, x + w / 2, ridge - roofH * 0.62, ridge + roofH * 0.2, w * 0.3, { oh: 2 * s, lift: 1.6 * s, thick: 1 * s, inset: w * 0.08, fill: C(roofC), rim: C(PALE, 0.2) });
    });
    // windows: one row (two upstairs), not every bay lit, no two alike
    for (let k = 0; k < storeys; k++) {
      const wy = top + wallH * (storeys === 2 ? (k ? 0.75 : 0.27) : 0.56);
      const wh = Math.max(1.1, wallH * (storeys === 2 ? 0.26 : 0.42));
      if (shop && k === storeys - 1) {
        const ww = w * (0.55 + rr() * 0.15);
        const rk = wakeRank(x + w / 2, wy, rr);
        lamp(x + w / 2, wy, ww, wh * 1.1, rk, 0, 0.78 + rr() * 0.15, "rect", s > 0.5 ? [Math.max(2, Math.round(ww / (3 * s))), 1, Math.max(0.35, 0.45 * s)] : undefined);
        continue;
      }
      const n = Math.max(1, Math.round(w / (12 * s)));
      for (let i = 0; i < n; i++) {
        if (rr() > 0.58) continue;
        const ww = Math.max(1.1, (2.4 + rr() * 2) * s);
        const wx = x + (w * (i + 0.5)) / n + (rr() - 0.5) * 2 * s;
        const rk = wakeRank(wx, wy, rr);
        const lat: [number, number, number] | undefined = ww > 3.4 ? [Math.max(2, Math.round(ww / (1.8 * s + 0.4))), 1, Math.max(0.35, 0.35 * s)] : undefined;
        lamp(wx, wy, ww, wh, rk, rr() < 0.04 ? 1 : 0, (0.55 + rr() * 0.45) * (0.8 + 0.2 * Math.min(1, s)), "rect", lat);
      }
    }
    if (rr() < (shop ? 0.55 : 0.1)) {
      const lx = x + w * (rr() < 0.5 ? 0.12 : 0.88), ly = top + 3 * s;
      lamp(lx, ly, 2.2 * s + 0.5, 2.8 * s + 0.6, wakeRank(lx, ly, rr), rr() < 0.75 ? 1 : 0, 1, "oval");
    }
    if (rr() < 0.03) glowAt(x + w / 2, base + 4 * s, 16 * s, 0.35); // a lit courtyard behind
  };
  const free = (x: number, base: number, w: number, s: number) => {
    const pts: [number, number][] = [[x, base], [x + w, base], [x + w / 2, base], [x + w / 2, base - 10 * s], [x, base - 8 * s], [x + w, base - 8 * s]];
    for (const [px, py] of pts) if (waterAt(px, py)) return false;
    for (const px of [x + 2 * s, x + w / 2, x + w - 2 * s]) if (streetClear(px, base - 4 * s) < 1.5 * s) return false;
    for (const [x0, y0, x1, y1] of RESERVE) if (x + w > x0 && x < x1 && base > y0 && base - 14 * s < y1) return false;
    return true;
  };
  const carpet = (seed: number, X0: number, X1: number, Y0: number, Y1: number) => {
    const rr = mulberry32(seed);
    for (let y = Y0; y < Y1; ) {
      const s = sAt(y);
      let x = X0 - rr() * 30 * s;
      while (x < X1) {
        const w = (16 + rr() * 42) * s;
        const base = y + (rr() - 0.5) * 7 * s;
        const sd = Math.floor(rr() * 1e9), kr = rr(), gap = rr();
        if (x + w > wallX(base) - 12 * s) break;
        if (free(x, base, w, s)) {
          const shop = streetClear(x + w / 2, base - 4 * s) < 7 * s;
          const kind = kr < 0.05 ? 2 : kr < 0.2 ? 1 : 0;
          const xx = x, ww = w, bb = base, ss = s;
          item(bb, () => cHouse(sd, xx, bb, ww, ss, kind, shop));
        }
        x += w + (gap < 0.24 ? (5 + rr() * 20) * s : rr() * 2.5 * s);
      }
      y += (12 + rr() * 10) * s;
    }
  };

  // ---- the near band: his lane on the canal
  /** a two-storey house on the canal, all timber: lattice windows above a balcony, lattice
   *  doors to the water steps below, a tiled roof; a shop has an open, lit front */
  const canalHouse = (seed: number, x: number, w: number, ridge: number, shop = false) => {
    const rr = mulberry32(seed);
    const eave = ridge + 25 + rr() * 7;
    const under = eave + 3.4;
    const floorY = under + (HOUSE_FOOT - under) * (0.44 + rr() * 0.06);
    const bays = Math.max(2, Math.round(w / 50));
    const bw = w / bays;
    paint(seed, x - 30, x + w + 30, (c) => {
      const g = c.createLinearGradient(0, under, 0, HOUSE_FOOT);
      g.addColorStop(0, C(WOOD));
      g.addColorStop(1, C(WOOD_D));
      c.fillStyle = g;
      c.fillRect(x, under - 2, w, HOUSE_FOOT - under + 2);
      c.fillStyle = C(INK, 0.16);
      for (let bx = x + 2; bx < x + w - 1; bx += 4.2 + rr() * 1.6) c.fillRect(bx, under, 0.5, HOUSE_FOOT - under);
      // the paper of every window and door, dark until lit
      for (let i = 0; i < bays; i++) {
        const bx0 = x + i * bw;
        c.fillStyle = C(INK, 1);
        c.fillRect(bx0 + bw * 0.16, under + 4, bw * 0.68, floorY - under - 18);
        c.fillStyle = C(PAPER_D);
        c.fillRect(bx0 + bw * 0.18, under + 5, bw * 0.64, floorY - under - 20);
        if (!shop || i !== Math.floor(bays / 2)) {
          c.fillStyle = C(INK, 1);
          c.fillRect(bx0 + bw * 0.12, floorY + 4, bw * 0.76, HOUSE_FOOT - floorY - 8);
          c.fillStyle = C(PAPER_D);
          c.fillRect(bx0 + bw * 0.14, floorY + 5, bw * 0.72, HOUSE_FOOT - floorY - 10);
          c.fillStyle = C(INK, 0.9);
          c.fillRect(bx0 + bw * 0.5 - 0.6, floorY + 5, 1.2, HOUSE_FOOT - floorY - 10);
        }
      }
      // posts and the brackets under the eave
      c.fillStyle = C(INK, 0.95);
      for (let i = 0; i <= bays; i++) {
        const px = x + i * bw;
        c.fillRect(px - 1.5, under - 2, 3, HOUSE_FOOT - under + 2);
        c.fillRect(px - 3.6, under - 1, 7.2, 2.2);
        c.fillRect(px - 2.2, under + 1, 4.4, 2);
      }
      // the balcony
      c.fillRect(x - 3, floorY - 1.8, w + 6, 3.6);
      for (let bx = x - 2; bx < x + w + 2; bx += 3.4) c.fillRect(bx, floorY - 12, 0.8, 10.4);
      c.fillRect(x - 3, floorY - 13, w + 6, 1.6);
      c.fillStyle = C(PALE, 0.3);
      c.fillRect(x - 3, floorY - 13.7, w + 6, 0.8);
      // stone footing, steps down to the water
      c.fillStyle = C(STONE);
      c.fillRect(x - 3, HOUSE_FOOT - 4, w + 6, 6);
      c.fillStyle = C(PALE, 0.25);
      c.fillRect(x - 3, HOUSE_FOOT - 4.6, w + 6, 0.7);
      if (rr() < 0.5) {
        c.fillStyle = C(STONE);
        const sx = x + w * (0.2 + rr() * 0.5);
        for (let k = 0; k < 3; k++) c.fillRect(sx - 14 + k * 2, HOUSE_FOOT + 2 + k * 3, 28 - k * 4, 3);
      }
      roof(c, x + w / 2, ridge, eave, w / 2, { oh: 10, lift: 7, thick: 3.2, inset: w * 0.12, fill: C(INK), rim: C(PALE, 0.36), tiles: C(PALE, 0.12) });
    });
    // the lights: some windows up, some doors down, the shop front
    for (let i = 0; i < bays; i++) {
      const bx0 = x + i * bw;
      if (rr() < 0.62) {
        const ww = bw * 0.64, hh = floorY - under - 20;
        const X = bx0 + bw / 2, Y = under + 5 + hh / 2;
        const rk = wakeRank(X, Y, rr);
        const b = 0.66 + rr() * 0.3;
        lamp(X, Y, ww, hh, rk, 0, b, "rect", [Math.max(3, Math.round(ww / 5)), 1, 0.9]);
        reflect(X, Y, ww, hh, CANAL, rk, 0, b * 0.8, rr);
      }
      if (shop && i === Math.floor(bays / 2)) {
        const X = bx0 + bw / 2, Y = (floorY + HOUSE_FOOT) / 2, ww = bw * 0.84, hh = HOUSE_FOOT - floorY - 10;
        const rk = wakeRank(X, Y, rr);
        lamp(X, Y, ww, hh, rk, 0, 0.62, "rect", [Math.max(3, Math.round(ww / 9)), 1, 1.2]);
        reflect(X, Y, ww, hh, CANAL, rk, 0, 0.55, rr);
      } else if (rr() < 0.16) {
        const ww = bw * 0.72, hh = HOUSE_FOOT - floorY - 10;
        const X = bx0 + bw / 2, Y = floorY + 5 + hh / 2;
        const rk = wakeRank(X, Y, rr);
        lamp(X, Y, ww, hh, rk, 0, 0.4 + rr() * 0.2, "rect", [Math.max(4, Math.round(ww / 4)), 2, 0.9]);
        reflect(X, Y, ww, hh, CANAL, rk, 0, 0.5, rr);
      }
    }
    // v4.1: the lanterns hang from the eave on the posts between the bays, clear of the windows (v4.0
    // hung them anywhere along the eave, and they came down over the upper windows like red dots
    // stuck on the paper); a shop has one at each end of its front. (v4.0 also flew a sign on a pole
    // from each shop, which hung over the front and read as a couplet in the wrong place: gone.)
    const nl = shop ? 2 : rr() < 0.55 ? 1 : 0;
    const post = (k: number) => (shop ? (k ? x + w - 1 : x + 1) : x + bw * Math.max(1, Math.min(bays - 1, Math.round(bays / 2 + (rr() - 0.5) * (bays - 1)))));
    for (let k = 0; k < nl; k++) lantern(rr, post(k), under - 1, under + 9, 1.3, 1, CANAL);
    if (shop) {
      // (the old sign's numbers, still taken, so the town's other draws stay as they were)
      rr();
      rr();
    }
  };
  // his house (laid again, finer, for the pull-back)
  const hisHouse = (c: C2) => {
    const R0 = roof(c, HERO.X, 861, 892, 172, { oh: 16, lift: 8, thick: 4.5, inset: 30, fill: C(INK), rim: C(PALE, 0.4), tiles: C(PALE, 0.13) });
    const g = c.createLinearGradient(0, R0.under, 0, HOUSE_FOOT);
    g.addColorStop(0, C("70,57,52"));
    g.addColorStop(1, C(WOOD_D));
    c.fillStyle = g;
    c.fillRect(HERO.X - 172, R0.under - 1, 344, HOUSE_FOOT - R0.under + 1);
    // boards
    const rb = mulberry32(5009);
    for (let x = HERO.X - 170; x < HERO.X + 170; x += 3.6 + rb() * 1.4) {
      c.fillStyle = C(INK, 0.1 + rb() * 0.1);
      c.fillRect(x, R0.under, 0.45, HOUSE_FOOT - R0.under);
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = C(rb() < 0.5 ? "96,80,70" : "30,24,24", 0.05 + rb() * 0.06);
      c.fillRect(HERO.X - 170 + rb() * 336, R0.under + rb() * 130, 1 + rb() * 3, 6 + rb() * 30);
    }
    const sg = c.createRadialGradient(HERO.X, HERO.Y, 0, HERO.X, HERO.Y, 150);
    sg.addColorStop(0, C("255,170,96", 0.16));
    sg.addColorStop(1, C("255,170,96", 0));
    c.fillStyle = sg;
    c.fillRect(HERO.X - 172, R0.under, 344, HOUSE_FOOT - R0.under);
    c.fillStyle = C(INK);
    for (let x = HERO.X - 168; x < HERO.X + 168; x += 8) c.fillRect(x, R0.under - 1, 3.6, 3.6);
    for (const x of [HERO.X - 168, HERO.X - 88, HERO.X + 88, HERO.X + 168]) c.fillRect(x - 2, R0.under + 3, 4, HOUSE_FOOT - R0.under - 3);
    c.fillRect(HERO.X - 172, 958, 344, 3);
    for (let x = HERO.X - 170; x < HERO.X + 170; x += 5.5) c.fillRect(x, 961, 0.9, 9);
    c.fillRect(HERO.X - 172, 969, 344, 2);
    c.fillStyle = C(PALE, 0.3);
    c.fillRect(HERO.X - 172, 957.3, 344, 0.7);
    c.fillStyle = C("46,30,21"); // window frames: dark timber
    for (const p of POEMS) c.fillRect(p.X - PW / 2 - 1.4, HERO.Y - PH / 2 - 1.4, PW + 2.8, PH + 2.8);
    c.fillRect(HERO.X - HERO.w / 2 - 1.2, HERO.Y - HERO.h / 2 - 1.2, HERO.w + 2.4, HERO.h + 2.4);
    // below: lattice doors, a water gate for a boat, one lit window
    for (const [dx, dw] of [[-150, 36], [-30, 46], [120, 40]] as const) {
      c.fillStyle = C(INK);
      c.fillRect(HERO.X + dx - 1, 980, dw + 2, 42);
      c.fillStyle = C(PAPER_D);
      c.fillRect(HERO.X + dx, 981, dw, 40);
      c.fillStyle = C(INK, 0.9);
      for (let k = 1; k < 4; k++) c.fillRect(HERO.X + dx + (dw * k) / 4 - 0.4, 981, 0.8, 40);
      c.fillRect(HERO.X + dx, 1000, dw, 0.8);
    }
    c.fillStyle = C(STONE);
    c.fillRect(HERO.X - 176, HOUSE_FOOT - 6, 352, 8);
    c.fillStyle = C(PALE, 0.32);
    c.fillRect(HERO.X - 176, HOUSE_FOOT - 6.6, 352, 0.9);
    c.fillStyle = C("10,10,14");
    c.beginPath();
    c.moveTo(HERO.X + 44, HOUSE_FOOT - 6);
    c.lineTo(HERO.X + 44, 1004);
    c.arc(HERO.X + 66, 1004, 22, Math.PI, 0);
    c.lineTo(HERO.X + 88, HOUSE_FOOT - 6);
    c.closePath();
    c.fill();
    // the lit window, in the bay between the post at −88 and the middle door (v4.5: centred there, 12.9 px
    // clear of both; v4.4's, at −104, ran 4.6 px into the first door and over the post)
    c.fillStyle = C("22,15,11");
    c.fillRect(HERO.X - 58.5 - 14.6, 1002 - 11.6, 29.2, 23.2);
    c.strokeStyle = C(INK);
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(HERO.X + 66, 960);
    c.lineTo(HERO.X + 66, 966);
    c.stroke();
  };
  {
    const rr = mulberry32(41);
    let x = SX0 + 10;
    while (x < 1010) {
      const w = 120 + rr() * 70;
      const sd = Math.floor(rr() * 1e6), ridge = 856 + rr() * 26, gap = 4 + rr() * 26;
      if (x + w > 296 && x < 548) {
        x = 548;
        continue;
      }
      if (x + w > 1030) break;
      const xx = x;
      item(HOUSE_FOOT, () => canalHouse(sd, xx, w, ridge));
      x += w + gap;
    }
    item(HOUSE_FOOT, () => {
      paint(5001, HERO.X - 200, HERO.X + 200, (c) => hisHouse(c));
      lamp(HERO.X - 58.5, 1002, 26, 20, beatRank(1, 0.3), 0, 0.85, "rect", [7, 1, 0.7]);
      reflect(HERO.X - 58.5, 1002, 26, 20, CANAL, beatRank(1, 0.3), 0, 0.7, mulberry32(5002), 50);
      lamp(HERO.X + 66, 970, 7, 9.5, beatRank(0, 0.3), 1, 1, "oval");
      reflect(HERO.X + 66, 970, 7, 9.5, CANAL, beatRank(0, 0.3), 1, 0.8, mulberry32(5003), 60);
    });
    for (const [hx, hw, rd, sd] of [[1400, 150, 878, 4401], [1566, 172, 862, 4402], [1752, 144, 884, 4403]] as const) item(HOUSE_FOOT, () => canalHouse(sd, hx, hw, rd));
    // along the canal past his lane, where it runs out into the river: shops
    x = 1916;
    while (x < 2700) {
      const w = 110 + rr() * 60;
      const sd = Math.floor(rr() * 1e6), ridge = 858 + rr() * 22, gap = 6 + rr() * 22;
      if (x + w > rvL(HOUSE_FOOT) - 26) break;
      const xx = x;
      item(HOUSE_FOOT, () => canalHouse(sd, xx, w, ridge, true));
      x += w + gap;
    }
  }
  // willows along the canal bank — v4.1: behind the houses, their crowns over the roofs (v4.0 stood
  // them in front, where they hung across the lit windows, and the one by the river mouth filled the
  // space under the rainbow bridge: gone)
  for (const [wx, wh, ww, seed] of [[150, 230, 170, 61], [700, 250, 190, 62], [1470, 200, 150, 63], [1905, 236, 172, 64]] as const)
    item(HOUSE_FOOT - 2, () => paint(seed, wx - ww, wx + ww, (c, rr) => inkWillow(c, rr, wx, CANAL + 2, wh, ww, C(INK), 70, 0.9)));
  // the humped stone bridge where the side canal comes out, its arch and reflection closing into a ring
  {
    const BX = sideX(CANAL), span = 124, rise = 48, arch = 34;
    const crest = CANAL - rise;
    RESERVE.push([BX - span - 20, CANAL - 120, BX + span + 20, CANAL + 40]);
    item(CANAL + 1, () => {
      paint(71, BX - span - 10, BX + span + 10, (c, rr) => {
        c.fillStyle = C(STONE);
        c.beginPath();
        c.moveTo(BX - span, CANAL);
        c.quadraticCurveTo(BX - span * 0.45, crest - 4, BX, crest);
        c.quadraticCurveTo(BX + span * 0.45, crest - 4, BX + span, CANAL);
        c.closePath();
        c.moveTo(BX + arch, CANAL);
        c.arc(BX, CANAL, arch, 0, Math.PI, true);
        c.closePath();
        c.fill("evenodd");
        c.strokeStyle = C(PALE, 0.42);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(BX, CANAL, arch, Math.PI, 0);
        c.stroke();
        c.beginPath();
        c.moveTo(BX - span, CANAL);
        c.quadraticCurveTo(BX - span * 0.45, crest - 4, BX, crest);
        c.quadraticCurveTo(BX + span * 0.45, crest - 4, BX + span, CANAL);
        c.stroke();
        c.strokeStyle = C(PALE, 0.2);
        c.beginPath();
        c.arc(BX, CANAL, arch, 0, Math.PI);
        c.stroke();
        c.fillStyle = C(INK);
        for (let k = -5; k <= 5; k++) {
          const x = BX + (k * span) / 6, t = Math.abs(x - BX) / span;
          const y = crest + (CANAL - crest) * t * t;
          c.fillRect(x - 0.8, y - 9, 1.6, 9);
        }
        for (let i = 0; i < 4; i++) {
          const x = BX - span * 0.6 + i * span * 0.38 + (rr() - 0.5) * 10, t = Math.abs(x - BX) / span;
          figure(c, x, crest + (CANAL - crest) * t * t, 1.3, rr() < 0.5 ? 1 : -1);
        }
      });
      const rr = mulberry32(72);
      for (const k of [-2, 2]) {
        const x = BX + k * 20, t = Math.abs(x - BX) / span;
        const y = CANAL - rise + rise * t * t - 15;
        const rk = wakeRank(x, y, rr);
        lamp(x, y, 5, 6.4, rk, 1, 1, "oval");
        reflect(x, y, 5, 6.4, CANAL, rk, 1, 0.8, rr, 50);
      }
    });
  }
  // boats, each with its lamp
  /** a boat: hull, a mat-roofed cabin with a lit window, a lamp on a pole at the bow */
  const boat = (seed: number, X: number, wl: number, s: number, dir = 1, o: { cabin?: boolean; mast?: boolean } = {}) => {
    item(wl + 0.5, () => {
      paint(seed, X - 60 * s, X + 60 * s, (c) => {
        c.fillStyle = C(INK);
        c.beginPath();
        c.moveTo(X - 46 * s * dir, wl - 7 * s);
        c.quadraticCurveTo(X, wl + 6 * s, X + 48 * s * dir, wl - 9 * s);
        c.lineTo(X + 40 * s * dir, wl + 1 * s);
        c.quadraticCurveTo(X, wl + 7 * s, X - 40 * s * dir, wl + 1 * s);
        c.closePath();
        c.fill();
        c.strokeStyle = C(PALE, 0.26);
        c.lineWidth = Math.max(0.4, 0.7 * s);
        c.beginPath();
        c.moveTo(X - 44 * s * dir, wl - 7 * s);
        c.quadraticCurveTo(X, wl + 4.6 * s, X + 46 * s * dir, wl - 9 * s);
        c.stroke();
        if (o.cabin !== false) {
          c.fillStyle = C(INK2);
          c.beginPath();
          c.moveTo(X - 22 * s, wl - 3 * s);
          c.quadraticCurveTo(X - 21 * s, wl - 22 * s, X - 2 * s, wl - 23 * s);
          c.quadraticCurveTo(X + 17 * s, wl - 22 * s, X + 18 * s, wl - 3 * s);
          c.fill();
          c.strokeStyle = C(PALE, 0.18);
          c.lineWidth = Math.max(0.3, 0.6 * s);
          for (let k = -3; k <= 3; k++) {
            c.beginPath();
            c.moveTo(X - 2 * s + k * 5 * s, wl - 22 * s + Math.abs(k) * 1.2 * s);
            c.lineTo(X - 2 * s + k * 5.6 * s, wl - 3 * s);
            c.stroke();
          }
        }
        if (o.mast) {
          c.strokeStyle = C(INK);
          c.lineWidth = Math.max(0.8, 1.8 * s);
          c.beginPath();
          c.moveTo(X + 4 * s, wl - 5 * s);
          c.lineTo(X + 4 * s + 64 * s * dir, wl - 64 * s);
          c.stroke();
          c.lineWidth = Math.max(0.3, 0.5 * s);
          c.beginPath();
          c.moveTo(X + 4 * s + 64 * s * dir, wl - 64 * s);
          c.lineTo(X - 40 * s * dir, wl - 6 * s);
          c.moveTo(X + 4 * s + 64 * s * dir, wl - 64 * s);
          c.lineTo(X + 46 * s * dir, wl - 8 * s);
          c.stroke();
        }
      });
      const rr = mulberry32(seed + 1);
      if (o.cabin !== false) {
        const cx = X - 2 * s, cy = wl - 11 * s;
        const rk = wakeRank(cx, cy, rr);
        lamp(cx, cy, 13 * s, 6 * s, rk, 0, 0.7, "rect", s > 0.6 ? [4, 1, 0.7 * s] : undefined);
        reflect(cx, cy, 13 * s, 6 * s, wl, rk, 0, 0.6, rr, 60 * s);
      }
      const lx = X + 32 * s * dir, ly = wl - 25 * s;
      paint(seed + 2, lx - 8 * s, lx + 8 * s, (c) => {
        c.fillStyle = C(INK);
        c.fillRect(lx - 0.6 * s, ly + 4 * s, 1.2 * s, 18 * s);
      });
      const rk = wakeRank(lx, ly, rr);
      lamp(lx, ly, 8 * s, 8 * s, rk, rr() < 0.4 ? 1 : 0, 1, "oval");
      reflect(lx, ly, 8 * s, 8 * s, wl, rk, 0, 0.75, rr, 90 * s);
    });
  };
  boat(81, -120, CANAL + 26, 1.0);
  boat(82, 660, CANAL + 32, 1.1, -1);
  boat(83, 1720, CANAL + 30, 0.95);
  boat(84, 2250, CANAL + 36, 1.05, -1);

  // ================================================================ B · the river and the rainbow bridge
  // shops along both banks, their fronts lit, stepping up the river into the mist
  {
    const rr = mulberry32(51);
    for (const side of [-1, 1]) {
      for (let y = 600; y < (side < 0 ? 1000 : 1066); ) {
        const s = sAt(y);
        const w = (34 + rr() * 22) * s;
        const bank = side < 0 ? rvL(y) : rvR(y);
        const x = side < 0 ? bank - w - 3 * s : bank + 3 * s;
        const sd = Math.floor(rr() * 1e9), kind = rr() < 0.4 ? 1 : 0;
        const nearBridge = Math.abs(y - BRIDGE.foot) < 40 * s;
        // the right bank runs into the city wall at the foot of the scroll: no shop past it
        const pastWall = side > 0 && x + w > wallX(y) - 14 * s;
        if (!nearBridge && !pastWall) {
          const bb = y;
          RESERVE.push([x - 2 * s, y - 30 * s, x + w + 2 * s, y + 2]);
          item(bb, () => {
            cHouse(sd, x, bb, w, s, kind, true);
            const r2 = mulberry32(sd + 5);
            if (r2() < 0.6) lantern(r2, side < 0 ? x + w - 3 * s : x + 3 * s, bb - 14 * s, bb - 6 * s, 0.75 * s, 1, undefined);
          });
        }
        y += (17 + rr() * 9) * s;
      }
    }
    // willows on the banks
    for (let i = 0; i < 9; i++) {
      const y = 620 + rr() * 420, side = rr() < 0.5 ? -1 : 1, s = sAt(y);
      const x = (side < 0 ? rvL(y) : rvR(y)) - side * 4 * s;
      const sd = Math.floor(rr() * 1e6);
      if (Math.abs(y - BRIDGE.foot) < 90) continue;
      // v4.1: nor where its crown would stand in front of the bridge (v4.0 let one on the near bank, 95 px
      // below the bridge's foot, grow 160 px tall: it hung under the arch, over the river)
      if (y > BRIDGE.foot && y - 64 * s < BRIDGE.foot + 20 && Math.abs(x - BRIDGE.X) < BRIDGE.half + 120) continue;
      item(y + 1, () => paint(sd, x - 50 * s, x + 50 * s, (c, r2) => inkWillow(c, r2, x, y, 64 * s, 50 * s, C(INK), 30, Math.max(0.5, 0.6 * s))));
    }
  }
  // the rainbow bridge: a timber arch of bundled beams, a railed deck, people crossing, lanterns
  {
    const { X: BX, half, foot, crest } = BRIDGE;
    const deckY = (x: number) => crest + (foot - 6 - crest) * Math.pow(Math.abs(x - BX) / half, 2);
    RESERVE.push([BX - half - 60, crest - 30, BX + half + 60, foot + 30]);
    item(foot + 0.5, () => {
      paint(35, BX - half - 60, BX + half + 60, (c, rr) => {
        // the arch reflected first, faint, in the water under it
        c.save();
        riverPath(c);
        c.clip();
        c.strokeStyle = C(INK, 0.5);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(BX - half + 14, foot + 4);
        c.quadraticCurveTo(BX, foot + (foot - crest) * 0.9, BX + half - 14, foot + 4);
        c.stroke();
        c.restore();
        for (let k = 0; k < 6; k++) {
          c.strokeStyle = C(k % 2 ? "58,48,44" : "34,28,27");
          c.lineWidth = 3.4;
          c.beginPath();
          c.moveTo(BX - half + 12, foot + 2);
          c.quadraticCurveTo(BX, crest - 22 + k * 4.4, BX + half - 12, foot + 2);
          c.stroke();
        }
        c.strokeStyle = C(PALE, 0.5);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(BX - half + 12, foot);
        c.quadraticCurveTo(BX, crest - 24, BX + half - 12, foot);
        c.stroke();
        c.strokeStyle = C(INK);
        c.lineWidth = 2;
        for (let k = -6; k <= 6; k++) {
          const t = k / 6, x = BX + t * (half - 18);
          const y = crest - 22 + (foot + 2 - crest + 22) * t * t;
          c.beginPath();
          c.moveTo(x, y - 2);
          c.lineTo(x, y + 20);
          c.stroke();
        }
        // the deck and its railing
        c.fillStyle = C(INK);
        c.beginPath();
        c.moveTo(BX - half - 36, foot - 6);
        for (let x = BX - half; x <= BX + half; x += 6) c.lineTo(x, deckY(x));
        c.lineTo(BX + half + 36, foot - 6);
        c.lineTo(BX + half + 36, foot - 1);
        for (let x = BX + half; x >= BX - half; x -= 6) c.lineTo(x, deckY(x) + 5);
        c.lineTo(BX - half - 36, foot - 1);
        c.closePath();
        c.fill();
        c.strokeStyle = C(INK);
        c.lineWidth = 1;
        c.beginPath();
        for (let x = BX - half; x <= BX + half; x += 6) (x === BX - half ? c.moveTo(x, deckY(x) - 10) : c.lineTo(x, deckY(x) - 10));
        c.stroke();
        for (let x = BX - half + 4; x < BX + half; x += 9) c.fillRect(x - 0.6, deckY(x) - 10, 1.2, 10);
        c.strokeStyle = C(PALE, 0.3);
        c.beginPath();
        for (let x = BX - half; x <= BX + half; x += 6) (x === BX - half ? c.moveTo(x, deckY(x) - 10.8) : c.lineTo(x, deckY(x) - 10.8));
        c.stroke();
        // stalls under awnings at both ends
        for (const ex of [BX - half - 26, BX + half + 26]) {
          c.fillStyle = C(INK2);
          c.beginPath();
          c.moveTo(ex - 22, foot - 30);
          c.lineTo(ex + 22, foot - 30);
          c.lineTo(ex + 26, foot - 22);
          c.lineTo(ex - 26, foot - 22);
          c.closePath();
          c.fill();
          c.fillStyle = C(INK);
          c.fillRect(ex - 20, foot - 22, 1.4, 16);
          c.fillRect(ex + 19, foot - 22, 1.4, 16);
        }
        // the crowd crossing
        for (let i = 0; i < 16; i++) {
          const x = BX - half * 0.92 + (i / 15) * half * 1.84 + (rr() - 0.5) * 8;
          figure(c, x, deckY(x), 1.05 + rr() * 0.2, rr() < 0.5 ? 1 : -1);
        }
      });
      const rr = mulberry32(36);
      for (let k = -5; k <= 5; k++) {
        const x = BX + k * (half / 5.6);
        const y = deckY(x) - 18;
        const rk = wakeRank(x, y, rr);
        paint(3600 + k, x - 3, x + 3, (c) => {
          c.fillStyle = C(INK);
          c.fillRect(x - 0.5, y + 3, 1, 8);
        });
        lamp(x, y, 5.2, 6.6, rk, 1, 1, "oval");
        reflect(x, y, 5.2, 6.6, foot, rk, 1, 0.8, rr, 120);
      }
      for (const ex of [BX - half - 26, BX + half + 26]) {
        const rk = wakeRank(ex, foot - 14, rr);
        lamp(ex, foot - 14, 34, 12, rk, 0, 0.75, "rect", [5, 1, 0.9]);
      }
    });
  }
  boat(85, 2300, 660, 0.55, 1);
  boat(86, 2660, 900, 0.95, -1, { mast: true });
  boat(87, 2860, 990, 1.05, 1);
  boat(88, 3060, 1064, 1.15, -1);

  // ================================================================ the city wall and its gate
  {
    const segs = 30;
    for (let k = 0; k < segs; k++) {
      let ya = WALL.y0 + ((WALL.y1 - WALL.y0) * k) / segs, yb = WALL.y0 + ((WALL.y1 - WALL.y0) * (k + 1)) / segs;
      // under the gate the wall is its platform: it runs into the platform's two ends
      if (ya >= GATE_PF && yb <= GATE_PN) continue;
      if (ya < GATE_PN && yb > GATE_PN) ya = GATE_PN;
      if (ya < GATE_PF && yb > GATE_PF) yb = GATE_PF;
      item(yb, () =>
        paint(1300 + k, wallX(yb) - 40, wallX(ya) + 60, (c) => {
          // the walkway on top and the outer face below it, towards the lake
          const th = (y: number) => 10 * sAt(y), hh = (y: number) => 26 * sAt(y);
          c.fillStyle = C(STONE);
          c.beginPath();
          c.moveTo(wallX(ya) - th(ya), ya);
          c.lineTo(wallX(ya) + th(ya), ya);
          c.lineTo(wallX(yb) + th(yb), yb);
          c.lineTo(wallX(yb) - th(yb), yb);
          c.closePath();
          c.fill();
          c.fillStyle = C("50,52,64");
          c.beginPath();
          c.moveTo(wallX(ya) + th(ya), ya);
          c.lineTo(wallX(ya) + th(ya), ya + hh(ya));
          c.lineTo(wallX(yb) + th(yb), yb + hh(yb));
          c.lineTo(wallX(yb) + th(yb), yb);
          c.closePath();
          c.fill();
          // courses of brick on the face
          c.strokeStyle = C(INK, 0.3);
          c.lineWidth = 0.5;
          for (let j = 1; j < 5; j++) {
            c.beginPath();
            c.moveTo(wallX(ya) + th(ya), ya + (hh(ya) * j) / 5);
            c.lineTo(wallX(yb) + th(yb), yb + (hh(yb) * j) / 5);
            c.stroke();
          }
          // battlements along the outer edge, moonlit
          const s = sAt(yb);
          c.fillStyle = C(STONE);
          for (let t = 0; t < 1; t += 0.34) {
            const y = lerp(ya, yb, t), x = wallX(y) + th(y);
            c.fillRect(x - 1.5 * s, y - 5 * s, 3 * s, 5 * s);
          }
          c.strokeStyle = C(PALE, 0.32);
          c.lineWidth = Math.max(0.4, 0.6 * s);
          c.beginPath();
          c.moveTo(wallX(ya) + th(ya), ya);
          c.lineTo(wallX(yb) + th(yb), yb);
          c.stroke();
        })
      );
    }
    // lanterns along the wall walk
    const rr = mulberry32(1390);
    for (let y = WALL.y0 + 30; y < 1060; y += 34 * sAt(y)) {
      if (Math.abs(y - GATE.base) < 60) continue;
      const s = sAt(y), x = wallX(y), yy = y - 4 * s;
      const sd = Math.floor(rr() * 1e6);
      item(y + 0.4, () => {
        const r2 = mulberry32(sd);
        const rk = wakeRank(x, yy, r2);
        lamp(x, yy, 2.4 * s + 0.6, 3 * s + 0.6, rk, 1, 1, "oval");
        reflect(x + 14 * s, yy + 26 * s, 2.4 * s + 0.6, 3 * s, yy + 30 * s, rk, 1, 0.6, r2, 50 * s);
      });
    }
    // the gate (涌金门). A gate tower is built along its wall, the gateway going through the wall
    // under it; here we look along the wall, so we see the tower end-on: its gable end towards us,
    // its length and its lake-side front running away with the wall. The wall thickens under it
    // into the gate platform (城台), and the gateway's arch opens on the lake side onto the landing.
    const base = GATE.base, s = sAt(base), GX = wallX(base);
    RESERVE.push([GX - 130, base - 140, GX + 130, base + 40]);
    // a point in the wall's own frame: depth Y along it, a across it (+ towards the lake), h above the walk
    const Wp = (Y: number, a: number, h: number): [number, number] => [wallX(Y) + a * sAt(Y), Y - h * sAt(Y)];
    const poly = (c: C2, pts: [number, number][]) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
    };
    const line = (c: C2, pts: [number, number][]) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    };
    const PF = GATE_PF, PN = GATE_PN, pa = 20, ph = 3, foot = -26;
    // the two storeys: depth range along the wall, half-width, floor and eave heights, roof rise, overhang
    const ST = [
      { f0: base - 36, f1: base + 12, ha: 16, h0: ph, h1: ph + 22, rise: 15, oh: 7 },
      { f0: base - 28, f1: base + 4, ha: 11, h0: ph + 30, h1: ph + 46, rise: 14, oh: 6 },
    ];
    item(PN + 0.5, () => {
      paint(37, wallX(PN) - 60 * s, wallX(PF) + 80 * s, (c) => {
        const fill = C(INK), rim = C(PALE, 0.34), tiles = C(PALE, 0.11);
        // the platform: the walk widened and raised a step, its lake face dropping to the landing
        c.fillStyle = C("50,52,64");
        poly(c, [Wp(PF, pa, ph), Wp(PN, pa, ph), Wp(PN, pa, foot), Wp(PF, pa, foot)]);
        c.fillStyle = C("42,44,56");
        poly(c, [Wp(PN, -pa, ph), Wp(PN, pa, ph), Wp(PN, pa, foot), Wp(PN, -pa, foot)]);
        c.fillStyle = C(STONE);
        poly(c, [Wp(PF, -pa, ph), Wp(PF, pa, ph), Wp(PN, pa, ph), Wp(PN, -pa, ph)]);
        c.strokeStyle = C(INK, 0.3);
        c.lineWidth = 0.6;
        for (let j = 1; j < 7; j++) {
          const h = ph + ((foot - ph) * j) / 7;
          line(c, [Wp(PF, pa, h), Wp(PN, pa, h)]);
          line(c, [Wp(PN, -pa, h), Wp(PN, pa, h)]);
        }
        c.strokeStyle = rim;
        c.lineWidth = 0.8;
        line(c, [Wp(PF, pa, ph), Wp(PN, pa, ph), Wp(PN, -pa, ph)]);
        // the gateway's arch, on the lake face
        c.fillStyle = C("20,16,14");
        const g0 = base - 9, g1 = base + 9, arch: [number, number][] = [Wp(g0, pa, foot)];
        for (let t = 0; t <= 1.0001; t += 0.1) arch.push(Wp(lerp(g0, g1, t), pa, -15 + 7 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2))));
        arch.push(Wp(g1, pa, foot));
        poly(c, arch);
        for (const T of ST) {
          const { f0, f1, ha, h0, h1, rise, oh } = T;
          // its lake-side front, and the gable end towards us
          c.fillStyle = C(WALLc.join(","));
          poly(c, [Wp(f0, ha, h0), Wp(f1, ha, h0), Wp(f1, ha, h1), Wp(f0, ha, h1)]);
          c.fillStyle = C("62,64,78");
          poly(c, [Wp(f1, -ha, h0), Wp(f1, ha, h0), Wp(f1, ha, h1), Wp(f1, -ha, h1)]);
          c.fillStyle = fill;
          const nc = Math.max(3, Math.round((f1 - f0) / 9));
          for (let k = 0; k <= nc; k++) {
            const Y = lerp(f0, f1, k / nc), [x, yt] = Wp(Y, ha, h1), [, yb] = Wp(Y, ha, h0);
            c.fillRect(x - 0.9 * sAt(Y), yt, 1.8 * sAt(Y), yb - yt);
          }
          for (const a of [-ha, -ha / 3, ha / 3, ha]) {
            const [x, yt] = Wp(f1, a, h1), [, yb] = Wp(f1, a, h0);
            c.fillRect(x - 0.9 * s, yt, 1.8 * s, yb - yt);
          }
          poly(c, [Wp(f1, -ha - 0.6, h0 + 1.6), Wp(f1, ha + 0.6, h0 + 1.6), Wp(f1, ha + 0.6, h0), Wp(f1, -ha - 0.6, h0)]);
          poly(c, [Wp(f0, ha + 0.6, h0 + 1.6), Wp(f1, ha + 0.6, h0 + 1.6), Wp(f1, ha + 0.6, h0), Wp(f0, ha + 0.6, h0)]);
          // the hip roof: eaves all round, the ridge along the wall, the corners turned up
          const e0 = f0 - oh, e1 = f1 + oh, ea = ha + oh, hr = h1 + rise, lift = rise * 0.3;
          const r0 = f0 + rise * 0.7, r1 = f1 - rise * 0.7;
          const NL = Wp(e1, -ea, h1 + lift), NR = Wp(e1, ea, h1 + lift), FR = Wp(e0, ea, h1 + lift), FL = Wp(e0, -ea, h1 + lift);
          const RN = Wp(r1, 0, hr), RF = Wp(r0, 0, hr);
          c.fillStyle = fill;
          poly(c, [NL, NR, FR, FL]);
          poly(c, [NL, RN, NR]);
          poly(c, [NR, RN, RF, FR]);
          poly(c, [FL, RF, RN, NL]);
          poly(c, [FL, RF, FR]);
          // the eaves sag between the turned-up corners
          poly(c, [NL, Wp(e1, 0, h1 - 0.8), NR]);
          poly(c, [NR, Wp((e0 + e1) / 2, ea, h1 - 0.8), FR]);
          // rows of tiles down the lake-side slope
          c.strokeStyle = tiles;
          c.lineWidth = 0.5;
          for (let k = 1; k < 10; k++) {
            const t = k / 10;
            line(c, [Wp(lerp(r0, r1, t), 0, hr), Wp(lerp(e0, e1, t), ea, h1 + (Math.abs(t - 0.5) > 0.4 ? lift * 0.6 : 0))]);
          }
          // the moon catches the ridge, the hips and the eaves on its side
          c.strokeStyle = rim;
          c.lineWidth = Math.max(0.6, 0.7 * s);
          line(c, [RF, RN]);
          line(c, [NL, RN, NR]);
          line(c, [NL, Wp(e1, 0, h1 - 0.8), NR, Wp((e0 + e1) / 2, ea, h1 - 0.8), FR]);
        }
      });
      const rr2 = mulberry32(38);
      // the gateway lit inside, the doors and windows of the tower, lanterns at its corners
      const rk = wakeRank(GX, base, rr2);
      const [gx, gy] = Wp(base, pa, -19);
      lamp(gx, gy, 5 * s, 9 * s, rk, 0, 0.55, "oval");
      for (const T of ST) {
        const { f0, f1, ha, h0, h1 } = T, hm = (h0 + h1) / 2, nc = Math.max(3, Math.round((f1 - f0) / 9));
        // the long front recedes steeply, so only every other bay is lit: lit side by side the
        // windows would overlap into one glowing ladder
        for (let k = 1; k < nc; k += 2) {
          const [x, y] = Wp(lerp(f0, f1, (k + 0.5) / nc), ha + 0.4, hm);
          win(rr2, x, y, 2.8 * s, (h1 - h0 - (h1 - h0 > 18 ? 12 : 10)) * s, undefined, 0.86);
        }
        const [dx, dy] = Wp(f1, 0, hm);
        win(rr2, dx, dy, 6 * s, (h1 - h0 - 8) * s, undefined, 0.9);
      }
      for (const a of [-1, 1]) {
        const [lx, ly] = Wp(ST[0].f1 + ST[0].oh - 1, a * (ST[0].ha + ST[0].oh - 1), ST[0].h1 + 1);
        lantern(rr2, lx, ly, ly + 10 * s, 1.4 * s, 1, undefined);
      }
    });
    // at the landing two small boats are tied up, and willows stand along the bank
    boat(89, bankEdge(base - 6) + 20 * s, footY(base - 6) + 4, s * 0.5, 1, { cabin: false });
    boat(90, bankEdge(base + 13) + 24 * s, footY(base + 13) + 5, s * 0.55, -1);
    for (const Y of [470, 545, 610, 890, 965, 1035]) {
      const k = sAt(Y), x = wallX(Y) + (10 + bankW(Y) * 0.55) * k, y = footY(Y);
      const sd = 6000 + Y;
      item(y, () => paint(sd, x - 40 * k, x + 40 * k, (c, r2) => inkWillow(c, r2, x, y, 34 * k, 26 * k, C(mixc(INKc, MISTc, fogAt(k) * 0.8 + 0.1), 0.92), 16, Math.max(0.35, 0.5 * k))));
    }
  }
  // the land between the river and the wall, near: a few big houses, an inn by the gate
  {
    const rr = mulberry32(60);
    for (const [hx, base, hw] of [[3080, 920, 120], [3150, 1046, 150], [3240, 856, 96]] as const) {
      const s = sAt(base);
      const sd = Math.floor(rr() * 1e6);
      if (hx + hw > wallX(base) - 8) continue;
      RESERVE.push([hx, base - 40 * s, hx + hw, base + 2]);
      item(base, () => cHouse(sd, hx, base, hw, s * 0.62, 1, true));
    }
  }

  // ================================================================ the town spread over the plain
  carpet(301, SX0, 3700, FAR + 4, 852);
  carpet(302, 2700, 3700, 852, 1080);
  // trees among the roofs
  {
    const rr = mulberry32(330);
    for (let i = 0; i < 380; i++) {
      const y = FAR + 8 + Math.pow(rr(), 0.85) * (800 - FAR - 8);
      const x = SX0 + rr() * (3650 - SX0);
      const sd = Math.floor(rr() * 1e9), kind = rr();
      if (x > wallX(y) - 20 || waterAt(x, y) || streetClear(x, y) < 0) continue;
      if (x < 1950 && y > 720) continue; // keep the roofs just behind his lane clear
      const s = sAt(y);
      const col = mixc(INKc, MISTc, fogAt(s) * 0.8 + 0.14);
      item(y + 0.3, () =>
        paint(sd, x - 50 * s, x + 50 * s, (c, r2) =>
          kind < 0.5 ? inkWillow(c, r2, x, y, 36 * s, 30 * s, C(col, 0.9), 14, Math.max(0.35, 0.5 * s)) : dotTree(c, r2, x, y, (26 + r2() * 10) * s, (24 + r2() * 10) * s, C(col), 0.72)
        )
      );
    }
  }
  // lanterns strung along the streets, and the glow of the street between
  STREETS.forEach((st, si) => {
    const rr = mulberry32(700 + si);
    walk(st.pts, (y) => (7 + rr() * 6) * sAt(y), (x, y, nx, ny) => {
      if (waterAt(x, y) || x > wallX(y) - 8) return;
      const s = sAt(y);
      glowAt(x, y - 3 * s, 8 + 10 * s, 0.05 * st.busy);
      for (const side of [-1, 1]) {
        if (rr() > 0.45 * st.busy + 0.3) continue;
        const lx = x + nx * side * st.w * s * 0.42, ly = y + ny * side * st.w * s * 0.42 - 4.5 * s;
        const red = rr() < 0.42;
        const sd = Math.floor(rr() * 1e6);
        item(ly + 4.5 * s, () => {
          const r2 = mulberry32(sd);
          lamp(lx, ly, 1.7 * s + 0.6, 2.2 * s + 0.6, wakeRank(lx, ly, r2), red ? 1 : 0, 0.95, "oval");
        });
      }
      if (s > 0.6 && rr() < 0.3) {
        const fx = x + (rr() - 0.5) * st.w * s * 0.5, sd = Math.floor(rr() * 1e6);
        item(y + 0.6, () => paint(sd, fx - 4 * s, fx + 4 * s, (c, r2) => figure(c, fx, y, 0.55 * s, r2() < 0.5 ? 1 : -1)));
      }
    });
  });
  // mist lying in bands across the town, thicker far off
  const mist = (seed: number, y: number, h: number, a: number, x0 = SX0, x1 = SX1) =>
    item(y + h * 0.25, () =>
      paint(
        seed,
        x0,
        x1,
        (c, rr) => {
          for (let x = x0; x < x1; x += 50 + rr() * 120) {
            const w = 240 + rr() * 520, hh = h * (0.6 + rr() * 0.8), yy = y + (rr() - 0.5) * h * 0.6;
            const aa = a * (0.35 + rr() * 0.65);
            const g = c.createRadialGradient(x, yy, 0, x, yy, w / 2);
            g.addColorStop(0, C(rgbS(MISTc), aa));
            g.addColorStop(0.6, C(rgbS(MISTc), aa * 0.45));
            g.addColorStop(1, C(rgbS(MISTc), 0));
            c.save();
            c.translate(x, yy);
            c.scale(1, hh / w);
            c.translate(-x, -yy);
            c.fillStyle = g;
            c.fillRect(x - w / 2, yy - w / 2, w, w);
            c.restore();
          }
        },
        { wet: false }
      )
    );
  mist(901, 368, 40, 0.6);
  mist(902, 440, 28, 0.3, SX0, 3700);
  mist(903, 528, 30, 0.2, SX0, 3600);
  mist(904, 414, 34, 0.5, 3500, SX1);
  mist(905, 548, 24, 0.22, 3640, SX1);

  // temples on the hills, a pavilion on 吴山
  {
    const rr = mulberry32(80);
    const temple = (x: number, base: number, s: number, lights: number) => {
      const sd = Math.floor(rr() * 1e6);
      item(base, () => {
        paint(sd, x - 30 * s, x + 30 * s, (c) => {
          c.fillStyle = C(mixc(WALLc, MISTc, 0.3));
          c.fillRect(x - 16 * s, base - 9 * s, 32 * s, 9 * s);
          roof(c, x, base - 22 * s, base - 8 * s, 20 * s, { oh: 4 * s, lift: 3 * s, thick: 1.4 * s, inset: 5 * s, fill: C(INK), rim: C(PALE, 0.28) });
        });
        const r2 = mulberry32(sd + 1);
        for (let k = 0; k < lights; k++) {
          const lx = x - 9 * s + k * (18 * s) / Math.max(1, lights - 1);
          lamp(lx, base - 4.5 * s, 2.4 * s, 3.4 * s, wakeRank(lx, base, r2), 0, 0.9);
        }
      });
    };
    temple(620, 276, 0.9, 3);
    temple(470, 312, 0.6, 2);
    temple(1500, 318, 0.6, 2);
    temple(2620, 308, 0.6, 2);
    temple(4300, 350, 0.6, 2);
    temple(4560, 380, 0.5, 1);
  }

  // ================================================================ C · West Lake
  /** a pagoda: storeys narrowing upward, each with its eave, a lamp hung at each eave tip */
  const pagoda = (seed: number, x: number, base: number, h: number, w0: number, tiers: number, s: number) => {
    item(base, () => {
      paint(seed, x - w0 * 1.4, x + w0 * 1.4, (c) => {
        for (let k = 0; k < tiers; k++) {
          const yb = base - (h * 0.9 * k) / tiers, yt = base - (h * 0.9 * (k + 1)) / tiers;
          const ww = w0 * (1 - (0.42 * k) / tiers);
          c.fillStyle = C(mixc(WALLc, MISTc, 0.25));
          c.fillRect(x - ww * 0.34, yt + (yb - yt) * 0.3, ww * 0.68, (yb - yt) * 0.72);
          c.fillStyle = C(INK, 0.9);
          c.fillRect(x - ww * 0.1, yt + (yb - yt) * 0.45, ww * 0.2, (yb - yt) * 0.5);
          roof(c, x, yt + (yb - yt) * 0.02, yt + (yb - yt) * 0.34, ww * 0.5, { oh: ww * 0.14, lift: ww * 0.09, thick: ww * 0.04, inset: ww * 0.2, fill: C(INK), rim: C(PALE, 0.26) });
        }
        c.fillStyle = C(INK);
        c.fillRect(x - 0.7 * s, base - h, 1.4 * s, h * 0.12);
        c.beginPath();
        c.arc(x, base - h * 0.93, 1.6 * s, 0, Math.PI * 2);
        c.fill();
      });
      const rr = mulberry32(seed + 1);
      for (let k = 0; k < tiers; k++) {
        const yt = base - (h * 0.9 * (k + 1)) / tiers, yb = base - (h * 0.9 * k) / tiers;
        const ww = w0 * (1 - (0.42 * k) / tiers);
        for (const side of [-1, 1]) {
          const lx = x + side * ww * 0.6, ly = yt + (yb - yt) * 0.42;
          lamp(lx, ly, 1.6 * s + 0.5, 2 * s + 0.6, wakeRank(lx, ly, rr), 1, 0.95, "oval");
        }
        const wy = yt + (yb - yt) * 0.68;
        lamp(x, wy, ww * 0.18, (yb - yt) * 0.4, wakeRank(x, wy, rr), 0, 0.85);
      }
    });
  };
  pagoda(1101, 3850, 296, 104, 22, 7, 0.6); // 保俶塔, slender on its hill
  pagoda(1102, 5050, 392, 92, 40, 5, 0.75); // 雷峰塔, stout by the far shore
  // the far shore: a strip of land under the hills, trees, villas and temples, lamps on the walk
  item(398, () =>
    paint(42, 3560, SX1, (c, rr) => {
      for (let x = 3640; x < SX1; x += 7 + rr() * 10) dotTree(c, rr, x, shoreY(x) - 1, 9 + rr() * 9, 8 + rr() * 7, C(mixc(INKc, MISTc, 0.3)), 0.85);
      // v3.1: the shore runs right up to the wall's bank (it used to stop 40 px short of it)
      const r3 = mulberry32(4201);
      for (let x = FS0; x < 3640; x += 7 + r3() * 10) dotTree(c, r3, x, shoreY(x) - 1, 9 + r3() * 9, 8 + r3() * 7, C(mixc(INKc, MISTc, 0.3)), 0.85);
    })
  );
  {
    // v3.1: lamps on the shore walk from the bank on, too (a separate draw, so the old ones stay put)
    const r3 = mulberry32(4301);
    for (let x = FS0 + 12; x < 3680; x += 9 + r3() * 14) {
      const y = shoreY(x) - 2.5;
      if (r3() < 0.3) continue;
      const sd = Math.floor(r3() * 1e6);
      item(y + 2, () => {
        const r2 = mulberry32(sd);
        const rk = wakeRank(x, y, r2);
        lamp(x, y, 1.4, 1.7, rk, r2() < 0.3 ? 1 : 0, 0.9, "oval");
        reflect(x, y, 1.4, 1.7, y + 3, rk, 0, 0.75, r2, 14 + r2() * 34);
      });
    }
  }
  {
    const rr = mulberry32(43);
    for (let x = 3680; x < SX1; x += 9 + rr() * 14) {
      const y = shoreY(x) - 2.5;
      if (rr() < 0.3) continue;
      const big = rr() < 0.15;
      const sd = Math.floor(rr() * 1e6);
      item(y + 2, () => {
        const r2 = mulberry32(sd);
        if (big) cHouse(sd, x - 6, y + 2, 12, 0.32, 0, false);
        const rk = wakeRank(x, y, r2);
        lamp(x, y, 1.4, 1.7, rk, r2() < 0.3 ? 1 : 0, 0.9, "oval");
        reflect(x, y, 1.4, 1.7, y + 3, rk, 0, 0.75, r2, 14 + r2() * 34);
      });
    }
  }
  // the Su causeway, low across the lake: willows and peach, humped bridges, lamps. v3.1: it runs
  // from the city's bank (it used to start 130 px out in the water, leaving a gap at the wall)
  item(causeY(4400) + 2, () =>
    paint(44, CX0 - 20, SX1, (c, rr) => {
      c.fillStyle = C(mixc(INKc, MISTc, 0.2), 0.95);
      c.beginPath();
      for (let x = CX0; x <= SX1; x += 10) c.lineTo(x, causeY(x) - 1.5);
      for (let x = SX1; x >= CX0; x -= 10) c.lineTo(x, causeY(x) + 1.6);
      c.closePath();
      c.fill();
      const r3 = mulberry32(4401);
      for (let x = CX0 + 8; x < 3700; x += 7 + r3() * 8) {
        const y = causeY(x) - 1;
        if (r3() < 0.55) inkWillow(c, r3, x, y, 16 + r3() * 8, 13 + r3() * 6, C(mixc(INKc, MISTc, 0.25)), 9, 0.4);
        else dotTree(c, r3, x, y, 13 + r3() * 7, 11 + r3() * 6, C(mixc(INKc, MISTc, 0.25)), 0.85);
      }
      for (let x = 3700; x < SX1; x += 7 + rr() * 8) {
        if ([4120, 4520, 4900, 5260].some((b) => Math.abs(x - b) < 26)) continue;
        const y = causeY(x) - 1;
        if (rr() < 0.55) inkWillow(c, rr, x, y, 16 + rr() * 8, 13 + rr() * 6, C(mixc(INKc, MISTc, 0.25)), 9, 0.4);
        else dotTree(c, rr, x, y, 13 + rr() * 7, 11 + rr() * 6, C(mixc(INKc, MISTc, 0.25)), 0.85);
      }
      for (const bx of [4120, 4520, 4900, 5260]) {
        const y = causeY(bx);
        c.fillStyle = C(STONE);
        c.beginPath();
        c.moveTo(bx - 24, y + 1);
        c.quadraticCurveTo(bx, y - 12, bx + 24, y + 1);
        c.closePath();
        c.fill();
        c.fillStyle = C("30,34,48");
        c.beginPath();
        c.arc(bx, y + 1, 6, Math.PI, 0);
        c.fill();
        c.strokeStyle = C(PALE, 0.3);
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(bx - 24, y + 1);
        c.quadraticCurveTo(bx, y - 12, bx + 24, y + 1);
        c.stroke();
      }
    })
  );
  {
    const r3 = mulberry32(4501);
    for (let x = CX0 + 16; x < 3720 - 12; x += 26 + r3() * 20) {
      const y = causeY(x) - 7;
      const sd = Math.floor(r3() * 1e6);
      item(causeY(x) + 2.5, () => {
        const r2 = mulberry32(sd);
        const rk = wakeRank(x, y, r2);
        lamp(x, y, 1.7, 2.1, rk, r2() < 0.35 ? 1 : 0, 0.95, "oval");
        reflect(x, y, 1.7, 2.1, causeY(x) + 1.5, rk, 0, 0.8, r2, 18 + r2() * 40);
      });
    }
  }
  {
    const rr = mulberry32(45);
    for (let x = 3720; x < SX1; x += 26 + rr() * 20) {
      const y = causeY(x) - 7;
      const sd = Math.floor(rr() * 1e6);
      item(causeY(x) + 2.5, () => {
        const r2 = mulberry32(sd);
        const rk = wakeRank(x, y, r2);
        lamp(x, y, 1.7, 2.1, rk, r2() < 0.35 ? 1 : 0, 0.95, "oval");
        reflect(x, y, 1.7, 2.1, causeY(x) + 1.5, rk, 0, 0.8, r2, 18 + r2() * 40);
      });
    }
  }
  // the moon, broken in the lake
  item(560, () => {
    const rr = mulberry32(50);
    const MW = 700;
    for (let y = MW - 44; y < MW + 44; y += 2.2 + rr() * 1.3) {
      const half = Math.sqrt(Math.max(0, 44 * 44 - (y - MW) * (y - MW))) * (0.6 + rr() * 0.5) * 0.7;
      if (half < 1) continue;
      lamp(MOON.X + (rr() - 0.5) * 10, y, half * 2, 0.9 + rr() * 0.6, 0.005, 0.5, 0.35 + rr() * 0.22, "rect", undefined, true);
    }
    for (let y = 560; y < 1000; y += 2.4 + rr() * 2.2) {
      const near = Math.exp(-Math.pow((y - MW) / 130, 2));
      if (rr() > 0.22 + near) continue;
      lamp(MOON.X + (rr() - 0.5) * (16 + (60 * (y - 560)) / 400), y, 2 + rr() * (5 + 24 * near), 0.8, 0.005, 0.5, 0.12 + 0.28 * near * rr(), "rect", undefined, true);
    }
  });
  // 三潭印月: three stone lanterns standing in the water, their round holes lit, the little
  // moons of their lights lying in the lake under them
  const stoneLantern = (seed: number, x: number, wl: number, s: number) => {
    const cyS = wl - 24 * s;
    item(wl, () => {
      paint(seed, x - 20 * s, x + 20 * s, (c) => {
        c.fillStyle = C("74,78,92");
        c.beginPath();
        c.moveTo(x - 7 * s, wl + 1);
        c.lineTo(x - 5 * s, wl - 6 * s);
        c.lineTo(x + 5 * s, wl - 6 * s);
        c.lineTo(x + 7 * s, wl + 1);
        c.closePath();
        c.fill();
        c.fillRect(x - 2.6 * s, wl - 13.5 * s, 5.2 * s, 8 * s);
        c.beginPath();
        c.arc(x, cyS, 11 * s, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(x - 13.5 * s, cyS - 11 * s);
        c.quadraticCurveTo(x, cyS - 15.5 * s, x + 13.5 * s, cyS - 11 * s);
        c.lineTo(x + 12 * s, cyS - 9.6 * s);
        c.quadraticCurveTo(x, cyS - 12 * s, x - 12 * s, cyS - 9.6 * s);
        c.closePath();
        c.fill();
        c.beginPath();
        c.arc(x, cyS - 17 * s, 3.6 * s, 0, Math.PI * 2);
        c.arc(x, cyS - 22.5 * s, 2.6 * s, 0, Math.PI * 2);
        c.fill();
        c.fillRect(x - 0.5 * s, cyS - 28 * s, 1 * s, 4 * s);
        c.strokeStyle = C(PALE, 0.36);
        c.lineWidth = 0.7 * s;
        c.beginPath();
        c.arc(x, cyS, 10.6 * s, Math.PI * 0.95, Math.PI * 1.55);
        c.stroke();
      });
      const rr = mulberry32(seed + 1);
      const rk = wakeRank(x, cyS, rr);
      // five holes round the drum: the one facing us round, the two at the sides seen edge-on
      for (const [hx, rx, ry, hb] of [[0, 2.3, 2.3, 0.9], [-7.4, 0.9, 2.0, 0.55], [7.4, 0.9, 2.0, 0.55]] as const) {
        const X = x + hx * s, Y = cyS + 0.5 * s;
        lamp(X, Y, rx * 2 * s, ry * 2 * s, rk, 0, hb, "oval");
        const ym = 2 * wl - Y;
        for (let k = -2; k <= 2; k++) lamp(X + (rr() - 0.5) * 1.2, ym + k * ry * s * 0.62, rx * 2 * s * (1 - Math.abs(k) * 0.18), ry * s * 0.45, rk, 0, 0.9, "oval", undefined, true);
        reflect(X, Y + ry * s * 1.6, rx * 1.4 * s, 2, wl, rk, 0, 0.5, rr, 26 * s);
      }
    });
  };
  stoneLantern(46, 4580, 712, sAt(712) * 1.1);
  stoneLantern(47, 4730, 694, sAt(694) * 1.1);
  stoneLantern(48, 4880, 722, sAt(722) * 1.1);
  // pleasure boats: a long hull, a roofed cabin with lit lattice windows, lanterns at the eaves
  const pleasureBoat = (seed: number, X: number, wl: number, s: number, dir = 1) => {
    item(wl + 0.5, () => {
      const L = 90 * s;
      paint(seed, X - L, X + L, (c) => {
        c.fillStyle = C(INK);
        c.beginPath();
        c.moveTo(X - L * dir, wl - 8 * s);
        c.quadraticCurveTo(X, wl + 7 * s, X + L * dir * 1.02, wl - 10 * s);
        c.lineTo(X + L * 0.86 * dir, wl + 1 * s);
        c.quadraticCurveTo(X, wl + 8 * s, X - L * 0.86 * dir, wl + 1 * s);
        c.closePath();
        c.fill();
        c.fillStyle = C(WOOD);
        c.fillRect(X - L * 0.56, wl - 26 * s, L * 1.12, 22 * s);
        c.fillStyle = C(INK);
        for (let k = 0; k <= 6; k++) c.fillRect(X - L * 0.56 + (k * L * 1.12) / 6 - 0.8 * s, wl - 26 * s, 1.6 * s, 22 * s);
        roof(c, X, wl - 40 * s, wl - 25 * s, L * 0.62, { oh: 7 * s, lift: 5 * s, thick: 2 * s, inset: L * 0.1, fill: C(INK), rim: C(PALE, 0.34), tiles: C(PALE, 0.1) });
      });
      const rr = mulberry32(seed + 1);
      for (let k = 0; k < 6; k++) {
        if (rr() < 0.2) continue;
        const wx = X - L * 0.56 + ((k + 0.5) * L * 1.12) / 6, wy = wl - 15 * s;
        const rk = wakeRank(wx, wy, rr);
        lamp(wx, wy, (L * 1.12) / 6 - 3.4 * s, 13 * s, rk, 0, 0.8, "rect", [3, 2, 0.6 * s]);
        reflect(wx, wy, (L * 1.12) / 6 - 3.4 * s, 13 * s, wl, rk, 0, 0.7, rr, 90 * s);
      }
      for (const side of [-1, 1]) lantern(rr, X + side * L * 0.66, wl - 32 * s, wl - 22 * s, 1.1 * s, 1, wl);
    });
  };
  pleasureBoat(1201, 3760, 920, 0.92);
  pleasureBoat(1202, 4470, 642, 0.62, -1);
  pleasureBoat(1203, 5000, 888, 0.95, -1);
  pleasureBoat(1204, 4040, 566, 0.5);
  boat(1211, 3600, 1050, 1.0, 1);
  boat(1212, 3940, 760, 0.7, -1);
  boat(1213, 4700, 800, 0.78, 1);
  boat(1214, 5200, 640, 0.58, -1);
  boat(1215, 4380, 540, 0.48, 1);
  boat(1216, 3480, 980, 0.9, -1, { cabin: false });
  // the pavilion in the water: two storeys, double eaves, an open hall below, the room above with
  // the window the last thread finds; willows on its little island behind it
  {
    const { X: PX, wl } = PAV;
    for (const [wx, sd] of [[PX - 190, 95], [PX + 200, 96]] as const) item(wl - 39, () => paint(sd, wx - 120, wx + 120, (c, rr) => inkWillow(c, rr, wx, wl - 40, 220, 170, C(INK), 60, 0.9)));
    item(wl - 38, () =>
      paint(94, PX - 260, PX + 260, (c) => {
        c.fillStyle = C("38,40,50");
        c.beginPath();
        c.ellipse(PX, wl - 34, 250, 12, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = C(PALE, 0.22);
        c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(PX, wl - 34, 250, 12, 0, Math.PI * 1.05, Math.PI * 1.95);
        c.stroke();
      })
    );
    const fill = () => C(INK), rim = () => C(PALE, 0.42), tiles = () => C(PALE, 0.14);
    item(wl, () => {
      paint(97, PX - 140, PX + 140, (c) => {
        c.fillStyle = C(INK);
        for (let k = -4; k <= 4; k++) c.fillRect(PX + k * 26 - 2, wl - 22, 4, 26);
        c.fillStyle = C(STONE);
        c.fillRect(PX - 118, wl - 26, 236, 8);
        c.fillStyle = C(PALE, 0.32);
        c.fillRect(PX - 118, wl - 26.6, 236, 0.9);
        c.fillStyle = C(WOOD);
        c.fillRect(PX - 92, wl - 104, 184, 78);
        c.fillStyle = fill();
        for (let k = -3; k <= 3; k++) c.fillRect(PX + k * 30 - 2, wl - 104, 4, 78);
        roof(c, PX, wl - 126, wl - 98, 108, { oh: 16, lift: 10, thick: 4, inset: 26, fill: fill(), rim: rim(), tiles: tiles() });
        c.fillStyle = fill();
        c.fillRect(PX - 86, wl - 132, 172, 3);
        for (let x = PX - 84; x < PX + 86; x += 5) c.fillRect(x, wl - 144, 1, 12);
        c.fillRect(PX - 86, wl - 145, 172, 1.4);
        c.fillStyle = C(WOOD);
        c.fillRect(PX - 66, wl - 192, 132, 62);
        c.fillStyle = fill();
        for (const k of [-66, -33, 33, 66]) c.fillRect(PX + k - 1.8, wl - 192, 3.6, 62);
        roof(c, PX, wl - 232, wl - 188, 84, { oh: 15, lift: 12, thick: 4, inset: 20, fill: fill(), rim: rim(), tiles: tiles() });
        c.fillRect(PX - 1.2, wl - 252, 2.4, 22);
        c.beginPath();
        c.arc(PX, wl - 246, 3.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = C("20,16,14");
        for (const wx of PAV_WINS) c.fillRect(wx - DIVE.w / 2 - 1.4, DIVE.Y - DIVE.h / 2 - 1.4, DIVE.w + 2.8, DIVE.h + 2.8);
      });
      const rr = mulberry32(98);
      for (const k of [-2, -1, 0, 1, 2]) {
        const X = PX + k * 30, Y = wl - 66;
        const rk = wakeRank(X, Y, rr);
        lamp(X, Y, 22, 52, rk, 0, 0.6, "rect", [5, 2, 0.9]);
        reflect(X, Y, 22, 52, wl, rk, 0, 0.55, rr, 110);
      }
      for (const k of [-1, 1]) lantern(rr, PX + k * 100, wl - 100, wl - 84, 2, 1, wl);
      // upstairs (v5.0): one room, three windows of the same lattice, one in each bay (the side bays'
      // centred between the posts at ±33 and ±66), dark until the last thread lands and lights the room
    });
  }

  // ================================================================ paint it all, far to near
  ITEMS.sort((a, b) => a.d - b.d || a.n - b.n);
  for (const it of ITEMS) it.draw();
  // the glow grid into its texture: amount (square-rooted for precision) and the wake rank of its column
  {
    let mx = 0;
    for (let i = 0; i < glowF.length; i++) mx = Math.max(mx, glowF[i]);
    const GMAX = Math.max(1e-6, mx * 0.6);
    const rankCol = new Float32Array(GW);
    for (let i = 0; i < GW; i++) rankCol[i] = wakeRank(SX0 + (i + 0.5) / GQ, HERO.Y, () => 0.5, 0);
    // the haze has no edges: where the camera path doubles back (as it pulls out of his window)
    // the wake jumps from one column to the next; across that stretch the haze wakes in a ramp
    {
      const a = Math.round((1712 - SX0) * GQ), b = Math.round((2160 - SX0) * GQ);
      const ra = rankCol[a], rb = rankCol[b];
      for (let i = a + 1; i < b; i++) rankCol[i] = ra + ((rb - ra) * (i - a)) / (b - a);
    }
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const k = (j * GW + i) * 4;
        glowData[k] = Math.round(255 * Math.sqrt(clamp(glowF[j * GW + i] / GMAX)));
        glowData[k + 1] = Math.round(255 * rankCol[i]);
        glowData[k + 3] = 255;
      }
    glowTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the panes and his house, finest
  for (const L of TILES) finish(L);
  for (const L of DETAIL) finish(L);
  {
    const L = layer({ z: 1, X0: HERO.X - 182, X1: HERO.X + 182, Y0: 836, Y1: 1080, q: 7, win: true, gain: 1.1 });
    hisHouse(L.ink);
    light(L, HERO.X - 58.5, 1002, 26, 20, beatRank(1, 0.3), 0, 0.85, "rect", [7, 1, 0.7]);
    light(L, HERO.X + 66, 970, 7, 9.5, beatRank(0, 0.3), 1, 1, "oval");
    L.ink.save();
    L.ink.globalCompositeOperation = "destination-out";
    L.ink.fillRect(HERO.X - 190, HOUSE_FOOT + 2, 380, 100);
    L.ink.restore();
    finish(L);
  }
  const poemWins = POEMS.map((p) =>
    pane(p.X, HERO.Y, PW + 1.6, PH + 1.6, 40, (c, w, h) => {
      c.fillStyle = "#1a110c";
      c.fillRect(0, 0, w, h);
      c.save();
      c.translate(0.8, 0.8);
      const gw = w - 1.6, gh = h - 1.6;
      paper(c, gw, gh, "rgba(255,222,170,1)", "rgba(214,136,70,1)");
      const fs = 4.7;
      c.font = `${fs}px ${HW}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      const chars = [...p.text];
      const y0 = gh / 2 - ((chars.length - 1) * fs * 1.04) / 2;
      c.filter = "blur(0.3px)";
      c.fillStyle = "rgba(92,40,20,0.5)";
      chars.forEach((ch, i) => c.fillText(ch, gw / 2, y0 + i * fs * 1.04));
      c.filter = "none";
      c.fillStyle = "rgba(58,24,12,0.92)";
      chars.forEach((ch, i) => c.fillText(ch, gw / 2, y0 + i * fs * 1.04));
      c.restore();
    }, 0.82)
  );
  // his window: the letter's paper, lit from inside, behind plain upright bars (直棂)
  const heroWin = pane(HERO.X, HERO.Y, HERO.w + 2, HERO.h + 2, 64, (c, w, h) => {
    c.fillStyle = "#3d271b"; // its frame, timber caught by the lamp inside
    c.fillRect(0, 0, w, h);
    c.save();
    c.translate(1, 1);
    const gw = w - 2, gh = h - 2, bar = 0.5;
    paper(c, gw, gh, "rgba(255,240,212,1)", "rgba(240,178,104,1)");
    c.fillStyle = "rgba(52,30,20,0.92)";
    for (let i = 1; i < 6; i++) c.fillRect((gw * i) / 6 - bar / 2, 0, bar, gh);
    c.restore();
  }, 0.95);
  (heroWin.material as THREE.ShaderMaterial).uniforms.uOn.value = 1;
  // the pavilion window the last thread finds: paper and the lantern lattice of the ending
  const pavPane = (X: number, gain: number) =>
    pane(X, DIVE.Y, DIVE.w + 2, DIVE.h + 2, 48, (c, w, h) => {
      c.fillStyle = "#1b120d";
      c.fillRect(0, 0, w, h);
      c.save();
      c.translate(1, 1);
      paper(c, w - 2, h - 2, "rgba(255,238,206,1)", "rgba(238,176,104,1)");
      c.fillStyle = "rgba(48,28,18,0.92)";
      lanternLattice(c, 0, 0, w - 2, h - 2, 0.42);
      c.restore();
    }, gain);
  const diveWin = pavPane(DIVE.X, 1.0);
  // v5.0: the side windows of the same room light with it, a little dimmer
  const sideWins = [pavPane(PAV_WINS[0], 0.82), pavPane(PAV_WINS[2], 0.82)];
  const glowTexW = toTex(glowCanvas(256, "255,178,104", 0.22));
  const glowMat = (o: number) => new THREE.MeshBasicMaterial({ map: glowTexW, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: o });
  const heroGlow = put(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(0.3)), 1, HERO.X - 30, HERO.X + 30, HERO.Y - 22, HERO.Y + 22);
  const diveGlow = put(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(0)), 1, DIVE.X - 30, DIVE.X + 30, DIVE.Y - 34, DIVE.Y + 34);
  const sideGlows = [PAV_WINS[0], PAV_WINS[2]].map((X) => put(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(0)), 1, X - 24, X + 24, DIVE.Y - 28, DIVE.Y + 28));

  // ---------------------------------------------------------------- threads
  // a chain of leaps along the scroll, each landing on a window that wakes on that beat, the
  // camera always arriving just behind them
  const WANT: { name: string; X: number; Y: number; k: number }[] = [
    { name: "a2", X: 1490, Y: 920, k: 2 },
    { name: "a2b", X: 1640, Y: 960, k: 2 },
    { name: "a3", X: 1700, Y: 700, k: 3 },
    { name: "b4", X: 1990, Y: 930, k: 4 },
    { name: "b5", X: 2200, Y: 760, k: 5 },
    { name: "b5b", X: 2120, Y: 940, k: 5 },
    { name: "br6", X: BRIDGE.X - BRIDGE.half - 26, Y: BRIDGE.foot - 14, k: 6 },
    { name: "c7", X: 2760, Y: 780, k: 7 },
    { name: "c7b", X: 2640, Y: 600, k: 7 },
    { name: "c8", X: 3080, Y: 880, k: 8 },
    { name: "g9", X: wallX(GATE.base + 12), Y: GATE.base + 12 - 14 * sAt(GATE.base + 12), k: 9 },
    { name: "l10", X: 3760, Y: 905, k: 10 },
    { name: "l10b", X: 3860, Y: 260, k: 10 },
    { name: "l11", X: 4040, Y: 558, k: 11 },
    { name: "t12", X: 4580, Y: 700, k: 12 },
  ];
  const THREADS: [string, string, number][] = [
    ["hero", "p1", 0], ["hero", "p2", 0],
    ["hero", "p0", 1], ["hero", "p3", 1],
    ["hero", "a2", 2], ["hero", "a2b", 2],
    ["a2b", "a3", 3],
    ["a2b", "b4", 4],
    ["b4", "b5", 5], ["b4", "b5b", 5],
    ["b5", "br6", 6],
    ["br6", "c7", 7], ["b5", "c7b", 7],
    ["c7", "c8", 8],
    ["c8", "g9", 9],
    ["g9", "l10", 10], ["g9", "l10b", 10],
    ["l10", "l11", 11],
    ["l11", "t12", 12],
    ["hero", "dive", -1],
  ];
  for (const w of WANT) A[w.name] = retarget(w.X, w.Y, beatRank(w.k, 0.5), w.name === "l10b" ? 1.2 : 3);
  const SEG = 40;
  type Th = { from: Anchor; to: Anchor; t0: number; t1: number; mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial; head: THREE.Mesh; flare: THREE.Mesh; size: number };
  const headTex = toTex(glowCanvas(128, "255,200,140", 0.18));
  const flareTex = toTex(glowCanvas(256, "255,170,100", 0.3));
  const makeThread = (from: Anchor, to: Anchor, t0: number, t1: number, size: number): Th => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const at = new Float32Array((SEG + 1) * 2);
    for (let i = 0; i <= SEG; i++) at[i * 2] = at[i * 2 + 1] = i / SEG;
    geo.setAttribute("aT", new THREE.BufferAttribute(at, 1));
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { uO: { value: 1 } }, vertexShader: THREAD_VS, fragmentShader: THREAD_FS, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    const head = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: headTex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
    const flare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flareTex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
    for (const m of [mesh, head, flare]) {
      m.renderOrder = order + 0.5;
      m.frustumCulled = false;
      m.visible = false;
      scene.add(m);
    }
    return { from, to, t0, t1, mesh, geo, mat, head, flare, size };
  };
  const threads: Th[] = THREADS.map(([fa, ta, k]) => {
    const from = A[fa], to = A[ta];
    const t1 = k >= 0 ? landAt(k) : LAST_THREAD;
    const s0 = toScreen(from.z, from.X, from.Y, cityCam(t1));
    const s1 = toScreen(to.z, to.X, to.Y, cityCam(t1));
    const dist = Math.hypot(s1.x - s0.x, s1.y - s0.y);
    const t0 = t1 - Math.round(k >= 0 ? clamp(9 + dist / 70, 10, 20) : 30);
    return makeThread(from, to, t0, t1, k >= 0 ? 1.15 : 1.6);
  });
  // the peak: for one beat a web of threads crosses the whole of the town in view
  {
    const PEAK = CY.peak;
    const camP = cityCam(PEAK + 6);
    const cands: Anchor[] = [];
    for (const L of TILES)
      for (const rc of L.recs) {
        if (rc.w < 3 || rc.tint > 0.6) continue;
        const sc = toScreen(1, rc.X, rc.Y, camP);
        if (sc.x > 80 && sc.x < 1840 && sc.y > 380 && sc.y < 1000) cands.push({ z: 1, X: rc.X, Y: rc.Y });
      }
    const rb = mulberry32(77);
    for (let n = 0, guard = 0; n < 18 && guard < 4000 && cands.length > 1; guard++) {
      const a = cands[Math.floor(rb() * cands.length)], b = cands[Math.floor(rb() * cands.length)];
      const sa = toScreen(1, a.X, a.Y, camP), sb = toScreen(1, b.X, b.Y, camP);
      const d = Math.hypot(sa.x - sb.x, sa.y - sb.y);
      if (d < 170 || d > 480) continue;
      const t1 = PEAK + 2 + Math.floor(rb() * 9);
      threads.push(makeThread(a, b, t1 - 9 - Math.round(d / 90), t1, 0.85));
      n++;
    }
  }
  order++;
  const bez = (p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }, t: number) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y,
  });
  const drawThread = (th: Th, f: number, cam: Cam) => {
    const live = f >= th.t0 && f <= th.t1 + 16;
    th.mesh.visible = th.head.visible = th.flare.visible = live;
    if (!live) return;
    const p0 = toScreen(th.from.z, th.from.X, th.from.Y, cam), p1 = toScreen(th.to.z, th.to.X, th.to.Y, cam);
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const k = Math.sqrt(clamp((p0.a + p1.a) / 2, 0.6, 16));
    const ctrl = { x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - Math.min(dist * 0.32, 320) - 10 * k };
    const head = easeInOutCubic(prog(f, th.t0, th.t1));
    const tail = f <= th.t1 ? Math.max(0, head - 0.5) : lerp(0.5, 1, prog(f, th.t1, th.t1 + 8));
    const width = clamp(1.7 * k, 1.6, 6) * th.size;
    const pos = th.geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i <= SEG; i++) {
      const t = lerp(tail, head, i / SEG);
      const p = bez(p0, ctrl, p1, t);
      const q = bez(p0, ctrl, p1, Math.min(1, t + 0.01));
      const pq = bez(p0, ctrl, p1, Math.max(0, t - 0.01));
      let nx = -(q.y - pq.y), ny = q.x - pq.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const wv = width * (0.3 + 0.7 * (i / SEG));
      pos.setXYZ(i * 2, p.x + nx * wv * 0.5, -(p.y + ny * wv * 0.5), 0);
      pos.setXYZ(i * 2 + 1, p.x - nx * wv * 0.5, -(p.y - ny * wv * 0.5), 0);
    }
    pos.needsUpdate = true;
    th.mat.uniforms.uO.value = f <= th.t1 ? 1 : 1 - prog(f, th.t1, th.t1 + 10);
    const hp = bez(p0, ctrl, p1, head);
    const hs = clamp(20 * k, 16, 70) * th.size;
    th.head.position.set(hp.x, -hp.y, 0);
    th.head.scale.set(hs, hs, 1);
    (th.head.material as THREE.MeshBasicMaterial).opacity = f <= th.t1 ? 0.95 : 0;
    const fl = prog(f, th.t1 - 1, th.t1 + 14);
    const fs = clamp(36 * Math.sqrt(p1.a), 24, 160) * (0.8 + 1.4 * fl) * th.size;
    th.flare.position.set(p1.x, -p1.y, 0);
    th.flare.scale.set(fs, fs, 1);
    (th.flare.material as THREE.MeshBasicMaterial).opacity = f >= th.t1 - 1 ? 0.9 * (1 - fl) : 0;
  };

  // the foot of the frame darkens a little, as the lower edge of a scroll does, so the
  // credit line keeps its ground over the lit windows of the near bank
  const shadeCv = makeCanvas(4, 256);
  {
    const c = shadeCv.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(8,9,14,0)");
    g.addColorStop(0.45, "rgba(8,9,14,0.16)");
    g.addColorStop(1, "rgba(8,9,14,0.46)");
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 256);
  }
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(1920, 190), new THREE.MeshBasicMaterial({ map: toTex(shadeCv), transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
  shade.position.set(960, -(1080 - 95), 0);
  shade.renderOrder = 100000;
  shade.frustumCulled = false;
  scene.add(shade);
  const post = makePost(renderer, scene, camera, { bloom: [0.5, 0.45, 0.7] });
  post.finish.uniforms.uVignette.value = 0.36;
  post.finish.uniforms.uGrain.value = 0.02;
  post.finish.uniforms.uCA.value = 0.0003;
  post.finish.uniforms.uFadeColor.value.set(1, 0.965, 0.918);

  const poemRank = POEMS.map((p) => beatRank(p.beat, 0.5));
  return {
    render(f: number) {
      const cam: Cam = cityCam(f);
      uF.value = f;
      const wave = waveAt(f);
      uWave.value = wave;
      let beat = 0;
      for (const b of [...BEATS, LAST_THREAD]) if (f >= b) beat = Math.max(beat, Math.exp(-(f - b) / 6));
      uBeat.value = beat;
      uHazeC.value.setRGB(0.02 * wave, 0.012 * wave, 0.006 * wave);
      // the haze is the town seen from far off: close up (his lane, the dive) it thins away
      const mag = view(1, cam).a;
      uGlow.value = 0.36 * lerp(0.12, 1, smooth(prog(mag, 3.2, 1.15)));
      for (const p of placed) {
        const v = view(p.z, cam);
        if (v.d < 0.002) {
          p.mesh.visible = false;
          continue;
        }
        const w = (p.X1 - p.X0) * v.a, h = (p.Y1 - p.Y0) * v.a;
        const x = 960 + ((p.X0 + p.X1) / 2 - 960) * v.a + v.bx;
        const y = 540 + ((p.Y0 + p.Y1) / 2 - 540) * v.a + v.by;
        p.mesh.visible = x + w / 2 > -50 && x - w / 2 < 1970 && y + h / 2 > -50 && y - h / 2 < 1130;
        p.mesh.position.set(x, -y, 0);
        p.mesh.scale.set(w, h, 1);
      }
      POEMS.forEach((p, i) => {
        const m = (poemWins[i].material as THREE.ShaderMaterial).uniforms;
        m.uOn.value = smooth(clamp((wave - poemRank[i]) / 0.012 + 0.5));
        const b = landAt(p.beat);
        m.uFlare.value = f >= b ? 0.55 * Math.exp(-(f - b) / 7) : 0;
      });
      const dv = (diveWin.material as THREE.ShaderMaterial).uniforms;
      dv.uOn.value = smooth(prog(f, LAST_THREAD - 1, LAST_THREAD + 3));
      dv.uFlare.value = f >= LAST_THREAD ? 0.9 * Math.exp(-(f - LAST_THREAD) / 9) + 0.25 * smooth(prog(f, CY.dive, CY.end)) : 0;
      (diveGlow.material as THREE.MeshBasicMaterial).opacity = dv.uOn.value * (0.55 + 0.45 * Math.exp(-Math.max(0, f - LAST_THREAD) / 12)) * (1 - 0.6 * prog(f, CY.dive, CY.end));
      sideWins.forEach((sw, i) => {
        const u = (sw.material as THREE.ShaderMaterial).uniforms;
        u.uOn.value = dv.uOn.value;
        u.uFlare.value = 0.35 * dv.uFlare.value;
        (sideGlows[i].material as THREE.MeshBasicMaterial).opacity = 0.6 * dv.uOn.value * (1 - 0.6 * prog(f, CY.dive, CY.end));
      });
      const heroW = HERO.w * view(1, cam).a;
      (heroGlow.material as THREE.MeshBasicMaterial).opacity = (0.28 + 0.2 * beat) * smooth(prog(heroW, 420, 140));
      (heroWin.material as THREE.ShaderMaterial).uniforms.uOn.value = 1; // lit all along: the letter lies over it until it goes
      for (const th of threads) drawThread(th, f, cam);
      (shade.material as THREE.MeshBasicMaterial).opacity = smooth(prog(f, 1655, 1705));
      if (post.bloom) post.bloom.strength = 0.5 + 0.2 * beat;
      post.finish.uniforms.uSeed.value = f;
      post.finish.uniforms.uFade.value = smooth(prog(f, CY.end - 9, CY.end - 1));
      post.composer.render();
    },
    dispose() {
      post.composer.dispose();
    },
  };
}
