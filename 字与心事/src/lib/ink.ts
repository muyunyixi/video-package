// Ink-accurate text metrics. Layout boxes include each glyph's side bearings
// (a full-width 。 or 、 is mostly empty on its right), so centring by box
// drifts left. Everything that is "centred" in the film is centred on the ink.
import { HW } from "./util";
import HWM from "../gen/hw_metrics.json";

type GlyphInk = { adv: number; l: number; r: number; t: number; b: number };
const cache = new Map<string, GlyphInk>();
let ctx: CanvasRenderingContext2D | null = null;

// v4.5: 汇文明朝体 is measured on its outlines, read from the font file (render/hw_metrics.py, for every
// character in the source): measureText rounds a glyph's ink box out to whole pixels (掂 at 80 px: 4 … 77,
// where the outline runs from 4.53 to 76.33), so a character centred in its cell by that box sat up to
// half a pixel off. Other fonts, and anything the table lacks, are measured by the browser.
const HWT = HWM as { upm: number; g: Record<string, number[]> };

export function glyphInk(ch: string, size: number, font = HW, weight: number | string = 400): GlyphInk {
  const key = `${ch}|${size}|${font}|${weight}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = font === HW && (weight === 400 || weight === "400" || weight === "normal") ? HWT.g[ch] : undefined;
  let g: GlyphInk;
  if (m) {
    const k = size / HWT.upm;
    // [advance, xMin, yMin, xMax, yMax] in font units, y up: t and b are measured down from the baseline
    g = m.length > 1 ? { adv: m[0] * k, l: m[1] * k, r: m[3] * k, t: -m[4] * k, b: -m[2] * k } : { adv: m[0] * k, l: 0, r: 0, t: 0, b: 0 };
  } else {
    if (!ctx) ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const mm = ctx.measureText(ch);
    g = {
      adv: mm.width,
      l: -mm.actualBoundingBoxLeft,
      r: mm.actualBoundingBoxRight,
      t: -mm.actualBoundingBoxAscent,
      b: mm.actualBoundingBoxDescent,
    };
  }
  if (ch.trim() === "") {
    g.l = g.adv / 2;
    g.r = g.adv / 2;
    g.t = 0;
    g.b = 0;
  }
  cache.set(key, g);
  return g;
}

/** Font ascent/descent (px) as the CSS inline layout uses them. */
const boxCache = new Map<string, { A: number; D: number }>();
export function fontBox(size: number, font = HW, weight: number | string = 400) {
  const key = `${size}|${font}|${weight}`;
  const hit = boxCache.get(key);
  if (hit) return hit;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = `${weight} ${size}px ${font}`;
  const m = ctx.measureText("字");
  const v = { A: m.fontBoundingBoxAscent, D: m.fontBoundingBoxDescent };
  boxCache.set(key, v);
  return v;
}
/** CSS `top` for an absolutely positioned, line-height:0 span whose baseline should sit at `baseline`. */
export const spanTop = (baseline: number, size: number, font = HW) => {
  const { A, D } = fontBox(size, font);
  return baseline - (A - D) / 2;
};

export type LineInk = {
  adv: number; // total advance of the laid-out run (box width)
  inkL: number; // ink left, relative to box left
  inkR: number;
  inkT: number; // relative to the alphabetic baseline
  inkB: number;
  xs: number[]; // pen x of every glyph, relative to box left
  boxL: number; // what the line is aligned by: the first character's cell, or a leading mark's ink
  boxR: number; // the last character's cell, or a closing mark's ink (its empty outer side trimmed)
};

// v4.5 · the grid (网格排, 《整体制作指南》8.1). Every full-width character — a full-width mark too —
// takes exactly one cell of one em, whatever advance its font gives it: 汇文明朝体's run from 915 to
// 1033 units in its 1024 (了, 忑), and the differences have nothing to do with how wide a character is
// drawn (they are the font's errors, not proportional spacing), so a line set by them stood up to 2 px
// off another, or off itself. A half-width character (a digit, a letter) takes its own advance. v4.4
// stepped every character on by its font's advance. In its cell a character's ink is centred on the
// cell's axis — in 汇文明朝体 punctuation too, so a 。 under a ， shares its axis and reaches a little
// further on both sides, as the font draws them — except that an opening bracket or quote stands
// against the cell's right side and a closing one against its left, next to what they enclose; in
// the other fonts (Noto CJK, whose characters are a whole em already) a glyph sits where its designer
// set it. Alignment then uses the ink of the whole line, which trims the empty outer side of a
// punctuation mark at either end of it.
export const FULL = /[—…“”‘’·　-〿㐀-䶿一-鿿豈-﫿＀-｠￠-￦]/;
const OPEN = /[“‘（《〈「『【〔［｛]/;
const CLOSE = /[”’）》〉」』】〕］｝]/;
// a mark, full-width or half-width: at either end of a line it counts only as far as its ink
const MARK = /[　-〿＀-￯!-\/:-@\[-`{-~“”‘’—…·]/;

/** The cell a glyph takes: one em for a full-width character, its own advance for a half-width one. */
export const cellOf = (ch: string, g: GlyphInk, size: number) => (FULL.test(ch) || g.adv > size * 0.9 ? size : g.adv);
/** Where a glyph's pen goes, from the left of a cell `cell` px wide, to sit in it as the grid sets it. */
export function penInCell(ch: string, cell: number, g: GlyphInk, font = HW) {
  if (ch.trim() === "") return (cell - g.adv) / 2;
  if (font !== HW || !FULL.test(ch)) return (cell - g.adv) / 2; // as drawn: its advance centred (0 when it fills the cell)
  if (OPEN.test(ch)) return cell - g.adv;
  if (CLOSE.test(ch)) return 0;
  return cell / 2 - (g.l + g.r) / 2;
}

/** Lay out glyphs left-to-right on the grid, with fixed extra gaps (px) before each glyph. */
export function lineInk(chars: string[], size: number, gaps: number[] = [], font = HW, weight: number | string = 400): LineInk {
  let x = 0;
  let inkL = Infinity, inkR = -Infinity, inkT = Infinity, inkB = -Infinity;
  let boxL = NaN, boxR = NaN;
  const xs: number[] = [];
  chars.forEach((ch, i) => {
    x += gaps[i] ?? 0;
    const g = glyphInk(ch, size, font, weight);
    const cell = cellOf(ch, g, size);
    const pen = x + penInCell(ch, cell, g, font);
    xs.push(pen);
    if (ch.trim() !== "") {
      inkL = Math.min(inkL, pen + g.l);
      inkR = Math.max(inkR, pen + g.r);
      inkT = Math.min(inkT, g.t);
      inkB = Math.max(inkB, g.b);
      // the edges a line is aligned by: a character's cell, in any font — but a punctuation mark only as
      // far as its ink (v4.1: in every font; v4.0 counted the cells only of 汇文明朝体's characters)
      const cellEdges = !MARK.test(ch);
      if (Number.isNaN(boxL)) boxL = cellEdges ? x : pen + g.l;
      boxR = cellEdges ? x + cell : pen + g.r;
    }
    x += cell;
  });
  return { adv: x, inkL, inkR, inkT, inkB, xs, boxL: Number.isNaN(boxL) ? inkL : boxL, boxR: Number.isNaN(boxR) ? inkR : boxR };
}
