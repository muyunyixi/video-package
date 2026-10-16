// Ink-painted bird sprites, drawn procedurally as pose atlases (one row of
// poses per atlas). Side view, facing right. Shapes are built from brush
// "dabs" with varied ink density and a dry-brush break-up pass, so they read
// as painted rather than vector silhouettes.
import { makeCanvas } from "./glyph";
import { mulberry32 } from "./util";

type Ctx = CanvasRenderingContext2D;

/** break the ink up with tiny paper-coloured gaps (dry brush) */
function dryBrush(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, amount = 260) {
  const r = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < amount; i++) {
    const px = x + r() * w, py = y + r() * h;
    const len = 2 + r() * 9;
    const a = (r() - 0.5) * 0.6;
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.25})`;
    ctx.lineWidth = 0.6 + r() * 1.2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Wild goose (雁) in flight: `n` poses over one wing-beat. */
export function gooseAtlas(n = 8, cell = 256, ink = "26,26,30") {
  const c = makeCanvas(cell * n, cell);
  const ctx = c.getContext("2d")!;
  for (let k = 0; k < n; k++) {
    const ox = k * cell;
    const th = (k / n) * Math.PI * 2;
    const e = Math.sin(th); // wing elevation -1..1
    const S = cell / 256;
    const P = (x: number, y: number): [number, number] => [ox + x * S, y * S];
    const bob = -e * 5;
    const sx = 128, sy = 133 + bob; // shoulder
    const wing = (far: boolean) => {
      const up = e >= 0;
      const mag = Math.abs(e);
      const len = (far ? 20 : 30) + (far ? 80 : 104) * mag;
      const sweep = 34 + 16 * (1 - mag);
      const tipX = sx - sweep + (far ? 10 : 0);
      const tipY = up ? sy - len : sy + len * 0.82;
      const dirY = up ? -1 : 1;
      ctx.fillStyle = `rgba(${ink},${far ? 0.5 : 0.88})`;
      ctx.beginPath();
      ctx.moveTo(...P(sx + 18, sy - 1));
      // leading edge: a bowed arm
      ctx.bezierCurveTo(...P(sx + 26, sy + dirY * len * 0.35), ...P(tipX + 22, sy + dirY * len * 0.9), ...P(tipX, tipY));
      // trailing edge with splayed primaries
      const F = 6;
      for (let q = 1; q <= F; q++) {
        const t = q / F;
        const bx = tipX + (sx - 20 - tipX) * t;
        const by = tipY + (sy + 4 - tipY) * t;
        const notch = (1 - t) * 9;
        ctx.lineTo(...P(bx - notch * 0.7, by - dirY * notch * 0.2));
        ctx.lineTo(...P(bx + 2, by + dirY * 3));
      }
      ctx.closePath();
      ctx.fill();
    };
    ctx.save();
    ctx.filter = "blur(0.8px)";
    if (e > -0.2) wing(true);
    // body flowing into the long neck
    ctx.fillStyle = `rgba(${ink},0.93)`;
    ctx.beginPath();
    ctx.moveTo(...P(62, 132 + bob));
    ctx.bezierCurveTo(...P(80, 118 + bob), ...P(142, 116 + bob), ...P(168, 128 + bob));
    ctx.bezierCurveTo(...P(186, 124 + bob), ...P(204, 118 + bob), ...P(216, 117 + bob));
    ctx.bezierCurveTo(...P(232, 115 + bob), ...P(234, 129 + bob), ...P(218, 128 + bob));
    ctx.bezierCurveTo(...P(204, 129 + bob), ...P(190, 134 + bob), ...P(170, 140 + bob));
    ctx.bezierCurveTo(...P(140, 156 + bob), ...P(92, 154 + bob), ...P(62, 140 + bob));
    ctx.closePath();
    ctx.fill();
    // tail feathers
    ctx.beginPath();
    ctx.moveTo(...P(66, 134 + bob));
    ctx.lineTo(...P(44, 128 + bob));
    ctx.lineTo(...P(50, 136 + bob));
    ctx.lineTo(...P(42, 144 + bob));
    ctx.lineTo(...P(68, 142 + bob));
    ctx.closePath();
    ctx.fill();
    // beak
    ctx.beginPath();
    ctx.moveTo(...P(228, 118 + bob));
    ctx.lineTo(...P(246, 123 + bob));
    ctx.lineTo(...P(227, 126 + bob));
    ctx.closePath();
    ctx.fill();
    // tucked feet: where the thread is tied
    ctx.strokeStyle = `rgba(${ink},0.85)`;
    ctx.lineWidth = 3 * S;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(...P(96, 150 + bob));
    ctx.lineTo(...P(80, 155 + bob));
    ctx.stroke();
    wing(false);
    ctx.restore();
    dryBrush(ctx, ox, 0, cell, cell, 100 + k, 220);
  }
  return c;
}

/**
 * Sparrow (雀) in the 写意 manner: a plump pale belly, a back of medium ink broken by
 * dense feather marks, a dark crown, white cheek with its spot, black bib, short cone
 * beak. The legs are what painters leave out: two short bent strokes under the belly
 * and curled toes, only when perched. Poses: perched, crouch, hop, flap up, flap down.
 * The toes rest on y = 157 of the cell.
 */
export function sparrowAtlas(cell = 192, ink = "22,21,24") {
  const n = 5;
  const c = makeCanvas(cell * n, cell);
  const ctx = c.getContext("2d")!;
  for (let k = 0; k < n; k++) {
    const ox = k * cell;
    const S = cell / 192;
    const flying = k >= 2;
    // body offsets per pose: crouch sits lower, the hop stretches forward
    const oy = 24 + (k === 1 ? 5 : 0) - (flying ? 6 : 0);
    const ox2 = k === 2 ? 4 : 0;
    const P = (x: number, y: number): [number, number] => [ox + (x + ox2) * S, (y + oy) * S];
    const dab = (x: number, y: number, rx: number, ry: number, rot: number, a: number) => {
      ctx.fillStyle = `rgba(${ink},${a})`;
      ctx.beginPath();
      ctx.ellipse(...P(x, y), rx * S, ry * S, rot, 0, Math.PI * 2);
      ctx.fill();
    };
    const lift = (x: number, y: number, rx: number, ry: number, a: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.beginPath();
      ctx.ellipse(...P(x, y), rx * S, ry * S, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const r = mulberry32(500 + k);
    ctx.save();
    ctx.filter = "blur(0.8px)";
    // belly: a pale, round wash
    dab(97, 104, 31, 22, -0.12, 0.16);
    dab(100, 110, 22, 14, -0.1, 0.1);
    // back: medium ink sweeping to the tail
    dab(86, 92, 30, 13, -0.38, 0.5);
    // head: medium ink, dense crown
    dab(124, 76, 16, 14.5, 0, 0.5);
    dab(122, 67.5, 13.5, 7, -0.18, 0.86);
    // white cheek with its dark spot, black bib under the beak
    lift(127, 83, 7.5, 5.5, 0.7);
    dab(129, 84, 3.4, 3, 0, 0.9);
    dab(133, 92, 5, 6.5, 0.2, 0.92);
    // short cone beak
    ctx.fillStyle = `rgba(${ink},0.95)`;
    ctx.beginPath();
    ctx.moveTo(...P(137.5, 74.5));
    ctx.quadraticCurveTo(...P(146, 77), ...P(148.5, 78.5));
    ctx.lineTo(...P(137.5, 81.5));
    ctx.closePath();
    ctx.fill();
    // eye with a paper catch-light
    dab(130, 74.5, 2.7, 2.7, 0, 1);
    lift(130.8, 73.7, 0.8, 0.8, 1);
    // tail: tapered dense strokes
    ctx.fillStyle = `rgba(${ink},0.9)`;
    for (const [y0, y1, w] of [[102, 88, 5], [107, 100, 4.4]] as const) {
      ctx.beginPath();
      ctx.moveTo(...P(64, y0 - w / 2));
      ctx.lineTo(...P(30, y1));
      ctx.lineTo(...P(64, y0 + w / 2));
      ctx.closePath();
      ctx.fill();
    }
    if (!flying) {
      // folded wing: dense dab, a broken wing-bar of dots, dry feather strokes
      dab(84, 95, 24, 10.5, -0.32, 0.78);
      for (let q = 0; q < 5; q++) dab(96 - q * 6.5, 89 + q * 1.6, 2.6 + r(), 2 + r(), -0.3, 0.95);
      ctx.strokeStyle = `rgba(${ink},0.85)`;
      ctx.lineCap = "round";
      ctx.lineWidth = 1.7 * S;
      for (let q = 0; q < 5; q++) {
        ctx.beginPath();
        ctx.moveTo(...P(92 - q * 5, 98 + q));
        ctx.lineTo(...P(62 - q * 3.5, 109 + q * 1.8));
        ctx.stroke();
      }
      // the legs: barely there — short bent tarsi under the belly, curled toes
      ctx.strokeStyle = `rgba(${ink},0.78)`;
      ctx.lineWidth = 1.5 * S;
      const bend = k === 1 ? 3 : 0;
      for (const [hx, toe] of [[94, 0], [104, 1]] as const) {
        const fy = 157 - oy; // toes on the cell's perch line
        ctx.beginPath();
        ctx.moveTo(...P(hx, 122));
        ctx.quadraticCurveTo(...P(hx + 3 + bend, fy - 7), ...P(hx + 1, fy - 1));
        ctx.stroke();
        // three toes curled round the stroke they stand on, one hallux behind
        ctx.beginPath();
        ctx.moveTo(...P(hx + 1, fy - 1));
        ctx.quadraticCurveTo(...P(hx + 6, fy - 2), ...P(hx + 9, fy + 0.8));
        ctx.moveTo(...P(hx + 1, fy - 1));
        ctx.quadraticCurveTo(...P(hx + 5, fy + 0.5), ...P(hx + 7 - toe, fy + 2));
        ctx.moveTo(...P(hx + 1, fy - 1));
        ctx.quadraticCurveTo(...P(hx - 3, fy - 0.5), ...P(hx - 5, fy + 1.5));
        ctx.stroke();
      }
    } else {
      // open wing in flight; legs tucked away under the belly
      const up = k === 3 ? -1 : k === 4 ? 1 : -0.4;
      ctx.fillStyle = `rgba(${ink},0.8)`;
      ctx.beginPath();
      ctx.moveTo(...P(104, 90));
      ctx.bezierCurveTo(...P(102, 90 + 38 * up), ...P(82, 90 + 62 * up), ...P(58, 92 + 68 * up));
      for (let q = 1; q <= 5; q++) {
        const t = q / 5;
        ctx.lineTo(...P(58 + 24 * t - 4, 92 + 68 * up * (1 - t) + 6));
        ctx.lineTo(...P(58 + 24 * t + 2, 92 + 68 * up * (1 - t)));
      }
      ctx.lineTo(...P(84, 102));
      ctx.closePath();
      ctx.fill();
      for (let q = 0; q < 4; q++) dab(96 - q * 7, 92 + 18 * up * (q / 4), 2.4, 1.8, -0.3, 0.95);
    }
    ctx.restore();
    dryBrush(ctx, ox, 0, cell, cell, 300 + k, 150);
  }
  return c;
}
