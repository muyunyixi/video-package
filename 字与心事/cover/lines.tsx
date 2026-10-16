// 封面 · 线 (2026-10-17). The user on the 漏声长 cover: "它看上去像一个新手制作的PS封面…完全用线条来拼"
// — glowing type laid over a picture. Here the title itself is the picture, drawn in lines and type
// from the film's own material:
//   gaozhi  字格: a sheet of red-ruled manuscript paper (方格稿纸), the title written into its cells;
//           the subtitle's 。 is 桃子's peach (Reply.tsx), the cursor waits at the next paragraph
//   ripple  涟漪: one drop on the night water (the 更漏's); its rings swell into the title where they
//           cross it
//   code    代码成字: the title cut from the film's own source — 字与 from lib/ink.ts (the code that
//           sets every character), 心事 from corpus.ts (her 35 poems)
import React, { useState } from "react";
import { paperCanvas } from "../src/lib/textures";
import { glyphInk, penInCell, spanTop } from "../src/lib/ink";
import { COLORS, HW } from "../src/lib/util";
import { CW, CH, TITLE, SUB, T, setLine, DPR, hiCanvas, url } from "./kit";
import { COL, fileRows, wrap, type Cls, type Row } from "./listing";

const MONO = '"Latin Modern Mono", monospace';
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const Span: React.FC<{ ch: string; left: number; base: number; size: number; color: string; font?: string }> = ({ ch, left, base, size, color, font = HW }) => (
  <span style={{ position: "absolute", left, top: spanTop(base, size, font), fontFamily: font, fontSize: size, lineHeight: 0, whiteSpace: "pre", color }}>{ch}</span>
);
const params = new URLSearchParams(location.search);

// =====================================================================================================
// 字格 · 稿纸
// The common sheet: 20 cells to a row, each row of cells followed by a blank strip, the whole in a frame
// of a heavy and a thin rule (文武线). The title is written one character to a block of 5 × 5 cells, the
// subtitle one to 2 × 2, so that every block's edges are the sheet's own rules: the four title blocks and
// the ten subtitle blocks each fill the row. Every character's ink on its block's axis (网格排); each line
// on one baseline, its line of ink centred in its row.
// =====================================================================================================
const GZ = (() => {
  const cols = 20, m = 44; // 44 px a cell: at the shot's pixel ratio every rule falls on whole pixels
  const x0 = (CW - cols * m) / 2, x1 = x0 + cols * m; // 100 … 980
  const gap = 15; // the blank strip under a row: about a third of a cell
  const tH = 5 * m, sH = 2 * m;
  const tg = [...TITLE].map((ch) => glyphInk(ch, T.size));
  const tInkT = Math.min(...tg.map((g) => g.t)), tInkB = Math.max(...tg.map((g) => g.b));
  // the title's row placed so its ink top is where the series puts the title's (8.3: y 170)
  const tTop = Math.round(T.inkTop + (tInkB - tInkT) / 2 - tH / 2);
  const sTop = tTop + tH + gap, bTop = sTop + sH + gap;
  const rows = 14;
  return { cols, m, x0, x1, gap, tH, sH, tTop, sTop, bTop, rows, fTop: tTop - gap, fBot: bTop + rows * (m + gap) };
})();
const GZ_RULE = params.get("rule") ?? "rgba(190,58,42,0.5)";
const GZ_FRAME = params.get("frame") ?? "rgba(190,58,42,0.72)";

function gaozhiRules() {
  const { c, ctx } = hiCanvas();
  const { m, x0, x1, gap, tH, sH, tTop, sTop, bTop, rows, fTop, fBot } = GZ;
  // every thin rule in one path, stroked once (where two rules cross, the paper is inked once)
  ctx.beginPath();
  const band = (top: number, h: number, step: number) => {
    for (const y of [top, top + h]) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    for (let x = x0 + step; x < x1 - 1; x += step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + h);
    }
  };
  band(tTop, tH, 5 * m);
  band(sTop, sH, 2 * m);
  for (let k = 0; k < rows; k++) band(bTop + k * (m + gap), m, m);
  // the frame's thin rule: the cells' own outer edges, carried on past the blank strips
  ctx.moveTo(x0, fTop); ctx.lineTo(x1, fTop); ctx.lineTo(x1, fBot); ctx.lineTo(x0, fBot); ctx.closePath();
  ctx.lineCap = "square";
  ctx.lineWidth = 1;
  ctx.strokeStyle = GZ_RULE;
  ctx.stroke();
  // and its heavy rule, outside
  ctx.lineWidth = 3;
  ctx.strokeStyle = GZ_FRAME;
  ctx.strokeRect(x0 - 6, fTop - 6, x1 - x0 + 12, fBot - fTop + 12);
  return url(c);
}

