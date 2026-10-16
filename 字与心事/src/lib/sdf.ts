// Signed distance fields for glyph ink effects (bleed, seep, tremble).
// Felzenszwalb–Huttenlocher exact Euclidean distance transform, two passes.
import * as THREE from "three";

const INF = 1e20;
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
function edt2d(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]);
  }
}

/**
 * SDF of a canvas's alpha. Returns a texture where 0.5 is the edge,
 * values < 0.5 are inside, scaled so `spread` px maps to 0.5.
 */
export function sdfTexture(src: HTMLCanvasElement, spread = 24) {
  const w = src.width, h = src.height;
  const data = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  const outside = new Float64Array(w * h);
  const inside = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255;
    outside[i] = a > 0.5 ? 0 : INF;
    inside[i] = a > 0.5 ? INF : 0;
  }
  edt2d(outside, w, h);
  edt2d(inside, w, h);
  const bytes = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const sd = outside[i] - inside[i]; // >0 outside, <0 inside (px)
      const v = Math.max(0, Math.min(1, 0.5 + sd / (2 * spread)));
      // flip rows for GL
      const j = ((h - 1 - y) * w + x) * 4;
      bytes[j] = Math.round(v * 255);
      bytes[j + 1] = Math.round(v * 255);
      bytes[j + 2] = Math.round(v * 255);
      bytes[j + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
