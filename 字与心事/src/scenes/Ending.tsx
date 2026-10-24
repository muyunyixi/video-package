// 片尾 · 从落笔到被读懂 (65–70.4 s) · 彩蛋 (70.3–72.3 s)
// Through the window, onto the reader's desk. The film's first line is now a
// slip pasted on the page, read top to bottom and sealed 懂; the theme soaks
// into the paper beside it. Then the page turns out to be the film's own
// source: the three lines settle into their string literals, and the listing
// rewinds to the first line of the film, the cursor waiting before 掂.
import React from "react";
import { useCurrentFrame } from "remotion";
import cues from "../cues.json";
import source from "../gen/source.json";
import * as THREE from "three";
import { FIRST_LINE, LOOP, loopCam, LOOP_STRIP, CURSOR_SEEN, TYPING_FOV } from "./typing";
import { SeepFilter, hashStr } from "../lib/seep";
import { glyphInk, lineInk, spanTop, fontBox, penInCell } from "../lib/ink";
import { paperCanvas } from "../lib/textures";
import { lanternLattice } from "../lib/lattice";
import { HW, SERIF, COLORS, clamp, prog, smooth, lerp, easeOutCubic, easeInOutCubic, easeOutBack } from "../lib/util";

const E = cues.ending;
const C = cues.code;
// 字回字盘: after the listing comes home, a second and a half more. v4.5: the page lets go of the room
// under it, and the first line lies down out of its string onto the opening's input strip, the cursor
// before it (LoopOut); then its characters go home into the type one by one, the last first, and the
// cursor waits at the strip's start: the frame after this one is the film's first. (The room is the
// typing scene, run up to frame −1: Video; the line's way home is there, scenes/typing, LOOP.)
const LP = cues.loop;

// ------------------------------------------------------------------ the page
// y: a line's ink centre; below: instead of y, its baseline this far under the line above's.
// v4.0: the two lines of the lead-in are 1.35 × their size apart, baseline to baseline (the line
// spacing of 《整体制作指南》; v3.1 had them 90 px apart, 1.55 ×). The conclusion, larger, stands
// apart after a pause — a designed break, 128 px from the line above as in v3.1 — and the block is
// centred where it was (first and last ink centres 404/622 → 410/616: the same middle, 513).
type ThemeLine = { text: string; at: number; y?: number; below?: number; size: number; color: string; red?: string };
const THEME: ThemeLine[] = [
  { text: "从落笔到被读懂，", at: E.l1, y: 410, size: 58, color: "#3a3836" },
  { text: "方式一直在变，", at: E.l2, below: 1.35 * 58, size: 58, color: "#3a3836" },
  { text: "有些心事却一直相通。", at: E.l3, y: 616, size: 84, color: COLORS.ink, red: "心事" },
];
const SIGN = "/muyun.";
const STEP = 3; // frames between glyphs
const SEEP = 14; // frames for one glyph to soak in

// the slip: the first line, set vertically on a pasted label
const SLIP = { x: 1580, y0: 300, size: 32, step: 41 };
const SEAL = { x: 1580, y: 800, size: 46 };
const PAGE_O = { x: 960, y: 520 }; // the slow push-in is centred on the theme

// moonlight through the window the camera came in by: the same 灯笼锦 lattice, cast across the desk
let latURL: string | null = null;
const latticeShade = () => {
  if (latURL) return latURL;
  const cv = document.createElement("canvas");
  cv.width = 2000;
  cv.height = 1160;
  const c = cv.getContext("2d")!;
  const S = "rgb(178,166,152)";
  c.fillStyle = S;
  c.fillRect(0, 0, 2000, 1160);
  // v5.1: the turn is the one that cancels the shear's 0.05 exactly, so the lattice's cross-bars lie
  // level, parallel to the lines of the theme (with -0.06 they rose 0.57° to the right: next to the
  // level text it read as a lattice set a little crooked, not as a slant); the uprights lean 8.5°,
  // the moonlight coming in from the side
  const place = () => {
    c.translate(940, 510);
    c.transform(1, 0.05, -0.2, 1, 0, 0);
    c.rotate(-Math.atan(0.05));
  };
  const w = 1380, h = 1240;
  c.save();
  place();
  c.globalCompositeOperation = "destination-out";
  c.filter = "blur(26px)";
  c.fillStyle = "#000";
  c.fillRect(-w / 2, -h / 2, w, h);
  c.restore();
  c.save();
  place();
  c.filter = "blur(9px)";
  c.fillStyle = "rgba(178,166,152,0.62)";
  lanternLattice(c, -w / 2, -h / 2, w, h, 30);
  c.restore();
  latURL = cv.toDataURL("image/png");
  return latURL;
};

