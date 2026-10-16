// 墨渗: text that soaks into the paper instead of fading in. A fractal-noise
// field is thresholded as the reveal advances, so ink arrives in blots that
// spread along the fibres and close up into the stroke. Rendered with an SVG
// filter on the glyph itself (CSS filter: url(#id)).
import React from "react";
import { clamp } from "./util";

/** Region (user space of the filtered element) generous enough for one glyph and its halo. */
export const SeepFilter: React.FC<{ id: string; p: number; size: number; seed: number; soft?: number; grain?: number }> = ({ id, p, size, seed, soft = 6, grain = 1.7 }) => {
  const q = clamp(p);
  const thr = 0.88 - 0.8 * q; // noise ~0.2–0.8: nothing at q=0, all ink at q=1
  const k = soft;
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={-size * 1.2}
      y={-size * 2.2}
      width={size * 4.4}
      height={size * 4.4}
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence type="fractalNoise" baseFrequency={(grain / size).toFixed(5)} numOctaves={4} seed={seed} result="n" />
      <feColorMatrix in="n" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${k} 0 0 0 ${(-k * thr).toFixed(4)}`} result="m" />
      <feGaussianBlur in="SourceGraphic" stdDeviation={(size * 0.03 * (1 - q)).toFixed(2)} result="s" />
      <feComposite in="s" in2="m" operator="in" />
    </filter>
  );
};

/** Stable small integer from a string, for unique filter ids and seeds. */
export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}
