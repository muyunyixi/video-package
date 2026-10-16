// The two branches of 与君南北不同春, shared by the spring fold and the midnight fold.
// South (left, his side): 杏花春雨 — an apricot bough in full bloom, wet, under a warm lamp.
// North (right, hers): a peach bough (桃) still bare, only buds, a little old snow on top.
import { makeCanvas } from "./glyph";
import { drawBranch, apricot, flowerBud } from "./paint";

/** South: an apricot bough in full bloom (1100×1160). */
export function southBranchCanvas(_sill = false) {
  const c = makeCanvas(1100, 1160);
  paintSouth(c.getContext("2d")!);
  return c;
}
function paintSouth(ctx: CanvasRenderingContext2D, onDist?: (d: number) => void, onFlower?: (x: number, y: number, s: number) => void) {
  const ink = "24,17,14";
  // (v4.1: onFlower is told where every open flower is, for the petals 子正's wind takes off them;
  // it draws nothing and takes nothing from the random sequence, so the bough is unchanged)
  const flower = (cx: CanvasRenderingContext2D, x: number, y: number, r: () => number, s: number, tilt: number) => {
    apricot(cx, x, y, r, s, tilt);
    onFlower?.(x, y, s);
  };
  // 花依枝: apricot flowers sit right on the twigs, singly or in twos, short-stalked — so they
  // are scattered along the limbs (onSeg), thinning towards the old wood, with buds at the tips
  const along = (cx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, a: number, lvl: number, r: () => number) => {
    if (lvl < 1) return;
    const p = lvl <= 1 ? 0.22 : lvl === 2 ? 0.46 : 0.62;
    if (r() > p) return;
    const t = r();
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const side = r() < 0.5 ? 1 : -1;
    const sz = (lvl >= 4 ? 11 : 13) + r() * 8;
    const off = w * 0.5 + sz * 0.25;
    const fx = x + Math.cos(a + side * Math.PI / 2) * off, fy = y + Math.sin(a + side * Math.PI / 2) * off;
    if (r() < 0.16) flowerBud(cx, x, y, a + side * 1.1, r, 4.5 + r() * 2);
    else flower(cx, fx, fy, r, sz, r() * 0.25);
    if (r() < 0.38) flower(cx, fx + (r() - 0.5) * sz, fy + (r() - 0.5) * sz, r, sz * 0.85, r() * 0.25);
    if (r() < 0.14) flowerBud(cx, fx + (r() - 0.5) * sz * 1.4, fy + (r() - 0.5) * sz * 1.4, a + side, r, 4 + r() * 2);
  };
  const tips = (cx: CanvasRenderingContext2D, x: number, y: number, a: number, lvl: number, r: () => number) => {
    if (lvl < 3) return;
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      if (r() < 0.45) flowerBud(cx, x, y, a + (r() - 0.5) * 1.4, r, 4.5 + r() * 2.5);
      else flower(cx, x + Math.cos(a) * 6, y + Math.sin(a) * 6, r, 10 + r() * 6, r() * 0.25);
    }
  };
  // a main bough arching down from the upper left, a second rising from the lower left,
  // and a short spur between them — three directions, open space in the middle
  // keep clear of the fold (the poem stands there) and of the bottom edge (the credit line)
  const prune = (x: number, y: number) => x > 860 || y > 1040 || y < 20;
  drawBranch(ctx, { seed: 12, x: -40, y: 40, angle: 0.55, length: 470, width: 30, depth: 3, ink, spread: 0.55, droop: 0.022, onTip: tips, onSeg: along, prune, onDist });
  drawBranch(ctx, { seed: 29, x: -40, y: 780, angle: -0.32, length: 300, width: 20, depth: 3, ink, spread: 0.6, droop: 0.03, onTip: tips, onSeg: along, prune, onDist });
}