let paperURL: string | null = null;
const paper = () => (paperURL ??= paperCanvas(1920, 1080, { base: "#ece7dd", seed: 41, mottle: 0.3, fibers: 4200, speck: 1400 }).toDataURL("image/jpeg", 0.93));

type Box = { ch: string; left: number; top: number; size: number; color: string; at: number; key: string };
let themeCache: Box[][] | null = null;
function themeBoxes(): Box[][] {
  if (themeCache) return themeCache;
  let above = 0; // the baseline of the line above
  themeCache = THEME.map((ln, j) => {
    const chars = [...ln.text];
    const tracking = Math.round(ln.size * 0.12);
    const L = lineInk(chars, ln.size, chars.map((_, i) => (i ? tracking : 0)));
    const x0 = 960 - (L.boxL + L.boxR) / 2; // cells on their axes, end marks trimmed (lib/ink)
    const baseline = ln.below !== undefined ? above + ln.below : ln.y! - (L.inkT + L.inkB) / 2;
    above = baseline;
    const r0 = ln.red ? ln.text.indexOf(ln.red) : -1;
    return chars.map((ch, i) => ({
      ch,
      left: x0 + L.xs[i],
      top: spanTop(baseline, ln.size),
      size: ln.size,
      color: r0 >= 0 && i >= r0 && i < r0 + ln.red!.length ? COLORS.vermilion : ln.color,
      at: ln.at + i * STEP,
      key: `t${j}_${i}`,
    }));
  });
  return themeCache;
}

/** One glyph that soaks into the page. */
const Soak: React.FC<{ f: number; b: Box; font?: string; extra?: React.CSSProperties }> = ({ f, b, font = HW, extra }) => {
  if (f < b.at) return null;
  const t = prog(f, b.at, b.at + SEEP);
  const id = `ek${hashStr(b.key)}`;
  return (
    <>
      {t < 1 && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <SeepFilter id={id} p={t} size={b.size} seed={hashStr(b.key) % 997} />
        </svg>
      )}
      <span
        style={{
          position: "absolute",
          left: b.left,
          top: b.top,
          fontFamily: font,
          fontSize: b.size,
          lineHeight: 0,
          whiteSpace: "pre",
          color: b.color,
          filter: t < 1 ? `url(#${id})` : undefined,
          ...extra,
        }}
      >
        {b.ch}
      </span>
    </>
  );
};

// ------------------------------------------------------------- the listing
const MONO = '"Latin Modern Mono"';
const FS = 34, LH = 52, X0 = 400, GUT_R = 358;
const BASE = 0.3 * FS; // baseline below the row centre
type Cls = "kw" | "str" | "zh" | "tpl" | "com" | "num" | "id" | "pun";
const COL: Record<Cls, string> = {
  kw: "#22325a",
  str: "#8e4e3e",
  zh: COLORS.vermilion, // v5.6: 朱砂 (was #b32d27)
  tpl: "#5c6480",
  com: "#8f8a81",
  num: "#7c4c1e",
  id: "#1f1e23",
  pun: "#4f4c52",
};
type Run = { text: string; col: number; cls: Cls; cjk: boolean };
type Row = { kind: "file" | "code" | "gap"; n: number; text: string; runs: Run[] };
const KW = new Set(
  "import from export const let var function return if else for of in new type interface as await async while break continue switch case default true false null undefined void typeof class extends this".split(" ")
);
const isCJK = (ch: string) => /[—·…　-〿㐀-鿿＀-￯“”]/.test(ch);
const width = (ch: string) => (isCJK(ch) ? 2 : 1);

/** Split a token into font runs (CJK in 汇文明朝, the rest typewriter). */
function pushRuns(out: Run[], text: string, col: number, cls: Cls) {
  let cur = "", cj = false, c0 = col;
  for (const ch of text) {
    const k = isCJK(ch);
    if (cur && k !== cj) {
      out.push({ text: cur, col: c0, cls, cjk: cj });
      c0 = col;
      cur = "";
    }
    if (!cur) {
      cj = k;
      c0 = col;
    }
    cur += ch;
    col += width(ch);
  }
  if (cur) out.push({ text: cur, col: c0, cls, cjk: cj });
  return col;
}

