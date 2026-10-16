// SVG → transparent PNG with the same Chromium the film renders in (tools/gridtype.py --png).
// usage: node tools/svg2png.mjs IN.svg OUT.png WIDTH HEIGHT
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";

const [, , src, out, w, h] = process.argv;
const W = Math.ceil(+w), H = Math.ceil(+h);
const svg = fs.readFileSync(src, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
await browser.close();
console.log(`${out} ${W}×${H}`);
