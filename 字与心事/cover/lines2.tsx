// 封面 · v5.0 草图 (2026-10-23). The user on 「涟漪」: "这个封面并没有惊艳感，只是处于能用的范畴" — think the
// cover again; the 4:3 is still derived from the 3:4. Two new pictures in the same system (《文案撰写指南》
// B 章: one picture drawn in hairlines, the title drawn by the same lines, the type where the series puts it):
//   yixian  一线: a field of level hairlines (silk, water) and one vermilion thread across the lower part of
//           the picture, sagging a little in the middle; the thread has been plucked and its trembling runs
//           out through the hairlines on both sides — they crowd into bright bands and spread into dark
//           ones, fainter the farther they are — so by the type the lines lie level and even of themselves
//           (no calming round the type). 4:3: the same thread, flatter, across the wider picture.
//   yue     月: the moon drawn in rings round its own centre — packed close inside the disc (bright), a
//           little closer than the water's just outside it (its light), even beyond; the lines warm on the
//           south (left) half and cold on the north (right) half, the two halves of 子正's moon. The darker
//           patches of its face are the same rings drawn finer.
// Both are drawn as the ripple is (lines.tsx): every pixel's distance to the nearest line from a field
// whose integer values are the lines; inside the title the same lines run on as dark hairlines.
import React, { useState } from "react";
import { COLORS, HW } from "../src/lib/util";
import { CW, CH, TITLE, SUB, T, setLine, DPR, url } from "./kit";

const params = new URLSearchParams(location.search);
const num = (k: string, d: number) => Number(params.get(k) ?? d);
const WIDE = CW > CH;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
// smooth value noise (for the moon's face)
const hash = (i: number, j: number) => {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x: number, y: number) => {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};
const fbm = (x: number, y: number) => 0.55 * vnoise(x, y) + 0.3 * vnoise(2.03 * x + 17, 2.03 * y + 5) + 0.15 * vnoise(4.1 * x + 3, 4.1 * y + 29);

type Field = {
  u: (X: number, Y: number) => number; // integer values are the lines
  bg: (X: number, Y: number) => number[]; // the night under the lines
  line: (X: number, Y: number) => { a: number; w: number; c: number[] }; // the line's strength, half-width, colour
  after?: (ctx: CanvasRenderingContext2D) => void; // the focus, drawn over
};

function fieldLayer(F: Field) {
  const W = CW * DPR, H = CH * DPR;
  const t = setLine(TITLE, T.size, T.track, T.inkTop, () => "#fff");
  const mask = (pick: (i: number) => boolean) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d")!;
    x.filter = "blur(1.6px)";
    x.scale(DPR, DPR);
    x.fillStyle = "#fff";
    x.font = `${T.size}px ${HW}`;
    x.textBaseline = "alphabetic";
    t.glyphs.forEach((g, i) => pick(i) && x.fillText(g.ch, g.left, t.baseline));
    return x.getImageData(0, 0, W, H).data;
  };
  const A = mask(() => true);
  const R = mask((i) => i >= 2);
  const img = new ImageData(W, H);
  const d = img.data;
  const moon = [230, 236, 239], red = [226, 73, 63];
  const e = 0.05;
  for (let y = 0; y < H; y++) {
    const Y = (y + 0.5) / DPR;
    for (let x = 0; x < W; x++) {
      const X = (x + 0.5) / DPR;
      const k = (y * W + x) * 4;
      const u = F.u(X, Y);
      const gx = (F.u(X + e, Y) - F.u(X - e, Y)) / (2 * e), gy = (F.u(X, Y + e) - F.u(X, Y - e)) / (2 * e);
      const dist = Math.abs(u - Math.round(u)) / Math.max(1e-6, Math.sqrt(gx * gx + gy * gy));
      const cover = (h: number) => {
        const c = (h - dist) * DPR + 0.5;
        return c < 0 ? 0 : c > 1 ? 1 : c;
      };
      const L = F.line(X, Y);
      const bg = F.bg(X, Y);
      const mk = A[k + 3] / 255;
      const outside = cover(L.w) * L.a;
      const inside = 1 - cover(0.5);
      const rf = A[k + 3] > 0 ? R[k + 3] / A[k + 3] : 0;
      const letter = mix(moon, red, rf);
      // outside: the line's own colour over the night; inside: the letter, crossed by the same line, dark
      const c0 = bg[0] + (L.c[0] - bg[0]) * outside, c1 = bg[1] + (L.c[1] - bg[1]) * outside, c2 = bg[2] + (L.c[2] - bg[2]) * outside;
      d[k] = c0 + (bg[0] + (letter[0] - bg[0]) * inside - c0) * mk;
      d[k + 1] = c1 + (bg[1] + (letter[1] - bg[1]) * inside - c1) * mk;
      d[k + 2] = c2 + (bg[2] + (letter[2] - bg[2]) * inside - c2) * mk;
      d[k + 3] = 255;
    }
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.putImageData(img, 0, 0);
  ctx.scale(DPR, DPR);
  F.after?.(ctx);
  return { bg: url(c), t };
}

