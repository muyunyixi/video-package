import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, HW, clamp, prog, smooth, easeOutBack, easeOutCubic, easeInCubic } from "./lib/util";
import { glyphInk, lineInk, spanTop } from "./lib/ink";
import { SeepFilter, hashStr } from "./lib/seep";

export type Glyph = { ch: string; at: number; color?: string; gapBefore?: number };
export type Line = {
  glyphs: Glyph[];
  x: number; // anchor x (px): ink centre / ink left / ink right depending on align
  y: number; // ink vertical centre (px)
  size: number;
  out: [number, number];
  tracking?: number;
  align?: "center" | "left" | "right";
  color?: (f: number) => string;
  glow?: (f: number) => number; // red bloom on coloured glyphs
  halo?: string | ((f: number, colored: boolean) => string | undefined); // soft halo for legibility over busy backgrounds
  // ink = 墨渗 (noise seep), soft = blur-in, brush = 落笔: each character is written in, its ink
  // arriving from the upper left to the lower right as a brush moves through it, seeping as it goes
  reveal?: "slam" | "ink" | "rise" | "soft" | "brush";
  exit?: "fade" | "blur" | "drift";
  font?: string;
  opacity?: (f: number) => number;
  /** v4.5: where the line's pen starts, when a block puts its lines on one grid (stackLines) */
  x0?: number;
};

const layLine = (l: Line) =>
  lineInk(
    l.glyphs.map((g) => g.ch),
    l.size,
    l.glyphs.map((g, i) => (g.gapBefore ?? 0) + (i ? l.tracking ?? 0 : 0)),
    l.font ?? HW
  );

/**
 * v4.0 line spacing (《整体制作指南》): lines of a block sit 1.35 × the type size apart, baseline to
 * baseline, the size being the em in px of the finished 1920×1080 frame. Lines are placed by their
 * ink, so this sets each line's ink centre from the first one's (y0) — call it at render time,
 * once the fonts are in.
 */
export function stackLines(lines: Line[], y0: number, pitch?: number): Line[] {
  const Ls = lines.map(layLine);
  const mid = (i: number) => (Ls[i].inkT + Ls[i].inkB) / 2; // the ink's middle, relative to the baseline
  const b0 = y0 - mid(0);
  const step = pitch ?? 1.35 * lines[0].size;
  const out = lines.map((l, i) => ({ ...l, y: b0 + i * step + mid(i) }));
  // v4.5 · one grid for the block (网格排, 《整体制作指南》8.1): lines of one size, font, tracking and
  // anchor are first set against each other by their cells — centred, their cells share an axis; left or
  // right, an edge — so a column of one stands exactly over the same column of the next; then the block
  // is aligned as one, by the outermost of its lines' edges (a character's cell, an end mark's ink). v4.4
  // set each line alone, on the font's advances: the two lines of 灯火 stood 1.3 px apart at their first
  // characters and 1.8 px at their end marks (a 。 is wider than a ，, so the line it ends sat further left).
  const a0 = lines[0];
  const one = lines.every((l) => l.size === a0.size && (l.font ?? HW) === (a0.font ?? HW) && (l.tracking ?? 0) === (a0.tracking ?? 0) && (l.align ?? "center") === (a0.align ?? "center") && l.x === a0.x);
  if (!one || lines.length < 2) return out;
  const align = a0.align ?? "center";
  const cellL = (i: number) => lines[i].glyphs[0]?.gapBefore ?? 0, cellR = (i: number) => Ls[i].adv;
  const x0 = Ls.map((_, i) => (align === "center" ? -(cellL(i) + cellR(i)) / 2 : align === "left" ? 0 : -cellR(i)));
  const Lb = Math.min(...Ls.map((L, i) => x0[i] + L.boxL)), Rb = Math.max(...Ls.map((L, i) => x0[i] + L.boxR));
  const d = align === "center" ? a0.x - (Lb + Rb) / 2 : align === "left" ? a0.x - Lb : a0.x - Rb;
  return out.map((l, i) => ({ ...l, x0: x0[i] + d }));
}

/** Build glyph timings from a string: one glyph every `step` frames, punctuation lands faster. */
export function glyphsOf(text: string, at: number, step: number, o: { color?: (ch: string, i: number) => string | undefined; gaps?: Record<number, number> } = {}): Glyph[] {
  const out: Glyph[] = [];
  let t = at;
  [...text].forEach((ch, i) => {
    const punct = /[，。、；：！？]/.test(ch);
    if (i > 0) t += punct ? Math.max(2, Math.round(step * 0.5)) : step;
    out.push({ ch, at: Math.round(t), color: o.color?.(ch, i), gapBefore: o.gaps?.[i] });
  });
  return out;
}

/**
 * A line of poem text whose position is defined by its ink, not its layout box.
 * Glyphs are placed absolutely from canvas metrics of the same font, so the
 * final punctuation never shifts the line and 。 / 、 bearings are excluded.
 */
