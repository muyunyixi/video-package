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
const HUI_NEAR: HuiPal = { wallTop: [160, 150, 136], wallFoot: [106, 97, 87], tile: [24, 21, 22], rim: [226, 210, 186, 0.42], stain: 0.16, win: [255, 190, 116] };
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

/** The near houses. WIN_S / WIN_N: his and her lit windows (layer px). */
export function nearRoofs(WIN_S: { x: number; y: number }, WIN_N: { x: number; y: number }): HTMLCanvasElement {
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
  // north, from the crease: a low roof, two snowy houses (hers the second), a flat block at the edge
  snowHouse(ctx, 962, 270, Y(1002), np, r);
  snowHouse(ctx, 1240, 236, Y(990), np, r);
  snowHouse(ctx, 1488, 256, Y(950), np, r, { x: WIN_N.x, y: Y(WIN_N.y) });
  snowHouse(ctx, 1752, 200, Y(912), np, r, undefined, true);
  ctx.fillStyle = "rgba(12,10,10,0.95)";
  ctx.fillRect(WIN_N.x - 16, Y(WIN_N.y) - 12, 32, 24);
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
    // his gate in it, under its little tiled hood (门罩)
    ctx.fillStyle = rgb(mixc(yard.wallFoot, [60, 54, 48], 0.5));
    ctx.fillRect(462, Y(1068), 40, ROOF_H);
    ctx.fillStyle = "rgba(14,11,10,0.95)";
    ctx.fillRect(468, Y(1074), 28, ROOF_H);
    huiCap(ctx, 452, 512, Y(1060), 7, yard, [true, true]);
    // the house near the crease: one step a side, a small window, a light in it
    huiHouse(ctx, 790, 164, Y(992), 1, 12, end, rs, [{ x: 812, y: Y(1034), w: 11, h: 14, lit: 0.75, hood: true }]);
    // his house: two steps a side; his window (lit by the scene, at its own moment) under a hood, and
    // a smaller one below it
    huiHouse(ctx, 318, 196, Y(948), 2, 13, his, rs, [
      { x: WIN_S.x, y: Y(WIN_S.y), w: 30, h: 22, hood: true, frameOnly: true },
      { x: 266, y: Y(1052), w: 11, h: 14 },
    ]);
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