// 桃子's full stop (scenes/Reply.tsx): the ripe peach as it lands in the 。's place, lying on its side;
// the light from the upper left
const PEACH_D =
  "M-0.4,-9.6 C1.6,-10.3 5.8,-10.5 8.6,-7.8 C11.2,-5.2 11.4,0.6 9.8,4.6 C9.0,7.6 7.6,9.6 6.4,10.6 C5.8,11.1 5.6,11.9 5.8,12.8 " +
  "C4.4,12.0 2.6,11.8 0.6,11.7 C-5.0,11.4 -9.4,8.0 -10.4,2.8 C-11.2,-1.8 -9.8,-6.4 -7.0,-8.6 C-4.8,-10.3 -2.0,-10.4 -0.4,-9.6 Z";
const RIPE = ["#fff3dc", "#f8c2a4", "#e3705f", "#b8463e"];
const Peach: React.FC<{ cx: number; cy: number; k: number; rot: number }> = ({ cx, cy, k, rot }) => (
  <>
    <div style={{ position: "absolute", left: cx - 9 * k, top: cy + 8.6 * k, width: 18 * k, height: 3.2 * k, borderRadius: "50%", background: "rgba(90,46,34,0.32)", filter: `blur(${1.2 * k}px)` }} />
    <svg width={30 * k} height={30 * k} viewBox="-15 -15 30 30" style={{ position: "absolute", left: cx - 15 * k, top: cy - 15 * k, overflow: "visible" }}>
      <defs>
        <radialGradient id="pg" gradientUnits="userSpaceOnUse" cx={-2.6} cy={-3.3} r={17.6} gradientTransform={`rotate(${-rot})`}>
          {[0, 0.32, 0.72, 1].map((o, i) => (
            <stop key={i} offset={o} stopColor={RIPE[i]} />
          ))}
        </radialGradient>
        <clipPath id="pc">
          <path d={PEACH_D} />
        </clipPath>
        <filter id="pf" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={0.55} />
        </filter>
      </defs>
      <g transform={`rotate(${rot})`}>
        <path d={PEACH_D} fill="url(#pg)" />
        <g clipPath="url(#pc)">
          <path d="M-0.1,-9.2 C3.4,-6 5.4,4 5.4,12.4" stroke="rgba(146,40,36,0.5)" strokeWidth={1.3} fill="none" strokeLinecap="round" filter="url(#pf)" />
          <path d="M1.2,-8.6 C4.6,-5.4 6.6,4 6.6,11.2" stroke="rgba(255,236,214,0.38)" strokeWidth={0.8} fill="none" strokeLinecap="round" filter="url(#pf)" />
          <ellipse cx={-0.3} cy={-9.9} rx={2.6} ry={1.4} fill="rgba(120,40,34,0.3)" filter="url(#pf)" />
        </g>
      </g>
    </svg>
  </>
);

// the sheet goes on with the film's lines in order (?body=empty: an empty sheet), one paragraph each (two cells' indent,
// 《字体处理规范》三 1–2: one character to a cell, on its axis), in a paler ink; the cursor waits
// before 掂, where the film's code coda leaves it
const SCRIPT = [
  "掂量情思敲字句，轻顿指尖",
  "一线山南海北。抵年年、红笺小字。",
  "雀跃更浓于忐忑，从前未好过今天。",
  "与君南北不同春。",
  "昔人多恨漏声长，只今无处听更漏。",
  "此夜心同明月在，照见卿卿，别后许多年。",
  "重逢且近，愿与故人，做新鲜事。",
  "击壤忽然成古史，人间灯火灿于星。",
  "从落笔到被读懂，方式一直在变，有些心事却一直相通。",
];
const BODY_SIZE = 34;
// a row never starts with a closing mark (避头尾): the character before it goes down with it, its cell
// left empty; and 心事 is never split between two rows
const NO_HEAD = /[，。、；：？！”’）》」』]/;
function scriptCells() {
  const out: { ch: string; row: number; col: number; red: boolean }[] = [];
  let row = 0;
  for (const line of SCRIPT) {
    const chars = [...line];
    const red = line.indexOf("心事");
    let col = 2;
    for (let i = 0; i < chars.length; i++) {
      const keep = (i + 1 < chars.length && NO_HEAD.test(chars[i + 1])) || (red >= 0 && i === red);
      // the cells this character needs on the row: itself, and whatever must not be parted from it
      if (col >= GZ.cols || (keep && col === GZ.cols - 1)) {
        row++;
        col = 0;
      }
      out.push({ ch: chars[i], row, col, red: red >= 0 && i >= red && i < red + 2 });
      col++;
    }
    row++;
  }
  return out;
}

