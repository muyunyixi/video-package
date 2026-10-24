// Scene J · 读懂 · 重逢且近，愿与故人，做新鲜事。 (48.4–55.7 s)
// Through the southern window, back on his phone (his own line on the right, hers on the
// left). Close on his message: under 掂量情思敲字句，轻顿指尖 the half he never sent
// surfaces like secret ink — 但恐背南辕 — she read that too. The receipt turns from 已读
// to 已读懂. Then her reply answers the fear, and as 做新鲜事 lands the unsent half fades
// away. The whole sheet recedes into his lit window of the city.
//
// v4.0
// - The sheet is drawn at the history's scale (1.2 about the same origin), so the bubbles, the
//   columns and the type are the size they were a few seconds before; the close-up on his
//   message is closer (2.0, was 1.6), which leaves the pull-back more room.
// - Opaque from its first frame: only the white-out fades (v3.1 faded the sheet in under a
//   fading white, and the dark of the moon scene showed through as a grey flash at 48.4 s).
// - Her reply keeps v3.1's size on screen (88 px), its lines 1.35 × the size apart, baseline to
//   baseline, and it is written in with a brush (Poem: reveal "brush").
// - Late spring: the petals of the history's first page go on falling down both margins; one
//   drifts past his message, and the 懂 stamped beside it sets it spinning.
import React from "react";
import { useCurrentFrame } from "remotion";
import cues from "../cues.json";
import { PoemLine, glyphsOf, stackLines, type Line } from "../Poem";
import { HW, SERIF, COLORS, clamp, prog, smooth, lerp, easeOutCubic, easeOutBack, easeInOutCubic, mulberry32 } from "../lib/util";
import { lineInk, glyphInk, spanTop } from "../lib/ink";
import { SeepFilter, hashStr } from "../lib/seep";
import { FIRST_LINE } from "./typing";
import { heroRect } from "../lib/cityCam";
import { inkShift, CHAT_S, ORIGIN } from "./Chat";
import { DriftShape, fallPose } from "../lib/drift";

const R = cues.reply;
const FS = 46;
const SENT = FIRST_LINE;
const UNSENT = "但恐背南辕";
const BUBBLE_TOP = 214, BUBBLE_H = 90, COL_R = 1400, SENT_PAD = 32;
const GHOST_Y = 352; // ink centre of the unsent half
const RECEIPT_Y = 404;

// the close-up: his message, the unsent half and the receipt, centred, at CLOSE
const CLOSE = 2.0;
const FOCUS = { x: 1092, y: 316 };

// her reply, sized on screen (the sheet is at CHAT_S) as in v3.1: 88 px type, tracking 10, the
// first line's ink centre 112 below the card's top, 96 in from its left, 108 from the last line's
// ink centre to the bottom; and the lines 1.35 × the type size apart, baseline to baseline
const K = 1 / CHAT_S;
const RS = 88 * K, RT = 10 * K, PITCH = 1.35 * RS;
const BX = 520, BY = 452, BW = 700 * K;
const IN_X = 96 * K, FIRST_MID = 112 * K, FOOT = 108 * K;
const REPLY = [
  { text: "重逢且近，", at: R.p1, color: COLORS.ink },
  { text: "愿与故人，", at: R.p2, color: COLORS.ink },
  { text: "做新鲜事。", at: R.p3, color: COLORS.vermilion },
];
function replyLines() {
  const lines = stackLines(
    REPLY.map(
      (r, i): Line => ({
        // v4.1: the last line's 。 is not written: the peach becomes it (PeachEgg)
        glyphs: glyphsOf(r.text, r.at, 4).map((g) => (i === 2 && g.ch === "。" ? { ...g, at: 1e9 } : g)),
        x: BX + IN_X,
        y: 0,
        size: RS,
        tracking: RT,
        align: "left",
        out: [R.end, R.end + 1],
        reveal: "brush",
        color: () => r.color,
      })
    ),
    BY + FIRST_MID,
    PITCH
  );
  return { lines, BH: lines[2].y - BY + FOOT };
}

// ---------- v4.1 · 桃子's full stop ----------
// Her last line comes without its 。. The late-spring petals drifting down the margins come from a
// peach tree beyond the left of the picture, and while she writes a branch of it grows in from the
// left edge, above her card: rising a little and more and more towards its end, as a branch turns
// up to the light, a shoot rising from it on the way — each leaf opening once the tip has passed it.
// Over her card's last column a green peach comes out on it as the tip goes by — with the branch,
// as its leaves do, not swelling from small (v4.2, the user) — and ripens, the branch giving a
// little under its weight. While she waits it rocks; it drops (the branch, relieved of it, springs up),
// falls into her card past the commas above the 。, lands on the line on the beat (54.0 s, with a
// soft knock), bounces once and rolls into the 。's place, comes to rest on its side, takes on her
// line's vermilion and becomes the 。. 桃 is her name.
const PEACH = { grow: R.bubble + 4, grown: R.p2 + 8, sway: R.p3 + 11, drop: R.p3 + 25, land: R.p3 + 39, ink: R.p3 + 45 }; // land: 1620, on the beat at 54.0 s
const PEACH_R = 10; // about the size of the 。 (sheet px)
const PEACH_K = 1.1; // its drawing's scale
const PEACH_TOP = 8.8 * PEACH_K; // from its centre up to where it sits on the branch
// where it hangs: over the 。's cell, right of the 。 itself, so it falls clear of the commas above it;
// it comes down there and rolls in
const HANG_DX = 29;
/** where the last line's 。 sits: its pen x and baseline, and its ink centre (sheet px) */
function stopAt(line: Line) {
  const chars = line.glyphs.map((g) => g.ch);
  const gaps = line.glyphs.map((g, i) => (g.gapBefore ?? 0) + (i ? line.tracking ?? 0 : 0));
  const L = lineInk(chars, line.size, gaps);
  const x0 = line.x - L.boxL;
  const base = line.y - (L.inkT + L.inkB) / 2;
  const i = chars.length - 1;
  const g = glyphInk(chars[i], line.size);
  return { pen: x0 + L.xs[i], base, cx: x0 + L.xs[i] + (g.l + g.r) / 2, cy: base + (g.t + g.b) / 2 };
}

