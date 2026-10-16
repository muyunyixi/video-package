// 写意 sparrows for the 雀跃 showcase: ink with a light wash of 赭石 (ochre), painted
// procedurally with soft brush dabs into two pose atlases. Side view (facing right) for
// hopping, perching and flight; a front view for the one that flies straight at the lens.
//
// Side atlas cells (SP_CELL square), body centre at (SP_CELL/2, SP_BODY_Y), toes on SP_PERCH_Y:
//   0 perch · 1 crouch · 2 wings up · 3 wings level · 4 wings down · 5 folded (bound)
//   6 landing flare · 7 take-off push
// Front atlas cells (SPF_CELL square), body in the middle:  0 wings up · 1 level · 2 down
import { makeCanvas } from "./glyph";
import { mulberry32 } from "./util";

type Ctx = CanvasRenderingContext2D;
export const SP_CELL = 384;
export const SP_U = 2.2; // px per body unit in a side cell
export const SP_BODY_Y = 196;
export const SP_PERCH_Y = SP_BODY_Y + 32 * SP_U; // where the toes rest
export const SP_POSES = 8;
export const SPF_CELL = 768;
export const SPF_POSES = 3;

const INK = "26,22,22";
const OCHRE = "124,86,56";
const OCHRE_D = "92,62,42";
const PAPER = "238,234,226";
const BELLY = "212,203,190";
const HEAD = "176,160,140";
const LEG = "132,100,84";

type Pose = {
  pitch: number; // body tilt, radians, nose up > 0
  crouch: number; // 0..1
  wing: "fold" | "spread";
  elev: number; // spread wing: -1 down .. 1 up
  reach: number; // spread wing: 0 swept back .. 1 forward (braking)
  tail: number; // 0 closed .. 1 fanned
  tailAng: number; // radians, + = tail down
  legs: "perch" | "tuck" | "reach" | "push";
};

const SIDE: Pose[] = [
  { pitch: 0.06, crouch: 0, wing: "fold", elev: 0, reach: 0, tail: 0.1, tailAng: -0.22, legs: "perch" },
  { pitch: -0.08, crouch: 1, wing: "fold", elev: 0, reach: 0, tail: 0.25, tailAng: -0.4, legs: "perch" },
  { pitch: 0.12, crouch: 0, wing: "spread", elev: 1, reach: 0.15, tail: 0.35, tailAng: -0.02, legs: "tuck" },
  { pitch: 0.05, crouch: 0, wing: "spread", elev: 0.1, reach: 0.1, tail: 0.25, tailAng: 0.0, legs: "tuck" },
  { pitch: -0.02, crouch: 0, wing: "spread", elev: -1, reach: 0.05, tail: 0.3, tailAng: 0.04, legs: "tuck" },
  { pitch: 0.0, crouch: 0, wing: "fold", elev: 0, reach: 0, tail: 0.0, tailAng: 0.02, legs: "tuck" },
  { pitch: 0.42, crouch: 0, wing: "spread", elev: 0.8, reach: 0.9, tail: 1, tailAng: 0.5, legs: "reach" },
  { pitch: 0.3, crouch: 0.4, wing: "spread", elev: -0.75, reach: 0.2, tail: 0.6, tailAng: 0.18, legs: "push" },
];

/** A brush stroke along a quadratic curve, laid as many soft overlapping dabs: dense in the
 *  middle, feathered at the edge, tapering from w0 to w1. */