const GaozhiScene: React.FC = () => {
  const [L] = useState(() => ({ paper: url(paperCanvas(CW * DPR, CH * DPR, { seed: 23, base: COLORS.paper, mottle: 0.25, fibers: 9000, speck: 2600 })), rules: gaozhiRules() }));
  const { m, x0, tTop, tH, sTop, sH, bTop, gap } = GZ;
  const body = params.get("body") === "empty" ? [] : scriptCells();
  // one baseline for every row of the sheet: the body's characters' ink centred in the row on average
  const bg = body.filter((c) => !/[，。、]/.test(c.ch)).map((c) => glyphInk(c.ch, BODY_SIZE));
  const bOff = bg.length ? -(bg.reduce((s, g) => s + g.t + g.b, 0) / bg.length) / 2 : 0;
  const line = (text: string, size: number) => {
    const gs = [...text].map((ch) => ({ ch, g: glyphInk(ch, size) }));
    return { gs, t: Math.min(...gs.map((x) => x.g.t)), b: Math.max(...gs.map((x) => x.g.b)) };
  };
  const tl = line(TITLE, T.size), sl = line(SUB, T.sSize);
  const tBase = tTop + tH / 2 - (tl.t + tl.b) / 2;
  const sBase = sTop + sH / 2 - (sl.t + sl.b) / 2;
  const stop = glyphInk("。", T.sSize);
  // the peach where the 。's ink would be: in the tenth block, on the line's baseline, a little larger
  // than the 。 (as in the film)
  const pk = (1.35 * (stop.r - stop.l)) / 21.8;
  const peach = { cx: x0 + 2 * m * 9 + m, cy: sBase + (stop.t + stop.b) / 2 };
  // the cursor: after the two-cell indent of the first paragraph, at the insertion point (its left edge on
  // it): the next paragraph of an empty sheet, or before 掂 on the written one
  const cur = { x: x0 + 2 * m, y: bTop + m / 2, w: 2.5, h: 0.7 * m };
  (window as any).__type = { title: { inkTop: tBase + tl.t, inkBottom: tBase + tl.b }, sub: { inkTop: sBase + sl.t, inkBottom: sBase + sl.b }, GZ };
  return (
    <>
      <img src={L.paper} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      <img src={L.rules} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      {tl.gs.map(({ ch, g }, i) => (
        <Span key={`t${i}`} ch={ch} left={x0 + 5 * m * i + 2.5 * m - (g.l + g.r) / 2} base={tBase} size={T.size} color={i >= 2 ? COLORS.vermilion : COLORS.ink} />
      ))}
      {sl.gs.map(({ ch, g }, j) => (
        <Span key={`s${j}`} ch={ch} left={x0 + 2 * m * j + m - (g.l + g.r) / 2} base={sBase} size={T.sSize} color={COLORS.inkSoft} />
      ))}
      {body.map((c, k) => {
        const g = glyphInk(c.ch, BODY_SIZE);
        return <Span key={`b${k}`} ch={c.ch} left={x0 + c.col * m + m / 2 - (g.l + g.r) / 2} base={bTop + c.row * (m + gap) + m / 2 + bOff} size={BODY_SIZE} color={c.red ? "rgba(192,48,44,0.8)" : "rgba(40,38,40,0.62)"} />;
      })}
      <Peach cx={peach.cx} cy={peach.cy} k={pk} rot={Number(params.get("rot") ?? 78)} />
      <div style={{ position: "absolute", left: cur.x, top: cur.y - cur.h / 2, width: cur.w, height: cur.h, background: COLORS.vermilion }} />
    </>
  );
};