let rowsCache: Row[] | null = null;
function rows(): Row[] {
  if (rowsCache) return rowsCache;
  const out: Row[] = [];
  for (const file of source.files as { path: string; lines: string[] }[]) {
    out.push({ kind: "file", n: 0, text: file.path, runs: [] });
    let tpl = false, block = false;
    file.lines.forEach((line, li) => {
      const runs: Run[] = [];
      let col = 0, i = 0;
      const chars = [...line];
      const take = (j: number, cls: Cls) => {
        col = pushRuns(runs, chars.slice(i, j).join(""), col, cls);
        i = j;
      };
      while (i < chars.length) {
        const ch = chars[i];
        if (block) {
          let j = i;
          while (j < chars.length && !(chars[j] === "*" && chars[j + 1] === "/")) j++;
          if (j < chars.length) {
            j += 2;
            block = false;
          }
          take(j, "com");
        } else if (tpl) {
          let j = i;
          while (j < chars.length && chars[j] !== "`") j += chars[j] === "\\" ? 2 : 1;
          if (j < chars.length) {
            j++;
            tpl = false;
          }
          take(Math.min(j, chars.length), "tpl");
        } else if (ch === "/" && chars[i + 1] === "/") take(chars.length, "com");
        else if (ch === "/" && chars[i + 1] === "*") {
          block = true;
          take(i + 2, "com");
        } else if (ch === "`") {
          tpl = true;
          take(i + 1, "tpl");
        } else if (ch === '"' || ch === "'") {
          let j = i + 1;
          while (j < chars.length && chars[j] !== ch) j += chars[j] === "\\" ? 2 : 1;
          j = Math.min(j + 1, chars.length);
          const body = chars.slice(i, j);
          const zh = body.some(isCJK);
          if (zh) {
            // quotes in the muted string colour, the words in vermilion
            take(i + 1, "str");
            take(j - 1, "zh");
            take(j, "str");
          } else take(j, "str");
        } else if (/[A-Za-z_$]/.test(ch)) {
          let j = i;
          while (j < chars.length && /[\w$]/.test(chars[j])) j++;
          take(j, KW.has(chars.slice(i, j).join("")) ? "kw" : "id");
        } else if (/\d/.test(ch)) {
          let j = i;
          while (j < chars.length && /[\d._xa-fA-F]/.test(chars[j])) j++;
          take(j, "num");
        } else if (ch === " ") {
          let j = i;
          while (j < chars.length && chars[j] === " ") j++;
          col += j - i;
          i = j;
        } else take(i + 1, isCJK(ch) ? "zh" : "pun");
      }
      out.push({ kind: "code", n: li + 1, text: line, runs });
    });
    out.push({ kind: "gap", n: 0, text: "", runs: [] });
  }
  rowsCache = out;
  return out;
}

/** Column of the UTF-16 index `idx` within a line. */
const colOf = (line: string, idx: number) => [...line.slice(0, idx)].reduce((c, ch) => c + width(ch), 0);

let cwCache = 0;
const charW = () => {
  if (cwCache) return cwCache;
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = `${FS}px ${MONO}`;
  cwCache = ctx.measureText("0").width;
  return cwCache;
};

type Anchors = { themeRows: number[]; themeCols: number[]; firstRow: number; firstCol: number };
let anchorCache: Anchors | null = null;
function anchors(): Anchors {
  if (anchorCache) return anchorCache;
  const R = rows();
  const themeRows: number[] = [], themeCols: number[] = [];
  THEME.forEach((ln) => {
    const lit = `"${ln.text}"`;
    let r = R.length - 1;
    while (r >= 0 && !R[r].text.includes(lit)) r--;
    themeRows.push(r);
    themeCols.push(r >= 0 ? colOf(R[r].text, R[r].text.indexOf(lit) + 1) : 0);
  });
  const lit = `"${FIRST_LINE}"`;
  let firstRow = R.findIndex((row) => row.kind === "code" && row.text.includes(lit));
  if (firstRow < 0) firstRow = 1;
  const firstCol = colOf(R[firstRow].text, R[firstRow].text.indexOf(lit) + 1);
  anchorCache = { themeRows, themeCols, firstRow, firstCol };
  return anchorCache;
}

const Z0 = 1.95; // the listing starts at the page's scale and settles to 1
const THEME_CY = (THEME[0].y! + THEME[THEME.length - 1].y!) / 2;

/** Listing-space centre of the three theme strings (with the theme rows at screen centre). */
function themeCentre() {
  const A = anchors();
  const cw = charW();
  let l = Infinity, r = -Infinity;
  THEME.forEach((ln, j) => {
    l = Math.min(l, X0 + A.themeCols[j] * cw);
    r = Math.max(r, X0 + (A.themeCols[j] + 2 * [...ln.text].length) * cw);
  });
  const mid = (A.themeRows[0] + A.themeRows[A.themeRows.length - 1]) / 2 - A.themeRows[1];
  return { x: (l + r) / 2, y: 540 + mid * LH - 0.08 * FS };
}