// the peach: round, a shallow hollow at the stalk, the groove down one side to a small beak bent
// aside — a peach, not a heart (it is never shown beak-down with the groove facing us, nor at rest
// on its beak: it comes to rest lying on its side). Its colours (ripe) are v4.1's; it comes out a
// green one. The light stays where it is (upper left) however the peach turns.
const PEACH_D =
  "M-0.4,-9.6 C1.6,-10.3 5.8,-10.5 8.6,-7.8 C11.2,-5.2 11.4,0.6 9.8,4.6 C9.0,7.6 7.6,9.6 6.4,10.6 C5.8,11.1 5.6,11.9 5.8,12.8 " +
  "C4.4,12.0 2.6,11.8 0.6,11.7 C-5.0,11.4 -9.4,8.0 -10.4,2.8 C-11.2,-1.8 -9.8,-6.4 -7.0,-8.6 C-4.8,-10.3 -2.0,-10.4 -0.4,-9.6 Z";
const RIPE = ["#fff3dc", "#f8c2a4", "#e3705f", "#b8463e"];
const GREEN = ["#f6f5d8", "#dfe4ae", "#b3c079", "#859552"];
function mixHex(a: string, b: string, t: number) {
  const c = (h: string, k: number) => (h[0] === "#" ? parseInt(h.slice(1 + 2 * k, 3 + 2 * k), 16) : +h.slice(4, -1).split(",")[k]);
  return `rgb(${[0, 1, 2].map((k) => Math.round(lerp(c(a, k), c(b, k), t))).join(",")})`;
}
const PeachBody: React.FC<{ id: string; ripe: number; rot: number; ink: number }> = ({ id, ripe, rot, ink }) => (
  <>
    <defs>
      <radialGradient id={`${id}g`} gradientUnits="userSpaceOnUse" cx={-2.6} cy={-3.3} r={17.6} gradientTransform={`rotate(${(-rot).toFixed(2)})`}>
        {[0, 0.32, 0.72, 1].map((o, k) => (
          <stop key={k} offset={o} stopColor={mixHex(mixHex(GREEN[k], RIPE[k], ripe), COLORS.vermilion, ink * (0.8 + 0.07 * k))} />
        ))}
      </radialGradient>
      <clipPath id={`${id}c`}>
        <path d={PEACH_D} />
      </clipPath>
      <filter id={`${id}f`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={0.55} />
      </filter>
    </defs>
    <g transform={`rotate(${rot.toFixed(2)})`}>
      <path d={PEACH_D} fill={`url(#${id}g)`} />
      <g clipPath={`url(#${id}c)`}>
        {/* the groove, from the stalk to the beak: a soft shadow with a lit edge; and the stalk's hollow */}
        <path d="M-0.1,-9.2 C3.4,-6 5.4,4 5.4,12.4" stroke="rgba(146,40,36,0.5)" strokeWidth={1.3} fill="none" strokeLinecap="round" filter={`url(#${id}f)`} />
        <path d="M1.2,-8.6 C4.6,-5.4 6.6,4 6.6,11.2" stroke="rgba(255,236,214,0.38)" strokeWidth={0.8} fill="none" strokeLinecap="round" filter={`url(#${id}f)`} />
        <ellipse cx={-0.3} cy={-9.9} rx={2.6} ry={1.4} fill="rgba(120,40,34,0.3)" filter={`url(#${id}f)`} />
      </g>
    </g>
  </>
);

// ---- the branch (sheet px) ----
type Pt = { x: number; y: number };
/** a branch's line through its nodes: between two nodes the wood runs nearly straight (each piece
 *  bowed a little), and it changes direction at the node, as a peach branch grows — not a smooth vine.
 *  Sampled every 2 px or so, with its arc length */
function curve(knots: Pt[], bows: number[]) {
  const pts: Pt[] = [knots[0]];
  for (let i = 0; i < knots.length - 1; i++) {
    const a = knots[i], b = knots[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    // the bow: a quadratic through the middle pushed off the chord (+: to its right as it grows)
    const c = { x: (a.x + b.x) / 2 - (dy / l) * (bows[i] ?? 0), y: (a.y + b.y) / 2 + (dx / l) * (bows[i] ?? 0) };
    const n = Math.max(3, Math.ceil(l / 2));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
    }
  }
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = len[len.length - 1];
  const at = (s: number): Pt => {
    s = clamp(s, 0, L);
    let lo = 0, hi = len.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (len[m] <= s) lo = m;
      else hi = m;
    }
    const u = (s - len[lo]) / (len[hi] - len[lo] || 1);
    return { x: lerp(pts[lo].x, pts[hi].x, u), y: lerp(pts[lo].y, pts[hi].y, u) };
  };
  return { at, L };
}
/** the branch at rest (sheet px; the frame's left edge is at sheet x 160): in from beyond the left
 *  edge, a little lower down beside her card, it grows the one way, up to the right, turning up a
 *  little more at its end, the way a branch turns up towards the light; it passes over her card's
 *  corner and ends over its last column, under his message (whose foot is at sheet y 304). (Up to
 *  x 1020 it follows y = 494 − 0.158·(x − 160) − 0.0000203·(x − 160)²: rising 9° at the frame's edge,
 *  11° at the peach.) */