function brush(ctx: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w0: number, w1: number, col: string, a: number, r: () => number, jitter = 0.12) {
  const L = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const n = Math.max(4, Math.ceil(L / (Math.min(w0, w1) * 0.22 + 0.6)));
  const da = 1 - Math.pow(1 - Math.min(0.97, a), 1 / 3.2); // ~3 overlaps reach `a`
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    const ang = Math.atan2(ty, tx);
    const w = (w0 + (w1 - w0) * t) * (1 + (r() - 0.5) * jitter * 2);
    ctx.fillStyle = `rgba(${col},${da})`;
    ctx.beginPath();
    ctx.ellipse(x + (r() - 0.5) * w * jitter, y + (r() - 0.5) * w * jitter, Math.max(0.3, w * 0.62), Math.max(0.3, w * 0.5), ang, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** a soft round wash, lighter in the middle */
function wash(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, col: string, a: number, edge = 0.75) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(edge, `rgba(${col},${a * 0.92})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function dot(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, col: string, a: number) {
  ctx.fillStyle = `rgba(${col},${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ctx.fill();
}

/** rotate (dx, dy) by `a` */
const rot = (dx: number, dy: number, a: number): [number, number] => [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];

/** An open wing seen from the side. Shoulder (sx, sy); dirA the way it points; the trailing
 *  edge faces the tail. A broad ochre stroke for the arm and coverts, a pale bar, ink
 *  secondaries along the back edge, and five long primaries fanned from the wrist. */
function sideWing(ctx: Ctx, sx: number, sy: number, dirA: number, len: number, chord: number, r: () => number, far: boolean) {
  const ux = Math.cos(dirA), uy = Math.sin(dirA);
  let px = -uy, py = ux; // towards the trailing edge (the tail side)
  if (px > 0) { px = -px; py = -py; }
  // which rotation sense turns the wing direction towards the trailing side
  const sense = ux * py - uy * px > 0 ? 1 : -1;
  const k = far ? 0.55 : 1;
  const wx = sx + ux * len * 0.42, wy = sy + uy * len * 0.42; // wrist
  // secondaries first (under the coverts)
  for (let q = 0; q < 5; q++) {
    const t = 0.06 + q * 0.085;
    const bx = sx + ux * len * t + px * chord * 0.25, by = sy + uy * len * t + py * chord * 0.25;
    const ex = bx + px * chord * 1.05 - ux * chord * 0.15, ey = by + py * chord * 1.05 - uy * chord * 0.15;
    brush(ctx, bx, by, (bx + ex) / 2 + ux * 1.5, (by + ey) / 2 + uy * 1.5, ex, ey, chord * 0.46, chord * 0.24, INK, 0.75 * k, r);
  }
  // primaries from the wrist, fanned towards the trailing side
  for (let q = 0; q < 5; q++) {
    const [dx, dy] = rot(ux, uy, sense * (-0.04 + q * 0.12));
    const fl = len * (0.62 - q * 0.045) * (0.96 + r() * 0.08);
    const bx = wx + px * chord * 0.12 * q, by = wy + py * chord * 0.12 * q;
    brush(ctx, bx, by, bx + dx * fl * 0.55 + px * 1.0, by + dy * fl * 0.55 + py * 1.0, bx + dx * fl, by + dy * fl, chord * 0.5, chord * 0.16, INK, 0.9 * k, r, 0.06);
  }
  // arm and coverts: one broad wet stroke
  brush(ctx, sx, sy, sx + ux * len * 0.24 + px * chord * 0.12, sy + uy * len * 0.24 + py * chord * 0.12, wx, wy, chord * 0.95, chord * 0.55, far ? INK : OCHRE, 0.88 * k, r, 0.1);
  if (!far) {
    for (let q = 0; q < 5; q++) {
      const t = 0.08 + q * 0.07;
      dot(ctx, sx + ux * len * t + px * chord * (0.1 + r() * 0.15), sy + uy * len * t + py * chord * (0.1 + r() * 0.15), chord * 0.1, chord * 0.06, dirA, INK, 0.55);
    }
    // the pale wing bar across the coverts
    brush(ctx, sx + px * chord * 0.42, sy + py * chord * 0.42, sx + ux * len * 0.2 + px * chord * 0.5, sy + uy * len * 0.2 + py * chord * 0.5, wx + px * chord * 0.3, wy + py * chord * 0.3, chord * 0.09, chord * 0.05, PAPER, 0.9, r, 0.05);
  }
}

function sideSparrow(ctx: Ctx, cx: number, cy: number, U: number, p: Pose, seed: number) {
  const r = mulberry32(seed);
  ctx.save();
  ctx.translate(cx, cy + p.crouch * 6 * U);
  ctx.rotate(-p.pitch);
  ctx.scale(U, U);
  const wingDir = -2.09 - (1 - p.elev) * 1.05 + p.reach * 0.6;
  const wingLen = 60 * (0.55 + 0.45 * Math.abs(p.elev));
  // far wing, behind everything
  if (p.wing === "spread" && p.elev > -0.5) sideWing(ctx, 8, -13, wingDir - 0.2, wingLen * 0.9, 21, r, true);
  // tail: three tapering strokes
  for (let q = 0; q < 3; q++) {
    const t = q - 1;
    const ang = Math.PI + p.tailAng + t * (0.05 + p.tail * 0.3);
    const L = 27 + (q === 1 ? 3 : 0);
    const ex = -22 + Math.cos(ang) * L, ey = 1 + Math.sin(ang) * L;
    brush(ctx, -20, 1, -20 + Math.cos(ang) * L * 0.5, 1 + Math.sin(ang) * L * 0.5 - 1, ex, ey, 10, 7, q === 1 ? INK : OCHRE_D, 0.9, r, 0.06);
  }
  // legs (behind the belly)
  ctx.strokeStyle = `rgba(${LEG},0.92)`;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.6;
  const toes = (x: number, y: number, curl: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 5, y - 1 + curl, x + 9, y + 1.5 + curl);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4, y + 1 + curl, x + 6.5, y + 3 + curl);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 3, y + curl * 0.5, x - 6, y + 1.5);
    ctx.stroke();
  };
  if (p.legs === "perch") {
    const fy = 32 - p.crouch * 6;
    for (const hx of [-3, 7]) {
      ctx.beginPath();
      ctx.moveTo(hx, 14);
      ctx.quadraticCurveTo(hx + 5 + p.crouch * 3, fy - 10, hx + 1, fy);
      ctx.stroke();
      toes(hx + 1, fy, 0.8);
    }
  } else if (p.legs === "reach") {
    for (const [hx, k] of [[0, 0], [8, 1]] as const) {
      const ex = hx + 15 + k * 3, ey = 33;
      ctx.beginPath();
      ctx.moveTo(hx, 14);
      ctx.quadraticCurveTo(hx + 10, 27, ex, ey);
      ctx.stroke();
      toes(ex, ey, -1.5);
    }
  } else if (p.legs === "push") {
    for (const hx of [-4, 5]) {
      ctx.beginPath();
      ctx.moveTo(hx, 14);
      ctx.quadraticCurveTo(hx - 4, 30, hx - 12, 40);
      ctx.stroke();
      toes(hx - 12, 40, 0.5);
    }
  }
  // body: the pale round belly, then the ochre back laid over it
  ctx.save();
  ctx.scale(1, 1 - p.crouch * 0.1);
  wash(ctx, 5, 5, 30, 20, -0.08, BELLY, 0.97, 0.82);
  wash(ctx, 13, 2, 17, 14, -0.2, "228,220,208", 0.6, 0.6);
  brush(ctx, 24, -12, 4, -22, -28, -1, 20, 12, OCHRE, 0.82, r, 0.14);
  for (let q = 0; q < 8; q++) {
    const x = -22 + q * 5.6 + r() * 2, y = -13 + r() * 5;
    brush(ctx, x + 3, y - 2, x, y, x - 3, y + 3, 2.6, 0.9, INK, 0.7, r, 0.05);
  }
  wash(ctx, -6, 6, 20, 7, -0.06, OCHRE_D, 0.22, 0.5);
  if (p.wing === "fold") {
    brush(ctx, 14, -6, -4, -6, -26, 3, 18, 10, OCHRE, 0.9, r, 0.1);
    for (let q = 0; q < 5; q++) dot(ctx, 8 - q * 6.8, -6 + q * 0.9, 3.6, 2.2, -0.18, INK, 0.62);
    brush(ctx, 10, -1, -2, 3, -15, 2, 1.8, 1.2, PAPER, 0.92, r, 0.03);
    for (let q = 0; q < 3; q++) brush(ctx, -6 - q * 2, -1 + q * 1.6, -18 - q * 2, 3 + q * 1.4, -34 - q * 2, 4 + q * 1.8, 6, 1.5, INK, 0.86, r, 0.06);
  }
  ctx.restore();
  // head
  const hx = 27, hy = -15 - p.crouch * 2;
  wash(ctx, hx - 5, hy + 7, 12, 10, 0, BELLY, 0.95, 0.8);
  wash(ctx, hx, hy, 15, 13.5, 0, HEAD, 1, 0.86);
  brush(ctx, hx + 8, hy - 9, hx - 2, hy - 13, hx - 12, hy - 4, 11, 9, OCHRE_D, 0.95, r, 0.1); // the cap
  dot(ctx, hx + 4, hy + 4, 8.2, 6.2, 0.1, PAPER, 1); // white cheek
  dot(ctx, hx + 6, hy + 5.5, 3, 2.7, 0, INK, 0.95); // its black spot
  wash(ctx, hx + 9, hy + 10.5, 5.2, 6.4, 0.25, INK, 0.95, 0.8); // the black bib on the throat
  dot(ctx, hx + 7.5, hy - 2, 2.6, 2.6, 0, INK, 1); // eye
  dot(ctx, hx + 8.2, hy - 2.8, 0.8, 0.8, 0, "255,252,246", 1);
  ctx.fillStyle = `rgba(${INK},0.96)`; // short stout cone beak
  ctx.beginPath();
  ctx.moveTo(hx + 12, hy - 4.5);
  ctx.quadraticCurveTo(hx + 20, hy - 2, hx + 23.5, hy + 0.5);
  ctx.quadraticCurveTo(hx + 19, hy + 3, hx + 12, hy + 3.5);
  ctx.closePath();
  ctx.fill();
  // near wing over the body
  if (p.wing === "spread") {
    // mid-stroke the wing is edge-on and blurred by its own speed: paint it lighter
    if (Math.abs(p.elev) < 0.4) ctx.globalAlpha = 0.72;
    sideWing(ctx, 4, -9, wingDir, wingLen, 23, r, false);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** dry-brush break-up so the shapes read as painted */
function dry(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, n: number) {
  const r = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h;
    const len = 2 + r() * 7;
    const a = (r() - 0.5) * 0.7;
    ctx.strokeStyle = `rgba(0,0,0,${0.06 + r() * 0.16})`;
    ctx.lineWidth = 0.6 + r();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export function sparrowSideAtlas() {
  const c = makeCanvas(SP_CELL * SP_POSES, SP_CELL);
  const ctx = c.getContext("2d")!;
  SIDE.forEach((p, k) => {
    const cell = makeCanvas(SP_CELL, SP_CELL);
    const cx = cell.getContext("2d")!;
    sideSparrow(cx, SP_CELL / 2, SP_BODY_Y, SP_U, p, 700 + k);
    dry(cx, 0, 0, SP_CELL, SP_CELL, 900 + k, 380);
    ctx.filter = "blur(0.45px)";
    ctx.drawImage(cell, k * SP_CELL, 0);
    ctx.filter = "none";
  });
  return c;
}

/** Front view, flying at the lens: the face and bib towards us, wings out to both sides,
 *  their pale undersides and grey flight feathers showing. */
export function sparrowFrontAtlas() {
  const C = SPF_CELL;
  const atlas = makeCanvas(C * SPF_POSES, C);
  const actx = atlas.getContext("2d")!;
  const elevs = [1, 0.12, -0.85];
  elevs.forEach((e, k) => {
    const r = mulberry32(800 + k);
    const cell = makeCanvas(C, C);
    const ctx = cell.getContext("2d")!;
    ctx.save();
    ctx.translate(C / 2, C / 2 + 20);
    ctx.scale(4.4, 4.4);
    for (const side of [-1, 1]) {
      const sx = side * 11, sy = -6;
      // the wing points out to its side, raised (e > 0) or lowered
      const dirA = side > 0 ? -e * 0.7 : Math.PI + e * 0.7;
      const ux = Math.cos(dirA), uy = Math.sin(dirA) * 0.92;
      const len = 72 - Math.abs(e) * 8;
      const wx = sx + ux * len * 0.42, wy = sy + uy * len * 0.42;
      // feather tips sweep back (down the frame, towards the tail): rotate the wing
      // direction towards +y by an amount that grows towards the body
      const downSense = side > 0 ? 1 : -1;
      for (let q = 0; q < 10; q++) {
        const t = q / 9;
        const along = 0.12 + t * 0.88;
        const bx = sx + ux * len * along * 0.62, by = sy + 3 + uy * len * along * 0.62;
        const [dx, dy] = rot(ux, uy, downSense * (1.35 - t * 1.15));
        const fl = 12 + t * t * 26;
        brush(ctx, bx, by, bx + dx * fl * 0.5, by + dy * fl * 0.5, bx + dx * fl, by + dy * fl, 6.2, 1.3, t > 0.5 ? INK : "96,88,86", t > 0.5 ? 0.88 : 0.74, r, 0.08);
      }
      // the arm: pale underwing coverts with an ochre leading edge
      brush(ctx, sx, sy, (sx + wx) / 2, (sy + wy) / 2 - 2, wx, wy, 13, 8, BELLY, 0.95, r, 0.08);
      brush(ctx, sx, sy - 5, (sx + wx) / 2, (sy + wy) / 2 - 7, wx, wy - 3, 4.5, 3, OCHRE, 0.9, r, 0.06);
    }
    // body: one pale round mass, ochre at the flanks
    wash(ctx, 0, 8, 18, 24, 0, BELLY, 1, 0.85);
    wash(ctx, -12, 12, 7, 16, 0.12, OCHRE, 0.22, 0.3);
    wash(ctx, 12, 12, 7, 16, -0.12, OCHRE, 0.22, 0.3);
    // tail, foreshortened below
    // the tail is mostly behind the body: a short dark wedge below the belly
    for (let q = 0; q < 3; q++) {
      const t = q - 1;
      brush(ctx, t * 2.5, 27, t * 3.5, 31, t * 5, 36, 6.5, 4.5, q === 1 ? INK : OCHRE_D, 0.85, r, 0.05);
    }
    ctx.strokeStyle = `rgba(${LEG},0.9)`;
    ctx.lineWidth = 1.4;
    for (const fx of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(fx, 26);
      ctx.lineTo(fx * 1.4, 31);
      ctx.stroke();
    }
    // head towards us
    wash(ctx, 0, -22, 13.5, 12.5, 0, HEAD, 1, 0.85);
    brush(ctx, -9, -29, 0, -34, 9, -29, 9, 9, OCHRE_D, 0.95, r, 0.08);
    for (const s of [-1, 1]) {
      wash(ctx, s * 8.5, -17.5, 4.6, 3.8, s * 0.3, PAPER, 1, 0.8); // white cheeks low on the sides
      dot(ctx, s * 9.6, -17.2, 1.7, 1.5, 0, INK, 0.9); // the black ear spot
      dot(ctx, s * 6.4, -24.2, 1.5, 1.5, 0, INK, 1); // eyes, small, on the sides of the head
      dot(ctx, s * 6.8, -24.7, 0.45, 0.45, 0, "255,252,246", 1);
    }
    wash(ctx, 0, -13.5, 6.5, 5, 0, INK, 0.95, 0.75); // the bib, broad and short
    dot(ctx, 0, -20, 2.4, 3, 0, INK, 1); // the beak, end on
    dot(ctx, -0.8, -21, 1, 1, 0, "120,110,104", 0.8);
    ctx.restore();
    dry(ctx, 0, 0, C, C, 950 + k, 700);
    actx.filter = "blur(0.7px)";
    actx.drawImage(cell, k * C, 0);
    actx.filter = "none";
  });
  return atlas;
}
