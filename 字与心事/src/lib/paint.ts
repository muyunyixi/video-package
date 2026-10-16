// Procedural 写意 painting helpers: branches, leaves, blossoms (canvas 2D).
import { mulberry32 } from "./util";

type Ctx = CanvasRenderingContext2D;

export type BranchOpts = {
  seed: number;
  x: number;
  y: number;
  angle: number; // radians, 0 = right, -PI/2 = up
  length: number;
  width: number;
  depth: number;
  ink: string; // "r,g,b"
  spread?: number;
  droop?: number; // gravity bend per segment
  onTip?: (ctx: Ctx, x: number, y: number, ang: number, level: number, r: () => number) => void;
  /** stop growing past a point (keeps a bough out of the text or the HUD) */
  prune?: (x: number, y: number) => boolean;
  /** called after every brush step of a limb (for snow on the upper side, moss, etc.) */
  onSeg?: (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number, ang: number, level: number, r: () => number) => void;
  /** v4.0: told how far along the bough (path length from its root, px) each stroke is, before it
   *  is drawn — so a second pass can paint a map of when every part of the bough grows */
  onDist?: (d: number) => void;
};

/** A tapered, slightly gnarled brush stroke tree. */
export function drawBranch(ctx: Ctx, o: BranchOpts) {
  const r = mulberry32(o.seed);
  const spread = o.spread ?? 0.6;
  const droop = o.droop ?? 0.04;
  const seg = (x: number, y: number, ang: number, len: number, w: number, level: number, d0 = 0) => {
    // one limb as several short strokes with jitter: reads as a brush, not a line
    const steps = Math.max(3, Math.round(len / 14));
    let px = x, py = y, a = ang;
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * 0.18 + droop * Math.cos(a);
      const step = len / steps;
      o.onDist?.(d0 + (i + 1) * step);
      const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
      const t = i / steps;
      const ww = w * (1 - t * 0.55);
      ctx.strokeStyle = `rgba(${o.ink},${0.78 + r() * 0.2})`;
      ctx.lineWidth = Math.max(0.6, ww);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      o.onSeg?.(ctx, px, py, nx, ny, ww, a, level, r);
      // knots and dry-brush flecks
      if (r() < 0.12 && ww > 3) {
        ctx.fillStyle = `rgba(${o.ink},0.85)`;
        ctx.beginPath();
        ctx.ellipse(nx, ny, ww * 0.7, ww * 0.45, a, 0, Math.PI * 2);
        ctx.fill();
      }
      px = nx;
      py = ny;
    }
    o.onDist?.(d0 + len);
    if (level >= o.depth || len < 12 || o.prune?.(px, py)) {
      o.onTip?.(ctx, px, py, a, level, r);
      return;
    }
    const kids = r() < 0.35 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const da = (k - (kids - 1) / 2) * spread + (r() - 0.5) * 0.5;
      const nl = len * (0.62 + r() * 0.2);
      // a limb that would grow into a kept-clear area is never started
      if (o.prune?.(px + Math.cos(a + da) * nl, py + Math.sin(a + da) * nl)) continue;
      seg(px, py, a + da, nl, w * 0.62, level + 1, d0 + len);
      o.onDist?.(d0 + len);
    }
    if (r() < 0.6) o.onTip?.(ctx, px, py, a, level, r);
  };
  seg(o.x, o.y, o.angle, o.length, o.width, 0);
}