const FRAME_LEFT = (ORIGIN.x * (CHAT_S - 1)) / CHAT_S;
const BRANCH: Pt[] = [
  { x: 90, y: 505 },
  { x: 250, y: 479.6 },
  { x: 400, y: 454.9 },
  { x: 548, y: 429.6 },
  { x: 700, y: 402.8 },
  { x: 840, y: 377.2 },
  { x: 950, y: 356.5 },
  { x: 1020, y: 343.1 },
  { x: 1058, y: 330 },
  { x: 1080, y: 318 },
];
const BOWS = [3, -2, 2.5, -2, 2, -1.5, 1, -1, 0.5];
/** a shoot from the third node, rising */
const SPUR = { x: 548, a: -64, len: 80, bend: 14 };
// the leaves, as a peach grows them: one at a node, the nodes taking turns on either side (互生, never
// two from one point), pointing forward along the shoot. The old wood where the branch comes in has
// few; the young growth beyond the shoot is leafy, the leaves largest midway and smaller towards the
// tip, the last ones still folded close against the stem round the bud at its end. Where (the x the
// branch is at), angle off the branch (deg; − to its left as it grows, i.e. above it), length,
// breadth (less: folded, or seen edge-on), young or not. None reaches his message or her card
const LEAVES = [
  { x: 335, a: 50, len: 44, w: 1, y: 0 },
  { x: 452, a: -56, len: 46, w: 0.95, y: 0 },
  { x: 612, a: 24, len: 34, w: 1, y: 0 },
  { x: 668, a: -50, len: 56, w: 1.1, y: 0 },
  { x: 726, a: 34, len: 54, w: 1, y: 0 },
  { x: 786, a: -48, len: 58, w: 1.1, y: 0 },
  { x: 846, a: 32, len: 52, w: 0.95, y: 1 },
  { x: 904, a: -46, len: 50, w: 1.05, y: 1 },
  { x: 950, a: 34, len: 44, w: 0.95, y: 1 },
  { x: 993, a: -40, len: 40, w: 1, y: 1 },
  { x: 1018, a: 28, len: 36, w: 0.9, y: 1 },
  { x: 1044, a: -26, len: 28, w: 0.85, y: 1 },
  { x: 1062, a: 18, len: 20, w: 0.75, y: 1 },
  { x: 1073, a: -10, len: 13, w: 0.7, y: 1 },
];
// the shoot's own, the same way: along it (0–1), angle, length, breadth
const SPUR_LEAVES = [
  { t: 0.32, a: 40, len: 40, w: 1 },
  { t: 0.62, a: -42, len: 36, w: 0.95 },
  { t: 0.84, a: 24, len: 22, w: 0.8 },
  { t: 0.95, a: -10, len: 11, w: 0.7 },
];
// the nodes that show: where the old wood bears its two leaves, where the shoot comes off, where the
// peach is borne
const NODES = [335, 452, 548, 993];
// two tones, as a leaf folded along its midrib catches the light on one half; darker at the stalk
const LEAF_COL = [
  [["#4f6a3f", "#6b8752"], ["#6f8e56", "#8fac6c"]],
  [["#6a8a4c", "#86a462"], ["#8eac66", "#adc583"]],
];
type Twig = ReturnType<typeof twigState>;
function twigState(f: number, hx: number) {
  const C = curve(BRANCH, BOWS);
  const L = C.L;
  // the tip comes in where the branch enters the frame
  let sEdge = 0;
  while (sEdge < L && C.at(sEdge).x < FRAME_LEFT) sEdge += 0.5;
  const ease = (u: number) => smooth(Math.pow(u, 0.8));
  const tipAt = (ff: number) => lerp(sEdge, L, ease(prog(ff, PEACH.grow, PEACH.grown)));
  const sTip = tipAt(f);
  /** the frame the tip passes s */
  const passAt = (s: number) => {
    let lo = PEACH.grow, hi = PEACH.grown;
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2;
      if (tipAt(m) < s) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const sAt = (x: number) => {
    if (!isFinite(x)) return L;
    let s = sEdge;
    while (s < L && C.at(s).x < x) s += 0.5;
    return s;
  };
  // the peach, over the column: it comes out green, at its own size, as the tip goes by (v4.2: v4.1
  // grew it from a fifth of its size over 22 frames after the branch had passed — "from small to big",
  // the user said, where it should come with the branch), then ripens
  const sP = sAt(hx);
  const born = passAt(sP);
  const pscale = f < born ? 0 : 1;
  const pshow = smooth(prog(f, born, born + 5));
  const ripe = smooth(prog(f, born + 8, born + 30));
  // its weight bows the branch (its end down by SAG at most); while it rocks the branch bobs with
  // it; when it drops the branch springs back and rings out
  const SAG = 6;
  let load = pshow; // the branch takes its weight as it comes
  if (f >= PEACH.sway && f < PEACH.drop) load += 0.22 * prog(f, PEACH.sway, PEACH.drop) * Math.sin(2 * (f - PEACH.sway) * 0.95);
  if (f >= PEACH.drop) {
    const t = f - PEACH.drop;
    load = Math.cos((2 * Math.PI * t) / 10) * Math.exp(-t / 9);
  }
  // the air it sways in
  const ft = f - T0;
  const th = ((0.3 * Math.sin((2 * Math.PI * ft) / 90) + 0.12 * Math.sin((2 * Math.PI * ft) / 41 + 1.3)) * Math.PI) / 180;
  const E = C.at(0), cs = Math.cos(th), sn = Math.sin(th);
  const pose = (s: number): Pt => {
    const p = C.at(s);
    const q = clamp(s / L);
    const y = p.y + (SAG * load * q * q * (3 - q)) / 2;
    const dx = p.x - E.x, dy = y - E.y;
    return { x: E.x + dx * cs - dy * sn, y: E.y + dx * sn + dy * cs };
  };
  const dir = (s: number) => {
    const a = pose(s - 1), b = pose(s + 1);
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  /** half the branch's thickness at s: tapering, and to a point at the growing tip */
  const half = (s: number) => lerp(6.4, 1.4, Math.pow(clamp(s / L), 0.85)) * clamp(0.3 + ((sTip - s) / 22) * 0.7);
  // where the peach sits: on the branch's underside
  const dp = dir(sP), pp = pose(sP), hp = half(sP);
  const attach = { x: pp.x - Math.sin(dp) * hp, y: pp.y + Math.cos(dp) * hp };
  const tilt = 3 * Math.sin((2 * Math.PI * ft) / 90 + 0.6) - (dp * 180) / Math.PI * 0.3;
  // the shoot: from its node, once the tip has passed it, growing over 16 frames
  const sS = sAt(SPUR.x);
  const spurBorn = passAt(sS) + 1;
  const spurLen = SPUR.len * smooth(prog(f, spurBorn, spurBorn + 16));
  const spurAt = (u: number): Pt => {
    // a gentle arc: its direction turning by `bend` along it
    const base = pose(sS), d0 = dir(sS) + (SPUR.a * Math.PI) / 180;
    const b = (SPUR.bend * Math.PI) / 180;
    let x = base.x, y = base.y;
    const n = 12;
    for (let k = 0; k < n; k++) {
      const a = d0 + b * ((k + 0.5) / n) * u;
      x += (Math.cos(a) * SPUR.len * u) / n;
      y += (Math.sin(a) * SPUR.len * u) / n;
    }
    return { x, y };
  };
  const leaves = LEAVES.map((lf) => ({ ...lf, s: sAt(lf.x) }));
  const nodes = NODES.map(sAt);
  return { L, sTip, passAt, pose, dir, half, attach, pscale, pshow, ripe, tilt, leaves, nodes, sS, spurBorn, spurLen, spurAt };
}

/** the branch (sheet px; the frame's edge cuts it) */
const PeachSprig: React.FC<{ f: number; tw: Twig }> = ({ f, tw }) => {
  if (tw.sTip <= 0 || f < PEACH.grow) return null;
  const { L, sTip, pose, dir, half, passAt } = tw;
  const pt = (p: Pt, d: number, w: number) => `${(p.x - Math.sin(d) * w).toFixed(1)},${(p.y + Math.cos(d) * w).toFixed(1)}`;
  // the branch as a tapering band
  const ss: number[] = [];
  for (let s = 0; s < sTip; s += 2) ss.push(s);
  ss.push(sTip);
  const edge = (sgn: number) => ss.map((s) => pt(pose(s), dir(s), half(s) * sgn));
  const twig = `M${edge(-1).join(" L")} L${edge(1).reverse().join(" L")} Z`;
  // a little light along its upper side
  const lit = ss.filter((s) => s < sTip - 6).map((s) => pt(pose(s), dir(s), -half(s) * 0.45));
  // the shoot: a thin band, tapering to its tip
  let spur = "";
  const spurU = tw.spurLen / SPUR.len;
  if (spurU > 0.02) {
    const us = Array.from({ length: 13 }, (_, k) => (k / 12) * spurU);
    const sw = (u: number) => lerp(2.4, 0.5, u / Math.max(spurU, 1e-3)) * lerp(0.6, 1, spurU);
    const sdir = (u: number) => {
      const a = tw.spurAt(Math.max(0, u - 0.01)), b = tw.spurAt(Math.min(1, u + 0.01));
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    const e1 = us.map((u) => pt(tw.spurAt(u), sdir(u), sw(u)));
    const e2 = us.map((u) => pt(tw.spurAt(u), sdir(u), -sw(u)));
    spur = `M${e1.join(" L")} L${e2.reverse().join(" L")} Z`;
  }
  const after = f - PEACH.drop;
  /** a peach leaf at p off a branch going d (rad) whose half-thickness there is hw: long, narrow,
   *  pointed; its tip droops (down on the page is cos(a) along the leaf's own y), and it is folded a
   *  little along the midrib: two tones */
  const drawLeaf = (key: string, p: Pt, d: number, hw: number, lf: { a: number; len: number; w: number; y: number }, pass: number, i: number, reach: number) => {
    const open = easeOutBack(prog(f, pass + 1, pass + 14), 1.2);
    if (open <= 0) return null;
    const up = lf.a < 0 ? -1 : 1;
    const flutter =
      2.4 * Math.sin((2 * Math.PI * (f - T0)) / (26 + 5 * i) + i * 1.7) + (after > 0 ? 7 * Math.exp(-after / 8) * Math.sin(after * 1.3 + i) * reach * reach : 0);
    const ang = (d * 180) / Math.PI + lf.a * lerp(0.3, 1, clamp(open)) + flutter;
    const len = lf.len * lerp(0.25, 1, open), wd = lf.len * 0.15 * lf.w * lerp(0.3, 1, clamp(open));
    const a = (ang * Math.PI) / 180;
    const droop = len * 0.16 * Math.cos(a);
    const mid = `M0,0 C${len * 0.3},${droop * 0.05} ${len * 0.66},${droop * 0.42} ${len},${droop}`;
    const upper = `C${len * 0.66},${-wd * 0.95 + droop * 0.42} ${len * 0.22},${-wd * 1.05} 0,0`;
    const lower = `C${len * 0.66},${wd * 0.9 + droop * 0.42} ${len * 0.24},${wd * 0.8} 0,0`;
    const litUp = Math.cos(a) >= 0; // the half facing up is lit
    const o = { x: p.x - Math.sin(d) * hw * up * 0.6, y: p.y + Math.cos(d) * hw * up * 0.6 };
    return (
      <g key={key} transform={`translate(${o.x.toFixed(1)},${o.y.toFixed(1)}) rotate(${ang.toFixed(2)})`}>
        <path d={`${mid} ${lower} Z`} fill={`url(#lf${lf.y}${litUp ? 0 : 1})`} />
        <path d={`${mid} ${upper} Z`} fill={`url(#lf${lf.y}${litUp ? 1 : 0})`} />
        <path d={mid} stroke="rgba(226,232,196,0.45)" strokeWidth={0.6} fill="none" />
      </g>
    );
  };
  const mainLeaf = (lf: Twig["leaves"][number], i: number) =>
    sTip < lf.s - 0.5 ? null : drawLeaf(`m${i}`, pose(lf.s), dir(lf.s), half(lf.s), lf, passAt(Math.min(lf.s, L - 0.5)) + (i % 3) * 1.5, i, lf.s / L);
  const spurLeaf = (lf: (typeof SPUR_LEAVES)[number], i: number) => {
    if (spurU < lf.t - 0.01) return null;
    const u = lf.t * spurU;
    const a = tw.spurAt(Math.max(0, u - 0.01)), b = tw.spurAt(Math.min(1, u + 0.01));
    return drawLeaf(`s${i}`, tw.spurAt(u), Math.atan2(b.y - a.y, b.x - a.x), 1, { ...lf, y: 1 }, tw.spurBorn + lf.t * 14, 20 + i, 0.7);
  };
  /** the terminal bud: a small pointed bud, young green going reddish at its base, set on the end */
  const bud = (p: Pt, d: number, k: number) =>
    k > 0.01 ? (
      <g transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${((d * 180) / Math.PI).toFixed(2)}) scale(${k.toFixed(3)})`}>
        <path d="M-1.5,0 C0.5,-2.0 4.6,-1.7 8.4,0.2 C4.6,1.9 0.5,2.0 -1.5,0 Z" fill="#8a9d58" />
        <path d="M-1.5,0 C0,-1.3 2.2,-1.4 3.6,0 C2.2,1.4 0,1.3 -1.5,0 Z" fill="#8c5a3e" opacity={0.7} />
      </g>
    ) : null;
  const tipX = pose(L).x; // (the gradient runs from where it comes in to its tip)
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={BW} height={10}>
      <defs>
        {/* older wood where it comes in, the new growth reddish */}
        <linearGradient id="twigcol" gradientUnits="userSpaceOnUse" x1={FRAME_LEFT} y1={0} x2={tipX} y2={0}>
          <stop offset="0" stopColor="#4a382c" />
          <stop offset="0.65" stopColor="#5e4233" />
          <stop offset="1" stopColor="#84493a" />
        </linearGradient>
        {LEAF_COL.map((tones, y) =>
          tones.map(([c0, c1], k) => (
            <linearGradient key={`${y}${k}`} id={`lf${y}${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={c0} />
              <stop offset="1" stopColor={c1} />
            </linearGradient>
          ))
        )}
      </defs>
      {tw.leaves.map((lf, i) => (lf.a < 0 ? mainLeaf(lf, i) : null))}
      {SPUR_LEAVES.map((lf, i) => (lf.a < 0 ? spurLeaf(lf, i) : null))}
      {spur && <path d={spur} fill="#76473a" />}
      <path d={twig} fill="url(#twigcol)" />
      {lit.length > 1 && <path d={`M${lit.join(" L")}`} stroke="rgba(255,236,214,0.22)" strokeWidth={0.9} fill="none" strokeLinecap="round" />}
      {/* the nodes the leaves come from */}
      {tw.nodes.map((sn, k) => {
        if (sTip < sn) return null;
        const p = pose(sn);
        return <circle key={k} cx={p.x} cy={p.y} r={half(sn) * 1.12} fill="#4a3428" />;
      })}
      {tw.leaves.map((lf, i) => (lf.a >= 0 ? mainLeaf(lf, i) : null))}
      {SPUR_LEAVES.map((lf, i) => (lf.a >= 0 ? spurLeaf(lf, i) : null))}
      {/* the bud at the end of each: where it is still growing */}
      {bud(pose(sTip), dir(sTip), clamp((sTip - tw.L * 0.6) / 40))}
      {spurU > 0.02 && bud(tw.spurAt(spurU), (() => {
        const a = tw.spurAt(Math.max(0, spurU - 0.02)), b = tw.spurAt(spurU);
        return Math.atan2(b.y - a.y, b.x - a.x);
      })(), clamp(spurU * 1.5))}
      {/* where the peach sat */}
      {f >= PEACH.drop && <circle cx={tw.attach.x} cy={tw.attach.y + 0.4} r={1.2} fill="#6a4a38" />}
    </svg>
  );
};

