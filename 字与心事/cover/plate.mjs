// Cover plates: frames of the film rendered again at a higher pixel ratio (WebGL included), with the
// HUD and the source line hidden, saved as PNG for the cover to be cut from. Uses a copy of the
// film's frozen bundle whose renderers take window.__dpr as their pixel ratio (out/bundle_cover.js,
// made by cover/make_bundle.py); the film's own source is not touched.
// usage: node cover/plate.mjs --frames 880,1300 [--dpr 2] [--out out/cover/plates] [--bundle bundle_cover.js]
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const frames = String(args.frames).split(",").map(Number);
const dpr = +(args.dpr ?? 2);
const out = args.out ?? "/home/claude/zxs/out/cover/plates";
const bundle = args.bundle ?? "bundle_cover.js";
fs.mkdirSync(out, { recursive: true });

const root = "/home/claude";
const types = { ".html": "text/html", ".js": "text/javascript", ".otf": "font/otf", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http
  .createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(0);
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--zxs-tag=cover"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.addInitScript((d) => {
  window.__dpr = d;
  // the HUD (top right) and the source line (bottom centre) are off on a cover
  document.addEventListener("DOMContentLoaded", () => {
    const st = document.createElement("style");
    st.textContent =
      'div[style*="right: 96px"][style*="top: 53px"]{visibility:hidden !important}' +
      'div[style*="bottom: 49px"][style*="justify-content: center"]{visibility:hidden !important}';
    document.head.appendChild(st);
  });
}, dpr);
await page.goto(`http://localhost:${port}/zxs/render/index.html?b=${bundle}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
for (const f of frames) {
  const t = Date.now();
  await page.evaluate((f) => window.seek(f), f);
  await page.waitForTimeout(300);
  const file = path.join(out, `p_${String(f).padStart(5, "0")}_x${dpr}.png`);
  await page.screenshot({ path: file, type: "png", timeout: 600000 });
  console.log(`plate ${f} ${((Date.now() - t) / 1000).toFixed(1)} s -> ${file}`);
}
await browser.close();
server.close();
process.exit(0);