/** North: a bare peach bough, buds only, old snow lying along the tops of the limbs (1100×1160). */
export function northBranchCanvas(_sill = false) {
  const c = makeCanvas(1100, 1160);
  paintNorth(c.getContext("2d")!);
  return c;
}
function paintNorth(ctx: CanvasRenderingContext2D, onDist?: (d: number) => void, onSnow?: (x0: number, y0: number, x1: number, y1: number, th: number) => void) {
  const ink = "14,13,17";
  // peach flower buds come in pairs either side of a tiny leaf bud
  const buds = (cx: CanvasRenderingContext2D, x: number, y: number, a: number, lvl: number, r: () => number) => {
    const n = lvl >= 4 ? 2 + Math.floor(r() * 2) : r() < 0.6 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1;
      const aa = a + side * (0.5 + r() * 0.5);
      flowerBud(cx, x + Math.cos(a) * k * 5, y + Math.sin(a) * k * 5, aa, r, 4.5 + r() * 2.5, "204,112,136", "84,66,58");
    }
    if (n > 0 && r() < 0.5) {
      cx.fillStyle = "rgba(92,104,82,0.85)";
      cx.beginPath();
      cx.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 2.2, 3.4, a, 0, Math.PI * 2);
      cx.fill();
    }
  };
  // old snow on the upper side of the stouter, flatter limbs, broken into patches
  const snow = (cx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, a: number, _l: number, r: () => number) => {
    if (w < 2.6 || Math.abs(Math.sin(a)) > 0.62 || r() < 0.3) return;
    let nx = Math.sin(a), ny = -Math.cos(a);
    if (ny > 0) { nx = -nx; ny = -ny; }
    const off = w * 0.42;
    const th = Math.min(6, 1.4 + w * 0.32) * (0.6 + r() * 0.5);
    cx.strokeStyle = `rgba(226,232,240,${0.72 + r() * 0.24})`;
    cx.lineWidth = th;
    cx.lineCap = "round";
    cx.beginPath();
    cx.moveTo(x0 + nx * off, y0 + ny * off);
    cx.lineTo(x1 + nx * off, y1 + ny * off);
    cx.stroke();
    onSnow?.(x0 + nx * off, y0 + ny * off, x1 + nx * off, y1 + ny * off, th);
  };
  // keep the corner under the clock (the HUD) and the fold clear
  const northPrune = (x: number, y: number) => (x > 560 && y < 250) || x < 150 || y > 1040;
  drawBranch(ctx, {
    seed: 31, x: 1140, y: 430, angle: Math.PI + 0.1, length: 330, width: 24, depth: 5, ink, spread: 0.46, droop: -0.006,
    onTip: buds, onSeg: snow, prune: northPrune, onDist,
  });
  drawBranch(ctx, {
    seed: 47, x: 1140, y: 820, angle: Math.PI + 0.18, length: 220, width: 15, depth: 4, ink, spread: 0.55, droop: -0.022,
    onTip: buds, onSeg: snow, prune: northPrune, onDist,
  });
}

/** v4.1: where the open flowers are on the south bough (canvas px of its 1100×1160 canvas; s = size). */
export function southFlowers() {
  const out: { x: number; y: number; s: number }[] = [];
  paintSouth(makeCanvas(4, 4).getContext("2d")!, undefined, (x, y, s) => out.push({ x, y, s }));
  return out;
}
/** v4.1: where the old snow lies on the north bough (canvas px; each stroke from (x0, y0) to (x1, y1)). */
export function northSnow() {
  const out: { x0: number; y0: number; x1: number; y1: number; th: number }[] = [];
  paintNorth(makeCanvas(4, 4).getContext("2d")!, undefined, (x0, y0, x1, y1, th) => out.push({ x0, y0, x1, y1, th }));
  return out;
}

/**
 * v4.0: when each part of a bough grows. The same strokes are painted again into a second canvas,
 * every one in a grey that says how far along the bough it is (path length from the root at the
 * frame's edge, over the bough's full length), so a shader can let the bough grow from the edge
 * of the frame towards the fold: limbs first, the flowers and buds as the growth reaches them.
 * Returns the map (red = growth time 0…1, alpha = covered).
 */
export function growthMap(side: "south" | "north") {
  const c = makeCanvas(1100, 1160);
  const real = c.getContext("2d")!;
  // pass 1: the longest path, so the greys use the whole range
  let maxD = 1;
  const probe = makeCanvas(4, 4).getContext("2d")!;
  (side === "south" ? paintSouth : paintNorth)(probe, (d) => (maxD = Math.max(maxD, d)));
  let cur = 0;
  const grey = () => {
    const v = Math.round(255 * Math.min(1, cur / maxD));
    return `rgb(${v},${v},${v})`;
  };
  // pass 2: every fill and stroke is painted in the grey of the point it belongs to
  const ctx = new Proxy(real, {
    get(t, k) {
      const v = (t as any)[k];
      return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, k, v) {
      (t as any)[k] = k === "fillStyle" || k === "strokeStyle" ? grey() : v;
      return true;
    },
  }) as CanvasRenderingContext2D;
  (side === "south" ? paintSouth : paintNorth)(ctx, (d) => (cur = d));
  return c;
}