/** the peach, from the bud to the 。 (sheet px) */
const PeachFall: React.FC<{ f: number; line: Line; tw: Twig; hx: number }> = ({ f, line, tw, hx }) => {
  if (f < PEACH.grow || tw.pscale <= 0) return null;
  const s = stopAt(line);
  const restY = s.cy + 1; // where it comes to rest: on the line, where the 。 belongs
  /** hanging from where it sits on the twig, at an angle (deg) */
  const hang = (t: Twig, r: number) => {
    const a = (r * Math.PI) / 180, k = PEACH_TOP * t.pscale;
    return { x: t.attach.x - Math.sin(a) * k, y: t.attach.y + Math.cos(a) * k };
  };
  const rock = (ff: number, t: Twig) => t.tilt + (ff >= PEACH.sway ? 16 * Math.sin((ff - PEACH.sway) * 0.95) * prog(ff, PEACH.sway, PEACH.drop) : 0);
  let x: number, y: number, rot: number, turn = 0, sx = tw.pscale * PEACH_K, sy = tw.pscale * PEACH_K, op = tw.pshow, ink = 0;
  if (f < PEACH.drop) {
    // it comes out and ripens on the twig, sways with it, and rocks while she waits, more and more
    rot = rock(f, tw);
    ({ x, y } = hang(tw, rot));
  } else {
    const t0 = twigState(PEACH.drop - 0.001, hx);
    const r0 = rock(PEACH.drop - 0.001, t0);
    const h0 = hang(t0, r0);
    if (f < PEACH.land) {
      // it falls: from rest, under gravity, turning over as it goes
      const u = (f - PEACH.drop) / (PEACH.land - PEACH.drop);
      y = h0.y + (restY - h0.y) * u * u;
      x = h0.x + 4 * Math.sin(u * Math.PI * 2.2) * (1 - u);
      rot = lerp(r0, -360, easeInOutCubic(u)); // a turn over, the way it will roll: it lands beak down
      turn = 40 * Math.sin(u * Math.PI * 2); // it shows its groove, then its back, and is square on again as it lands
    } else {
      // it lands on the beat, squashes, bounces once and a little, and rolls along the line to the 。's
      // place, slowing (rolling left: turning back by the distance over its radius), coming to rest on
      // its side
      const t = f - PEACH.land;
      const roll = easeOutCubic(clamp(t / 10));
      const lx = h0.x;
      x = lerp(lx, s.cx, roll);
      const b1 = t < 7 ? 15 * Math.sin((Math.PI * t) / 7) : 0;
      const b2 = t >= 7 && t < 10 ? 3 * Math.sin((Math.PI * (t - 7)) / 3) : 0;
      y = restY - b1 - b2;
      const sq = Math.exp(-t / 1.6) * (t < 7 ? 1 : 0.3);
      sx = PEACH_K * (1 + 0.22 * sq);
      sy = PEACH_K * (1 - 0.24 * sq);
      rot = -360 + ((((s.cx - lx) / (PEACH_R * PEACH_K)) * 180) / Math.PI) * roll + 4 * Math.sin(t * 0.9) * Math.exp(-t / 4);
      // and becomes the 。: it takes on her line's vermilion as it shrinks, and the 。 seeps in under it
      const m = smooth(prog(f, PEACH.ink, PEACH.ink + 8));
      ink = smooth(prog(f, PEACH.ink - 2, PEACH.ink + 5));
      op = 1 - smooth(prog(f, PEACH.ink + 3, PEACH.ink + 9));
      sx *= 1 - 0.45 * m;
      sy *= 1 - 0.45 * m;
    }
  }
  if (op <= 0.001) return null;
  // its shadow on the line it is coming down to: only as it gets near
  const near = clamp(1 - (restY - y) / 110);
  return (
    <>
      {near > 0 && (
        <div
          style={{
            position: "absolute",
            left: x - PEACH_R * lerp(0.6, 1, near) + 2,
            top: restY + PEACH_R * 0.62,
            width: PEACH_R * 2 * lerp(0.6, 1, near),
            height: PEACH_R * 0.7,
            borderRadius: "50%",
            background: "rgba(80,40,30,0.5)",
            filter: `blur(${(1.6 + 3 * (1 - near)).toFixed(1)}px)`,
            opacity: 0.26 * near * near * op,
          }}
        />
      )}
      <svg
        width={PEACH_R * 3}
        height={PEACH_R * 3}
        viewBox="-15 -15 30 30"
        style={{
          position: "absolute",
          left: x - PEACH_R * 1.5,
          top: y - PEACH_R * 1.5,
          overflow: "visible",
          opacity: op,
          transformOrigin: "50% 50%",
          transform: `perspective(120px) rotateY(${turn.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`, // turned inside (PeachBody)
        }}
      >
        <PeachBody id="pk1" ripe={tw.ripe} rot={rot} ink={ink} />
      </svg>
    </>
  );
};
/** the 。 the peach becomes: seeping in, in her line's vermilion */
const PeachStop: React.FC<{ f: number; line: Line }> = ({ f, line }) => {
  if (f < PEACH.ink) return null;
  const s = stopAt(line);
  const t = prog(f, PEACH.ink, PEACH.ink + 12);
  return (
    <>
      {t < 1 && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <SeepFilter id="peachstop" p={t} size={line.size} seed={520} soft={5} />
        </svg>
      )}
      <span
        style={{
          position: "absolute",
          left: s.pen,
          top: spanTop(s.base, line.size),
          fontFamily: HW,
          fontSize: line.size,
          lineHeight: 0,
          whiteSpace: "pre",
          color: COLORS.vermilion,
          filter: t < 1 ? "url(#peachstop)" : undefined,
        }}
      >
        。
      </span>
    </>
  );
};