export const PoemLine: React.FC<{ line: Line; frame?: number }> = ({ line, frame }) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const first = Math.min(...line.glyphs.map((g) => g.at));
  if (f < first - 1 || f > line.out[1]) return null;
  const font = line.font ?? HW;
  const size = line.size;
  const tracking = line.tracking ?? 0;
  const chars = line.glyphs.map((g) => g.ch);
  const gaps = line.glyphs.map((g, i) => (g.gapBefore ?? 0) + (i ? tracking : 0));
  const L = lineInk(chars, size, gaps, font);
  const align = line.align ?? "center";
  // every character sits on its cell's axis; lines align by their cells, a mark at either end
  // counting only as far as its ink (lib/ink) — or, in a block, as the block's grid has it (stackLines)
  const x0 = line.x0 ?? (align === "center" ? line.x - (L.boxL + L.boxR) / 2 : align === "left" ? line.x - L.boxL : line.x - L.boxR);
  const baseline = line.y - (L.inkT + L.inkB) / 2;
  const outT = prog(f, line.out[0], line.out[1]);
  const exit = line.exit ?? "fade";
  const outA = 1 - smooth(outT);
  const base = line.color ? line.color(f) : COLORS.ink;
  const glow = line.glow ? line.glow(f) : 0;
  const reveal = line.reveal ?? "slam";
  const lineOp = line.opacity ? line.opacity(f) : 1;
  const uid = hashStr(chars.join("") + first);
  const SEEP = 12;
  const BRUSH = 12;
  const seeping =
    reveal === "ink"
      ? line.glyphs.map((g, i) => ({ i, t: prog(f, g.at, g.at + SEEP) })).filter((s) => f >= line.glyphs[s.i].at && s.t < 1)
      : reveal === "brush"
        ? line.glyphs.map((g, i) => ({ i, t: Math.pow(prog(f, g.at, g.at + BRUSH), 0.6) })).filter((s) => f >= line.glyphs[s.i].at && s.t < 1)
        : [];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, pointerEvents: "none", opacity: outA * lineOp }}>
      {seeping.length > 0 && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          {seeping.map((s) => (
            <SeepFilter key={s.i} id={`sp${uid}_${s.i}`} p={s.t} size={size} seed={(uid + s.i * 7) % 997} />
          ))}
        </svg>
      )}
      {line.glyphs.map((g, i) => {
        if (f < g.at) return null;
        const gi = glyphInk(g.ch, size, font);
        const cx = x0 + L.xs[i] + (gi.l + gi.r) / 2;
        const cy = baseline + (gi.t + gi.b) / 2;
        let s = 1, blur = 0, op = 1, dy = 0;
        let seep: string | undefined;
        let mask: string | undefined;
        if (reveal === "slam") {
          const t = prog(f, g.at, g.at + 7);
          s = 1 + 0.42 * (1 - easeOutBack(t, 2.4));
          blur = 9 * (1 - easeOutCubic(prog(f, g.at, g.at + 5)));
          op = clamp(t * 3);
        } else if (reveal === "ink") {
          const t = prog(f, g.at, g.at + SEEP);
          s = 1 + 0.04 * (1 - easeOutCubic(t));
          if (t < 1) seep = `url(#sp${uid}_${i})`;
        } else if (reveal === "brush") {
          const t = prog(f, g.at, g.at + BRUSH);
          s = 1 + 0.03 * (1 - easeOutCubic(t));
          if (t < 1) {
            seep = `url(#sp${uid}_${i})`;
            // the wet edge runs across the character at a slant, soft over a third of it
            const q = smooth(t), soft = 34;
            const p = -soft + (100 + 2 * soft) * q;
            mask = `linear-gradient(118deg, #000 ${(p - soft).toFixed(1)}%, rgba(0,0,0,0) ${p.toFixed(1)}%)`;
          }
        } else if (reveal === "soft") {
          const t = prog(f, g.at, g.at + 10);
          s = 1 + 0.08 * (1 - easeOutCubic(t));
          blur = 12 * (1 - easeOutCubic(t));
          op = clamp(t * 2.2);
        } else {
          const t = prog(f, g.at, g.at + 9);
          dy = 26 * (1 - easeOutCubic(t));
          blur = 4 * (1 - t);
          op = clamp(t * 2);
        }
        if (exit === "blur") blur += 14 * easeInCubic(outT);
        if (exit === "drift") dy -= 30 * easeInCubic(outT);
        const col = g.color ?? base;
        const halo = typeof line.halo === "function" ? line.halo(f, !!g.color) : line.halo;
        // (v4.5: a coloured glyph's glow and its halo together, so that one can fade as the other comes)
        const shadow = [glow > 0 && g.color ? `0 0 ${18 * glow}px rgba(255,80,60,${0.8 * glow})` : "", halo ? `0 0 18px ${halo}, 0 0 6px ${halo}` : ""].filter(Boolean).join(", ") || undefined;
        // a masked character needs a real box around its ink (the span itself has no height)
        const pad = size * 0.2;
        const ox = mask ? x0 + L.xs[i] + gi.l - pad : 0, oy = mask ? baseline + gi.t - pad : 0;
        const glyph = (
          <span
            key={i}
            style={{
              position: "absolute",
              left: x0 + L.xs[i] - ox,
              top: spanTop(baseline, size, font) - oy,
              fontFamily: font,
              fontSize: size,
              lineHeight: 0,
              whiteSpace: "pre",
              color: col,
              opacity: op,
              transformOrigin: `${cx - (x0 + L.xs[i])}px ${cy - spanTop(baseline, size, font)}px`,
              transform: `translateY(${dy}px) scale(${s})`,
              filter: [seep, blur > 0.2 ? `blur(${blur}px)` : ""].filter(Boolean).join(" ") || undefined,
              textShadow: shadow,
            }}
          >
            {g.ch}
          </span>
        );
        if (!mask) return glyph;
        return (
          <div key={i} style={{ position: "absolute", left: ox, top: oy, width: gi.r - gi.l + 2 * pad, height: gi.b - gi.t + 2 * pad, WebkitMaskImage: mask, maskImage: mask }}>
            {glyph}
          </div>
        );
      })}
    </div>
  );
};