const NEAR = [22, 31, 52], FAR = [8, 11, 19];

// ---------------------------------------------------------------------------------------------------- 一线
const TH = {
  cx: CW / 2,
  yLow: num("ylow", WIDE ? 830 : 1060), // the thread's lowest point, on the centre line
  R: num("R", WIDE ? 5200 : 2200), // how much it sags: y rises by (x − cx)² / 2R towards the edges
  s: 5, // the level lines, 5 px apart
  lam0: 22, lamK: 0.11, // the trembling's wavelength, longer farther out
  depth: 0.72, // how far a line moves: crowding and spreading by up to 72 %
  L: num("L", WIDE ? 120 : 170), // how fast it dies away
};
const yT = (X: number) => TH.yLow - ((X - TH.cx) * (X - TH.cx)) / (2 * TH.R);
const thN = (X: number, Y: number) => {
  const sl = -(X - TH.cx) / TH.R;
  return (Y - yT(X)) / Math.sqrt(1 + sl * sl);
};
const thPhase = (a: number) => ((2 * Math.PI) / TH.lamK) * Math.log(1 + (TH.lamK * a) / TH.lam0);
const thAmp = (a: number) => Math.exp(-a / TH.L);
const yixian: Field = {
  u: (X, Y) => {
    const n = thN(X, Y), a = Math.abs(n);
    return (Y + Math.sign(n) * ((TH.depth * (TH.lam0 + TH.lamK * a)) / (2 * Math.PI)) * thAmp(a) * Math.sin(thPhase(a))) / TH.s;
  },
  bg: (X, Y) => {
    const a = Math.abs(thN(X, Y));
    return mix(NEAR, FAR, Math.pow(Math.min(1, a / 900), 0.8));
  },
  line: (X, Y) => {
    const a = Math.abs(thN(X, Y));
    const glint = 0.5 * thAmp(a) * Math.max(0, Math.cos(thPhase(a)));
    const rf = 0.4 * Math.exp(-a / 60);
    return { a: 0.3 * (0.55 + glint + 0.45 * Math.exp(-a / 500)), w: 0.36, c: mix([230, 236, 239], [226, 73, 63], rf) };
  },
  after: (ctx) => {
    ctx.strokeStyle = COLORS.vermilionHot;
    ctx.lineWidth = num("tw", 2.6);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let X = -20; X <= CW + 20; X += 2) (X === -20 ? ctx.moveTo(X, yT(X)) : ctx.lineTo(X, yT(X)));
    ctx.stroke();
  },
};

