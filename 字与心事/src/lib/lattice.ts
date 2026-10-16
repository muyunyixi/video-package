// 灯笼锦: a framed "lantern" in the middle of the pane, bars running out to the
// frame. The window the camera falls into at the end of the city uses it, and
// its shadow lies across the page of the ending, so the two must match.
export function lanternLattice(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bar: number) {
  const ix0 = x + w * 0.3, ix1 = x + w * 0.7, iy0 = y + h * 0.33, iy1 = y + h * 0.67;
  // outer frame
  c.fillRect(x, y, w, bar);
  c.fillRect(x, y + h - bar, w, bar);
  c.fillRect(x, y, bar, h);
  c.fillRect(x + w - bar, y, bar, h);
  // the lantern
  c.fillRect(ix0, iy0, ix1 - ix0, bar);
  c.fillRect(ix0, iy1 - bar, ix1 - ix0, bar);
  c.fillRect(ix0, iy0, bar, iy1 - iy0);
  c.fillRect(ix1 - bar, iy0, bar, iy1 - iy0);
  // bars from the lantern to the frame
  for (const fx of [0.3, 0.5, 0.7]) {
    c.fillRect(x + w * fx - bar / 2, y, bar, iy0 - y);
    c.fillRect(x + w * fx - bar / 2, iy1, bar, y + h - iy1);
  }
  for (const fy of [0.33, 0.5, 0.67]) {
    c.fillRect(x, y + h * fy - bar / 2, ix0 - x, bar);
    c.fillRect(ix1, y + h * fy - bar / 2, x + w - ix1, bar);
  }
}
