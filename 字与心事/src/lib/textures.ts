import * as THREE from "three";
import { HW, SANS, mulberry32 } from "./util";
import { makeCanvas } from "./glyph";
import { glyphInk, cellOf, penInCell } from "./ink";

export function toTex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** One glyph centred in a square cell, em box aligned so punctuation sits right. */
export function glyphCell(
  ch: string,
  px = 256,
  o: { font?: string; color?: string; bg?: string | null; weight?: number; scale?: number; blur?: number; dy?: number } = {}
) {
  const c = makeCanvas(px, px);
  const ctx = c.getContext("2d")!;
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, px, px);
  }
  const s = (o.scale ?? 0.9) * px;
  ctx.font = `${o.weight ?? 400} ${s}px ${o.font ?? HW}`;
  const m = ctx.measureText("字");
  const asc = m.fontBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent;
  const top = (px - (asc + desc)) / 2;
  // v4.5: set as the grid sets a character in its cell (lib/ink): a full-width one's em cell centred in
  // the square and the glyph in it as every line has it (in 汇文明朝体 its ink on the cell's axis), a
  // half-width one's advance centred. v4.4 centred every glyph's advance, so the type, the strip, the
  // title and the moon's 月 stood off the axis the lines put the same characters on (， by 29 units in
  // 1024, 落 by 29, 月 by 16).
  const font = o.font ?? HW, g = glyphInk(ch, s, font, o.weight ?? 400), cell = cellOf(ch, g, s);
  if (o.blur) ctx.filter = `blur(${o.blur}px)`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = o.color ?? "#16120f";
  ctx.fillText(ch, px / 2 - cell / 2 + penInCell(ch, cell, g, font), top + asc + (o.dy ?? 0) * px);
  return c;
}

/** Rice-paper texture with fibres; optional rounded-rect alpha mask. */
export function paperCanvas(w: number, h: number, o: { base?: string; seed?: number; radius?: number; fibers?: number; speck?: number; warm?: number; mottle?: number } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const rnd = mulberry32(o.seed ?? 3);
  const r = o.radius ?? 0;
  ctx.save();
  if (r > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.clip();
  }
  ctx.fillStyle = o.base ?? "#ece4d4";
  ctx.fillRect(0, 0, w, h);
  // low-frequency mottling
  for (let i = 0; i < 60; i++) {
    const x = rnd() * w, y = rnd() * h, rr = (0.05 + rnd() * 0.25) * Math.max(w, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    const a = (0.02 + rnd() * 0.035) * (o.mottle ?? 1);
    g.addColorStop(0, rnd() < 0.5 ? `rgba(120,95,60,${a})` : `rgba(255,252,240,${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // fibres
  const nf = o.fibers ?? Math.floor((w * h) / 900);
  ctx.lineCap = "round";
  for (let i = 0; i < nf; i++) {
    const x = rnd() * w, y = rnd() * h;
    const len = 4 + rnd() * 26;
    const ang = rnd() * Math.PI * 2;
    ctx.strokeStyle = rnd() < 0.6 ? `rgba(110,90,62,${0.03 + rnd() * 0.07})` : `rgba(255,255,248,${0.05 + rnd() * 0.1})`;
    ctx.lineWidth = 0.5 + rnd() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang + 0.6) * len * 0.5, y + Math.sin(ang + 0.6) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  const ns = o.speck ?? Math.floor((w * h) / 2500);
  for (let i = 0; i < ns; i++) {
    ctx.fillStyle = `rgba(60,45,30,${0.05 + rnd() * 0.15})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  ctx.restore();
  return c;
}

export function noiseCanvas(w: number, h: number, base: string, amt = 18, seed = 5) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const rnd = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function glowCanvas(px = 256, color = "255,90,60", soft = 0.5) {
  const c = makeCanvas(px, px);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(soft, `rgba(${color},0.25)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  return c;
}

/** Character atlas: cols x rows cells; returns texture + uv lookup. */
export function charAtlas(chars: string[], cell = 128, o: { color?: string; bg?: string; blur?: number; font?: string } = {}) {
  const cols = 32;
  const rows = Math.ceil(chars.length / cols);
  const c = makeCanvas(cols * cell, rows * cell);
  const ctx = c.getContext("2d")!;
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  chars.forEach((ch, i) => {
    const g = glyphCell(ch, cell, { color: o.color, blur: o.blur, font: o.font, scale: 0.84 });
    ctx.drawImage(g, (i % cols) * cell, Math.floor(i / cols) * cell);
  });
  const tex = toTex(c);
  return { tex, cols, rows, index: new Map(chars.map((ch, i) => [ch, i])) };
}

export const SANS_FONT = SANS;