// ---------------------------------------------------------------------------------------------------- 月
const MO = {
  cx: CW / 2,
  cy: num("mcy", WIDE ? 800 : 980),
  Rm: num("rm", WIDE ? 160 : 200), // the disc
  s: 5, sIn: 2.2, // the water's rings 5 px apart; inside the disc 2.2
  sH: 3.3, H: num("halo", WIDE ? 90 : 140), // just outside, the light: 3.6 px at the rim, back to 5 over ~H
};
// the ring index: ∫ density dr, density 1/sIn inside, 1/s far out, the light's extra just outside
const moU = (r: number) => {
  const { Rm, s, sIn, sH, H } = MO;
  const e = 3; // the rim eased over ±3 px
  // ∫0^r (1 − smoothstep(Rm − e, Rm + e, ρ)) dρ
  let inner: number;
  if (r <= Rm - e) inner = r;
  else if (r >= Rm + e) inner = Rm;
  else {
    const tt = (r - (Rm - e)) / (2 * e);
    inner = Rm - e + 2 * e * (tt - tt * tt * tt + (tt * tt * tt * tt) / 2);
  }
  const halo = r > Rm ? H * (1 - Math.exp(-(r - Rm) / H)) : 0;
  return r / s + (1 / sIn - 1 / s) * inner + (1 / sH - 1 / s) * halo;
};
const WARM = [246, 226, 200], COLD = [214, 228, 247];
const yue: Field = {
  u: (X, Y) => moU(Math.hypot(X - MO.cx, Y - MO.cy)),
  bg: (X, Y) => {
    const r = Math.hypot(X - MO.cx, Y - MO.cy);
    return mix([26, 34, 56], FAR, Math.pow(Math.min(1, Math.max(0, r - MO.Rm) / 1000), 0.7));
  },
  line: (X, Y) => {
    const r = Math.hypot(X - MO.cx, Y - MO.cy);
    const inDisc = 1 - smooth(MO.Rm - 3, MO.Rm + 3, r);
    // the face: the same rings drawn finer where the noise is low (its seas)
    const face = 0.65 * vnoise((X - MO.cx) / 85 + 7.3, (Y - MO.cy) / 85 + 1.9) + 0.35 * vnoise((X - MO.cx) / 40 + 3.1, (Y - MO.cy) / 40 + 8.4);
    const sea = smooth(0.3, 0.7, face);
    const wIn = 0.62 + 0.4 * sea;
    const light = r > MO.Rm ? Math.exp(-(r - MO.Rm) / (MO.H * 1.6)) : 1;
    const a = inDisc * (0.72 + 0.22 * sea) + (1 - inDisc) * 0.3 * (0.55 + 0.6 * light + 0.45 * Math.exp(-r / 600));
    const w = inDisc * wIn + (1 - inDisc) * 0.36;
    const c = mix(WARM, COLD, smooth(MO.cx - 1.2 * MO.Rm, MO.cx + 1.2 * MO.Rm, X));
    return { a: Math.min(1, a), w, c };
  },
};