// ---------- petals ----------
type Petal = { x: number; y0: number; size: number; ph: number };
const T0 = cues.scenes.reply[0];
const DONG = { x: 1390, y: 404 }; // where the 懂 lands
let PETALS: Petal[] | null = null;
function petals(): Petal[] {
  if (PETALS) return PETALS;
  const r = mulberry32(521);
  const out: Petal[] = [];
  // down both margins (sheet x 160–380 and 1540–1760 are inside the frame at CHAT_S)
  for (let j = 0; j < 8; j++) out.push({ x: 175 + r() * 190, y0: -440 + r() * 1320, size: 0.7 + r() * 0.6, ph: r() * 6.28 });
  for (let j = 0; j < 8; j++) out.push({ x: 1555 + r() * 190, y0: -440 + r() * 1320, size: 0.7 + r() * 0.6, ph: r() * 6.28 });
  // one drifting down past his message while we are close on it: beside the receipt when 懂 lands
  const hero = { x: 1468, size: 1.15, ph: 1.3 };
  const atDong = fallPose("petal", R.dong - T0, hero.ph, hero.size);
  out.push({ ...hero, x: hero.x - atDong.dx, y0: DONG.y - 20 - atDong.dy });
  // and one high on the left, where her reply is still to come
  out.push({ x: 650, y0: -70, size: 0.9, ph: 4.1 });
  return (PETALS = out);
}
const Petals: React.FC<{ f: number }> = ({ f }) => {
  const t = f - T0;
  const gt = prog(f, R.dong, R.dong + 16);
  const gust = easeOutCubic(gt);
  return (
    <>
      {petals().map((p, i) => {
        const q = fallPose("petal", t, p.ph, p.size);
        let x = p.x + q.dx, y = p.y0 + q.dy, rot = q.rot;
        if (gt > 0) {
          // 懂 lands like a seal: the air it pushes catches whatever is close
          const at = fallPose("petal", R.dong - T0, p.ph, p.size);
          const d2 = (p.x + at.dx - DONG.x) ** 2 + (p.y0 + at.dy - DONG.y) ** 2;
          const w = Math.exp(-d2 / (2 * 150 * 150));
          x += w * 64 * gust;
          y -= w * 22 * Math.sin(Math.PI * gt);
          rot += w * 160 * gust;
        }
        return <DriftShape key={i} kind="petal" x={x} y={y} size={p.size} rot={rot} flip={q.flip} opacity={0.85} />;
      })}
    </>
  );
};

