// v4.0 · the rooftops under the moon, in two layers (the far one drifts less as the eye moves).
// v3.1 had one strip of flat black shapes; the north's read as black boxes. Now:
// - south (his side): 粉墙黛瓦 — whitewashed walls catching the moon, black-tiled roofs, and the
//   stepped gable walls of the south (马头墙), each step capped with tile that lifts at its ends;
// - north (hers): pitched roofs under old snow, the snow bright on the slopes and along the
//   ridges, dark brick below; a few flat roofs with snow lying on them.
// The far layer is the same town further off, in the haze of each half's air: low in contrast,
// so the poem's second line can stand over it. The near houses keep below the poem: lower in
// the middle (where the lines are, and the credit), taller towards the edges.
// Canvas px: x as the frame, y = layer y − TOP.
import { makeCanvas } from "./glyph";
import { mulberry32 } from "./util";
import { lanternLattice } from "./lattice";

export const ROOF_TOP = 780; // the canvas's top edge in the layer's px
export const ROOF_H = 380;

type C = CanvasRenderingContext2D;
type RGB = [number, number, number];
const rgb = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round) as RGB;

type SouthPal = { wallTop: RGB; wallFoot: RGB; tile: RGB; rim: [number, number, number, number]; stain: number; win: RGB };
type NorthPal = { wall: RGB; tile: RGB; snow: RGB; snowShade: RGB; win: RGB };

/** a whitewashed wall face: lit from above by the moon, rain-stained under its caps */
function wallFace(ctx: C, x0: number, x1: number, y0: number, y1: number, p: SouthPal, r: () => number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgb(p.wallTop));
  g.addColorStop(1, rgb(p.wallFoot));
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // old lime plaster: soft patches a shade lighter or darker, and a fine grain
  const area = (x1 - x0) * Math.max(0, Math.min(y1, ROOF_H) - y0);
  for (let i = 0; i < area / 2600; i++) {
    const px = x0 + r() * (x1 - x0), py = y0 + r() * (Math.min(y1, ROOF_H) - y0), pr = 8 + r() * 26;
    const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    pg.addColorStop(0, r() < 0.5 ? `rgba(255,248,236,${0.035 + r() * 0.035})` : `rgba(20,16,14,${0.04 + r() * 0.04})`);
    pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pg;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  for (let i = 0; i < area / 90; i++) {
    ctx.fillStyle = r() < 0.5 ? "rgba(255,250,240,0.05)" : "rgba(10,8,8,0.06)";
    ctx.fillRect(x0 + r() * (x1 - x0), y0 + r() * (Math.min(y1, ROOF_H) - y0), 1 + r(), 1 + r());
  }
  // 水渍: soft streaks running down from the caps
  const n = Math.round((x1 - x0) / 28);
  for (let i = 0; i < n; i++) {
    const sx = x0 + r() * (x1 - x0), sw = 3 + r() * 10, sl = 12 + r() * 50;
    const s = ctx.createLinearGradient(0, y0, 0, y0 + sl);
    s.addColorStop(0, `rgba(30,26,24,${p.stain * (0.5 + r() * 0.5)})`);
    s.addColorStop(1, "rgba(30,26,24,0)");
    ctx.fillStyle = s;
    ctx.fillRect(sx, y0, sw, sl);
  }
}

/** a tile cap along a wall top from xa to xb at height y, lifting at its ends (印斗 / 鹊尾) */
function cap(ctx: C, xa: number, xb: number, y: number, th: number, p: SouthPal, ends: [boolean, boolean]) {
  const o = 5; // the cap overhangs the wall
  ctx.fillStyle = rgb(p.tile);
  ctx.beginPath();
  ctx.moveTo(xa - o, y + th);
  ctx.lineTo(xa - o, y);
  ctx.lineTo(xb + o, y);
  ctx.lineTo(xb + o, y + th);
  ctx.closePath();
  ctx.fill();
  for (const [on, sd, xe] of [[ends[0], -1, xa - o], [ends[1], 1, xb + o]] as [boolean, number, number][]) {
    if (!on) continue;
    ctx.beginPath();
    ctx.moveTo(xe - sd * 9, y);
    ctx.quadraticCurveTo(xe + sd * 1, y - 1, xe + sd * 5, y - 8);
    ctx.lineTo(xe + sd * 6, y - 6);
    ctx.quadraticCurveTo(xe + sd * 4, y + th * 0.5, xe - sd * 1, y + th);
    ctx.closePath();
    ctx.fill();
  }
  // moonlight along the top of the tiles
  ctx.strokeStyle = `rgba(${p.rim[0]},${p.rim[1]},${p.rim[2]},${p.rim[3]})`;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(xa - o + 2, y + 0.6);
  ctx.lineTo(xb + o - 2, y + 0.6);
  ctx.stroke();
}

/** 马头墙: a gable wall stepping up to the middle, every step capped */
function gableHouse(ctx: C, cx: number, w: number, top: number, steps: number, dh: number, p: SouthPal, r: () => number, win?: { x: number; y: number }) {
  const wc = w * 0.3, ws = (w - wc) / (2 * steps);
  // the wall body under the lowest steps, then each step on top
  for (let j = steps; j >= 0; j--) {
    const y = top + j * dh, half = wc / 2 + j * ws;
    wallFace(ctx, cx - half, cx + half, y, ROOF_H, p, r);
  }
  for (let j = 0; j <= steps; j++) {
    const y = top + j * dh, half = wc / 2 + j * ws;
    if (j === 0) cap(ctx, cx - half, cx + half, y - 7, 7, p, [true, true]);
    else {
      cap(ctx, cx - half, cx - half + ws, y - 7, 7, p, [true, false]);
      cap(ctx, cx + half - ws, cx + half, y - 7, 7, p, [false, true]);
    }
  }
  // a small high window or two
  const wy = top + (steps + 1) * dh + 16;
  if (win) litWindow(ctx, win.x, win.y, 22, 16, p.win);
  else if (r() < 0.7) darkWindow(ctx, cx - 8 + (r() - 0.5) * w * 0.3, wy, 14, 18);
}

