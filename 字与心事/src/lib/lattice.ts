// 灯笼锦: a framed "lantern" in the middle of the pane, bars running out to the
// frame. The window the camera falls into at the end of the city uses it, and
// its shadow lies across the page of the ending, so the two must match.
// v5.1: every bar is centred on its line (the lantern's sides on 0.3 / 0.7 of the width and
// 0.33 / 0.67 of the height, like the bars running out from them): the lantern used to sit
// inside those lines, half a bar off the bars it meets, so neither the uprights nor the
// cross-bars ran straight through it (15 px in the ending's shadow). And the whole lattice is
// one path filled once, so where two bars cross the ink is not laid twice (the shadow is drawn
// at 0.62: the joints came out darker).
export function lanternLattice(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bar: number) {
  const ix0 = x + w * 0.3, ix1 = x + w * 0.7, iy0 = y + h * 0.33, iy1 = y + h * 0.67;
  const r = bar / 2;
  c.beginPath();
  // outer frame
  c.rect(x, y, w, bar);
  c.rect(x, y + h - bar, w, bar);
  c.rect(x, y, bar, h);
  c.rect(x + w - bar, y, bar, h);
  // the lantern
  c.rect(ix0 - r, iy0 - r, ix1 - ix0 + bar, bar);
  c.rect(ix0 - r, iy1 - r, ix1 - ix0 + bar, bar);
  c.rect(ix0 - r, iy0 - r, bar, iy1 - iy0 + bar);
  c.rect(ix1 - r, iy0 - r, bar, iy1 - iy0 + bar);
  // bars from the lantern to the frame
  for (const fx of [0.3, 0.5, 0.7]) {
    c.rect(x + w * fx - r, y, bar, iy0 - y);
    c.rect(x + w * fx - r, iy1, bar, y + h - iy1);
  }
  for (const fy of [0.33, 0.5, 0.67]) {
    c.rect(x, y + h * fy - r, ix0 - x, bar);
    c.rect(ix1, y + h * fy - r, x + w - ix1, bar);
  }
  c.fill(); // nonzero: overlapping bars are filled once
}
