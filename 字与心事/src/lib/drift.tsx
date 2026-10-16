// v4.0 · things of the season drifting past the letter paper: one look and one way of moving,
// shared by the chat history (each year's stretch has its own season) and her reply (late
// spring, the petals go on falling). They fall, as such things do: petals and leaves sway like
// a pendulum and tumble (their rotation follows the sway, and they turn edge-on now and then),
// snow drifts straight down, fireflies hover and blink. Out of focus: felt, not read.
import React from "react";

export type DriftKind = "leaf" | "fly" | "snow" | "petal";

/** How one falling thing has moved t frames after it set out (ph: its phase, s: its size 0.7–1.3). */
export function fallPose(kind: DriftKind, t: number, ph: number, s: number) {
  if (kind === "fly") {
    // fireflies don't fall: a slow wander about their spot, and a pulse of light
    return {
      dx: 16 * Math.sin(0.031 * t + ph) + 6 * Math.sin(0.083 * t + 2 * ph),
      dy: 11 * Math.sin(0.023 * t + 1.7 * ph),
      rot: 0,
      flip: 1,
      blink: 0.45 + 0.55 * Math.pow(Math.max(0, Math.sin(0.13 * t + 3 * ph)), 2),
    };
  }
  if (kind === "snow") {
    const v = 0.75 * (0.7 + 0.5 * s);
    return { dx: 8 * s * Math.sin(0.05 * t + ph), dy: v * t, rot: 0, flip: 1, blink: 1 };
  }
  // petals and ginkgo leaves: the faster ones are the bigger ones
  const leaf = kind === "leaf";
  const v = (leaf ? 1.35 : 1.1) * (0.7 + 0.5 * s);
  const w = leaf ? 0.06 : 0.07; // the sway: a period of 3–3.5 s
  const A = (leaf ? 26 : 18) * s;
  const sw = Math.sin(w * t + ph);
  return {
    dx: A * sw,
    // a pendulum dips at the ends of its swing: the fall slows a touch there
    dy: v * t - 3 * s * Math.cos(2 * (w * t + ph)),
    rot: ph * 57.3 + (leaf ? 50 : 35) * Math.cos(w * t + ph),
    flip: 0.32 + 0.68 * Math.abs(Math.cos((leaf ? 0.09 : 0.11) * t + 2 * ph)),
    blink: 1,
  };
}

/** One of them, drawn at (x, y) — its centre — in whatever space the parent is in. */
export const DriftShape: React.FC<{ kind: DriftKind; x: number; y: number; size: number; rot?: number; flip?: number; opacity: number; blink?: number; blur?: number }> = ({
  kind,
  x,
  y,
  size,
  rot = 0,
  flip = 1,
  opacity,
  blink = 1,
  blur = 1.1,
}) => {
  if (opacity <= 0.005) return null;
  const box = (w: number, h: number): React.CSSProperties => ({
    position: "absolute",
    left: x - w / 2,
    top: y - h / 2,
    width: w,
    height: h,
    opacity,
    filter: `blur(${blur}px)`,
    transform: `rotate(${rot.toFixed(1)}deg) scaleY(${flip.toFixed(3)})`,
  });
  if (kind === "leaf") {
    const w = 18 * size, h = 13 * size;
    return <span style={{ ...box(w, h), borderRadius: `${w}px ${w}px 3px 3px`, background: "linear-gradient(180deg, #e2b04a, #c98f2c)" }} />;
  }
  if (kind === "petal") {
    const w = 15 * size, h = 10 * size;
    return <span style={{ ...box(w, h), borderRadius: "50%", background: "radial-gradient(circle at 50% 70%, #e8a2ad, #f8e2e1 70%)" }} />;
  }
  if (kind === "snow") {
    const d = 8 * size;
    return <span style={{ ...box(d, d), borderRadius: "50%", background: "radial-gradient(circle, #ffffff 30%, #c8d0dc 100%)", transform: undefined }} />;
  }
  const d = 6 * size;
  return (
    <span
      style={{
        ...box(d, d),
        transform: undefined,
        borderRadius: "50%",
        background: "#c9d24a",
        boxShadow: `0 0 ${10 * size}px ${4 * size}px rgba(214,224,92,${(0.55 * blink).toFixed(3)})`,
        opacity: opacity * blink,
      }}
    />
  );
};