/** an eave-side house: a long black-tiled roof with lifted ends over a white wall */
function eaveHouse(ctx: C, x0: number, w: number, top: number, p: SouthPal, r: () => number, shade = 0) {
  const rh = 22 + r() * 6; // the roof's visible depth
  const wall = shade > 0 ? { ...p, wallTop: mixc(p.wallTop, p.tile, shade), wallFoot: mixc(p.wallFoot, p.tile, shade) } : p;
  wallFace(ctx, x0 + 6, x0 + w - 6, top + rh, ROOF_H, wall, r);
  ctx.fillStyle = rgb(p.tile);
  ctx.beginPath();
  ctx.moveTo(x0 - 8, top + rh);
  ctx.quadraticCurveTo(x0 + 6, top + rh - 2, x0 + w * 0.1, top + 3);
  ctx.lineTo(x0 + w * 0.9, top + 3);
  ctx.quadraticCurveTo(x0 + w - 6, top + rh - 2, x0 + w + 8, top + rh);
  ctx.closePath();
  ctx.fill();
  // tile rows: faint lines down the slope
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = x0 + w * 0.1 + 4; x < x0 + w * 0.9; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, top + 4);
    ctx.lineTo(x + (x - (x0 + w / 2)) * 0.05, top + rh - 1);
    ctx.stroke();
  }
  // the ridge, lifted at both ends
  ctx.fillStyle = rgb(p.tile);
  for (const sd of [-1, 1]) {
    const xe = sd < 0 ? x0 + w * 0.1 : x0 + w * 0.9;
    ctx.beginPath();
    ctx.moveTo(xe - sd * 16, top + 3);
    ctx.quadraticCurveTo(xe, top + 2, xe + sd * 5, top - 6);
    ctx.lineTo(xe + sd * 3, top + 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = `rgba(${p.rim[0]},${p.rim[1]},${p.rim[2]},${p.rim[3]})`;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x0 + w * 0.1, top + 3.6);
  ctx.lineTo(x0 + w * 0.9, top + 3.6);
  ctx.stroke();
}

function darkWindow(ctx: C, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(14,12,12,0.9)";
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
}
function litWindow(ctx: C, x: number, y: number, w: number, h: number, c: RGB) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.8);
  g.addColorStop(0, rgb(c, 1));
  g.addColorStop(1, rgb(mixc(c, [120, 60, 20], 0.35), 1));
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  // window lattice
  ctx.strokeStyle = "rgba(60,30,12,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x, y + h / 2);
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
}

/** a northern house from its eave side: dark brick, and a roof slope lying under old snow */
function snowHouse(ctx: C, x0: number, w: number, top: number, p: NorthPal, r: () => number, win?: { x: number; y: number }, flat = false) {
  const rh = flat ? 10 : 30 + r() * 10;
  ctx.fillStyle = rgb(p.wall);
  ctx.fillRect(x0, top + rh - 2, w, ROOF_H);
  // brick courses, barely there
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = top + rh + 6; y < ROOF_H; y += 9) ctx.fillRect(x0, y, w, 1);
  if (flat) {
    // a parapet with snow lying along it
    ctx.fillStyle = rgb(p.tile);
    ctx.fillRect(x0 - 3, top, w + 6, rh);
    snowLine(ctx, x0 - 3, x0 + w + 3, top, 4, p, r);
  } else {
    // the roof slope seen from below the eave: a trapezoid, snow over most of it
    const inset = rh * 0.5;
    ctx.fillStyle = rgb(p.tile);
    ctx.beginPath();
    ctx.moveTo(x0 - 10, top + rh);
    ctx.lineTo(x0 + inset, top);
    ctx.lineTo(x0 + w - inset, top);
    ctx.lineTo(x0 + w + 10, top + rh);
    ctx.closePath();
    ctx.fill();
    // the snow: brightest along the ridge, thinning to a ragged edge just above the eave
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 - 10, top + rh);
    ctx.lineTo(x0 + inset, top);
    ctx.lineTo(x0 + w - inset, top);
    ctx.lineTo(x0 + w + 10, top + rh);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, top, 0, top + rh);
    g.addColorStop(0, rgb(p.snow));
    g.addColorStop(1, rgb(p.snowShade));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - 12, top - 2);
    ctx.lineTo(x0 + w + 12, top - 2);
    let x = x0 + w + 12;
    // the lower edge of the snow, ragged, with dark tile showing in places
    while (x > x0 - 12) {
      const y = top + rh * (0.62 + r() * 0.22);
      ctx.lineTo(x, y);
      x -= 6 + r() * 14;
    }
    ctx.closePath();
    ctx.fill();
    // tile rows under the snow
    ctx.strokeStyle = "rgba(20,24,34,0.25)";
    ctx.lineWidth = 1;
    for (let xx = x0 + inset + 5; xx < x0 + w - inset; xx += 9) {
      ctx.beginPath();
      ctx.moveTo(xx, top + 2);
      ctx.lineTo(xx + (xx - (x0 + w / 2)) * 0.06, top + rh);
      ctx.stroke();
    }
    ctx.restore();
    snowLine(ctx, x0 + inset - 2, x0 + w - inset + 2, top - 1, 3.5, p, r);
    // a chimney now and then, a cap of snow on it
    if (r() < 0.45) {
      const cxp = x0 + inset + r() * (w - 2 * inset - 16);
      ctx.fillStyle = rgb(p.wall);
      ctx.fillRect(cxp, top - 22, 14, 24);
      snowLine(ctx, cxp - 2, cxp + 16, top - 23, 3, p, r);
    }
  }
  if (!win)
    for (let k = 0; k < Math.floor(w / 90); k++)
      if (r() < 0.55) {
        const wx = x0 + 20 + r() * (w - 40), wy = top + rh + 20 + r() * 26;
        ctx.fillStyle = r() < 0.5 ? "rgba(150,168,196,0.32)" : "rgba(255,212,160,0.4)";
        ctx.fillRect(wx - 6, wy - 4, 12, 9);
      }
}
function snowLine(ctx: C, xa: number, xb: number, y: number, th: number, p: NorthPal, r: () => number) {
  let x = xa;
  while (x < xb) {
    const len = Math.min(xb - x, 18 + r() * 60);
    ctx.fillStyle = rgb(p.snow, 0.75 + r() * 0.25);
    ctx.beginPath();
    ctx.roundRect(x, y - th * 0.5, len, th * (0.8 + r() * 0.5), th);
    ctx.fill();
    x += len + (r() < 0.3 ? 3 + r() * 10 : 0);
  }
}

export type RoofCanvas = { canvas: HTMLCanvasElement; windows: { south: { x: number; y: number }; north: { x: number; y: number } } };

