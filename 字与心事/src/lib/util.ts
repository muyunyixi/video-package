// Shared math, easing and deterministic randomness.
export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const BEAT = 15;
export const BAR = 60;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = lerp;
/** 0..1 progress of frame f between a and b (clamped). */
export const prog = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const easeInOutExpo = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeInQuart = (t: number) => t * t * t * t;

/** Damped spring response, 0 -> 1, t in seconds. */
export const spring = (t: number, freq = 4, damp = 0.45) => {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  return 1 - Math.exp(-damp * w * t) * Math.cos(w * Math.sqrt(1 - damp * damp) * t);
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export const COLORS = {
  // 墨 / 宣 / 朱砂, plus 黛 and 月白 for the night half
  ink: "#161519",
  inkSoft: "#3a3836",
  night: "#0a0b0e",
  paper: "#ece9e1",
  paperDeep: "#d9d4c9",
  vermilion: "#c0302c",
  vermilionHot: "#e2493f",
  bone: "#efebe3",
  gray: "#8a8782",
  dai: "#141b2b",
  daiDeep: "#0b101b",
  moon: "#e6ecef",
  amber: "#e5a652",
};

export const HW = '"HW"';
export const SANS = '"Noto Sans CJK SC"';
export const SERIF = '"Noto Serif CJK SC"';
