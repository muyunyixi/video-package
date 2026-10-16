// What the cover scenes share (split out of cover/app.tsx, 2026-10-17, when cover/lines.tsx was added):
// the canvas, the opening's title and subtitle set as the film sets a line (lib/ink), canvases at the
// shot's pixel ratio, a seeded random.
import { lineInk, spanTop, type LineInk } from "../src/lib/ink";

// the canvas: portrait 3:4 (1080×1440) by default; ?ar=43 gives the landscape 4:3 one (1440×1080) that 抖音
// asks for beside it (2026-10-17): the same picture and the same type at the same sizes, laid out on the wider frame
export const AR = new URLSearchParams(location.search).get("ar") === "43" ? "43" : "34";
export const CW = AR === "43" ? 1440 : 1080, CH = AR === "43" ? 1080 : 1440;
export const TITLE = "字与心事";
export const SUB = "从落笔，到有人读懂";

// ---------- the type: the opening's title and subtitle, set as the film sets lines ----------
// (《文案撰写指南》8.3: the title one line, centred on its cells, its ink top at y 170, its line of ink
// about 70% of the width; tracking in the opening's own proportions, added between cells as the
// opening adds it (title: 36 at 320 px; subtitle: 34 at 120 px). The drafts had the title at 0.22 em:
// that is the gap between the opening's inks (its tracking plus the glyphs' side bearings), taken for
// the tracking, so the side bearings were counted twice and the title stood 1.4 times as loose as the
// opening's. The subtitle 60 px, 70 px under the title's ink; a short vermilion rule under it)
export const T = { size: 178, track: 36 / 320, inkTop: 170, sSize: 60, sTrack: 34 / 120, gap: 70, ruleW: 0.2, ruleH: 5, ruleGap: 34 };

export type Glyph = { ch: string; left: number; top: number; size: number; color: string; shadow?: string };
export function setLine(text: string, size: number, track: number, inkTop: number, color: (i: number) => string, shadow?: (i: number) => string) {
  const chars = [...text];
  const tr = Math.round(size * track);
  const L: LineInk = lineInk(chars, size, chars.map((_, i) => (i ? tr : 0)));
  const x0 = CW / 2 - (L.boxL + L.boxR) / 2;
  const baseline = inkTop - L.inkT;
  const glyphs: Glyph[] = chars.map((ch, i) => ({ ch, left: x0 + L.xs[i], top: spanTop(baseline, size), size, color: color(i), shadow: shadow?.(i) }));
  return { glyphs, L, x0, baseline, inkTop: baseline + L.inkT, inkBottom: baseline + L.inkB, inkL: x0 + L.inkL, inkR: x0 + L.inkR };
}

// ---------- canvases at the pixel ratio of the shot ----------
export const DPR = 2;
export function hiCanvas(w = CW, h = CH) {
  const c = document.createElement("canvas");
  c.width = w * DPR;
  c.height = h * DPR;
  const ctx = c.getContext("2d")!;
  ctx.scale(DPR, DPR);
  return { c, ctx };
}
export const url = (c: HTMLCanvasElement) => c.toDataURL("image/png");
export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