// ---------- v4.1 · his house and the wall of his yard, in the warm haze ----------
// v4.0's south was a row of whitewashed blocks, each with one small black window, side by side on a
// flat strip ("一块一块白的，上面只有一个小小的黑色窗户", the user). In v4.1 two tries at rows of houses
// (a village going back row behind row; then one row of gables with dark roofs between them) read as
// blocks with gaps and dark pieces between them. Now, plain: his house, its stepped gable wall (马头墙)
// with his window in it; the long whitewashed wall of his yard (粉墙黛瓦), tiled along its top, running
// from the frame's edge past his house to a smaller house near the crease, his gate in it. Nothing
// behind but the warm haze. The walls are lime plaster at night: a soft grey a little lighter than the
// air, not white. The moon is up to the right, so each wall is a shade darker on its left.
const HAZE_S: RGB = [122, 96, 73]; // the south's air over the roofs (measured in v4.0 at 43.0 s)
const MIST_S: RGB = [146, 116, 88]; // its mist, a little lighter: lit by the moon
type HuiPal = { wallTop: RGB; wallFoot: RGB; tile: RGB; rim: [number, number, number, number]; stain: number; win: RGB };
const HUI_NEAR: HuiPal = { wallTop: [160, 150, 136], wallFoot: [106, 97, 87], tile: [44, 42, 45], rim: [226, 210, 186, 0.42], stain: 0.16, win: [255, 190, 116] };
/** the near palette taken towards the air by h (0 near … 1 lost in it) */
const huiPal = (h: number, dark = 0): HuiPal => {
  const w = (c: RGB) => mixc(mixc(c, [24, 20, 20], dark), HAZE_S, h);
  return { wallTop: w(HUI_NEAR.wallTop), wallFoot: w(HUI_NEAR.wallFoot), tile: mixc(HUI_NEAR.tile, HAZE_S, h * 0.92), rim: [232, 216, 190, 0.5 * (1 - h)], stain: 0.2 * (1 - h), win: mixc(HUI_NEAR.win, HAZE_S, h * 0.5) };
};

/** a tiled cap on a wall top, xa…xb at height y, its ends lifting (座头) where the wall steps */
function huiCap(ctx: C, xa: number, xb: number, y: number, th: number, p: HuiPal, ends: [boolean, boolean]) {
  const o = Math.max(2, th * 0.7);
  ctx.fillStyle = rgb(p.tile);
  ctx.beginPath();
  ctx.moveTo(xa - o, y + th);
  ctx.lineTo(xa - o, y + th * 0.25);
  ctx.lineTo(xb + o, y + th * 0.25);
  ctx.lineTo(xb + o, y + th);
  ctx.closePath();
  ctx.fill();
  // the ridge tiles along the top, a little narrower
  ctx.fillRect(xa - o * 0.4, y - th * 0.15, xb - xa + o * 0.8, th * 0.45);
  for (const [on, sd, xe] of [[ends[0], -1, xa - o], [ends[1], 1, xb + o]] as [boolean, number, number][]) {
    if (!on) continue;
    const s = th / 7;
    ctx.beginPath();
    ctx.moveTo(xe - sd * 10 * s, y);
    ctx.quadraticCurveTo(xe + sd * 1 * s, y - 1 * s, xe + sd * 5 * s, y - 9 * s);
    ctx.lineTo(xe + sd * 6.5 * s, y - 7 * s);
    ctx.quadraticCurveTo(xe + sd * 4 * s, y + th * 0.5, xe - sd * 1 * s, y + th);
    ctx.closePath();
    ctx.fill();
  }
  // v5.5 · the slab as tiles, not an ink line (the user: "这黑色线条代表什么？在建筑中是什么逻辑？"): the
  // dark grey of 黛瓦, its rows of tiles, its upper face lit a little by the warm moon, a row of tile
  // ends (瓦当) along the eave — as much as the north's caps show (beiCap)
  {
    const lit = mixc(p.tile, [176, 158, 132], 0.3), deep = mixc(p.tile, [0, 0, 0], 0.15);
    const g = ctx.createLinearGradient(0, y + th * 0.25, 0, y + th);
    g.addColorStop(0, rgb(lit));
    g.addColorStop(1, rgb(p.tile));
    ctx.fillStyle = g;
    ctx.fillRect(xa - o, y + th * 0.25, xb - xa + 2 * o, th * 0.75);
    ctx.fillStyle = rgb(deep, 0.7);
    for (let x = xa - o + 2; x < xb + o - 1; x += 4) ctx.fillRect(x, y + th * 0.3, 1, th * 0.55);
    ctx.fillStyle = rgb(mixc(lit, [226, 210, 186], 0.35));
    for (let x = xa - o + 2; x < xb + o - 1; x += 4) ctx.fillRect(x, y + th - 1.2, 1.2, 1.2);
  }
  if (p.rim[3] > 0.01) {
    ctx.strokeStyle = `rgba(${p.rim[0]},${p.rim[1]},${p.rim[2]},${p.rim[3]})`;
    ctx.lineWidth = Math.max(0.8, th * 0.16);
    ctx.beginPath();
    ctx.moveTo(xa - o * 0.4 + 1, y - th * 0.1);
    ctx.lineTo(xb + o * 0.4 - 1, y - th * 0.1);
    ctx.stroke();
  }
  // the cap's shadow on the wall under it
  const sh = ctx.createLinearGradient(0, y + th, 0, y + th * 2.2);
  sh.addColorStop(0, `rgba(20,16,14,${0.32 * (p.rim[3] / 0.5)})`);
  sh.addColorStop(1, "rgba(20,16,14,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(xa, y + th, xb - xa, th * 1.2);
}

/** a small window; hood: a little tiled hood over it (窗罩); lit: warm, with its glow */
function huiWindow(ctx: C, x: number, y: number, w: number, h: number, p: HuiPal, o: { lit?: number; hood?: boolean; frameOnly?: boolean } = {}) {
  // the stone frame
  ctx.fillStyle = rgb(mixc(p.wallFoot, [90, 84, 78], 0.4));
  ctx.fillRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
  if (o.lit) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, w * 2.4);
    g.addColorStop(0, `rgba(${p.win[0]},${p.win[1]},${p.win[2]},${0.28 * o.lit})`);
    g.addColorStop(1, `rgba(${p.win[0]},${p.win[1]},${p.win[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 2.4, y - w * 2.4, w * 4.8, w * 4.8);
    ctx.fillStyle = rgb(mixc([60, 30, 14], p.win, o.lit));
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = `rgba(70,36,14,${0.6 * o.lit})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x, y + h / 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = o.frameOnly ? "rgba(12,10,10,0.95)" : rgb(mixc([16, 13, 12], p.wallFoot, 0.12));
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
  }
  if (o.hood) huiCap(ctx, x - w / 2 - 4, x + w / 2 + 4, y - h / 2 - Math.max(5, h * 0.42), Math.max(3, h * 0.26), p, [true, true]);
}

/** water stains: soft dark streaks running down a wall from under its caps */
function huiStains(ctx: C, x0: number, x1: number, y: number, len: number, p: HuiPal, r: () => number) {
  if (p.stain < 0.01) return;
  const n = Math.max(1, Math.round((x1 - x0) / 22));
  for (let i = 0; i < n; i++) {
    const sx = x0 + r() * (x1 - x0), sw = 2 + r() * 9, sl = len * (0.3 + r() * 0.9);
    const s = ctx.createLinearGradient(0, y, 0, y + sl);
    s.addColorStop(0, `rgba(36,30,26,${p.stain * (0.4 + r() * 0.6)})`);
    s.addColorStop(1, "rgba(36,30,26,0)");
    ctx.fillStyle = s;
    ctx.fillRect(sx, y, sw, sl);
  }
}