/** A cluster of leaf dabs (two inks: dense and wet). */
export function leafCluster(ctx: Ctx, x: number, y: number, ang: number, r: () => number, size = 26, ink = "20,34,26", ink2 = "46,70,52") {
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = ang + (r() - 0.5) * 2.4;
    const L = size * (0.7 + r() * 0.6);
    const cx = x + Math.cos(a) * L * 0.5, cy = y + Math.sin(a) * L * 0.5;
    ctx.fillStyle = `rgba(${r() < 0.6 ? ink : ink2},${0.7 + r() * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, L * 0.55, L * 0.2, a, 0, Math.PI * 2);
    ctx.fill();
    // a vein left by the brush
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * L * 0.45, cy - Math.sin(a) * L * 0.45);
    ctx.lineTo(cx + Math.cos(a) * L * 0.45, cy + Math.sin(a) * L * 0.45);
    ctx.stroke();
  }
}

/** A five-petal blossom (杏 / 海棠) in pale wash with a dark heart. */
export function blossom(ctx: Ctx, x: number, y: number, r: () => number, size = 14, petal = "246,236,238", heart = "120,40,50") {
  const rot = r() * Math.PI * 2;
  const open = 0.6 + r() * 0.4;
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2;
    ctx.fillStyle = `rgba(${petal},${0.72 + r() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * size * 0.55 * open, y + Math.sin(a) * size * 0.55 * open, size * 0.5, size * 0.38, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(${heart},0.85)`;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5 + 0.1) * Math.PI * 2;
    ctx.fillStyle = "rgba(210,170,60,0.8)";
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * size * 0.28, y + Math.sin(a) * size * 0.28, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function bud(ctx: Ctx, x: number, y: number, r: () => number, size = 6, ink = "150,50,62") {
  ctx.fillStyle = `rgba(${ink},${0.75 + r() * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.6, size, r() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
}

/** 杏花: five round petals, white with a pink flush at the heart, a reflexed red calyx
 *  showing between them, and a spray of stamens. `tint` warms it (lamp light). */
export function apricot(ctx: Ctx, x: number, y: number, r: () => number, size = 16, tint = 0) {
  const rot = r() * Math.PI * 2;
  const open = 0.72 + r() * 0.28;
  // calyx between the petals, bent back
  for (let i = 0; i < 5; i++) {
    const a = rot + ((i + 0.5) / 5) * Math.PI * 2;
    ctx.fillStyle = `rgba(118,26,36,${0.7 + r() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * size * 0.5, y + Math.sin(a) * size * 0.5, size * 0.2, size * 0.09, a, 0, Math.PI * 2);
    ctx.fill();
  }
  const pr = Math.round(252 - tint * 4), pg = Math.round(240 - tint * 22), pb = Math.round(236 - tint * 40);
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2 + (r() - 0.5) * 0.2;
    ctx.fillStyle = `rgba(${pr},${pg},${pb},${0.8 + r() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * size * 0.48 * open, y + Math.sin(a) * size * 0.48 * open, size * 0.45, size * 0.39, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // the pink flush at the heart
  const g = ctx.createRadialGradient(x, y, 0, x, y, size * 0.55);
  g.addColorStop(0, "rgba(222,104,124,0.8)");
  g.addColorStop(0.55, "rgba(236,150,160,0.32)");
  g.addColorStop(1, "rgba(236,150,160,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // stamens
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 11; i++) {
    const a = r() * Math.PI * 2, L = size * (0.28 + r() * 0.24);
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
    ctx.strokeStyle = "rgba(196,110,104,0.75)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = "rgba(236,192,84,0.95)";
    ctx.beginPath();
    ctx.arc(ex, ey, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A flower bud: plump and pointed, coloured at the tip, held in a dark calyx cup. */
export function flowerBud(ctx: Ctx, x: number, y: number, ang: number, r: () => number, size = 7, tip = "214,96,118", cup = "92,34,36") {
  const a = ang + (r() - 0.5) * 0.9;
  const cx = x + Math.cos(a) * size * 0.6, cy = y + Math.sin(a) * size * 0.6;
  ctx.fillStyle = `rgba(${tip},${0.82 + r() * 0.15})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, size, size * 0.62, a, 0, Math.PI * 2);
  ctx.fill();
  // a highlight down one side
  ctx.fillStyle = "rgba(255,236,236,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx + Math.cos(a - 1.2) * size * 0.2, cy + Math.sin(a - 1.2) * size * 0.2, size * 0.55, size * 0.18, a, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${cup},0.9)`;
  ctx.beginPath();
  ctx.ellipse(x + Math.cos(a) * size * 0.05, y + Math.sin(a) * size * 0.05, size * 0.42, size * 0.5, a, 0, Math.PI * 2);
  ctx.fill();
}