// ---------------------------------------------------------------------------------------------------- 山南海北
// 一线 山南 海北 (the film's first poem line, 9–11 s): the night drawn as an engraver hatches a sky — level
// hairlines, 6 px apart, top to bottom. Below the horizon the same lines rise over the land: mountains on
// the left (south, his), the sea on the right (north, hers), each line hiding the ones behind it where it
// rises in front of them (drawn from the far line to the near, each filling the ground under itself
// first). On the highest peak a beacon (烽燧), and from it the vermilion thread runs over the sea to the
// far north at the horizon. The title in the sky is drawn by the sky's own lines.
// The 4:3 is the same land and sea seen through a wider, shorter window: everything is placed from the
// centre line and the horizon in px, as the 3:4 has it (positions across in units of the 3:4's width,
// 1080, from its left edge), so the 4:3 shows more of the land to the left and of the sea to the right
// and less of the near ground; the mountains are as high, the peak and the beacon where they are in the
// 3:4 relative to the type. (A first 4:3 lowered the mountains to 230 px and the horizon to 650 to fit
// the shorter picture: the lines hardly rose and lay nearly even — the user: "为什么竖版你的线是错落有致的，
// 但是切换到横版就变得是差不多的间距了")
const RL = {
  sp: 6, // the lines' spacing
  yH: num("yh", 720), // the horizon
  depth: 720, // from the horizon to the 3:4's bottom edge: the land's depth (z 0 … 1)
  mtn: num("mtn", 430), // the mountains' height (px at their highest)
  peak: num("peak", 0.33), // where the highest of them stands (× 1080 from the 3:4's left edge)
  seaA: num("sea", 5), // the swell on the sea
  split: num("split", 0.56), // where the land gives way to the sea (× 1080)
};
const X34 = (X: number) => X - CW / 2 + 540; // a 4:3 x in the 3:4's coordinates
const ridged = (x: number, y: number) => {
  let s = 0, a = 0.55, f = 1;
  for (let o = 0; o < 4; o++) {
    const n = 1 - Math.abs(2 * vnoise(x * f + o * 13.1, y * f + o * 7.7) - 1);
    s += a * n * n;
    a *= 0.5;
    f *= 2.1;
  }
  return s;
};
function ridgeHeight(X: number, k: number, nLines: number) {
  const y0 = RL.sp * (k + 0.5);
  if (y0 < RL.yH) return 0;
  const z = (y0 - RL.yH) / RL.depth; // 0 at the horizon, 1 at the 3:4's bottom edge
  const xa = X34(X), xn = xa / 1080;
  const land = 1 - smooth(RL.split - 0.12, RL.split + 0.06, xn + 0.05 * Math.sin(z * 7));
  // the ranges: highest a little way in from the horizon, lower towards us; and from the middle distance
  // to our feet the foothills, broader and lower, so that the land runs on to the bottom edge (the first
  // 3:4 left the near ground level from y 1170 down: neither land nor sea — the user, 2026-10-23: "不太清楚
  // 左下角这一块是想表达什么")
  const range = Math.pow(Math.sin(Math.PI * Math.min(1, z * 1.6)), 1.3) * (0.55 + 0.45 * (1 - z));
  const foot = 0.3 * smooth(0.35, 0.8, z);
  const bump = Math.exp(-Math.pow((xn - RL.peak) / 0.22, 2));
  const m = (ridged(xa / 230, z * 4.2) * range * (0.35 + 0.65 * bump) + ridged(xa / 420 + 3.7, z * 2.1 + 5.3) * foot * (0.7 + 0.3 * bump)) * RL.mtn * land;
  const sea = (1 - land) * RL.seaA * (0.3 + z) * (0.6 * Math.sin(xa / 23 + z * 41) + 0.4 * Math.sin(xa / 9.5 - z * 77));
  return m + sea;
}
function ridgeLayer() {
  const W = CW * DPR, H = CH * DPR;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.scale(DPR, DPR);
  const g = ctx.createLinearGradient(0, 0, 0, RL.yH + RL.depth);
  g.addColorStop(0, "rgb(8,11,19)");
  g.addColorStop(RL.yH / (RL.yH + RL.depth), "rgb(20,28,48)");
  g.addColorStop(1, "rgb(9,12,21)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
  // (lines whose rest is below the bottom edge still rise into the picture over the near hills)
  const n = Math.ceil((CH + 0.35 * RL.mtn) / RL.sp);
  let beacon = { x: 0, y: CH };
  const step = 1.5;
  for (let k = 0; k < n; k++) {
    const pts: [number, number][] = [];
    for (let X = -4; X <= CW + 4; X += step) {
      const y = RL.sp * (k + 0.5) - ridgeHeight(X, k, n);
      pts.push([X, y]);
      if (RL.sp * (k + 0.5) > RL.yH && y < beacon.y && X34(X) > 60 && X34(X) < 1080 * RL.split - 60) beacon = { x: X, y };
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineTo(CW + 4, CH + 4);
    ctx.lineTo(-4, CH + 4);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    const y0 = RL.sp * (k + 0.5);
    const near = y0 < RL.yH ? 0 : Math.min(1, (y0 - RL.yH) / RL.depth);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    // (the land's lines a little stronger than the sky's, so the mountains read at card size)
    ctx.strokeStyle = `rgba(230,236,239,${(y0 < RL.yH ? 0.2 + 0.1 * (y0 / RL.yH) : 0.42 + 0.36 * near).toFixed(3)})`;
    ctx.lineWidth = y0 < RL.yH ? 0.75 : 0.85;
    ctx.stroke();
  }
  // the thread: from the beacon over the sea to the far north, hanging a little
  const end = { x: CW - 65, y: RL.yH - 1 };
  ctx.strokeStyle = COLORS.vermilionHot;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const x = beacon.x + (end.x - beacon.x) * t, y = beacon.y + (end.y - beacon.y) * t + 38 * Math.sin(Math.PI * t);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.vermilionHot;
  ctx.beginPath();
  ctx.arc(beacon.x, beacon.y - 3, 6, 0, Math.PI * 2);
  ctx.fill();
  // the title: lit, crossed by the sky's own lines
  const t = setLine(TITLE, T.size, T.track, T.inkTop, () => "#fff");
  const tc = document.createElement("canvas");
  tc.width = W;
  tc.height = H;
  const x = tc.getContext("2d")!;
  x.scale(DPR, DPR);
  x.font = `${T.size}px ${HW}`;
  x.textBaseline = "alphabetic";
  t.glyphs.forEach((gl, i) => {
    x.fillStyle = i >= 2 ? COLORS.vermilionHot : "#E6ECEF";
    x.fillText(gl.ch, gl.left, t.baseline);
  });
  x.globalCompositeOperation = "source-atop";
  x.fillStyle = "rgb(10,14,24)";
  for (let k = 0; k < n; k++) {
    const y0 = RL.sp * (k + 0.5);
    if (y0 > T.inkTop - 20 && y0 < t.inkBottom + 20) x.fillRect(0, y0 - 0.5, CW, 1);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tc, 0, 0);
  return { bg: url(c), t };
}
const RidgeScene: React.FC = () => {
  const [L] = useState(ridgeLayer);
  const s = setLine(SUB, T.sSize, T.sTrack, L.t.inkBottom + T.gap, () => "#dfe6ea");
  (window as any).__type = { title: { inkTop: L.t.inkTop, inkBottom: L.t.inkBottom, inkL: L.t.inkL, inkR: L.t.inkR }, sub: { inkTop: s.inkTop, inkBottom: s.inkBottom, inkL: s.inkL, inkR: s.inkR } };
  return (
    <>
      <img src={L.bg} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      {s.glyphs.map((g, i) => (
        <span key={i} style={{ position: "absolute", left: g.left, top: g.top, fontFamily: HW, fontSize: g.size, lineHeight: 0, whiteSpace: "pre", color: g.color }}>
          {g.ch}
        </span>
      ))}
    </>
  );
};

function sceneOf(F: Field): React.FC {
  return () => {
    const [L] = useState(() => fieldLayer(F));
    const s = setLine(SUB, T.sSize, T.sTrack, L.t.inkBottom + T.gap, () => "#dfe6ea");
    (window as any).__type = { title: { inkTop: L.t.inkTop, inkBottom: L.t.inkBottom, inkL: L.t.inkL, inkR: L.t.inkR }, sub: { inkTop: s.inkTop, inkBottom: s.inkBottom, inkL: s.inkL, inkR: s.inkR } };
    return (
      <>
        <img src={L.bg} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
        {s.glyphs.map((g, i) => (
          <span key={i} style={{ position: "absolute", left: g.left, top: g.top, fontFamily: HW, fontSize: g.size, lineHeight: 0, whiteSpace: "pre", color: g.color }}>
            {g.ch}
          </span>
        ))}
      </>
    );
  };
}
export const LINE2_SCENES: Record<string, React.FC> = { yixian: sceneOf(yixian), yue: sceneOf(yue), shannan: RidgeScene };