// =====================================================================================================
// 涟漪 · one drop on the night water (chosen by the user, 2026-10-17)
// Rings of hairline from where the drop went in (on the axis, below the type), one every RP.s px. The
// title is lit where it stands and the rings run on through it as dark hairlines at the same radii, so
// every ring is one unbroken line across the letters: 字与 in 月白, 心事 in the HUD seal's vermilion
// (#E2493F). The drop: a vermilion point. The subtitle is plain type; no rule under it.
// =====================================================================================================
// the rings are hairlines everywhere. Round the drop they carry the ripple: crests from the drop out to
// its front, spaced wider as they go out (λ = lam0 + lamK·r: the longer waves run ahead), drawn by the
// hairlines themselves — they crowd together on a crest and spread apart in a trough, an engraver's
// way of shading — so nothing but lines makes the picture. Beyond the front the water is still and the
// lines evenly spaced, and the title's lines are never moved. The drop's vermilion tints the water round it.
// The whole ripple (the disc out to its front) stands in the band between the type and the bottom edge:
// its top 56 px under the subtitle's ink (y 510; the type is the same in both covers), its bottom 50 px
// above the bottom edge, the drop at the band's middle on the axis. 3:4: 510–1390, front 440, drop at y
// 950. 4:3: 510–1030, front 260, drop at y 770 — the same ripple a moment earlier: the same hairlines
// 5 px apart and the same waves (λ, depth), its front not yet so far out; the line weights never scaled.
// (The first 4:3, 2026-10-17, kept the 3:4's ripple at full size with the drop at y 910 and lost its
// lower half off the bottom edge; the user: "为什么不完整的显示那个圆圈波纹？你完全可以上移啊")
const RZ = { top: 510, bottom: CH - 50 };
const RP = {
  cx: CW / 2, cy: Number(params.get("cy") ?? (RZ.top + RZ.bottom) / 2), s: Number(params.get("s") ?? 5), hOut: 0.36, aOut: Number(params.get("aout") ?? 0.3),
  lam0: 20, lamK: 0.11, front: Number(params.get("front") ?? (RZ.bottom - RZ.top) / 2), depth: 0.72, r0: 14, dot: 6.5, soft: 1.6,
  tl: params.get("tl") ?? "inv", hDark: Number(params.get("hdark") ?? 0.5), hSwell: Number(params.get("hswell") ?? 1.0), fill: Number(params.get("fill") ?? 0.38),
};
const rpPhase = (r: number) => ((2 * Math.PI) / RP.lamK) * Math.log(1 + (RP.lamK * r) / RP.lam0);
const rpAmp = (r: number) => smooth(RP.r0, RP.r0 + 60, r) * (1 - smooth(RP.front - 90, RP.front, r));
// the ring index at radius r: integer values are the lines
const rpU = (r: number) => (r + ((RP.depth * (RP.lam0 + RP.lamK * r)) / (2 * Math.PI)) * rpAmp(r) * Math.sin(rpPhase(r))) / RP.s;
function rippleLayer() {
  const W = CW * DPR, H = CH * DPR;
  const t = setLine(TITLE, T.size, T.track, T.inkTop, () => "#fff");
  const mask = (pick: (i: number) => boolean) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d")!;
    x.filter = `blur(${RP.soft}px)`; // device px: the swelling eases in over about a pixel
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
  const near = [22, 31, 52], far = [8, 11, 19];
  const moon = [230, 236, 239], red = [226, 73, 63]; // COLORS.moon, COLORS.vermilionHot
  for (let y = 0; y < H; y++) {
    const py = (y + 0.5) / DPR - RP.cy;
    for (let x = 0; x < W; x++) {
      const px = (x + 0.5) / DPR - RP.cx;
      const r = Math.sqrt(px * px + py * py);
      const k = (y * W + x) * 4;
      // the water: a little lighter round the drop
      const tb = Math.pow(Math.min(1, r / 1250), 0.8);
      const bg0 = near[0] + (far[0] - near[0]) * tb, bg1 = near[1] + (far[1] - near[1]) * tb, bg2 = near[2] + (far[2] - near[2]) * tb;
      // the nearest ring: its distance in px, from the ring index and how fast it changes here
      const u = r < RP.front ? rpU(r) : r / RP.s;
      const du = r < RP.front ? (rpU(r + 0.05) - rpU(r - 0.05)) / 0.1 : 1 / RP.s;
      const dist = Math.abs(u - Math.round(u)) / du;
      // the masks' coverage is their alpha (getImageData is unpremultiplied: the colour channels of white
      // text read 255 wherever any of the blur reaches, which swelled the letters 2.2 px on every side)
      const mk = A[k + 3] / 255;
      const cover = (h: number) => {
        const c = (h - dist) * DPR + 0.5;
        return c < 0 ? 0 : c > 1 ? 1 : c;
      };
      // a crest catches a little more light
      const glint = r < RP.front ? 0.5 * rpAmp(r) * Math.max(0, Math.sin(rpPhase(r) + Math.PI / 2)) : 0;
      const env = 0.55 + glint + 0.45 * Math.exp(-r / 600);
      const outside = cover(RP.hOut) * smooth(RP.r0, RP.r0 + 3 * RP.s, r) * RP.aOut * env;
      // inside the title the rings keep their radii (the first sketch thickened them to 3.7 px of every
      // 5: the dark gaps left between them, half a spacing off the hairlines outside, read as the lines,
      // and the rings seemed to jump half a step at every letter's edge).
      //   inv:   the letter is light, and the rings run on through it as dark hairlines;
      //   swell: the rings swell to RP.hSwell and the letter between them is lit to RP.fill
      const inside = RP.tl === "swell" ? RP.fill + (1 - RP.fill) * cover(RP.hSwell) : 1 - cover(RP.hDark);
      const a = outside * (1 - mk) + inside * mk;
      const rf = A[k + 3] > 0 ? R[k + 3] / A[k + 3] : 0.32 * Math.exp(-r / 90);
      const c0 = moon[0] + (red[0] - moon[0]) * rf, c1 = moon[1] + (red[1] - moon[1]) * rf, c2 = moon[2] + (red[2] - moon[2]) * rf;
      d[k] = bg0 + (c0 - bg0) * a;
      d[k + 1] = bg1 + (c1 - bg1) * a;
      d[k + 2] = bg2 + (c2 - bg2) * a;
      d[k + 3] = 255;
    }
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.putImageData(img, 0, 0);
  ctx.scale(DPR, DPR);
  ctx.fillStyle = COLORS.vermilionHot;
  ctx.beginPath();
  ctx.arc(RP.cx, RP.cy, RP.dot, 0, Math.PI * 2);
  ctx.fill();
  return { bg: url(c), t };
}
const RippleScene: React.FC = () => {
  const [L] = useState(rippleLayer);
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

// =====================================================================================================
// 代码成字 · the title cut from the film's source
// The title as a block of four cells (字与 over 心事), each cell a column of the listing: the page is
// the film's own source in the coda's type (Latin Modern Mono, Chinese in 汇文明朝 two columns to a
// character), faint; inside the title the same lines are cut through the ink. Above the block's middle
// lib/ink.ts, the code that sets every character in the film; below it corpus.ts, her 35 poems.
// ?v=pos: the lines drawn in full colour inside the title instead, no ink.
// =====================================================================================================
const CD = (() => {
  const S = 410, tr = Math.round(S * T.track); // 46
  const P = S + tr; // the block's pitch, across and down: four cells in a square
  const x0 = CW / 2 - (2 * S + tr) / 2; // 107: the block's left edge
  const rows = ["字与", "心事"];
  const inkT = (s: string) => Math.min(...[...s].map((ch) => glyphInk(ch, S).t));
  const inkB = (s: string) => Math.max(...[...s].map((ch) => glyphInk(ch, S).b));
  const base = [T.inkTop - inkT(rows[0])]; // the first row's ink top where the series puts the title's
  base.push(base[0] + P);
  const glyphs = rows.flatMap((s, r) => [...s].map((ch, c) => ({ ch, x: x0 + c * P + penInCell(ch, S, glyphInk(ch, S), HW), base: base[r], red: r === 1 })));
  // the listing: each column one cell wide, 82 characters to it
  const ncol = 82, cw = S / ncol, fs = cw / 0.525, lh = 11;
  const yTop = 64, nRows = Math.floor((CH - 2 * yTop) / lh);
  const split = (base[0] + inkB(rows[0]) + base[1] + inkT(rows[1])) / 2; // between the two rows of the title
  const kSplit = Math.round((split - yTop) / lh);
  return { S, tr, P, x0, base, glyphs, ncol, cw, fs, lh, yTop, nRows, kSplit, inkBottom: base[1] + inkB(rows[1]) };
})();

function drawListing(ctx: CanvasRenderingContext2D, colour: (c: Cls) => string) {
  const { x0, P, ncol, cw, fs, lh, yTop, nRows, kSplit } = CD;
  const top = wrap(fileRows("lib/ink.ts"), ncol), bottom = wrap(fileRows("corpus.ts"), ncol);
  const sections: [Row[], number, number][] = [
    [top, 0, kSplit],
    [bottom, kSplit, nRows - kSplit],
  ];
  ctx.textBaseline = "alphabetic";
  for (const [rows, k0, n] of sections) {
    for (let col = 0; col < 2; col++) {
      for (let k = 0; k < n; k++) {
        const row = rows[col * n + k];
        if (!row) continue;
        const x = x0 + col * P;
        const base = yTop + (k0 + k + 0.5) * lh + 0.3 * fs;
        for (const run of row.runs) {
          ctx.fillStyle = colour(run.cls);
          if (run.cjk) {
            ctx.font = `${fs}px ${HW}`;
            [...run.text].forEach((ch, j) => ctx.fillText(ch, x + (run.col + 2 * j) * cw + penInCell(ch, 2 * cw, glyphInk(ch, fs), HW), base));
          } else {
            ctx.font = `${fs}px ${MONO}`;
            ctx.fillText(run.text, x + run.col * cw, base);
          }
        }
      }
    }
  }
}
function codeLayer(v: string) {
  const glyphPath = (ctx: CanvasRenderingContext2D, pick: (red: boolean) => boolean = () => true) => {
    ctx.font = `${CD.S}px ${HW}`;
    ctx.textBaseline = "alphabetic";
    CD.glyphs.forEach((g) => pick(g.red) && ctx.fillText(g.ch, g.x, g.base));
  };
  // the faint listing, outside the title
  const F = hiCanvas();
  F.ctx.globalAlpha = Number(params.get("faint") ?? 0.075);
  drawListing(F.ctx, (c) => COL[c]);
  F.ctx.globalAlpha = 1;
  F.ctx.globalCompositeOperation = "destination-out";
  F.ctx.fillStyle = "#000";
  glyphPath(F.ctx);
  // the title
  const G = hiCanvas();
  if (v === "pos") {
    drawListing(G.ctx, (c) => (c === "zh" ? COLORS.vermilion : c === "com" ? "#5d5a55" : COL[c]));
    G.ctx.globalCompositeOperation = "destination-in";
    G.ctx.fillStyle = "#000";
    glyphPath(G.ctx);
  } else {
    G.ctx.fillStyle = COLORS.ink;
    glyphPath(G.ctx, (red) => !red);
    G.ctx.fillStyle = COLORS.vermilion;
    glyphPath(G.ctx, (red) => red);
    G.ctx.globalCompositeOperation = "destination-out";
    drawListing(G.ctx, () => "#000");
  }
  const { c, ctx } = hiCanvas();
  ctx.drawImage(F.c, 0, 0, CW, CH);
  ctx.drawImage(G.c, 0, 0, CW, CH);
  return url(c);
}
const CodeScene: React.FC = () => {
  const v = params.get("v") ?? "neg";
  const [L] = useState(() => ({ paper: url(paperCanvas(CW * DPR, CH * DPR, { seed: 31, base: COLORS.paper, mottle: 0.25, fibers: 9000, speck: 2600 })), art: codeLayer(v) }));
  const s = setLine(SUB, T.sSize, T.sTrack, CD.inkBottom + T.gap, () => COLORS.inkSoft);
  const sw = s.inkR - s.inkL, rw = Math.round(sw * T.ruleW), ruleTop = s.inkBottom + T.ruleGap;
  (window as any).__type = { sub: { inkTop: s.inkTop, inkBottom: s.inkBottom, inkL: s.inkL, inkR: s.inkR }, CD: { base: CD.base, kSplit: CD.kSplit, nRows: CD.nRows, fs: CD.fs } };
  return (
    <>
      <img src={L.paper} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      <img src={L.art} style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH }} />
      {s.glyphs.map((g, i) => (
        <span key={i} style={{ position: "absolute", left: g.left, top: g.top, fontFamily: HW, fontSize: g.size, lineHeight: 0, whiteSpace: "pre", color: g.color }}>
          {g.ch}
        </span>
      ))}
      {params.get("rule") !== "0" && <div style={{ position: "absolute", left: CW / 2 - rw / 2, top: ruleTop, width: rw, height: T.ruleH, background: COLORS.vermilion }} />}
    </>
  );
};

export const LINE_SCENES: Record<string, React.FC> = { gaozhi: GaozhiScene, ripple: RippleScene, code: CodeScene };
