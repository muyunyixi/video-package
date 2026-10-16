import React from "react";
import { HW, clamp, prog, easeOutCubic, easeOutBack, smooth, lerp } from "./lib/util";
import { glyphInk, spanTop } from "./lib/ink";

export type VGlyph = {
  ch: string;
  at: number;
  from?: "top" | "left" | "right" | "ink" | "slam" | "gather";
  /** v4.0: the half that comes first (南 is the south's, 北 the north's); the other seeps in after */
  lead?: "L" | "R";
};

/**
 * A vertical column of poem text sitting on a fold: each glyph is drawn twice
 * and clipped at the fold, warm on the left half and cold on the right.
 */
export const SplitColumn: React.FC<{
  f: number;
  glyphs: VGlyph[];
  x: number;
  yCenter: number;
  size: number;
  step: number;
  out: [number, number];
  warm: string;
  cold: string;
  warmGlow: string;
  coldGlow: string;
}> = ({ f, glyphs, x, yCenter, size, step, out, warm, cold, warmGlow, coldGlow }) => {
  if (f < glyphs[0].at - 1 || f > out[1]) return null;
  const n = glyphs.length;
  const y0 = yCenter - ((n - 1) / 2) * step;
  const outA = 1 - smooth(prog(f, out[0], out[1]));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: outA, pointerEvents: "none" }}>
      {glyphs.map((g, i) => {
        if (f < g.at) return null;
        const gi = glyphInk(g.ch, size);
        const t = prog(f, g.at, g.at + 10);
        const e = easeOutCubic(t);
        let dx = 0, dy = 0, s = 1, blur = 0, op = clamp(t * 2.5);
        if (g.from === "left") dx = -420 * (1 - e);
        else if (g.from === "right") dx = 420 * (1 - e);
        else if (g.from === "top") dy = -60 * (1 - e);
        else if (g.from === "slam") {
          s = 1 + 0.5 * (1 - easeOutBack(prog(f, g.at, g.at + 8), 2.2));
          blur = 8 * (1 - easeOutCubic(prog(f, g.at, g.at + 6)));
        } else if (g.from === "gather") {
          // v4.0: the glyph condenses where its motes (petals, snow: scenes/spring) arrive
          op = smooth(prog(f, g.at - 1, g.at + 6));
          blur = 5 * (1 - smooth(prog(f, g.at - 1, g.at + 7)));
        } else blur = 10 * (1 - e);
        if (g.from === "left" || g.from === "right") blur = 6 * (1 - e);
        // ink centre of the glyph on (x, yi)
        const cy = y0 + i * step;
        const baseline = cy - (gi.t + gi.b) / 2;
        const left = x - (gi.l + gi.r) / 2 + dx;
        const top = spanTop(baseline, size) + dy;
        // the half that does not lead seeps in a few frames later
        const lag = (side: "L" | "R") => (g.lead && g.lead !== side ? smooth(prog(f, g.at + 3, g.at + 12)) : 1);
        const half = (side: "L" | "R") => (
          <span
            style={{
              position: "absolute",
              left,
              top,
              fontFamily: HW,
              fontSize: size,
              lineHeight: 0,
              whiteSpace: "pre",
              color: side === "L" ? warm : cold,
              textShadow: `0 0 18px ${side === "L" ? warmGlow : coldGlow}`,
              opacity: op * lag(side),
              filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              transform: `scale(${s})`,
              transformOrigin: `${x - left}px ${cy - top}px`,
              // clip at the fold, in the glyph's own coordinates
              clipPath: side === "L" ? `inset(-200px calc(100% - ${x - left}px) -200px -200px)` : `inset(-200px -200px -200px ${x - left}px)`,
            }}
          >
            {g.ch}
          </span>
        );
        return (
          <React.Fragment key={i}>
            {half("L")}
            {half("R")}
          </React.Fragment>
        );
      })}
    </div>
  );
};
