// A woodblock-print plate (版画) of a four-vessel bronze clepsydra, as in an
// old printed treatise: cut lines of uneven width, hatching for shade, small
// captions beside each vessel. Drawn once into a canvas; returns key points.
import { makeCanvas } from "./glyph";
import { HW, mulberry32 } from "./util";

export type Clepsydra = {
  canvas: HTMLCanvasElement;
  arrowCanvas: HTMLCanvasElement; // the float-arrow, drawn apart so it can rise
  guideCanvas: HTMLCanvasElement; // the bracket that holds the arrow upright at the rim (drawn in front of it)
  guide: { x: number; y: number; w: number; h: number }; // its top-left corner and size, plate px
  w: number;
  h: number;
  spouts: { x: number; y: number; toY: number }[]; // drip tips and the water level below each
  mouth: { x: number; y: number; r: number }; // receiving vessel's water surface
  arrow: { x: number; y0: number; y1: number; ext: number };
};

export function drawClepsydra(W = 2400, H = 1500, ink = "24,20,18", labels = true): Clepsydra {
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(21);
  const INK = (a = 1) => `rgba(${ink},${a})`;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  /** a cut line: slightly wavering width, like a knife-cut block */
  const cut = (pts: [number, number][], w = 5, closed = false) => {
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = INK(pass ? 0.95 : 0.35);
      ctx.lineWidth = w * (pass ? 1 : 1.5);
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = (r() - 0.5) * 1.2, jy = (r() - 0.5) * 1.2;
        if (i === 0) ctx.moveTo(x + jx, y + jy);
        else ctx.lineTo(x + jx, y + jy);
      });
      if (closed) ctx.closePath();
      ctx.stroke();
    }
  };
  const curve = (fn: (t: number) => [number, number], n = 60) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  /** hatching inside a vertical band of a shape: x from a(t) to b(t) over y */
  const hatch = (x0: number, x1: number, y0: number, y1: number, gap = 11, w = 2.2, slant = 0) => {
    ctx.strokeStyle = INK(0.75);
    ctx.lineWidth = w;
    for (let x = x0; x < x1; x += gap * (0.85 + r() * 0.3)) {
      ctx.beginPath();
      ctx.moveTo(x, y0 + r() * 4);
      ctx.lineTo(x + slant, y1 - r() * 4);
      ctx.stroke();
    }
  };

  // ---------- the plate's frame (板框): double rule ----------
  cut([[60, 60], [W - 60, 60], [W - 60, H - 60], [60, H - 60]], 9, true);
  cut([[84, 84], [W - 84, 84], [W - 84, H - 84], [84, H - 84]], 3.5, true);

  // ---------- stand: three stepped tiers and a base ----------
  const tiers = [
    { x0: 260, x1: 760, top: 560, bot: 1340 },
    { x0: 760, x1: 1150, top: 800, bot: 1340 },
    { x0: 1150, x1: 1500, top: 1040, bot: 1340 },
  ];
  for (const t of tiers) {
    cut([[t.x0, t.bot], [t.x0, t.top], [t.x1, t.top], [t.x1, t.bot]], 6);
    // top board and wood grain
    cut([[t.x0 - 14, t.top], [t.x1 + 14, t.top], [t.x1 + 14, t.top + 26], [t.x0 - 14, t.top + 26]], 5, true);
    for (let k = 0; k < 7; k++) {
      const y = t.top + 60 + k * ((t.bot - t.top - 80) / 7);
      ctx.strokeStyle = INK(0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x0 + 16, y);
      for (let x = t.x0 + 16; x < t.x1 - 16; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.03 + k) * 4);
      ctx.stroke();
    }
    hatch(t.x1 - 70, t.x1 - 8, t.top + 30, t.bot - 6, 10, 2.4);
  }
  cut([[200, 1340], [2200, 1340]], 8);
  cut([[200, 1372], [2200, 1372]], 4);

  // ---------- vessels ----------
  const jar = (cx: number, base: number, w: number, h: number) => {
    const half = w / 2;
    const prof = (t: number): [number, number] => {
      // shoulder-heavy jar profile
      const y = base - t * h;
      const bulge = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.32 + 0.62 - (t > 0.86 ? (t - 0.86) * 1.8 : 0);
      return [cx + half * bulge, y];
    };
    const right = curve(prof, 50);
    const left = right.map(([x, y]) => [2 * cx - x, y] as [number, number]).reverse();
    cut([...left, ...right], 6);
    cut([[left[0][0] - 6, base - h], [right[right.length - 1][0] + 6, base - h]], 6);
    // lid and knob
    cut([[cx - half * 0.44, base - h - 4], [cx - half * 0.36, base - h - 28], [cx + half * 0.36, base - h - 28], [cx + half * 0.44, base - h - 4]], 5);
    cut(curve((t) => [cx + Math.cos(Math.PI * t) * 16, base - h - 28 - Math.sin(Math.PI * t) * 22], 20), 5);
    // two bands of 回纹
    for (const bt of [0.3, 0.62]) {
      const [bx, by] = prof(bt);
      const bw = bx - cx;
      cut([[cx - bw, by], [cx + bw, by]], 3);
      cut([[cx - bw, by - 22], [cx + bw, by - 22]], 3);
      ctx.strokeStyle = INK(0.85);
      ctx.lineWidth = 2.4;
      for (let x = cx - bw + 14; x < cx + bw - 20; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, by - 4);
        ctx.lineTo(x, by - 18);
        ctx.lineTo(x + 18, by - 18);
        ctx.lineTo(x + 18, by - 9);
        ctx.lineTo(x + 8, by - 9);
        ctx.stroke();
      }
    }
    // shade on the left flank
    for (let k = 0; k < 9; k++) {
      const t0 = 0.08 + k * 0.025;
      ctx.strokeStyle = INK(0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const pts = curve((t) => {
        const [x, y] = prof(t);
        return [2 * cx - x + (x - cx) * t0 * 2.2, y];
      }, 30).filter((_, i) => i > 2 && i < 28);
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    return { prof };
  };
  const J1 = { cx: 510, base: 560, w: 330, h: 300 };
  const J2 = { cx: 955, base: 800, w: 300, h: 270 };
  const J3 = { cx: 1325, base: 1040, w: 270, h: 245 };
  [J1, J2, J3].forEach((j) => jar(j.cx, j.base, j.w, j.h));

  // receiving vessel: a tall drum, open, the float-arrow rising out of it
  const D = { cx: 1830, top: 760, bot: 1340, w: 320 };
  cut([[D.cx - D.w / 2, D.bot], [D.cx - D.w / 2, D.top], [D.cx + D.w / 2, D.top], [D.cx + D.w / 2, D.bot]], 6);
  cut(curve((t) => [D.cx + Math.cos(Math.PI * 2 * t) * (D.w / 2 + 10), D.top + Math.sin(Math.PI * 2 * t) * 26], 64), 5);
  cut(curve((t) => [D.cx + Math.cos(Math.PI * 2 * t) * (D.w / 2 - 8), D.top + 4 + Math.sin(Math.PI * 2 * t) * 20], 64), 3);
  hatch(D.cx - D.w / 2 + 8, D.cx - D.w / 2 + 70, D.top + 40, D.bot - 6, 9, 2.4);
  for (const by of [D.top + 120, D.bot - 120]) cut([[D.cx - D.w / 2, by], [D.cx + D.w / 2, by]], 3);
  // feet
  for (const fx of [D.cx - D.w / 2 + 30, D.cx + D.w / 2 - 30]) cut([[fx - 22, D.bot], [fx - 14, D.bot + 26], [fx + 14, D.bot + 26], [fx + 22, D.bot]], 4);

  // spouts: a bent pipe from low on each jar, a beast-head tip over the next mouth
  const spouts: { x: number; y: number; toY: number }[] = [];
  const nextMouth = [J2.base - J2.h, J3.base - J3.h, D.top + 34];
  const nextX = [J2.cx - 40, J3.cx - 30, D.cx - 60];
  [J1, J2, J3].forEach((j, i) => {
    const sx = j.cx + j.w * 0.44, sy = j.base - j.h * 0.22;
    const tx = nextX[i], ty = nextMouth[i] - 70;
    const pts = curve((t) => [sx + (tx - sx) * t, sy - Math.sin(Math.PI * t) * 46 + (ty - sy) * t * t], 40);
    // pipe as two parallel cuts
    cut(pts.map(([x, y]) => [x, y - 9] as [number, number]), 4);
    cut(pts.map(([x, y]) => [x, y + 9] as [number, number]), 4);
    // beast head: a rounded snout with an eye
    cut(curve((t) => [tx + Math.cos(Math.PI * (0.5 + t * 1.6)) * 18, ty + Math.sin(Math.PI * (0.5 + t * 1.6)) * 16], 24), 4);
    ctx.fillStyle = INK(0.95);
    ctx.beginPath();
    ctx.arc(tx - 4, ty - 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    spouts.push({ x: tx + 6, y: ty + 16, toY: nextMouth[i] + (i === 2 ? 0 : 8) });
  });

  // the float-arrow (漏箭) with its 刻 graduations — on its own canvas. It stands on a float
  // inside the vessel, so the rod runs on far below the rim (EXT): however high the water
  // lifts it, its foot is never seen.
  const EXT = 460;
  const A = { x: D.cx, y0: D.top + 30, y1: 300, ext: EXT };
  const rodLen = A.y0 - A.y1 + EXT;
  const ac = makeCanvas(80, rodLen + 40);
  {
    const actx = ac.getContext("2d")!;
    actx.fillStyle = "rgba(228,218,196,1)";
    actx.fillRect(30, 10, 20, rodLen + 20);
    actx.strokeStyle = INK(0.95);
    actx.lineWidth = 4;
    actx.strokeRect(31, 20, 18, rodLen);
    for (let y = 40, k = 0; y < rodLen + 10; y += 22, k++) {
      actx.lineWidth = k % 4 === 0 ? 3.5 : 2.2;
      actx.beginPath();
      actx.moveTo(31, y);
      actx.lineTo(k % 4 === 0 ? 70 : 49, y);
      actx.stroke();
    }
  }
  // the guide: a collar round the rod on an arm from the right-hand rim (the drops fall on
  // the left of the rod, so nothing crosses their path); the rod slides through the collar
  const G = { x: D.cx - 34, y: D.top - 24, w: D.w / 2 + 52, h: 48 };
  const gc = makeCanvas(G.w, G.h);
  {
    const g = gc.getContext("2d")!;
    const cx0 = 34, cy0 = 24; // the rod's axis in guide px
    // arm
    g.fillStyle = "rgba(228,218,196,0.9)";
    g.fillRect(cx0 + 18, cy0 - 5, G.w - cx0 - 24, 10);
    g.strokeStyle = INK(0.95);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx0 + 18, cy0 - 5);
    g.lineTo(G.w - 8, cy0 - 5);
    g.moveTo(cx0 + 18, cy0 + 5);
    g.lineTo(G.w - 8, cy0 + 5);
    g.stroke();
    // the arm's foot on the rim
    g.lineWidth = 3.5;
    g.strokeRect(G.w - 16, cy0 - 9, 10, 18);
    // collar: a squat block with a bevel line, the slot the rod rises through
    g.fillStyle = "rgba(228,218,196,0.97)";
    g.fillRect(cx0 - 22, cy0 - 14, 44, 28);
    g.lineWidth = 4;
    g.strokeRect(cx0 - 22, cy0 - 14, 44, 28);
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(cx0 - 22, cy0 - 7);
    g.lineTo(cx0 + 22, cy0 - 7);
    g.stroke();
  }

  // ---------- captions, cut in the block like a treatise ----------
  ctx.fillStyle = INK(0.92);
  ctx.font = `400 46px ${HW}`;
  ctx.textAlign = "center";
  const cap = (s: string, x: number, y: number) => [...s].forEach((ch, i) => ctx.fillText(ch, x, y + i * 50));
  const capH = (s: string, x: number, y: number) => ctx.fillText(s, x, y);
  if (labels) {
    capH("日壶", J1.cx + 40, J1.base - J1.h - 66);
    capH("月壶", J2.cx + 70, J2.base - J2.h - 66);
    capH("星壶", J3.cx + 66, J3.base - J3.h - 66);
    cap("受水壶", D.cx + D.w / 2 + 50, D.top + 120);
    // title cartouche
    cut([[150, 130], [210, 130], [210, 400], [150, 400]], 4, true);
    ctx.font = `400 50px ${HW}`;
    cap("铜壶滴漏", 180, 190);
  }

  // ink wear: a few speckles and broken lines, as on an old impression
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.4})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2);
  }
  ctx.globalCompositeOperation = "source-over";

  return { canvas: c, arrowCanvas: ac, guideCanvas: gc, guide: G, w: W, h: H, spouts, mouth: { x: D.cx, y: D.top + 34, r: D.w / 2 - 14 }, arrow: A };
}