type Cam = { S: number; Z: number; tx: number; ty: number };
/** Scroll (row at screen centre) and the listing's 2D placement: screen = t + p·Z. */
function camera(f: number): Cam {
  const A = anchors();
  const cw = charW();
  const s0 = A.themeRows[1];
  const s1 = A.firstRow;
  const u = smooth(prog(f, C.rewind, C.stop));
  const S = lerp(s0, s1, 1 - Math.pow(1 - u, 5));
  let Z = 1, tx = 0, ty = 0;
  if (f < C.rewind) {
    // out of the page: the theme keeps its place and scale while the code grows around it
    const e = easeInOutCubic(prog(f, E.morph, C.rewind - 2));
    const Q = themeCentre();
    const ox = lerp(960, Q.x, e), oy = lerp(PAGE_O.y + (THEME_CY - PAGE_O.y) * 1.03, Q.y, e);
    Z = lerp(Z0, 1, e);
    tx = ox - Q.x * Z;
    ty = oy - Q.y * Z;
  } else if (f < C.stop) {
    const d = 1 - 0.08 * Math.sin(Math.PI * prog(f, C.rewind, C.stop));
    Z = d;
    tx = 960 * (1 - d);
    ty = 540 * (1 - d);
  } else {
    // home: lean in on the first line, the cursor waiting before 掂
    const e = easeInOutCubic(prog(f, C.stop + 2, C.end));
    const qx = X0 + ((A.firstCol + 26) / 2) * cw, qy = 540 - 0.08 * FS; // the whole line, centred
    Z = lerp(1, 1.3, e);
    tx = lerp(qx, 960, e) - qx * Z;
    ty = lerp(qy, 545, e) - qy * Z;
  }
  return { S, Z, tx, ty };
}