/** 马头墙: a gable wall stepping down from the middle, every step capped; windows in it */
function huiHouse(ctx: C, cx: number, w: number, top: number, steps: number, dh: number, p: HuiPal, r: () => number, wins: { x: number; y: number; w?: number; h?: number; lit?: number; hood?: boolean; frameOnly?: boolean }[] = [], bottom = ROOF_H) {
  const wc = w * 0.3, ws = (w - wc) / (2 * Math.max(1, steps));
  const th = Math.max(2.5, Math.min(8, w / 44)); // the caps, thinner on smaller houses
  // the wall: the outline steps up to the middle
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, bottom);
  for (let j = steps; j >= 0; j--) {
    const half = wc / 2 + j * ws, y = top + j * dh;
    ctx.lineTo(cx - half, y);
    ctx.lineTo(cx - (j > 0 ? half - ws : wc / 2), y);
  }
  for (let j = 0; j <= steps; j++) {
    const half = wc / 2 + j * ws, y = top + j * dh;
    ctx.lineTo(cx + (j > 0 ? half - ws : wc / 2), y);
    ctx.lineTo(cx + half, y);
  }
  ctx.lineTo(cx + w / 2, bottom);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, Math.min(bottom, top + 200));
  g.addColorStop(0, rgb(p.wallTop));
  g.addColorStop(1, rgb(p.wallFoot));
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2 - 2, top - 2, w + 4, bottom - top + 4);
  // the moon is up to the right: the left of the wall a shade darker
  const sd = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  sd.addColorStop(0, "rgba(16,12,10,0.16)");
  sd.addColorStop(0.6, "rgba(16,12,10,0.03)");
  sd.addColorStop(1, "rgba(16,12,10,0)");
  ctx.fillStyle = sd;
  ctx.fillRect(cx - w / 2 - 2, top - 2, w + 4, bottom - top + 4);
  // old lime plaster: soft patches, a shade lighter or darker
  const area = w * Math.min(bottom - top, 200);
  for (let i = 0; i < area / 2400; i++) {
    const px = cx - w / 2 + r() * w, py = top + r() * Math.min(bottom - top, 200), pr = 6 + r() * 22;
    const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    pg.addColorStop(0, r() < 0.5 ? `rgba(255,248,236,${0.04 * (p.rim[3] / 0.5)})` : `rgba(20,16,14,${0.05 * (p.rim[3] / 0.5)})`);
    pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pg;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  // stains under every cap, longer under the top ones
  for (let j = 0; j <= steps; j++) {
    const half = wc / 2 + j * ws, y = top + j * dh + th;
    if (j === 0) huiStains(ctx, cx - half, cx + half, y, 40 + dh * 2, p, r);
    else {
      huiStains(ctx, cx - half, cx - half + ws, y, 30 + dh, p, r);
      huiStains(ctx, cx + half - ws, cx + half, y, 30 + dh, p, r);
    }
  }
  // a darker foot, where the lane's damp rises into the plaster
  const ft = ctx.createLinearGradient(0, bottom - 60, 0, bottom);
  ft.addColorStop(0, "rgba(30,24,20,0)");
  ft.addColorStop(1, `rgba(30,24,20,${0.25 * (p.rim[3] / 0.5)})`);
  ctx.fillStyle = ft;
  ctx.fillRect(cx - w / 2, bottom - 60, w, 60);
  ctx.restore();
  for (let j = 0; j <= steps; j++) {
    const half = wc / 2 + j * ws, y = top + j * dh - th;
    if (j === 0) huiCap(ctx, cx - half, cx + half, y, th, p, [true, true]);
    else {
      huiCap(ctx, cx - half, cx - half + ws, y, th, p, [true, false]);
      huiCap(ctx, cx + half - ws, cx + half, y, th, p, [false, true]);
    }
  }
  for (const wi of wins) huiWindow(ctx, wi.x, wi.y, wi.w ?? Math.max(5, w * 0.055), wi.h ?? Math.max(6, w * 0.07), p, wi);
}

/** a band of mist lying along y (its densest line), h deep; soft-edged, a little uneven */
function huiMist(ctx: C, x0: number, x1: number, y: number, h: number, a: number, r: () => number, col: RGB = MIST_S) {
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, rgb(col, 0));
  g.addColorStop(0.5, rgb(col, a));
  g.addColorStop(1, rgb(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x0, y - h, x1 - x0, 2 * h);
  for (let i = 0; i < (x1 - x0) / 40; i++) {
    const px = x0 + r() * (x1 - x0), py = y + (r() - 0.5) * h, rx = 40 + r() * 90, ry = h * (0.3 + r() * 0.3);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    const b = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    b.addColorStop(0, rgb(col, a * (0.2 + r() * 0.3)));
    b.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = b;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
}

/** keep a drawing to the south half (the crease is at 960) */
const southOnly = (ctx: C, draw: () => void) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-50, -50, 1008, ROOF_H + 100);
  ctx.clip();
  draw();
  ctx.restore();
};

// ---------- v5.5 · her side: a hutong under old snow ----------
// v4.0's north was four dark navy boxes with roofs of evenly spaced straight stripes (they read as
// corrugated iron) and a flat-topped block at the edge (it read as a modern building) — drawn more
// roughly than the south after v4.1 (the user: "总觉得右边的房子有点丑"). Now the north as the south's
// counterpart: grey brick (青砖) and grey tile (灰瓦) under old snow — the snow lying in the furrows between
// the rows of round tiles, a row of tile ends (瓦当) along each eave, the main ridge capped with snow and
// lifting at its ends (蝎子尾); her house with a lattice window; the courtyard wall from the crease; her
// gate (门楼) at the edge with its dark red doors. The moon is up to the left: every wall a shade darker
// on its right. A cold mist low along the lane, as the south has its warm one.
const HAZE_N: RGB = [51, 66, 92]; // the north's air over the roofs (measured at frame 1420)
const MIST_N: RGB = [74, 90, 120];
type BeiPal = { brickTop: RGB; brickFoot: RGB; tile: RGB; tileLit: RGB; snow: RGB; snowShade: RGB; wood: RGB; door: RGB; win: RGB };
const BEI_NEAR: BeiPal = { brickTop: [96, 102, 118], brickFoot: [50, 55, 68], tile: [26, 29, 37], tileLit: [64, 70, 84], snow: [206, 214, 230], snowShade: [126, 140, 166], wood: [52, 32, 28], door: [104, 34, 28], win: [255, 214, 162] };
const beiPal = (h: number): BeiPal => {
  const w = (c: RGB) => mixc(c, HAZE_N, h);
  return { brickTop: w(BEI_NEAR.brickTop), brickFoot: w(BEI_NEAR.brickFoot), tile: w(BEI_NEAR.tile), tileLit: w(BEI_NEAR.tileLit), snow: w(BEI_NEAR.snow), snowShade: w(BEI_NEAR.snowShade), wood: w(BEI_NEAR.wood), door: w(BEI_NEAR.door), win: BEI_NEAR.win };
};
const northOnly = (ctx: C, draw: () => void) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(960, -50, 1010, ROOF_H + 100);
  ctx.clip();
  draw();
  ctx.restore();
};

