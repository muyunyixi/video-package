import * as THREE from "three";
import { HW, mulberry32 } from "./util";
import { glyphInk, cellOf, penInCell } from "./ink";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export type TextOpts = {
  font?: string; // family string
  weight?: number | string;
  size?: number; // px
  color?: string;
  bg?: string | null;
  pad?: number;
  letterSpacing?: number; // px
  vertical?: boolean;
  shadow?: string | null;
};

/** Measure + draw a single-line (or vertical) text block into its own canvas. v4.5: on the grid, as
 *  every line (lib/ink): a full-width character takes one em, set in it on its axis; `widths` are the
 *  cells (v4.4: the font's advances). */
export function drawText(text: string, o: TextOpts = {}) {
  const font = o.font ?? HW;
  const size = o.size ?? 128;
  const weight = o.weight ?? 400;
  const pad = o.pad ?? Math.round(size * 0.18);
  const ls = o.letterSpacing ?? 0;
  const chars = [...text];
  const inks = chars.map((c) => glyphInk(c, size, font, weight));
  const widths = chars.map((c, i) => cellOf(c, inks[i], size));
  const pen = (i: number) => penInCell(chars[i], widths[i], inks[i], font);
  let w: number, h: number;
  if (o.vertical) {
    w = size + pad * 2;
    h = chars.length * size + (chars.length - 1) * ls + pad * 2;
  } else {
    w = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1) + pad * 2;
    h = size * 1.25 + pad * 2;
  }
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = o.color ?? "#141110";
  ctx.textBaseline = "middle";
  if (o.shadow) {
    ctx.shadowColor = o.shadow;
    ctx.shadowBlur = size * 0.08;
  }
  ctx.textAlign = "left";
  if (o.vertical) chars.forEach((ch, i) => ctx.fillText(ch, w / 2 - widths[i] / 2 + pen(i), pad + size / 2 + i * (size + ls)));
  else {
    let x = pad;
    chars.forEach((ch, i) => {
      ctx.fillText(ch, x + pen(i), h / 2 + size * 0.04);
      x += widths[i] + ls;
    });
  }
  return { canvas: c, w: c.width, h: c.height, widths, pad };
}

const texCache = new Map<string, THREE.CanvasTexture>();
export function textTexture(text: string, o: TextOpts = {}) {
  const key = JSON.stringify([text, o]);
  const hit = texCache.get(key);
  if (hit) return hit;
  const { canvas } = drawText(text, o);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/** A plane mesh carrying text; height in world units, width follows aspect. */
export function textPlane(text: string, heightWU: number, o: TextOpts = {}, mat: Partial<THREE.MeshBasicMaterialParameters> = {}) {
  const { canvas } = drawText(text, o);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  const aspect = canvas.width / canvas.height;
  const geo = new THREE.PlaneGeometry(heightWU * aspect, heightWU);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, ...mat });
  const mesh = new THREE.Mesh(geo, m);
  return { mesh, tex, aspect, width: heightWU * aspect, height: heightWU };
}

/** Sample N points from the ink of a text rendering. Returns pixel coords centred on the block. */
export function sampleTextPoints(text: string, n: number, o: TextOpts = {}, seed = 1) {
  const { canvas, w, h } = drawText(text, { ...o, color: "#000", bg: null });
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, w, h).data;
  const pts: number[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / (n * 6))));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 140) pts.push(x, y);
    }
  }
  const rnd = mulberry32(seed);
  const out = new Float32Array(n * 2);
  const m = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rnd() * m);
    out[i * 2] = pts[k * 2] - w / 2 + (rnd() - 0.5) * step;
    out[i * 2 + 1] = -(pts[k * 2 + 1] - h / 2) + (rnd() - 0.5) * step;
  }
  return { points: out, w, h };
}

/** Height map from glyph (blurred) for relief/bump on type blocks. */
export function reliefCanvas(ch: string, size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.filter = `blur(${size * 0.006}px)`;
  ctx.fillStyle = "#fff";
  ctx.font = `400 ${size * 0.78}px ${HW}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, size / 2, size / 2 + size * 0.03);
  return c;
}