const Listing: React.FC<{ f: number; hideTheme: boolean }> = ({ f, hideTheme }) => {
  const R = rows();
  const cw = charW();
  const cam = camera(f);
  const { S, Z } = cam;
  const prev = camera(f - 1);
  const v = Math.abs(S - prev.S) * LH * Z;
  const blur = Math.min(42, v * 0.45);
  const tilt = 15 * smooth(clamp(v / 1500));
  const span = 540 / (LH * Z) + 8;
  const r0 = Math.max(0, Math.floor(S - span)), r1 = Math.min(R.length - 1, Math.ceil(S + span));
  const A = anchors();
  const items: React.ReactNode[] = [];
  const home = f >= C.stop - 2;
  for (let r = r0; r <= r1; r++) {
    const row = R[r];
    const yc = (r - S) * LH + 540;
    if (row.kind === "file") {
      items.push(
        <div key={`h${r}`} style={{ position: "absolute", left: X0, width: 2400, top: yc, height: 1, background: "rgba(22,21,25,0.16)" }} />,
        <span
          key={`p${r}`}
          style={{ position: "absolute", left: X0 - 10, top: spanTop(yc + 0.3 * FS * 0.8, FS * 0.8, MONO), fontFamily: MONO, fontSize: FS * 0.8, lineHeight: 0, whiteSpace: "pre", color: "#857f76", background: "#ece7dd", padding: "0 10px" }}
        >
          {row.text}
        </span>
      );
      continue;
    }
    if (row.kind === "gap") continue;
    const isFirst = r === A.firstRow;
    if (isFirst && home) {
      items.push(
        <div key="hl" style={{ position: "absolute", left: GUT_R + 16, width: 2400, top: yc - LH / 2, height: LH, background: "rgba(192,48,44,0.07)", opacity: smooth(prog(f, C.stop - 2, C.stop + 5)) }} />
      );
    }
    items.push(
      <span
        key={`n${r}`}
        style={{
          position: "absolute",
          left: GUT_R - 140,
          width: 140,
          textAlign: "right",
          top: spanTop(yc + BASE, FS * 0.8, MONO),
          fontFamily: MONO,
          fontSize: FS * 0.8,
          lineHeight: 0,
          color: isFirst && home ? COLORS.vermilion : "rgba(22,21,25,0.34)",
        }}
      >
        {row.n}
      </span>
    );
    const themeIdx = A.themeRows.indexOf(r);
    row.runs.forEach((run, k) => {
      const font = run.cjk ? HW : MONO;
      // in the loop the first line's characters have left their string (drawn falling: Ending)
      const gone = isFirst && f >= LP.start && run.cls === "zh" && run.text === FIRST_LINE;
      const hidden = gone || (hideTheme && themeIdx >= 0 && run.cls === "zh" && run.text === THEME[themeIdx].text);
      const st: React.CSSProperties = { position: "absolute", top: spanTop(yc + BASE, FS, font), fontFamily: font, fontSize: FS, lineHeight: 0, whiteSpace: "pre", color: COL[run.cls], opacity: hidden ? 0 : 1 };
      if (!run.cjk)
        items.push(
          <span key={`r${r}_${k}`} style={{ ...st, left: X0 + run.col * cw }}>
            {run.text}
          </span>
        );
      // v4.5: on the grid — each character in its own two columns, set in them as every line sets a
      // character in its cell (lib/ink: penInCell). v4.4 spaced a run by letter-spacing, as if every
      // advance were a whole em, so it drifted (to 1.6 px by 尖 in the first line), and by half a cell
      // or more after a ？, a quote or a ·.
      else
        [...run.text].forEach((ch, j) =>
          items.push(
            <span key={`r${r}_${k}_${j}`} style={{ ...st, left: X0 + (run.col + 2 * j) * cw + penInCell(ch, 2 * cw, glyphInk(ch, FS), HW) }}>
              {ch}
            </span>
          )
        );
    });
    if (isFirst && home && f < LP.start) {
      const on = (C.end - 1 - f) % 16 < 9; // phased so the last frame holds the cursor
      items.push(
        // the cursor at the insertion point before 掂, its left edge on it: right after the opening
        // quote's advance (v4.1; v4.0 stood it 1.5–4.5 px further left, inside the quote's)
        <div key="cur" style={{ position: "absolute", left: X0 + A.firstCol * cw, top: yc - 0.08 * FS - 0.62 * FS, width: 3, height: 1.24 * FS, background: COLORS.vermilion, opacity: on ? 1 : 0 }} />
      );
    }
  }
  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="codeblur" x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation={`0 ${blur.toFixed(2)}`} />
        </filter>
      </svg>
      <div style={{ position: "absolute", inset: 0, WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 150px, black 930px, transparent 1080px)" }}>
        <div style={{ position: "absolute", inset: 0, WebkitMaskImage: "linear-gradient(to right, black 0px, black 1720px, transparent 1910px)" }}>
          <div style={{ position: "absolute", inset: 0, perspective: 1500, perspectiveOrigin: "960px 540px" }}>
            <div style={{ position: "absolute", inset: 0, transformOrigin: "960px 540px", transform: tilt > 0.05 ? `rotateX(${tilt.toFixed(2)}deg)` : undefined }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 1920,
                  height: 1080,
                  transformOrigin: "0 0",
                  transform: `translate(${cam.tx.toFixed(2)}px, ${cam.ty.toFixed(2)}px) scale(${Z.toFixed(5)})`,
                  filter: blur > 0.5 ? "url(#codeblur)" : undefined,
                }}
              >
                {items}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/** Keeps the show-through clear of the theme and the signature; `clear` = 1 lifts the masks. */
const CodeMask: React.FC<{ clear: number; children: React.ReactNode }> = ({ clear, children }) => {
  if (clear >= 1) return <>{children}</>;
  const k = clear.toFixed(3);
  return (
    <div style={{ position: "absolute", inset: 0, WebkitMaskImage: `linear-gradient(to bottom, black 0px, black 820px, rgba(0,0,0,${k}) 960px)` }}>
      <div style={{ position: "absolute", inset: 0, WebkitMaskImage: `radial-gradient(ellipse 600px 250px at 960px 512px, rgba(0,0,0,${k}) 45%, black 100%)` }}>{children}</div>
    </div>
  );
};

const mixHex = (a: string, b: string, t: number) => {
  const p = (c: string) => (c[0] === "#" ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g)!.slice(0, 3).map(Number));
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(",")})`;
};

// ----------------------------------------------------------------- the coda
export const Ending: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame() + from;
  const boxes = themeBoxes();
  const Zp = lerp(1, 1.03, smooth(prog(f, E.start, E.morph)));
  const morph = f >= E.morph;
  const m = easeInOutCubic(prog(f, E.morph, C.rewind - 2));
  const pageOut = 1 - smooth(prog(f, E.morph, E.morph + 10)); // slip, seal and signature leave
  const listA = smooth(prog(f, E.morph + 4, E.morph + 16));
  // moonlight through the lattice, and the film's own source showing faintly through the paper
  const shadeA = smooth(prog(f, E.start, E.start + 10)) * (1 - smooth(prog(f, E.morph, E.morph + 12)));
  const drift = prog(f, E.start, E.morph);
  const ZpEnd = lerp(1, 1.03, 1);
  const CODE_END = 0.1;
  const codeA = (0.06 + (CODE_END - 0.06) * smooth(prog(f, E.l3, E.morph))) * smooth(prog(f, E.start + 6, E.start + 26));

  // the slip
  const slipChars = [...FIRST_LINE];
  const slipBoxes: Box[] = slipChars.map((ch, i) => {
    const g = glyphInk(ch, SLIP.size);
    const cy = SLIP.y0 + i * SLIP.step;
    const left = SLIP.x - (g.l + g.r) / 2;
    const baseline = cy - (g.t + g.b) / 2;
    return { ch, left, top: spanTop(baseline, SLIP.size), size: SLIP.size, color: "rgba(22,21,25,0.78)", at: E.slip + i * 1.5, key: `s${i}` };
  });
  const slipTop = SLIP.y0 - 38, slipBot = SLIP.y0 + (slipChars.length - 1) * SLIP.step + 36;
  const slipA = smooth(prog(f, E.start + 2, E.start + 12));
  const seal = f >= E.seal ? easeOutBack(prog(f, E.seal, E.seal + 7), 1.6) : 0;
  const sealSeep = prog(f, E.seal, E.seal + 5);

  // signature, centred on its ink
  const sigSize = 28;
  const sigL = lineInk([...SIGN], sigSize, [...SIGN].map((_, i) => (i ? 2 : 0)), HW);
  const sigX0 = 960 - (sigL.inkL + sigL.inkR) / 2;
  // the main body sits on the 95% line, as the credits' CJK ink does: for Latin that is the baseline
  // (the foot of m, u, n); the descenders of y and / hang below it, as they would in any line of text
  const sigBase = 1026;
  const sigBoxes: Box[] = [...SIGN].map((ch, i) => ({ ch, left: sigX0 + sigL.xs[i], top: spanTop(sigBase, sigSize, HW), size: sigSize, color: "rgba(22,21,25,0.7)", at: E.sig + i * 2, key: `g${i}` }));

  // where the theme glyphs land in the listing
  const cam = camera(f);
  const A = anchors();
  const cw = charW();

  // the loop: the page lets go over the opening's dark room as the line lies down in it (v4.5: gone by
  // the time the line lies on the strip; v4.1 let it go as the characters fell)
  const loopOut = smooth(prog(f, LP.start + 2, LP.laid));
  return (
    <>
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#ece7dd", opacity: 1 - loopOut }}>
      {/* paper, lamp light, and everything printed on the page */}
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${PAGE_O.x}px ${PAGE_O.y}px`, transform: `scale(${Zp})` }}>
        <div style={{ position: "absolute", inset: -20, backgroundImage: `url(${paper()})`, backgroundSize: "1960px 1120px" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(1500px 1100px at 280px 60px, rgba(255,196,128,0.24), rgba(255,196,128,0.07) 45%, rgba(255,196,128,0) 70%)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(1400px 900px at 880px 480px, rgba(60,42,24,0) 55%, rgba(60,42,24,0.16) 100%)" }} />
        {!morph && (
          <div style={{ position: "absolute", inset: 0, opacity: codeA, transformOrigin: `${PAGE_O.x}px ${PAGE_O.y}px`, transform: `scale(${1 / ZpEnd})` }}>
            <CodeMask clear={0}>
              <Listing f={E.morph} hideTheme />
            </CodeMask>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: -40,
            top: -40,
            width: 2000,
            height: 1160,
            backgroundImage: `url(${latticeShade()})`,
            backgroundSize: "2000px 1160px",
            mixBlendMode: "multiply",
            opacity: 0.42 * shadeA,
            transform: `translate(${(-16 * drift).toFixed(2)}px, ${(7 * drift).toFixed(2)}px)`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, opacity: pageOut }}>
          {/* 题签: a pasted label with a double vermilion rule */}
          <div
            style={{
              position: "absolute",
              left: SLIP.x - 40,
              top: slipTop,
              width: 80,
              height: slipBot - slipTop,
              background: "rgba(250,247,240,0.55)",
              boxShadow: "0 1px 3px rgba(60,40,20,0.08)",
              outline: "1.5px solid rgba(192,48,44,0.55)",
              outlineOffset: 0,
              opacity: slipA,
            }}
          >
            <div style={{ position: "absolute", inset: 5, border: "1px solid rgba(192,48,44,0.35)" }} />
          </div>
          {slipBoxes.map((b) => (
            <Soak key={b.key} f={f} b={b} />
          ))}
          {/* the seal: 懂 */}
          {f >= E.seal && (
            <>
              <svg width={0} height={0} style={{ position: "absolute" }}>
                <SeepFilter id="sealseep" p={lerp(0.55, 0.9, sealSeep)} size={SEAL.size} seed={11} soft={9} grain={2.6} />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: SEAL.x - SEAL.size / 2,
                  top: SEAL.y - SEAL.size / 2,
                  width: SEAL.size,
                  height: SEAL.size,
                  transform: `rotate(-4deg) scale(${lerp(1.35, 1, seal)})`,
                  opacity: clamp(seal * 3),
                  filter: "url(#sealseep)",
                }}
              >
                <div style={{ position: "absolute", inset: 0, background: COLORS.vermilion, borderRadius: 4 }} />
                <span
                  style={{
                    position: "absolute",
                    left: (SEAL.size - glyphInk("懂", 34).l - glyphInk("懂", 34).r) / 2,
                    top: spanTop(SEAL.size / 2 - (glyphInk("懂", 34).t + glyphInk("懂", 34).b) / 2, 34),
                    fontFamily: HW,
                    fontSize: 34,
                    lineHeight: 0,
                    color: "#f4ede2",
                  }}
                >
                  懂
                </span>
              </div>
            </>
          )}
        </div>
        {/* the theme, on the page until the coda takes it */}
        {!morph && boxes.flat().map((b) => <Soak key={b.key} f={f} b={b} />)}
      </div>
      {/* the signature sits on the screen's 95% line like every credit in the film, not on the
          page: printed on the page, the page's slow push-in (×1.03) carried it 14 px lower */}
      <div style={{ position: "absolute", inset: 0, opacity: pageOut }}>
        {sigBoxes.map((b) => (
          <Soak key={b.key} f={f} b={b} />
        ))}
      </div>

      {/* the listing */}
      {morph && (
        <div style={{ position: "absolute", inset: 0, opacity: lerp(CODE_END, 1, listA) }}>
          <CodeMask clear={listA}>
            <Listing f={f} hideTheme={f < C.rewind} />
          </CodeMask>
        </div>
      )}

      {/* the theme glyphs travel into their string literals */}
      {morph &&
        f < C.rewind &&
        boxes.map((line, j) =>
          line.map((b, i) => {
            const s0 = { x: PAGE_O.x + (b.left - PAGE_O.x) * Zp, y: PAGE_O.y + (b.top - PAGE_O.y) * Zp, size: b.size * Zp };
            const yc = (A.themeRows[j] - cam.S) * LH + 540;
            const px = X0 + (A.themeCols[j] + 2 * i) * cw + penInCell(b.ch, 2 * cw, glyphInk(b.ch, FS), HW), py = spanTop(yc + BASE, FS, HW);
            const tgt = { x: cam.tx + px * cam.Z, y: cam.ty + py * cam.Z };
            return (
              <span
                key={b.key}
                style={{
                  position: "absolute",
                  left: lerp(s0.x, tgt.x, m),
                  top: lerp(s0.y, tgt.y, m),
                  fontFamily: HW,
                  fontSize: lerp(s0.size, FS * cam.Z, m),
                  lineHeight: 0,
                  whiteSpace: "pre",
                  color: mixHex(b.color, COL.zh, smooth(prog(m, 0.15, 0.85))),
                }}
              >
                {b.ch}
              </span>
            );
          })
        )}

      {/* the window's warm white clears onto the page */}
      <div style={{ position: "absolute", inset: 0, background: "#fff6ea", opacity: 1 - smooth(prog(f, E.start, E.start + 14)) }} />
    </div>
    {f >= LP.start && <LoopOut f={f} A={A} cw={cw} />}
    </>
  );
};