/** a grey brick wall face x0…x1 from top down: courses, the odd brick a shade off, darker to the right */
function beiWall(ctx: C, x0: number, x1: number, top: number, p: BeiPal, r: () => number, bottom = ROOF_H) {
  const g = ctx.createLinearGradient(0, top, 0, Math.min(bottom, top + 170));
  g.addColorStop(0, rgb(p.brickTop));
  g.addColorStop(1, rgb(p.brickFoot));
  ctx.fillStyle = g;
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  // the moon is up to the left: the right of the wall a shade darker
  const sd = ctx.createLinearGradient(x0, 0, x1, 0);
  sd.addColorStop(0, "rgba(8,10,16,0)");
  sd.addColorStop(0.5, "rgba(8,10,16,0.05)");
  sd.addColorStop(1, "rgba(8,10,16,0.22)");
  ctx.fillStyle = sd;
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  // courses: a fine light mortar line every 6 px, the joints staggered
  for (let y = top + 5, k = 0; y < bottom; y += 6, k++) {
    ctx.fillStyle = "rgba(200,210,226,0.07)";
    ctx.fillRect(x0, y, x1 - x0, 1);
    ctx.fillStyle = "rgba(200,210,226,0.045)";
    for (let x = x0 + (k % 2 ? 7 : 0); x < x1; x += 14) ctx.fillRect(x, y - 5, 1, 5);
  }
  // the odd brick lighter or darker
  for (let i = 0; i < ((x1 - x0) * Math.min(bottom - top, 170)) / 260; i++) {
    const bx = x0 + Math.floor((r() * (x1 - x0)) / 14) * 14 + (r() < 0.5 ? 7 : 0), by = top + 5 + Math.floor((r() * Math.min(bottom - top, 170)) / 6) * 6 - 5;
    ctx.fillStyle = r() < 0.5 ? "rgba(220,228,240,0.05)" : "rgba(6,8,14,0.09)";
    ctx.fillRect(bx + 1, by, 13, 5);
  }
}

/** v5.5 · the north's cap on a yard wall or over a gate: huiCap's shape and size (so the caps of the two
 *  halves lie at the same heights and are as thin — the user: "墙上的屋檐部分可以搞窄一些的"), in grey tile:
 *  the slab with its rows of tiles, the ridge along the top with a thin line of snow on it, a row of
 *  tile ends along the eave, its shadow on the wall */