/** The unsent half: secret ink coming up under warmth, one character at a time. Like the
 *  receipt under it, it sits flush with the bubble's right edge — by its last character's cell
 *  (v4.1; v4.0 put the ink of 辕 on the edge: a character aligns by its cell, only a mark by its ink). */
const Unsent: React.FC<{ f: number; right: number }> = ({ f, right }) => {
  const chars = [...UNSENT];
  const L = lineInk(chars, FS, chars.map((_, i) => (i ? 2 : 0)));
  const x0 = right - L.boxR;
  const baseline = GHOST_Y - (L.inkT + L.inkB) / 2;
  const fade = 1 - smooth(prog(f, R.p3 + 6, R.p3 + 36)); // answered: the fear lets go
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        {chars.map((ch, i) => {
          const at = R.ghost + i * 6;
          const t = prog(f, at, at + 22);
          return t > 0 && t < 1 ? <SeepFilter key={i} id={`un${i}`} p={t} size={FS} seed={hashStr("un" + i) % 997} soft={4} /> : null;
        })}
      </svg>
      {chars.map((ch, i) => {
        const at = R.ghost + i * 6;
        if (f < at) return null;
        const t = prog(f, at, at + 22);
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: x0 + L.xs[i],
              top: spanTop(baseline, FS),
              fontFamily: HW,
              fontSize: FS,
              lineHeight: 0,
              whiteSpace: "pre",
              color: "rgba(168,52,44,0.5)",
              filter: t < 1 ? `url(#un${i})` : undefined,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

export const Reply: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame() + from;
  const land = easeOutBack(prog(f, R.bubble - 2, R.bubble + 10), 1.4);
  const dong = f >= R.dong ? prog(f, R.dong, R.dong + 8) : 0;
  // close on his message for the unsent half and the receipt, then back to the history's scale
  const close = 1 - easeInOutCubic(prog(f, R.dong + 6, R.bubble + 8));
  const zc = lerp(CHAT_S, CLOSE, close);
  const tx = lerp(ORIGIN.x * (1 - CHAT_S), 960 - FOCUS.x * CLOSE, close);
  const ty = lerp(ORIGIN.y * (1 - CHAT_S), 520 - FOCUS.y * CLOSE, close);
  // recede into his window of the city: the sheet rides the city camera exactly
  const rect = heroRect(f);
  const sc = rect.w / 1920;
  const warm = smooth(prog(sc, 0.32, 0.075)); // the paper takes on the lamp light as it becomes a window
  const gone = smooth(prog(f, R.end - 15, R.end - 3));
  // the same bubble as in the history: padding measured from the line's edges (its first and last
  // characters' cells: lib/ink)
  const sentL = lineInk([...SENT], FS, [...SENT].map(() => 0));
  const sentW = sentL.boxR - sentL.boxL + SENT_PAD * 2;
  const sentX = COL_R - sentW;
  const { lines, BH } = replyLines();
  const hx = stopAt(lines[2]).cx + HANG_DX; // the column the peach hangs over (sheet px)
  const tw = twigState(f, hx);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "960px 540px",
          transform: `translate(${rect.x - 960}px, ${rect.y - 540}px) scale(${sc})`,
          opacity: 1 - gone,
          background: "#efeee9",
          overflow: "hidden",
          boxShadow: warm > 0 ? `0 0 ${(36 * warm) / Math.max(sc, 0.05)}px rgba(255,176,96,${0.32 * warm})` : undefined,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${zc})` }}>
          <div
            style={{
              position: "absolute",
              left: 380,
              width: 1160,
              top: -200,
              height: 1480,
              background: "repeating-linear-gradient(90deg, rgba(192,48,44,0) 0px, rgba(192,48,44,0) 118px, rgba(192,48,44,0.13) 118px, rgba(192,48,44,0.13) 120px)",
              borderLeft: "3px solid rgba(192,48,44,0.22)",
              borderRight: "3px solid rgba(192,48,44,0.22)",
            }}
          />
          <div style={{ position: "absolute", left: 0, width: 1920, top: 146, textAlign: "center", fontFamily: SERIF, fontSize: 27, letterSpacing: "0.2em", color: "rgba(40,38,40,0.5)", transform: `translateX(${inkShift("5月21日 00:00", 27, SERIF, 0.2 * 27)}px)` }}>
            5月21日 00:00
          </div>
          {/* the line he sent at 23:57 — set as in the history: each character on the axis of its cell
              (lib/ink), the line's ink centred in the bubble's height (v4.1: v4.0 set it as plain text,
              each glyph where the font puts it in its advance, the line box centred) */}
          <div
            style={{
              position: "absolute",
              left: sentX,
              top: BUBBLE_TOP,
              width: sentW,
              height: BUBBLE_H,
              borderRadius: "24px 24px 6px 24px",
              background: "linear-gradient(160deg, #d74139 0%, #c0302c 60%, #a92927 100%)",
              boxShadow: "0 6px 18px rgba(120,30,26,0.25)",
            }}
          />
          {[...SENT].map((ch, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: sentX + SENT_PAD - sentL.boxL + sentL.xs[i],
                top: spanTop(BUBBLE_TOP + BUBBLE_H / 2 - (sentL.inkT + sentL.inkB) / 2, FS),
                fontFamily: HW,
                fontSize: FS,
                lineHeight: 0,
                whiteSpace: "pre",
                color: "#f7efe5",
              }}
            >
              {ch}
            </span>
          ))}
          {/* the half he did not send */}
          <Unsent f={f} right={COL_R} />
          {/* receipt: 已读 → 已读懂 */}
          <div style={{ position: "absolute", left: sentX, width: sentW, top: RECEIPT_Y - 16, display: "flex", justifyContent: "flex-end", alignItems: "center", fontFamily: SERIF, fontSize: 27, color: "rgba(40,38,40,0.55)" }}>
            {/* v4.1: by the last character's cell, as every line: 读's cell on the edge (its trailing letter-space
                taken off) until 懂 comes, then 懂's cell (v4.0 put 懂's ink on the edge) */}
            <span style={{ letterSpacing: "0.18em", marginRight: f >= R.dong ? 0 : -0.18 * 27 }}>已读</span>
            {f >= R.dong && (
              <>
                <svg width={0} height={0} style={{ position: "absolute" }}>
                  {dong < 1 && <SeepFilter id="dongseep" p={dong} size={27} seed={33} soft={6} />}
                </svg>
                <span
                  style={{
                    display: "inline-block",
                    color: COLORS.vermilion,
                    fontWeight: 600,
                    transform: `scale(${lerp(1.5, 1, easeOutBack(dong, 2))})`,
                    filter: dong < 1 ? "url(#dongseep)" : undefined,
                  }}
                >
                  懂
                </span>
              </>
            )}
          </div>
          {/* her reply */}
          <div
            style={{
              position: "absolute",
              left: BX,
              top: BY,
              width: BW,
              height: BH,
              borderRadius: `${34 * K}px ${34 * K}px ${34 * K}px ${8 * K}px`,
              background: "#fdfcf9",
              boxShadow: `0 ${18 * K}px ${50 * K}px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.05)`,
              transformOrigin: "0% 100%",
              transform: `translateY(${(1 - land) * 60 * K}px) scale(${lerp(0.7, 1, land)})`,
              opacity: clamp(land * 2),
            }}
          />
          {/* the branch of the peach tree beyond the frame */}
          <PeachSprig f={f} tw={tw} />
          {f >= R.bubble && lines.map((l, i) => <PoemLine key={i} line={l} frame={f} />)}
          <PeachFall f={f} line={lines[2]} tw={tw} hx={hx} />
          <PeachStop f={f} line={lines[2]} />
          <Petals f={f} />
        </div>
        {warm > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.94 * warm,
              background: "radial-gradient(ellipse 70% 75% at 50% 45%, #fff3dc 0%, #ffd9a2 55%, #f3ad62 100%)",
            }}
          />
        )}
      </div>
      {/* the white-out from the southern window clears onto the paper */}
      <div style={{ position: "absolute", inset: 0, background: "#fffaf2", opacity: 1 - smooth(prog(f, R.land, R.land + 10)) }} />
    </div>
  );
};