/** CSS matrix3d taking a w × h box (its top-left at the origin) onto the screen quadrilateral q — top-left,
 *  top-right, bottom-right, bottom-left: the square-to-quadrilateral projective map */
function onto(w: number, h: number, q: number[][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det, k = (dx1 * dy3 - dx3 * dy1) / det;
  const m = [(x1 - x0 + g * x1) / w, (y1 - y0 + g * y1) / w, 0, g / w, (x3 - x0 + k * x3) / h, (y3 - y0 + k * y3) / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toPrecision(10)).join(",")})`;
}

/** the room under the page as the line lies down in it: the typing scene's camera, wide on the strip */
let ROOM: { cam: THREE.PerspectiveCamera; fwd: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; focal: number; tilt: number } | null = null;
function room() {
  if (ROOM) return ROOM;
  const c = loopCam(LOOP.laid);
  const cam = new THREE.PerspectiveCamera(TYPING_FOV, 1920 / 1080, 0.1, 200);
  cam.position.set(...c.pos);
  cam.lookAt(new THREE.Vector3(...c.look));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  // how far a card facing us tips back to lie on the strip, its top away from us
  const tilt = up.angleTo(new THREE.Vector3(0, 0, -1));
  ROOM = { cam, fwd: cam.getWorldDirection(new THREE.Vector3()), right: new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up, focal: 540 / Math.tan(((TYPING_FOV / 2) * Math.PI) / 180), tilt };
  return ROOM;
}
const toScreen = (p: THREE.Vector3) => {
  const v = p.clone().project(room().cam);
  return [((v.x + 1) / 2) * 1920, ((1 - v.y) / 2) * 1080];
};
/** a w × h card centred at c, facing us and tipped back by t (0 … 1, lying on the strip): its corners on screen */
const card = (c: THREE.Vector3, w: number, h: number, t: number) => {
  const R = room();
  const up = R.up.clone().applyAxisAngle(R.right, -R.tilt * t);
  const x = R.right.clone().multiplyScalar(w / 2), y = up.multiplyScalar(h / 2);
  return [c.clone().sub(x).add(y), c.clone().add(x).add(y), c.clone().add(x).sub(y), c.clone().sub(x).sub(y)].map(toScreen);
};
/** the point at view depth D that is seen at (x, y) */
const atDepth = (x: number, y: number, D: number) => {
  const R = room();
  return R.cam.position.clone().addScaledVector(R.fwd, D).addScaledVector(R.right, ((x - 960) * D) / R.focal).addScaledVector(R.up, ((540 - y) * D) / R.focal);
};
/** the room's vignette at (x, y) (lib/post, as the typing scene sets it: 0.55) */
const vignette = (x: number, y: number) => 0.45 + 0.55 * smooth(clamp((Math.hypot((x / 1920 - 0.5) * (1920 / 1080), y / 1080 - 0.5) * 0.72 - 0.85) / -0.7));
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const shade = (c: number[], k: number) => `rgb(${c.map((v) => Math.round(v * k)).join(",")})`;

/** 字回字盘 (v4.5), its first half: the line lies down. As the page lets go of the room under it (the
 *  opening's, seen wide), the first line's twelve characters and the cursor before them tip back off
 *  the page onto the input strip, each character into its own slot, the cursor to the strip's start —
 *  the line as it stood when it was typed — and the page's red takes the room's light as the page goes.
 *  They are cards in the room's own space, seen through its camera; at LOOP.laid the typing scene's own
 *  cards and cursor take over where these lie, and carry the line home into the type, the last first. */
const LoopOut: React.FC<{ f: number; A: Anchors; cw: number }> = ({ f, A, cw }) => {
  if (f >= LP.laid) return null;
  const R = room();
  const c0 = camera(LP.start); // where the page held the line
  const yc = (A.firstRow - c0.S) * LH + 540;
  const u = prog(f, LP.start, LP.laid);
  const e = easeInOutCubic(u); // across, and from the page's size to the strip's
  const tip = u * u * (2 - u); // tipping back, faster and faster: it lies down with a pat
  const lit = smooth(prog(f, LP.start + 2, LP.laid)); // the room's light, as the page goes
  const depth = (p: THREE.Vector3) => p.clone().sub(R.cam.position).dot(R.fwd);
  const fb = fontBox(FS);
  const red = rgbOf(COL.zh);
  const glyphs = [...FIRST_LINE].map((ch, i) => {
    // its em square on the page and on the strip, the character set in it as glyphCell sets one: its
    // ink on the square's axis, the square's centre at the centre of its two columns on the page
    const ax = c0.tx + (X0 + (A.firstCol + 2 * i + 1) * cw) * c0.Z;
    const ay = c0.ty + (yc + BASE - (fb.A - fb.D) / 2) * c0.Z;
    const B = new THREE.Vector3(LOOP_STRIP.x(i), LOOP_STRIP.y, LOOP_STRIP.z);
    const D = depth(B);
    const em = lerp((FS * c0.Z * D) / R.focal, LOOP_STRIP.em, e);
    const q = card(atDepth(ax, ay, D).lerp(B, e), em, em, tip);
    const P = Math.ceil(Math.max(...q.map((p, k) => Math.hypot(p[0] - q[(k + 1) % 4][0], p[1] - q[(k + 1) % 4][1]))));
    const mid = toScreen(atDepth(ax, ay, D).lerp(B, e));
    return (
      <div key={i} style={{ position: "absolute", left: 0, top: 0, width: P, height: P, transformOrigin: "0 0", transform: onto(P, P, q) }}>
        <div style={{ position: "absolute", left: penInCell(ch, P, glyphInk(ch, P), HW), top: P / 2, fontFamily: HW, fontSize: P, lineHeight: 0, whiteSpace: "pre", color: shade(red, lerp(1, vignette(mid[0], mid[1]), lit)) }}>
          {ch}
        </div>
      </div>
    );
  });
  // the cursor: from before 掂 on the page to the strip's start
  const CB = new THREE.Vector3(LOOP_STRIP.cur.x, LOOP_STRIP.cur.y, LOOP_STRIP.z);
  const Dc = depth(CB);
  const CA = atDepth(c0.tx + (X0 + A.firstCol * cw + 1.5) * c0.Z, c0.ty + (yc - 0.08 * FS) * c0.Z, Dc);
  const cq = card(CA.lerp(CB, e), lerp((3 * c0.Z * Dc) / R.focal, LOOP_STRIP.cur.w, e), lerp((1.24 * FS * c0.Z * Dc) / R.focal, LOOP_STRIP.cur.h, e), tip);
  const cm = toScreen(CA.lerp(CB, e));
  const curCol = rgbOf(COLORS.vermilion).map((v, k) => lerp(v, CURSOR_SEEN[k] * vignette(cm[0], cm[1]), lit));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {glyphs}
      <div style={{ position: "absolute", left: 0, top: 0, width: 10, height: 100, transformOrigin: "0 0", transform: onto(10, 100, cq), background: shade(curCol, 1) }} />
    </div>
  );
};