function beiCap(ctx: C, xa: number, xb: number, y: number, th: number, p: BeiPal, snow = 1.5) {
  const o = Math.max(2, th * 0.7);
  const g = ctx.createLinearGradient(0, y + th * 0.25, 0, y + th);
  g.addColorStop(0, rgb(p.tileLit));
  g.addColorStop(1, rgb(p.tile));
  ctx.fillStyle = g;
  ctx.fillRect(xa - o, y + th * 0.25, xb - xa + 2 * o, th * 0.75);
  ctx.fillStyle = rgb(p.tile, 0.55);
  for (let x = xa - o + 2; x < xb + o - 1; x += 4) ctx.fillRect(x, y + th * 0.3, 1, th * 0.55);
  ctx.fillStyle = rgb(p.tile);
  ctx.fillRect(xa - o * 0.4, y - th * 0.15, xb - xa + o * 0.8, th * 0.45);
  ctx.fillStyle = rgb(mixc(p.tileLit, p.snow, 0.4));
  for (let x = xa - o + 2; x < xb + o - 1; x += 4) ctx.fillRect(x, y + th - 1.2, 1.2, 1.2);
  ctx.fillStyle = rgb(p.snow);
  ctx.fillRect(xa - o * 0.4, y - th * 0.15 - snow + 0.5, xb - xa + o * 0.8, snow);
  const sh = ctx.createLinearGradient(0, y + th, 0, y + th * 1.6);
  sh.addColorStop(0, "rgba(8,10,16,0.35)");
  sh.addColorStop(1, "rgba(8,10,16,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(xa - o, y + th, xb - xa + 2 * o, th * 0.6);
}

/** a row of round tiles under snow, seen from the front: eave at eaveY, ridge at ridgeY; the ridge
 *  capped and lifting at its ends (蝎子尾); tile ends along the eave; its shadow on the wall below */
function beiRoof(ctx: C, x0: number, x1: number, ridgeY: number, eaveY: number, p: BeiPal, r: () => number, o: { tails?: boolean; ridge?: number; over?: number; cap?: number } = {}) {
  const over = o.over ?? 8, rh = o.ridge ?? 7;
  const ea = x0 - over, eb = x1 + over;
  // the slope: dark tile
  ctx.fillStyle = rgb(p.tile);
  ctx.beginPath();
  ctx.moveTo(ea, eaveY);
  ctx.lineTo(x0 + 2, ridgeY);
  ctx.lineTo(x1 - 2, ridgeY);
  ctx.lineTo(eb, eaveY);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // old snow over the slope: brightest along the ridge, thinning to a ragged edge a little above the
  // eave, where the dark tile shows
  // (second draft: the slope's snow a shade darker than the snow lying along the top, so that reads as
  // snow and not as a thicker eave — the user: "积雪的颜色和屋檐有点类似，看上去就相当于屋檐加粗了")
  const sg = ctx.createLinearGradient(0, ridgeY, 0, eaveY);
  sg.addColorStop(0, rgb(mixc(p.snow, p.tile, 0.3)));
  sg.addColorStop(0.75, rgb(mixc(p.snowShade, p.tile, 0.25)));
  sg.addColorStop(1, rgb(mixc(p.snowShade, p.tile, 0.4)));
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(ea - 2, ridgeY - 2);
  ctx.lineTo(eb + 2, ridgeY - 2);
  for (let x = eb + 2; x > ea - 2; x -= 5 + r() * 9) ctx.lineTo(x, ridgeY + (eaveY - ridgeY) * (0.7 + r() * 0.2));
  ctx.lineTo(ea - 2, ridgeY + (eaveY - ridgeY) * 0.8);
  ctx.closePath();
  ctx.fill();
  // the rows of round tiles (筒瓦) under it, every 10 px at the eave, fanning a little: each a soft
  // groove in the snow (shadow on its right, away from the moon), clear of snow near the eave
  const n = Math.round((eb - ea) / 10);
  for (let i = 0; i <= n; i++) {
    const xe = ea + ((eb - ea) * i) / n, xr = x0 + 2 + ((x1 - x0 - 4) * i) / n;
    ctx.strokeStyle = rgb(p.snowShade, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xr + 1.6, ridgeY + 1);
    ctx.lineTo(xe + 1.6, eaveY);
    ctx.stroke();
    ctx.strokeStyle = rgb(p.tile, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xr + 2.6, ridgeY + (eaveY - ridgeY) * 0.25);
    ctx.lineTo(xe + 2.6, eaveY);
    ctx.stroke();
  }
  ctx.restore();
  // the eave: a dark edge, the tile ends (瓦当) on the round tiles, each with a crumb of snow on it
  ctx.fillStyle = rgb(p.tile);
  ctx.fillRect(ea - 1, eaveY - 1, eb - ea + 2, 3);
  for (let i = 0; i <= n; i++) {
    const xe = ea + ((eb - ea) * i) / n;
    ctx.fillStyle = rgb(p.tile);
    ctx.beginPath();
    ctx.arc(xe, eaveY + 2.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(p.tileLit, 0.7);
    ctx.beginPath();
    ctx.arc(xe - 0.7, eaveY + 2.1, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(p.snow, 0.8);
    ctx.fillRect(xe - 2.2, eaveY - 1.5, 4.4, 1.6);
  }
  // the eave's shadow on the wall under it
  const sh = ctx.createLinearGradient(0, eaveY + 3, 0, eaveY + 18);
  sh.addColorStop(0, "rgba(6,8,14,0.55)");
  sh.addColorStop(1, "rgba(6,8,14,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(x0, eaveY + 3, x1 - x0, 15);
  if (rh <= 0) {
    // v5.5 second draft: one layer, as the south's caps (the user: "右边的边缘有两层，看上去好像偏下了一点"):
    // no ridge band over the slope; the snow runs up to its top edge, and the ends of that edge lift
    if (o.tails !== false)
      for (const [sd, xe] of [[-1, x0 + 2], [1, x1 - 2]] as [number, number][]) {
        ctx.fillStyle = rgb(p.tile);
        ctx.beginPath();
        ctx.moveTo(xe - sd * 12, ridgeY - 1);
        ctx.quadraticCurveTo(xe + sd * 2, ridgeY - 1, xe + sd * 5, ridgeY - 8);
        ctx.lineTo(xe + sd * 7, ridgeY - 6.5);
        ctx.quadraticCurveTo(xe + sd * 5, ridgeY + 2, xe - sd * 2, ridgeY + 4);
        ctx.closePath();
        ctx.fill();
      }
    // a thin line of old snow lying along the top edge, over it (third draft: 4 px, whiter, uneven — the
    // user: "积雪不要搞这么粗吧？积雪我觉得上一版的感觉就还可以": back to the second draft's line)
    const cap = o.cap ?? 2.5;
    ctx.fillStyle = rgb(p.snow);
    ctx.fillRect(x0 + 2, ridgeY - cap, x1 - x0 - 4, cap + 0.5);
    return;
  }
  // the main ridge (正脊): a band of tile, snow lying along it, its ends lifting
  const ra = x0 - 3, rb = x1 + 3;
  ctx.fillStyle = rgb(p.tile);
  ctx.fillRect(ra, ridgeY - rh, rb - ra, rh + 1);
  if (o.tails !== false)
    for (const [sd, xe] of [[-1, ra], [1, rb]] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(xe - sd * 14, ridgeY - rh);
      ctx.quadraticCurveTo(xe + sd * 2, ridgeY - rh, xe + sd * 6, ridgeY - rh - 9);
      ctx.lineTo(xe + sd * 8.5, ridgeY - rh - 7.5);
      ctx.quadraticCurveTo(xe + sd * 6, ridgeY - 1, xe - sd * 2, ridgeY + 1);
      ctx.closePath();
      ctx.fill();
    }
  // snow on the ridge: thick, a little uneven, brightest on the moon's side
  const rg = ctx.createLinearGradient(ra, 0, rb, 0);
  rg.addColorStop(0, rgb(p.snow));
  rg.addColorStop(1, rgb(mixc(p.snow, p.snowShade, 0.35)));
  ctx.fillStyle = rg;
  let x = ra + 2;
  while (x < rb - 2) {
    const len = Math.min(rb - 2 - x, 24 + r() * 50);
    ctx.beginPath();
    ctx.roundRect(x, ridgeY - rh - 2.6 - r() * 0.8, len, 3.4 + r() * 1.2, 2);
    ctx.fill();
    x += len + (r() < 0.25 ? 2 + r() * 5 : 0);
  }
}

/** 步步锦: the lattice of a northern window or door panel, in a w × h box at (x, y) (its top left) */
export function stepLattice(ctx: C, x: number, y: number, w: number, h: number, col: string, lw = 1) {
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  // nested frames stepping in, joined by short bars
  const n = 2;
  for (let k = 1; k <= n; k++) {
    const ix = (w * k) / (2 * n + 1.6), iy = (h * k) / (2 * n + 1.6);
    ctx.strokeRect(x + ix, y + iy, w - 2 * ix, h - 2 * iy);
    const px = (w * (k - 1)) / (2 * n + 1.6), py = (h * (k - 1)) / (2 * n + 1.6);
    ctx.beginPath();
    for (const fx of [0.5]) {
      ctx.moveTo(x + w * fx, y + py);
      ctx.lineTo(x + w * fx, y + iy);
      ctx.moveTo(x + w * fx, y + h - py);
      ctx.lineTo(x + w * fx, y + h - iy);
    }
    for (const fy of [0.5]) {
      ctx.moveTo(x + px, y + h * fy);
      ctx.lineTo(x + ix, y + h * fy);
      ctx.moveTo(x + w - px, y + h * fy);
      ctx.lineTo(x + w - ix, y + h * fy);
    }
    ctx.stroke();
  }
}

/** v5.5 · the two houses' windows, in place of small high ones (the user: "这个有点像小天窗的感觉了，一点点大，
 *  还在高处"; "完全可以左右都对齐吧？只要有略微的样式差异就行了"): one big lattice window in the middle of
 *  each house, the same size, at the same height, mirrored about the crease (x → 1920 − x) as the
 *  houses are (his body 220–416, hers 1504–1700). His: a dark stone frame in the white wall under a
 *  little tiled hood, 灯笼锦 (the lattice whose shadow lies on the page in the ending); hers: a pale
 *  stone surround (窗套) in the brick, 步步锦. HIS_WINDOW / HER_WINDOW are the openings (layer px);
 *  scenes/moon lights them with the same lattices */
export const HIS_HOUSE = { x0: 220, x1: 416 };
export const HER_HOUSE = { x0: 1920 - HIS_HOUSE.x1, x1: 1920 - HIS_HOUSE.x0 };
export const HIS_WINDOW = { x: (HIS_HOUSE.x0 + HIS_HOUSE.x1) / 2, y: 1026, w: 78, h: 48 };
export const HER_WINDOW = { ...HIS_WINDOW, x: 1920 - HIS_WINDOW.x };
/** cols × rows 步步锦 panels with 2-unit bars between them, in the opening w × h at (x, y); s: px per
 *  unit (the scene's light draws the same lattice at 4×, so the two lie line on line) */
export function gridLattice(ctx: C, x: number, y: number, w: number, h: number, cols: number, rows: number, col: string, s = 1) {
  const W = w / s, H = h / s, cw = (W - 2 * (cols - 1)) / cols, ch = (H - 2 * (rows - 1)) / rows;
  ctx.fillStyle = col;
  for (let i = 1; i < cols; i++) ctx.fillRect(x + (i * cw + (i - 1) * 2) * s, y, 2 * s, h);
  for (let j = 1; j < rows; j++) ctx.fillRect(x, y + (j * ch + (j - 1) * 2) * s, w, 2 * s);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) stepLattice(ctx, x + i * (cw + 2) * s, y + j * (ch + 2) * s, cw * s, ch * s, col, s);
}
/** her window's lattice: 4 × 2 步步锦 panels (the scene's light draws it too, at 4×) */
export function herLattice(ctx: C, x: number, y: number, w: number, h: number, col: string, s = 1) {
  gridLattice(ctx, x, y, w, h, 4, 2, col, s);
}
const HUI_DOOR: RGB = [66, 46, 36];
/** v5.5: both gates (and their hoods) 6 px higher (the user: "把左右的门都往上移一点点") */
const GATE_DY = 6;
/** a pair of ring knockers (铺首) either side of a gate's seam at x, y (canvas px) */
function knockers(ctx: C, x: number, y: number) {
  ctx.fillStyle = "rgba(200,166,118,0.75)";
  for (const dx of [-4, 4]) {
    ctx.beginPath();
    ctx.arc(x + dx, y, 1.4, 0, 2 * Math.PI);
    ctx.fill();
  }
}
/** his window's lattice: two leaves of 灯笼锦 either side of a 2-unit mullion (drawn at 4× by the scene too) */
export function hisLattice(ctx: C, x: number, y: number, w: number, h: number, col: string, s = 1) {
  const leaf = (w / s - 2) / 2;
  ctx.fillStyle = col;
  ctx.fillRect(x + leaf * s, y, 2 * s, h);
  lanternLattice(ctx, x, y, leaf * s, h, 2 * s);
  lanternLattice(ctx, x + (leaf + 2) * s, y, leaf * s, h, 2 * s);
}
/** his window: the dark stone frame in the white wall, the paper, the lattice, the little hood over it */
function huiBigWindow(ctx: C, p: HuiPal) {
  const { x, w, h } = HIS_WINDOW, y = HIS_WINDOW.y - ROOF_TOP, sur = 5;
  const xa = x - w / 2, ya = y - h / 2;
  ctx.fillStyle = rgb(mixc(p.wallFoot, [34, 30, 28], 0.62));
  ctx.fillRect(xa - sur, ya - sur, w + 2 * sur, h + 2 * sur);
  ctx.fillStyle = rgb(mixc([60, 30, 14], p.win, 0.35));
  ctx.fillRect(xa, ya, w, h);
  hisLattice(ctx, xa, ya, w, h, "rgb(44,26,16)");
  huiCap(ctx, xa - sur - 6, xa + w + sur + 6, ya - sur - 10, 7, p, [true, true]);
}
/** her house: brick; the window in a stone surround, recessed (a shadow inside its top and left) */
function beiWallWindow(ctx: C, top: number, p: BeiPal, r: () => number) {
  const { x0, x1 } = HER_HOUSE, { x, w, h } = HER_WINDOW, y = HER_WINDOW.y - ROOF_TOP, sur = 6;
  beiWall(ctx, x0, x1, top, p, r);
  const xa = x - w / 2, ya = y - h / 2;
  ctx.fillStyle = rgb(mixc(p.brickTop, [205, 210, 220], 0.32));
  ctx.fillRect(xa - sur, ya - sur, w + 2 * sur, h + 2 * sur);
  ctx.fillStyle = rgb(mixc(p.brickTop, [0, 0, 0], 0.35));
  ctx.fillRect(xa - sur, ya + h + sur, w + 2 * sur, 1);
  ctx.fillStyle = rgb(mixc(p.brickTop, [150, 160, 180], 0.35));
  ctx.fillRect(xa, ya, w, h);
  herLattice(ctx, xa, ya, w, h, rgb(p.wood, 0.95));
  ctx.fillStyle = "rgba(10,12,20,0.35)";
  ctx.fillRect(xa, ya, w, 2);
  ctx.fillRect(xa, ya + 2, 2, h - 2);
}

/** The near houses (his and her windows: HIS_WINDOW, HER_WINDOW). */
export function nearRoofs(): HTMLCanvasElement {
  const c = makeCanvas(1920, ROOF_H);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(77);
  const sp: SouthPal = { wallTop: [124, 114, 102], wallFoot: [70, 62, 55], tile: [17, 15, 17], rim: [214, 196, 170, 0.42], stain: 0.16, win: [255, 190, 116] };
  const np: NorthPal = { wall: [21, 26, 37], tile: [12, 14, 20], snow: [184, 196, 218], snowShade: [118, 132, 160], win: [255, 214, 162] };
  const Y = (y: number) => y - ROOF_TOP; // layer → canvas
  // v4.1: v4.0's southern houses are drawn out of sight only to take the same numbers from the random
  // sequence, so the north, drawn after them, is exactly as it was
  {
    const scratch = makeCanvas(4, 4).getContext("2d")!;
    gableHouse(scratch, 110, 250, Y(905), 2, 18, sp, r);
    eaveHouse(scratch, 228, 214, Y(966), sp, r);
    gableHouse(scratch, 566, 220, Y(992), 2, 13, sp, r);
    eaveHouse(scratch, 676, 300, Y(1004), sp, r, 0.55);
  }
  void np;
  // v5.5 · the north, the south's counterpart and as high (the user: "衔接处是不是应该一样高才对？然后它们大致
  // 整体应该差不多高"): mirrored about the crease (x → 1920 − x), the courtyard wall meets the south's
  // at the crease at the same height (1046); the house near the crease as the south's (its ridge at
  // 992); the wall on, her gate in it under a little tiled hood; her house as high as his (950), her
  // window where the scene lights it; the wall on to the edge
  const rn = mulberry32(5501);
  northOnly(ctx, () => {
    const wall = beiPal(0.1), side = beiPal(0.08), hers = beiPal(0);
    // every top here (the tile's top edge; the snow lies over it) is the top of
    // its counterpart in the south: the yard wall's cap y − 8 (huiCap at y − 7, its ridge tiles 1 px
    // higher), the gate's hood 1052, the house by the crease 988, his house 943.5
    // (second draft: the tile's top edge at the south's top, the snow lying over it — the user: "如果右边
    // 上面有一点积雪的话，那积雪的部分可以超过左边屋檐的部分吧")
    const ridgeAt = (topY: number) => Y(topY);
    /** a stretch of the courtyard wall, x0…x1, as the south's yardWall(x0, x1, y): its cap's top at y − 8 */
    const yardWall = (x0: number, x1: number, y: number) => {
      beiWall(ctx, x0, x1, Y(y), wall, rn);
      beiCap(ctx, x0 + 4, x1 - 4, Y(y) - 7, 7, wall); // as the south's huiCap(x0 + 4, x1 − 4, Y(y) − 7, 7)
    };
    yardWall(950, 1052, 1046);
    yardWall(1208, 1512, 1040);
    yardWall(1692, 1960, 1030);
    // her gate in the wall, under its hood
    ctx.fillStyle = rgb(mixc(wall.brickFoot, [8, 8, 12], 0.4));
    ctx.fillRect(1418, Y(1068 - GATE_DY), 40, ROOF_H);
    ctx.fillStyle = rgb(mixc(wall.door, [10, 8, 8], 0.25));
    ctx.fillRect(1424, Y(1074 - GATE_DY), 28, ROOF_H);
    ctx.fillStyle = "rgba(10,6,6,0.6)";
    ctx.fillRect(1437, Y(1074 - GATE_DY), 2, ROOF_H);
    knockers(ctx, 1438, Y(1090 - GATE_DY));
    // its hood: the south's (huiCap(452, 512, …, 7)) mirrored, with less snow than the walls
    beiCap(ctx, 1408, 1468, Y(1060 - GATE_DY), 7, wall, 1);
    // the house near the crease: its top at 988, a window with a light in it
    const sr = ridgeAt(988);
    // (its back to the lane, as such houses have: brick, no window)
    beiWall(ctx, 1048, 1212, sr + 26, side, rn);
    beiRoof(ctx, 1048, 1212, sr, sr + 24, side, rn, { ridge: 0 });
    // her house, as high as his (943.5) and as wide (HER_HOUSE); her window in its middle (lit by the scene)
    const hr = ridgeAt(943.5);
    beiWallWindow(ctx, hr + 28, hers, rn);
    beiRoof(ctx, HER_HOUSE.x0, HER_HOUSE.x1, hr, hr + 26, hers, rn, { ridge: 0 });
    // a cold mist low along the lane
    huiMist(ctx, 950, 1960, Y(1000), 34, 0.3, rn, MIST_N);
  });
  // v4.1 · the south, near (the poem's lines span x 465–1455 and end 946 px down; this layer rises
  // 38 px after the fold, so between those x everything here starts at 988 or lower)
  const rs = mulberry32(4101);
  southOnly(ctx, () => {
    const his = huiPal(0), yard = huiPal(0.05, 0.08), end = huiPal(0.1, 0.04);
    /** a stretch of the yard wall, x0…x1, its top at y (layer px) */
    const yardWall = (x0: number, x1: number, y: number) => {
      const g = ctx.createLinearGradient(0, Y(y), 0, Y(y) + 110);
      g.addColorStop(0, rgb(yard.wallTop));
      g.addColorStop(1, rgb(yard.wallFoot));
      ctx.fillStyle = g;
      ctx.fillRect(x0, Y(y), x1 - x0, ROOF_H);
      huiStains(ctx, x0, x1, Y(y) + 6, 26, yard, rs);
      huiCap(ctx, x0 + 4, x1 - 4, Y(y) - 7, 7, yard, [false, false]);
    };
    // the wall runs from the frame's edge to his house, from his house to the house near the crease
    // (a step lower, as such walls follow the ground), and on to the crease
    yardWall(-30, 228, 1030);
    yardWall(408, 712, 1040);
    yardWall(868, 990, 1046);
    // his gate in it, under its little tiled hood (门罩): two wooden leaves, as her gate (v5.5: was a dark
    // opening — the user: "那个门却是黑的一个洞")
    ctx.fillStyle = rgb(mixc(yard.wallFoot, [60, 54, 48], 0.5));
    ctx.fillRect(462, Y(1068 - GATE_DY), 40, ROOF_H);
    ctx.fillStyle = rgb(HUI_DOOR);
    ctx.fillRect(468, Y(1074 - GATE_DY), 28, ROOF_H);
    ctx.fillStyle = "rgba(14,9,6,0.6)";
    ctx.fillRect(481, Y(1074 - GATE_DY), 2, ROOF_H);
    knockers(ctx, 482, Y(1090 - GATE_DY));
    huiCap(ctx, 452, 512, Y(1060 - GATE_DY), 7, yard, [true, true]);
    // the house near the crease: one step a side; no window (v5.5, as hers: its back to the lane)
    huiHouse(ctx, 790, 164, Y(992), 1, 12, end, rs);
    // his house: two steps a side; his window in its middle (lit by the scene)
    huiHouse(ctx, (HIS_HOUSE.x0 + HIS_HOUSE.x1) / 2, HIS_HOUSE.x1 - HIS_HOUSE.x0, Y(948), 2, 13, his, rs);
    huiBigWindow(ctx, his);
  });
  return c;
}

/** The far town: the same two kinds of roof, smaller, in the haze of each half's air. */
export function farRoofs(): HTMLCanvasElement {
  const c = makeCanvas(1920, ROOF_H);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(91);
  // close to the sky behind them (scenes/moon: south ≈ 40,27,17 … 70,45,25; north ≈ 10,17,33)
  const sp: SouthPal = { wallTop: [92, 76, 62], wallFoot: [62, 48, 38], tile: [36, 26, 22], rim: [190, 160, 130, 0.25], stain: 0.06, win: [230, 160, 96] };
  const np: NorthPal = { wall: [17, 23, 38], tile: [14, 19, 32], snow: [96, 110, 138], snowShade: [58, 70, 96], win: [220, 190, 150] };
  const Y = (y: number) => y - ROOF_TOP;
  // v4.1: v4.0's far south is drawn out of sight only to take its numbers from the random sequence
  // (the north, after it, stays as it was)
  {
    const scratch = makeCanvas(4, 4).getContext("2d")!;
    let x = -40;
    while (x < 930) {
      if (r() < 0.45) {
        const w = 90 + r() * 70;
        gableHouse(scratch, x + w / 2, w, Y(930 + r() * 22), r() < 0.5 ? 1 : 2, 10 + r() * 4, sp, r);
        x += w + 4 + r() * 10;
      } else {
        const w = 120 + r() * 90;
        eaveHouse(scratch, x, w, Y(946 + r() * 18), sp, r, 0.25);
        x += w * 0.85;
      }
    }
  }
  let x = 966;
  while (x < 1960) {
    const w = 110 + r() * 110;
    snowHouse(ctx, x, w, Y(936 + r() * 26), np, r, undefined, r() < 0.25);
    x += w + 6 + r() * 16;
  }
  // v4.1 · the south, far: nothing but a breath of mist low over the roofs
  const rs = mulberry32(4102);
  southOnly(ctx, () => huiMist(ctx, -50, 1010, Y(1000), 34, 0.38, rs));
  return c;
}
